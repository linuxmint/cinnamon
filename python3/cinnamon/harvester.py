#!/usr/bin/python3

import os
import sys
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
import requests

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
gi.require_version('Gio', '2.0')
from gi.repository import Gdk, Gtk, Gio, GLib

from . import logger
from . import proxygsettings

DEBUG = os.getenv("DEBUG") is not None

def debug(msg):
    if DEBUG:
        print(msg, file=sys.stderr)

LANGUAGE_CODE = "C"
try:
    LANGUAGE_CODE = locale.getlocale()[0].split("_")[0]
except:
    pass

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
    "action": {
        "url": URL_SPICES_HOME + "/json/actions.json",
        "enabled-schema": "org.nemo.plugins",
        "enabled-key": "disabled-actions"
    },
    "theme": {
        "url": URL_SPICES_HOME + "/json/themes.json",
        "enabled-schema": "org.cinnamon.theme",
        "enabled-key": "name"
    }
}

TIMEOUT_DOWNLOAD_JSON = 15
TIMEOUT_DOWNLOAD_THUMB = 60
TIMEOUT_DOWNLOAD_ZIP = 120

home = os.path.expanduser("~")
locale_inst = f'{home}/.local/share/locale'
settings_dir = os.path.join(GLib.get_user_config_dir(), 'cinnamon', 'spices')

activity_logger = logger.ActivityLogger()

# return how many times 10m goes into the utc timestamp.
# This gives us a unique value every 10 minutes to allow
# the server cache to be utilized.
TIMESTAMP_LIFETIME_MINUTES = 10


def get_current_timestamp():
    seconds = datetime.datetime.utcnow().timestamp()
    return int(seconds // (TIMESTAMP_LIFETIME_MINUTES * 60))

class SpiceUpdate:
    def __init__(self, spice_type, uuid, index_node, meta_node):

        self.uuid = uuid
        self.spice_type = spice_type

        self.author = ""
        try:
            author = index_node["author_user"]
            if author not in {"none", "unknown"}:
                self.author = author
        except:
            pass

        try:
            self.name = index_node["translations"][f"name_{LANGUAGE_CODE}"]
        except:
            self.name = index_node["name"]

        try:
            self.description = index_node["translations"][f"description_{LANGUAGE_CODE}"]
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

        self.link = f"{URL_SPICES_HOME}/{spice_type}s/view/{index_node['spices-id']}"
        self.size = index_node['file_size']


class SpicePathSet:
    def __init__(self, cache_item, spice_type):
        cache_folder = Path(os.path.join(GLib.get_user_cache_dir(), 'cinnamon', 'spices', spice_type))

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


class Harvester:
    def __init__(self, spice_type):
        self.spice_type = spice_type

        self.themes = self.spice_type == "theme"
        self.actions = self.spice_type == "action"

        self.has_cache = False
        self.updates = []
        self.meta_map = {}
        self.index_cache = {}
        self.cache_lock = threading.Lock()

        self.cache_folder = os.path.join(GLib.get_user_cache_dir(), 'cinnamon', 'spices', self.spice_type)

        self.index_file = os.path.join(self.cache_folder, "index.json")

        self.install_folder = f"{home}/.local/share/nemo/actions" if self.actions else os.path.join(home, ".local/share/cinnamon", f"{self.spice_type}s")

        if self.themes:
            old_install_folder = f'{home}/.themes/'
            self.spices_directories = (old_install_folder, self.install_folder)
        else:
            self.spices_directories = (self.install_folder, )

        self.disabled = not self.anything_installed()

        self._load_cache()
        self._load_metadata()

        self.proxy_info = {}
        try:
            self.proxy_info = proxygsettings.get_proxy_settings()
        except Exception as e:
            print(e)

    def anything_installed(self):
        for location in self.spices_directories:
            path = Path(location)
            if not path.exists():
                continue

            for _ in path.iterdir():
                return True

        debug(f"No additional {self.spice_type}s installed")
        return False

    def refresh(self, full):
        self.disabled = not self.anything_installed()

        if self.disabled:
            return

        debug(f"Cache stamp: {get_current_timestamp()}")

        os.makedirs(self.cache_folder, mode=0o755, exist_ok=True)
        self._update_local_json()

        if full:
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

        if self.actions:
            # enabled_list is really disabled_list
            uuid_name = f'{uuid}.nemo_action'
            if uuid_name not in enabled_list:
                enabled_count = 1
            return enabled_count

        for item in enabled_list:
            item = item.replace("!", "")
            if uuid in item.split(":"):
                enabled_count += 1

        return enabled_count

    def _update_local_json(self):
        debug(f"harvester: Downloading new list of available {self.spice_type}s")
        url = SPICE_MAP[self.spice_type]["url"]

        try:
            r = requests.get(url,
                             timeout=TIMEOUT_DOWNLOAD_JSON,
                             proxies=self.proxy_info,
                             params={"time": get_current_timestamp()})
            debug(f"Downloading from {r.request.url}")
            r.raise_for_status()
        except Exception as e:
            debug(f"Could not refresh json data for {self.spice_type}: {e}")
            return

        with open(self.index_file, "w", encoding="utf-8") as f:
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
                    debug(f"Submitting thumb_job for {uuid}")
                    tpe.submit(thumb_job, copy.copy(uuid), copy.deepcopy(item))

    def _download_thumb(self, uuid, item):
        paths = SpicePathSet(item, spice_type=self.spice_type)
        if not os.path.isfile(paths.thumb_local_path) or self._is_bad_image(paths.thumb_local_path) or self._spice_has_update(uuid):
            debug(f"Downloading thumbnail for {uuid}: {paths.thumb_download_url}")

            try:
                r = requests.get(paths.thumb_download_url,
                                 timeout=TIMEOUT_DOWNLOAD_THUMB,
                                 proxies=self.proxy_info,
                                 params={"time": get_current_timestamp()})
                r.raise_for_status()
            except Exception as e:
                debug(f"Could not get thumbnail for {uuid}: {e}")
                return

            with open(paths.thumb_local_path, "wb", encoding="utf-8") as f:
                f.write(r.content)

    def _load_metadata(self):
        if self.disabled:
            return

        debug(f"harvester: Loading metadata on installed {self.spice_type}s")
        self.meta_map = {}

        for directory in self.spices_directories:
            try:
                extensions = os.listdir(directory)

                for uuid in extensions:
                    subdirectory = os.path.join(directory, uuid)
                    if uuid.endswith('.nemo_action'):
                        continue
                    # For actions, ignore any other normal files, an action may place other support scripts in here.
                    if self.actions and not os.path.isdir(subdirectory):
                        continue
                    try:
                        with open(os.path.join(subdirectory, "metadata.json"), "r", encoding="utf-8") as f:
                            metadata = json.load(f)

                            metadata['path'] = subdirectory
                            metadata['writable'] = os.access(subdirectory, os.W_OK)
                            self.meta_map[uuid] = metadata
                    except Exception as detail:
                        debug(detail)
                        debug(f"Skipping {uuid}: there was a problem trying to read metadata.json")
            except FileNotFoundError:
                # debug("%s does not exist! Creating it now." % directory)
                try:
                    os.makedirs(directory, mode=0o755, exist_ok=True)
                except Exception:
                    pass

    def _load_cache(self):
        if self.disabled:
            return

        debug(f"harvester: Loading local {self.spice_type} cache")
        self.index_cache = {}

        try:
            with open(self.index_file, "r", encoding="utf-8") as f:
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
        if self.disabled:
            return []

        debug(f"harvester: Generating list of updated {self.spice_type}s")

        self.updates = []

        for uuid in self.index_cache:
            try:
                if uuid in self.meta_map and self._spice_has_update(uuid):
                    update = SpiceUpdate(self.spice_type, uuid, self.index_cache[uuid], self.meta_map[uuid])
                    self.updates.append(update)
            except Exception as e:
                debug(f"Error checking updates for {uuid}: {e}")
                raise

        return self.updates

    def _spice_has_update(self, uuid):
        try:
            return int(self.meta_map[uuid]["last-edited"]) < self.index_cache[uuid]["last_edited"]
        except Exception:
            return False

    def _install_by_uuid(self, uuid):
        action = "upgrade" if uuid in self.meta_map else "install"

        error_message = None
        uuid = uuid
        try:
            item = self.index_cache[uuid]
        except KeyError:
            debug(f"Can't install {uuid} - it doesn't seem to exist on the server")
            raise

        paths = SpicePathSet(item, spice_type=self.spice_type)

        try:
            r = requests.get(paths.zip_download_url,
                             timeout=TIMEOUT_DOWNLOAD_ZIP,
                             proxies=self.proxy_info,
                             params={"time": get_current_timestamp()})
            r.raise_for_status()
        except Exception as e:
            debug(f"Could not download zip for {uuid}: {e}")
            raise

        try:
            tmp_name = None
            with tempfile.NamedTemporaryFile(delete=False) as f:
                tmp_name = f.name
                f.write(r.content)

            with zipfile.ZipFile(tmp_name) as _zip:
                os.remove(tmp_name)

                with tempfile.TemporaryDirectory() as d:
                    _zip.extractall(d)
                    self._install_from_folder(os.path.join(d, uuid), d, uuid, from_spices=True)
                    self.write_to_log(uuid, action)

                self._load_metadata()
        except Exception as e:
            debug(f"couldn't install: {e}")
            raise

    def _install_from_folder(self, folder, base_folder, uuid, from_spices=False):
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
                        subprocess.run(['/usr/bin/msgfmt', '-c',
                                       os.path.join(po_dir, file), '-o',
                                       os.path.join(locale_dir, f'{uuid}.mo')],
                                       check=True)

        dest = os.path.join(self.install_folder, uuid)
        if os.path.exists(dest):
            shutil.rmtree(dest)
        if self.actions and os.path.exists(dest + '.nemo_action'):
            os.remove(dest + '.nemo_action')
        if not self.actions:
            shutil.copytree(folder, dest)
        else:
            shutil.copytree(base_folder, self.install_folder, dirs_exist_ok=True)

        if not self.themes:
            # ensure proper file permissions
            for root, _, files in os.walk(dest):
                for file in files:
                    os.chmod(os.path.join(root, file), 0o755)

        meta_path = os.path.join(dest, 'metadata.json')

        if self.themes and not os.path.exists(meta_path):
            md = {}
        else:
            with open(meta_path, "r", encoding='utf-8') as f:
                md = json.load(f)

        if from_spices and uuid in self.index_cache:
            md['last-edited'] = self.index_cache[uuid]['last_edited']
        else:
            md['last-edited'] = int(datetime.datetime.utcnow().timestamp())

        with open(meta_path, "w+", encoding='utf-8') as f:
            json.dump(md, f, indent=4)

    def write_to_log(self, uuid, action):
        new_version = "<none>"
        old_version = "<none>"

        try:
            remote_item = self.index_cache[uuid]
            new_version = datetime.datetime.fromtimestamp(remote_item["last_edited"]).strftime("%Y.%m.%d")
        except KeyError:
            if action in ("upgrade", "install"):
                debug(f"Upgrading {uuid} with no local metadata - something's wrong")

        try:
            local_item = self.meta_map[uuid]
            old_version = datetime.datetime.fromtimestamp(local_item["last-edited"]).strftime("%Y.%m.%d")
        except KeyError:
            if action in ("upgrade", "remove"):
                debug(f"Upgrading or removing {uuid} with no local metadata - something's wrong")

        log_timestamp = datetime.datetime.now().strftime("%F %T")
        activity_logger.log(f"{log_timestamp} {self.spice_type} {action} {uuid} {old_version} {new_version}")

    def get_icon_surface(self, uuid, ui_scale):
        """ gets the icon for a given uuid"""
        try:
            pixbuf = None

            paths = SpicePathSet(self.index_cache[uuid], spice_type=self.spice_type)

            if self.themes:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(paths.thumb_local_path, 100 * ui_scale, -1, True)
            else:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(paths.thumb_local_path, 24 * ui_scale, 24 * ui_scale, True)

            if pixbuf is None:
                raise Exception

            surf = Gdk.cairo_surface_create_from_pixbuf(pixbuf, ui_scale, None)
            return Gtk.Image.new_from_surface(surf)
        except Exception:
            debug("There was an error processing one of the images. Try refreshing the cache.")
            return Gtk.Image.new_from_icon_name('image-missing', Gtk.IconSize.LARGE_TOOLBAR)

    def _is_bad_image(self, path):
        try:
            Image.open(path)
        except IOError:
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
                debug(f"removing old thumb: {f}")
                os.remove(os.path.join(self.cache_folder, f))
            except:
                pass
