#! /usr/bin/python

from gi.repository import Gio, GLib
import dbus, dbus.service, dbus.glib
from dbus.mainloop.glib import DBusGMainLoop
import random

SLIDESHOW_DBUS_NAME = "org.Cinnamon.Slideshow"
SLIDESHOW_DBUS_PATH = "/org/Cinnamon/Slideshow"

class CinnamonSlideshow(dbus.service.Object):
    def __init__(self):
        bus_name = dbus.service.BusName(SLIDESHOW_DBUS_NAME, bus=dbus.SessionBus())
        dbus.service.Object.__init__(self, bus_name, SLIDESHOW_DBUS_PATH)

        self.slideshow_settings = Gio.Settings(schema="org.cinnamon.desktop.background.slideshow")
        self.background_settings = Gio.Settings(schema="org.cinnamon.desktop.background")

        self.image_playlist = []
        self.used_image_playlist = []
        self.images_ready = False
        self.update_in_progress = False

        self.update_id = 0

        self.folder_monitor = None
        self.folder_monitor_id = 0

    @dbus.service.method(SLIDESHOW_DBUS_NAME, in_signature='', out_signature='')
    def begin(self):
        self.setup_slideshow()

    @dbus.service.method(SLIDESHOW_DBUS_NAME, in_signature='', out_signature='')
    def end(self):
        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0

        ml.quit()

    def setup_slideshow(self):
        self.load_settings()
        self.connect_signals()
        self.gather_images()
        self.connect_folder_monitor()
        self.start_mainloop()

    def load_settings(self):
        self.delay = self.slideshow_settings.get_int("delay")
        self.random_order = self.slideshow_settings.get_boolean("random-order")
        self.slideshow_folder = self.slideshow_settings.get_string("image-source")

    def connect_signals(self):
        self.slideshow_settings.connect("changed::delay", self.on_delay_changed)
        self.slideshow_settings.connect("changed::image-source", self.on_slideshow_source_changed)
        self.slideshow_settings.connect("changed::random-order", self.on_random_order_changed)

    def connect_folder_monitor(self):
        folder = self.slideshow_folder.replace("~", GLib.get_home_dir())
        folder_path = Gio.file_new_for_path(folder)
        self.folder_monitor = folder_path.monitor_directory(0, None)
        self.folder_monitor_id = self.folder_monitor.connect("changed", self.on_monitored_folder_changed)

    def disconnect_folder_monitor(self):
        if self.folder_monitor_id > 0:
            self.folder_monitor.disconnect(self.folder_monitor_id)
            self.folder_monitor_id = 0

    def gather_images(self):
        folder_path = self.slideshow_folder.replace("~", GLib.get_home_dir())
        folder_at_path = Gio.file_new_for_path(folder_path)

        if folder_at_path.query_exists(None):
            folder_at_path.enumerate_children_async("standard::type,standard::content-type",
                                                    Gio.FileQueryInfoFlags.NONE,
                                                    GLib.PRIORITY_LOW,
                                                    None,
                                                    self.gather_images_cb)


    def gather_images_cb(self, obj, res):
        all_files = []
        enumerator = obj.enumerate_children_finish(res)
        def on_next_file_complete(obj, res, user_data=all_files):
            files = obj.next_files_finish(res)
            file_list = all_files
            if len(files) is not 0:
                file_list = file_list.extend(files)
                enumerator.next_files_async(100, GLib.PRIORITY_LOW, None, on_next_file_complete)
            else:
                enumerator.close(None)
                self.ensure_file_is_image(file_list)

        enumerator.next_files_async(100, GLib.PRIORITY_LOW, None, on_next_file_complete, all_files)

    def ensure_file_is_image(self, file_list):
        for item in file_list:
            file_type = item.get_file_type();
            if file_type is not Gio.FileType.DIRECTORY:
                file_contents = item.get_content_type();
                if file_contents.startswith("image"):
                    self.add_image_to_playlist(self.slideshow_folder + "/" + item.get_name())

    def add_image_to_playlist(self, file_path):
        image = Gio.file_new_for_path(file_path)
        image_uri = image.get_uri();
        self.image_playlist.append(image_uri)
        self.image_playlist.sort()
        self.images_ready = True

    def on_delay_changed(self, settings, key):
        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0
        self.delay = self.slideshow_settings.get_int("delay")
        self.start_mainloop()

    def on_slideshow_source_changed(self, settings, key):
        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0
        self.disconnect_folder_monitor()
        self.image_playlist = []
        self.used_image_playlist = []
        self.images_ready = False
        self.slideshow_folder = self.slideshow_settings.get_string("image-source")
        self.connect_folder_monitor()
        self.gather_images()
        self.start_mainloop()

    def on_monitored_folder_changed(self, monitor, file1, file2, event_type):
        if event_type == Gio.FileMonitorEvent.DELETED:
            file_uri = file1.get_uri();
            if self.image_playlist.count(file_uri) > 0:
                index_to_remove = self.image_playlist.index(file_uri)
                del self.image_playlist[index_to_remove]
            elif self.used_image_playlist.count(file_uri) > 0:
                index_to_remove = self.used_image_playlist.index(file_uri)
                del self.used_image_playlist[index_to_remove]

        if event_type == Gio.FileMonitorEvent.CREATED:
            file_path = file1.get_path()
            file_info = file1.query_info("standard::type,standard::content-type", Gio.FileQueryInfoFlags.NONE, None)
            file_type = file_info.get_file_type()
            if file_type is not Gio.FileType.DIRECTORY:
                file_contents = file_info.get_content_type();
                if file_contents.startswith("image"):
                    self.add_image_to_playlist(file_path)

    def on_random_order_changed(self, settings, key):
        self.random_order = self.slideshow_settings.get_boolean("random-order")

    def start_mainloop(self):
        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0

        if not self.images_ready:
            self.update_id = GLib.timeout_add_seconds(1, self.start_mainloop)
        else:
            self.update_background()
            self.update_id = GLib.timeout_add_seconds(self.delay * 60, self.start_mainloop)

    def update_background(self):
        if self.update_in_progress:
            return

        self.update_in_progress = True

        if len(self.image_playlist) == 0:
            self.move_used_images_to_original_playlist()

        next_image = self.get_next_image_from_list()
        if next_image is not None:
            self.background_settings.set_string("picture-uri", next_image)

        self.update_in_progress = False

    def get_next_image_from_list(self):
        if self.random_order:
            index = random.randint(0, len(self.image_playlist) - 1)
            image = self.image_playlist[index]
        else:
            index = 0
            image = self.image_playlist[index]

        self.move_image_to_used_playlist(index, image)

        return image

    def move_image_to_used_playlist(self, index, image):
        self.image_playlist.pop(index)
        self.used_image_playlist.append(image)

    def move_used_images_to_original_playlist(self):
        self.image_playlist = self.used_image_playlist
        self.image_playlist.sort()
        self.used_image_playlist = []

if __name__ == "__main__":
    DBusGMainLoop(set_as_default=True)

    slideshow = CinnamonSlideshow()
    ml = GLib.MainLoop.new(None, True)
    ml.run()
