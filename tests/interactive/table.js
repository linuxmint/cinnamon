// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const UI = imports.testcommon.ui;

UI.init();
let stage = Clutter.Stage.get_default();
stage.width = stage.height = 600;

let vbox = new St.BoxLayout({ vertical: true,
                              width: stage.width,
                              height: stage.height,
                              style: 'padding: 10px; '
                                     + 'spacing: 10px;'
                                     + 'font: 15px sans-serif;' });
stage.add_actor(vbox);

function L(text, color) {
    return new St.Label({ text: text,
                          style: "background: " + color + ";"
                                 + "border: 1px solid rgba(0,0,0,0.5);"
                                 + "padding: 1em;" });
}

////////////////////////////////////////////////////////////////////////////////

let table = new St.Table({ style: "border: 10px solid #888888;"
                                  + "padding: 10px;"
                                  + "spacing-rows: 5px;"
                                  + "spacing-columns: 15px;" });
vbox.add(table, { expand: true });

table.add(L("1", "#ff0000"),
          { row: 0, col: 0, col_span: 3 });
table.add(L("2", "#00ff00"),
          { row: 1, col: 0, row_span: 2 });
table.add(L("3", "#0000ff"),
          { row: 1, col: 1,
            x_expand: 0 });
table.add(L("4", "#ffff00"),
          { row: 1, col: 2,
            y_expand: 0, y_fill: 0
          });
table.add(L("5", "#ff00ff"),
          { row: 2, col: 1, x_expand: 0 });
table.add(L("6", "#00ffff"),
          { row: 2, col: 2,
            x_expand: 0, x_fill: 0, x_align: St.Align.END,
            y_expand: 0, y_fill: 0, y_align: St.Align.END });

////////////////////////////////////////////////////////////////////////////////

stage.show();
Clutter.main();
