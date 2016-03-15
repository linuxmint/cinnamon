#!/usr/bin/env python3

from gi.repository import GLib, Gtk, Gdk, Cvc, GdkPixbuf, Gio
from SettingsWidgets import *
import dbus

CINNAMON_SOUNDS = "org.cinnamon.sounds"
CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound"
DECAY_STEP = .15

EFFECT_LIST = [
    {"label": _("Starting Cinnamon"),           "schema": CINNAMON_SOUNDS,         "file": "login-file",        "enabled": "login-enabled"},
    {"label": _("Leaving Cinnamon"),            "schema": CINNAMON_SOUNDS,         "file": "logout-file",       "enabled": "logout-enabled"},
    {"label": _("Switching workspace"),         "schema": CINNAMON_SOUNDS,         "file": "switch-file",       "enabled": "switch-enabled"},
    {"label": _("Opening new windows"),         "schema": CINNAMON_SOUNDS,         "file": "map-file",          "enabled": "map-enabled"},
    {"label": _("Closing windows"),             "schema": CINNAMON_SOUNDS,         "file": "close-file",        "enabled": "close-enabled"},
    {"label": _("Minimizing windows"),          "schema": CINNAMON_SOUNDS,         "file": "minimize-file",     "enabled": "minimize-enabled"},
    {"label": _("Maximizing windows"),          "schema": CINNAMON_SOUNDS,         "file": "maximize-file",     "enabled": "maximize-enabled"},
    {"label": _("Unmaximizing windows"),        "schema": CINNAMON_SOUNDS,         "file": "unmaximize-file",   "enabled": "unmaximize-enabled"},
    {"label": _("Tiling and snapping windows"), "schema": CINNAMON_SOUNDS,         "file": "tile-file",         "enabled": "tile-enabled"},
    {"label": _("Inserting a device"),          "schema": CINNAMON_SOUNDS,         "file": "plug-file",         "enabled": "plug-enabled"},
    {"label": _("Removing a device"),           "schema": CINNAMON_SOUNDS,         "file": "unplug-file",       "enabled": "unplug-enabled"},
    {"label": _("Changing the sound volume"),   "schema": CINNAMON_DESKTOP_SOUNDS, "file": "volume-sound-file", "enabled": "volume-sound-enabled"}
]

SOUND_TEST_MAP = [
    #  name,             position,        icon name,                  row,  col,   pa id
    [_("Front Left"),    "front-left",    "audio-speaker-left",         0,   0,      1],
    [_("Front Right"),   "front-right",   "audio-speaker-right",        0,   2,      2],
    [_("Front Center"),  "front-center",  "audio-speaker-center",       0,   1,      3],
    [_("Rear Left"),     "rear-left",     "audio-speaker-left-back",    2,   0,      5],
    [_("Rear Right"),    "rear-right",    "audio-speaker-right-back",   2,   2,      6],
    [_("Rear Center"),   "rear-center",   "audio-speaker-center-back",  2,   1,      4],
    [_("Subwoofer"),     "lfe",           "audio-subwoofer",            1,   1,      7],
    [_("Side Left"),     "side-left",     "audio-speaker-left-side",    1,   0,      10],
    [_("Side Right"),    "side-right",    "audio-speaker-right-side",   1,   2,      11]
]

class Slider(SettingsWidget):
    def __init__(self, title, minLabel, maxLabel, minValue, maxValue, step=None, page=None, value=0, gicon=None, iconName=None):
        super(Slider, self).__init__()
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(0)
        
        if step == None:
            step = (maxValue - minValue) / 100
        if page == None:
            page = (maxValue - minValue) / 10
        self.adjustment = Gtk.Adjustment.new(value, minValue, maxValue, step, page, 0)
        
        # add label and icon (if specified)
        labelBox = Gtk.Box(spacing=5)
        if gicon != None:
            appIcon = Gtk.Image.new_from_gicon(gicon, 2)
            labelBox.pack_start(appIcon, False, False, 0)
        elif iconName != None:
            appIcon = Gtk.Image.new_from_icon_name(iconName, 2)
            labelBox.pack_start(appIcon, False, False, 0)
        self.label = Gtk.Label(title)
        labelBox.pack_start(self.label, False, False, 0)
        labelBox.set_halign(Gtk.Align.CENTER)
        
        # add scale
        sliderBox = Gtk.Box()
        self.slider = Gtk.Scale.new(Gtk.Orientation.HORIZONTAL, self.adjustment)
        self.slider.props.draw_value = False
        
        min_label= Gtk.Label()
        max_label = Gtk.Label()
        min_label.set_alignment(1.0, 0.75)
        max_label.set_alignment(1.0, 0.75)
        min_label.set_margin_right(6)
        max_label.set_margin_left(6)
        min_label.set_markup("<i><small>%s</small></i>" % minLabel)
        max_label.set_markup("<i><small>%s</small></i>" % maxLabel)
        
        sliderBox.pack_start(min_label, False, False, 0)
        sliderBox.pack_start(self.slider, True, True, 0)
        sliderBox.pack_start(max_label, False, False, 0)
        
        self.pack_start(labelBox, False, False, 0)
        self.pack_start(sliderBox, False, False, 6)
        self.show_all()
    
    def setMark(self, val):
        self.slider.add_mark(val, Gtk.PositionType.TOP, "")

class VolumeBar(Slider):
    def __init__(self, normVolume, maxVolume, title=_("Volume"), gicon=None):
        self.normVolume = normVolume
        self.maxVolume = maxVolume
        self.maxPercent = 100*maxVolume/normVolume
        self.volume = 0
        self.baseTitle = title
        
        super(VolumeBar, self).__init__(title, _("Softer"), _("Louder"), 0, self.maxPercent, 1, 5, 0, gicon)
        self.slider.set_sensitive(False)
        
        if maxVolume > normVolume:
            self.setMark(100)
        
        self.adjustment.connect("value-changed", self.onVolumeChanged)
    
    def setStream(self, stream):
        # fixme: check if stream is already set and disconnect signals if so
        self.stream = stream
        
        self.stream.connect("notify::is-muted", self.setVolume)
        self.stream.connect("notify::volume", self.setVolume)
        self.setVolume(None, None)
        
        self.slider.set_sensitive(True)
    
    def setVolume(self, a, b):
        newVolume = int(round(self.stream.props.volume / self.normVolume * 100))
        if self.volume == newVolume:
            return
        
        self.volume = newVolume
        self.adjustment.set_value(newVolume)
        self.updateLabel()
    
    def onVolumeChanged(self, adjustment):
        newVolume = int(round(self.adjustment.get_value()))
        if self.volume == newVolume:
            return
        
        self.volume = newVolume
        self.stream.props.volume = newVolume * self.normVolume / 100
        self.stream.push_volume()
        self.updateLabel()
    
    def updateLabel(self):
        self.label.set_label(self.baseTitle + ": " + str(self.volume) + "%")

class BalanceBar(Slider):
    def __init__(self, type, minVal = -1, norm = 1):
        self.type = type
        self.norm = norm
        self.value = 0
        
        if type == "balance":
            title = _("Balance")
            minLabel = _("Left")
            maxLabel = _("Right")
        elif type == "fade":
            title = _("Fade")
            minLabel = _("Rear")
            maxLabel = _("Front")
        elif type == "lfe":
            title = _("Subwoofer")
            minLabel = _("Soft")
            maxLabel = _("Loud")
        
        super(BalanceBar, self).__init__(title, minLabel, maxLabel, minVal, 1, (1-minVal)/20.)
        
        self.setMark(0)
        self.slider.props.has_origin = False
        
        self.adjustment.connect("value-changed", self.onLevelChanged)
    
    def setChannelMap(self, channelMap):
        self.channelMap = channelMap
        self.channelMap.connect("volume-changed", self.getLevel)
        self.slider.set_sensitive(getattr(self.channelMap, "can_"+self.type)())
        self.getLevel()
        
    def getLevel(self, a=None, b=None):
        value = round(getattr(self.channelMap, "get_"+self.type)(), 3)
        if self.type == "lfe":
            value = value / self.norm
        if value == self.value:
            return
        self.value = value
        self.adjustment.set_value(self.value)
    
    def onLevelChanged(self, adjustment):
        value = round(self.adjustment.get_value(), 3)
        if self.value == value:
            return
        self.value = value
        if self.type == "lfe":
            value = value * self.norm
        getattr(self.channelMap, "set_"+self.type)(value)

class VolumeLevelBar(SettingsWidget):
    def __init__(self):
        super(VolumeLevelBar, self).__init__()
        self.lastPeak = 0
        self.monitorId = None
        self.stream = None
        
        self.pack_start(Gtk.Label(_("Input level")), False, False, 0)
        
        self.levelBar = Gtk.LevelBar()
        self.pack_end(self.levelBar, True, True, 0)
        
        self.levelBar.set_min_value(0)
    
    def setStream(self, stream):
        if self.stream != None:
            self.stream.remove_monitor()
            self.stream.disconnect(self.monitorId)
        self.stream = stream
        self.stream.create_monitor()
        self.monitorId = self.stream.connect("monitor-update", self.update)
    
    def update(self, stream, value):
        if self.lastPeak >= DECAY_STEP and value < self.lastPeak - DECAY_STEP:
            value = self.lastPeak - DECAY_STEP
        self.lastPeak = value
        
        self.levelBar.set_value(value)

class ProfileSelector(SettingsWidget):
    def __init__(self, controller):
        super(ProfileSelector, self).__init__()
        self.controller = controller
        self.model = Gtk.ListStore(str, str)
        
        self.combo = Gtk.ComboBox()
        self.combo.set_model(self.model)
        render = Gtk.CellRendererText()
        self.combo.pack_start(render, True)
        self.combo.add_attribute(render, "text", 1)
        self.combo.set_id_column(0)
        
        self.pack_start(Gtk.Label(_("Output profile")), False, False, 0)
        self.pack_end(self.combo, False, False, 0)
        
        self.combo.connect("changed", self.onProfileSelect)
    
    def setDevice(self, device):
        self.device = device
        # set the available output profiles in the combo box
        profiles = device.get_profiles()
        self.model.clear()
        for profile in profiles:
            self.model.append([profile.profile, profile.human_profile])
        
        self.profile = device.get_active_profile()
        self.combo.set_active_id(self.profile)
    
    def onProfileSelect(self, a):
        newProfile = self.combo.get_active_id()
        if newProfile != self.profile and newProfile != None:
            self.profile = newProfile
            self.controller.change_profile_on_selected_device(self.device, newProfile)

class Effect(SettingsWidget):
    def __init__(self, info, sizeGroup):
        super(Effect, self).__init__()
        
        self.settings = Gio.Settings.new(info["schema"])
        self.fileKey = info["file"]
        self.enabledKey = info["enabled"]
        
        label = Gtk.Label(info["label"])
        
        self.fileChooser = Gtk.FileChooserButton()
        sizeGroup.add_widget(self.fileChooser)
        
        playButton = Gtk.Button.new_from_icon_name("media-playback-start", 1)
        
        self.switch = Gtk.Switch()
        
        self.updateFile()
        self.updateEnabled()
        
        # self.switch.connect("notify::active", self.updateEnabledKey)
        self.fileChooser.connect("file-set", self.updateFileKey)
        playButton.connect("clicked", self.playSound)
        
        self.pack_start(label, False, False, 0)
        self.pack_end(self.switch, False, False, 0)
        self.pack_end(playButton, False, False, 0)
        self.pack_end(self.fileChooser, False, False, 0)
        
        self.settings.connect("changed::"+self.fileKey, self.updateFile)
        self.settings.connect("changed::"+self.enabledKey, self.updateEnabled)
        self.settings.bind(self.enabledKey, self.switch, "active", Gio.SettingsBindFlags.DEFAULT)
    
    def updateFileKey(self, a):
        self.settings.set_string(self.fileKey, self.fileChooser.get_filename())
    
    def updateFile(self, a=None, b=None):
        self.fileChooser.set_filename(self.settings.get_string(self.fileKey))
    
    def updateEnabledKey(self, a, enabled):
        print enabled
        self.settings.set_boolean(self.enabledKey, self)
    
    def updateEnabled(self, a=None, b=None):
        enabled = self.settings.get_boolean(self.enabledKey)
        # self.switch.set_state(enabled)
        self.fileChooser.set_sensitive(enabled)
    
    def playSound(self, a):
        session_bus = dbus.SessionBus()
        sound_dbus = session_bus.get_object("org.cinnamon.SettingsDaemon", "/org/cinnamon/SettingsDaemon/Sound")
        play = sound_dbus.get_dbus_method('PlaySoundFile', 'org.cinnamon.SettingsDaemon.Sound')
        play(0, self.fileChooser.get_filename())

class SoundTest(Gtk.Dialog):
    def __init__(self, stream):
        super(SoundTest, self).__init__()
        self.stream = stream
        self.positions = []
        
        grid = Gtk.Grid()
        grid.set_column_spacing(75)
        grid.set_row_spacing(75)
        grid.set_column_homogeneous(True)
        grid.set_row_homogeneous(True)
        
        index = 0
        for position in SOUND_TEST_MAP:
            container = Gtk.Box()
            button = Gtk.Button()
            box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0)
            button.add(box)
            
            icon = Gtk.Image.new_from_icon_name(position[2], 6)
            box.pack_start(icon, False, False, 0)
            box.pack_start(Gtk.Label(position[0]), False, False, 0)
            
            info = {"index":index, "icon":icon, "button":button}
            
            button.connect("clicked", self.test, info)
            container.add(button)
            grid.attach(container, position[4], position[3], 1, 1)
            
            index = index + 1
            self.positions.append(info)
        
        self.get_content_area().add(grid)
        self.show_all()
        self.setPositionHideState()
    
    def test(self, b, info):
        position = SOUND_TEST_MAP[info["index"]]
        baseIconName = position[2]
        # info["icon"].props.icon_name = baseIconName+"-testing"
        
        if position[1] == "lfe":
            sound = "audio-test-signal"
        else:
            sound = "audio-channel-"+position[1]
        
        session_bus = dbus.SessionBus()
        sound_dbus = session_bus.get_object("org.cinnamon.SettingsDaemon", "/org/cinnamon/SettingsDaemon/Sound")
        play = sound_dbus.get_dbus_method('PlaySoundWithChannel', 'org.cinnamon.SettingsDaemon.Sound')
        play(0, sound, position[1])
    
    def setPositionHideState(self):
        map = self.stream.get_channel_map()
        for position in self.positions:
            index = position["index"]
            if map.has_position(SOUND_TEST_MAP[index][5]):
                position["button"].show()
            else:
                position["button"].hide()

class Module:
    name = "sound"
    category = "hardware"
    comment = _("Manage sound settings")

    def __init__(self, content_box):
        keywords = _("sound, media, music, speakers, audio")
        self.sidePage = SidePage(_("Sound"), "cs-sound", keywords, content_box, module=self)

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Sound module"
            
            self.outputDeviceList = Gtk.ListStore(str, # name
                                  str, # device
                                  bool, # active
                                  int, # id
                                  GdkPixbuf.Pixbuf) # icon
            
            self.inputDeviceList = Gtk.ListStore(str, # name
                                  str, # device
                                  bool, # active
                                  int, # id
                                  GdkPixbuf.Pixbuf) # icon
            
            self.appList = {}
            
            self.inializeController()
            self.buildLayout()
        
        self.checkAppState()
    
    def buildLayout(self):
        self.sidePage.stack = SettingsStack()
        self.sidePage.add_widget(self.sidePage.stack)
        
        ## Output page
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "output", _("Output"))
        
        self.outputSelector = self.buildDeviceSelect("output", self.outputDeviceList)
        outputSection = page.add_section(_("Device"))
        outputSection.add_row(self.outputSelector)
        
        devSettings = page.add_section(_("Device settings"))
        
        self.outVolume = VolumeBar(self.controller.get_vol_max_norm(), self.controller.get_vol_max_amplified())
        devSettings.add_row(self.outVolume)
        
        # output profiles
        self.profile = ProfileSelector(self.controller)
        devSettings.add_row(self.profile)
        
        sbox = SettingsWidget()
        button = Gtk.Button.new_with_label(_("Test sound"))
        sbox.pack_start(button, True, True, 0)
        devSettings.add_row(sbox)
        button.connect("clicked", self.testSpeakers)
        
        # balance
        self.balance = BalanceBar("balance")
        devSettings.add_row(self.balance)
        self.fade = BalanceBar("fade")
        devSettings.add_row(self.fade)
        self.woofer = BalanceBar("lfe", 0, self.controller.get_vol_max_norm())
        devSettings.add_row(self.woofer)
        
        ## Input page
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "input", _("Input"))
        
        self.inputSelector = self.buildDeviceSelect("output", self.inputDeviceList)
        deviceSection = page.add_section("Device")
        deviceSection.add_row(self.inputSelector)
        
        devSettings = page.add_section(_("Device settings"))
        
        self.inVolume = VolumeBar(self.controller.get_vol_max_norm(), self.controller.get_vol_max_amplified())
        devSettings.add_row(self.inVolume)
        
        self.inLevel = VolumeLevelBar()
        devSettings.add_row(self.inLevel)
        
        ## Effects page
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "effects", _("Sound Effects"))
        
        effectsSection = page.add_section(_("Effects"))
        self.effectsVolume = VolumeBar(self.controller.get_vol_max_norm(), self.controller.get_vol_max_norm())
        effectsSection.add_row(self.effectsVolume)
        sizeGroup = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        for effect in EFFECT_LIST:
            effectsSection.add_row(Effect(effect, sizeGroup))
        
        ## Applications page
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "applications", _("Applications"))
        
        self.applicationsBox = Gtk.ListBox()
        self.applicationsBox.set_selection_mode(Gtk.SelectionMode.NONE)
        self.noAppsMessage = SettingsWidget()
        label = Gtk.Label(_("No application is currently playing or recording audio."))
        self.noAppsMessage.pack_start(label, False, False, 0)
        self.applicationsBox.add(self.noAppsMessage)
        self.noAppsMessage.get_parent().set_no_show_all(True)
        
        page.pack_start(self.applicationsBox, False, False, 0)
    
    def inializeController(self):
        self.controller = Cvc.MixerControl(name = "cinnamon")
        self.controller.connect("state-changed", self.setChannelMap)
        self.controller.connect("output-added", self.deviceAdded, "output")
        self.controller.connect("input-added", self.deviceAdded, "input")
        self.controller.connect("output-removed", self.deviceRemoved, "output")
        self.controller.connect("input-removed", self.deviceRemoved, "input")
        self.controller.connect("active-output-update", self.activeOutputUpdate)
        self.controller.connect("active-input-update", self.activeInputUpdate)
        self.controller.connect("default-sink-changed", self.defaultSinkChanged)
        self.controller.connect("default-source-changed", self.defaultSourceChanged)
        self.controller.connect("stream-added", self.streamAdded)
        self.controller.connect("stream-removed", self.streamRemoved)
        self.controller.open()
    
    def buildDeviceSelect(self, type, model):
        select = Gtk.IconView.new_with_model(model)
        select.set_pixbuf_column(4)
        select.set_text_column(0)
        
        select.connect("selection-changed", self.setActiveDevice, type)
        
        return select
    
    def setActiveDevice(self, view, type):
        selected = view.get_selected_items()
        if len(selected) == 0:
            return
        
        model = view.get_model()
        newDevice = model.get_value(model.get_iter(selected[0]), 3)
        id = getattr(self.controller, "lookup_"+type+"_id")(newDevice)
        if id != None and id != getattr(self, type+"Id"):
            getattr(self.controller, "change_"+type)(id)
    
    def deviceAdded(self, c, id, type):
        device = getattr(self.controller, "lookup_"+type+"_id")(id)
        icon = "audio-card"
        
        iconTheme = Gtk.IconTheme.get_default()
        gicon = device.get_gicon()
        icon = iconTheme.lookup_by_gicon(gicon, 32, 0).load_icon()
        
        getattr(self, type+"DeviceList").append([device.get_description() + "\n" +  device.get_origin(), "", False, id, icon])
    
    def deviceRemoved(self, c, id, type):
        store = getattr(self, type+"DeviceList")
        for row in store:
            if row[3] == id:
                store.remove(row.iter)
                return
    
    def activeOutputUpdate(self, c, id):
        self.outputId = id
        device = self.controller.lookup_output_id(id)
        
        self.profile.setDevice(device)
        
        # select current device in device selector
        i = 0
        for row in self.outputDeviceList:
            if row[3] == id:
                self.outputSelector.select_path(Gtk.TreePath.new_from_string(str(i)))
            i = i + 1
        
        self.setChannelMap()
    
    def activeInputUpdate(self, c, id):
        self.inputId = id
        
        # select current device in device selector
        i = 0
        for row in self.inputDeviceList:
            if row[3] == id:
                self.inputSelector.select_path(Gtk.TreePath.new_from_string(str(i)))
            i = i + 1
    
    def defaultSinkChanged(self, c, id):
        defaultSink = self.controller.get_default_sink()
        if defaultSink == None:
            return
        self.outVolume.setStream(defaultSink)
        self.setChannelMap()
    
    def defaultSourceChanged(self, c, id):
        defaultSource = self.controller.get_default_source()
        if defaultSource == None:
            return
        self.inVolume.setStream(defaultSource)
        self.inLevel.setStream(defaultSource)
    
    def setChannelMap(self, a=None, b=None):
        if self.controller.get_state() == Cvc.MixerControlState.READY:
            channelMap = self.controller.get_default_sink().get_channel_map()
            self.balance.setChannelMap(channelMap)
            self.fade.setChannelMap(channelMap)
            self.woofer.setChannelMap(channelMap)
    
    def streamAdded(self, c, id):
        stream = self.controller.lookup_stream_id(id)
        
        if stream in self.controller.get_sink_inputs():
            # fixme: we need separators
            self.appList[id] = VolumeBar(self.controller.get_vol_max_norm(), self.controller.get_vol_max_norm(), stream.props.name, stream.get_gicon())
            self.appList[id].setStream(stream)
            self.applicationsBox.add(self.appList[id])
        elif stream == self.controller.get_event_sink_input():
            self.effectsVolume.setStream(stream)
        
        self.checkAppState()
    
    def streamRemoved(self, c, id):
        if id in self.appList:
            self.applicationsBox.remove(self.appList[id].get_parent())
            del self.appList[id]
            self.checkAppState()
    
    def testSpeakers(self, a):
        SoundTest(self.controller.get_default_sink())
    
    def checkAppState(self):
        if len(self.appList) == 0:
            self.noAppsMessage.get_parent().show()
            self.noAppsMessage.get_parent().set_no_show_all(False)
        else:
            self.noAppsMessage.get_parent().hide()
            self.noAppsMessage.get_parent().set_no_show_all(True)
