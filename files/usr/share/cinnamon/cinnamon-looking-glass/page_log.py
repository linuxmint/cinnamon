#!/usr/bin/python3

import datetime
from gi.repository import Gtk, Pango
import pageutils

class LogEntry:
    def __init__(self, category, time, message):
        self.category = category
        self.time = int(time)
        self.timestr = datetime.datetime.fromtimestamp(self.time).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.message = message
        self.formatted_text = "%s t=%s %s\n" % (category, self.timestr, message)

class LogView(Gtk.ScrolledWindow):
    def __init__(self, proxy):
        Gtk.ScrolledWindow.__init__(self)
        self.proxy = proxy

        self.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        self.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        self.textview = Gtk.TextView()
        self.textview.set_editable(False)
        self.textview.set_left_margin(6)
        self.add(self.textview)

        self.textbuffer = self.textview.get_buffer()
        self.scroll_mark = self.textbuffer.create_mark(None, self.textbuffer.get_end_iter(), False)

        self.log = []
        self.added_messages = 0
        self.first_message_time = None
        self.need_reread = False

        context = self.get_style_context()

        self.enabled_types = {'info': True, 'warning': True, 'error': True, 'trace': False}
        self.type_tags = {
            'info': self.textbuffer.create_tag("info",
                                               invisible=not self.enabled_types["info"],
                                               invisible_set=True),
            'warning': self.textbuffer.create_tag("warning",
                                                  foreground_rgba=context.lookup_color("warning_color")[1],
                                                  invisible=not self.enabled_types["warning"],
                                                  invisible_set=True),
            'error': self.textbuffer.create_tag("error",
                                                foreground_rgba=context.lookup_color("error_color")[1],
                                                invisible=not self.enabled_types["error"],
                                                invisible_set=True),
            'trace': self.textbuffer.create_tag("trace",
                                                weight=Pango.Weight.SEMIBOLD,
                                                invisible=not self.enabled_types["trace"],
                                                invisible_set=True)
        }

        #todo: load all enabled types from gsettings
        #self.enabled_types = {'info': False, 'warning': False, 'error': False, 'trace': False }
        #for key in data:
        #    self.enabled_types[key] = True
        self.proxy.connect("signal::log-update", self.get_updates)
        self.proxy.connect("status-changed", self.on_status_change)

    def append(self, category, time, message):
        entry = LogEntry(category, time, message)
        self.log.append(entry)
        return entry

    def on_button_toggled(self, button, data):
        active = button.get_active()
        self.enabled_types[data] = active
        self.type_tags[data].props.invisible = not active
        self.textbuffer.set_modified(True)

    def on_status_change(self, proxy, online):
        text_iter = self.textbuffer.get_end_iter()
        if online:
            entry = self.append("info",
                                0,
                                "================ DBus connection established ===============")
        else:
            entry = self.append("warning",
                                0,
                                "================ DBus connection lost ===============")
        self.textbuffer.insert_with_tags(text_iter,
                                         entry.formatted_text,
                                         self.type_tags[entry.category])

        self.need_reread = True
        self.get_updates()

    def get_updates(self, proxy=None):
        self.proxy.GetErrorStack(result_cb=self.get_error_stack_finished)

    def get_error_stack_finished(self, proxy, result, user_data=None):
        [success, data] = result

        if success:
            try:
                data_size = len(data)
                if data_size > 0:
                    # If this is a completely new log, start reading at the beginning
                    first_message_time = data[0]["timestamp"]
                    if (self.added_messages > data_size or
                            self.first_message_time != first_message_time or
                            self.need_reread):
                        self.first_message_time = first_message_time
                        self.added_messages = 0

                    if self.need_reread:
                        start, end = self.textbuffer.get_bounds()
                        self.textbuffer.delete(start, end)

                    self.need_reread = False

                    text_iter = self.textbuffer.get_end_iter()
                    for item in data[self.added_messages:]:
                        entry = self.append(item["category"],
                                            float(item["timestamp"]) * 0.001,
                                            item["message"])
                        self.textbuffer.insert_with_tags(text_iter,
                                                         entry.formatted_text,
                                                         self.type_tags[entry.category])
                        self.added_messages += 1
                    self.textview.scroll_to_mark(self.scroll_mark, 0, True, 1, 1)
            except Exception as exc:
                print(exc)

class ModulePage(pageutils.WindowAndActionBars):
    def __init__(self, parent):
        self.view = LogView(parent.lg_proxy)
        pageutils.WindowAndActionBars.__init__(self, self.view)
        self.parent = parent

        self.add_toggle_button("info",
                               "dialog-information-symbolic",
                               "Show/Hide Messages tagged as 'info'")
        self.add_toggle_button("warning",
                               "dialog-warning-symbolic",
                               "Show/Hide Messages tagged as 'warning'")
        self.add_toggle_button("error",
                               "dialog-error-symbolic",
                               "Show/Hide Messages tagged as 'error'")
        self.add_toggle_button("trace",
                               "dialog-question-symbolic",
                               "Show/Hide Messages tagged as 'trace'")

    def add_toggle_button(self, log_type, icon, tooltip):
        button = pageutils.ImageToggleButton(icon)
        button.connect("toggled", self.view.on_button_toggled, log_type)
        button.set_active(self.view.enabled_types[log_type])
        button.set_tooltip_text(tooltip)
        self.add_to_left_bar(button, 1)
