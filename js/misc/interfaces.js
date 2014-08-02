// -*- mode: js; js-indent-level: 4;

const Gio = imports.gi.Gio;

const SETTINGS_DAEMON_NAME = "org.cinnamon.SettingsDaemon";
const SETTINGS_DAEMON_POWER_PATH = "/org/cinnamon/SettingsDaemon/Power";

let xml = { };

xml['org.cinnamon.SettingsDaemon.Power'] =
[
    <interface name='org.cinnamon.SettingsDaemon.Power'>
        <property name='Icon' type='s' access='read'/>
        <property name='Tooltip' type='s' access='read'/>
        <method name='GetPrimaryDevice'>
            <arg name='device' type='(susdut)' direction='out' />
        </method>
        <method name='GetDevices'>
            <arg name='devices' type='a(susdut)' direction='out' />
        </method>
    </interface>,
    SETTINGS_DAEMON_NAME,
    SETTINGS_DAEMON_POWER_PATH
];

xml['org.cinnamon.SettingsDaemon.Power.Screen'] =
[
    <interface name='org.cinnamon.SettingsDaemon.Power.Screen'>
        <method name='StepUp'>
            <arg type='u' name='new_percentage' direction='out'/>
        </method>
        <method name='StepDown'>
            <arg type='u' name='new_percentage' direction='out'/>
        </method>
        <method name='GetPercentage'>
            <arg type='u' name='percentage' direction='out'/>
        </method>
        <method name='SetPercentage'>
            <arg type='u' name='percentage' direction='in'/>
            <arg type='u' name='new_percentage' direction='out'/>
        </method>
        <signal name='Changed'/>
    </interface>,
    SETTINGS_DAEMON_NAME,
    SETTINGS_DAEMON_POWER_PATH
];

xml['org.cinnamon.SettingsDaemon.Power.Keyboard'] =
[
    <interface name='org.cinnamon.SettingsDaemon.Power.Keyboard'>
        <method name='StepUp'>
            <arg type='u' name='new_percentage' direction='out'/>
        </method>
        <method name='StepDown'>
            <arg type='u' name='new_percentage' direction='out'/>
        </method>
        <method name='Toggle'>
            <arg type='u' name='new_percentage' direction='out'/>
        </method>
    </interface>,
    SETTINGS_DAEMON_NAME,
    SETTINGS_DAEMON_POWER_PATH
];

/*
    More to come
*/

function getDBusProxy(which) {
    let proxy = Gio.DBusProxy.makeProxyWrapper(xml[which][0]);
    return new proxy(Gio.DBus.session,
                     xml[which][1],
                     xml[which][2]);
}

function getDBusProxyAsync(which, callback) {
    let proxy = Gio.DBusProxy.makeProxyWrapper(xml[which][0]);
    return new proxy(Gio.DBus.session,
                     xml[which][1],
                     xml[which][2],
                     function (proxy, error) {
                          if (error) {
                              log(error.message);
                              return;
                          }
                          callback();
                     });
}
