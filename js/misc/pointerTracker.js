// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;

function PointerTracker(){
    this._init();
}

PointerTracker.prototype = {
    _init: function() {
        let [lastPointerX, lastPointerY] = global.get_pointer();

        this.hasMoved = function() {
            let [pointerX, pointerY] = global.get_pointer();
            try {
                return !(pointerX == lastPointerX && pointerY == lastPointerY);
            } finally {
                [lastPointerX, lastPointerY] = [pointerX, pointerY];
            }
        };
        this.getPosition = function() {
            [lastPointerX, lastPointerY] = global.get_pointer();
            return [lastPointerX, lastPointerY];
        };
        this.setPosition = function(x, y) {
            let [pointerX, pointerY] = global.get_pointer();

            const seat = Clutter.get_default_backend().get_default_seat();
            seat.warp_pointer(Math.round(x), Math.round(y));

            [lastPointerX, lastPointerY] = [pointerX, pointerY];
        };
    }
};


var PointerSwitcher = class {
    constructor(wm) {
        this.settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.keybindings" });
        this.settings.connect("changed", (settings, key) => {
            if (["pointer-next-monitor", "pointer-previous-monitor"].includes(key)) {
                this.update_settings();
            }
        });

        this.update_settings()
    }

    update_settings() {
        Main.keybindingManager.addHotKeyArray(
            "pointer-next-monitor",
            this.settings.get_strv("pointer-next-monitor"),
            () => this.next_monitor()
        );

        Main.keybindingManager.addHotKeyArray(
            "pointer-previous-monitor",
            this.settings.get_strv("pointer-previous-monitor"),
            () => this.previous_monitor()
        );
    }

    get_normalized_pointer_position_for_monitor(index) {
        let [global_x, global_y, mods] = global.get_pointer();
        const monitor = Main.layoutManager.monitors[index];

        let rx = global_x - monitor.x;
        let ry = global_y - monitor.y;

        let nx = rx / monitor.width;
        let ny = ry / monitor.height;

        if (nx < 0 || nx > 1.0)
            nx = 0.5;
        if (ny < 0 || ny > 1.0)
            ny = 0.5;

        return [nx, ny];
    }

    get_real_pointer_position(index, nx, ny) {
        const monitor = Main.layoutManager.monitors[index];

        let real_x = (nx * monitor.width) + monitor.x;
        let real_y = (nx * monitor.height) + monitor.y;

        return [real_x, real_y];
    }

    next_monitor() {
        const current = global.display.get_current_monitor();
        const max = global.display.get_n_monitors() - 1;
        const new_mon = current + 1 <= max ? current + 1 : 0;

        this.move_from_to_monitor(current, new_mon);
    }

    previous_monitor() {
        const current = global.display.get_current_monitor();
        const max = global.display.get_n_monitors() - 1;
        const new_mon = current - 1 >= 0 ? current - 1 : max;

        this.move_from_to_monitor(current, new_mon);
    }

    move_from_to_monitor(from_i, to_i) {
        const center = global.settings.get_boolean("center-warped-pointer")

        let nx, ny;

        if (global.settings.get_boolean("center-warped-pointer")) {
            nx = ny = 0.5;
        } else {
            [nx, ny] = this.get_normalized_pointer_position_for_monitor(from_i);
        }

        let [x, y] = this.get_real_pointer_position(to_i, nx, ny);

        global.set_pointer(x, y);
    }
};

