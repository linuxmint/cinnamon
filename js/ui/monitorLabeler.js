const GObject = imports.gi.GObject;
const St = imports.gi.St;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;

const common_css =
"                       \
  border-radius: 6px;   \
  border-width: 2px;    \
  border-color: black;  \
  color: black;         \
  padding: 12px;        \
  text-align: center;   \
";

var MonitorLabel = GObject.registerClass(
class MonitorLabel extends St.BoxLayout {
    _init(monitor, connector, info) {
        this._monitor = monitor;
        this._connector = connector;
        this._index = info[0];
        this._cloned = info[1];
        this._displayName = info[2];
        this._color = info[3];

        super._init({
            style: `${common_css} background-color: ${this._color};`,
            vertical: true,
        });

        let labelText;

        if (this._cloned) {
            let str = _("Mirrored Displays");
            labelText = `<b>${str}</b>`;
        } else {
            labelText = `<b>${this._index}  ${this._displayName}</b>\n${this._connector}`
        }

        this._label = new St.Label();
        this._label.clutter_text.set_markup(labelText);
        this.add_child(this._label);

        Main.uiGroup.add_child(this);

        this.x = monitor.x + 6 * global.ui_scale;
        this.y = monitor.y + 6 * global.ui_scale;
    }
});

var MonitorLabeler = class {
    constructor() {
        this._labels = [];
        this._tracked_clients = new Map();
        this._active = false;
        this._monitor_manager = Meta.MonitorManager.get();

        this._show_idle_id = 0;
    }

    show(dict, sender) {
        this._active = true;
        this.watch_sender(sender);

        if (this._show_idle_id != 0) {
            GLib.source_remove(this._show_idle_id);
            this._show_idle_id = 0;
        }

        this._show_idle_id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => this._real_show(dict));
    }

    _real_show(dict) {
        for (let label of this._labels) {
            label.destroy();
        }

        this._labels = [];

        for (let connector in dict) {
            let index = this._monitor_manager.get_monitor_for_connector(connector);
            if (index == -1) {
                continue;
            }

            let layout_monitor = 0;

            try {
                layout_monitor = Main.layoutManager.monitors[index];
            } catch {
                continue;
            }

            let info = dict[connector].deep_unpack();

            let label = new MonitorLabel(layout_monitor, connector, info);
            this._labels.push(label);
        }

        this._show_idle_id = 0;

        return GLib.SOURCE_REMOVE;
    }

    hide(sender=null) {
        const watch_handle = this._tracked_clients.get(sender);
        if (watch_handle !== undefined) {
            Gio.bus_unwatch_name(watch_handle);
            this._tracked_clients.delete(sender)
        }

        if (this._tracked_clients.size > 0) {
            return;
        }

        if (this._show_idle_id != 0) {
            GLib.source_remove(this._show_idle_id);
            this._show_idle_id = 0;
        }

        for (let label of this._labels) {
            label.destroy();
        }

        this._labels = [];
        this._active = false;
    }

    watch_sender(sender) {
        if (this._tracked_clients.has(sender)) {
            return;
        }

        let watch_handle = Gio.bus_watch_name(Gio.BusType.SESSION, sender, 0, null, (c, name) => this.hide(name))
        this._tracked_clients.set(sender, watch_handle);
    }
};
