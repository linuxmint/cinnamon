#!/usr/bin/python3

import os
import sys
import signal
signal.signal(signal.SIGINT, signal.SIG_DFL)
import _thread
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
from gi.repository import Gdk, Gtk, GObject, GLib, Pango, GdkPixbuf, Gio

import time
from datetime import timedelta

class Main:
    def __init__(self):
        if len(sys.argv) > 1 and sys.argv[1] == "--help":
            self.end()
        else:
            self.start()

    def end(self):
        print("""
              git-monkey: a simple repo manager for debian-based projects.

              Run git-monkey, then click the + to add git repos to work with.

              """)
        quit()

    def start(self):
        self.builder = Gtk.Builder()
        self.builder.add_from_file("cinnamon-stap-monitor.glade")
        self.treebox = self.builder.get_object("treebox")
        self.window = self.builder.get_object("window")
        self.term_button = self.builder.get_object("terminal")
        self.output_scroller = self.builder.get_object("scroller")
        self.output = self.builder.get_object("output_view")
        self.timer_label = self.builder.get_object("timer_label")

        self.builder.connect_signals(self)

        self.treeview = Gtk.TreeView()
        self.model = Gtk.ListStore(str, int, int)

        color = Gdk.RGBA()
        Gdk.RGBA.parse(color, "black")
        self.output.override_background_color(Gtk.StateFlags.NORMAL, color)
        Gdk.RGBA.parse(color, "#00CC00")

        fontdesc = Pango.FontDescription("monospace")
        self.output.override_font(fontdesc)
        self.output.override_color(Gtk.StateFlags.NORMAL, color)

        self.window.connect("destroy", Gtk.main_quit)

        cell = Gtk.CellRendererText()
        column = Gtk.TreeViewColumn("GObject Name", cell, text=0)
        column.set_sort_column_id(0)
        self.treeview.append_column(column)

        cell = Gtk.CellRendererText()
        column = Gtk.TreeViewColumn("Instance count", cell, text=1)
        column.set_sort_column_id(1)

        self.treeview.append_column(column)

        cell = Gtk.CellRendererText()
        column = Gtk.TreeViewColumn("Rate", cell, text=2)
        column.set_sort_column_id(2)

        self.treeview.append_column(column)

        self.treeview.set_model(self.model)

        self.treebox.add(self.treeview)
        # self.treeview.get_selection().connect("changed", lambda x: self.selection_changed())
        # self.treeview.connect('button_press_event', self.on_button_press_event)

        self.start_stdin_feed()

        self.window.show_all()

        GObject.timeout_add_seconds(1, self.update_timer_label)

    # def on_button_press_event(self, widget, event):
    #     if event.button == 1:
    #         data=widget.get_path_at_pos(int(event.x),int(event.y))
    #         if data:
    #             path, column, x, y = data
    #             if column.get_property('title')=="Abort":
    #                 iter = self.model.get_iter(path)
    #                 repo = self.model.get_value(iter, 0)
    #                 self.job_manager.find_and_abort(repo)
    #             elif event.type == Gdk.EventType._2BUTTON_PRESS:
    #                 iter = self.model.get_iter(path)
    #                 repo = self.model.get_value(iter, 0)
    #                 if len(repo.state) == 0:
    #                     repoedit.EditRepo(repo.dir, repo.upstream_remote, repo.upstream_branch, repo.push_remote)

    def reset_timer(self):
        self.start_time = time.time()

    def update_timer_label(self):
        now = time.time()

        elapsed = now - self.start_time

        string = str(timedelta(seconds=int(elapsed + .5)))

        self.timer_label.set_text("Elapsed time: %s" % string)

        return True

    def start_stdin_feed(self):
        self.reset_timer()
        self.cancel_lock = _thread.allocate_lock()
        self.cancelled = False
        self.thread = _thread.start_new_thread(self.stdin_feed_thread, ())

    def stdin_feed_thread(self):
        for line in sys.stdin:
            GObject.idle_add(self.handle_line, line)
            self.cancel_lock.acquire()
            cancelled = self.cancelled
            self.cancel_lock.release()
            if cancelled:
                break

        _thread.exit()

    def handle_line(self, line):
        if line[:7] == "GObject":
            [prefix, name, delta] = line.split(":::")

            [new, target_iter] = self.lookup_name_or_new(name)

            if new:
                self.model.set_value(target_iter, 0, name)
                self.model.set_value(target_iter, 1, int(delta))
                self.model.set_value(target_iter, 2, int(delta))
            else:
                current_val = self.model.get_value(target_iter, 1)
                current_val = int(current_val) + int(delta)
                self.model.set_value(target_iter, 1, current_val)
                self.model.set_value(target_iter, 2, int(delta))

        else:
            self.write_line_to_buffer(line)

    def lookup_name_or_new(self, name):
        row_iter = self.model.get_iter_first()

        while row_iter != None:
            existing_name = self.model.get_value(row_iter, 0)
            if name == existing_name:
                return [False, row_iter]

            row_iter = self.model.iter_next(row_iter)

        return [True, self.model.insert_before(None, None)]


    # def selection_changed(self):
    #     model, treeiter = self.treeview.get_selection().get_selected()
    #     if treeiter:
    #         repo = self.model.get_value(treeiter, 0)
    #         self.current_repo = repo
    #         self.update_branch_combo(repo)
    #         self.clean_button.set_sensitive(len(repo.untracked_files) != 0)
    #         self.reset_button.set_sensitive(repo.is_dirty())
    #         self.term_button.set_sensitive(True)
    #         self.full_build_button.set_sensitive(True)
    #         self.new_branch.set_sensitive(True)
    #         self.rebase_button.set_sensitive(True)
    #         self.pull_request_button.set_sensitive(True)
    #         no_active = len(repo.state) == 0
    #         self.branch_combo.set_sensitive(no_active)
    #         self.remove_repo_button.set_sensitive(no_active)
    #         self.refresh_button.set_sensitive(no_active)
    #         self.add_repo_button.set_sensitive(no_active)
    #         self.master_button.set_sensitive(no_active and repo.head.reference.name != repo.upstream_branch)

    def on_terminal_clicked(self, button):
        subprocess.Popen("gnome-terminal", cwd=self.current_repo.dir, shell=True)

    def on_reset_clicked(self, button):
        self.model.clear()
        self.reset_timer()

    def write_to_buffer(self, fd, condition):
        if condition == GLib.IO_IN:
            char = fd.readline()
            buf = self.output.get_buffer()
            iter = buf.get_end_iter()
            buf.insert(iter, char)
            iter = buf.get_end_iter()
            self.output.scroll_to_iter(iter, .2, False, 0, 0)
            # adj = self.output.get_vadjustment()
            # if adj.get_value() >= adj.get_upper() - adj.get_page_size() - 200.0:
            # adj.set_value(adj.get_upper())
            return True
        else:
            return False

    def write_line_to_buffer(self, string):
        buf = self.output.get_buffer()
        iter = buf.get_end_iter()
        buf.insert(iter, string)
        iter = buf.get_end_iter()
        self.output.scroll_to_iter(iter, .2, False, 0, 0)

    def ask(self, msg):
        dialog = Gtk.MessageDialog(None,
                                   Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                   Gtk.MessageType.QUESTION,
                                   Gtk.ButtonsType.YES_NO,
                                   None)
        dialog.set_default_size(400, 200)
        dialog.set_markup(msg)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()
        return response == Gtk.ResponseType.YES

    def inform_error(self, msg, detail):
        dialog = Gtk.MessageDialog(None,
                                   Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                   Gtk.MessageType.ERROR,
                                   Gtk.ButtonsType.OK,
                                   None)
        dialog.set_default_size(400, 200)
        dialog.set_markup(msg)
        dialog.format_secondary_markup(detail)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()
        return

    def inform(self, msg, detail):
        dialog = Gtk.MessageDialog(None,
                                   Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                   Gtk.MessageType.INFO,
                                   Gtk.ButtonsType.OK,
                                   None)
        dialog.set_default_size(400, 200)
        dialog.set_markup(msg)
        dialog.format_secondary_markup(detail)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()
        return

if __name__ == "__main__":
    Main()
    Gtk.main()