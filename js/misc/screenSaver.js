// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Gio = imports.gi.Gio;

const ScreenSaverIface = 
    '<node> \
        <interface name="org.cinnamon.ScreenSaver"> \
        <method name="GetActive"> \
            <arg type="b" direction="out" /> \
        </method> \
        <method name="Lock"> \
            <arg type="s" direction="in" /> \
        </method> \
        <method name="SetActive"> \
            <arg type="b" direction="in" /> \
        </method> \
        <signal name="ActiveChanged"> \
            <arg type="b" direction="out" /> \
        </signal> \
        </interface> \
    </node>';

const ScreenSaverInfo = Gio.DBusInterfaceInfo.new_for_xml(ScreenSaverIface);

function ScreenSaverProxy() {
    var self = new Gio.DBusProxy({ g_connection: Gio.DBus.session,
                                   g_interface_name: ScreenSaverInfo.name,
                                   g_interface_info: ScreenSaverInfo,
                                   g_name: 'org.cinnamon.ScreenSaver',
                                   g_object_path: '/org/cinnamon/ScreenSaver',
                                   g_flags: (Gio.DBusProxyFlags.DO_NOT_AUTO_START |
                                             Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES) });
    self.init(null);
    self.screenSaverActive = false;

    self.connectSignal('ActiveChanged', function(proxy, senderName, [isActive]) {
        self.screenSaverActive = isActive;
    });
    self.connect('notify::g-name-owner', function() {
        if (self.g_name_owner) {
            self.GetActiveRemote(function(result, excp) {
                if (result) {
                    let [isActive] = result;
                    self.screenSaverActive = isActive;
                }
            });
        } else
            self.screenSaverActive = false;
    });

    return self;
}