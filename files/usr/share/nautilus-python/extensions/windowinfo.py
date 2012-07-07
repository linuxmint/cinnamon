import os.path
import subprocess
import urllib
import weakref

from gi.repository import Nautilus, GObject, Gio, Gtk, GdkX11
import dbus.service
from dbus.mainloop.glib import DBusGMainLoop
DBusGMainLoop(set_as_default=True)

dbusbusname = 'org.gnome.Nautilus.WindowInfo'
dbuspath = '/org/gnome/Nautilus/windows/%#x'
dbusinterface_posix = 'org.gnome.Nautilus.WindowInfo.posix' # posix file system (this was previously called Window.fs)
dbusinterface_gvfs = 'org.gnome.Nautilus.WindowInfo.gvfs' # posix file system (this was previously called Window.fs)

def posix_shell_escape(string):
    assert "\n" not in string, "I don't know how to represent a newline character in POSIX escaped arguments."
    escape = "\\|&;<>()$`\"' \t\n*?[#~=%" # \\ has to be first. see http://www.opengroup.org/austin/mailarchives/ag/msg09377.html for the rest
    for c in escape:
        string = string.replace(c,"\\"+c)
    return string

def gvfs2posix(string):
    """Convert a gvfs path to a posix path, raising an exception if there is none"""
    f = Gio.file_new_for_path(string)
    p = f.get_path()
    if not f:
        raise Exception("There is no POSIX path for this GVFS path.")
    return p

def renaming(rename_to):
    """decorator to rename a function object before it is passed to other decorators"""
    def decorate(func):
        func.__name__ = rename_to
        return func
    return decorate

class RemoteWindow(dbus.service.Object):
    """Objects attached to windows that serve as their remote controls. Windows
    get these created and attached as their .remotecontrol properties by the
    bus_RemoteControlPseudomenus plugin's ._make_known() method."""
    def __init__(self, window):
        self.selection = []
        self.currentPath = None
        self._window = weakref.ref(window)
        
        bus_path = dbuspath%self.window.get_window().get_xid()
        print "Claiming DBus path %r"%bus_path
        bus_name = dbus.service.BusName(dbusbusname, bus = dbus.SessionBus())
        
        try:
           dbus.service.Object.__init__(self, bus_name, bus_path)
           window.connect('loading-uri', self.uri_changed_cb)
        except Exception:
           print "We're already listening!"

    window = property(lambda self: self._window())

    def select(self, files):
        self.selection = files
        #print self.selection
    
    def updatePath(self, path):
        #print "Path updated to %s"%path
        self.currentPath = path

    @dbus.service.method(dbus_interface=dbusinterface_gvfs, out_signature='as')
    def getSelection(self):
        return self.selection

    @dbus.service.method(dbus_interface=dbusinterface_gvfs, out_signature='s')
    def getCwd(self):
        return self.currentPath

    @dbus.service.signal(dbus_interface=dbusinterface_gvfs, signature='s')
    def cwdChanged(self, path): pass
    
    

class PosixRemoteWindow(RemoteWindow):
    """RemoteControlWindow that additionally provides the methods and signals
    on a .posix interface, with all gio/gvfs paths mapped to real filesystem
    paths"""
    # has to be in another class: the dbus.service._method_lookup method looks
    # through the whole mro looking for a method that has the right name (can't
    # be two in one class (!)) and the right dbus interface (can't be two in
    # one function). from a python point of view, the overwritten methods are
    # only accessible via RemoteControlWindow.the_function(self, ...)!

    @dbus.service.method(dbus_interface=dbusinterface_posix, out_signature='as')
    def getSelection(self):
        return [gvfs2posix(x) for x in self.selection]

    @dbus.service.method(dbus_interface=dbusinterface_posix, out_signature='s')
    def getSelectionShelljoint(self):
        return " ".join([posix_shell_escape(x) for x in PosixRemoteWindow.get_selection(self)]) # while self.get_selection would work as well, i don't think it's wise because both functions of the same name stay in active use, and if some wise guy decides to split GvfsRemoteControlWindow out of RemotecontrolWindow, the sequence of inheritance might make this call the wrong get_selection

    @dbus.service.method(dbus_interface=dbusinterface_posix, out_signature='s')
    def getCwd(self):
        return gvfs2posix(self.currentPath)
    
    @dbus.service.signal(dbus_interface=dbusinterface_posix, signature='s')
    def cwdChanged(self, path): 
        pass


class RemoteWindowMenuProvider(GObject.GObject, Nautilus.MenuProvider):
    def __init__(self):
        pass

    def get_file_items(self, window, files):
        # called when files get selected from the gui
        #pp = pprint.PrettyPrinter(indent=4)
        #x = dir(window.get_window())
        #pp.pprint(x)
        try:
            self._make_known(window)
        except Exception:
            if not files:
                return
            else:
                raise
        
        window.remoteinfo.select([f.get_uri() for f in files])
    
    def get_background_items(self, window, folder):
        if 'x-nautilus-desktop' in folder.get_uri_scheme():
            # doesn't work in Python <2.7 :(
            # directory = subprocess.check_output(['/usr/bin/xdg-user-dir', 'DESKTOP']).strip()
            directory = subprocess.Popen(['/usr/bin/xdg-user-dir', 'DESKTOP'], stdout=subprocess.PIPE).communicate()[0].strip()
        elif 'file' in folder.get_uri_scheme():
            directory = folder.get_location().get_path()
        
        if not self.valid_uri(directory):
            directory = gvfs2posix(directory)
        
        print "background path is %s"%directory
        if hasattr(window, "remoteinfo"):
            window.remoteinfo.updatePath(unicode(directory, "utf-8"))
        else:
            try:
                self._make_known(window)
                window.remoteinfo.updatePath(unicode(directory, "utf-8"))
            except Exception:
                return
    
    def valid_uri(self, uri):
        if not uri.startswith("file://"): return False
        return True
        
    def get_toolbar_items(self, window, file):
        # set up window even before a file is selected
        try:
            self._make_known(window)
        except Exception:
            print "ignoring:", window, type(window).__name__
            pass # hope for another event to fire up when the window is ready or that the window is not so important anyway

    def _make_known(self, window):
        if type(window).__name__ == '__main__.NautilusSpatialWindow':
            raise Exception("Spatial windowows not yet supported") # selection stuff would work, but there is no directory changing in spatial windows
        elif type(window).__name__ != "__main__.NautilusWindow" and type(window).__name__ != "__main__.NautilusDesktopWindow":
            raise Exception("Window is unexpected %r"%type(window))
        
        if window.get_window() is None:
            raise Exception("Window not yet ready (no X id), ignoring")
        
        if not hasattr(window, "remoteinfo"):
            window.remoteinfo = PosixRemoteWindow(window)
            self.window = window
