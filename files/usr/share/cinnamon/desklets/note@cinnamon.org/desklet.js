// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
const Lang = imports.lang;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;

function MyDesklet(metadata, desklet_id){
    this._init(metadata, desklet_id);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata, desklet_id){
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

        this.entry = new St.Entry();
        let clutterText = this.entry.clutter_text;
        clutterText.set_single_line_mode(false);
        clutterText.set_activatable(false);
        clutterText.set_line_wrap(true);
        clutterText.set_line_wrap_mode(imports.gi.Pango.WrapMode.WORD_CHAR);

        this.entry.set_size(150, -1);
        this.actor.style="width: 100px; height: 100px";
        this.setContent(this.entry, {y_fill: true, y_align: St.Align.START});
        this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], this.instance_id);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                                  "text",
                                  "text",
                                   function() {
                                       this.entry.set_text(this.text);
                                   });
        this.entry.set_text(this.text);
        this.entry.clutter_text.connect("text-changed", Lang.bind(this, function() {
            this.text = this.entry.clutter_text.text;
        }));
    }
};

function main(metadata, desklet_id) {
    let desklet = new MyDesklet(metadata, desklet_id);
    return desklet;
}


