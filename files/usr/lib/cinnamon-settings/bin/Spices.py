try:
    from SettingsWidgets import rec_mkdir
    import gettext
    from gi.repository import Gio, Gtk, GObject, Gdk, GdkPixbuf
    # WebKit requires gir1.2-javascriptcoregtk-3.0 and gir1.2-webkit-3.0
    # try:
    #     from gi.repository import WebKit
    #     HAS_WEBKIT=True
    # except:
    #     HAS_WEBKIT=False
    #     print "WebKit not found on this system. These packages are needed for adding spices:"
    #     print "  gir1.2-javascriptcoregtk-3.0"
    #     print "  gir1.2-webkit-3.0"
    import locale
    import tempfile
    import os
    import sys
    import time
    import urllib2
    import zipfile
    import string
    import shutil
    import subprocess
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
URL_SPICES_APPLET_LIST = URL_SPICES_HOME + "/json/applets.json"
URL_SPICES_THEME_LIST = URL_SPICES_HOME + "/json/themes.json"
URL_SPICES_DESKLET_LIST = URL_SPICES_HOME + "/json/desklets.json"
URL_SPICES_EXTENSION_LIST = URL_SPICES_HOME + "/json/extensions.json"

ABORT_NONE = 0
ABORT_ERROR = 1
ABORT_USER = 2

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

class Spice_Harvester:
    def __init__(self, collection_type, window, builder, noun, pl_noun):
        self.collection_type = collection_type
        self.noun = noun
        self.pl_noun = pl_noun
        self.cache_folder = self.get_cache_folder()
        self.install_folder = self.get_install_folder()
        self.index_cache = {}
        self.themes = collection_type == "theme"
        
        if not os.path.exists(os.path.join(self.cache_folder, "index.json")):
            self.has_cache = False
        else:
            self.has_cache = True
        
        self.window = window
        self.builder = builder


        self.progress_window = self.builder.get_object("progress_window")
        self.progress_button_close = self.builder.get_object("btnProgressClose")
        self.progress_button_abort = self.builder.get_object("btnProgressAbort")

        self.progresslabel = self.builder.get_object('progresslabel')
        self.progressbar = self.builder.get_object("progressbar")
        self.progressbar.set_text(_(''))
        self.progressbar.set_fraction(0)

        self.progress_window.set_title("")

        self.abort_download = ABORT_NONE
        self.download_total_files = 0
        self.download_current_file = 0
        self._sigLoadFinished = None

        self.progress_button_abort.connect("clicked", self.on_abort_clicked)
        self.progress_button_close.connect("clicked", self.on_progress_close)

        self.spiceDetail = Gtk.Dialog(_("Applet info"),
                            self.window,
                            Gtk.DialogFlags.MODAL | Gtk.DialogFlags.DESTROY_WITH_PARENT)
        self.spiceDetailSelectButton = self.spiceDetail.add_button(_("Select and Close"), Gtk.ResponseType.YES)
        self.spiceDetailSelectButton.connect("clicked", lambda x: self.close_select_detail())
        self.spiceDetailCloseButton = self.spiceDetail.add_button(_("Close"), Gtk.ResponseType.CANCEL)
        self.spiceDetailCloseButton.connect("clicked", lambda x: self.close_detail())
        self.spiceDetail.connect("destroy", self.on_close_detail)
        self.spiceDetail.connect("delete_event", self.on_close_detail)
        self.spiceDetail.set_default_size(640, 440)
        self.spiceDetail.set_size_request(640, 440)
        content_area = self.spiceDetail.get_content_area()

        # if self.get_webkit_enabled():
        #     self.browser = WebKit.WebView()
            
        #     self.browser.connect('button-press-event', lambda w, e: e.button == 3)
        #     self.browser.connect('title-changed', self.browser_title_changed)
        #     self.browser.connect('console-message' , self.browser_console_message)
        
        #     settings = WebKit.WebSettings()
        #     settings.set_property('enable-xss-auditor', False)
        #     settings.set_property('enable-file-access-from-file-uris', True)
        #     settings.set_property('enable-accelerated-compositing', True)
        #     self.browser.set_settings(settings)

        #     scrolled_window = Gtk.ScrolledWindow()
        #     scrolled_window.set_shadow_type(Gtk.ShadowType.NONE)
        #     scrolled_window.set_border_width(0)
        #     scrolled_window.add(self.browser)
        #     content_area.pack_start(scrolled_window, True, True, 0)
        #     scrolled_window.show()

    def get_webkit_enabled(self):
        return HAS_WEBKIT
    
    def close_select_detail(self):
        self.spiceDetail.hide()
        if callable(self.on_detail_select):
            self.on_detail_select(self)

    def on_close_detail(self, *args):
        self.close_detail()
        return True

    def close_detail(self):
        self.spiceDetail.hide()
        if hasattr(self, 'on_detail_close') and callable(self.on_detail_close):
            self.on_detail_close(self)

    def show_detail(self, uuid, onSelect=None, onClose=None):        
        self.on_detail_select = onSelect
        self.on_detail_close = onClose

        if not self.has_cache:
            self.refresh_cache(False)
        elif len(self.index_cache) == 0:
            self.load_cache()

        if uuid not in self.index_cache:
            self.load(lambda x: self.show_detail(uuid))
            return

        self.load_assets([uuid])
        
        appletData = self.index_cache[uuid] 
        
        # Browsing the info within the app would be great (ala mintinstall) but until it's fully ready 
        # and it gives a better experience (layout, comments, reviewing) than 
        # browsing online we'll open the link with an external browser 
        os.system("xdg-open '%s/%ss/view/%s'" % (URL_SPICES_HOME, self.collection_type, appletData['spices-id']))
        return
        
        screenshot_filename = os.path.basename(appletData['screenshot'])
        screenshot_path = os.path.join(self.get_cache_folder(), screenshot_filename)
        appletData['screenshot_path'] = screenshot_path
        appletData['screenshot_filename'] = screenshot_filename

        if not os.path.exists(screenshot_path):
            f = open(screenshot_path, 'w')
            self.download_url = URL_SPICES_HOME + appletData['screenshot']
            self.download_with_progressbar(f, screenshot_path, _('Downloading screenshot'), False)

        template = open(os.path.realpath(os.path.dirname(os.path.abspath(__file__)) + "/../data/spices/applet-detail.html")).read()
        subs = {}
        subs['appletData'] = json.dumps(appletData, sort_keys=False, indent=3)
        html = string.Template(template).safe_substitute(subs)

        # Prevent flashing previously viewed
        self._sigLoadFinished = self.browser.connect("document-load-finished", lambda x, y: self.real_show_detail())
        self.browser.load_html_string(html, "file:///")

    def real_show_detail(self):
        self.browser.show()
        self.spiceDetail.show()
        self.browser.disconnect(self._sigLoadFinished)

    def browser_title_changed(self, view, frame, title):
        if title.startswith("nop"):
            return
        elif title.startswith("install:"):
            uuid = title.split(':')[1]
            #self.install(uuid)
        elif title.startswith("uninstall:"):
            uuid = title.split(':')[1]
            #self.uninstall(uuid, '')
        return

    def browser_console_message(self, view, msg, line, sourceid):
        return
        #print msg

    def get_index_url(self):
        if self.collection_type == 'applet':
            return URL_SPICES_APPLET_LIST
        elif self.collection_type == 'extension':
            return URL_SPICES_EXTENSION_LIST
        elif self.collection_type == 'theme':
            return URL_SPICES_THEME_LIST
        elif self.collection_type == 'desklet':
            return URL_SPICES_DESKLET_LIST
        else:
            return False

    def get_cache_folder(self):
        cache_folder = "%s/.cinnamon/spices.cache/%s/" % (home, self.collection_type)

        if not os.path.exists(cache_folder):
            rec_mkdir(cache_folder)
        return cache_folder

    def get_install_folder(self):
        if self.collection_type in ['applet','desklet','extension']:
            install_folder = '%s/.local/share/cinnamon/%ss/' % (home, self.collection_type)
        elif self.collection_type == 'theme':
            install_folder = '%s/.themes/' % (home)

        return install_folder

    def load(self, onDone, force=False):
        self.abort_download = ABORT_NONE
        if (self.has_cache and not force):
            self.load_cache()
        else:
            self.progresslabel.set_text(_("Refreshing %s index...") % (self.noun))
            self.progress_window.show()
            self.refresh_cache()

        onDone(self.index_cache)

    def refresh_cache(self, load_assets=True):
        self.download_url = self.get_index_url()
        self.progressbar.set_fraction(0)
        self.progress_bar_pulse()

        filename = os.path.join(self.cache_folder, "index.json")
        f = open(filename, 'w')
        self.download(f, filename)
        
        self.load_cache()
        #print "Loaded index, now we know about %d spices." % len(self.index_cache)
        
        if load_assets:
            self.load_assets()

    def load_cache(self):
        filename = os.path.join(self.cache_folder, "index.json")
        f = open(filename, 'r')
        try:
            self.index_cache = json.load(f)
        except ValueError, detail:
            try:
                os.remove(filename)
            except:
                pass
            self.errorMessage(_("Something went wrong with the spices download.  Please try refreshing the list again."), str(detail))

    def load_assets(self, uuids=None):
        self.progresslabel.set_text(_("Refreshing %s cache...") % (self.noun))
        self.progress_button_abort.set_sensitive(True)
        needs_refresh = 0

        if uuids == None:
            uuids = self.index_cache.keys()

        for uuid in uuids:
            if not self.themes:
                icon_basename = os.path.basename(self.index_cache[uuid]['icon'])
                icon_path = os.path.join(self.cache_folder, icon_basename)
            else:
                icon_basename = self.sanitize_thumb(os.path.basename(self.index_cache[uuid]['screenshot']))
                icon_path = os.path.join(self.cache_folder, icon_basename)

            self.index_cache[uuid]['icon_filename'] = icon_basename
            self.index_cache[uuid]['icon_path'] = icon_path

            if not os.path.isfile(icon_path):
                needs_refresh += 1

        self.download_total_files = needs_refresh
        self.download_current_file = 0

        for uuid in uuids:
            if self.abort_download > ABORT_NONE:
                return

            icon_path = self.index_cache[uuid]['icon_path']
            if not os.path.isfile(icon_path):
                #self.progress_bar_pulse()
                self.download_current_file += 1
                f = open(icon_path, 'w')
                if not self.themes:
                    self.download_url = URL_SPICES_HOME + self.index_cache[uuid]['icon']
                else:
                    self.download_url = URL_SPICES_HOME + "/uploads/themes/thumbs/" + self.index_cache[uuid]['icon_filename']
                valid = True
                try:
                    urllib2.urlopen(self.download_url).getcode()
                except:
                    valid = False
                if valid:
                    self.download(f, icon_path)

        self.progress_window.hide()

        self.download_total_files = 0
        self.download_current_file = 0

    def sanitize_thumb(self, basename):
        return basename.replace("jpg", "png").replace("JPG", "png").replace("PNG", "png")

    def install_all(self, install_list=[], onFinished=None):
        need_restart = False
        success = False
        for uuid, is_update, is_active in install_list:
            success = self.install(uuid, is_update, is_active)
            need_restart = need_restart or (is_update and is_active and success)
        self.progress_window.hide()
        if callable(onFinished):
            try:
                onFinished(need_restart)
            except:
                pass

    def get_members(self, zip):
        parts = []
        for name in zip.namelist():
            if not name.endswith('/'):
                parts.append(name.split('/')[:-1])
        prefix = os.path.commonprefix(parts) or ''
        if prefix:
            prefix = '/'.join(prefix) + '/'
        offset = len(prefix)
        for zipinfo in zip.infolist():
            name = zipinfo.filename
            if len(name) > offset:
                zipinfo.filename = name[offset:]
                yield zipinfo

    def install(self, uuid, is_update, is_active):
        #print "Start downloading and installation"
        title = self.index_cache[uuid]['name']

        if is_update:
            verb = _("Updating")
        else:
            verb = _("Installing")

        self.download_url = URL_SPICES_HOME + self.index_cache[uuid]['file'];
        self.current_uuid = uuid

        self.progress_button_close.set_sensitive(False)
        self.progress_window.show()        

        self.progresslabel.set_text(_("%s %s...") % (verb, title))
        self.progressbar.set_fraction(0)

        edited_date = self.index_cache[uuid]['last_edited']

        if not self.themes:
            executable_files = ['settings.py']
            fd, filename = tempfile.mkstemp()
            f = os.fdopen(fd, 'wb')
            try:
                self.download(f, filename)
                dest = os.path.join(self.install_folder, uuid)
                schema_filename = ""
                zip = zipfile.ZipFile(filename)
                zip.extractall(dest, self.get_members(zip))
                for file in self.get_members(zip):
                    if file.filename in executable_files:
                        os.chmod(os.path.join(dest, file.filename), 0o755)
                    elif file.filename[:3] == 'po/':
                        parts = os.path.splitext(file.filename)
                        if parts[1] == '.po':
                           this_locale_dir = os.path.join(locale_inst, parts[0][3:], 'LC_MESSAGES')
                           self.progresslabel.set_text(_("Installing translations for %s...") % title)
                           rec_mkdir(this_locale_dir)
                           #print "/usr/bin/msgfmt -c %s -o %s" % (os.path.join(dest, file.filename), os.path.join(this_locale_dir, '%s.mo' % uuid))
                           subprocess.call(["msgfmt", "-c", os.path.join(dest, file.filename), "-o", os.path.join(this_locale_dir, '%s.mo' % uuid)])
                           self.progresslabel.set_text(_("%s %s...") % (verb, title))
                    elif "gschema.xml" in file.filename:
                        sentence = _("Please enter your password to install the required settings schema for %s") % (uuid)
                        if os.path.exists("/usr/bin/gksu") and os.path.exists("/usr/lib/cinnamon-settings/bin/installSchema.py"):
                            launcher = "gksu  --message \"<b>%s</b>\"" % sentence
                            tool = "/usr/lib/cinnamon-settings/bin/installSchema.py %s" % (os.path.join(dest, file.filename))
                            command = "%s %s" % (launcher, tool)
                            os.system(command)
                            schema_filename = file.filename
                        else:
                            self.errorMessage(_("Could not install the settings schema for %s.  You will have to perform this step yourself.") % (uuid))
                file = open(os.path.join(dest, "metadata.json"), 'r')
                raw_meta = file.read()
                file.close()
                md = json.loads(raw_meta)
                md["last-edited"] = edited_date
                if schema_filename != "":
                    md["schema-file"] = schema_filename
                raw_meta = json.dumps(md, indent=4)
                file = open(os.path.join(dest, "metadata.json"), 'w+')
                file.write(raw_meta)
                file.close()

            except Exception, detail:
                self.progress_window.hide()
                self.errorMessage(_("An error occurred during installation or updating.  You may wish to report this incident to the developer of %s.") % (uuid), str(detail))
                return False
        else:
            fd, filename = tempfile.mkstemp()
            f = os.fdopen(fd, 'wb')
            try:
                self.download(f, filename)
                dest = os.path.join(self.install_folder, title, "cinnamon")
                zip = zipfile.ZipFile(filename)
                zip.extractall(dest, self.get_members(zip))

                # Test for correct folder structure - look for cinnamon.css
                file = open(os.path.join(dest, "cinnamon.css"), 'r')
                file.close()

                md = {}
                md["last-edited"] = edited_date
                md["uuid"] = uuid
                raw_meta = json.dumps(md, indent=4)
                file = open(os.path.join(dest, "metadata.json"), 'w+')
                file.write(raw_meta)
                file.close()

            except Exception, detail:
                self.progress_window.hide()
                if not self.themes:
                    obj = uuid
                else:
                    obj = title
                self.errorMessage(_("An error occurred during installation or updating.  You may wish to report this incident to the developer of %s.") % (obj), str(detail))
                return False

        self.progress_button_close.set_sensitive(True)
        self.progress_button_abort.set_sensitive(False)
        self.progress_window.show()
        return True

    def uninstall(self, uuid, name, schema_filename, onFinished=None):
        self.progress_button_close.set_sensitive(False)        
        self.progresslabel.set_text(_("Uninstalling %s...") % name)
        self.progress_window.show()
        
        self.progress_bar_pulse()
        try:
            if not self.themes:
                if schema_filename != "":
                    sentence = _("Please enter your password to remove the settings schema for %s") % (uuid)
                    if os.path.exists("/usr/bin/gksu") and os.path.exists("/usr/lib/cinnamon-settings/bin/removeSchema.py"):
                        launcher = "gksu  --message \"<b>%s</b>\"" % sentence
                        tool = "/usr/lib/cinnamon-settings/bin/removeSchema.py %s" % (schema_filename)
                        command = "%s %s" % (launcher, tool)
                        os.system(command)
                    else:
                        self.errorMessage(_("Could not remove the settings schema for %s.  You will have to perform this step yourself.  This is not a critical error.") % (uuid))
                shutil.rmtree(os.path.join(self.install_folder, uuid))

                # Uninstall spice's localization files, if any
                if (os.path.exists(locale_inst)):
                    i19_folders = os.listdir(locale_inst)
                    for i19_folder in i19_folders:
                        if os.path.isfile(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', "%s.mo" % uuid)):
                            os.remove(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', "%s.mo" % uuid))
                        # Clean-up this locale folder
                        removeEmptyFolders(os.path.join(locale_inst, i19_folder))

                # Uninstall settings file, if any
                if (os.path.exists(os.path.join(settings_dir, uuid))):
                    shutil.rmtree(os.path.join(settings_dir, uuid))
            else:
                shutil.rmtree(os.path.join(self.install_folder, name))
        except Exception, detail:
            self.progress_window.hide()
            self.errorMessage(_("Problem uninstalling %s.  You may need to manually remove it.") % (uuid), detail)

        self.progress_button_close.set_sensitive(True)
        self.progress_window.hide()

        if callable(onFinished):
            onFinished(uuid)

    def on_progress_close(self, widget):
        self.progress_window.hide()
        return

    def on_abort_clicked(self, button):
        self.abort_download = ABORT_USER
        self.progress_window.hide()
        return

    def on_refresh_clicked(self):
        self.load_index()

    def download_with_progressbar(self, outfd, outfile, caption='Please wait..', waitForClose=True):
        self.progress_button_close.set_sensitive(False)
        self.progressbar.set_fraction(0)
        self.progressbar.set_text('0%')        
        self.progresslabel.set_text(caption)
        self.progress_window.show()

        while Gtk.events_pending():
            Gtk.main_iteration()
        
        self.progress_bar_pulse()
        self.download(outfd, outfile)

        if not waitForClose:
            time.sleep(0.5)
            self.progress_window.hide()
        else:
            self.progress_button_close.set_sensitive(True)
            self.progress_button_abort.set_sensitive(False)

    def progress_bar_pulse(self):
        '''
        Progress bar pulse
        '''
        count = 0
        self.progressbar.set_pulse_step(0.1)
        while count < 1:
            time.sleep(0.1)
            self.progressbar.pulse()
            count += 1
            while Gtk.events_pending():
                Gtk.main_iteration()

    def download(self, outfd, outfile):
        url = self.download_url
        
        try:
            self.url_retrieve(url, outfd, self.reporthook)
        except KeyboardInterrupt:
            try:
                os.remove(outfile)
            except OSError:
                pass
            self.progress_window.hide()
            if self.abort_download == ABORT_ERROR:
                self.errorMessage(_("An error occurred while trying to access the server.  Please try again in a little while."), self.error or None)
            raise Exception(_('Download aborted.'))

        return outfile

    def reporthook(self, count, blockSize, totalSize):
        if self.download_total_files > 1:
            fraction = (float(self.download_current_file) / float(self.download_total_files));
            self.progressbar.set_text("%s - %d / %d files" % (str(int(fraction*100)) + '%', self.download_current_file, self.download_total_files))
        else:
            fraction = count * blockSize / float((totalSize / blockSize + 1) *
                (blockSize))
            self.progressbar.set_text(str(int(fraction * 100)) + '%')

        if fraction > 0:
            self.progressbar.set_fraction(fraction)
        else:
            self.progress_bar_pulse()

        while Gtk.events_pending():
            Gtk.main_iteration()

    def url_retrieve(self, url, f, reporthook):
        '''
        Like the one in urllib. Unlike urllib.retrieve url_retrieve
        can be interrupted. KeyboardInterrupt exception is rasied when
        interrupted.
        '''
        count = 0
        blockSize = 1024 * 8
        try:
            urlobj = urllib2.urlopen(url)
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
                reporthook(count, blockSize, totalSize)
        except KeyboardInterrupt:
            f.close()
            self.abort_download = ABORT_USER

        if self.abort_download > ABORT_NONE:
            raise KeyboardInterrupt

        del urlobj
        f.close()

    def scrubConfigDirs(self, enabled_list):
        active_list = {}
        for enabled in enabled_list:
            if self.collection_type == "applet":
                panel, align, order, uuid, id = enabled.split(":")
            elif self.collection_type == "desklet":
                uuid, id, x, y = enabled.split(":")
            else:
                uuid = enabled
                id = 0
            if uuid not in active_list:
                id_list = []
                active_list[uuid] = id_list
                active_list[uuid].append(id)
            else:
                active_list[uuid].append(id)

        for uuid in active_list.keys():
            if (os.path.exists(os.path.join(settings_dir, uuid))):
                dir_list = os.listdir(os.path.join(settings_dir, uuid))
                for id in active_list[uuid]:
                    fn = str(id) + ".json"
                    if fn in dir_list:
                        dir_list.remove(fn)
                fn = str(uuid) + ".json"
                if fn in dir_list:
                    dir_list.remove(fn)
                for jetsam in dir_list:
                    try:
                        os.remove(os.path.join(settings_dir, uuid, jetsam))
                    except:
                        pass

    def errorMessage(self, msg, detail = None):
        dialog = Gtk.MessageDialog(None, Gtk.DialogFlags.MODAL, Gtk.MessageType.ERROR, Gtk.ButtonsType.OK, None)
        markup = msg
        if detail is not None:
            markup += _("\n\nDetails:  %s") % (str(detail))
        dialog.set_markup(markup)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()
