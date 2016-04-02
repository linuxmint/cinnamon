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

def list_header_func(row, before, user_data):
    if before and not row.get_header():
        row.set_header(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

class SoundBox(Gtk.Box):
    def __init__(self, title):
        Gtk.Box.__init__(self)
        self.set_orientation(Gtk.Orientation.VERTICAL)
        frame = Gtk.Frame()
        frame.set_shadow_type(Gtk.ShadowType.IN)
        frame_style = frame.get_style_context()
        frame_style.add_class("view")
        self.pack_start(frame, True, True, 0)

        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        frame.add(main_box)

        toolbar = Gtk.Toolbar.new()
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(toolbar), "cs-header")
        label = Gtk.Label()
        label.set_markup("<b>%s</b>" % title)
        title_holder = Gtk.ToolItem()
        title_holder.add(label)
        toolbar.add(title_holder)
        main_box.add(toolbar)

        toolbar_separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        main_box.add(toolbar_separator)
        separator_context = toolbar_separator.get_style_context()
        frame_color = frame_style.get_border_color(Gtk.StateFlags.NORMAL).to_string()
        css_provider = Gtk.CssProvider()
        css_provider.load_from_data(".separator { -GtkWidget-wide-separators: 0; \
                                                   color: %s;                    \
                                                }" % frame_color)
        separator_context.add_provider(css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

        scw = Gtk.ScrolledWindow()
        scw.expand = True
        scw.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scw.set_shadow_type(Gtk.ShadowType.NONE)
        main_box.pack_start(scw, True, True, 0)
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        scw.add(self.box)

        self.list_box = Gtk.ListBox()
        self.list_box.set_header_func(list_header_func, None)
        self.box.add(self.list_box)

    def add_row(self, row):
        self.list_box.add(row)

class Slider(SettingsWidget):
    def __init__(self, title, minLabel, maxLabel, minValue, maxValue, sizeGroup, step=None, page=None, value=0, gicon=None, iconName=None):
        super(Slider, self).__init__()
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(5)
        self.set_margin_bottom(5)
        
        if sizeGroup == None:
            sizeGroup = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        
        if step == None:
            step = (maxValue - minValue) / 100
        if page == None:
            page = (maxValue - minValue) / 10
        self.adjustment = Gtk.Adjustment.new(value, minValue, maxValue, step, page, 0)
        
        topBox = Gtk.Box()
        self.leftBox = Gtk.Box()
        self.rightBox = Gtk.Box()
        topGroup = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        topGroup.add_widget(self.leftBox)
        topGroup.add_widget(self.rightBox)
        
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
        
        topBox.pack_start(self.leftBox, False, False, 0)
        topBox.pack_start(labelBox, True, True, 0)
        topBox.pack_start(self.rightBox, False, False, 0)
        
        # add scale
        sliderBox = Gtk.Box()
        self.slider = Gtk.Scale.new(Gtk.Orientation.HORIZONTAL, self.adjustment)
        self.slider.props.draw_value = False
        
        min_label= Gtk.Label()
        max_label = Gtk.Label()
        min_label.set_alignment(1.0, 0.75)
        max_label.set_alignment(0.0, 0.75)
        min_label.set_margin_right(6)
        max_label.set_margin_left(6)
        min_label.set_markup("<i><small>%s</small></i>" % minLabel)
        max_label.set_markup("<i><small>%s</small></i>" % maxLabel)
        sizeGroup.add_widget(min_label)
        sizeGroup.add_widget(max_label)
        
        sliderBox.pack_start(min_label, False, False, 0)
        sliderBox.pack_start(self.slider, True, True, 0)
        sliderBox.pack_start(max_label, False, False, 0)
        
        self.pack_start(topBox, False, False, 0)
        self.pack_start(sliderBox, False, False, 0)
        self.show_all()
    
    def setMark(self, val):
        self.slider.add_mark(val, Gtk.PositionType.TOP, "")

class VolumeBar(Slider):
    def __init__(self, normVolume, maxVolume, title=_("Volume: "), gicon=None, sizeGroup=None):
        self.normVolume = normVolume
        self.maxVolume = maxVolume
        self.maxPercent = 100*maxVolume/normVolume
        self.volume = 0
        self.isMuted = False
        self.baseTitle = title

        self.stream = None

        self.mutedHandlerId = 0
        self.volumeHandlerId = 0

        super(VolumeBar, self).__init__(title, _("Softer"), _("Louder"), 0, self.maxPercent, sizeGroup, 1, 5, 0, gicon)
        self.set_spacing(0)
        self.set_border_width(2)
        self.set_margin_left(23)
        self.set_margin_right(23)
        self.slider.set_sensitive(False)
        
        self.muteImage = Gtk.Image.new_from_icon_name("audio-volume-muted-symbolic", 1)
        self.muteSwitch = Gtk.ToggleButton()
        self.muteSwitch.set_image(self.muteImage)
        self.muteSwitch.set_relief(Gtk.ReliefStyle.NONE)
        self.muteSwitch.set_active(False)
        self.muteSwitch.set_sensitive(False)

        self.leftBox.pack_start(self.muteSwitch, False, False, 0)

        if maxVolume > normVolume:
            self.setMark(100)

        self.muteSwitchHandlerId = self.muteSwitch.connect("clicked", self.toggleMute)
        self.adjustmentHandlerId = self.adjustment.connect("value-changed", self.onVolumeChanged)

    def connectStream(self):
        self.mutedHandlerId = self.stream.connect("notify::is-muted", self.setVolume)
        self.volumeHandlerId = self.stream.connect("notify::volume", self.setVolume)
        self.setVolume(None, None)

    def disconnectStream(self):
        if self.mutedHandlerId > 0:
            self.stream.disconnect(self.mutedHandlerId)
            self.mutedHandlerId = 0

        if self.volumeHandlerId > 0:
            self.stream.disconnect(self.volumeHandlerId)
            self.volumeHandlerId = 0

    def setStream(self, stream):
        if self.stream and stream != self.stream:
            self.disconnectStream()

        self.stream = stream

        self.connectStream()

        self.slider.set_sensitive(True)
        self.muteSwitch.set_sensitive(True)

    def setVolume(self, a, b):
        if self.stream.get_is_muted():
            newVolume = 0
            self.isMuted = True
        else:
            newVolume = int(round(self.stream.props.volume / self.normVolume * 100))
            self.isMuted = False

        self.volume = newVolume

        self.adjustment.handler_block(self.adjustmentHandlerId)
        self.adjustment.set_value(newVolume)
        self.adjustment.handler_unblock(self.adjustmentHandlerId)

        self.updateStatus()

    def onVolumeChanged(self, adjustment):
        newVolume = int(round(self.adjustment.get_value()))

        muted = newVolume == 0

        self.volume = newVolume

        self.stream.handler_block(self.volumeHandlerId)
        self.stream.set_volume(newVolume * self.normVolume / 100)
        self.stream.push_volume()
        self.stream.handler_unblock(self.volumeHandlerId)

        if self.stream.get_is_muted() != muted:
            self.setMuted(muted)

        self.updateStatus()

    def setMuted(self, muted):
        self.isMuted = muted
        self.stream.change_is_muted(muted)

    def toggleMute(self, a=None):
        self.setMuted(not self.isMuted)

    def updateStatus(self):
        self.muteSwitch.handler_block(self.muteSwitchHandlerId)
        self.muteSwitch.set_active(self.isMuted)
        self.muteSwitch.handler_unblock(self.muteSwitchHandlerId)

        if self.isMuted:
            self.muteImage.set_from_icon_name("audio-volume-muted-symbolic", 1)
            self.label.set_label(self.baseTitle + _("Muted"))
            self.muteSwitch.set_tooltip_text(_("Click to unmute"))
        else:
            self.muteImage.set_from_icon_name("audio-volume-high-symbolic", 1)
            self.label.set_label(self.baseTitle + str(self.volume) + "%")
            self.muteSwitch.set_tooltip_text(_("Click to mute"))

class BalanceBar(Slider):
    def __init__(self, type, minVal = -1, norm = 1, sizeGroup=None):
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
        
        super(BalanceBar, self).__init__(title, minLabel, maxLabel, minVal, 1, sizeGroup, (1-minVal)/20.)
        
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
    def __init__(self, sizeGroup):
        super(VolumeLevelBar, self).__init__()
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(5)
        
        self.lastPeak = 0
        self.monitorId = None
        self.stream = None
        
        self.pack_start(Gtk.Label(_("Input level")), False, False, 0)
        
        levelBox = Gtk.Box()
        self.levelBar = Gtk.LevelBar()
        
        leftPadding = Gtk.Box()
        sizeGroup.add_widget(leftPadding)
        rightPadding = Gtk.Box()
        sizeGroup.add_widget(rightPadding)
        
        levelBox.pack_start(leftPadding, False, False, 0)
        levelBox.pack_start(self.levelBar, True, True, 0)
        levelBox.pack_start(rightPadding, False, False, 0)
        
        self.pack_start(levelBox, False, False, 5)
        
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
        button = Gtk.Button.new_with_label(_("Test sound"))
        self.pack_end(button, False, False, 0)
        self.pack_end(self.combo, False, False, 0)

        button.connect("clicked", self.testSpeakers)
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

    def testSpeakers(self, a):
        SoundTest(a.get_toplevel(), self.controller.get_default_sink())

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
    def __init__(self, parent, stream):
        Gtk.Dialog.__init__(self, _("Test Sound"), parent)
        
        self.stream = stream
        self.positions = []
        
        grid = Gtk.Grid()
        grid.set_column_spacing(75)
        grid.set_row_spacing(75)
        grid.set_column_homogeneous(True)
        grid.set_row_homogeneous(True)
        sizeGroup = Gtk.SizeGroup(Gtk.SizeGroupMode.BOTH)
        
        index = 0
        for position in SOUND_TEST_MAP:
            container = Gtk.Box()
            button = Gtk.Button()
            sizeGroup.add_widget(button)
            button.set_relief(Gtk.ReliefStyle.NONE)
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
        
        content_area = self.get_content_area()
        content_area.set_border_width(12)
        content_area.add(grid)
        self.show_all()
        self.setPositionHideState()
    
    def test(self, b, info):
        position = SOUND_TEST_MAP[info["index"]]

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
        self.checkInputState()
    
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
        
        # output profiles
        self.profile = ProfileSelector(self.controller)
        devSettings.add_row(self.profile)

        sizeGroup = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

        # ouput volume
        self.outVolume = VolumeBar(self.controller.get_vol_max_norm(), self.controller.get_vol_max_amplified(), sizeGroup=sizeGroup)
        devSettings.add_row(self.outVolume)

        # balance
        self.balance = BalanceBar("balance", sizeGroup=sizeGroup)
        devSettings.add_row(self.balance)
        self.fade = BalanceBar("fade", sizeGroup=sizeGroup)
        devSettings.add_row(self.fade)
        self.woofer = BalanceBar("lfe", 0, self.controller.get_vol_max_norm(), sizeGroup=sizeGroup)
        devSettings.add_row(self.woofer)
        
        ## Input page
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "input", _("Input"))

        self.inputStack = Gtk.Stack()
        page.pack_start(self.inputStack, True, True, 0)

        inputBox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)
        self.inputSelector = self.buildDeviceSelect("output", self.inputDeviceList)
        deviceSection = SettingsBox("Device")
        inputBox.pack_start(deviceSection, False, False, 0)
        deviceSection.add_row(self.inputSelector)
        
        devSettings = SettingsBox(_("Device settings"))
        inputBox.pack_start(devSettings, False, False, 0)
        
        sizeGroup = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        
        # input volume
        self.inVolume = VolumeBar(self.controller.get_vol_max_norm(), self.controller.get_vol_max_amplified(), sizeGroup=sizeGroup)
        devSettings.add_row(self.inVolume)
        
        # input level
        self.inLevel = VolumeLevelBar(sizeGroup)
        devSettings.add_row(self.inLevel)
        self.inputStack.add_named(inputBox, "inputBox")

        noInputsMessage = Gtk.Box()
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        image = Gtk.Image.new_from_icon_name("action-unavailable-symbolic", Gtk.IconSize.DIALOG)
        image.set_pixel_size(96)
        box.pack_start(image, False, False, 0)
        box.set_valign(Gtk.Align.CENTER)
        label = Gtk.Label(_("No inputs sources are currently available."))
        box.pack_start(label, False, False, 0)
        noInputsMessage.pack_start(box, True, True, 0)
        self.inputStack.add_named(noInputsMessage, "noInputsMessage")
        self.inputStack.show_all()

        ## Effects page
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "effects", _("Sound Effects"))
        
        effectsVolumeSection = page.add_section(_("Effects Volume"))
        self.effectsVolume = VolumeBar(self.controller.get_vol_max_norm(), self.controller.get_vol_max_norm())
        effectsVolumeSection.add_row(self.effectsVolume)
        
        effectsSection = SoundBox(_("Effects"))
        page.pack_start(effectsSection, True, True, 0)
        sizeGroup = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        for effect in EFFECT_LIST:
            effectsSection.add_row(Effect(effect, sizeGroup))
        
        ## Applications page
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "applications", _("Applications"))

        self.appStack = Gtk.Stack()
        page.pack_start(self.appStack, True, True, 0)

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.appSettings = SoundBox(_("Applications"))
        box.pack_start(self.appSettings, True, True, 0)
        self.appStack.add_named(box, "appSettings")

        noAppsMessage = Gtk.Box()
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        image = Gtk.Image.new_from_icon_name("action-unavailable-symbolic", Gtk.IconSize.DIALOG)
        image.set_pixel_size(96)
        box.pack_start(image, False, False, 0)
        box.set_valign(Gtk.Align.CENTER)
        label = Gtk.Label(_("No application is currently playing or recording audio."))
        box.pack_start(label, False, False, 0)
        noAppsMessage.pack_start(box, True, True, 0)
        self.appStack.add_named(noAppsMessage, "noAppsMessage")

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
        select.set_margin(0)
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

        if type == "input":
            self.checkInputState()
    
    def deviceRemoved(self, c, id, type):
        store = getattr(self, type+"DeviceList")
        for row in store:
            if row[3] == id:
                store.remove(row.iter)
                if type == "input":
                    self.checkInputState()
                return

    def checkInputState(self):
        if len(self.inputDeviceList) == 0:
            self.inputStack.set_visible_child_name("noInputsMessage")
        else:
            self.inputStack.set_visible_child_name("inputBox")
    
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
            self.appList[id] = VolumeBar(self.controller.get_vol_max_norm(), self.controller.get_vol_max_norm(), stream.props.name + ": ", stream.get_gicon())
            self.appList[id].setStream(stream)
            self.appSettings.add_row(self.appList[id])
            self.appSettings.list_box.invalidate_headers()
            self.appSettings.show_all()
        elif stream == self.controller.get_event_sink_input():
            self.effectsVolume.setStream(stream)
        
        self.checkAppState()
    
    def streamRemoved(self, c, id):
        if id in self.appList:
            self.appList[id].get_parent().destroy()
            self.appSettings.list_box.invalidate_headers()
            del self.appList[id]
            self.checkAppState()

    def checkAppState(self):
        if len(self.appList) == 0:
            self.appStack.set_visible_child_name("noAppsMessage")
        else:
            self.appStack.set_visible_child_name("appSettings")
