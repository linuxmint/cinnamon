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
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import requests

import gi
gi.require_version('Gio', '2.0')
from gi.repository import Gio, GLib

from . import logger

DEBUG = os.getenv("DEBUG") is not None

def debug(msg):
    if DEBUG:
        print(msg, file=sys.stderr)

def warn(msg):
    print(msg, file=sys.stderr)


class AbortedError(Exception):
    """Raised by a progress_callback to interrupt an in-flight harvester download."""

LANGUAGE_CODE = "C"
try:
    LANGUAGE_CODE = locale.getlocale()[0].split("_")[0]
except:
    pass

home = os.path.expanduser("~")
user_data_dir = GLib.get_user_data_dir()
locale_inst = os.path.join(user_data_dir, 'locale')
settings_dir = os.path.join(GLib.get_user_config_dir(), 'cinnamon', 'spices')
old_settings_dir = f'{home}/.cinnamon/configs/'

URL_SPICES_HOME = "https://cinnamon-spices.linuxmint.com"

SPICE_MAP = {
    "applet": {
        "url": URL_SPICES_HOME + "/json/applets.json",
        "enabled-schema": "org.cinnamon",
        "enabled-key": "enabled-applets",
        "install-folders": (os.path.join(user_data_dir, "cinnamon/applets/"),)
    },
    "desklet": {
        "url": URL_SPICES_HOME + "/json/desklets.json",
        "enabled-schema": "org.cinnamon",
        "enabled-key": "enabled-desklets",
        "install-folders": (os.path.join(user_data_dir, "cinnamon/desklets/"),)
    },
    "extension": {
        "url": URL_SPICES_HOME + "/json/extensions.json",
        "enabled-schema": "org.cinnamon",
        "enabled-key": "enabled-extensions",
        "install-folders": (os.path.join(user_data_dir, "cinnamon/extensions/"),)
    },
    "search_provider": {
        "url": "",
        "enabled-schema": "org.cinnamon",
        "enabled-key": "enabled-search-providers",
        "install-folders": (os.path.join(user_data_dir, "cinnamon/search_providers/"),)
    },
    "action": {
        "url": URL_SPICES_HOME + "/json/actions.json",
        "enabled-schema": "org.nemo.plugins",
        "enabled-key": "disabled-actions",
        "install-folders": (os.path.join(user_data_dir, "nemo/actions/"),)
    },
    "theme": {
        "url": URL_SPICES_HOME + "/json/themes.json",
        "enabled-schema": "org.cinnamon.theme",
        "enabled-key": "name",
        "install-folders": (
            os.path.join(home, ".themes/"),
            os.path.join(user_data_dir, "themes/"),
            os.path.join(user_data_dir, "cinnamon/themes/"),
        )
    }
}

TIMEOUT_DOWNLOAD_JSON = 15
TIMEOUT_DOWNLOAD_THUMB = 60
TIMEOUT_DOWNLOAD_ZIP = 120


def remove_empty_folders(path):
    if not os.path.isdir(path):
        return

    for entry in os.listdir(path):
        full = os.path.join(path, entry)
        if os.path.isdir(full):
            remove_empty_folders(full)

    if not os.listdir(path):
        debug(f"Removing empty folder: {path}")
        try:
            os.rmdir(path)
        except OSError:
            pass

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
        self._previous_index = {}

        self.cache_folder = os.path.join(GLib.get_user_cache_dir(), 'cinnamon', 'spices', self.spice_type)

        self.index_file = os.path.join(self.cache_folder, "index.json")

        # User-writable install destinations from SPICE_MAP. Index 0 is the
        # canonical location for new installs; later entries are alternative
        # paths a spice may already live in (e.g. legacy theme dirs).
        self.install_folders = SPICE_MAP[self.spice_type]["install-folders"]
        self.install_folder = self.install_folders[0]

        # Full scan list = install_folders + read-only system locations. The
        # system entries surface system-installed spices in meta_map for the
        # cs_settings UI listing but are never written to.
        if self.actions:
            sys_dirs = tuple(os.path.join(d, 'nemo/actions/') for d in GLib.get_system_data_dirs())
        elif self.themes:
            sys_dirs = ()
        else:
            sys_dirs = (f'/usr/share/cinnamon/{self.spice_type}s/',)
        self.spices_directories = self.install_folders + sys_dirs

        self.settings = Gio.Settings.new(SPICE_MAP[self.spice_type]["enabled-schema"])
        self.enabled_key = SPICE_MAP[self.spice_type]["enabled-key"]

        try:
            self._load_cache()
        except ValueError:
            # Corrupt on-disk cache: file has been removed by _load_cache.
            # A subsequent refresh() will repopulate and surface any error.
            pass
        self._load_metadata()

    def anything_installed(self):
        for location in self.install_folders:
            path = Path(location)
            if not path.exists():
                continue

            for _ in path.iterdir():
                return True

        debug(f"No additional {self.spice_type}s installed")
        return False

    def refresh(self, full, force=False, progress_callback=None):
        if not force and not self.anything_installed():
            return

        debug(f"Cache stamp: {get_current_timestamp()}")

        os.makedirs(self.cache_folder, mode=0o755, exist_ok=True)
        self._update_local_json()

        if full:
            self._update_local_thumbs(progress_callback=progress_callback)

        self._load_metadata()
        self._clean_old_thumbs()

    def reload(self):
        self._load_metadata()
        return self._generate_update_list()

    def get_updates(self):
        return self._generate_update_list()

    def has_update(self, uuid):
        return self._spice_has_update(uuid)

    def install(self, uuid, progress_callback=None):
        self._install_by_uuid(uuid, progress_callback=progress_callback)

    def install_from_folder(self, folder, uuid, from_spices=False):
        """Install a spice from a local folder. Used by developer tools that
        bypass the spices server (e.g. cinnamon-install-spice)."""
        self._install_from_folder(folder, os.path.dirname(folder), uuid, from_spices=from_spices)
        self._load_metadata()

    def uninstall(self, uuid):
        self._uninstall_by_uuid(uuid)

    def get_enabled(self, uuid):
        if self.themes:
            return 1 if self.settings.get_string(self.enabled_key) == uuid else 0

        if self.actions:
            disabled_list = self.settings.get_strv(self.enabled_key)
            return 0 if f"{uuid}.nemo_action" in disabled_list else 1

        enabled_count = 0
        for item in self.settings.get_strv(self.enabled_key):
            item = item.replace("!", "")
            if uuid in item.split(":"):
                enabled_count += 1
        return enabled_count

    def enable(self, uuid, panel=1, box='right', position=0, desklet_x=100, desklet_y=100):
        if self.spice_type == 'applet':
            applet_id = self.settings.get_int('next-applet-id')
            self.settings.set_int('next-applet-id', applet_id + 1)

            entries = []
            for entry in self.settings.get_strv(self.enabled_key):
                info = entry.split(':')
                pos = int(info[2])
                if info[0] == f'panel{panel}' and info[1] == box and position <= pos:
                    info[2] = str(pos + 1)
                    entries.append(':'.join(info))
                else:
                    entries.append(entry)
            entries.append(f'panel{panel}:{box}:{position}:{uuid}:{applet_id}')
            self.settings.set_strv(self.enabled_key, entries)
        elif self.spice_type == 'desklet':
            desklet_id = self.settings.get_int('next-desklet-id')
            self.settings.set_int('next-desklet-id', desklet_id + 1)
            enabled = self.settings.get_strv(self.enabled_key)
            enabled.append(f'{uuid}:{desklet_id}:{desklet_x}:{desklet_y}')
            self.settings.set_strv(self.enabled_key, enabled)
        elif self.actions:
            disabled = self.settings.get_strv(self.enabled_key)
            uuid_name = f"{uuid}.nemo_action"
            if uuid_name in disabled:
                disabled.remove(uuid_name)
                self.settings.set_strv(self.enabled_key, disabled)
        elif not self.themes:
            enabled = self.settings.get_strv(self.enabled_key)
            enabled.append(uuid)
            self.settings.set_strv(self.enabled_key, enabled)

    def disable(self, uuid):
        if self.themes:
            return

        if self.actions:
            disabled = self.settings.get_strv(self.enabled_key)
            uuid_name = f"{uuid}.nemo_action"
            if uuid_name not in disabled:
                disabled.append(uuid_name)
                self.settings.set_strv(self.enabled_key, disabled)
            return

        new_list = []
        for entry in self.settings.get_strv(self.enabled_key):
            if self.spice_type == 'applet':
                entry_uuid = entry.split(':')[3].lstrip('!')
            elif self.spice_type == 'desklet':
                entry_uuid = entry.split(':')[0].lstrip('!')
            else:
                entry_uuid = entry.lstrip('!')
            if entry_uuid != uuid:
                new_list.append(entry)
        self.settings.set_strv(self.enabled_key, new_list)

    def _update_local_json(self):
        debug(f"harvester: Downloading new list of available {self.spice_type}s")
        url = SPICE_MAP[self.spice_type]["url"]

        try:
            r = requests.get(url,
                             timeout=TIMEOUT_DOWNLOAD_JSON,
                             params={"time": get_current_timestamp()})
            debug(f"Downloading from {r.request.url}")
            r.raise_for_status()
        except Exception as e:
            warn(f"Could not refresh json data for {self.spice_type}: {e}")
            raise

        # Validate before overwriting the on-disk cache so a malformed
        # response doesn't clobber the previously-good index.
        try:
            new_cache = json.loads(r.text)
        except ValueError as e:
            warn(f"Server returned malformed JSON for {self.spice_type}: {e}")
            raise

        with open(self.index_file, "w", encoding="utf-8") as f:
            f.write(r.text)

        # Snapshot the prior index so _download_thumb can tell whether the
        # server-side last_edited moved for each uuid.
        self._previous_index = self.index_cache
        self.index_cache = new_cache
        self.has_cache = True

    def _update_local_thumbs(self, progress_callback=None):
        # This uses threads for the downloads, but this function blocks until
        # all are downloaded. Per-thumb progress is reported on the calling
        # thread as each future completes.
        items = list(self.index_cache.items())

        total = len(items)
        if total == 0:
            return

        tpe = ThreadPoolExecutor(max_workers=10)
        try:
            futures = []
            for uuid, item in items:
                debug(f"Submitting thumb_job for {uuid}")
                futures.append(tpe.submit(self._download_thumb, copy.copy(uuid), copy.deepcopy(item)))

            for done, future in enumerate(futures, start=1):
                future.result()
                if progress_callback is not None:
                    progress_callback(done, 1, total)
        finally:
            # If progress_callback raised AbortedError, drop still-queued thumbs.
            # In-flight ones (up to max_workers) finish on their own.
            tpe.shutdown(wait=False, cancel_futures=True)

    def _download_thumb(self, uuid, item):
        paths = SpicePathSet(item, spice_type=self.spice_type)
        prev = self._previous_index.get(uuid)
        server_changed = prev is None or prev.get("last_edited") != item.get("last_edited")
        needs_download = (not os.path.isfile(paths.thumb_local_path)
                          or self._is_bad_image(paths.thumb_local_path)
                          or server_changed)
        if not needs_download:
            return

        debug(f"Downloading thumbnail for {uuid}: {paths.thumb_download_url}")

        try:
            r = requests.get(paths.thumb_download_url,
                             timeout=TIMEOUT_DOWNLOAD_THUMB,
                             params={"time": get_current_timestamp()})
            r.raise_for_status()
        except (requests.RequestException, OSError) as e:
            warn(f"Could not get thumbnail for {uuid}: {e}")
            return

        with open(paths.thumb_local_path, "wb") as f:
            f.write(r.content)

    def _load_metadata(self):
        debug(f"harvester: Loading metadata on installed {self.spice_type}s")

        new_map = {}

        for directory in self.spices_directories:
            if not os.path.isdir(directory):
                continue

            for entry in os.listdir(directory):
                full_path = os.path.join(directory, entry)

                if self.actions:
                    if entry == 'sample.nemo_action':
                        continue
                    if entry.endswith('.nemo_action'):
                        sibling_dir = full_path[:-len('.nemo_action')]
                        if os.path.isdir(sibling_dir):
                            # Spice-installed action: handled via the sibling dir below.
                            continue
                        uuid = entry[:-len('.nemo_action')]
                        if uuid in new_map:
                            continue
                        self._load_keyfile_action(full_path, entry, new_map)
                        continue
                    if not os.path.isdir(full_path):
                        # Other top-level files (helper scripts, etc.)
                        continue

                if not os.path.isdir(full_path):
                    continue

                # First-wins: spices_directories iterates user install_folders
                # before system paths, so the user-installed copy of a uuid
                # masks any system copy and a just-installed upgrade isn't
                # shadowed by an orphan in another user-level path.
                if entry in new_map:
                    continue

                try:
                    with open(os.path.join(full_path, "metadata.json"), "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                        metadata['path'] = full_path
                        metadata['writable'] = os.access(full_path, os.W_OK)
                        new_map[entry] = metadata
                except FileNotFoundError:
                    if not self.themes:
                        warn(f"Skipping {entry}: no metadata.json")
                except Exception as detail:
                    warn(detail)
                    warn(f"Skipping {entry}: there was a problem trying to read metadata.json")

        self.meta_map = new_map

    def _load_keyfile_action(self, full_path, entry, target_map):
        metadata = {}
        keyfile = GLib.KeyFile.new()

        try:
            keyfile.load_from_file(full_path, GLib.KeyFileFlags.KEEP_TRANSLATIONS)
        except GLib.Error as e:
            warn(f"Could not read action file '{full_path}': {e.message}")
            return

        try:
            # Skip actions explicitly marked Active=false. A missing key is
            # treated as active; any other read failure is treated as opt-out.
            if not keyfile.get_boolean('Nemo Action', 'Active'):
                return
        except GLib.Error as e:
            if e.code != GLib.KeyFileError.KEY_NOT_FOUND:
                warn(f"Could not read Active field for action '{full_path}': {e.message}")
                return

        try:
            name = keyfile.get_locale_string('Nemo Action', 'Name')
            metadata['name'] = name.replace("_", "")
        except GLib.Error as e:
            warn(f"Could not read Name field for action. Skipping '{full_path}': {e.message}")
            return

        try:
            metadata['description'] = keyfile.get_locale_string('Nemo Action', 'Comment')
        except GLib.Error as e:
            if e.code != GLib.KeyFileError.KEY_NOT_FOUND:
                warn(f"Could not read Comment field for action '{full_path}': {e.message}")
            else:
                metadata['description'] = ""

        try:
            metadata['icon'] = keyfile.get_string('Nemo Action', 'Icon-Name')
        except GLib.Error as e:
            if e.code != GLib.KeyFileError.KEY_NOT_FOUND:
                warn(f"Could not read Icon-Name field for action '{full_path}': {e.message}")

        uuid = entry[:-len('.nemo_action')]
        # ManageSpicesRow expects a directory it can scan for version subdirs.
        metadata['path'] = os.path.dirname(full_path)
        metadata['writable'] = False
        metadata['disable_about'] = True
        metadata['uuid'] = uuid
        target_map[uuid] = metadata

    def _load_cache(self):
        debug(f"harvester: Loading local {self.spice_type} cache")

        try:
            with open(self.index_file, "r", encoding="utf-8") as f:
                self.index_cache = json.load(f)
                self.has_cache = True
        except FileNotFoundError:
            self.index_cache = {}
            self.has_cache = False
            return
        except ValueError as e:
            try:
                os.remove(self.index_file)
            except:
                pass
            self.index_cache = {}
            self.has_cache = False
            raise

    def _generate_update_list(self):
        debug(f"harvester: Generating list of updated {self.spice_type}s")

        self.updates = []

        for uuid in self.index_cache:
            try:
                if uuid in self.meta_map and self._spice_has_update(uuid):
                    update = SpiceUpdate(self.spice_type, uuid, self.index_cache[uuid], self.meta_map[uuid])
                    self.updates.append(update)
            except Exception as e:
                warn(f"Error checking updates for {uuid}: {e}")

        return self.updates

    def _spice_has_update(self, uuid):
        # System-installed xlets ship without a `last-edited` field, so the
        # int() lookup below raises and we naturally answer False. Spice-installed
        # copies (in any user dir) get the timestamp written during install.
        try:
            return int(self.meta_map[uuid]["last-edited"]) < self.index_cache[uuid]["last_edited"]
        except Exception:
            return False

    def _install_by_uuid(self, uuid, progress_callback=None):
        action = "upgrade" if uuid in self.meta_map else "install"

        try:
            item = self.index_cache[uuid]
        except KeyError:
            warn(f"Can't install {uuid} - it doesn't seem to exist on the server")
            raise

        paths = SpicePathSet(item, spice_type=self.spice_type)

        tmp_name = None
        try:
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp_name = tmp.name
                self._download_zip(paths.zip_download_url, tmp, progress_callback)

            with zipfile.ZipFile(tmp_name) as _zip:
                with tempfile.TemporaryDirectory() as d:
                    for member in _zip.infolist():
                        _zip.extract(member, d)
                        os.chmod(os.path.join(d, member.filename), member.external_attr >> 16)
                    self._install_from_folder(os.path.join(d, uuid), d, uuid, from_spices=True)
                    self.write_to_log(uuid, action)

            if self.actions and action == "install":
                # Newly installed actions start in the disabled list so the user
                # has to opt in to running them.
                disabled = self.settings.get_strv(self.enabled_key)
                uuid_name = f"{uuid}.nemo_action"
                if uuid_name not in disabled:
                    disabled.append(uuid_name)
                    self.settings.set_strv(self.enabled_key, disabled)
        except AbortedError:
            raise
        except Exception as e:
            warn(f"couldn't install: {e}")
            raise
        finally:
            if tmp_name is not None:
                try:
                    os.remove(tmp_name)
                except FileNotFoundError:
                    pass
            self._load_metadata()

    def _download_zip(self, url, out_file, progress_callback):
        block_size = 16 * 1024

        try:
            r = requests.get(url,
                             timeout=TIMEOUT_DOWNLOAD_ZIP,
                             params={"time": get_current_timestamp()},
                             stream=True)
            r.raise_for_status()
        except Exception as e:
            warn(f"Could not start zip download: {e}")
            raise

        try:
            try:
                total_size = int(r.headers.get("content-length", 0))
            except (TypeError, ValueError):
                total_size = 0

            count = 0
            for chunk in r.iter_content(chunk_size=block_size):
                if not chunk:
                    continue
                out_file.write(chunk)
                count += 1
                if progress_callback is not None:
                    progress_callback(count, block_size, total_size)
        finally:
            r.close()

    def _uninstall_by_uuid(self, uuid):
        try:
            if not self.themes:
                if os.path.exists(locale_inst):
                    for i19_folder in os.listdir(locale_inst):
                        mo_path = os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', f'{uuid}.mo')
                        if os.path.isfile(mo_path):
                            os.remove(mo_path)
                        remove_empty_folders(os.path.join(locale_inst, i19_folder))

                for cfg in (settings_dir, old_settings_dir):
                    cfg_path = os.path.join(cfg, uuid)
                    if os.path.exists(cfg_path):
                        shutil.rmtree(cfg_path)

            self._remove_spice_from_all_directories(uuid)

            if self.actions:
                disabled_list = self.settings.get_strv(self.enabled_key)
                uuid_name = f"{uuid}.nemo_action"
                if uuid_name in disabled_list:
                    disabled_list.remove(uuid_name)
                    self.settings.set_strv(self.enabled_key, disabled_list)

            self.write_to_log(uuid, "remove")
        except Exception as e:
            warn(f"couldn't uninstall {uuid}: {e}")
            raise
        finally:
            self._load_metadata()

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

        os.makedirs(self.install_folder, mode=0o755, exist_ok=True)

        # Clear prior copies from every user-writable location, not just
        # install_folder, so an upgrade across a path change doesn't leave
        # an orphan that the first-wins scan would surface as the active copy.
        self._remove_spice_from_all_directories(uuid)

        dest = os.path.join(self.install_folder, uuid)
        if not self.actions:
            shutil.copytree(folder, dest)
        else:
            shutil.copytree(base_folder, self.install_folder, dirs_exist_ok=True)

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

    def _remove_spice_from_all_directories(self, uuid):
        # Iterates user-writable install_folders only — system spices are
        # package-managed and not ours to delete from /usr/share/.
        for directory in self.install_folders:
            dest = os.path.join(directory, uuid)
            if os.path.isdir(dest):
                shutil.rmtree(dest, ignore_errors=True)
            if self.actions:
                action_file = os.path.join(directory, f"{uuid}.nemo_action")
                try:
                    os.remove(action_file)
                except FileNotFoundError:
                    pass

    def write_to_log(self, uuid, action):
        new_version = "<none>"
        old_version = "<none>"

        try:
            remote_item = self.index_cache[uuid]
            new_version = datetime.datetime.fromtimestamp(remote_item["last_edited"]).strftime("%Y.%m.%d")
        except KeyError:
            if action in ("upgrade", "install"):
                warn(f"Upgrading {uuid} with no local metadata - something's wrong")

        try:
            local_item = self.meta_map[uuid]
            old_version = datetime.datetime.fromtimestamp(local_item["last-edited"]).strftime("%Y.%m.%d")
        except KeyError:
            if action in ("upgrade", "remove"):
                warn(f"Upgrading or removing {uuid} with no local metadata - something's wrong")

        log_timestamp = datetime.datetime.now().strftime("%F %T")
        activity_logger.log(f"{log_timestamp} {self.spice_type} {action} {uuid} {old_version} {new_version}")

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
