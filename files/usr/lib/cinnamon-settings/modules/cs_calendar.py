#!/usr/bin/env python

import os
from SettingsWidgets import *
import dbus
from gi.repository import Gio, Gtk, GObject, Gdk

class Module:
    def __init__(self, content_box):
        keywords = _("time, date, calendar, format, network, sync")
        advanced = False
        sidePage = SidePage(_("Date & Time"), "date-time.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "calendar"
        self.category = "prefs"        
        
        try:
            self.changeTimeWidget = ChangeTimeWidget()  
            self.ntpCheckButton = None 
            try:
                self.ntpCheckButton = NtpCheckButton(_("Use network time"))
                sidePage.add_widget(self.ntpCheckButton)
            except Exception, detail:
                print detail
            sidePage.add_widget(self.changeTimeWidget)
            try:
                sidePage.add_widget(TimeZoneSelectorWidget())
            except Exception, detail:
                print detail
            
            if self.ntpCheckButton != None:
                self.ntpCheckButton.connect('toggled', self._ntp_toggled)
                self.changeTimeWidget.change_using_ntp( self.ntpCheckButton.get_active() )
        except Exception, detail:
            print detail

    def _ntp_toggled(self, widget):
        self.changeTimeWidget.change_using_ntp( self.ntpCheckButton.get_active() )

# wrapper for timedated or gnome-settings-daemons DateTimeMechanism
class DateTimeWrapper:
    def __init__(self):
        try:
            proxy = dbus.SystemBus().get_object("org.freedesktop.timedate1", "/org/freedesktop/timedate1")
            self.dbus_iface = dbus.Interface(proxy, dbus_interface="org.freedesktop.timedate1")
            self.properties_iface = dbus.Interface(proxy, dbus_interface=dbus.PROPERTIES_IFACE)
            self.timedated = True
        except dbus.exceptions.DBusException:
            proxy = dbus.SystemBus().get_object("org.cinnamon.SettingsDaemon.DateTimeMechanism", "/")
            self.dbus_iface = dbus.Interface(proxy, dbus_interface="org.cinnamon.SettingsDaemon.DateTimeMechanism")
            self.timedated = False

    def set_time(self, seconds_since_epoch):
        if self.timedated:
            # timedated expects microseconds
            return self.dbus_iface.SetTime(seconds_since_epoch * 1000000, False, True)
        else:
            return self.dbus_iface.SetTime(seconds_since_epoch)

    def get_timezone(self):
        if self.timedated:
            return self.properties_iface.Get("org.freedesktop.timedate1", "Timezone")
        else:
            return self.dbus_iface.GetTimezone()

    def set_timezone(self, tz):
        if self.timedated:
            return self.dbus_iface.SetTimezone(tz, True)
        else:
            return self.dbus_iface.SetTimezone(tz)

    def get_using_ntp(self):
        if self.timedated:
            return self.properties_iface.Get("org.freedesktop.timedate1", "NTP")
        else:
            return self.dbus_iface.GetUsingNtp()

    def set_using_ntp(self, usingNtp):
        if self.timedated:
            return self.dbus_iface.SetNTP(usingNtp, True)
        else:
            return self.dbus_iface.SetUsingNtp(usingNtp)

class TimeZoneSelectorWidget(Gtk.HBox):
    def __init__(self):
        super(TimeZoneSelectorWidget, self).__init__()
        
        self.date_time_wrapper = DateTimeWrapper()
        
        self.timezones = load_db()
        
        self.selected_region, self.selected_city = self.get_selected_zone()
        
        region_label = Gtk.Label(_("Region"))
        self.pack_start(region_label, False, False, 2)
        
        regions = self.timezones.keys()
        regions.sort()
        self.region_model = Gtk.ListStore(str, str)
        selected_region_iter = None
        for region in regions:
            iter = self.region_model.insert_before(None, None)
            self.region_model.set_value(iter, 0, region)                
            self.region_model.set_value(iter, 1, region.replace("_", " "))                        
            if (region == self.selected_region):
                selected_region_iter = iter
                                
        self.region_widget = Gtk.ComboBox.new_with_model(self.region_model)   
        renderer_text = Gtk.CellRendererText()
        self.region_widget.pack_start(renderer_text, True)
        self.region_widget.add_attribute(renderer_text, "text", 1)
        if selected_region_iter is not None:
            self.region_widget.set_active_iter(selected_region_iter)
        self.pack_start(self.region_widget, False, False, 2)
        
        city_label = Gtk.Label(_("City"))
        self.pack_start(city_label, False, False, 2)
        
        self.city_model = Gtk.ListStore(str, str)
        self.city_widget = Gtk.ComboBox.new_with_model(self.city_model)   
        renderer_text = Gtk.CellRendererText()
        self.city_widget.pack_start(renderer_text, True)
        self.city_widget.add_attribute(renderer_text, "text", 1)
        self.pack_start(self.city_widget, False, False, 2)
        
        self.update_cities_list()
        
        self.region_widget.connect("changed", self.on_region_changed)
        self.city_widget.connect("changed", self.on_city_changed)
    def on_city_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            self.selected_city = self.city_model[tree_iter][0]
            self.date_time_wrapper.set_timezone(self.selected_region+"/"+self.selected_city)
    def on_region_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:            
            self.selected_region = self.region_model[tree_iter][0]
            self.update_cities_list()
    def update_cities_list(self):
        self.city_model.clear()
        if self.selected_region and self.selected_region in self.timezones.keys():
            cities = self.timezones[self.selected_region]
            cities.sort()
            selected_city_iter = None
            for city in cities:
                iter = self.city_model.insert_before(None, None)
                self.city_model.set_value(iter, 0, city)                
                self.city_model.set_value(iter, 1, city.replace("_", " "))                        
                if (city == self.selected_city):
                    selected_city_iter = iter
            if selected_city_iter is not None:
                self.city_widget.set_active_iter(selected_city_iter)
    def get_selected_zone(self):
        tz = self.date_time_wrapper.get_timezone()
        if "/" in tz:
            i = tz.index("/")
            region = tz[:i]
            city = tz[i+1:]
            return region, city
        else:
            return "", ""
            
class ChangeTimeWidget(Gtk.HBox):
    def __init__(self):
        super(ChangeTimeWidget, self).__init__()
        self.date_time_wrapper = DateTimeWrapper()
        
        # Ensures we are setting the system time only when the user changes it
        self.changedOnTimeout = False
        
        # Ensures we do not update the values in the date/time fields during the DBus call to set the time
        self._setting_time = False
        self._setting_time_lock = thread.allocate()
        self._time_to_set = None
        
        self.thirtyDays = [3, 5, 8, 10]
        months = [_("January"),_("February"),_("March"),_("April"),_("May"),_("June"),_("July"),_("August"),_("September"),_("October"),_("November"),_("December")]
        
        # Boxes
        timeBox = Gtk.HBox()
        dateBox = Gtk.HBox()
        
        # Combo Boxes
        self.monthBox = Gtk.ComboBoxText()
        
        for month in months:
            self.monthBox.append_text(month)
        
        # Adjustments
        hourAdj = Gtk.Adjustment(0, 0, 23, 1, 1)
        minAdj = Gtk.Adjustment(0, 0, 59, 1, 1)
        yearAdj = Gtk.Adjustment(0, 0, 9999, 1, 5)
        dayAdj = Gtk.Adjustment(0, 1, 31, 1, 1)
        
        # Spin buttons
        self.hourSpin = Gtk.SpinButton()
        self.minSpin = Gtk.SpinButton()
        self.yearSpin = Gtk.SpinButton()
        self.daySpin = Gtk.SpinButton()
        
        self.hourSpin.configure(hourAdj, 0.5, 0)
        self.minSpin.configure(minAdj, 0.5, 0)
        self.yearSpin.configure(yearAdj, 0.5, 0)
        self.daySpin.configure(dayAdj, 0.5, 0)
        #self.hourSpin.set_editable(False)
        #self.minSpin.set_editable(False)
        #self.yearSpin.set_editable(False)
        #self.daySpin.set_editable(False)
        
        self.update_time()
        GObject.timeout_add(1000, self.update_time)
        
        # Connect to callback
        self.hourSpin.connect('changed', self._change_system_time)
        self.minSpin.connect('changed', self._change_system_time)
        self.monthBox.connect('changed', self._change_system_time)
        self.yearSpin.connect('changed', self._change_system_time)
        self.daySpin.connect('changed', self._change_system_time)
        
        timeBox.pack_start(self.hourSpin, False, False, 2)
        timeBox.pack_start(Gtk.Label(_(":")), False, False, 2)
        timeBox.pack_start(self.minSpin, False, False, 2)
        
        dateBox.pack_start(self.monthBox, False, False, 2)
        dateBox.pack_start(self.daySpin, False, False, 2)
        dateBox.pack_start(self.yearSpin, False, False, 2)
        
        self.pack_start(Gtk.Label(_("Date : ")), False, False, 2)
        self.pack_start(dateBox, True, True, 2)
        self.pack_start(Gtk.Label(_("Time : ")), False, False, 2)
        self.pack_start(timeBox, True, True, 2)
        
    def update_time(self):
        self._setting_time_lock.acquire()
        do_update = not self._setting_time
        self._setting_time_lock.release()
        
        if not do_update:
            return True
        
        dt = datetime.now()
        
        self.changedOnTimeout = True
        
        # Time
        self.hourSpin.set_value( dt.hour )
        self.minSpin.set_value( dt.minute )
        
        # Date
        self.monthBox.set_active( dt.month-1 )
        self.daySpin.set_value( dt.day )
        self.yearSpin.set_value( dt.year )
        
        self.changedOnTimeout = False
        
        # Update the max of the day spin box
        maxDay = 31
        if dt.month == 2:
            if dt.year % 4 == 0:
                maxDay = 29
            else:
                maxDay = 28
        elif dt.month-1 in self.thirtyDays:
            maxDay = 30
            
        self.daySpin.get_adjustment().set_upper(maxDay)
        
        return True
        
    def change_using_ntp(self, usingNtp):
        # Check if we were using Ntp by seeing if the spin button
        # is sensitive
        self.set_sensitive(not usingNtp)
    
    def _do_change_system_time(self):
        self._setting_time_lock.acquire()
        do_set = not self._setting_time
        self._setting_time = True
        self._setting_time_lock.release()
        
        # If there is already another thread updating the time, we let it do the job
        if not do_set:
            return
        
        done = False
        while not done:
            self._setting_time_lock.acquire()
            time_to_set = self._time_to_set
            self._time_to_set = None
            self._setting_time_lock.release()
            
            self.date_time_wrapper.set_time(time_to_set)
            
            # Check whether another request to set the time was done since this thread started
            self._setting_time_lock.acquire()
            if self._time_to_set==None:
                done = True
            self._setting_time_lock.release()
        
        self._setting_time_lock.acquire()
        self._setting_time = False
        self._setting_time_lock.release()
                
    def _change_system_time(self, widget):
        if not self.changedOnTimeout:
            hour = int( self.hourSpin.get_value() )
            minute = int( self.minSpin.get_value() )
            month = self.monthBox.get_active() + 1
            day = int( self.daySpin.get_value() )
            year = int( self.yearSpin.get_value() )
            
            newDt = datetime(year, month, day, hour, minute)
            
            self._setting_time_lock.acquire()
            self._time_to_set = time.mktime(newDt.utctimetuple())
            self._setting_time_lock.release()
            
            thread.start_new_thread(self._do_change_system_time, ())

class NtpCheckButton(Gtk.CheckButton):
    def __init__(self, label):
        super(NtpCheckButton, self).__init__(label)
        self.date_time_wrapper = DateTimeWrapper()
        self.set_active(self.date_time_wrapper.get_using_ntp())
        self.connect('toggled', self.on_my_value_changed)

    def on_my_value_changed(self, widget):
        self.date_time_wrapper.set_using_ntp(self.get_active())

def load_db():
    tz_db = {}
    
    filename = '/usr/share/zoneinfo/zone.tab'
    if not os.path.exists(filename):
        filename = '/usr/share/lib/zoneinfo/tab/zone_sun.tab'
    if not os.path.exists(filename):
        return {}
        
    tz_file = open(filename)
    
    for line in tz_file:
        line = line.rstrip().lstrip()
        if line=="" or line[0] == '#':
            continue
        
        tz_info = line.split('\t')
        if len(tz_info)<3:
            continue
        tz = tz_info[2]
        if "/" in tz:
            i = tz.index("/")
            region = tz[:i]
            zone = tz[i+1:]
        
            if region not in tz_db:
                tz_db[region] = []
            
            tz_db[region].append(zone)
        
    tz_file.close()
    
    return tz_db


