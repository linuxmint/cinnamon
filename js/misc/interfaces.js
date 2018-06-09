// -*- mode: js; js-indent-level: 4;

const Gio = imports.gi.Gio;

const SETTINGS_DAEMON_XRANDR_NAME = "org.cinnamon.SettingsDaemon.XRANDR_2";
const SETTINGS_DAEMON_POWER_NAME = "org.cinnamon.SettingsDaemon.Power";
const SETTINGS_DAEMON_POWER_PATH = "/org/cinnamon/SettingsDaemon/Power";

const DBusIface = '\
<node> \
    <interface name="org.freedesktop.DBus"> \
        <method name="GetNameOwner"> \
            <arg type="s" direction="in" /> \
            <arg type="s" direction="out" /> \
        </method> \
        <method name="ListNames"> \
            <arg type="as" direction="out" /> \
        </method> \
        <signal name="NameOwnerChanged"> \
            <arg type="s" direction="out" /> \
            <arg type="s" direction="out" /> \
            <arg type="s" direction="out" /> \
        </signal> \
        </interface> \
</node>';

function getDBus() {
    let proxy = Gio.DBusProxy.makeProxyWrapper(DBusIface);
    return new proxy(Gio.DBus.session,
                     'org.freedesktop.DBus',
                     '/org/freedesktop/DBus');
}

function getDBusAsync(callback) {
    let proxy = Gio.DBusProxy.makeProxyWrapper(DBusIface);
    new proxy(Gio.DBus.session,
              'org.freedesktop.DBus',
              '/org/freedesktop/DBus',
              callback);
}

/****************************************
 * Generic property monitor             *
 ****************************************/

const DBusProperties = '\
<node> \
    <interface name="org.freedesktop.DBus.Properties"> \
        <method name="Get"> \
            <arg direction="in" name="interface" type="s"/> \
            <arg direction="in" name="propname" type="s"/> \
            <arg direction="out" name="value" type="v"/> \
        </method> \
        <method name="Set"> \
            <arg direction="in" name="interface" type="s"/> \
            <arg direction="in" name="propname" type="s"/> \
            <arg direction="in" name="value" type="v"/> \
        </method> \
        <method name="GetAll"> \
            <arg direction="in" name="interface" type="s"/> \
            <arg direction="out" name="props" type="a{sv}"/> \
        </method> \
        <signal name="PropertiesChanged"> \
            <arg type="s" direction="out" /> \
            <arg type="a{sv}" direction="out" /> \
            <arg type="as" direction="out" /> \
        </signal> \
    </interface> \
</node>';

function getDBusProperties(name, path) {
    let proxy = Gio.DBusProxy.makeProxyWrapper(DBusProperties);
    return new proxy(Gio.DBus.session,
                     name,
                     path);
}

function getDBusPropertiesAsync(name, path, callback) {
    let proxy = Gio.DBusProxy.makeProxyWrapper(DBusProperties);
    new proxy(Gio.DBus.session,
              name,
              path,
              callback);
}

/****************************************
 * org.cinnamon.SettingsDaemon services *
 ****************************************/

let xml = { };

xml['org.cinnamon.SettingsDaemon.Power'] =
[
    "<node> \
        <interface name='org.cinnamon.SettingsDaemon.Power'> \
            <property name='Icon' type='s' access='read'/> \
            <property name='Tooltip' type='s' access='read'/> \
            <method name='GetPrimaryDevice'> \
                <arg name='device' type='(sssusduut)' direction='out' /> \
            </method> \
            <method name='GetDevices'> \
                <arg name='devices' type='a(sssusduut)' direction='out' /> \
            </method> \
        </interface> \
    </node>",
    SETTINGS_DAEMON_POWER_NAME,
    SETTINGS_DAEMON_POWER_PATH
];

xml['org.cinnamon.SettingsDaemon.Power.Screen'] =
[
    "<node> \
        <interface name='org.cinnamon.SettingsDaemon.Power.Screen'> \
            <method name='StepUp'> \
                <arg type='u' name='new_percentage' direction='out'/> \
            </method> \
            <method name='StepDown'> \
                <arg type='u' name='new_percentage' direction='out'/> \
            </method> \
            <method name='GetPercentage'> \
                <arg type='u' name='percentage' direction='out'/> \
            </method> \
            <method name='SetPercentage'> \
                <arg type='u' name='percentage' direction='in'/> \
                <arg type='u' name='new_percentage' direction='out'/> \
            </method> \
            <signal name='Changed'/> \
        </interface> \
    </node>",
    SETTINGS_DAEMON_POWER_NAME,
    SETTINGS_DAEMON_POWER_PATH
];

xml['org.cinnamon.SettingsDaemon.Power.Keyboard'] =
[
    "<node> \
        <interface name='org.cinnamon.SettingsDaemon.Power.Keyboard'> \
            <method name='StepUp'> \
                <arg type='u' name='new_percentage' direction='out'/> \
            </method> \
            <method name='StepDown'> \
                <arg type='u' name='new_percentage' direction='out'/> \
            </method> \
            <method name='Toggle'> \
                <arg type='u' name='new_percentage' direction='out'/> \
            </method> \
            <method name='GetPercentage'> \
                <arg type='u' name='percentage' direction='out'/> \
            </method> \
            <method name='SetPercentage'> \
                <arg type='u' name='percentage' direction='in'/> \
                <arg type='u' name='new_percentage' direction='out'/> \
            </method> \
            <signal name='Changed'> \
            </signal> \
        </interface> \
    </node>",
    SETTINGS_DAEMON_POWER_NAME,
    SETTINGS_DAEMON_POWER_PATH
];

xml['org.cinnamon.SettingsDaemon.XRANDR_2'] =
[
    "<node> \
        <interface name='org.cinnamon.SettingsDaemon.XRANDR_2'> \
            <annotation name='org.freedesktop.DBus.GLib.CSymbol' value='csd_xrandr_manager_2'/> \
            <method name='ApplyConfiguration'> \
                <arg name='parent_window_id' type='x' direction='in'/> \
                <arg name='timestamp' type='x' direction='in'/> \
            </method> \
            <method name='VideoModeSwitch'> \
                <arg name='timestamp' type='x' direction='in'/> \
            </method> \
            <method name='Rotate'> \
                <arg name='timestamp' type='x' direction='in'/> \
            </method> \
            <method name='RotateTo'> \
                <arg name='rotation' type='i' direction='in'/> \
                <arg name='timestamp' type='x' direction='in'/> \
            </method> \
        </interface> \
    </node>",
    SETTINGS_DAEMON_XRANDR_NAME,
    '/org/cinnamon/SettingsDaemon/XRANDR'
];

/****************************************
 * Ownable interfaces                   *
 ****************************************/

const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";

let xml_with_owner = { };

xml_with_owner['org.mpris.MediaPlayer2'] =
[
    "<node> \
        <interface name='org.mpris.MediaPlayer2'> \
            <method name='Raise'/> \
            <method name='Quit'/> \
            <property name='CanQuit' type='b' access='read'/> \
            <property name='CanRaise' type='b' access='read'/> \
            <property name='HasTrackList' type='b' access='read'/> \
            <property name='Identity' type='s' access='read'/> \
            <property name='DesktopEntry' type='s' access='read'/> \
            <property name='SupportedUriSchemes' type='as' access='read'/> \
            <property name='SupportedMimeTypes' type='as' access='read'/> \
        </interface> \
    </node>",
    MEDIA_PLAYER_2_PATH
]

xml_with_owner['org.mpris.MediaPlayer2.Player'] =
[
    "<node> \
        <interface name='org.mpris.MediaPlayer2.Player'> \
            <method name='Next'/> \
            <method name='Previous'/> \
            <method name='Pause'/> \
            <method name='PlayPause'/> \
            <method name='Stop'/> \
            <method name='Play'/> \
            <method name='Seek'> \
                <arg direction='in' name='Offset' type='x'/> \
            </method> \
            <method name='SetPosition'> \
                <arg direction='in' name='TrackId' type='o'/> \
                <arg direction='in' name='Position' type='x'/> \
            </method> \
            <method name='OpenUri'> \
                <arg direction='in' name='Uri' type='s'/> \
            </method> \
            <signal name='Seeked'> \
                <arg name='Position' type='x'/> \
            </signal> \
            <property name='PlaybackStatus' type='s' access='read'/> \
            <property name='LoopStatus' type='s' access='readwrite'/> \
            <property name='Rate' type='d' access='readwrite'/> \
            <property name='Shuffle' type='b' access='readwrite'/> \
            <property name='Metadata' type='a{sv}' access='read'/> \
            <property name='Volume' type='d' access='readwrite'/> \
            <property name='Position' type='x' access='read'/> \
            <property name='MinimumRate' type='d' access='read'/> \
            <property name='MaximumRate' type='d' access='read'/> \
            <property name='CanGoNext' type='b' access='read'/> \
            <property name='CanGoPrevious' type='b' access='read'/> \
            <property name='CanPlay' type='b' access='read'/> \
            <property name='CanPause' type='b' access='read'/> \
            <property name='CanSeek' type='b' access='read'/> \
            <property name='CanControl' type='b' access='read'/> \
        </interface> \
    </node>",
    MEDIA_PLAYER_2_PATH
]

/*
    More to come
*/

/***********
 * Factory *
 ***********/

function getDBusProxy(which) {
    let proxy = Gio.DBusProxy.makeProxyWrapper(xml[which][0]);
    return new proxy(Gio.DBus.session,
                     xml[which][1],
                     xml[which][2]);
}

function getDBusProxyAsync(which, callback) {
    let proxy = Gio.DBusProxy.makeProxyWrapper(xml[which][0]);
    new proxy(Gio.DBus.session,
              xml[which][1],
              xml[which][2],
              callback);
}

function getDBusProxyWithOwner(which, owner) {
    let proxy = Gio.DBusProxy.makeProxyWrapper(xml_with_owner[which][0]);
    return new proxy(Gio.DBus.session,
                     owner,
                     xml_with_owner[which][1]);
}

function getDBusProxyWithOwnerAsync(which, owner, callback) {
    let proxy = Gio.DBusProxy.makeProxyWrapper(xml_with_owner[which][0]);
    new proxy(Gio.DBus.session,
              owner,
              xml_with_owner[which][1],
              callback);
}

