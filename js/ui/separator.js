// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
const St = imports.gi.St;

class Separator {
    constructor() {
        this.actor = new St.Widget({ style_class: 'separator' });
    }
}
