const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {        
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        try {        
            this.set_applet_icon_symbolic_name("user-trash");
            this.set_applet_tooltip(_("Trash"));
                   
            this.trash_path = 'trash:///';
            this.trash_directory =  Gio.file_new_for_uri(this.trash_path);
            
            this._initContextMenu();

            this._onTrashChange();
            
            this.monitor = this.trash_directory.monitor_directory(0, null, null);
            this.monitor.connect('changed', Lang.bind(this, this._onTrashChange));
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    _initContextMenu: function () {
        this.empty_item = new PopupMenu.PopupIconMenuItem(_("Empty Trash"),
                Gtk.STOCK_REMOVE,
                St.IconType.SYMBOLIC);
        this.empty_item.connect('activate', Lang.bind(this, this._emptyTrash));
        this._applet_context_menu.addMenuItem(this.empty_item);

        this.open_item = new PopupMenu.PopupIconMenuItem(_("Open Trash"),
                Gtk.STOCK_OPEN,
                St.IconType.SYMBOLIC);
        this.open_item.connect('activate', Lang.bind(this, this._openTrash));
        this._applet_context_menu.addMenuItem(this.open_item);
    },
    
    on_applet_clicked: function(event) {
        this._openTrash();
    },

    _openTrash: function() {
        Gio.app_info_launch_default_for_uri(this.trash_directory.get_uri(), null);
    },
   
    _onTrashChange: function() {
      if (this.trash_directory.query_exists(null)) {
          let children = this.trash_directory.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);          
          if (children.next_file(null, null) == null) {
              this.set_applet_icon_symbolic_name("user-trash");        
          } else {
              //this.set_applet_icon_name("user-trash-full");
              this.set_applet_icon_symbolic_name("user-trash");        
          }
      }
    },

    _emptyTrash: function() {
      new ConfirmEmptyTrashDialog(Lang.bind(this, this._doEmptyTrash)).open();
    },

    _doEmptyTrash: function() {
        if (this.trash_directory.query_exists(null)) {
              let children = this.trash_directory.enumerate_children('*', 0, null, null);
              let child_info = null;
              while ((child_info = children.next_file(null, null)) != null) {
                let child = this.trash_directory.get_child(child_info.get_name());
                child.delete(null);
              }
        }      
    },
    
    on_orientation_changed: function (orientation) {
        this._initContextMenu();
    }
};

const MESSAGE = _("Are you sure you want to delete all items from the trash?") + "\n" + _("This operation cannot be undone.");

function ConfirmEmptyTrashDialog(emptyMethod) {
  this._init(emptyMethod);
}

ConfirmEmptyTrashDialog.prototype = {
  __proto__: ModalDialog.ModalDialog.prototype,

  _init: function(emptyMethod) {
    ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: null });

    let mainContentBox = new St.BoxLayout({ style_class: 'polkit-dialog-main-layout',
                                            vertical: false });
    this.contentLayout.add(mainContentBox, { x_fill: true, y_fill: true });

    let messageBox = new St.BoxLayout({ style_class: 'polkit-dialog-message-layout',
                                        vertical: true });
    mainContentBox.add(messageBox, { y_align: St.Align.START });

    this._subjectLabel = new St.Label({ style_class: 'polkit-dialog-headline',
                                        text: _("Empty Trash?") });

    messageBox.add(this._subjectLabel, { y_fill:  false, y_align: St.Align.START });

    this._descriptionLabel = new St.Label({ style_class: 'polkit-dialog-description',
                                            text: MESSAGE });

    messageBox.add(this._descriptionLabel, { y_fill:  true, y_align: St.Align.START });

    this.setButtons([
      {
        label: _("Cancel"),
        action: Lang.bind(this, function() {
          this.close();
        }),
        key: Clutter.Escape
      },
      {
        label: _("Empty"),
        action: Lang.bind(this, function() {
          this.close();
          emptyMethod();
        })
      }
    ]);
  }
};

function main(metadata, orientation, panel_height, instance_id) {      
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;      
}
