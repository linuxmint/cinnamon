try:
    from SettingsWidgets import rec_mkdir
    import gettext
    from gi.repository import Gio, Gtk, GObject, Gdk, GdkPixbuf, GLib
    import tempfile
    import os
    import sys
    import urllib2
    import zipfile
    import shutil
    import cgi
    import subprocess
    import threading
    import time
    from PIL import Image
    import config
except Exception, detail:
    print detail
    sys.exit(1)

try:
    import json
except ImportError:
    import simplejson as json

home = os.path.expanduser("~")
locale_inst = '%s/.local/share/locale' % home
settings_dir = '%s/.cinnamon/configs/' % home

URL_SPICES_HOME = "http://cinnamon-spices.linuxmint.com"
URL_MAP = {
    'applet': URL_SPICES_HOME + "/json/applets.json",
    'theme': URL_SPICES_HOME + "/json/themes.json",
    'desklet': URL_SPICES_HOME + "/json/desklets.json",
    'extension': URL_SPICES_HOME + "/json/extensions.json"
}

ABORT_NONE = 0
ABORT_ERROR = 1
ABORT_USER = 2

def ui_thread_do(callback, *args):
    GLib.idle_add (callback, *args, priority=GLib.PRIORITY_DEFAULT)

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
        print "Removing empty folder:", path
        os.rmdir(path)

class ThreadedTaskManager(GObject.GObject):
    def __init__(self, max_threads):
        super(ThreadedTaskManager, self).__init__()
        self.max_threads = max_threads
        self.jobs = []
        self.threads = []
        self.lock = threading.Lock()
        self.start_id = 0

    def get_n_jobs(self):
        return len(self.jobs) + len(self.threads)

    def busy(self):
        return len(self.jobs) > 0 or len(self.threads) > 0

    def push(self, func, callback, data):
        self.jobs.insert(0, (func, callback, data))

        if self.start_id == 0:
            self.start_id = GLib.idle_add(self.check_start_job)

    def check_start_job(self):
        self.start_id = 0
        if len(self.jobs) > 0:
            if len(self.threads) == self.max_threads:
                return

            job = self.jobs.pop()
            newthread = threading.Thread(target=self.thread_function_wrapper, args=job)
            newthread.start()
            self.threads.append(newthread)

            self.check_start_job()

    def thread_function_wrapper(self, func, callback, data):
        result = func(*data)

        self.lock.acquire()
        try:
            self.threads.remove(threading.current_thread())
        except:
            pass

        self.check_start_job()

        if callback is not None:
            ui_thread_do(callback, result)

        self.lock.release()

class Spice_Harvester(GObject.Object):
    __gsignals__ = {
        'installed-changed': (GObject.SignalFlags.RUN_FIRST, None, ()),
        'status-changed': (GObject.SignalFlags.RUN_FIRST, None, ()),
        'cache-loaded': (GObject.SignalFlags.RUN_FIRST, None, ())
    }

    def __init__(self, collection_type, window=None):
        super(Spice_Harvester, self).__init__()
        self.collection_type = collection_type
        self.window = window

        self.themes = collection_type == 'theme'
        self.index_cache = {}
        self.meta_map = {}
        self.download_manager = ThreadedTaskManager(10)
        self.error = None
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
        self.cache_folder = '%s/.cinnamon/spices.cache/%s/' % (home, self.collection_type)

        if self.themes:
            self.settings = Gio.Settings.new('org.cinnamon.theme')
            self.enabled_key = 'name'
        else:
            self.settings = Gio.Settings.new('org.cinnamon')
            self.enabled_key = 'enabled-%ss' % self.collection_type
        self.settings.connect('changed::%s' % self.enabled_key, self._update_status)

        if self.themes:
            self.install_folder = '%s/.themes/' % (home)
            self.spices_directories = (self.install_folder, '%s/.themes/' % (home))
        else:
            self.install_folder = '%s/.local/share/cinnamon/%ss/' % (home, self.collection_type)
            if self.collection_type == 'extension':
                self.spices_directories = (self.install_folder, )
            else:
                self.spices_directories = (self.install_folder, '/usr/share/cinnamon/%ss/' % self.collection_type)

        self._load_metadata()

        self._load_cache()

        self.abort_download = ABORT_NONE
        self._sigLoadFinished = None

        self.monitor = Gio.File.new_for_path(self.install_folder).monitor_directory(0, None)
        self.monitorId = self.monitor.connect('changed', self._directory_changed)

        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                      'org.Cinnamon', '/org/Cinnamon', 'org.Cinnamon', None, self._on_proxy_ready, None)
        except dbus.exceptions.DBusException as e:
            print(e)

    def _on_proxy_ready (self, object, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        self._proxy.connect('g-signal', self._on_signal)

        for command, args in self._proxy_deferred_actions:
            getattr(self._proxy, command)(*args)
        self._proxy_deferred_actions = []

        self.connect_proxy('XletAddedComplete', self._update_status)
        self._update_status()

    def _on_signal(self, proxy, sender_name, signal_name, params):
        for name, callback in self._proxy_signals:
            if signal_name == name:
                callback(*params)

    """ connects a callback to a dbus signal"""
    def connect_proxy(self, name, callback):
        self._proxy_signals.append((name, callback))

    """ disconnects a previously connected dbus signal"""
    def disconnect_proxy(self, name):
        for signal in self._proxy+_signals:
            if name in signal:
                self._proxy_signals.remove(signal)
                break

    """ sends a command over dbus"""
    def send_proxy_signal(self, command, *args):
        if self._proxy is None:
            self._proxy_deferred_actions.append((command, args))
        else:
            getattr(self._proxy, command)(*args)

    def _update_status(self, *args):
        try:
            if self._proxy:
                self.running_uuids = self._proxy.GetRunningXletUUIDs('(s)', self.collection_type)
            else:
                self.running_uuids = []
        except:
            self.running_uuids = []
        self.emit('status-changed')

    """ opens to the web page of the given uuid"""
    def open_spice_page(self, uuid):
        id = self.index_cache[uuid]['spices-id']
        os.system('xdg-open "%s/%ss/view/%s"' % (URL_SPICES_HOME, self.collection_type, id))

    """ returns a Gtk.Widget that can be added to the application. This widget will show the progress of any
        asynchronous actions taking place (ie. refreshing the cache or downloading an applet)"""
    def get_progressbar(self):
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

    def _set_progressbar_visible(self, visible):
        for progressbar in self.progressbars:
            progressbar.revealer.set_reveal_child(visible)

    # updates any progress bars with the download progress
    def _update_progress(self, count, blockSize, totalSize):
        if self.download_manager.busy():
            total = self.download_total_files
            current = total - self.download_manager.get_n_jobs()
            fraction = float(current) / float(total)
            text = "%s %i/%i" % (_("Downloading images:"), current, total)
            self._set_progressbar_text(text)
        else:
            fraction = count * blockSize / float((totalSize / blockSize + 1) * (blockSize))

        self._set_progressbar_fraction(fraction)

        while Gtk.events_pending():
            Gtk.main_iteration()

    # Jobs are added by calling _push_job. _process_job and _advance_queue form a wrapper that runs the job in it's own thread.
    def _push_job(self, job):
        self.total_jobs += 1
        job['job_number'] = self.total_jobs
        self.jobs.append(job)
        if not self.processing_jobs:
            self._advance_queue()

    def _process_job(self, job):
        job['result'] = job['func'](job)
        if 'callback' in job:
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
                text += " (%i/%i)" % (job['job_number'], self.total_jobs)
            self._set_progressbar_text(text)
            job_thread = threading.Thread(target=self._process_job, args=(job,))
            job_thread.start()
        else:
            self.processing_jobs = False
            self.current_job = None
            self.total_jobs = 0
            self._set_progressbar_visible(False)
            self._set_progressbar_text('')
            self.monitorId = self.monitor.connect('changed', self._directory_changed)
            self._directory_changed()

    def _download(self, outfd, outfile, url):
        try:
            self._url_retrieve(url, outfd, self._update_progress)
        except KeyboardInterrupt:
            try:
                os.remove(outfile)
            except OSError:
                pass
            if self.abort_download == ABORT_ERROR:
                self.errorMessage(_("An error occurred while trying to access the server.  Please try again in a little while."), self.error)
            raise Exception(_("Download aborted for %s.") % url)

        return outfile

    def _url_retrieve(self, url, f, reporthook):
        #Like the one in urllib. Unlike urllib.retrieve url_retrieve
        #can be interrupted. KeyboardInterrupt exception is rasied when
        #interrupted.
        count = 0
        blockSize = 1024 * 8
        try:
            urlobj = urllib2.urlopen(url)
            assert urlobj.getcode() == 200
        except Exception, detail:
            f.close()
            self.abort_download = ABORT_ERROR
            self.error = detail
            raise KeyboardInterrupt

        totalSize = int(urlobj.info()['content-length'])

        try:
            while self.abort_download == ABORT_NONE:
                data = urlobj.read(blockSize)
                count += 1
                if not data:
                    break
                f.write(data)
                ui_thread_do(reporthook, count, blockSize, totalSize)
        except KeyboardInterrupt:
            f.close()
            self.abort_download = ABORT_USER

        if self.abort_download > ABORT_NONE:
            raise KeyboardInterrupt

        del urlobj
        f.close()

    def _load_metadata(self):
        self.meta_map = {}

        for directory in self.spices_directories:
            extensions = os.listdir(directory)

            for uuid in extensions:
                subdirectory = os.path.join(directory, uuid)
                try:
                    json_data = open(os.path.join(subdirectory, 'metadata.json')).read()
                    metadata = json.loads(json_data)
                    metadata['path'] = subdirectory
                    metadata['writable'] = os.access(subdirectory, os.W_OK)
                    self.meta_map[uuid] = metadata
                except Exception, detail:
                    print detail
                    print("Skipping %s: there was a problem trying to read metadata.json" % uuid)

    def _directory_changed(self, *args):
        self._load_metadata()
        self.emit("installed-changed")

    """ returns a dictionary of the metadata by uuid of all installed spices"""
    def get_installed(self):
        return self.meta_map

    """ returns a boolean specifying whether the given spice is installed or not"""
    def get_is_installed(self, uuid):
        return uuid in self.meta_map

    """ returns a boolean indicating whether the given spice has an update available"""
    def get_has_update(self, uuid):
        if uuid not in self.index_cache:
            return False

        try:
            if self.meta_map[uuid]["last-edited"] == self.index_cache[uuid]["last_edited"]:
                return False
            else:
                return True
        except Exception as e:
            return False

    """ returns the number of instances currently enabled"""
    def get_enabled(self, uuid):
        enabled_count = 0
        if not self.themes:
            enabled_list = self.settings.get_strv(self.enabled_key)
            for item in enabled_list:
                if uuid in item:
                    enabled_count += 1
        elif self.settings.get_string(self.enabled_key) == uuid:
            enabled_count = 1

        return enabled_count

    """ checks whether the spice is currently running (it may be enabled but not running if there was an error in initialization)"""
    def get_is_running(self, uuid):
        return uuid in self.running_uuids

    """ returns True if there are updates available or False otherwise"""
    def are_updates_available(self):
        return len(self.updates_available) > 0

    """ retrieves a copy of the index cache """
    def get_cache(self):
        return self.index_cache

    def _load_cache(self):
        filename = os.path.join(self.cache_folder, 'index.json')
        if not os.path.exists(self.cache_folder):
            rec_mkdir(self.cache_folder)

        if not os.path.exists(filename):
            self.has_cache = False
            return
        else:
            self.has_cache = True

        self.updates_available = []
        f = open(filename, 'r')
        try:
            self.index_cache = json.load(f)
        except ValueError, detail:
            try:
                os.remove(filename)
            except:
                pass
            self.errorMessage(_("Something went wrong with the spices download.  Please try refreshing the list again."), str(detail))

        for uuid in self.index_cache:
            if self.get_is_installed(uuid) and self.get_has_update(uuid):
                self.updates_available.append(uuid)

    """ downloads an updated version of the index and assets"""
    def refresh_cache(self):
        self.old_cache = self.index_cache

        job = {'func': self._download_cache}
        job['progress_text'] = _("Refreshing the cache")
        self._push_job(job)

    def _download_cache(self, load_assets=True):
        download_url = URL_MAP[self.collection_type]

        filename = os.path.join(self.cache_folder, "index.json")
        f = open(filename, 'w')
        self._download(f, filename, download_url)

        self._load_cache()
        self._download_image_cache()

    def _download_image_cache(self):
        self.is_downloading_image_cache = True

        self.used_thumbs = []

        self.download_total_files = 0
        self.download_current_file = 0

        for uuid, info in self.index_cache.items():
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
                fstream = open(icon_path, 'w')
                self.download_manager.push(self._download, self._check_download_image_cache_complete, (fstream, icon_path, download_url))
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
        self.settings.set_int('%s-cache-updated' % self.collection_type, time.time())
        self._advance_queue()
        self.emit('cache-loaded')

    def get_cache_age(self):
        return (time.time() - self.settings.get_int('%s-cache-updated' % self.collection_type)) / 86400

    # checks for corrupt images in the cache so we can redownload them the next time we refresh
    def _is_bad_image(self, path):
        try:
            Image.open(path)
        except IOError, detail:
            return True
        return False

    # make sure the thumbnail fits the correct format (we are expecting it to be <uuid>.png
    def _sanitize_thumb(self, basename):
        return basename.replace("jpg", "png").replace("JPG", "png").replace("PNG", "png")

    """ downloads and installs the given extension"""
    def install(self, uuid):
        job = {'uuid': uuid, 'func': self._install, 'callback': self._install_finished}
        job['progress_text'] = _("Installing %s") % uuid
        self._push_job(job)

    def _install(self, job):
        try:
            uuid = job['uuid']

            download_url = URL_SPICES_HOME + self.index_cache[uuid]['file'];
            self.current_uuid = uuid

            fd, ziptempfile = tempfile.mkstemp()
            f = os.fdopen(fd, 'wb')
            self._download(f, ziptempfile, download_url)
            zip = zipfile.ZipFile(ziptempfile)

            tempfolder = tempfile.mkdtemp()
            zip.extractall(tempfolder)

            uuidfolder = os.path.join(tempfolder, uuid)
            contents = os.listdir(uuidfolder)
            # do we need to check file permissions?
            #         os.chmod(os.path.join(dirname, file.filename), 0o755)

            # check integrity of the download

            if not self.themes:
                if 'po' in contents:
                    po_dir = os.path.join(uuidfolder, 'po')
                    for file in os.listdir(po_dir):
                        if file.split(".")[1] == 'po':
                            lang = file.split(".")[0]
                            locale_dir = os.path.join(locale_inst, lang, 'LC_MESSAGES')
                            rec_mkdir(locale_dir)
                            subprocess.call(['msgfmt', '-c', os.path.join(po_dir, file), '-o', os.path.join(locale_dir, '%s.mo' % uuid)])

                schema = [filename for filename in contents if 'gschema.xml' in filename]
                for filename in schema:
                    if os.path.exists('/usr/bin/gksu') and os.path.exists(config.currentPath + "/bin/installSchema.py"):
                        message = _("Please enter your password to install the required settings schema for %s") % (uuid)
                        path = os.path.join(uuidfolder, filename)
                        tool = config.currentPath + "/bin/installSchema.py"

                        command = 'gksu  --message "<b>%s</b>" %s %s' % (message, tool, path)
                        os.system(command)
                    else:
                        self.errorMessage(_("Could not install the settings schema for %s.  You will have to perform this step yourself.") % (uuid))

            meta_path = os.path.join(uuidfolder, 'metadata.json')
            if self.themes and not os.path.exists(meta_path):
                md = {}
            else:
                file = open(meta_path, 'r')
                raw_meta = file.read()
                file.close()
                md = json.loads(raw_meta)

            if not self.themes and len(schema) > 0:
                md['schema-file'] = ','.join(schema)
            md['last-edited'] = self.index_cache[uuid]['last_edited']

            raw_meta = json.dumps(md, indent=4)
            file = open(meta_path, 'w+')
            file.write(raw_meta)
            file.close()

            dest = os.path.join(self.install_folder, uuid)
            if os.path.exists(dest):
                shutil.rmtree(dest)
            shutil.copytree(uuidfolder, dest)

        except Exception, detail:
            if not self.abort_download:
                self.errorMessage(_("An error occurred during the installation of %s. Please report this incident to its developer.") % uuid, str(detail))
            return False

        try:
            shutil.rmtree(tempfolder)
            os.remove(ziptempfile)
        except Exception:
            pass

    def _install_finished(self, job):
        uuid = job['uuid']
        if self.get_enabled(uuid):
            self.send_proxy_signal('ReloadXlet', '(ss)', uuid, self.collection_type.upper())

    """ uninstalls and removes the given extension"""
    def uninstall(self, uuid):
        job = {'uuid': uuid, 'func': self._uninstall}
        job['progress_text'] = _("Uninstalling %s") % uuid
        self._push_job(job)

    def _uninstall(self, job):
        try:
            uuid = job['uuid']
            if not self.themes:
                if 'schema-file' in self.meta_map[uuid]:
                    sentence = _("Please enter your password to remove the settings schema for %s") % (uuid)
                    if os.path.exists('/usr/bin/gksu') and os.path.exists(config.currentPath + "/bin/removeSchema.py"):
                        for file in self.meta_map[uuid]:
                            launcher = 'gksu  --message "<b>%s</b>"' % sentence
                            tool = config.currentPath + "/bin/removeSchema.py %s" % (file)
                            command = '%s %s' % (launcher, tool)
                            os.system(command)
                    else:
                        self.errorMessage(_("Could not remove the settings schema for %s.  You will have to perform this step yourself.  This is not a critical error.") % (job["uuid"]))

                # Uninstall spice localization files, if any
                if (os.path.exists(locale_inst)):
                    i19_folders = os.listdir(locale_inst)
                    for i19_folder in i19_folders:
                        if os.path.isfile(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', '%s.mo' % uuid)):
                            os.remove(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', '%s.mo' % uuid))
                        # Clean-up this locale folder
                        removeEmptyFolders(os.path.join(locale_inst, i19_folder))

                # Uninstall settings file, if any
                if (os.path.exists(os.path.join(settings_dir, uuid))):
                    shutil.rmtree(os.path.join(settings_dir, uuid))
            shutil.rmtree(os.path.join(self.install_folder, uuid))
        except Exception, detail:
            self.errorMessage(_("A problem occurred while removing %s.") % job['uuid'], str(detail))

    """ applies all available updates"""
    def update_all(self):
        for uuid in self.updates_available:
            self.install(uuid)

    """ trigger in-progress download to halt"""
    def abort(self, *args):
        self.abort_download = ABORT_USER
        return

    def _ui_error_message(self, msg, detail = None):
        dialog = Gtk.MessageDialog(transient_for = self.window,
                                   modal = True,
                                   message_type = Gtk.MessageType.ERROR,
                                   buttons = Gtk.ButtonsType.OK)
        markup = msg
        if detail is not None:
            markup += _("\n\nDetails:  %s") % (str(detail))
        esc = cgi.escape(markup)
        dialog.set_markup(esc)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()

    def errorMessage(self, msg, detail=None):
        ui_thread_do(self._ui_error_message, msg, detail)

    def enable_extension(self, uuid, panel=1, box='right', position=0):
        if self.collection_type == 'applet':
            entries = []
            applet_id = self.settings.get_int('next-applet-id');
            self.settings.set_int('next-applet-id', (applet_id+1));

            for entry in self.settings.get_strv(self.enabled_key):
                info = entry.split(':')
                pos = int(info[2])
                if info[0] == 'panel%d' % panel and info[1] == box and position <= pos:
                    info[2] = str(pos+1)
                    entries.append(':'.join(info))
                else:
                    entries.append(entry)

            entries.append('panel%d:%s:%d:%s:%d' % (panel, box, position, uuid, applet_id))

            self.settings.set_strv(self.enabled_key, entries)
        elif self.collection_type == 'desklet':
            desklet_id = self.settings.get_int('next-desklet-id');
            self.settings.set_int('next-desklet-id', (desklet_id+1));
            enabled = self.settings.get_strv(self.enabled_key)

            screen = Gdk.Screen.get_default()
            primary = screen.get_primary_monitor()
            primary_rect = screen.get_monitor_geometry(primary)
            enabled.append(('%s:%d:%d:%d') % (uuid, desklet_id, primary_rect.x + 100, primary_rect.y + 100))

            self.settings.set_strv(self.enabled_key, enabled)

        else:
            enabled = self.settings.get_strv(self.enabled_key)
            enabled.append(uuid)
            self.settings.set_strv(self.enabled_key, enabled)

    def disable_extension(self, uuid):
        enabled_extensions = self.settings.get_strv(self.enabled_key)
        new_list = []
        for enabled_extension in enabled_extensions:
            if uuid not in enabled_extension:
                new_list.append(enabled_extension)
        self.settings.set_strv(self.enabled_key, new_list)

    """ gets the icon  for a given uuid"""
    def get_icon(self, uuid):
        try:
            if self.themes:
                file_path = os.path.join(self.cache_folder, os.path.basename(self.index_cache[uuid]['screenshot']))
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file_path, 100, -1, True)
            else:
                file_path = os.path.join(self.cache_folder, os.path.basename(self.index_cache[uuid]['icon']))
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file_path, 24, 24, True)

            return Gtk.Image.new_from_pixbuf(pixbuf)
        except Exception as e:
            print("There was an error processing one of the images. Try refreshing the cache.")
            return Gtk.Image.new_from_icon_name('image-missing', 2)
