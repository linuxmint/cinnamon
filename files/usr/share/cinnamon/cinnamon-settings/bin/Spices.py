#!/usr/bin/python3

import os
import sys

try:
    from gi.repository import Gio, Gtk, GObject, Gdk, GdkPixbuf, GLib
    import html
    import subprocess
    import threading
except Exception as error_message:
    print(error_message)
    sys.exit(1)

from cinnamon.harvester import Harvester, AbortedError, URL_SPICES_HOME

ABORT_NONE = 0
ABORT_ERROR = 1
ABORT_USER = 2

def ui_thread_do(callback, *args):
    GLib.idle_add(callback, *args, priority=GLib.PRIORITY_DEFAULT)

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

        self._h = Harvester(collection_type)

        self.updates_available = []

        self._proxy = None
        self._proxy_deferred_actions = []
        self.running_uuids = []

        self.jobs = []
        self.progressbars = []
        self.processing_jobs = False
        self.current_job = None
        self.total_jobs = 0

        self.abort_download = ABORT_NONE

        self.settings = self._h.settings
        self.enabled_key = self._h.enabled_key

        if not self.themes:
            self.settings.connect(f'changed::{self.enabled_key}', self._update_status)

        self._update_status()
        self._generate_update_list()

        self.monitorId = 0
        self.monitor = None
        try:
            self.monitor = Gio.File.new_for_path(self._h.install_folder).monitor_directory(0, None)
            self.monitorId = self.monitor.connect('changed', self._directory_changed)
        except Exception as e:
            # File monitors can fail when the OS runs out of file handles
            print(e)

        # Nemo discovers actions via filesystem monitoring and reloads them on its own.
        if not self.actions:
            try:
                Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                          'org.Cinnamon', '/org/Cinnamon', 'org.Cinnamon',
                                          None, self._on_proxy_ready, None)
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

        self._update_status()

    def _on_signal(self, proxy, sender_name, signal_name, params):
        if signal_name == "RunStateChanged":
            if self._proxy.GetRunState() == 2:
                self.send_deferred_proxy_calls()
        elif signal_name in ("XletsLoadedComplete", "XletAddedComplete"):
            self._update_status()

    def send_deferred_proxy_calls(self):
        if self._proxy.get_name_owner() and self._proxy_deferred_actions:
            for command, args in self._proxy_deferred_actions:
                getattr(self._proxy, command)(*args)

            self._proxy_deferred_actions = []

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
        spice_id = self._h.index_cache[uuid]['spices-id']
        subprocess.run(['/usr/bin/xdg-open',
                       f"{URL_SPICES_HOME}/{self.collection_type}s/view/{spice_id}"],
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
            self.window.set_progress(int(fraction * 100))

    def _set_progressbar_visible(self, visible):
        for progressbar in self.progressbars:
            progressbar.revealer.set_reveal_child(visible)

    def _update_progress(self, count, block_size, total_size):
        """ Progress callback handed to harvester. Runs on a worker thread.
            Raise AbortedError to halt an in-progress download."""
        if self._is_aborted():
            raise AbortedError()

        if block_size == 1:
            # Per-item progress (thumbnail downloads): count and total_size are item counts.
            fraction = count / total_size if total_size else 0
            text = _("Downloading images:") + f" {count}/{total_size}"
            ui_thread_do(self._set_progressbar_text, text)
        else:
            # Byte-level progress (zip download): count is chunks, block_size is chunk size.
            if total_size > 0:
                fraction = (count * block_size) / total_size
                if fraction > 1.0:
                    fraction = 1.0
            else:
                fraction = 0

        ui_thread_do(self._set_progressbar_fraction, fraction)

    # Jobs are added by calling _push_job. _process_job and _advance_queue
    # form a wrapper that runs the job in its own thread.
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

        self._set_progressbar_fraction(0)

        if len(self.jobs) > 0:
            # A new job is starting; clear any abort flag left over from a
            # previous job so its progress callback doesn't immediately fire
            # AbortedError.
            self.abort_download = ABORT_NONE
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
            self.abort_download = ABORT_NONE
            self._set_progressbar_visible(False)
            self._set_progressbar_text('')
            if self.monitor is not None:
                try:
                    self.monitorId = self.monitor.connect('changed', self._directory_changed)
                except Exception as e:
                    # File monitors can fail when the OS runs out of file handles
                    print(e)

            self.updates_available = [u.uuid for u in self._h.get_updates()]
            self.emit("installed-changed")

    def _directory_changed(self, *args):
        # External filesystem change — meta_map may be stale, full reload.
        self.updates_available = [u.uuid for u in self._h.reload()]
        self.emit("installed-changed")

    def get_installed(self):
        """ returns a dictionary of the metadata by uuid of all installed spices"""
        return self._h.meta_map

    def get_is_installed(self, uuid):
        """ returns a boolean specifying whether the given spice is installed or not"""
        return uuid in self._h.meta_map

    def get_has_update(self, uuid):
        """ returns a boolean indicating whether the given spice has an update available"""
        return self._h.has_update(uuid)

    def get_enabled(self, uuid):
        """ returns the number of instances currently enabled"""
        return self._h.get_enabled(uuid)

    def get_is_running(self, uuid):
        """ checks whether the spice is currently running (it may be enabled but not running if
            there was an error in initialization)"""
        return uuid in self.running_uuids

    def get_n_updates(self):
        """ returns the number of available updates"""
        return len(self.updates_available)

    def get_cache(self):
        """ retrieves a copy of the index cache """
        return self._h.index_cache

    def _generate_update_list(self):
        self.updates_available = [u.uuid for u in self._h.get_updates()]

    def refresh_cache(self):
        """ downloads an updated version of the index and assets"""
        job = {'func': self._do_refresh_cache, 'callback': self._on_refresh_cache_done}
        job['progress_text'] = _("Refreshing the cache")
        self._push_job(job)

    def _do_refresh_cache(self, job):
        try:
            self._h.refresh(full=True, force=True, progress_callback=self._update_progress)
        except AbortedError:
            return None
        except ValueError as e:
            if not self.abort_download:
                self.errorMessage(_("Something went wrong with the spices download. Please try refreshing the list again."), str(e))
                self.abort(ABORT_ERROR)
            return None
        except Exception as e:
            if not self.abort_download:
                self.errorMessage(_("An error occurred while trying to access the server. Please try again in a little while."), str(e))
                self.abort(ABORT_ERROR)
            return None
        return True

    def _on_refresh_cache_done(self, job):
        self._generate_update_list()
        self.emit('cache-loaded')

    def install(self, uuid):
        """ downloads and installs the given extension"""
        _callback = None if self.actions else self._install_finished
        job = {'uuid': uuid, 'func': self._install, 'callback': _callback}
        job['progress_text'] = _("Installing %s") % uuid
        self._push_job(job)

    def _install(self, job):
        uuid = job['uuid']
        try:
            self._h.install(uuid, progress_callback=self._update_progress)
        except AbortedError:
            return None
        except Exception as e:
            if not self.abort_download:
                self.errorMessage(_("An error occurred during the installation of %s. Please report this incident to its developer.") % uuid, str(e))
                self.abort(ABORT_ERROR)
            return None

        return True

    def _install_finished(self, job):
        if job.get('result') is None:
            return
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
            self._h.uninstall(job['uuid'])
        except Exception as error:
            self.errorMessage(_("A problem occurred while removing %s.") % job['uuid'], str(error))

    def update_all(self):
        """ applies all available updates"""
        for uuid in list(self.updates_available):
            self.install(uuid)

    def abort(self, abort_type=ABORT_USER):
        """ trigger in-progress download to halt"""
        self.abort_download = abort_type
        # Drop any queued jobs; the in-flight one (if any) will exit on its next
        # progress callback by raising AbortedError.
        self.jobs = []

    def _is_aborted(self):
        return self.abort_download != ABORT_NONE

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
        if self.collection_type == 'desklet':
            screen = Gdk.Screen.get_default()
            primary = screen.get_primary_monitor()
            primary_rect = screen.get_monitor_geometry(primary)
            self._h.enable(uuid, desklet_x=primary_rect.x + 100, desklet_y=primary_rect.y + 100)
        else:
            self._h.enable(uuid, panel=panel, box=box, position=position)

    def disable_extension(self, uuid):
        self._h.disable(uuid)

    def get_icon(self, uuid):
        """ gets the icon for a given uuid"""
        try:
            if self.themes:
                file_path = os.path.join(self._h.cache_folder, os.path.basename(self._h.index_cache[uuid]['screenshot']))
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file_path, 100, -1, True)
            else:
                file_path = os.path.join(self._h.cache_folder, os.path.basename(self._h.index_cache[uuid]['icon']))
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file_path, 24, 24, True)

            return Gtk.Image.new_from_pixbuf(pixbuf)
        except Exception:
            print("There was an error processing one of the images. Try refreshing the cache.")
            return Gtk.Image.new_from_icon_name('image-missing', 2)
