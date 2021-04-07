#!/usr/bin/python3

import requests
import os
import time
import subprocess
import json
import locale
import tempfile
import zipfile
import shutil
import datetime

from . import logger

LANGUAGE_CODE = "C"
try:
    LANGUAGE_CODE = locale.getlocale()[0].split("_")[0]
except:
    pass

URL_GITHUB_SPICES = "https://cinnamon-spices.linuxmint.com"

URL_SPICES_HOME = "https://cinnamon-spices.linuxmint.com"
URL_MAP = {
    'applet': URL_SPICES_HOME + "/json/applets.json",
    'theme': URL_SPICES_HOME + "/json/themes.json",
    'desklet': URL_SPICES_HOME + "/json/desklets.json",
    'extension': URL_SPICES_HOME + "/json/extensions.json"
}

home = os.path.expanduser("~")
locale_inst = '%s/.local/share/locale' % home
settings_dir = '%s/.cinnamon/configs/' % home

activity_logger = logger.ActivityLogger()

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

class Harvester():
    def __init__(self, spice_type):
        self.spice_type = spice_type

        self.themes = self.spice_type == "theme"

        self.has_cache = False
        self.updates = []
        self.meta_map = {}

        self.cache_folder = '%s/.cinnamon/spices.cache/%ss/' % (home, self.spice_type)
        self.index_file = os.path.join(self.cache_folder, "index.json")

        os.makedirs(self.cache_folder, mode=0o755, exist_ok=True)

        if self.themes:
            self.install_folder = os.path.join(home, ".themes")
            self.spices_directories = (self.install_folder, )
        else:
            self.install_folder = os.path.join(home, ".local/share/cinnamon", "%ss" % self.spice_type)
            self.spices_directories = ("/usr/share/cinnamon/%ss" % self.spice_type,
                                       self.install_folder)

    def refresh(self):
        self._update_local_json()
        self._update_local_thumbs()
        self._load_cache()
        self._load_metadata()

    def get_updates(self):
        return self._generate_update_list()

    def install(self, uuid):
        self._install_by_uuid(uuid)

    def _update_local_json(self):
        url = URL_MAP[self.spice_type]

        t = round(time.time())
        print("Downloading from %s" % url)
        # TODO: proxies
        r = requests.get(url, params={ "time" : round(time.time()) })

        if r.status_code != requests.codes.ok:
            print("Can't download spices json")

        with open(self.index_file, "w") as f:
            f.write(r.text)

    def _update_local_thumbs(self):
        pass
        # TODO

    def _load_metadata(self):
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
                        print(detail)
                        print("Skipping %s: there was a problem trying to read metadata.json" % uuid)
            except FileNotFoundError:
                # print("%s does not exist! Creating it now." % directory)
                subprocess.call(["mkdir", "-p", directory])

    def _load_cache(self):
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
            print(e)

    def _generate_update_list(self):
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
            print("Can't install %s - it doesn't seem to exist on the server" % uuid)
            return

        download_url = URL_SPICES_HOME + self.index_cache[uuid]['file']

        r = requests.get(download_url, params={ "time" : round(time.time()) })

        if r.status_code != requests.codes.ok:
            print("couldn't download")
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
            print("couldn't install", e)

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
                print("Upgrading %s with no local metadata - something's wrong" % uuid)

        try:
            local_item = self.meta_map[uuid]
            old_version = datetime.datetime.fromtimestamp(local_item["last-edited"]).strftime("%Y.%m.%d")
        except KeyError:
            if action in ("upgrade", "remove"):
                print("Upgrading or removing %s with no local metadata - something's wrong" % uuid)

        log_timestamp = datetime.datetime.now().strftime("%F %T")
        activity_logger.log("%s %s %s %s %s %s" % (log_timestamp, self.spice_type, action, uuid, old_version, new_version))

