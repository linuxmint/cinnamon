const St = imports.gi.St;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;

var MonitorLabel = class {
    constructor(monitor, connector, info) {
        this._monitor = monitor;
        this._connector = connector;
        this._index = info[0];
        this._cloned = info[1];
        this._display_name = info[2];
        this._color = info[3];

        this.actor = new St.BoxLayout({ style_class: "monitor-label",
                                        vertical: true,
                                        important: true });

        this.actor.style = `background-color: ${this._color};`;

        let label_text;

        if (this._cloned) {
            let str = _("Mirrored Displays");
            label_text = `<b>${str}</b>`;
        } else {
            label_text = `<b>${this._index}  ${this._display_name}</b>\n${this._connector}`
        }

        this._label = new St.Label();
        this._label.clutter_text.set_markup(label_text);
        this.actor.add(this._label);

        Main.uiGroup.add_child(this.actor);

        this.actor.x = monitor.x + 6 * global.ui_scale;
        this.actor.y = monitor.y + 6 * global.ui_scale;
    }
}

var MonitorLabeler = class {
    constructor() {
        this._labels = [];
        this._tracked_clients = new Map();
        this._active = false;
        this._monitor_manager = Meta.MonitorManager.get();
        Main.layoutManager.connect('monitors-changed', () => this._update_layout());
    }

    _update_labels() {
        if (!this._active) {
            return;
        }
    }

    show(dict, sender) {
        this.watch_sender(sender);

        if (this._labels.length > 0) {
            return;
        }

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

        for (let label of this._labels) {
            label.actor.destroy();
        }

        this._labels = [];
    }

    watch_sender(sender) {
        if (this._tracked_clients.has(sender)) {
            return;
        }

        let watch_handle = Gio.bus_watch_name(Gio.BusType.SESSION, sender, 0, null, (c, name) => this.hide(name))
        this._tracked_clients.set(sender, watch_handle);
    }
};
