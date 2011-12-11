// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const UI = imports.testcommon.ui;

UI.init();
let stage = Clutter.Stage.get_default();

let b = new St.BoxLayout({ vertical: true,
                           width: stage.width,
                           height: stage.height });
stage.add_actor(b);

let t;

t = new St.Label({ "text": "Bold", style_class: "bold" });
b.add(t);
t = new St.Label({ "text": "Monospace", style_class: "monospace" });
b.add(t);
t = new St.Label({ "text": "Italic", style_class: "italic" });
b.add(t);
t = new St.Label({ "text": "Bold Italic", style_class: "bold italic" });
b.add(t);
t = new St.Label({ "text": "Big Italic", style_class: "big italic" });
b.add(t);
t = new St.Label({ "text": "Big Bold", style_class: "big bold" });
b.add(t);

let b2 = new St.BoxLayout({ vertical: true, style_class: "monospace" });
b.add(b2);
t = new St.Label({ "text": "Big Monospace", style_class: "big" });
b2.add(t);
t = new St.Label({ "text": "Italic Monospace", style_class: "italic" });
b2.add(t);

stage.show();
Clutter.main();
