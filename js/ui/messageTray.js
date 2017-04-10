// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
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

const ANIMATION_TIME = .2;
const NOTIFICATION_TIMEOUT = 4;
const NOTIFICATION_CRITICAL_TIMEOUT_WITH_APPLET = 10;
const SUMMARY_TIMEOUT = 1;
const LONGER_SUMMARY_TIMEOUT = 4;

const HIDE_TIMEOUT = 0.2;
const LONGER_HIDE_TIMEOUT = 0.6;

const MAX_SOURCE_TITLE_WIDTH = 180;


// We delay hiding of the tray if the mouse is within MOUSE_LEFT_ACTOR_THRESHOLD
// range from the point where it left the tray.
const MOUSE_LEFT_ACTOR_THRESHOLD = 20;

const State = {
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
const NotificationDestroyedReason = {
    EXPIRED: 1,
    DISMISSED: 2,
    SOURCE_CLOSED: 3
};

// Message tray has its custom Urgency enumeration. LOW, NORMAL and CRITICAL
// urgency values map to the corresponding values for the notifications received
// through the notification daemon. HIGH urgency value is used for chats received
// through the Telepathy client.
const Urgency = {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    CRITICAL: 3
}

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
                    Util.spawn(['gvfs-open', url]);
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
        let success;
        let [x, y] = event.get_coords();
        [success, x, y] = this.actor.transform_stage_point(x, y);
        let find_pos = -1;
        for (let i = 0; i < this.actor.clutter_text.text.length; i++) {
            let [success, px, py, line_height] = this.actor.clutter_text.position_to_coords(i);
            if (py > y || py + line_height < y || x < px)
                continue;
            find_pos = i;
        }
        if (find_pos != -1) {
            for (let i = 0; i < this._urls.length; i++)
            if (find_pos >= this._urls[i].pos &&
                this._urls[i].pos + this._urls[i].url.length > find_pos)
                return i;
        }
        return -1;
    }
};

function FocusGrabber() {
    this._init();
}

FocusGrabber.prototype = {
    _init: function() {
        this.actor = null;

        this._hasFocus = false;
        // We use this._prevFocusedWindow and this._prevKeyFocusActor to return the
        // focus where it previously belonged after a focus grab, unless the user
        // has explicitly changed that.
        this._prevFocusedWindow = null;
        this._prevKeyFocusActor = null;

        this._focusActorChangedId = 0;
        this._stageInputModeChangedId = 0;
        this._capturedEventId = 0;
        this._togglingFocusGrabMode = false;

        Main.overview.connect('showing', Lang.bind(this,
            function() {
                this._toggleFocusGrabMode();
            }));
        Main.overview.connect('hidden', Lang.bind(this,
            function() {
                this._toggleFocusGrabMode();
            }));
        Main.expo.connect('showing', Lang.bind(this,
            function() {
                this._toggleFocusGrabMode();
            }));
        Main.expo.connect('hidden', Lang.bind(this,
            function() {
                this._toggleFocusGrabMode();
            }));
    },

    grabFocus: function(actor) {
        if (this._hasFocus)
            return;

        this.actor = actor;

        this._prevFocusedWindow = global.display.focus_window;
        this._prevKeyFocusActor = global.stage.get_key_focus();

        if (global.stage_input_mode == Cinnamon.StageInputMode.NONREACTIVE ||
            global.stage_input_mode == Cinnamon.StageInputMode.NORMAL)
            global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);

        // Use captured-event to notice clicks outside the focused actor
        // without consuming them.
        this._capturedEventId = global.stage.connect('captured-event', Lang.bind(this, this._onCapturedEvent));

        this._stageInputModeChangedId = global.connect('notify::stage-input-mode', Lang.bind(this, this._stageInputModeChanged));
        this._focusActorChangedId = global.stage.connect('notify::key-focus', Lang.bind(this, this._focusActorChanged));

        this._hasFocus = true;

        this.actor.navigate_focus(null, Gtk.DirectionType.TAB_FORWARD, false);
        this.emit('focus-grabbed');
    },

    _focusActorChanged: function() {
        let focusedActor = global.stage.get_key_focus();
        if (!focusedActor || !this.actor.contains(focusedActor)) {
            this._prevKeyFocusActor = null;
            this.ungrabFocus();
        }
    },

    _stageInputModeChanged: function() {
        this.ungrabFocus();
    },

    _onCapturedEvent: function(actor, event) {
        let source = event.get_source();
        switch (event.type()) {
            case Clutter.EventType.BUTTON_PRESS:
                if (!this.actor.contains(source) &&
                    !Main.layoutManager.keyboardBox.contains(source))
                    this.emit('button-pressed', source);
                break;
            case Clutter.EventType.KEY_PRESS:
                let symbol = event.get_key_symbol();
                if (symbol == Clutter.Escape) {
                    this.emit('escape-pressed');
                    return true;
                }
                break;
        }

        return false;
    },

    ungrabFocus: function() {
        if (!this._hasFocus)
            return;

        if (this._focusActorChangedId > 0) {
            global.stage.disconnect(this._focusActorChangedId);
            this._focusActorChangedId = 0;
        }

        if (this._stageInputModeChangedId) {
            global.disconnect(this._stageInputModeChangedId);
            this._stageInputModeChangedId = 0;
        }

        if (this._capturedEventId > 0) {
            global.stage.disconnect(this._capturedEventId);
            this._capturedEventId = 0;
        }

        this._hasFocus = false;
        this.emit('focus-ungrabbed');

        if (this._prevFocusedWindow && !global.display.focus_window) {
            global.display.set_input_focus_window(this._prevFocusedWindow, false, global.get_current_time());
            this._prevFocusedWindow = null;
        }
        if (this._prevKeyFocusActor) {
            global.stage.set_key_focus(this._prevKeyFocusActor);
            this._prevKeyFocusActor = null;
        } else {
            // We don't want to keep any actor inside the previously focused actor focused.
            let focusedActor = global.stage.get_key_focus();
            if (focusedActor && this.actor.contains(focusedActor))
                global.stage.set_key_focus(null);
        }
        if (!this._togglingFocusGrabMode)
            this.actor = null;
    },

    // Because we grab focus differently in the overview
    // and in the main view, we need to change how it is
    // done when we move between the two.
    _toggleFocusGrabMode: function() {
        if (this._hasFocus) {
            this._togglingFocusGrabMode = true;
            this.ungrabFocus();
            this.grabFocus(this.actor);
            this._togglingFocusGrabMode = false;
        }
    }
}
Signals.addSignalMethods(FocusGrabber.prototype);

// Notification:
// @source: the notification's Source
// @title: the title
// @banner: the banner text
// @params: optional additional params
//
// Creates a notification. In the banner mode, the notification
// will show an icon, @title (in bold) and @banner, all on a single
// line (with @banner ellipsized if necessary).
//
// The notification will be expandable if either it has additional
// elements that were added to it or if the @banner text did not
// fit fully in the banner mode. When the notification is expanded,
// the @banner text from the top line is always removed. The complete
// @banner text is added as the first element in the content section,
// unless 'customContent' parameter with the value 'true' is specified
// in @params.
//
// Additional notification content can be added with addActor() and
// addBody() methods. The notification content is put inside a
// scrollview, so if it gets too tall, the notification will scroll
// rather than continue to grow. In addition to this main content
// area, there is also a single-row action area, which is not
// scrolled and can contain a single actor. The action area can
// be set by calling setActionArea() method. There is also a
// convenience method addButton() for adding a button to the action
// area.
//
// @params can contain values for 'customContent', 'body', 'icon',
// 'titleMarkup', 'bannerMarkup', 'bodyMarkup', and 'clear'
// parameters.
//
// If @params contains a 'customContent' parameter with the value %true,
// then @banner will not be shown in the body of the notification when the
// notification is expanded and calls to update() will not clear the content
// unless 'clear' parameter with value %true is explicitly specified.
//
// If @params contains a 'body' parameter, then that text will be added to
// the content area (as with addBody()).
//
// By default, the icon shown is created by calling
// source.createNotificationIcon(). However, if @params contains an 'icon'
// parameter, the passed in icon will be used.
//
// If @params contains a 'titleMarkup', 'bannerMarkup', or
// 'bodyMarkup' parameter with the value %true, then the corresponding
// element is assumed to use pango markup. If the parameter is not
// present for an element, then anything that looks like markup in
// that element will appear literally in the output.
//
// If @params contains a 'clear' parameter with the value %true, then
// the content and the action area of the notification will be cleared.
// The content area is also always cleared if 'customContent' is false
// because it might contain the @banner that didn't fit in the banner mode.
function Notification(source, title, banner, params) {
    this._init(source, title, banner, params);
}

Notification.prototype = {
    IMAGE_SIZE: 125,

    _init: function(source, title, banner, params) {
        this.source = source;
        this.title = title;
        this.urgency = Urgency.NORMAL;
        this.resident = false;
        // 'transient' is a reserved keyword in JS, so we have to use an alternate variable name
        this.isTransient = false;
        this.expanded = false;
        this._destroyed = false;
        this._useActionIcons = false;
        this._customContent = false;
        this._bannerBodyText = null;
        this._bannerBodyMarkup = false;
        this._titleFitsInBannerMode = true;
        this._inhibitTransparency = false;
        this._titleDirection = St.TextDirection.NONE;
        this._spacing = 0;

        this._imageBin = null;
        this._timestamp = new Date();
        this._inNotificationBin = false;

        this.enter_id = 0;
        this.leave_id = 0;

        source.connect('destroy', Lang.bind(this,
            function (source, reason) {
                this.destroy(reason);
            }));

        this.actor = new St.Button({ accessible_role: Atk.Role.NOTIFICATION });
        this.actor._delegate = this;
        this.actor._parent_container = null;
        this.actor.connect('clicked', Lang.bind(this, this._onClicked));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));

        this.updateFadeOnMouseover();

        this._table = new St.Table({ name: 'notification',
                                     reactive: true });
        this._table.connect('style-changed', Lang.bind(this, this._styleChanged));
        this.actor.set_child(this._table);

        this._buttonFocusManager = St.FocusManager.get_for_stage(global.stage);

        // The first line should have the title, followed by the
        // banner text, but ellipsized if they won't both fit. We can't
        // make St.Table or St.BoxLayout do this the way we want (don't
        // show banner at all if title needs to be ellipsized), so we
        // use Cinnamon.GenericContainer.
        this._bannerBox = new Cinnamon.GenericContainer();
        this._bannerBox.connect('get-preferred-width', Lang.bind(this, this._bannerBoxGetPreferredWidth));
        this._bannerBox.connect('get-preferred-height', Lang.bind(this, this._bannerBoxGetPreferredHeight));
        this._bannerBox.connect('allocate', Lang.bind(this, this._bannerBoxAllocate));
        this._table.add(this._bannerBox, { row: 0,
                                           col: 1,
                                           col_span: 2,
                                           x_expand: false,
                                           y_expand: false,
                                           y_fill: false });

        // This is an empty cell that overlaps with this._bannerBox cell to ensure
        // that this._bannerBox cell expands horizontally, while not forcing the
        // this._imageBin that is also in col: 2 to expand horizontally.
        this._table.add(new St.Bin(), { row: 0,
                                        col: 2,
                                        y_expand: false,
                                        y_fill: false });
        this._timeLabel = new St.Label();
        this._titleLabel = new St.Label();
        this._bannerBox.add_actor(this._titleLabel);
        this._bannerBox.add_actor(this._timeLabel);
        this._timeLabel.hide();
        this._bannerUrlHighlighter = new URLHighlighter();
        this._bannerLabel = this._bannerUrlHighlighter.actor;
        this._bannerBox.add_actor(this._bannerLabel);

        this.update(title, banner, params);
    },

    // update:
    // @title: the new title
    // @banner: the new banner
    // @params: as in the Notification constructor
    //
    // Updates the notification by regenerating its icon and updating
    // the title/banner. If @params.clear is %true, it will also
    // remove any additional actors/action buttons previously added.
    update: function(title, banner, params) {
        this._timestamp = new Date();
        this._inNotificationBin = false;
        params = Params.parse(params, { customContent: false,
                                        body: null,
                                        icon: null,
                                        titleMarkup: false,
                                        bannerMarkup: false,
                                        bodyMarkup: false,
                                        clear: false });

        this._customContent = params.customContent;

        let oldFocus = global.stage.key_focus;

        if (this._icon && (params.icon || params.clear)) {
            this._icon.destroy();
            this._icon = null;
        }

        // We always clear the content area if we don't have custom
        // content because it might contain the @banner that didn't
        // fit in the banner mode.
        if (this._scrollArea && (!this._customContent || params.clear)) {
            if (oldFocus && this._scrollArea.contains(oldFocus))
                this.actor.grab_key_focus();

            this._scrollArea.destroy();
            this._scrollArea = null;
            this._contentArea = null;
        }
        if (this._actionArea && params.clear) {
            if (oldFocus && this._actionArea.contains(oldFocus))
                this.actor.grab_key_focus();

            this._actionArea.destroy();
            this._actionArea = null;
            this._buttonBox = null;
        }
        if (this._imageBin && params.clear)
            this.unsetImage();

        if (!this._scrollArea && !this._actionArea && !this._imageBin)
            this._table.remove_style_class_name('multi-line-notification');

        if (!this._icon) {
            this._icon = params.icon || this.source.createNotificationIcon();
            this._table.add(this._icon, { row: 0,
                                          col: 0,
                                          x_expand: false,
                                          y_expand: false,
                                          y_fill: false,
                                          y_align: St.Align.START });
        }

        this.title = title;
        title = title ? _fixMarkup(title.replace(/\n/g, ' '), params.titleMarkup) : '';
        this._titleLabel.clutter_text.set_markup('<b>' + title + '</b>');
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

        // Unless the notification has custom content, we save this._bannerBodyText
        // to add it to the content of the notification if the notification is
        // expandable due to other elements in its content area or due to the banner
        // not fitting fully in the single-line mode.
        this._bannerBodyText = this._customContent ? null : banner;
        this._bannerBodyMarkup = params.bannerMarkup;

        banner = banner ? banner.replace(/\n/g, '  ') : '';

        this._bannerUrlHighlighter.setMarkup(banner, params.bannerMarkup);
        this._bannerLabel.queue_relayout();

        // Add the bannerBody now if we know for sure we'll need it
        if (this._bannerBodyText && this._bannerBodyText.indexOf('\n') > -1)
            this._addBannerBody();

        if (params.body)
            this.addBody(params.body, params.bodyMarkup);
        this._updated();
    },

    updateFadeOnMouseover: function() {
        // Transparency on mouse over?
        if (Main.messageTray.fadeOnMouseover && !this._inhibitTransparency) {
            // Register to every notification as we intend to support multiple notifications on screen.
            this.enter_id = this.actor.connect('enter-event', Lang.bind(this, function() {
                Tweener.addTween(this.actor, {
                    opacity: ((Main.messageTray.fadeOpacity / 100) * 255).clamp(0, 255),
                    time: ANIMATION_TIME,
                    transition: 'easeOutQuad'
                });
            }));
            this.leave_id = this.actor.connect('leave-event', Lang.bind(this, function() {
                Tweener.addTween(this.actor, {
                    opacity: (this._table.get_theme_node().get_length('opacity') / global.ui_scale) || 255,
                    time: ANIMATION_TIME,
                    transition: 'easeOutQuad'
                });
            }));
        } else {
            if (this.enter_id > 0) {
                this.actor.disconnect(this.enter_id);
                this.enter_id = 0;
            }
            if (this.leave_id > 0) {
                this.actor.disconnect(this.leave_id);
                this.leave_id = 0;
            }
        }
    },

    setIconVisible: function(visible) {
        this._icon.visible = visible;
    },

    _createScrollArea: function() {
        this._table.add_style_class_name('multi-line-notification');
        this._scrollArea = new St.ScrollView({ name: 'notification-scrollview',
                                               vscrollbar_policy: Gtk.PolicyType.NEVER,
                                               hscrollbar_policy: Gtk.PolicyType.NEVER,
                                               style_class: 'vfade' });
        this._table.add(this._scrollArea, { row: 1,
                                            col: 2 });
        this._updateLastColumnSettings();
        this._contentArea = new St.BoxLayout({ name: 'notification-body',
                                               vertical: true });
        this._scrollArea.add_actor(this._contentArea);
        // If we know the notification will be expandable, we need to add
        // the banner text to the body as the first element.
        this._addBannerBody();
    },

    // addActor:
    // @actor: actor to add to the body of the notification
    //
    // Appends @actor to the notification's body
    addActor: function(actor, style) {
        if (!this._scrollArea) {
            this._createScrollArea();
        }

        this._contentArea.add(actor, style ? style : {});
        this._updated();
    },

    // addBody:
    // @text: the text
    // @markup: %true if @text contains pango markup
    // @style: style to use when adding the actor containing the text
    //
    // Adds a multi-line label containing @text to the notification.
    //
    // Return value: the newly-added label
    addBody: function(text, markup, style) {
        let label = new URLHighlighter(text, true, markup);

        this.addActor(label.actor, style);
        return label.actor;
    },

    _addBannerBody: function() {
        if (this._bannerBodyText) {
            let text = this._bannerBodyText;
            this._bannerBodyText = null;
            this.addBody(text, this._bannerBodyMarkup);
        }
    },

    // scrollTo:
    // @side: St.Side.TOP or St.Side.BOTTOM
    //
    // Scrolls the content area (if scrollable) to the indicated edge
    scrollTo: function(side) {
        let adjustment = this._scrollArea.vscroll.adjustment;
        if (side == St.Side.TOP)
            adjustment.value = adjustment.lower;
        else if (side == St.Side.BOTTOM)
            adjustment.value = adjustment.upper;
    },

    // setActionArea:
    // @actor: the actor
    // @props: (option) St.Table child properties
    //
    // Puts @actor into the action area of the notification, replacing
    // the previous contents
    setActionArea: function(actor, props) {
        if (this._actionArea) {
            this._actionArea.destroy();
            this._actionArea = null;
            if (this._buttonBox)
                this._buttonBox = null;
        } else {
            this._addBannerBody();
        }
        this._actionArea = actor;

        if (!props)
            props = {};
        props.row = 2;
        props.col = 2;

        this._table.add_style_class_name('multi-line-notification');
        this._table.add(this._actionArea, props);
        this._updateLastColumnSettings();
        this._updated();
    },

    _updateLastColumnSettings: function() {
        if (this._scrollArea)
            this._table.child_set(this._scrollArea, { col: this._imageBin ? 2 : 1,
                                                      col_span: this._imageBin ? 1 : 2 });
        if (this._actionArea)
            this._table.child_set(this._actionArea, { col: this._imageBin ? 2 : 1,
                                                      col_span: this._imageBin ? 1 : 2 });
    },

    setImage: function(image) {
        if (this._imageBin)
            this.unsetImage();
        this._imageBin = new St.Bin();
        this._imageBin.child = image;
        this._imageBin.opacity = 230;
        this._table.add_style_class_name('multi-line-notification');
        this._table.add_style_class_name('notification-with-image');
        this._addBannerBody();
        this._updateLastColumnSettings();
        this._table.add(this._imageBin, { row: 1,
                                          col: 1,
                                          row_span: 2,
                                          x_expand: false,
                                          y_expand: false,
                                          x_fill: false,
                                          y_fill: false });
    },

    unsetImage: function() {
        if (this._imageBin) {
            this._table.remove_style_class_name('notification-with-image');
            this._table.remove_actor(this._imageBin);
            this._imageBin = null;
            this._updateLastColumnSettings();
            if (!this._scrollArea && !this._actionArea)
                this._table.remove_style_class_name('multi-line-notification');
        }
    },

    // addButton:
    // @id: the action ID
    // @label: the label for the action's button
    //
    // Adds a button with the given @label to the notification. All
    // action buttons will appear in a single row at the bottom of
    // the notification.
    //
    // If the button is clicked, the notification will emit the
    // %action-invoked signal with @id as a parameter
    addButton: function(id, label) {
        if (!this._buttonBox) {

            let box = new St.BoxLayout({ name: 'notification-actions' });
            this.setActionArea(box, { x_expand: true,
                                      y_expand: false,
                                      x_fill: true,
                                      y_fill: false,
                                      x_align: St.Align.START });
            this._buttonBox = box;
        }

        let button = new St.Button({ can_focus: true });

        if (this._useActionIcons && Gtk.IconTheme.get_default().has_icon(id)) {
            button.add_style_class_name('notification-icon-button');
            button.child = new St.Icon({ icon_name: id });
        } else {
            button.add_style_class_name('notification-button');
            button.label = label;
        }

        if (this._buttonBox.get_n_children() > 0)
            this._buttonFocusManager.remove_group(this._buttonBox);

        this._buttonBox.add(button);
        this._buttonFocusManager.add_group(this._buttonBox);
        button.connect('clicked', Lang.bind(this, this._onActionInvoked, id));

        this._inhibitTransparency = true;

        this.updateFadeOnMouseover();

        this._updated();
    },

    setUrgency: function(urgency) {
        this.urgency = urgency;
    },

    setResident: function(resident) {
        this.resident = resident;
    },

    setTransient: function(isTransient) {
        this.isTransient = isTransient;
    },

    setUseActionIcons: function(useIcons) {
        this._useActionIcons = useIcons;
    },

    _styleChanged: function() {
        this._spacing = this._table.get_theme_node().get_length('spacing-columns');
    },

    _bannerBoxGetPreferredWidth: function(actor, forHeight, alloc) {
        let [titleMin, titleNat] = this._titleLabel.get_preferred_width(forHeight);
        let [bannerMin, bannerNat] = this._bannerLabel.get_preferred_width(forHeight);
        let [timeMin, timeNat] = this._timeLabel.get_preferred_width(forHeight);
        if (this._inNotificationBin) {
            alloc.min_size = Math.max(titleMin, timeMin);
            alloc.natural_size = Math.max(titleNat, timeNat) + this._spacing + bannerNat;
        } else {
            alloc.min_size = titleMin;
            alloc.natural_size = titleNat + this._spacing + bannerNat;
        }
    },

    _bannerBoxGetPreferredHeight: function(actor, forWidth, alloc) {
        if (this._inNotificationBin) {
            let [titleMin, titleNat] = this._titleLabel.get_preferred_height(forWidth);
            let [timeMin, timeNat] = this._timeLabel.get_preferred_height(forWidth);
            alloc.min_size = titleMin + timeMin;
            alloc.natural_size = titleNat + timeNat;
        } else {
            [alloc.min_size, alloc.natural_size] =
                this._titleLabel.get_preferred_height(forWidth);
        }
    },

    _bannerBoxAllocate: function(actor, box, flags) {
        let availWidth = box.x2 - box.x1;

        let [titleMinW, titleNatW] = this._titleLabel.get_preferred_width(-1);
        let [titleMinH, titleNatH] = this._titleLabel.get_preferred_height(availWidth);

        let [timeMinW, timeNatW] = this._timeLabel.get_preferred_width(-1);
        let [timeMinH, timeNatH] = this._timeLabel.get_preferred_height(availWidth);

        let [bannerMinW, bannerNatW] = this._bannerLabel.get_preferred_width(availWidth);

        let titleBox = new Clutter.ActorBox();
        let timeBox = new Clutter.ActorBox();
        let titleBoxW = Math.min(titleNatW, availWidth);
        let timeBoxW = Math.min(timeNatW, availWidth);
        if (this._titleDirection == St.TextDirection.RTL) {
            titleBox.x1 = availWidth - titleBoxW;
            titleBox.x2 = availWidth;
            timeBox.x1 = availWidth - timeBoxW;
            timeBox.x2 = availWidth;
        } else {
            titleBox.x1 = 0;
            timeBox.x1 = 0;
            titleBox.x2 = titleBoxW;
            timeBox.x2 = timeBoxW;
        }
        if (this._inNotificationBin) {
            timeBox.y1 = 0;
            timeBox.y2 = timeNatH;
            titleBox.y1 = timeNatH;
            titleBox.y2 = timeNatH + titleNatH;
        } else {
            titleBox.y1 = 0;
            titleBox.y2 = titleNatH;
        }

        this._titleLabel.allocate(titleBox, flags);
        if (this._inNotificationBin) {
            this._timeLabel.allocate(timeBox, flags);
        }
        this._titleFitsInBannerMode = (titleNatW <= availWidth);

        let bannerFits = true;

        if (titleBoxW + this._spacing > availWidth) {
            this._bannerLabel.opacity = 0;
            bannerFits = false;
        } else {
            let bannerBox = new Clutter.ActorBox();

            if (this._titleDirection == St.TextDirection.RTL) {
                bannerBox.x1 = 0;
                bannerBox.x2 = titleBox.x1 - this._spacing;

                bannerFits = (bannerBox.x2 - bannerNatW >= 0);
            } else {
                bannerBox.x1 = titleBox.x2 + this._spacing;
                bannerBox.x2 = availWidth;

                bannerFits = (bannerBox.x1 + bannerNatW <= availWidth);
            }
            if (this._inNotificationBin) {
                bannerBox.y1 = timeNatH;
                bannerBox.y2 = timeNatH + titleNatH;
            } else {
                bannerBox.y1 = 0;
                bannerBox.y2 = titleNatH;
            }
            this._bannerLabel.allocate(bannerBox, flags);

            // Make _bannerLabel visible if the entire notification
            // fits on one line, or if the notification is currently
            // unexpanded and only showing one line anyway.
            if (!this.expanded || (bannerFits && this._table.row_count == 1))
                this._bannerLabel.opacity = 255;
        }

        // If the banner doesn't fully fit in the banner box, we possibly need to add the
        // banner to the body. We can't do that from here though since that will force a
        // relayout, so we add it to the main loop.
        if (!bannerFits && this._canExpandContent())
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW,
                           Lang.bind(this,
                                     function() {
                                        if (this._canExpandContent()) {
                                            this._addBannerBody();
                                            this._table.add_style_class_name('multi-line-notification');
                                            this._updated();
                                        }
                                        return false;
                                     }));
    },

    _canExpandContent: function() {
        return this._bannerBodyText ||
               (!this._titleFitsInBannerMode && !this._table.has_style_class_name('multi-line-notification'));
    },

    _updated: function() {
        if (this.expanded)
            this.expand(false);
    },

    expand: function(animate) {
        this.expanded = true;
        // The banner is never shown when the title did not fit, so this
        // can be an if-else statement.
        if (!this._titleFitsInBannerMode) {
            // Remove ellipsization from the title label and make it wrap so that
            // we show the full title when the notification is expanded.
            this._titleLabel.clutter_text.line_wrap = true;
            this._titleLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            this._titleLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        } else if (this._table.row_count > 1 && this._bannerLabel.opacity != 0) {
            // We always hide the banner if the notification has additional content.
            //
            // We don't need to wrap the banner that doesn't fit the way we wrap the
            // title that doesn't fit because we won't have a notification with
            // row_count=1 that has a banner that doesn't fully fit. We'll either add
            // that banner to the content of the notification in _bannerBoxAllocate()
            // or the notification will have custom content.
            if (animate)
                Tweener.addTween(this._bannerLabel,
                                 { opacity: 0,
                                   time: ANIMATION_TIME,
                                   transition: 'easeOutQuad' });
            else
                this._bannerLabel.opacity = 0;
        }
        this.emit('expanded');
    },

    collapseCompleted: function() {
        if (this._destroyed)
            return;
        this.expanded = false;
        // Make sure we don't line wrap the title, and ellipsize it instead.
        this._titleLabel.clutter_text.line_wrap = false;
        this._titleLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        // Restore banner opacity in case the notification is shown in the
        // banner mode again on update.
        this._bannerLabel.opacity = 255;
        this.emit('collapsed');
    },

    _onActionInvoked: function(actor, mouseButtonClicked, id) {
        this.emit('action-invoked', id);
        if (!this.resident) {
            // We don't hide a resident notification when the user invokes one of its actions,
            // because it is common for such notifications to update themselves with new
            // information based on the action. We'd like to display the updated information
            // in place, rather than pop-up a new notification.
            this.emit('done-displaying');
            this.destroy();
        }
    },

    _onClicked: function() {
        this.emit('clicked');
        // We hide all types of notifications once the user clicks on them because the common
        // outcome of clicking should be the relevant window being brought forward and the user's
        // attention switching to the window.
        this.emit('done-displaying');
        if (!this.resident)
            this.destroy();
    },

    _onDestroy: function() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        if (!this._destroyedReason)
            this._destroyedReason = NotificationDestroyedReason.DISMISSED;
        this.emit('destroy', this._destroyedReason);
    },

    destroy: function(reason) {
        this._destroyedReason = reason;
        this.actor.destroy();
        this.actor._delegate = null;
    }
};
Signals.addSignalMethods(Notification.prototype);

function Source(title) {
    this._init(title);
}

Source.prototype = {
    ICON_SIZE: 24,

    _init: function(title) {
        this.title = title;

        this.actor = new Cinnamon.GenericContainer();
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));
        this.actor.connect('destroy', Lang.bind(this,
            function() {
                this._actorDestroyed = true;
            }));
        this._actorDestroyed = false;

        this._counterLabel = new St.Label();
        this._counterBin = new St.Bin({ style_class: 'summary-source-counter',
                                        child: this._counterLabel });
        this._counterBin.hide();

        this._iconBin = new St.Bin({ x_fill: true,
                                     y_fill: true });

        this.actor.add_actor(this._iconBin);
        this.actor.add_actor(this._counterBin);

        this.isTransient = false;
        this.isChat = false;

        this.notifications = [];
    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        let [min, nat] = this._iconBin.get_preferred_width(forHeight);
        alloc.min_size = min; alloc.nat_size = nat;
    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
        let [min, nat] = this._iconBin.get_preferred_height(forWidth);
        alloc.min_size = min; alloc.nat_size = nat;
    },

    _allocate: function(actor, box, flags) {
        // the iconBin should fill our entire box
        this._iconBin.allocate(box, flags);

        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this._counterBin.get_preferred_size();
        let direction = this.actor.get_direction();

        if (direction == St.TextDirection.LTR) {
            // allocate on the right in LTR
            childBox.x1 = box.x2 - naturalWidth;
            childBox.x2 = box.x2;
        } else {
            // allocate on the left in RTL
            childBox.x1 = 0;
            childBox.x2 = naturalWidth;
        }

        childBox.y1 = box.y2 - naturalHeight;
        childBox.y2 = box.y2;

        this._counterBin.allocate(childBox, flags);
    },

    _setCount: function(count, visible) {
        if (isNaN(parseInt(count)))
            throw new Error("Invalid notification count: " + count);

        if (this._actorDestroyed)
            return;

        this._counterBin.visible = visible;
        this._counterLabel.set_text(count.toString());
    },

    _updateCount: function() {
        let count = this.notifications.length;
        this._setCount(count, count > 1);
    },

    setTransient: function(isTransient) {
        this.isTransient = isTransient;
    },

    setTitle: function(newTitle) {
        this.title = newTitle;
        this.emit('title-changed');
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

        notification.connect('clicked', Lang.bind(this, this.open));
        notification.connect('destroy', Lang.bind(this,
            function () {
                let index = this.notifications.indexOf(notification);
                if (index < 0)
                    return;

                this.notifications.splice(index, 1);
                if (this.notifications.length == 0)
                    this._lastNotificationRemoved();

                this._updateCount();
            }));

        this._updateCount();
    },

    notify: function(notification) {
        this.pushNotification(notification);
        this.emit('notify', notification);
    },

    destroy: function(reason) {
        this.emit('destroy', reason);
    },

    // A subclass can redefine this to "steal" clicks from the
    // summaryitem; Use Clutter.get_current_event() to get the
    // details, return true to prevent the default handling from
    // ocurring.
    handleSummaryClick: function() {
        return false;
    },

    //// Protected methods ////

    // The subclass must call this at least once to set the summary icon.
    _setSummaryIcon: function(icon) {
        if (this._iconBin.child)
            this._iconBin.child.destroy();
        this._iconBin.child = icon;
    },

    // Default implementation is to do nothing, but subclasses can override
    open: function(notification) {
    },

    destroyNonResidentNotifications: function() {
        for (let i = this.notifications.length - 1; i >= 0; i--)
            if (!this.notifications[i].resident)
                this.notifications[i].destroy();

        this._updateCount();
    },

    // Default implementation is to destroy this source, but subclasses can override
    _lastNotificationRemoved: function() {
        this.destroy();
    }
};
Signals.addSignalMethods(Source.prototype);

function SummaryItem(source) {
    this._init(source);
}

SummaryItem.prototype = {
    _init: function(source) {
        this.source = source;
        this.source.connect('notification-added', Lang.bind(this, this._notificationAddedToSource));

        this.actor = new St.Button({ style_class: 'summary-source-button',
                                     y_fill: true,
                                     reactive: true,
                                     button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO | St.ButtonMask.THREE,
                                     track_hover: true });

        this._sourceBox = new St.BoxLayout({ style_class: 'summary-source' });

        this._sourceIcon = source.getSummaryIcon();
        this._sourceTitleBin = new St.Bin({ y_align: St.Align.MIDDLE,
                                            x_fill: true,
                                            clip_to_allocation: true });
        this._sourceTitle = new St.Label({ style_class: 'source-title',
                                           text: source.title });
        this._sourceTitle.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._sourceTitleBin.child = this._sourceTitle;
        this._sourceTitleBin.width = 0;

        this.source.connect('title-changed',
                            Lang.bind(this, function() {
                                this._sourceTitle.text = source.title;
                            }));

        this._sourceBox.add(this._sourceIcon, { y_fill: false });
        this._sourceBox.add(this._sourceTitleBin, { expand: true, y_fill: false });
        this.actor.child = this._sourceBox;

        this.notificationStackView = new St.ScrollView({ name: source.isChat ? '' : 'summary-notification-stack-scrollview',
                                                         vscrollbar_policy: source.isChat ? Gtk.PolicyType.NEVER : Gtk.PolicyType.AUTOMATIC,
                                                         hscrollbar_policy: Gtk.PolicyType.NEVER,
                                                         style_class: 'vfade' });
        this.notificationStack = new St.BoxLayout({ name: 'summary-notification-stack',
                                                     vertical: true });
        this.notificationStackView.add_actor(this.notificationStack);
        this._stackedNotifications = [];

        this._oldMaxScrollAdjustment = 0;

        this.notificationStackView.vscroll.adjustment.connect('changed', Lang.bind(this, function(adjustment) {
            let currentValue = adjustment.value + adjustment.page_size;
            if (currentValue == this._oldMaxScrollAdjustment)
                this.scrollTo(St.Side.BOTTOM);
            this._oldMaxScrollAdjustment = adjustment.upper;
        }));

        this.rightClickMenu = new St.BoxLayout({ name: 'summary-right-click-menu',
                                                 vertical: true });

        let item;

        item = new PopupMenu.PopupMenuItem(_("Open"));
        item.connect('activate', Lang.bind(this, function() {
            source.open();
            this.emit('done-displaying-content');
        }));
        this.rightClickMenu.add(item.actor);

        item = new PopupMenu.PopupMenuItem(_("Remove"));
        item.connect('activate', Lang.bind(this, function() {
            source.destroy();
            this.emit('done-displaying-content');
        }));
        this.rightClickMenu.add(item.actor);

        let focusManager = St.FocusManager.get_for_stage(global.stage);
        focusManager.add_group(this.rightClickMenu);
    },

    // getTitleNaturalWidth, getTitleWidth, and setTitleWidth include
    // the spacing between the icon and title (which is actually
    // _sourceTitle's padding-left) as part of the width.

    getTitleNaturalWidth: function() {
        let [minWidth, naturalWidth] = this._sourceTitle.get_preferred_width(-1);

        return Math.min(naturalWidth, MAX_SOURCE_TITLE_WIDTH);
    },

    getTitleWidth: function() {
        return this._sourceTitleBin.width;
    },

    setTitleWidth: function(width) {
        width = Math.round(width);
        if (width != this._sourceTitleBin.width)
            this._sourceTitleBin.width = width;
    },

    setEllipsization: function(mode) {
        this._sourceTitle.clutter_text.ellipsize = mode;
    },

    prepareNotificationStackForShowing: function() {
        if (this.notificationStack.get_n_children() > 0)
            return;

        for (let i = 0; i < this.source.notifications.length; i++) {
            this._appendNotificationToStack(this.source.notifications[i]);
        }
    },

    doneShowingNotificationStack: function() {
        for (let i = 0; i < this._stackedNotifications.length; i++) {
            let stackedNotification = this._stackedNotifications[i];
            let notification = stackedNotification.notification;
            notification.collapseCompleted();
            notification.disconnect(stackedNotification.notificationExpandedId);
            notification.disconnect(stackedNotification.notificationDoneDisplayingId);
            notification.disconnect(stackedNotification.notificationDestroyedId);
            if (notification.actor.get_parent() == this.notificationStack)
                this.notificationStack.remove_actor(notification.actor);
            notification.setIconVisible(true);
        }
        this._stackedNotifications = [];
    },

    _notificationAddedToSource: function(source, notification) {
        if (this.notificationStack.mapped)
            this._appendNotificationToStack(notification);
    },

    _appendNotificationToStack: function(notification) {
        let stackedNotification = {};
        stackedNotification.notification = notification;
        stackedNotification.notificationExpandedId = notification.connect('expanded', Lang.bind(this, this._contentUpdated));
        stackedNotification.notificationDoneDisplayingId = notification.connect('done-displaying', Lang.bind(this, this._notificationDoneDisplaying));
        stackedNotification.notificationDestroyedId = notification.connect('destroy', Lang.bind(this, this._notificationDestroyed));
        this._stackedNotifications.push(stackedNotification);
        if (this.notificationStack.get_n_children() > 0)
            notification.setIconVisible(false);
        this.notificationStack.add(notification.actor);
        notification.expand(false);
    },

    // scrollTo:
    // @side: St.Side.TOP or St.Side.BOTTOM
    //
    // Scrolls the notifiction stack to the indicated edge
    scrollTo: function(side) {
        let adjustment = this.notificationStackView.vscroll.adjustment;
        if (side == St.Side.TOP)
            adjustment.value = adjustment.lower;
        else if (side == St.Side.BOTTOM)
            adjustment.value = adjustment.upper;
    },

    _contentUpdated: function() {
        this.emit('content-updated');
    },

    _notificationDoneDisplaying: function() {
        this.emit('done-displaying-content');
    },

    _notificationDestroyed: function(notification) {
        for (let i = 0; i < this._stackedNotifications.length; i++) {
            if (this._stackedNotifications[i].notification == notification) {
                let stackedNotification = this._stackedNotifications[i];
                notification.disconnect(stackedNotification.notificationExpandedId);
                notification.disconnect(stackedNotification.notificationDoneDisplayingId);
                notification.disconnect(stackedNotification.notificationDestroyedId);
                this._stackedNotifications.splice(i, 1);
                this._contentUpdated();
                break;
            }
        }

        if (this.notificationStack.get_n_children() > 0)
            this.notificationStack.get_child_at_index(0)._delegate.setIconVisible(true);
    }
};
Signals.addSignalMethods(SummaryItem.prototype);

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
        this._notificationClickedId = 0;

        this._pointerBarrier = 0;

        this._focusGrabber = new FocusGrabber();
        this._focusGrabber.connect('focus-ungrabbed', Lang.bind(this, this._unlock));
        this._focusGrabber.connect('button-pressed', Lang.bind(this,
           function(focusGrabber, source) {
               this._focusGrabber.ungrabFocus();
           }));
        this._focusGrabber.connect('escape-pressed', Lang.bind(this, this._escapeTray));

        this._trayState = State.HIDDEN;
        this._locked = false;
        this._traySummoned = false;
        this._useLongerTrayLeftTimeout = false;
        this._trayLeftTimeoutId = 0;
        this._pointerInTray = false;
        this._pointerInKeyboard = false;
        this._notificationState = State.HIDDEN;
        this._notificationTimeoutId = 0;
        this._notificationExpandedId = 0;
        this._notificationRemoved = false;
        this._reNotifyAfterHideNotification = null;

        this._sources = [];
        Main.layoutManager.addChrome(this._notificationBin);

        Main.layoutManager.connect('monitors-changed', Lang.bind(this, this._setSizePosition));

		// Settings
        this.settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.notifications" })
		function setting(self, source, camelCase, dashed) {
			function updater() { self[camelCase] = source.get_boolean(dashed); }
			source.connect('changed::'+dashed, updater);
			updater();
		}
		setting(this, this.settings, "_notificationsEnabled", "display-notifications");
		setting(this, this.settings, "fadeOnMouseover", "fade-on-mouseover");
        this.fadeOpacity = this.settings.get_int("fade-opacity");
        this.settings.connect("changed::fade-opacity", Lang.bind(this, function() {
            this.fadeOpacity = this.settings.get_int("fade-opacity");
        }))
        this._setSizePosition();

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

    _setSizePosition: function() {
        //let monitor = Main.layoutManager.primaryMonitor;
        //this._notificationBin.x = monitor.width - 500;
        //this._notificationBin.width = monitor.width;
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

    toggle: function() {
        this._traySummoned = !this._traySummoned;
        this._updateState();
    },

    hide: function() {
        this._traySummoned = false;
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

    _escapeTray: function() {
        this._unlock();
        this._pointerInTray = false;
        this._updateNotificationTimeout(0);
        this._updateState();
    },

    // All of the logic for what happens when occurs here; the various
    // event handlers merely update variables such as
    // 'this._pointerInTray', 'this._summaryState', etc, and
    // _updateState() figures out what (if anything) needs to be done
    // at the present time.
    _updateState: function() {
        // Notifications
        let notificationUrgent = this._notificationQueue.length > 0 && this._notificationQueue[0].urgency == Urgency.CRITICAL;
        let notificationsPending = this._notificationQueue.length > 0 && (!this._busy || notificationUrgent);
        let notificationExpanded = this._notificationBin.y < 0;

        let notificationExpired = (this._notificationTimeoutId == 0 &&
                !(this._notification && this._notification.urgency == Urgency.CRITICAL) &&
                !this._pointerInTray &&
                !this._locked &&
                !(this._pointerInKeyboard && notificationExpanded)
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
        this._notificationTimeoutId = 1; // this prevents a race condition with the messagetray wanting
                                         // to hide a notification before it's done showing it, when updating from applet
        this._notification = this._notificationQueue.shift();
        if (this._notification.actor._parent_container) {
            this._notification.collapseCompleted();
            this._notification.actor._parent_container.remove_actor(this._notification.actor);
        }
        this._notificationClickedId = this._notification.connect('done-displaying',
                                                                 Lang.bind(this, this._escapeTray));
        this._notificationBin.child = this._notification.actor;
        this._notificationBin.opacity = 0;

        let monitor = Main.layoutManager.primaryMonitor;
        let topPanel = Main.panelManager.getPanel(0, 0);
        let rightPanel = Main.panelManager.getPanel(0, 3);
        let topGap = 5;
        let rightGap = 0;
        if (topPanel)
            topGap += topPanel.actor.get_height();
        if (rightPanel)
            rightGap += rightPanel.actor.get_width();
        this._notificationBin.y = monitor.y + topGap * 2; // Notifications appear from here (for the animation)

        let margin = this._notification._table.get_theme_node().get_length('margin-from-right-edge-of-screen');
        this._notificationBin.x = monitor.x + monitor.width - this._notification._table.width - margin - rightGap;
        Main.soundManager.play('notification');
        if (this._notification.urgency == Urgency.CRITICAL) {
            Main.layoutManager._chrome.modifyActorParams(this._notificationBin, { visibleInFullscreen: true });
        } else {
            Main.layoutManager._chrome.modifyActorParams(this._notificationBin, { visibleInFullscreen: false });
        }
        this._notificationBin.show();

        this._updateShowingNotification();

        let [x, y, mods] = global.get_pointer();
        // We save the position of the mouse at the time when we started showing the notification
        // in order to determine if the notification popped up under it. We make that check if
        // the user starts moving the mouse and _onTrayHoverChanged() gets called. We don't
        // expand the notification if it just happened to pop up under the mouse unless the user
        // explicitly mouses away from it and then mouses back in.
        this._showNotificationMouseX = x;
        this._showNotificationMouseY = y;
        // We save the y coordinate of the mouse at the time when we started showing the notification
        // and then we update it in _notifiationTimeout() if the mouse is moving towards the
        // notification. We don't pop down the notification if the mouse is moving towards it.
        this._lastSeenMouseY = y;
    },

    _updateShowingNotification: function() {
        Tweener.removeTweens(this._notificationBin);

        this._expandNotification(true);

        // We tween all notifications to full opacity. This ensures that both new notifications and
        // notifications that might have been in the process of hiding get full opacity.
        //
        // We tween any notification showing in the banner mode to banner height (this._notificationBin.y = 0).
        // This ensures that both new notifications and notifications in the banner mode that might
        // have been in the process of hiding are shown with the banner height.
        //
        // We use this._showNotificationCompleted() onComplete callback to extend the time the updated
        // notification is being shown.
        //
        // We don't set the y parameter for the tween for expanded notifications because
        // this._expandNotification() will result in getting this._notificationBin.y set to the appropriate
        // fully expanded value.
        let tweenParams = { opacity: 255,
                            time: ANIMATION_TIME,
                            transition: 'easeOutQuad',
                            onComplete: this._showNotificationCompleted,
                            onCompleteScope: this
                          };
        let monitor = Main.layoutManager.primaryMonitor;
        let panel = Main.panelManager.getPanel(0, 0); // We only want the top panel in monitor 0
        let height = 5;
        if (panel)
            height += panel.actor.get_height();

        if (!this._notification.expanded)
            tweenParams.y = monitor.y + height;

        this._tween(this._notificationBin, '_notificationState', State.SHOWN, tweenParams);
   },

    _showNotificationCompleted: function() {
        this._notificationTimeoutId = 0;
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
        if (y > this._lastSeenMouseY + 10) {
            // The mouse is moving towards the notification, so don't
            // hide it yet. (We just create a new timeout (and destroy
            // the old one) each time because the bookkeeping is
            // simpler.)
            this._lastSeenMouseY = y;
            this._updateNotificationTimeout(1000);
        } else {
            this._notificationTimeoutId = 0;
            this._updateState();
        }

        return false;
    },

    _hideNotification: function() {
        this._focusGrabber.ungrabFocus();
        if (this._notificationExpandedId) {
            this._notification.disconnect(this._notificationExpandedId);
            this._notificationExpandedId = 0;
        }

        this._tween(this._notificationBin, '_notificationState', State.HIDDEN,
                    { y: Main.layoutManager.primaryMonitor.y,
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
        this._notification.collapseCompleted();
        this._notification.disconnect(this._notificationClickedId);
        this._notificationClickedId = 0;
        let notification = this._notification;
        if (AppletManager.get_role_provider_exists(AppletManager.Roles.NOTIFICATIONS) && !this._notificationRemoved) {
            this.emit('notify-applet-update', notification);
        } else {
            if (notification.isTransient)
                notification.destroy(NotificationDestroyedReason.EXPIRED);  
        }
        this._notification = null;
        this._notificationRemoved = false;
    },

    _expandNotification: function(autoExpanding) {
        // Don't grab focus in notifications that are auto-expanded.
        if (!autoExpanding)
            this._focusGrabber.grabFocus(this._notification.actor);

        if (!this._notificationExpandedId)
            this._notificationExpandedId =
                this._notification.connect('expanded',
                                           Lang.bind(this, this._onNotificationExpanded));
        // Don't animate changes in notifications that are auto-expanding.
        this._notification.expand(!autoExpanding);
    },

    _onNotificationExpanded: function() {
        let expandedY = this._notification.actor.height - this._notificationBin.height;
        // Don't animate the notification to its new position if it has shrunk:
        // there will be a very visible "gap" that breaks the illusion.

        // This isn't really working at the moment, but it was just crashing before
        // if it encountered a critical notification.  expandedY is always 0.  For now
        // just make sure it's not covering the top panel if there is one.

        let monitor = Main.layoutManager.primaryMonitor;
        let panel = Main.panelManager.getPanel(0, 0); // We only want the top panel in monitor 0
        let height = 5;
        if (panel)
            height += panel.actor.get_height();
        let newY = monitor.y + height;

        if (this._notificationBin.y < expandedY)
            this._notificationBin.y = expandedY;
        else if (this._notification.actor.y != expandedY)
            this._tween(this._notificationBin, '_notificationState', State.SHOWN,
                        { y: newY,
                          time: ANIMATION_TIME,
                          transition: 'easeOutQuad'
                        });

   },

    // We use this function to grab focus when the user moves the pointer
    // to a notification with CRITICAL urgency that was already auto-expanded.
    _ensureNotificationFocused: function() {
        this._focusGrabber.grabFocus(this._notification.actor);
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
