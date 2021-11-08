#!/usr/bin/python3

import requests
import os
import time
import math
import subprocess
import json
import locale
import tempfile
import zipfile
import shutil
import datetime
import copy
from pathlib import Path
import threading
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
gi.require_version('Gio', '2.0')
from gi.repository import Gdk, Gtk, Gio

from . import logger
from . import proxygsettings

DEBUG = False
if os.getenv("DEBUG") != None:
    DEBUG = True
def debug(msg):
    if DEBUG:
        print(msg)

LANGUAGE_CODE = "C"
try:
    LANGUAGE_CODE = locale.getlocale()[0].split("_")[0]
except:
    pass

URL_GITHUB_SPICES = "https://cinnamon-spices.linuxmint.com"
URL_SPICES_HOME = "https://cinnamon-spices.linuxmint.com"

SPICE_MAP = {
    "applet": {
        "url": URL_SPICES_HOME + "/json/applets.json",
        "enabled-schema": "org.cinnamon",
        "enabled-key": "enabled-applets"
    },
    "desklet": {
        "url": URL_SPICES_HOME + "/json/desklets.json",
        "enabled-schema": "org.cinnamon",
        "enabled-key": "enabled-desklets"
    },
    "extension": {
        "url": URL_SPICES_HOME + "/json/extensions.json",
        "enabled-schema": "org.cinnamon",
        "enabled-key": "enabled-extensions"
    },
    "theme": {
        "url": URL_SPICES_HOME + "/json/themes.json",
        "enabled-schema": "org.cinnamon.theme",
        "enabled-key": "name"
    }
}

TIMEOUT_DOWNLOAD_JSON = 60
TIMEOUT_DOWNLOAD_THUMB = 60
TIMEOUT_DOWNLOAD_ZIP = 120

home = os.path.expanduser("~")
locale_inst = '%s/.local/share/locale' % home
settings_dir = '%s/.cinnamon/configs/' % home

activity_logger = logger.ActivityLogger()

# return how many times 10m goes into the utc timestamp.
# This gives us a unique value every 10 minutes to allow
# the server cache to be utilized.
TIMESTAMP_LIFETIME_MINUTES = 10
def get_current_timestamp():
    seconds = datetime.datetime.utcnow().timestamp()
    return int(seconds // (TIMESTAMP_LIFETIME_MINUTES * 60))

class SpiceUpdate():
    def __init__(self, spice_type, uuid, index_node, meta_node):

        self.uuid = uuid
        self.spice_type = spice_type

        self.author = ""
        try:
            author = index_node["author_user"]
            if name not in ("none", "unknown"):
                self.author = name
        except:
            pass

        try:
            self.name = index_node["translations"]["name_%s" % LANGUAGE_CODE]
        except:
            self.name = index_node["name"]

        try:
            self.description = index_node["translations"]["description_%s" % LANGUAGE_CODE]
        except:
            self.description = index_node["description"]

        try:
            self.old_version = datetime.datetime.fromtimestamp(meta_node["last-edited"]).strftime("%Y.%m.%d")
        except:
            self.old_version = ""

        try:
            self.new_version = datetime.datetime.fromtimestamp(index_node["last_edited"]).strftime("%Y.%m.%d")
        except:
            self.new_version = ""

        self.commit_id = index_node['last_commit']
        self.commit_msg = index_node['last_commit_subject']

        self.link = "%s/%ss/view/%s" % (URL_SPICES_HOME, spice_type, index_node["spices-id"])
        self.size = index_node['file_size']

class SpicePathSet():
    def __init__(self, cache_item, spice_type):
        cache_folder = Path('%s/.cinnamon/spices.cache/%s/' % (home, spice_type))

        is_theme = spice_type == "theme"

        if is_theme:
            thumb_rel_path = Path(cache_item["screenshot"])
            self.thumb_basename = thumb_rel_path.name
            self.thumb_download_url = URL_SPICES_HOME + thumb_rel_path.as_posix()
        else:
            thumb_rel_path = Path(cache_item["icon"])
            self.thumb_basename = thumb_rel_path.name
            self.thumb_download_url = URL_SPICES_HOME + thumb_rel_path.as_posix()

        self.thumb_local_path = cache_folder.joinpath(self.thumb_basename)
        self.zip_download_url = URL_SPICES_HOME + cache_item['file']

class Harvester():
    def __init__(self, spice_type):
        self.spice_type = spice_type

        self.themes = self.spice_type == "theme"

        self.has_cache = False
        self.updates = []
        self.meta_map = {}
        self.index_cache = {}
        self.cache_lock = threading.Lock()

        self.cache_folder = '%s/.cinnamon/spices.cache/%s/' % (home, self.spice_type)

        self.index_file = os.path.join(self.cache_folder, "index.json")

        os.makedirs(self.cache_folder, mode=0o755, exist_ok=True)

        if self.themes:
            self.install_folder = os.path.join(home, ".themes")
            self.spices_directories = (self.install_folder, )
        else:
            self.install_folder = os.path.join(home, ".local/share/cinnamon", "%ss" % self.spice_type)
            self.spices_directories = ("/usr/share/cinnamon/%ss" % self.spice_type,
                                       self.install_folder)

        self._load_cache()
        self._load_metadata()

        self.proxy_info = {}
        try:
            self.proxy_info = proxygsettings.get_proxy_settings()
        except Exception as e:
            print(e)

    def refresh(self):
        debug("Cache stamp: %d" % get_current_timestamp())
        self._update_local_json()
        self._update_local_thumbs()

        self._load_metadata()
        self._clean_old_thumbs()

    def get_updates(self):
        return self._generate_update_list()

    def install(self, uuid):
        self._install_by_uuid(uuid)

    def get_enabled(self, uuid):
        settings = Gio.Settings(schema_id=SPICE_MAP[self.spice_type]["enabled-schema"])

        enabled_count = 0
        enabled_list = []

        if self.themes:
            enabled_list = [settings.get_string(SPICE_MAP[self.spice_type]["enabled-key"])]
        else:
            enabled_list = settings.get_strv(SPICE_MAP[self.spice_type]["enabled-key"])

        for item in enabled_list:
            item = item.replace("!", "")
            if uuid in item.split(":"):
                enabled_count += 1

        return enabled_count

    def _update_local_json(self):
        debug("harvester: Downloading new list of available %ss" % self.spice_type)
        url = SPICE_MAP[self.spice_type]["url"]

        try:
            r = requests.get(url,
                             timeout=TIMEOUT_DOWNLOAD_JSON,
                             proxies=self.proxy_info,
                             params={ "time" : get_current_timestamp() })
            debug("Downloading from %s" % r.request.url)
        except Exception as e:
            print("Could not refresh json data for %s: %s" % (self.spice_type, e))
            return

        if r.status_code != requests.codes.ok:
            debug("Can't download spices json: ", r.status_code)
            return

        with open(self.index_file, "w") as f:
            f.write(r.text)

        self._load_cache()

    def _update_local_thumbs(self):
        # This uses threads for the downloads, but this function blocks until
        # all are downloaded.
        with ThreadPoolExecutor(max_workers=10) as tpe:
            def thumb_job(uuid, item):
                self._download_thumb(uuid, item)

            with self.cache_lock:
                for uuid, item in self.index_cache.items():
                    debug("Submitting thumb_job for %s" % uuid)
                    tpe.submit(thumb_job, copy.copy(uuid), copy.deepcopy(item))

    def _download_thumb(self, uuid, item):
        paths = SpicePathSet(item, spice_type=self.spice_type)
        if (not os.path.isfile(paths.thumb_local_path)) or self._is_bad_image(paths.thumb_local_path) or self._spice_has_update(uuid):
            debug("Downloading thumbnail for %s: %s" % (uuid, paths.thumb_download_url))

            try:
                r = requests.get(paths.thumb_download_url,
                                 timeout=TIMEOUT_DOWNLOAD_THUMB,
                                 proxies=self.proxy_info,
                                 params={ "time" : get_current_timestamp() })
            except Exception as e:
                print("Could not get thumbnail for %s: %s" % (uuid, e))
                return

            if r.status_code != requests.codes.ok:
                debug("Can't download thumbnail for %s: %s" % (uuid, r.status_code))
                return

            with open(paths.thumb_local_path, "wb") as f:
                f.write(r.content)

    def _load_metadata(self):
        debug("harvester: Loading metadata on installed %ss" % self.spice_type)
        self.meta_map = {}

        for directory in self.spices_directories:
            try:
                extensions = os.listdir(directory)

                for uuid in extensions:
                    subdirectory = os.path.join(directory, uuid)
                    try:
                        with open(os.path.join(subdirectory, "metadata.json"), "r") as f:
                            metadata = json.load(f)

                            metadata['path'] = subdirectory
                            metadata['writable'] = os.access(subdirectory, os.W_OK)
                            self.meta_map[uuid] = metadata
                    except Exception as detail:
                        debug(detail)
                        debug("Skipping %s: there was a problem trying to read metadata.json" % uuid)
            except FileNotFoundError:
                # debug("%s does not exist! Creating it now." % directory)
                try:
                    os.makedirs(directory, mode=0o755, exist_ok=True)
                except Exception:
                    pass

    def _load_cache(self):
        debug("harvester: Loading local %s cache" % self.spice_type)
        self.index_cache = {}

        try:
            with open(self.index_file, "r") as f:
                self.index_cache = json.load(f)
                self.has_cache = True
        except FileNotFoundError:
            self.has_cache = False
            return
        except ValueError as e:
            try:
                os.remove(self.index_file)
            except:
                pass
            debug(e)

    def _generate_update_list(self):
        debug("harvester: Generating list of updated %ss" % self.spice_type)

        self.updates = []

        for uuid in self.index_cache.keys():
            if uuid in self.meta_map.keys() and self._spice_has_update(uuid):
                update = SpiceUpdate(self.spice_type, uuid, self.index_cache[uuid], self.meta_map[uuid])
                self.updates.append(update)

        return self.updates

    def _spice_has_update(self, uuid):
        try:
            return int(self.meta_map[uuid]["last-edited"]) < self.index_cache[uuid]["last_edited"]
        except Exception as e:
            return False

    def _install_by_uuid(self, uuid):
        action = "upgrade" if uuid in self.meta_map.keys() else "install"

        try:
            item = self.index_cache[uuid]
        except KeyError:
            debug("Can't install %s - it doesn't seem to exist on the server" % uuid)
            return

        paths = SpicePathSet(item, spice_type=self.spice_type)

        try:
            r = requests.get(paths.zip_download_url,
                             timeout=TIMEOUT_DOWNLOAD_ZIP,
                             proxies=self.proxy_info,
                             params={ "time" : get_current_timestamp() })
        except Exception as e:
            print("Could not download zip for %s: %s" % (uuid, e))
            return

        if r.status_code != requests.codes.ok:
            debug("couldn't download")
            return

        try:
            tmp_name = None
            with tempfile.NamedTemporaryFile(delete=False) as f:
                tmp_name = f.name
                f.write(r.content)

            zip = zipfile.ZipFile(tmp_name)
            os.remove(tmp_name)

            with tempfile.TemporaryDirectory() as d:
                zip.extractall(d)
                self._install_from_folder(os.path.join(d, uuid), uuid, from_spices=True)
                self.write_to_log(uuid, action)

                self._load_metadata()
        except Exception as e:
            debug("couldn't install", e)

    def _install_from_folder(self, folder, uuid, from_spices=False):
        contents = os.listdir(folder)

        if not self.themes:
            # Install spice localization files, if any
            if 'po' in contents:
                po_dir = os.path.join(folder, 'po')
                for file in os.listdir(po_dir):
                    if file.endswith('.po'):
                        lang = file.split(".")[0]
                        locale_dir = os.path.join(locale_inst, lang, 'LC_MESSAGES')
                        os.makedirs(locale_dir, mode=0o755, exist_ok=True)
                        subprocess.call(['msgfmt', '-c', os.path.join(po_dir, file), '-o', os.path.join(locale_dir, '%s.mo' % uuid)])

        dest = os.path.join(self.install_folder, uuid)
        if os.path.exists(dest):
            shutil.rmtree(dest)
        shutil.copytree(folder, dest)

        if not self.themes:
            # ensure proper file permissions
            for root, dirs, files in os.walk(dest):
                for file in files:
                    os.chmod(os.path.join(root, file), 0o755)

        meta_path = os.path.join(dest, 'metadata.json')

        if self.themes and not os.path.exists(meta_path):
            md = {}
        else:
            with open(meta_path, "r") as f:
                md = json.load(f)

        if from_spices and uuid in self.index_cache:
            md['last-edited'] = self.index_cache[uuid]['last_edited']
        else:
            md['last-edited'] = int(datetime.datetime.utcnow().timestamp())

        with open(meta_path, "w+") as f:
            json.dump(md, f, indent=4)

    def write_to_log(self, uuid, action):
        new_version = "<none>"
        old_verison = "<none>"

        try:
            remote_item = self.index_cache[uuid]
            new_version = datetime.datetime.fromtimestamp(remote_item["last_edited"]).strftime("%Y.%m.%d")
        except KeyError:
            if action in ("upgrade", "install"):
                debug("Upgrading %s with no local metadata - something's wrong" % uuid)

        try:
            local_item = self.meta_map[uuid]
            old_version = datetime.datetime.fromtimestamp(local_item["last-edited"]).strftime("%Y.%m.%d")
        except KeyError:
            if action in ("upgrade", "remove"):
                debug("Upgrading or removing %s with no local metadata - something's wrong" % uuid)

        log_timestamp = datetime.datetime.now().strftime("%F %T")
        activity_logger.log("%s %s %s %s %s %s" % (log_timestamp, self.spice_type, action, uuid, old_version, new_version))

    def get_icon_surface(self, uuid, ui_scale):
        """ gets the icon  for a given uuid"""
        try:
            pixbuf = None

            paths = SpicePathSet(self.index_cache[uuid], spice_type=self.spice_type)

            if self.themes:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(paths.thumb_local_path, 100 * ui_scale, -1, True)
            else:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(paths.thumb_local_path, 24 * ui_scale, 24 * ui_scale, True)

            if pixbuf == None:
                raise Exception

            surf = Gdk.cairo_surface_create_from_pixbuf(pixbuf, ui_scale, None)
            return Gtk.Image.new_from_surface (surf)
        except Exception as e:
            debug("There was an error processing one of the images. Try refreshing the cache.")
            return Gtk.Image.new_from_icon_name('image-missing', Gtk.IconSize.LARGE_TOOLBAR)

    def _is_bad_image(self, path):
        try:
            Image.open(path)
        except IOError as detail:
            return True
        return False

    def _clean_old_thumbs(self):
        # Cleanup obsolete thumbs
        flist = os.listdir(self.cache_folder)

        for item in self.index_cache.values():
            paths = SpicePathSet(item, spice_type=self.spice_type)
            try:
                flist.remove(paths.thumb_basename)
            except ValueError:
                pass

        for f in flist:
            if f == "index.json":
                continue
            try:
                debug("removing old thumb", f)
                os.remove(os.path.join(self.cache_folder, f))
            except:
                pass