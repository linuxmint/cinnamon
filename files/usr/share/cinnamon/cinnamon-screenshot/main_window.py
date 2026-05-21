import os

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('XApp', '1.0')
from gi.repository import Gdk, Gio, GLib, Gtk, XApp

import prefs
import util


DELAY_VALUES = (0, 2, 5, 10)

PKGDATADIR = '/usr/share/cinnamon/cinnamon-screenshot'
ICON_DIR = os.path.join(PKGDATADIR, 'icons')

Gtk.IconTheme.get_default().append_search_path(ICON_DIR)


class _CropState:
    def __init__(self):
        self.start = None
        self.current = None
        self.dragging = False


class MainWindow:
    def __init__(self, app):
        self.app = app
        self.builder = Gtk.Builder.new_from_file(os.path.join(PKGDATADIR, 'main-window.ui'))
        self.window = self.builder.get_object('window')
        self.window.set_application(app)

        self.mode_screen = self.builder.get_object('mode_screen')
        self.mode_monitor = self.builder.get_object('mode_monitor')
        self.mode_window = self.builder.get_object('mode_window')
        self.mode_area = self.builder.get_object('mode_area')
        self.options_button = self.builder.get_object('options_button')
        self.pointer_switch = self.builder.get_object('pointer_switch')
        self.shadow_switch = self.builder.get_object('shadow_switch')
        self.delay_radios = {v: self.builder.get_object(f'delay_{v}') for v in DELAY_VALUES}
        self.delay_label = self.builder.get_object('delay_label')
        self.take_button = self.builder.get_object('take_button')

        self.preview_stack = self.builder.get_object('preview_stack')
        self.preview_area = self.builder.get_object('preview_area')

        self.crop_button = self.builder.get_object('crop_button')
        self.undo_button = self.builder.get_object('undo_button')
        self.copy_button = self.builder.get_object('copy_button')
        self.save_button = self.builder.get_object('save_button')

        self.service_infobar = self.builder.get_object('service_infobar')

        # Widgets that only work when the cinnamon screenshot service is
        # owned. The X11 fallback can't pick specific windows or arbitrary
        # regions, and can't overlay the cursor or apply window shadows.
        self.service_widgets = XApp.VisibilityGroup.new(True, True, [
            self.mode_window,
            self.mode_area,
            self.pointer_switch,
            self.shadow_switch,
        ])

        self._pixbuf = None
        self._undo_stack = []
        self._suggested_path = None
        self._crop = _CropState()
        self._render_rect = (0, 0, 0, 0, 1.0)
        self._capture_timeout_id = 0
        self._saved = False

        self.window.connect('destroy', self._on_window_destroy)

        self._init_options()
        self._init_preview()
        self._init_actions()
        self._init_service_monitor()
        self._update_action_sensitivity()

    def run(self):
        if self.app.args.interactive:
            self.window.show_all()
        else:
            self._capture(initial=True)

    # ------------------------------------------------------------------
    # init
    # ------------------------------------------------------------------

    def _init_options(self):
        self.mode_monitor.set_sensitive(Gdk.Display.get_default().get_n_monitors() > 1)

        args = self.app.args
        saved_delay = prefs.get_delay()
        if saved_delay in self.delay_radios:
            self.delay_radios[saved_delay].set_active(True)
        prefs.settings.bind(prefs.INCLUDE_POINTER_KEY, self.pointer_switch, 'active',
                            Gio.SettingsBindFlags.DEFAULT)
        prefs.settings.bind(prefs.INCLUDE_SHADOW_KEY, self.shadow_switch, 'active',
                            Gio.SettingsBindFlags.DEFAULT)
        if args.window:
            self.mode_window.set_active(True)
        elif args.area:
            self.mode_area.set_active(True)
        elif args.monitor is not None and self.mode_monitor.get_sensitive():
            self.mode_monitor.set_active(True)

        for radio in self.delay_radios.values():
            radio.connect('toggled', self._on_delay_toggled)
        self.take_button.connect('clicked', self._on_take_clicked)
        self._on_delay_toggled(None)

    def _init_preview(self):
        self.preview_area.add_events(
            Gdk.EventMask.BUTTON_PRESS_MASK
            | Gdk.EventMask.BUTTON_RELEASE_MASK
            | Gdk.EventMask.POINTER_MOTION_MASK
        )
        self.preview_area.connect('realize', self._on_preview_realize)
        self.preview_area.connect('draw', self._on_draw)
        self.preview_area.connect('button-press-event', self._on_press)
        self.preview_area.connect('motion-notify-event', self._on_motion)
        self.preview_area.connect('button-release-event', self._on_release)

        self.crop_button.connect('clicked', self._on_crop)
        self.undo_button.connect('clicked', self._on_undo)
        self.copy_button.connect('clicked', self._on_copy)

        accel = Gtk.AccelGroup()
        accel.connect(Gdk.KEY_z, Gdk.ModifierType.CONTROL_MASK,
                      Gtk.AccelFlags.VISIBLE,
                      lambda *_: self._on_undo(None) or True)
        accel.connect(Gdk.KEY_Escape, 0, Gtk.AccelFlags.VISIBLE,
                      lambda *_: self._on_cancel(None) or True)
        self.window.add_accel_group(accel)

    def _on_preview_realize(self, widget):
        widget.get_window().set_cursor(
            Gdk.Cursor.new_for_display(
                Gdk.Display.get_default(), Gdk.CursorType.CROSSHAIR))

    def _init_service_monitor(self):
        self.app.backend.connect('online-changed', self._on_service_online_changed)
        self._update_service_state(self.app.backend.is_available())

    def _on_service_online_changed(self, _backend, online):
        self._update_service_state(online)

    def _update_service_state(self, online):
        self.service_infobar.set_revealed(not online)
        self.mode_monitor.set_sensitive(Gdk.Display.get_default().get_n_monitors() > 1)
        self.service_widgets.set_sensitive(online)
        if not online and (self.mode_window.get_active() or self.mode_area.get_active()):
            self.mode_screen.set_active(True)

    def _init_actions(self):
        self.save_button.connect('clicked', self._on_save)
        self.builder.get_object('cancel_button').connect('clicked', self._on_cancel)

        menu = Gtk.Menu()
        open_folder_item = Gtk.MenuItem(label=_('Open save folder'))
        open_folder_item.connect('activate', self._on_open_save_folder)
        menu.append(open_folder_item)
        menu.append(Gtk.SeparatorMenuItem())
        prefs_item = Gtk.MenuItem(label=_('Preferences'))
        prefs_item.connect('activate', self._on_preferences)
        menu.append(prefs_item)
        menu.append(Gtk.SeparatorMenuItem())
        about_item = Gtk.MenuItem(label=_('About Cinnamon Screenshot'))
        about_item.connect('activate', self._on_about)
        menu.append(about_item)
        menu.show_all()
        self.builder.get_object('menu_button').set_popup(menu)

    # ------------------------------------------------------------------
    # mode handling and capture
    # ------------------------------------------------------------------

    def _on_delay_toggled(self, radio):
        delay = self._selected_delay()
        self.delay_label.set_label(f'{delay}s')
        if radio is not None and radio.get_active():
            prefs.set_delay(delay)

    def _selected_delay(self):
        for v, radio in self.delay_radios.items():
            if radio.get_active():
                return v
        return 0

    def _on_take_clicked(self, _b):
        self._capture()

    def _capture(self, initial=False):
        if self.mode_window.get_active():
            mode = 'window'
        elif self.mode_area.get_active():
            mode = 'area'
        elif self.mode_monitor.get_active():
            mode = 'monitor'
        else:
            mode = 'screen'

        if initial:
            args = self.app.args
            delay = args.delay if args.delay is not None else 0
            include_pointer = args.include_pointer
            include_shadow = args.include_shadow
        else:
            delay = self._selected_delay()
            include_pointer = self.pointer_switch.get_active()
            include_shadow = self.shadow_switch.get_active()

        area_rect = None
        if mode == 'monitor':
            if initial and self.app.args.monitor is not None:
                area_rect = util.monitor_rect(self.app.args.monitor)
            else:
                area_rect = util.monitor_rect_for_window(self.window.get_window())
            if area_rect is None:
                mode = 'screen'

        def done(pixbuf):
            self._set_preview(pixbuf)
            self.window.show_all()

        def start_capture():
            self._capture_timeout_id = 0
            self.app.capture(mode, include_pointer, include_shadow, delay, done, area_rect=area_rect)
            return GLib.SOURCE_REMOVE

        if self.window.get_visible():
            self.window.hide()
            self._capture_timeout_id = GLib.timeout_add(200, start_capture)
        else:
            start_capture()

    def _set_preview(self, pixbuf):
        if pixbuf is None:
            self._update_action_sensitivity()
            return
        self._pixbuf = pixbuf
        self._undo_stack.clear()
        self._crop.start = None
        self._crop.current = None
        self._crop.dragging = False
        self._suggested_path = util.build_filename(
            prefs.get_save_directory(),
            file_type=prefs.get_default_file_type(),
        )
        self._update_action_sensitivity()
        self.preview_area.queue_draw()

    def _update_action_sensitivity(self):
        has_preview = self._pixbuf is not None
        has_selection = self._current_selection_widget_coords() is not None
        self.preview_stack.set_visible_child_name('preview' if has_preview else 'placeholder')
        self.crop_button.set_sensitive(has_preview and has_selection)
        self.copy_button.set_sensitive(has_preview)
        self.save_button.set_sensitive(has_preview)
        self.undo_button.set_sensitive(has_preview and bool(self._undo_stack))

    # ------------------------------------------------------------------
    # preview rendering
    # ------------------------------------------------------------------

    def _on_draw(self, widget, cr):
        if self._pixbuf is None:
            return False
        alloc = widget.get_allocation()
        pw, ph = self._pixbuf.get_width(), self._pixbuf.get_height()
        if pw == 0 or ph == 0:
            return False

        scale = min(alloc.width / pw, alloc.height / ph, 1.0)
        rw, rh = pw * scale, ph * scale
        rx = (alloc.width - rw) / 2
        ry = (alloc.height - rh) / 2
        self._render_rect = (rx, ry, rw, rh, scale)

        cr.save()
        cr.translate(rx, ry)
        cr.scale(scale, scale)
        Gdk.cairo_set_source_pixbuf(cr, self._pixbuf, 0, 0)
        cr.paint()
        cr.restore()

        self._draw_crop_overlay(cr, alloc)

        return False

    def _draw_crop_overlay(self, cr, alloc):
        sel = self._current_selection_widget_coords()
        if sel is None:
            return
        sx, sy, sw, sh = sel
        cr.save()
        cr.set_line_width(1.0)
        cr.rectangle(sx + 0.5, sy + 0.5, sw, sh)
        cr.set_source_rgb(1.0, 1.0, 1.0)
        cr.stroke_preserve()
        cr.set_source_rgb(0.0, 0.0, 0.0)
        cr.set_dash([4.0, 4.0])
        cr.stroke()
        cr.restore()

    def _current_selection_widget_coords(self):
        if self._crop.start is None or self._crop.current is None:
            return None
        x1, y1 = self._crop.start
        x2, y2 = self._crop.current
        w = abs(x2 - x1)
        h = abs(y2 - y1)
        if w < 1 or h < 1:
            return None
        return (min(x1, x2), min(y1, y2), w, h)

    # ------------------------------------------------------------------
    # crop interaction
    # ------------------------------------------------------------------

    def _on_press(self, _w, event):
        if self._pixbuf is None or event.button != 1:
            return False
        self._crop.start = (event.x, event.y)
        self._crop.current = (event.x, event.y)
        self._crop.dragging = True
        self.preview_area.queue_draw()
        self._update_action_sensitivity()
        return True

    def _on_motion(self, _w, event):
        if not self._crop.dragging:
            return False
        self._crop.current = (event.x, event.y)
        self.preview_area.queue_draw()
        return True

    def _on_release(self, _w, event):
        if not self._crop.dragging or event.button != 1:
            return False
        self._crop.current = (event.x, event.y)
        self._crop.dragging = False
        self.preview_area.queue_draw()
        self._update_action_sensitivity()
        return True

    def _on_crop(self, _button):
        sel = self._current_selection_widget_coords()
        if self._pixbuf is None or sel is None:
            return
        sx, sy, sw, sh = sel
        rx, ry, _rw, _rh, scale = self._render_rect
        if scale <= 0:
            return
        self._crop.start = None
        self._crop.current = None

        pw = self._pixbuf.get_width()
        ph = self._pixbuf.get_height()
        x = max(0, min(int((sx - rx) / scale), pw))
        y = max(0, min(int((sy - ry) / scale), ph))
        w = max(1, min(int(sw / scale), pw - x))
        h = max(1, min(int(sh / scale), ph - y))

        self._undo_stack.append(self._pixbuf)
        self._pixbuf = self._pixbuf.new_subpixbuf(x, y, w, h).copy()
        self._update_action_sensitivity()
        self.preview_area.queue_draw()

    def _on_undo(self, _button):
        if not self._undo_stack:
            return
        self._pixbuf = self._undo_stack.pop()
        self._update_action_sensitivity()
        self.preview_area.queue_draw()

    # ------------------------------------------------------------------
    # action buttons
    # ------------------------------------------------------------------

    def _on_cancel(self, _b):
        self.window.destroy()
        self.app.quit()

    def _on_window_destroy(self, _w):
        if self._capture_timeout_id != 0:
            GLib.source_remove(self._capture_timeout_id)
            self._capture_timeout_id = 0
        # When the caller (e.g. xdg-desktop-portal) pinned a destination
        # via --file, exit non-zero if the user closed the window without
        # saving so the caller can distinguish a save from a cancel.
        if self.app.args.file and not self._saved:
            self.app._exit_code = 1

    def _on_copy(self, _b):
        if self._pixbuf is None:
            return
        util.copy_pixbuf_to_clipboard(self._pixbuf)

    def _on_save(self, _b):
        if self._pixbuf is None:
            return

        # When --file is given alongside --interactive, the caller has
        # pre-chosen the destination (e.g. xdg-desktop-portal); skip the
        # chooser and save straight to that path.
        if self.app.args.file:
            path = self.app.args.file
        else:
            dialog = Gtk.FileChooserNative.new(
                _('Save Screenshot'),
                self.window,
                Gtk.FileChooserAction.SAVE,
                _('Save'),
                _('Cancel'),
            )
            dialog.set_do_overwrite_confirmation(True)
            dialog.set_current_name(os.path.basename(self._suggested_path))
            suggested_dir = os.path.dirname(self._suggested_path)
            if suggested_dir and os.path.isdir(suggested_dir):
                dialog.set_current_folder(suggested_dir)

            response = dialog.run()
            path = dialog.get_filename() if response == Gtk.ResponseType.ACCEPT else None
            dialog.destroy()
            if not path:
                return

        try:
            util.save_pixbuf(self._pixbuf, path)
        except Exception as exc:
            err = Gtk.MessageDialog(
                transient_for=self.window,
                modal=True,
                message_type=Gtk.MessageType.ERROR,
                buttons=Gtk.ButtonsType.CLOSE,
                text=_('Failed to save screenshot'),
                secondary_text=str(exc),
            )
            err.run()
            err.destroy()
            return

        self._saved = True

        # When --file is set the destination wasn't user-chosen (portal use),
        # so the post-save file-manager reveal would be confusing.
        if prefs.get_launch_file_manager() and not self.app.args.file:
            util.show_in_file_manager(Gio.File.new_for_path(path).get_uri())

        self.window.destroy()
        self.app.quit()

    def _on_open_save_folder(self, _item):
        uri = prefs.get_save_directory_uri()
        if not uri:
            uri = Gio.File.new_for_path(prefs.get_save_directory()).get_uri()
        util.show_in_file_manager(uri)

    def _on_preferences(self, _item):
        prefs.open_preferences(self.window)

    def _on_about(self, _item):
        about = Gtk.AboutDialog(transient_for=self.window, modal=True)
        about.set_program_name('Cinnamon Screenshot')
        about.set_comments(_('Screenshot tool'))
        about.set_copyright('2026 Linux Mint')
        about.set_license_type(Gtk.License.GPL_3_0)
        about.set_website('https://github.com/linuxmint/cinnamon')
        about.set_logo_icon_name('applets-screenshooter')
        about.run()
        about.destroy()
