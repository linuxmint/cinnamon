// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const St = imports.gi.St;

const GnomeSession = imports.misc.gnomeSession;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Params = imports.misc.params;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;
const AppletManager = imports.ui.appletManager;

var ANIMATION_TIME = 0.2;
var NOTIFICATION_TIMEOUT = 4;
var NOTIFICATION_CRITICAL_TIMEOUT_WITH_APPLET = 10;
var SUMMARY_TIMEOUT = 1;
var LONGER_SUMMARY_TIMEOUT = 4;

var HIDE_TIMEOUT = 0.2;
var LONGER_HIDE_TIMEOUT = 0.6;

const NOTIFICATION_IMAGE_SIZE = 125;
const NOTIFICATION_IMAGE_OPACITY = 230; // 0 - 255

var State = {
    HIDDEN:  0,
    SHOWING: 1,
    SHOWN:   2,
    HIDING:  3
};

// These reasons are useful when we destroy the notifications received through
// the notification daemon. We use EXPIRED for transient notifications that the
// user did not interact with, DISMISSED for all other notifications that were
// destroyed as a result of a user action, and SOURCE_CLOSED for the notifications
// that were requested to be destroyed by the associated source.
var NotificationDestroyedReason = {
    EXPIRED: 1,
    DISMISSED: 2,
    SOURCE_CLOSED: 3
};

// Message tray has its custom Urgency enumeration. LOW, NORMAL and CRITICAL
// urgency values map to the corresponding values for the notifications received
// through the notification daemon. HIGH urgency value is used for chats received
// through the Telepathy client.
var Urgency = {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    CRITICAL: 3
};

function _fixMarkup(text, allowMarkup) {
    if (allowMarkup) {
        // Support &amp;, &quot;, &apos;, &lt; and &gt;, escape all other
        // occurrences of '&'.
        let _text = text.replace(/&(?!amp;|quot;|apos;|lt;|gt;)/g, '&amp;');

        // Support <b>, <i>, and <u>, escape anything else
        // so it displays as raw markup.
        _text = _text.replace(/<(?!\/?[biu]>)/g, '&lt;');

        try {
            Pango.parse_markup(_text, -1, '');
            return _text;
        } catch (e) {}
    }

    // !allowMarkup, or invalid markup
    return GLib.markup_escape_text(text, -1);
}

function URLHighlighter(text, lineWrap, allowMarkup) {
    this._init(text, lineWrap, allowMarkup);
}

URLHighlighter.prototype = {
    _init: function(text, lineWrap, allowMarkup) {
        if (!text)
            text = '';
        this.actor = new St.Label({ reactive: true, style_class: 'url-highlighter' });
        this._linkColor = '#ccccff';
        this.actor.connect('style-changed', Lang.bind(this, function() {
            let [hasColor, color] = this.actor.get_theme_node().lookup_color('link-color', false);
            if (hasColor) {
                let linkColor = color.to_string().substr(0, 7);
                if (linkColor != this._linkColor) {
                    this._linkColor = linkColor;
                    this._highlightUrls();
                }
            }
        }));
        if (lineWrap) {
            this.actor.clutter_text.line_wrap = true;
            this.actor.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            this.actor.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        }

        this.setMarkup(text, allowMarkup);
        this.actor.connect('button-press-event', Lang.bind(this, function(actor, event) {
            // Don't try to URL highlight when invisible.
            // The MessageTray doesn't actually hide us, so
            // we need to check for paint opacities as well.
            if (!actor.visible || actor.get_paint_opacity() == 0)
                return false;

            // Keep Notification.actor from seeing this and taking
            // a pointer grab, which would block our button-release-event
            // handler, if an URL is clicked
            return this._findUrlAtPos(event) != -1;
        }));
        this.actor.connect('button-release-event', Lang.bind(this, function (actor, event) {
            if (!actor.visible || actor.get_paint_opacity() == 0)
                return false;

            let urlId = this._findUrlAtPos(event);
            if (urlId != -1) {
                let url = this._urls[urlId].url;
                if (url.indexOf(':') == -1)
                    url = 'http://' + url;
                try {
                    Gio.app_info_launch_default_for_uri(url, global.create_app_launch_context());
                    return true;
                } catch (e) {
                    // TODO: remove this after gnome 3 release
                    Util.spawn(['gio', 'open', url]);
                    return true;
                }
            }
            return false;
        }));
        this.actor.connect('motion-event', Lang.bind(this, function(actor, event) {
            if (!actor.visible || actor.get_paint_opacity() == 0)
                return false;

            let urlId = this._findUrlAtPos(event);
            if (urlId != -1 && !this._cursorChanged) {
                global.set_cursor(Cinnamon.Cursor.POINTING_HAND);
                this._cursorChanged = true;
            } else if (urlId == -1) {
                global.unset_cursor();
                this._cursorChanged = false;
            }
            return false;
        }));
        this.actor.connect('leave-event', Lang.bind(this, function() {
            if (!this.actor.visible || this.actor.get_paint_opacity() == 0)
                return;

            if (this._cursorChanged) {
                this._cursorChanged = false;
                global.unset_cursor();
            }
        }));
    },

    setMarkup: function(text, allowMarkup) {
        text = text ? _fixMarkup(text, allowMarkup) : '';
        this._text = text;

        this.actor.clutter_text.set_markup(text);
        /* clutter_text.text contain text without markup */
        this._urls = Util.findUrls(this.actor.clutter_text.text);
        this._highlightUrls();
    },

    _highlightUrls: function() {
        // text here contain markup
        let urls = Util.findUrls(this._text);
        let markup = '';
        let pos = 0;
        for (let i = 0; i < urls.length; i++) {
            let url = urls[i];
            let str = this._text.substr(pos, url.pos - pos);
            markup += str + '<span foreground="' + this._linkColor + '"><u>' + url.url + '</u></span>';
            pos = url.pos + url.url.length;
        }
        markup += this._text.substr(pos);
        this.actor.clutter_text.set_markup(markup);
    },

    _findUrlAtPos: function(event) {
        if (!this._urls.length)
            return -1;

        let success;
        let [x, y] = event.get_coords();
        let ct = this.actor.clutter_text;
        [success, x, y] = ct.transform_stage_point(x, y);
        if (success && x >= 0 && x <= ct.width
                    && y >= 0 && y <= ct.height) {
            let pos = ct.coords_to_position(x, y);
            for (let i = 0; i < this._urls.length; i++) {
                let url = this._urls[i]
                if (pos >= url.pos && pos <= url.pos + url.url.length)
                    return i;
            }
        }
        return -1;
    }
};


/**
 * #Notification:
 * @short_description: A shell notification.
 * @source (object): The notification's Source
 * @title (string): The title/summary text
 * @body (string): Optional - body text
 * @params (object): Optional - additional params
 *
 * Creates a notification with the associated title and body
 *
 * @params can contain values for 'body', 'icon', 'titleMarkup',
 * 'bodyMarkup', and 'silent' parameters.
 *
 * By default, the icon shown is created by calling
 * source.createNotificationIcon(). However, if @params contains an 'icon'
 * parameter, the passed in icon will be shown.
 *
 * If @params contains a 'titleMarkup', or 'bodyMarkup' parameter
 * with the value %true, then the corresponding element is assumed to
 * use pango markup. If the parameter is not present for an element,
 * then anything that looks like markup in that element will appear
 * literally in the output.
 *
 * If @params contains a 'silent' parameter with the value %true, then
 * the associated sound effects are suppressed. Note that notifications
 * with an URGENT priority will always play a sound effect if there is
 * one set.
 */
var Notification = class Notification {
    constructor(source, title, body, params) {
        this.source = source;
        this.title = title;
        this.urgency = Urgency.NORMAL;
        this.resident = false;
        // 'transient' is a reserved keyword in JS, so we have to use an alternate variable name
        this.isTransient = false;
        this.silent = false;
        this._destroyed = false;
        this._useActionIcons = false;
        this._titleDirection = St.TextDirection.NONE;
        this._scrollArea = null;
        this._actionArea = null;
        this._imageBin = null;
        this._timestamp = new Date();
        this._inNotificationBin = false;

        source.connect('destroy', (source, reason) => { this.destroy(reason) });

        this.actor = new St.Button({ accessible_role: Atk.Role.NOTIFICATION });
        this.actor._parent_container = null;
        this.actor.connect('clicked', () => this._onClicked());
        this.actor.connect('destroy', () => this._onDestroy());

        this._table = new St.Table({ name: 'notification',
                                     reactive: true });
        this.actor.set_child(this._table);

        this._buttonFocusManager = St.FocusManager.get_for_stage(global.stage);

        // the banner box is now just a simple vbox.
        // The first line should have the time, and the second the title.
        // Time only shown inside message tray.
        this._bannerBox = new St.BoxLayout({ vertical: true,
                                             style: "spacing: 4px" });
        this._table.add(this._bannerBox, { row: 0,
                                           col: 1,
                                           col_span: 2,
                                           x_expand: false,
                                           y_expand: false,
                                           y_fill: false });

        this._timeLabel = new St.Label({ show_on_set_parent: false });
        this._titleLabel = new St.Label();
        this._titleLabel.clutter_text.line_wrap = true;
        this._titleLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this._bannerBox.add_actor(this._timeLabel);
        this._bannerBox.add_actor(this._titleLabel);

        // This is an empty cell that overlaps with this._bannerBox cell to ensure
        // that this._bannerBox cell expands horizontally, while not forcing the
        // this._imageBin that is also in col: 2 to expand horizontally.
        this._table.add(new St.Bin(), { row: 0,
                                        col: 2,
                                        y_expand: false,
                                        y_fill: false });

        // notification dismiss button
        let icon = new St.Icon({ icon_name: 'window-close',
                                 icon_type: St.IconType.SYMBOLIC,
                                 icon_size: 16 });
        let closeButton = new St.Button({ child: icon, opacity: 128 });
        closeButton.connect('clicked', Lang.bind(this, this.destroy));
        closeButton.connect('notify::hover', function() { closeButton.opacity = closeButton.hover ? 255 : 128; });
        this._table.add(closeButton, { row: 0,
                                       col: 3,
                                       x_expand: false,
                                       y_expand: false,
                                       y_fill: false,
                                       y_align: St.Align.START });

        // set icon, title, body
        this.update(title, body, params);
    }

    // for backwards compatibility with old class constant
    get IMAGE_SIZE() { return NOTIFICATION_IMAGE_SIZE; }

    /**
     * update:
     * @title (string): the new title
     * @body (string): the new body
     * @params (object): as in the Notification constructor
     *
     * Updates the notification timestamp, title, and body and
     * regenerates the icon.
     */
    update(title, body, params) {
        this._timestamp = new Date();
        this._inNotificationBin = false;
        params = Params.parse(params, { icon: null,
                                        titleMarkup: false,
                                        bodyMarkup: false,
                                        silent: false });

        this.silent = params.silent;

        if (this._icon && params.icon) {
            this._icon.destroy();
            this._icon = null;
        }

        if (!this._icon) {
            this._icon = params.icon || this.source.createNotificationIcon();
            this._table.add(this._icon, { row: 0,
                                          col: 0,
                                          x_expand: false,
                                          y_expand: false,
                                          y_fill: false,
                                          y_align: St.Align.START });
        }

        // title: strip newlines, escape or validate markup, add bold markup
        if (typeof(title) === "string") {
            this.title = _fixMarkup(title.replace(/\n/g, ' '), params.titleMarkup);
        } else {
            this.title = "";
        }
        this._titleLabel.clutter_text.set_markup('<b>' + this.title + '</b>');

        this._timeLabel.clutter_text.set_markup(this._timestamp.toLocaleTimeString());
        this._timeLabel.hide();

        if (Pango.find_base_dir(title, -1) == Pango.Direction.RTL)
            this._titleDirection = St.TextDirection.RTL;
        else
            this._titleDirection = St.TextDirection.LTR;

        // Let the title's text direction control the overall direction
        // of the notification - in case where different scripts are used
        // in the notification, this is the right thing for the icon, and
        // arguably for action buttons as well. Labels other than the title
        // will be allocated at the available width, so that their alignment
        // is done correctly automatically.
        this._table.set_direction(this._titleDirection);

        this._setBodyArea(body, params.bodyMarkup);
    }

    _setBodyArea(text, allowMarkup) {
        if (text) {
            if (!this._scrollArea) {
                /* FIXME: vscroll should be enabled
                 * -vfade covers too much for this size of scrollable
                 * -scrollview min-height is broken inside tray with a scrollview
                 * 
                 * TODO: when scrollable:
                 * 
                 * applet connects to this signal to enable captured-event passthru so you can grab the scrollbar:
                 * let vscroll = this._scrollArea.get_vscroll_bar();
                 * vscroll.connect('scroll-start', () => { this.emit('scrolling-changed', true) });
                 * vscroll.connect('scroll-stop', () => { this.emit('scrolling-changed', false) });
                 * 
                 * `enable_mouse_scrolling` makes it difficult to scroll when there are many notifications
                 * in the tray because most of the area is these smaller scrollviews which capture the event.
                 * ideally, this should only be disabled when the notification is in the tray and there are
                 * many notifications.
                 */
                this._scrollArea = new St.ScrollView({ name: 'notification-scrollview',
                                                       vscrollbar_policy: Gtk.PolicyType.NEVER,
                                                       hscrollbar_policy: Gtk.PolicyType.NEVER,
                                                       enable_mouse_scrolling: false/*,
                                                       style_class: 'vfade'*/ });

                this._table.add(this._scrollArea, { row: 1,
                                                    col: 2 });

                let content = new St.BoxLayout({ name: 'notification-body',
                                                 vertical: true });
                this._scrollArea.add_actor(content);

                // body label
                this._bodyUrlHighlighter = new URLHighlighter("", true, false);
                content.add(this._bodyUrlHighlighter.actor);
            }
            this._bodyUrlHighlighter.setMarkup(text, allowMarkup);
        } else {
            if (this._scrollArea) {
                this._scrollArea.destroy()
                this._scrollArea = null;
                this._bodyUrlHighlighter.destroy()
                this._bodyUrlHighlighter = null;
            }
        }
        this._updateLayout();
    }

    setIconVisible(visible) {
        if (this._icon)
            this._icon.visible = visible;
    }

   /**
     * scrollTo:
     * @side (St.Side): St.Side.TOP or St.Side.BOTTOM
     * 
     * Scrolls the content area (if scrollable) to the indicated edge
     */
    scrollTo(side) {
        if (!this._scrollArea)
            return;
        let adjustment = this._scrollArea.vscroll.adjustment;
        if (side == St.Side.TOP)
            adjustment.value = adjustment.lower;
        else if (side == St.Side.BOTTOM)
            adjustment.value = adjustment.upper;
    }

    _updateLayout() {
        if (this._imageBin || this._scrollArea || this._actionArea) {
            this._table.add_style_class_name('multi-line-notification');
        } else {
            this._table.remove_style_class_name('multi-line-notification');
        }

        if (this._imageBin) {
            this._table.add_style_class_name('notification-with-image');
        } else {
            this._table.remove_style_class_name('notification-with-image');
        }

        if (this._scrollArea)
            this._table.child_set(this._scrollArea, { col: this._imageBin ? 2 : 1,
                                                     col_span: this._imageBin ? 2 : 3 });
        if (this._actionArea)
            this._table.child_set(this._actionArea, { col: this._imageBin ? 2 : 1,
                                                      col_span: this._imageBin ? 2 : 3 });
    }

    setImage(image) {
        if (this._imageBin)
            this.unsetImage();
        if (!image)
            return;
        this._imageBin = new St.Bin({ child: image,
                                      opacity: NOTIFICATION_IMAGE_OPACITY });
        this._table.add(this._imageBin, { row: 1,
                                          col: 1,
                                          row_span: 2,
                                          x_expand: false,
                                          y_expand: false,
                                          x_fill: false,
                                          y_fill: false });
        this._updateLayout();
    }

    unsetImage() {
        if (!this._imageBin)
            return;
        this._imageBin.destroy();
        this._imageBin = null;
        this._updateLayout();
    }

    /**
     * addButton:
     * @id (number): the action ID
     * @label (string): the label for the action's button
     * 
     * Adds a button with the given @label to the notification. All
     * action buttons will appear in a single row at the bottom of
     * the notification.
     * 
     * If the button is clicked, the notification will emit the
     * %action-invoked signal with @id as a parameter.
     */
    addButton(id, label) {
        if (!this._actionArea) {
            this._actionArea = new St.BoxLayout({ name: 'notification-actions' });
            this._table.add(this._actionArea, { row: 2,
                                                col: 1,
                                                col_span: 3,
                                                x_expand: true,
                                                y_expand: false,
                                                x_fill: true,
                                                y_fill: false,
                                                x_align: St.Align.START });
        }

        let button = new St.Button({ can_focus: true });

        if (this._useActionIcons
            && id.endsWith("-symbolic")
            && Gtk.IconTheme.get_default().has_icon(id)) {
            button.add_style_class_name('notification-icon-button');
            button.child = new St.Icon({ icon_name: id });
        } else {
            button.add_style_class_name('notification-button');
            button.label = label;
        }

        if (this._actionArea.get_n_children() > 0)
            this._buttonFocusManager.remove_group(this._actionArea);

        this._actionArea.add(button);
        this._buttonFocusManager.add_group(this._actionArea);
        button.connect('clicked', Lang.bind(this, this._onActionInvoked, id));
        this._updateLayout();
    }

    /**
     * clearButtons:
     * 
     * Removes all buttons.
     */
    clearButtons() {
        if (!this._actionArea)
            return;
        this._actionArea.destroy();
        this._actionArea = null;
        this._updateLayout();
    }

    setUrgency(urgency) {
        this.urgency = urgency;
    }

    setResident(resident) {
        this.resident = resident;
    }

    setTransient(isTransient) {
        this.isTransient = isTransient;
    }

    setUseActionIcons(useIcons) {
        this._useActionIcons = useIcons;
    }

    _onActionInvoked(actor, mouseButtonClicked, id) {
        this.emit('action-invoked', id);
        if (!this.resident) {
            // We don't hide a resident notification when the user invokes one of its actions,
            // because it is common for such notifications to update themselves with new
            // information based on the action. We'd like to display the updated information
            // in place, rather than pop-up a new notification.
            this.emit('done-displaying');
            this.destroy();
        }
    }

    _onClicked() {
        this.emit('clicked');
        // We hide all types of notifications once the user clicks on them because the common
        // outcome of clicking should be the relevant window being brought forward and the user's
        // attention switching to the window.
        this.emit('done-displaying');
        if (!this.resident)
            this.destroy();
    }

    _onDestroy() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        if (!this._destroyedReason)
            this._destroyedReason = NotificationDestroyedReason.DISMISSED;
        this.emit('destroy', this._destroyedReason);
        this.disconnectAll();
    }

    destroy(reason) {
        this._destroyedReason = reason;
        this.actor.destroy();
    }
};
Signals.addSignalMethods(Notification.prototype);

function Source(title) {
    this._init(title);
}

Source.prototype = {
    ICON_SIZE: 24,
    MAX_NOTIFICATIONS: 10,

    _init: function(title) {
        this.title = title;

        this.actor = new St.Bin({ x_fill: true,
                                  y_fill: true });
        this.actor.connect('destroy', () => { this._actorDestroyed = true });
        this._actorDestroyed = false;

        this.isTransient = false;
        this.isChat = false;

        this.notifications = [];
    },

    _updateCount: function() {
        let count = this.notifications.length;
        if (count > this.MAX_NOTIFICATIONS) {
            let oldestNotif = this.notifications.shift();
            oldestNotif.destroy();
        }
    },

    setTransient: function(isTransient) {
        this.isTransient = isTransient;
    },

    // Called to create a new icon actor (of size this.ICON_SIZE).
    // Must be overridden by the subclass if you do not pass icons
    // explicitly to the Notification() constructor.
    createNotificationIcon: function() {
        throw new Error('no implementation of createNotificationIcon in ' + this);
    },

    // Unlike createNotificationIcon, this always returns the same actor;
    // there is only one summary icon actor for a Source.
    getSummaryIcon: function() {
        return this.actor;
    },

    pushNotification: function(notification) {
        if (this.notifications.indexOf(notification) < 0) {
            this.notifications.push(notification);
            this.emit('notification-added', notification);
        }

        notification.connect('clicked', () => { this.open() });
        notification.connect('destroy', () => {
            let index = this.notifications.indexOf(notification);
            if (index < 0)
                return;

            this.notifications.splice(index, 1);
            if (this.notifications.length == 0)
                this._lastNotificationRemoved();
        });

        this._updateCount();
    },

    notify: function(notification) {
        this.pushNotification(notification);
        this.emit('notify', notification);
    },

    destroy: function(reason) {
        this.emit('destroy', reason);
    },

    //// Protected methods ////

    // The subclass must call this at least once to set the summary icon.
    _setSummaryIcon: function(icon) {
        if (this.actor.child)
            this.actor.child.destroy();
        this.actor.child = icon;
    },

    // Default implementation is to do nothing, but subclasses can override
    open: function(notification) {
    },

    destroyNonResidentNotifications: function() {
        for (let i = this.notifications.length - 1; i >= 0; i--)
            if (!this.notifications[i].resident)
                this.notifications[i].destroy();
    },

    // Default implementation is to destroy this source, but subclasses can override
    _lastNotificationRemoved: function() {
        this.destroy();
    }
};
Signals.addSignalMethods(Source.prototype);

function MessageTray() {
    this._init();
}

MessageTray.prototype = {
    _init: function() {
        this._presence = new GnomeSession.Presence(Lang.bind(this, function(proxy, error) {
            this._onStatusChanged(proxy.status);
        }));

        this._userStatus = GnomeSession.PresenceStatus.AVAILABLE;
        this._busy = false;
        this._backFromAway = false;

        this._presence.connectSignal('StatusChanged', Lang.bind(this, function(proxy, senderName, [status]) {
            this._onStatusChanged(status);
        }));

        this._notificationBin = new St.Bin();
        this._notificationBin.hide();
        this._notificationQueue = [];
        this._notification = null;

        this._locked = false;
        this._notificationState = State.HIDDEN;
        this._notificationTimeoutId = 0;
        this._notificationExpandedId = 0;
        this._notificationRemoved = false;

        this._sources = [];
        Main.layoutManager.addChrome(this._notificationBin);

		// Settings
        this.settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.notifications" })
		function setting(self, source, camelCase, dashed) {
			function updater() { self[camelCase] = source.get_boolean(dashed); }
			source.connect('changed::'+dashed, updater);
			updater();
		}
		setting(this, this.settings, "_notificationsEnabled", "display-notifications");
        this.bottomPosition = this.settings.get_boolean("bottom-notifications");
        this.settings.connect("changed::bottom-notifications", () => {
            this.bottomPosition = this.settings.get_boolean("bottom-notifications");
        });

        let updateLockState = Lang.bind(this, function() {
            if (this._locked) {
                this._unlock();
            } else {
                this._updateState();
            }
        });

        Main.overview.connect('showing', updateLockState);
        Main.overview.connect('hiding', updateLockState);
        Main.expo.connect('showing', updateLockState);
        Main.expo.connect('hiding', updateLockState);
    },

    contains: function(source) {
        return this._getSourceIndex(source) >= 0;
    },

    _getSourceIndex: function(source) {
        return this._sources.indexOf(source);
    },

    add: function(source) {
        if (this.contains(source)) {
            log('Trying to re-add source ' + source.title);
            return;
        }

        source.connect('notify', Lang.bind(this, this._onNotify));

        source.connect('destroy', Lang.bind(this, this._onSourceDestroy));
    },

    _onSourceDestroy: function(source) {
        let index = this._getSourceIndex(source);
        if (index == -1)
            return;

        this._sources.splice(index, 1);

        let needUpdate = false;

        if (this._notification && this._notification.source == source) {
            this._updateNotificationTimeout(0);
            this._notificationRemoved = true;
            needUpdate = true;
        }

        if (needUpdate)
            this._updateState();
    },

    _onNotificationDestroy: function(notification) {
        if (this._notification == notification && (this._notificationState == State.SHOWN || this._notificationState == State.SHOWING)) {
            this._updateNotificationTimeout(0);
            this._notificationRemoved = true;
            this._updateState();
            return;
        }

        let index = this._notificationQueue.indexOf(notification);
        notification.destroy();
        if (index != -1)
            this._notificationQueue.splice(index, 1);
    },

    _lock: function() {
        this._locked = true;
    },

    _unlock: function() {
        if (!this._locked)
            return;
        this._locked = false;
        this._updateState();
    },

    _onNotify: function(source, notification) {
        if (this._notification == notification) {
            // If a notification that is being shown is updated, we update
            // how it is shown and extend the time until it auto-hides.
            // If a new notification is updated while it is being hidden,
            // we stop hiding it and show it again.
            this._updateShowingNotification();
        } else if (this._notificationQueue.indexOf(notification) < 0) {
            notification.connect('destroy',
                                 Lang.bind(this, this._onNotificationDestroy));
            this._notificationQueue.push(notification);
            this._notificationQueue.sort(function(notification1, notification2) {
                return (notification2.urgency - notification1.urgency);
            });
        }
        this._updateState();
    },

    _onStatusChanged: function(status) {
        this._backFromAway = (this._userStatus == GnomeSession.PresenceStatus.IDLE && this._userStatus != status);
        this._userStatus = status;

        if (status == GnomeSession.PresenceStatus.BUSY) {
            // remove notification and allow the summary to be closed now
            this._updateNotificationTimeout(0);
            this._busy = true;
        } else if (status != GnomeSession.PresenceStatus.IDLE) {
            // We preserve the previous value of this._busy if the status turns to IDLE
            // so that we don't start showing notifications queued during the BUSY state
            // as the screensaver gets activated.
            this._busy = false;
        }

        this._updateState();
    },

    // All of the logic for what happens when occurs here; the various
    // event handlers merely update variables and
    // _updateState() figures out what (if anything) needs to be done
    // at the present time.
    _updateState: function() {
        // Notifications
        let notificationUrgent = this._notificationQueue.length > 0 && this._notificationQueue[0].urgency == Urgency.CRITICAL;
        let notificationsPending = this._notificationQueue.length > 0 && (!this._busy || notificationUrgent);

        let notificationExpired = (this._notificationTimeoutId == 0 &&
                !(this._notification && this._notification.urgency == Urgency.CRITICAL) &&
                !this._locked
            ) || this._notificationRemoved;
        let canShowNotification = notificationsPending && this._notificationsEnabled;

        if (this._notificationState == State.HIDDEN) {
            if (canShowNotification) {
                this._showNotification();
            }
            else if (!this._notificationsEnabled) {
                if (notificationsPending) {
                    this._notification = this._notificationQueue.shift();
                    if (AppletManager.get_role_provider_exists(AppletManager.Roles.NOTIFICATIONS)) {
                        this.emit('notify-applet-update', this._notification);
                    } else {
                        this._notification.destroy(NotificationDestroyedReason.DISMISSED);
                        this._notification = null;
                    }
                }
            }
        } else if (this._notificationState == State.SHOWN) {
            if (notificationExpired)
                this._hideNotification();
        }
    },

    _tween: function(actor, statevar, value, params) {
        let onComplete = params.onComplete;
        let onCompleteScope = params.onCompleteScope;
        let onCompleteParams = params.onCompleteParams;

        params.onComplete = this._tweenComplete;
        params.onCompleteScope = this;
        params.onCompleteParams = [statevar, value, onComplete, onCompleteScope, onCompleteParams];

        Tweener.addTween(actor, params);

        let valuing = (value == State.SHOWN) ? State.SHOWING : State.HIDING;
        this[statevar] = valuing;
    },

    _tweenComplete: function(statevar, value, onComplete, onCompleteScope, onCompleteParams) {
        this[statevar] = value;
        if (onComplete)
            onComplete.apply(onCompleteScope, onCompleteParams);
        this._updateState();
    },

    _showNotification: function() {
        this._notification = this._notificationQueue.shift();
        if (this._notification.actor._parent_container) {
            this._notification.actor._parent_container.remove_actor(this._notification.actor);
        }

        this._notificationBin.child = this._notification.actor;
        this._notificationBin.opacity = 0;

        let monitor = Main.layoutManager.primaryMonitor;
        let topPanel = Main.panelManager.getPanel(0, 0);
        let bottomPanel = Main.panelManager.getPanel(0, 1);
        let rightPanel = Main.panelManager.getPanel(0, 3);
        let topGap = 10;
        let bottomGap = 10;
        let rightGap = 0;

        if (rightPanel) {
            rightGap += rightPanel.actor.get_width();
        }

        if (!this.bottomPosition) {
            if (topPanel) {
                topGap += topPanel.actor.get_height();
            }
            this._notificationBin.y = monitor.y + topGap; // Notifications appear from here (for the animation)
        }

        let margin = this._notification._table.get_theme_node().get_length('margin-from-right-edge-of-screen');
        this._notificationBin.x = monitor.x + monitor.width - this._notification._table.width - margin - rightGap;
        if (!this._notification.silent || this._notification.urgency >= Urgency.HIGH) {
            Main.soundManager.play('notification');
        }
        if (this._notification.urgency == Urgency.CRITICAL) {
            Main.layoutManager._chrome.modifyActorParams(this._notificationBin, { visibleInFullscreen: true });
        } else {
            Main.layoutManager._chrome.modifyActorParams(this._notificationBin, { visibleInFullscreen: false });
        }
        this._notificationBin.show();

        if (this.bottomPosition) {
            if (bottomPanel) {
                bottomGap += bottomPanel.actor.get_height();
            }
            let getBottomPositionY = () => {
                return monitor.y + monitor.height - this._notificationBin.height - bottomGap;
            };
            let shouldReturn = false;
            let initialY = getBottomPositionY();
            // For multi-line notifications, the correct height will not be known until the notification is done animating,
            // so this will set _notificationBin.y when queue-redraw is emitted, and return early if the  height decreases
            // to prevent unnecessary property setting.
            this.bottomPositionSignal = this._notificationBin.connect('queue-redraw', () => {
                if (shouldReturn) {
                    return;
                }
                this._notificationBin.y = getBottomPositionY();
                if (initialY > this._notificationBin.y) {
                    shouldReturn = true;
                }
            });
        }

        this._updateShowingNotification();

        let [x, y, mods] = global.get_pointer();
        // We save the distance of the mouse to the notification at the time
        // when we started showing the it and then we update it in
        // _notifiationTimeout() if the mouse is moving towards the notification.
        // We don't pop down the notification if the mouse is moving towards it.
        this._lastSeenMouseDistance = Math.abs(this._notificationBin.y - y);
    },

    _updateShowingNotification: function() {
        Tweener.removeTweens(this._notificationBin);
        let tweenParams = { opacity: 255,
                            time: ANIMATION_TIME,
                            transition: 'easeOutQuad',
                            onComplete: this._showNotificationCompleted,
                            onCompleteScope: this };
        this._tween(this._notificationBin, '_notificationState', State.SHOWN, tweenParams);
   },

    _showNotificationCompleted: function() {
        this._updateNotificationTimeout(0);

        if (this._notification.urgency != Urgency.CRITICAL) {
            this._updateNotificationTimeout(NOTIFICATION_TIMEOUT * 1000);
        } else if (AppletManager.get_role_provider_exists(AppletManager.Roles.NOTIFICATIONS)) {
            this._updateNotificationTimeout(NOTIFICATION_CRITICAL_TIMEOUT_WITH_APPLET * 1000);
        }
    },

    _updateNotificationTimeout: function(timeout) {
        if (this._notificationTimeoutId) {
            Mainloop.source_remove(this._notificationTimeoutId);
            this._notificationTimeoutId = 0;
        }
        if (timeout > 0)
            this._notificationTimeoutId =
                Mainloop.timeout_add(timeout,
                                     Lang.bind(this, this._notificationTimeout));
    },

    _notificationTimeout: function() {
        let [x, y, mods] = global.get_pointer();
        let distance = Math.abs(this._notificationBin.y - y);
        if (distance < this._lastSeenMouseDistance - 50 || this._notification.actor.hover) {
            // The mouse is moving towards the notification, so don't
            // hide it yet. (We just create a new timeout (and destroy
            // the old one) each time because the bookkeeping is simpler.)

            this._lastSeenMouseDistance = distance;
            this._updateNotificationTimeout(1000);
        } else {
            this._notificationTimeoutId = 0;
            this._updateState();
        }

        return false;
    },

    _hideNotification: function() {
        let y = Main.layoutManager.primaryMonitor.y;
        if (this.bottomPosition) {
            if (this.bottomPositionSignal) {
                this._notificationBin.disconnect(this.bottomPositionSignal);
            }
            y += Main.layoutManager.primaryMonitor.height - this._notificationBin.height;
        }

        this._tween(this._notificationBin, '_notificationState', State.HIDDEN, {
            y,
            opacity: 0,
            time: ANIMATION_TIME,
            transition: 'easeOutQuad',
            onComplete: this._hideNotificationCompleted,
            onCompleteScope: this
        });
    },

    _hideNotificationCompleted: function() {
        this._notificationBin.hide();
        this._notificationBin.child = null;
        let notification = this._notification;
        if (AppletManager.get_role_provider_exists(AppletManager.Roles.NOTIFICATIONS) && !this._notificationRemoved) {
            this.emit('notify-applet-update', notification);
        } else {
            if (notification.isTransient)
                notification.destroy(NotificationDestroyedReason.EXPIRED);
        }
        this._notification = null;
        this._notificationRemoved = false;
    }
};
Signals.addSignalMethods(MessageTray.prototype);



function SystemNotificationSource() {
    this._init();
}

SystemNotificationSource.prototype = {
    __proto__:  Source.prototype,

    _init: function() {
        Source.prototype._init.call(this, _("System Information"));

        this._setSummaryIcon(this.createNotificationIcon());
    },

    createNotificationIcon: function() {
        return new St.Icon({ icon_name: 'dialog-information',
                             icon_type: St.IconType.SYMBOLIC,
                             icon_size: this.ICON_SIZE });
    },

    open: function() {
        this.destroy();
    }
};
