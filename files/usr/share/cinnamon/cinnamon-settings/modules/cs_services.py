#!/usr/bin/python3

# Service module for managing running systemd services
#
# Systemd provides services are divided to user and system services. These have different access
# types and they correlate with different DBus connections.
# (User services & session bus vs. system services & system bus)
#
# Changing root-level access services implicitly prompts the password without explicit code here.
#
# References:
# [1]: https://www.freedesktop.org/software/systemd/man/latest/org.freedesktop.systemd1.html
# [2]: man systemd.service - Command Lines

import gi
gi.require_version("Gtk", "3.0")
gi.require_version('Notify', '0.7')

from gi.repository import Gtk, GObject, Notify
from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

import dbus
import re

from dbus.bus import BusConnection
from enum import IntEnum
from operator import itemgetter
from os import path
from threading import Thread
from time import sleep

class Bus:
    """DBus connection"""

    # Module internally shared DBuses
    _sessionDBus = dbus.Bus(BusConnection.TYPE_SESSION)
    _systemDBus = dbus.Bus(BusConnection.TYPE_SYSTEM)

    class Type(IntEnum):
        User = BusConnection.TYPE_SESSION
        System = BusConnection.TYPE_SYSTEM

    def get(busType: int):
        """Return already existing DBus according to type"""

        match busType:
            case Bus.Type.User:
                return Bus._sessionDBus
            case Bus.Type.System:
                return Bus._systemDBus
        assert(False)


class Manager:
    """Systemd manager DBus interface"""

    def _createManager(busType: int):
        """Create Systemd DBus 'Manager' interface"""

        systemdObj = Bus.get(busType).get_object(
            'org.freedesktop.systemd1', '/org/freedesktop/systemd1')
        return dbus.Interface(systemdObj, 'org.freedesktop.systemd1.Manager')

    # Module internally shared systemd managers
    _systemdSessionManager: dbus.Interface = _createManager(Bus.Type.User)
    _systemdSystemManager: dbus.Interface = _createManager(Bus.Type.System)

    def get(busType: int):
        """Return already existing DBus 'Manager' interface according to type"""

        match busType:
            case Bus.Type.User:
                return Manager._systemdSessionManager
            case Bus.Type.System:
                return Manager._systemdSystemManager
        assert(False)


class DBusField(IntEnum):
    """DBus Service value fields"""
    # See reference [1]
    Name = 0
    Description = 1
    LoadState = 2
    ActiveState = 3
    SubState = 4
    FollowedUnit = 5
    ObjectPath = 6
    JobObjPath = 7


def getServices(busType: int):
    """Get list of all systemd service names for bus type

    Note that this script internally strips the '.service' from the names
    """

    # First, get services that are loaded and have available status info
    loadedList = []
    for unit in Manager.get(busType).ListUnits():
        name = unit[DBusField.Name]
        if name.endswith(".service"):
            loadedList.append({
                DBusField.Name: name.removesuffix(".service"),
                DBusField.Description: unit[DBusField.Description],
                DBusField.LoadState: unit[DBusField.LoadState],
                DBusField.ActiveState: unit[DBusField.ActiveState]})

    # Second, get services that aren't loaded but exist in system
    notLoadedList = []
    for unit in Manager.get(busType).ListUnitFiles():
        fileName = path.basename(unit[0])
        loadState = unit[1]
        if not fileName.endswith(".service"):
            continue
        serviceName = fileName.removesuffix(".service")
        skip = False
        for service in loadedList:
            if service[DBusField.Name] == serviceName:
                # Service was already loaded
                skip = True
        if skip:
            continue

        # Read description from the file - it isn't available in DBus response [1]
        with open(unit[0], 'r') as unitFile:
            description = ""
            for line in unitFile.readlines():
                # - Allow any number of whitespace in the beginning
                # - Match case-sensitively 'Description'
                # - Match equal-sign with any number of whitespace around it
                # - Capture rest of the line starting from first non-whitespace character
                match = re.match(r'^\s*Description\s*=\s*(.*)$', line)
                if match and match.group(1):
                    description = match.group(1)
                    break
            notLoadedList.append({
                DBusField.Name: serviceName,
                DBusField.Description: description,
                DBusField.LoadState: loadState,
                DBusField.ActiveState: "inactive"})
    # for unit in Manager.get(busType).ListUnitFiles()
    return (
        sorted(loadedList, key=itemgetter(DBusField.Name)) +
        sorted(notLoadedList, key=itemgetter(DBusField.Name)))
# def getServices


class ServiceRow(Gtk.Box):
    """UI row for a service, containing a name, a status label and a switch

    Service rows are collapsible by search terms. This utilizes the existing option revealer
    functionality in a way that perhaps wasn't original intention, but does work here as well and
    provides consistent appearance.
    """

    serviceName: str
    activeLbl: Gtk.Label
    loadedLbl: Gtk.Label
    switch: Gtk.Switch
    busType: int
    revealer: Gtk.Revealer
    window: Gtk.Window

    class Revealer(Gtk.Revealer):
        """Service row revealer"""
        name: str = ""
        normallyHidden: bool = False
        row: Gtk.Box = None

        def __init__(self, name: str, row: Gtk.Box, normallyHidden: bool = False):
            Gtk.Revealer.__init__(self)
            self.name = name
            self.normallyHidden = normallyHidden
            self.row = row

        def add(self, widget: Gtk.Widget):
            """Add row to control visibility to"""
            super().add(widget)
            self.set_reveal_child(not self.normallyHidden)

    def __init__(self, service, busType: int, window: Gtk.Window):
        # Initialize service row
        Gtk.Box.__init__(self, orientation=Gtk.Orientation.HORIZONTAL)
        self.window = window # Used for setting dialog transiency
        self.serviceName = service.get(DBusField.Name)
        # Normally hide services if they are generated or not found anymore by systemd
        normallyHidden = service.get(DBusField.LoadState) in ["not-found", "generated"]
        self.revealer = self.Revealer(self.serviceName, self, normallyHidden)
        # Revealer spans over whole row, use it for button press area
        self.revealer.connect("button-release-event", lambda w, ev: self.raiseDialog())
        self.set_spacing(20)
        self.set_border_width(5)
        self.set_margin_left(20)
        self.set_margin_right(20)
        self.set_name(service.get(DBusField.Name))
        self.busType = busType
        # Service activation switch
        self.switch = Gtk.Switch()
        # Service name label with description on hover
        nameLbl = Gtk.Label()
        nameLbl.set_text(service.get(DBusField.Name))
        nameLbl.set_tooltip_text(service.get(DBusField.Description))
        # Load status as text, right aligned fixed length
        # (non-localized system enumeration, this corresponds directly to service reported status)
        self.loadedLbl = Gtk.Label()
        self.loadedLbl.set_width_chars(10)
        self.loadedLbl.set_alignment(1, 0)
        # Active status as text
        # (non-localized system enumeration, this corresponds directly to service reported status)
        self.activeLbl = Gtk.Label()
        # Pack widgets
        infoBox = Gtk.Box()
        infoBox.pack_start(nameLbl, False, False, 0)
        infoBox.pack_end(self.loadedLbl, False, False, 10)
        infoBox.pack_end(self.activeLbl, False, False, 10)
        self.pack_start(infoBox, True, True, 0)
        self.pack_end(self.switch, False, False, 0)
        # Refresh data
        self.switch.set_active(service.get(DBusField.ActiveState) == "active")
        # Disable switch if service can't be set active, including masking
        # TODO: Service masking could be allowed to be changed if editing is added in future
        self.switch.set_sensitive(not service.get(DBusField.LoadState) in ["masked", "not-found"])
        self.loadedLbl.set_text(service.get(DBusField.LoadState).capitalize())
        self.activeLbl.set_text(service.get(DBusField.ActiveState).capitalize())
        # Connect switch at last
        self.switchHandlerId = self.switch.connect("notify::active", self.onSwitch)
    # def __init__

    def raiseDialog(self):
        """Open a dialog with this service's information"""
        dialog = ServiceDialog(self)
        dialog.set_transient_for(self.window)

    def enableSwitchSignal(self, enable: bool):
        """Temporarily disable processing switch signals if switch state changes"""
        if enable:
            GObject.signal_handler_unblock(self.switch, self.switchHandlerId)
        else:
            GObject.signal_handler_block(self.switch, self.switchHandlerId)

    def onSwitch(self, widget, state):
        """Activate or deactivate service

        Run in parallel thread for reactive UI changes
        """
        name = self.serviceName + ".service"
        unitProps = None
        def switchFunc(self, name: str):
            try:
                if widget.get_active():
                    # If "replace", the method will start the unit and its dependencies, possibly
                    # replacing already queued jobs that conflict with it. [1]
                    Manager.get(self.busType).StartUnit(name, "replace")
                else:
                    Manager.get(self.busType).StopUnit(name, "replace")

                # Gather needed objects for following the unit's activation
                unitObj = Bus.get(self.busType).get_object(
                    'org.freedesktop.systemd1',
                    object_path=Manager.get(self.busType).GetUnit(name))
                unitProps = dbus.Interface(unitObj, dbus_interface='org.freedesktop.DBus.Properties')

            except dbus.DBusException as err:
                Notify.Notification.new(_("Service error"), str(err), "error").show()
                return

            getState = lambda: unitProps.Get('org.freedesktop.systemd1.Unit', 'ActiveState')

            # These state strings are direct DBus responses
            targetState = "active" if widget.get_active() else "inactive"
            intermediateState = "activating" if widget.get_active() else "deactivating"
            state = getState()
            while state == intermediateState:
                self.activeLbl.set_text(state.capitalize())
                sleep(1.0) # We're in a parallel thread, sleeping is ok
                state = getState()
            self.activeLbl.set_text(state.capitalize())
            if state != targetState:
                # State change failed, change switch back without new trigger
                self.enableSwitchSignal(False)
                self.switch.set_active(state == "active")
                self.enableSwitchSignal(True)
            # Update load state also
            loadState = unitProps.Get('org.freedesktop.systemd1.Unit', 'LoadState')
            self.loadedLbl.set_text(loadState.capitalize())

        thread = Thread(target=switchFunc, args=(self, name), daemon=True)
        thread.start()
    # def onSwitch
# class ServiceRow


class ServiceDialog(Gtk.Window):
    """Dialog window containing service info

    Separated by service file sections to different tabs

    TODO: Editing functionality?
    """

    readOnly: bool
    originRow: ServiceRow
    options: dict()
    optionViews: dict()

    class OptionRow(Gtk.Box):
        """Service option row

        Contains key and a value like presented in the service file

        TODO: Edit support in future

        Preliminary support added already with text fields, but logic to handle & save changed
        values haven't been done, nor is ability to add or remove sections nor options
        """
        optionBfr: Gtk.EntryBuffer
        valueBfr: Gtk.TextBuffer
        valueEntry: Gtk.TextView

        def __init__(self, option: str = "", value: str = ""):
            Gtk.Box.__init__(self)
            self.readOnly = True # Set as read-only for now
            self.set_spacing(5)
            self.set_border_width(5)
            self.optionBfr = Gtk.EntryBuffer()
            self.valueBfr = Gtk.TextBuffer()

            self.optionBfr.set_text(option, -1)
            optionEntry = Gtk.Entry()
            optionEntry.set_width_chars(30)
            optionEntry.set_buffer(self.optionBfr)
            optionEntry.set_sensitive(not self.readOnly)

            self.valueBfr.set_text(value)
            self.valueEntry = Gtk.TextView()
            self.valueEntry.set_buffer(self.valueBfr)
            self.valueEntry.set_sensitive(not self.readOnly)

            # Add text view into a frame to match styling
            valueFrame = Gtk.Frame()
            valueFrame.add(self.valueEntry)
            self.valueEntry.set_left_margin(5)

            valueEntryStyle = self.valueEntry.get_style_context()
            optionEntryStyle = optionEntry.get_style_context()

            # Extent default entry colors & styling for all
            # TODO: TextView and its Frame borders aren't affected by css?
            bgColor = valueEntryStyle.get_property("background-color", Gtk.StateFlags.NORMAL)
            borderRadius = valueEntryStyle.get_property("border-radius", Gtk.StateFlags.NORMAL)
            fontColor = valueEntryStyle.get_property("color", Gtk.StateFlags.NORMAL)

            valueFrameStyle = valueFrame.get_style_context()
            valueEntryStyle = self.valueEntry.get_style_context()
            valueFrameStyle.add_class("multilineEntry")
            valueEntryStyle.add_class("multilineEntry")

            # Don't change entry background color if disabled
            optionEntryStyle.add_class("disabledEntry")

            # Add style providers
            cssStr = """
            .multilineEntry {{
                background-color: {0};
            }}
            .disabledEntry:disabled {{
                color: {1};
                background-color: {0};
            }}
            """.format(
                bgColor.to_string(),
                fontColor.to_string())

            cssProvider = Gtk.CssProvider()
            cssProvider.load_from_data(cssStr.encode('utf-8'))

            valueFrameStyle.add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_USER)
            valueEntryStyle.add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_USER)
            optionEntryStyle.add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_USER)

            self.valueEntry.set_wrap_mode(Gtk.WrapMode.WORD)

            self.pack_start(optionEntry, False, False, 0)
            self.pack_start(Gtk.Label("="), False, False, 0)

            self.pack_end(valueFrame, True, True, 0)

    def __init__(self, originRow: ServiceRow):
        Gtk.Window.__init__(self)
        self.originRow = originRow
        self.options = dict()
        self.optionViews = dict()

        self.set_modal(True)
        self.set_title(originRow.serviceName)
        self.set_position(Gtk.WindowPosition.CENTER)

        vbox = Gtk.Box()
        vbox.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_default_size(1000, 0) # Set height at 0, resizing later

        self.stack = Gtk.Stack()
        self.stack.set_hexpand(True)
        self.stack.set_vexpand(True)

        sideStack = Gtk.StackSidebar()
        sideStack.set_stack(self.stack)
        sideStack.set_size_request(150, 0)

        stackFrame = Gtk.Box()
        stackFrame.pack_start(sideStack, False, False, 0)
        stackFrame.pack_end(self.stack, True, True, 0)
        vbox.pack_start(stackFrame, True, True, 0)

        okBtn = Gtk.Button(_("OK"))
        okBtn.connect('clicked', lambda _: self.destroy())

        actions = Gtk.ActionBar()
        actions.pack_end(okBtn)
        vbox.pack_end(actions, False, False, 0)

        self.add(vbox)
        self.populateServiceView()
        self.show_all()
        # Resize window here to force geometry recalculation, somehow wrapped TextView contents
        # don't get expanded to fit all rows before this
        self.resize(1000, 400)

        def closeOnEsc(widget, event):
            if event.keyval == Gdk.KEY_Escape:
                self.destroy()
                return True
            else:
                return False
        self.connect("key-press-event", closeOnEsc)
    # def __init__

    def populateServiceView(self):
        """Populate all options for a service to the dialog"""
        fileName = ""
        for unit in Manager.get(self.originRow.busType).ListUnitFiles():
            fileName_ = path.basename(unit[0])
            if self.originRow.serviceName == fileName_.removesuffix(".service"):
                fileName = unit[0]
                break
        if fileName == "":
            return
        self.parseOptionsFromFile(fileName)

    def parseOptionsFromFile(self, fileName: str):
        """Parse systemd format service files

        Python default ini config parser isn't as considerate as needed for supported systemd
        service syntax, so do custom parsing
        """
        currentSection = None
        continued = False
        commentary = False
        (optionStr, valueStr) = ("", "")

        with open(fileName, 'r') as unitFile:
            for fullLine in unitFile.readlines():
                line = fullLine.removesuffix('\n').strip()
                lineFinished = False
                while (not lineFinished):
                    if line == "":
                        # Line was empty
                        pass
                    elif commentary:
                        if line.startswith('#'):
                            # Line was commentary
                            valueStr += '\n' + line.removeprefix('#').lstrip()
                            pass
                        else:
                            # Line not commentary any more
                            self.createOptionRow(currentSection, optionStr, valueStr)
                            commentary = False
                            # Continue to process line like normal
                            continue
                    elif continued:
                        valueStr += fullLine.removesuffix('\n')
                        continued = False
                        pass
                    elif line != "":
                        if line.startswith('#'):
                            # First comment line: start commentary
                            commentary = True
                            optionStr = '#'
                            valueStr = line.removeprefix('#').strip()
                            pass
                        else:
                            # Match section:
                            # - Starts with '['
                            # - Any number on whitespace
                            # - Capture contiguous non-whitespace characters
                            # - Any number on whitespace
                            # - Ends with ']'
                            section = re.search(r'^\[\s*(\S+)\s*\]', line)

                            # Match option:
                            # - Capture all characters before '=' sign
                            # - Has equal sign
                            # - Capture rest of the line
                            # NOTE: No whitespace around '=' is actually allowed, but try to
                            # tolerate it just in case it's encountered.
                            # TODO: Possibility for error reporting to user?
                            option = re.search(r'(^[^=]+)=(.*)$', line)
                            if section:
                                # New service section
                                sectionName = section.group(1)
                                currentSection = sectionName
                                self.createSection(sectionName)
                                (optionStr, valueStr) = ("", "")
                                pass
                            elif option:
                                # New option
                                optionStr = option.group(1)
                                valueStr = option.group(2)
                                pass

                    # Commandlines might get multiple lines [2]
                    # At least accounts-daemon service seems to also use backslashes
                    if ((line.endswith(';') and not line.endswith(r'\;')) or
                        (line.endswith('\\') and not line.endswith("\\\\"))):
                        continued = True
                        valueStr += '\n'
                    lineFinished = True
                # while (not lineFinished)

                if continued or commentary:
                    continue
                elif optionStr != "":
                    self.createOptionRow(currentSection, optionStr, valueStr)
                (optionStr, valueStr) = ("", "")
            # for line in unitFile.readlines()

            # Finish last option if left in progress
            if optionStr != "":
                self.createOptionRow(currentSection, optionStr, valueStr)
        # with open(fileName, 'r') as unitFile
    # def parseOptionsFromFile

    def createSection(self, sectionName: str):
        """Create a new tab for service section"""
        self.options[sectionName] = []
        sw = Gtk.ScrolledWindow()
        view = Gtk.Box()
        view.set_orientation(Gtk.Orientation.VERTICAL)
        sw.add(view)
        self.optionViews[sectionName] = view
        self.stack.add_titled(sw, sectionName.lower(), sectionName.capitalize())

    def createOptionRow(self, section: str, option: str, value: str):
        """Create a new option row for respective section's tab"""
        if not section:
            section = "#"
            self.createSection(section)
        row = self.OptionRow(option, value)
        self.options[section] = row
        self.optionViews[section].pack_start(row, False, False, 0)
        self.optionViews[section].pack_start(Gtk.Separator(), False, False, 0)

# class ServiceDialog


class Module:
    """Cinnamon service module"""
    name = "services"
    comment = _("Administrate user and system services")
    category = "admin"

    sidePage = None
    contentScrolledWindow = None
    window: Gtk.Window

    userServiceRows = []
    systemServiceRows = []

    showingAllServices: bool = False

    def _setParentRef(self, parent: Gtk.Window):
        self.window = parent

    def __init__(self, content_box):
        keywords = _("services, administration, system, systemd")
        sidePage = SidePage(_("Services"), "cs-cat-admin", keywords, content_box, module=self)
        self.sidePage = sidePage

        # Get parent GtkScrolledWindow for scrolling back to top
        widget = sidePage.content_box
        try:
            while widget:
                if widget.get_name() == "GtkScrolledWindow":
                    self.contentScrolledWindow = widget
                    break
                widget = widget.get_parent()
        except AttributeError as err:
            print(err)
            widget = None
        if not widget:
            print("Failed to recurse widgets from module content box to scrolled view")

    def scrollToTop(self, _1, _2):
        """ Scroll view back to top

        Service lists can be disparate in length, so switching between 'User' and 'System' may
        switch to an empty looking view. This may feel jarring to users.
        => On tab switch, scroll back to top.
        """
        if self.contentScrolledWindow:
            currentAdj = self.contentScrolledWindow.get_vadjustment()
            currentAdj.set_value(currentAdj.get_lower())
            self.contentScrolledWindow.set_vadjustment()

    def filterServices(self, serviceRows, filterStr: str):
        """ Hide services not matching the filterStr query """
        for row in serviceRows:
            row.revealer.set_reveal_child(
                re.search(filterStr, row.serviceName)
                and (not row.revealer.normallyHidden or self.showingAllServices))

    def showAllServices(self, serviceRows, showAll: bool):
        """ Show or hide normally hidden (unavailable) services """
        self.showingAllServices = showAll
        for row in serviceRows:
            row.revealer.set_reveal_child(not row.revealer.normallyHidden or showAll)

    def updateServices(self, busType):
        """ Refresh services statuses """
        serviceRows = []
        match busType:
            case Bus.Type.User:
                serviceRows = self.userServiceRows
            case Bus.Type.System:
                serviceRows = self.systemServiceRows
        for service in getServices(busType):
            for row in serviceRows:
                if service.get(DBusField.Name) == row.serviceName:
                    row.enableSwitchSignal(False)
                    row.switch.set_active(service.get(DBusField.ActiveState) == "active")
                    row.switch.set_sensitive(
                        not service.get(DBusField.LoadState) in ["masked", "not-found"])
                    row.enableSwitchSignal(True)
                    row.activeLbl.set_text(service.get(DBusField.ActiveState).capitalize())
                    row.loadedLbl.set_text(service.get(DBusField.LoadState).capitalize())
                    # serviceRows.remove(row)
                    break

    def on_module_selected(self):
        """ Cinnamon services entry point """

        if self.loaded:
            return

        print("Loading Services module")

        Notify.init("cinnamon-settings-services")

        self.sidePage.stack = SettingsStack()
        self.sidePage.stack.connect("notify::visible-child", self.scrollToTop)
        self.sidePage.add_widget(self.sidePage.stack)

        def populateTab(name: str, busType: int, rows):
            """ Populate tab page contents to view """
            assert(name == "user" or name == "system")
            page = SettingsPage()
            settings = None
            match name:
                case "user":
                    self.sidePage.stack.add_titled(page, "user", _("User"))
                    settings = page.add_section(_("User level services"))
                case "system":
                    self.sidePage.stack.add_titled(page, "system", _("System"))
                    settings = page.add_section(_("System level services"))

            entry = Gtk.SearchEntry()
            entry.set_placeholder_text(_("Search services..."))
            entry.set_width_chars(30)
            entry.connect("search-changed", lambda e: self.filterServices(rows, e.get_text()))

            # Allow unfocusing the entry field on escape key
            def unfocusOnEsc(widget, event):
                if event.keyval == Gdk.KEY_Escape:
                    self.window.set_focus(None)
                    return True
                else:
                    return False
            entry.connect("key-press-event", unfocusOnEsc)

            searchBarUser = Gtk.SearchBar()
            searchBarUser.add(entry)
            searchBarUser.props.hexpand = True
            searchBarUser.set_search_mode(True)

            topList = Gtk.Box()
            topList.pack_start(searchBarUser, expand=True, fill=True, padding=0)

            showAllBtn = Gtk.ToggleButton(_("Show all"))
            topList.pack_end(showAllBtn, None, None, 0)
            showAllBtn.connect("clicked", lambda btn: self.showAllServices(rows, btn.get_active()))

            refreshBtn = Gtk.Button(_("Refresh"))
            topList.pack_end(refreshBtn, None, None, 0)
            refreshBtn.connect("clicked", lambda _: self.updateServices(busType))

            settings.add_row(topList)

            for service in getServices(busType):
                row = ServiceRow(service, busType, self.window)
                rows.append(row)
                settings.add_reveal_row(row, revealer=row.revealer)

        populateTab("user", Bus.Type.User, self.userServiceRows)
        populateTab("system", Bus.Type.System, self.systemServiceRows)
    # def on_module_selected

# class Module