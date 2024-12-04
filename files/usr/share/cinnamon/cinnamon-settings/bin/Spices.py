#!/usr/bin/python3

import os
import sys

try:
    from gi.repository import Gio, Gtk, GObject, Gdk, GdkPixbuf, GLib
    import tempfile
    import zipfile
    import shutil
    import html
    import subprocess
    import threading
    from PIL import Image
    import datetime
    import time
except Exception as error_message:
    print(error_message)
    sys.exit(1)

try:
    import json
except ImportError:
    import simplejson as json

home = os.path.expanduser("~")
locale_inst = f'{home}/.local/share/locale'
settings_dir = os.path.join(GLib.get_user_config_dir(), 'cinnamon', 'spices')
old_settings_dir = f'{home}/.cinnamon/configs/'

URL_SPICES_HOME = "https://cinnamon-spices.linuxmint.com"
URL_MAP = {
    'applet': URL_SPICES_HOME + "/json/applets.json",
    'theme': URL_SPICES_HOME + "/json/themes.json",
    'desklet': URL_SPICES_HOME + "/json/desklets.json",
    'extension': URL_SPICES_HOME + "/json/extensions.json",
    'action': URL_SPICES_HOME + "/json/actions.json",
}

ABORT_NONE = 0
ABORT_ERROR = 1
ABORT_USER = 2


def ui_thread_do(callback, *args):
    GLib.idle_add(callback, *args, priority=GLib.PRIORITY_DEFAULT)


def removeEmptyFolders(path):
    if not os.path.isdir(path):
        return

    # remove empty subfolders
    files = os.listdir(path)
    if len(files):
        for f in files:
            fullpath = os.path.join(path, f)
            if os.path.isdir(fullpath):
                removeEmptyFolders(fullpath)

    # if folder empty, delete it
    files = os.listdir(path)
    if len(files) == 0:
        print("Removing empty folder:", path)
        os.rmdir(path)


class ThreadedTaskManager(GObject.GObject):
    def __init__(self, max_threads):
        super().__init__()
        self.max_threads = max_threads
        self.abort_status = False
        self.jobs = []
        self.threads = []
        self.lock = threading.Lock()
        self.start_id = 0

    def get_n_jobs(self):
        return len(self.jobs) + len(self.threads)

    def busy(self):
        return len(self.jobs) > 0 or len(self.threads) > 0

    def push(self, func, callback, data):
        with self.lock:
            self.jobs.insert(0, (func, callback, data))

        if self.start_id == 0:
            self.start_id = GLib.idle_add(self.check_start_job)

    def check_start_job(self):
        self.start_id = 0
        if len(self.jobs) > 0:
            if len(self.threads) == self.max_threads:
                return

            with self.lock:
                job = self.jobs.pop()
                newthread = threading.Thread(target=self.thread_function_wrapper, args=job)
                self.threads.append(newthread)

            newthread.start()

            self.check_start_job()

    def thread_function_wrapper(self, func, callback, data):
        result = func(*data)

        with self.lock:
            try:
                self.threads.remove(threading.current_thread())
            except:
                pass

            if self.abort_status and not self.busy():
                self.abort_status = False

        self.check_start_job()

        if callback is not None:
            ui_thread_do(callback, result)

    def abort(self):
        if self.busy():
            with self.lock:
                self.abort_status = True
                del self.jobs[:]


class Spice_Harvester(GObject.Object):
    __gsignals__ = {
        'installed-changed': (GObject.SignalFlags.RUN_FIRST, None, ()),
        'status-changed': (GObject.SignalFlags.RUN_FIRST, None, ()),
        'cache-loaded': (GObject.SignalFlags.RUN_FIRST, None, ())
    }

    def __init__(self, collection_type, window=None):
        super().__init__()
        self.collection_type = collection_type
        self.window = window

        self.themes = collection_type == 'theme'
        self.actions = collection_type == 'action'
        self.index_cache = {}
        self.meta_map = {}
        self.download_manager = ThreadedTaskManager(10)
        self._proxy = None
        self._proxy_deferred_actions = []
        self._proxy_signals = []
        self.running_uuids = []
        self.jobs = []
        self.progressbars = []
        self.updates_available = []
        self.processing_jobs = False
        self.is_downloading_image_cache = False
        self.current_job = None
        self.total_jobs = 0
        self.download_total_files = 0
        self.download_current_file = 0
        self.cache_folder = os.path.join(GLib.get_user_cache_dir(), 'cinnamon', 'spices', self.collection_type)

        if self.themes:
            self.settings = Gio.Settings.new('org.cinnamon.theme')
            self.enabled_key = 'name'
        elif self.actions:
            self.settings = Gio.Settings.new('org.nemo.plugins')
            self.enabled_key = 'disabled-actions'
        else:
            self.settings = Gio.Settings.new('org.cinnamon')
            self.enabled_key = f'enabled-{self.collection_type}s'

        if not self.themes:
            self.settings.connect(f'changed::{self.enabled_key}', self._update_status)

        if self.themes:
            self.install_folder = f'{home}/.themes/'
            old_install_folder = os.path.join(GLib.get_user_data_dir(), 'themes')
            self.spices_directories = (self.install_folder, old_install_folder)
        elif self.actions:
            actions = 'nemo/actions/'
            self.install_folder = f'{home}/.local/share/{actions}'
            sys_dirs = [x + f'/{actions}' for x in GLib.get_system_data_dirs()]
            sys_dirs.append(self.install_folder)
            self.spices_directories = (sys_dirs)
        else:
            self.install_folder = f'{home}/.local/share/cinnamon/{self.collection_type}s/'
            self.spices_directories = (f'/usr/share/cinnamon/{self.collection_type}s/', self.install_folder)

        self._update_status()

        self._load_metadata()

        self._load_cache()

        self.abort_download = ABORT_NONE
        self._sigLoadFinished = None

        self.monitorId = 0
        self.monitor = None
        try:
            self.monitor = Gio.File.new_for_path(self.install_folder).monitor_directory(0, None)
            self.monitorId = self.monitor.connect('changed', self._directory_changed)
        except Exception as e:
            # File monitors can fail when the OS runs out of file handles
            print(e)

        try:
            if not self.actions:
                dbus_path = 'org.Cinnamon'
                gsetting = '/org/Cinnamon'
            else:
                dbus_path = 'org.Nemo'
                gsetting = '/org/Nemo'
            Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                      dbus_path, gsetting, dbus_path, None, self._on_proxy_ready, None)
        except GLib.Error as e:
            print(e)

    def _on_proxy_ready(self, obj, result, data=None):
        try:
            self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
            self._proxy.connect('g-signal', self._on_signal)

            if self._proxy.get_name_owner():
                self.send_deferred_proxy_calls()
            else:
                print("org.Cinnamon proxy created, but no owner - is Cinnamon running?")
        except GLib.Error as e:
            print(f"Could not establish proxy for org.Cinnamon: {e}")

        self.connect_proxy('XletAddedComplete', self._update_status)
        self._update_status()

    def _on_signal(self, proxy, sender_name, signal_name, params):
        if signal_name == "RunStateChanged":
            if self._proxy.GetRunState() == 2:
                self.send_deferred_proxy_calls()
                return

        if signal_name == "XletsLoadedComplete":
            self._update_status()

        for name, callback in self._proxy_signals:
            if signal_name == name:
                callback(*params)

    def send_deferred_proxy_calls(self):
        if self._proxy.get_name_owner() and self._proxy_deferred_actions:
            for command, args in self._proxy_deferred_actions:
                getattr(self._proxy, command)(*args)

            self._proxy_deferred_actions = []

    def connect_proxy(self, name, callback):
        """ connects a callback to a dbus signal"""
        self._proxy_signals.append((name, callback))

    def disconnect_proxy(self, name):
        """ disconnects a previously connected dbus signal"""
        for signal in self._proxy_signals:
            if name in signal:
                self._proxy_signals.remove(signal)
                break

    def send_proxy_signal(self, command, *args):
        """ sends a command over dbus"""
        if self._proxy is None or not self._proxy.get_name_owner():
            self._proxy_deferred_actions.append((command, args))
        else:
            getattr(self._proxy, command)(*args)

    def _update_status(self, *args):
        try:
            if self._proxy and self._proxy.get_name_owner() and not self.actions:
                self.running_uuids = self._proxy.GetRunningXletUUIDs('(s)', self.collection_type)
            else:
                self.running_uuids = []
        except:
            self.running_uuids = []
        self.emit('status-changed')

    def open_spice_page(self, uuid):
        """ opens to the web page of the given uuid"""
        id = self.index_cache[uuid]['spices-id']
        subprocess.run(['/usr/bin/xdg-open',
                       f"{URL_SPICES_HOME}/{self.collection_type}s/view/{id}"],
                       check=True)

    def get_progressbar(self):
        """ returns a Gtk.Widget that can be added to the application. This widget will show the
            progress of any asynchronous actions taking place (ie. refreshing the cache or
            downloading an applet)"""
        progressbar = Gtk.ProgressBar()
        progressbar.set_show_text(True)
        progressbar.set_text('')
        progressbar.set_fraction(0)

        revealer = Gtk.Revealer()
        revealer.add(progressbar)
        revealer.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
        revealer.set_transition_duration(150)
        progressbar.revealer = revealer

        self.progressbars.append(progressbar)

        return revealer

    def _set_progressbar_text(self, text):
        for progressbar in self.progressbars:
            progressbar.set_text(text)

    def _set_progressbar_fraction(self, fraction):
        for progressbar in self.progressbars:
            progressbar.set_fraction(fraction)
        if self.window:
            self.window.set_progress(int(fraction*100))

    def _set_progressbar_visible(self, visible):
        for progressbar in self.progressbars:
            progressbar.revealer.set_reveal_child(visible)

    # updates any progress bars with the download progress
    def _update_progress(self, count, blockSize, totalSize):
        if self.download_manager.busy() and self.download_total_files > 1:
            total = self.download_total_files
            current = total - self.download_manager.get_n_jobs()
            fraction = float(current) / float(total)
            text = _("Downloading images:") + f" {current}/{total}"
            self._set_progressbar_text(text)
        else:
            fraction = count * blockSize / float((totalSize / blockSize + 1) * blockSize)

        self._set_progressbar_fraction(fraction)

        while Gtk.events_pending():
            Gtk.main_iteration()

    # Jobs are added by calling _push_job. _process_job and _advance_queue
    # from a wrapper that runs the job in it's own thread.
    def _push_job(self, job):
        self.total_jobs += 1
        job['job_number'] = self.total_jobs
        self.jobs.append(job)
        if not self.processing_jobs:
            self._advance_queue()

    def _process_job(self, job):
        job['result'] = job['func'](job)
        if job.get('callback'):
            GLib.idle_add(job['callback'], job)
        GLib.idle_add(self._advance_queue)

    def _advance_queue(self):
        if self.monitorId > 0:
            self.monitor.disconnect(self.monitorId)
            self.monitorId = 0

        self.processing_jobs = True
        if self.is_downloading_image_cache:
            return

        self._set_progressbar_fraction(0)

        if len(self.jobs) > 0:
            self._set_progressbar_visible(True)
            job = self.jobs.pop(0)
            self.current_job = job
            text = job['progress_text']
            if self.total_jobs > 1:
                text += f" ({job['job_number']}/{self.total_jobs})"
            self._set_progressbar_text(text)
            job_thread = threading.Thread(target=self._process_job, args=(job,))
            job_thread.start()
        else:
            self.processing_jobs = False
            self.current_job = None
            self.total_jobs = 0
            self._set_progressbar_visible(False)
            self._set_progressbar_text('')
            if self.monitor is not None:
                try:
                    self.monitorId = self.monitor.connect('changed', self._directory_changed)
                except Exception as e:
                    # File monitors can fail when the OS runs out of file handles
                    print(e)
            self._directory_changed()

    def _download(self, out_file, url, binary=True):
        timestamp = round(time.time())
        url = f"{url}?time={timestamp}"
        print(f"Downloading from {url}")
        try:
            open_args = 'wb' if binary else 'w'
            with open(out_file, open_args) as outfd:
                self._url_retrieve(url, outfd, self._update_progress, binary)
        except Exception as e:
            try:
                os.remove(out_file)
            except OSError:
                pass
            if not isinstance(e, KeyboardInterrupt) and not self.download_manager.abort_status:
                self.errorMessage(_("An error occurred while trying to access the server. Please try again in a little while."), e)
            self.abort()
            return None

        return out_file

    def _url_retrieve(self, url, outfd, reporthook, binary):
        # Like the one in urllib. Unlike urllib.retrieve url_retrieve
        # can be interrupted. KeyboardInterrupt exception is raised when
        # interrupted.
        import proxygsettings
        import requests

        count = 0
        blockSize = 1024 * 8
        proxy_info = proxygsettings.get_proxy_settings()

        try:
            response = requests.get(url, proxies=proxy_info, stream=True, timeout=15)
            assert response.ok

            totalSize = int(response.headers.get('content-length'))

            for data in response.iter_content(chunk_size=blockSize):
                count += 1
                if self._is_aborted():
                    break
                if not binary:
                    data = data.decode("utf-8")
                outfd.write(data)
                ui_thread_do(reporthook, count, blockSize, totalSize)
        except Exception as e:
            raise e

    def _load_metadata(self):
        self.meta_map = {}

        for file_path in self.spices_directories:
            if os.path.exists(file_path):
                extensions = os.listdir(file_path)

                for uuid in extensions:
                    if uuid == 'sample.nemo_action':
                        continue
                    full_path = os.path.join(file_path, uuid)
                    uuid_path = full_path.split('.nemo_action')[0]
                    if uuid.endswith('.nemo_action') and not os.path.exists(uuid_path):
                        # A singular .nemo_action file has been detected
                        metadata = dict()
                        keyfile = GLib.KeyFile.new()

                        try:
                            keyfile.load_from_file(full_path, GLib.KeyFileFlags.KEEP_TRANSLATIONS)
                        except GLib.Error as e:
                            print("Could not read action file '%s': %s" % (full_path, e.message))
                            continue

                        try:
                            # The Active key is not typically used, but there are some inactive actions
                            # installed by Nemo, which should not show in the list.
                            if not keyfile.get_boolean('Nemo Action', 'Active'):
                                continue
                        except GLib.Error as e:
                            if e.code == GLib.KeyFileError.NOT_FOUND:
                                pass

                        try:
                            name = keyfile.get_locale_string('Nemo Action', 'Name')
                            metadata['name'] = name.replace("_", "")
                        except GLib.Error as e:
                            print("Could not read Name field for action. Skipping '%s': %s" % (full_path, e.message))
                            continue

                        try:
                            metadata['description'] = keyfile.get_locale_string('Nemo Action', 'Comment')
                        except GLib.Error as e:
                            if e.code == GLib.KeyFileError.NOT_FOUND:
                                pass

                        try:
                            metadata['icon'] = keyfile.get_string('Nemo Action', 'Icon-Name')
                        except GLib.Error as e:
                            if e.code == GLib.KeyFileError.NOT_FOUND:
                                pass

                        metadata['writable'] = False
                        metadata['disable_about'] = True
                        metadata['path'] = self.install_folder
                        _uuid = uuid.split('.nemo_action')[0]
                        metadata['uuid'] = _uuid
                        self.meta_map[_uuid] = metadata
                    elif os.path.isfile(full_path):
                        continue
                    # For actions, ignore any other normal files, an action may place other support scripts in here.
                    if self.actions and not os.path.isdir(full_path):
                        continue
                    else:
                        try:
                            # Process Actions installed via Spices
                            with open(f"{full_path}/metadata.json", encoding='utf-8') as json_data:
                                metadata = json.load(json_data)
                                metadata['path'] = full_path
                                metadata['writable'] = os.access(full_path, os.W_OK)
                                self.meta_map[uuid] = metadata
                        except Exception as error:
                            if not self.themes:
                                print(error)
                                print(f"Skipping {uuid}: there was a problem trying to read metadata.json")
            else:
                print(f"{file_path} does not exist! Skipping")

    def _directory_changed(self, *args):
        self._load_metadata()
        self._generate_update_list()
        self.emit("installed-changed")

    def get_installed(self):
        """ returns a dictionary of the metadata by uuid of all installed spices"""
        return self.meta_map

    def get_is_installed(self, uuid):
        """ returns a boolean specifying whether the given spice is installed or not"""
        return uuid in self.meta_map

    def get_has_update(self, uuid):
        """ returns a boolean indicating whether the given spice has an update available"""
        if uuid not in self.index_cache:
            return False

        try:
            return int(self.meta_map[uuid]["last-edited"]) < self.index_cache[uuid]["last_edited"]
        except Exception:
            return False

    def get_enabled(self, uuid):
        """ returns the number of instances currently enabled"""
        enabled_count = 0
        if not self.themes and not self.actions:
            enabled_list = self.settings.get_strv(self.enabled_key)
            for item in enabled_list:
                item = item.replace("!", "")
                if uuid in item.split(":"):
                    enabled_count += 1
        elif self.actions:
            disabled_list = self.settings.get_strv(self.enabled_key)
            uuid_name = f"{uuid}.nemo_action"
            if uuid_name not in disabled_list:
                enabled_count = 1
        elif self.settings.get_string(self.enabled_key) == uuid:
            enabled_count = 1

        return enabled_count

    def get_is_running(self, uuid):
        """ checks whether the spice is currently running (it may be enabled but not running if
            there was an error in initialization)"""
        return uuid in self.running_uuids

    def are_updates_available(self):
        """ returns True if there are updates available or False otherwise"""
        return len(self.updates_available) > 0

    def get_n_updates(self):
        """ returns the number of available updates"""
        return len(self.updates_available)

    def get_cache(self):
        """ retrieves a copy of the index cache """
        return self.index_cache

    def _load_cache(self):
        filename = os.path.join(self.cache_folder, 'index.json')
        if not os.path.exists(self.cache_folder):
            os.makedirs(self.cache_folder, mode=0o755, exist_ok=True)

        if not os.path.exists(filename):
            self.has_cache = False
            return
        self.has_cache = True

        with open(filename, 'r', encoding='utf-8') as f:
            try:
                self.index_cache = json.load(f)
            except ValueError as detail:
                try:
                    os.remove(filename)
                except:
                    pass
                self.errorMessage(_("Something went wrong with the spices download. Please try refreshing the list again."), str(detail))

        self._generate_update_list()

    def _generate_update_list(self):
        self.updates_available = []
        for uuid in self.index_cache:
            if self.get_is_installed(uuid) and self.get_has_update(uuid):
                self.updates_available.append(uuid)

    def refresh_cache(self):
        """ downloads an updated version of the index and assets"""
        self.old_cache = self.index_cache

        job = {'func': self._download_cache}
        job['progress_text'] = _("Refreshing the cache")
        self._push_job(job)

    def _download_cache(self, load_assets=True):
        download_url = URL_MAP[self.collection_type]

        filename = os.path.join(self.cache_folder, "index.json")
        if self._download(filename, download_url, binary=False) is None:
            return

        self._load_cache()
        self._download_image_cache()

    def _download_image_cache(self):
        self.is_downloading_image_cache = True

        self.used_thumbs = []

        self.download_total_files = 0
        self.download_current_file = 0

        for uuid, _ in self.index_cache.items():
            if self.themes:
                icon_basename = self._sanitize_thumb(os.path.basename(self.index_cache[uuid]['screenshot']))
                download_url = URL_SPICES_HOME + "/uploads/themes/thumbs/" + icon_basename
            else:
                icon_basename = os.path.basename(self.index_cache[uuid]['icon'])
                download_url = URL_SPICES_HOME + self.index_cache[uuid]['icon']
            self.used_thumbs.append(icon_basename)

            icon_path = os.path.join(self.cache_folder, icon_basename)

            # if the image doesn't exist, is corrupt, or may have changed we want to download it
            if not os.path.isfile(icon_path) or self._is_bad_image(icon_path) or self.old_cache[uuid]["last_edited"] != self.index_cache[uuid]["last_edited"]:
                self.download_manager.push(self._download, self._check_download_image_cache_complete, (icon_path, download_url))
                self.download_total_files += 1

        ui_thread_do(self._check_download_image_cache_complete)

    def _check_download_image_cache_complete(self, *args):
        # we're using multiple threads to download image assets, so we only clean up when all the downloads are done
        if self.download_manager.busy():
            return

        # Cleanup obsolete thumbs
        trash = []
        flist = os.listdir(self.cache_folder)
        for f in flist:
            if f not in self.used_thumbs and f != "index.json":
                trash.append(f)
        for t in trash:
            try:
                os.remove(os.path.join(self.cache_folder, t))
            except:
                pass

        self.download_total_files = 0
        self.download_current_file = 0
        self.is_downloading_image_cache = False
        self._advance_queue()
        self.emit('cache-loaded')

    # checks for corrupt images in the cache, so we can redownload them the next time we refresh
    @staticmethod
    def _is_bad_image(path):
        try:
            Image.open(path)
        except IOError:
            return True
        return False

    # make sure the thumbnail fits the correct format (we are expecting it to be <uuid>.png
    @staticmethod
    def _sanitize_thumb(basename):
        return basename.replace("jpg", "png").replace("JPG", "png").replace("PNG", "png")

    def install(self, uuid):
        """ downloads and installs the given extension"""
        _callback = None if self.actions else self._install_finished
        job = {'uuid': uuid, 'func': self._install, 'callback': _callback}
        job['progress_text'] = _("Installing %s") % uuid
        self._push_job(job)

    def _install(self, job):
        uuid = job['uuid']

        download_url = URL_SPICES_HOME + self.index_cache[uuid]['file']
        self.current_uuid = uuid

        _, ziptempfile = tempfile.mkstemp()

        if self._download(ziptempfile, download_url) is None:
            return

        try:
            with zipfile.ZipFile(ziptempfile) as _zip:
                tempfolder = tempfile.mkdtemp()
                for member in _zip.infolist():
                    _zip.extract(member, tempfolder)
                    permissions = member.external_attr >> 16
                    # Preserve file permissions
                    os.chmod(os.path.join(tempfolder, member.filename), permissions)

                uuidfolder = tempfolder if self.actions else os.path.join(tempfolder, uuid)

                self.install_from_folder(uuidfolder, uuid, True)
        except Exception as detail:
            if not self.abort_download:
                self.errorMessage(_("An error occurred during the installation of %s. Please report this incident to its developer.") % uuid, str(detail))
            return

        try:
            shutil.rmtree(tempfolder)
            os.remove(ziptempfile)
        except Exception:
            pass

    def install_from_folder(self, folder, uuid, from_spices=False):
        """ installs a spice from a specified folder"""
        _folder = f"{folder}/{uuid}" if self.actions else folder
        contents = os.listdir(_folder)

        if not self.themes:
            # Install spice localization files, if any
            if 'po' in contents:
                po_dir = os.path.join(_folder, 'po')
                for file in os.listdir(po_dir):
                    if file.endswith('.po'):
                        lang = file.split(".")[0]
                        locale_dir = os.path.join(locale_inst, lang, 'LC_MESSAGES')
                        os.makedirs(locale_dir, mode=0o755, exist_ok=True)
                        subprocess.run(['/usr/bin/msgfmt', '-c',
                                       os.path.join(po_dir, file), '-o',
                                       os.path.join(locale_dir, f'{uuid}.mo')],
                                       check=True)

        # Create install folder on demand
        if not os.path.exists(self.install_folder):
            subprocess.run(["/usr/bin/mkdir", "-p", self.install_folder], check=True)

        dest = os.path.join(self.install_folder, uuid)
        if os.path.exists(dest):
            shutil.rmtree(dest)
        if self.actions and os.path.exists(dest + '.nemo_action'):
            os.remove(dest + '.nemo_action')
        if not self.actions:
            shutil.copytree(folder, dest)
        else:
            shutil.copytree(folder, self.install_folder, dirs_exist_ok=True)

        if self.actions and uuid not in self.updates_available:
            disabled_list = self.settings.get_strv(self.enabled_key)
            uuid_name = f"{uuid}.nemo_action"
            if uuid_name not in disabled_list:
                disabled_list.append(uuid_name)
                self.settings.set_strv(self.enabled_key, disabled_list)

        meta_path = os.path.join(dest, 'metadata.json')
        if self.themes and not os.path.exists(meta_path):
            md = {}
        else:
            with open(meta_path, 'r', encoding='utf-8') as file:
                md = json.load(file)

        if from_spices and uuid in self.index_cache:
            md['last-edited'] = self.index_cache[uuid]['last_edited']
        else:
            md['last-edited'] = int(datetime.datetime.utcnow().timestamp())

        raw_meta = json.dumps(md, indent=4)
        with open(meta_path, 'w+', encoding='utf-8') as file:
            file.write(raw_meta)

    def _install_finished(self, job):
        uuid = job['uuid']
        if self.get_enabled(uuid):
            if self._proxy:
                self._proxy.ReloadXlet('(ss)', uuid, self.collection_type.upper())
            else:
                self.send_proxy_signal('ReloadXlet', '(ss)', uuid, self.collection_type.upper())

    def uninstall(self, uuid):
        """ uninstalls and removes the given extension"""
        job = {'uuid': uuid, 'func': self._uninstall}
        job['progress_text'] = _("Uninstalling %s") % uuid
        self._push_job(job)

    def _uninstall(self, job):
        try:
            uuid = job['uuid']
            if not self.themes:
                # Uninstall spice localization files, if any
                if os.path.exists(locale_inst):
                    i19_folders = os.listdir(locale_inst)
                    for i19_folder in i19_folders:
                        if os.path.isfile(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', '%s.mo' % uuid)):
                            os.remove(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', '%s.mo' % uuid))
                        # Clean-up this locale folder
                        removeEmptyFolders(os.path.join(locale_inst, i19_folder))

                # Uninstall settings file, if any
                if os.path.exists(os.path.join(settings_dir, uuid)):
                    shutil.rmtree(os.path.join(settings_dir, uuid))
                if os.path.exists(os.path.join(old_settings_dir, uuid)):
                    shutil.rmtree(os.path.join(old_settings_dir, uuid))
            for folder in self.spices_directories:
                shutil.rmtree(os.path.join(folder, uuid), ignore_errors=True)
            if self.actions:
                disabled_list = self.settings.get_strv(self.enabled_key)
                uuid_name = f"{uuid}.nemo_action"
                if uuid_name in disabled_list:
                    disabled_list.remove(uuid_name)
                    self.settings.set_strv(self.enabled_key, disabled_list)
                try:
                    os.remove(os.path.join(folder, f'{uuid}.nemo_action'))
                except FileNotFoundError:
                    pass
        except Exception as error:
            self.errorMessage(_("A problem occurred while removing %s.") % job['uuid'], str(error))

    def update_all(self):
        """ applies all available updates"""
        for uuid in self.updates_available:
            self.install(uuid)

    def abort(self, abort_type=ABORT_USER):
        """ trigger in-progress download to halt"""
        self.abort_download = abort_type
        self.download_manager.abort()

    def _is_aborted(self):
        return self.download_manager.abort_status

    def _ui_error_message(self, msg, detail=None):
        dialog = Gtk.MessageDialog(transient_for=self.window,
                                   modal=True,
                                   message_type=Gtk.MessageType.ERROR,
                                   buttons=Gtk.ButtonsType.OK)
        markup = msg
        if detail is not None:
            markup += _("\n\nDetails:  %s") % (str(detail))
        esc = html.escape(markup)
        dialog.set_markup(esc)
        dialog.show_all()
        dialog.run()
        dialog.destroy()

    def errorMessage(self, msg, detail=None):
        ui_thread_do(self._ui_error_message, msg, detail)

    def enable_extension(self, uuid, panel=1, box='right', position=0):
        if self.collection_type == 'applet':
            entries = []
            applet_id = self.settings.get_int('next-applet-id')
            self.settings.set_int('next-applet-id', (applet_id+1))

            for entry in self.settings.get_strv(self.enabled_key):
                info = entry.split(':')
                pos = int(info[2])
                if info[0] == f'panel{panel}' and info[1] == box and position <= pos:
                    info[2] = str(pos+1)
                    entries.append(':'.join(info))
                else:
                    entries.append(entry)

            entries.append(f'panel{panel}:{box}:{position}:{uuid}:{applet_id}')

            self.settings.set_strv(self.enabled_key, entries)
        elif self.collection_type == 'desklet':
            desklet_id = self.settings.get_int('next-desklet-id')
            self.settings.set_int('next-desklet-id', (desklet_id+1))
            enabled = self.settings.get_strv(self.enabled_key)

            screen = Gdk.Screen.get_default()
            primary = screen.get_primary_monitor()
            primary_rect = screen.get_monitor_geometry(primary)
            enabled.append(f'{uuid}:{desklet_id}:{primary_rect.x + 100}:{primary_rect.y + 100}')

            self.settings.set_strv(self.enabled_key, enabled)
        elif self.actions:
            disabled_extensions = self.settings.get_strv(self.enabled_key)
            uuid_name = f"{uuid}.nemo_action"
            if uuid_name in disabled_extensions:
                disabled_extensions.remove(uuid_name)
                self.settings.set_strv(self.enabled_key, disabled_extensions)
        else:
            enabled = self.settings.get_strv(self.enabled_key)
            enabled.append(uuid)
            self.settings.set_strv(self.enabled_key, enabled)

    def disable_extension(self, uuid):
        if self.themes:
            return

        if self.actions:
            disabled_extensions = self.settings.get_strv(self.enabled_key)
            uuid_name = f"{uuid}.nemo_action"
            if uuid_name not in disabled_extensions:
                disabled_extensions.append(uuid_name)
                self.settings.set_strv(self.enabled_key, disabled_extensions)
            return

        enabled_extensions = self.settings.get_strv(self.enabled_key)
        new_list = []
        for enabled_extension in enabled_extensions:
            if self.collection_type == 'applet':
                enabled_uuid = enabled_extension.split(':')[3].lstrip('!')
            elif self.collection_type == 'desklet':
                enabled_uuid = enabled_extension.split(':')[0].lstrip('!')
            else:
                enabled_uuid = enabled_extension.lstrip('!')

            if enabled_uuid != uuid:
                new_list.append(enabled_extension)
        self.settings.set_strv(self.enabled_key, new_list)

    def get_icon(self, uuid):
        """ gets the icon  for a given uuid"""
        try:
            if self.themes:
                file_path = os.path.join(self.cache_folder, os.path.basename(self.index_cache[uuid]['screenshot']))
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file_path, 100, -1, True)
            else:
                file_path = os.path.join(self.cache_folder, os.path.basename(self.index_cache[uuid]['icon']))
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file_path, 24, 24, True)

            return Gtk.Image.new_from_pixbuf(pixbuf)
        except Exception:
            print("There was an error processing one of the images. Try refreshing the cache.")
            return Gtk.Image.new_from_icon_name('image-missing', 2)
