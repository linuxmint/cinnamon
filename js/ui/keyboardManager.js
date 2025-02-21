// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Clutter, Gio, GLib, GObject, IBus, Meta, Cinnamon, St, CinnamonDesktop } = imports.gi;

const Gettext = imports.gettext;
const Signals = imports.signals;

const IBusManager = imports.misc.ibusManager;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
//const PanelMenu = imports.ui.panelMenu;
const SwitcherPopup = imports.ui.switcherPopup;
const Util = imports.misc.util;

var INPUT_SOURCE_TYPE_XKB = 'xkb';
var INPUT_SOURCE_TYPE_IBUS = 'ibus';


var DEFAULT_LOCALE = 'en_US';
var DEFAULT_LAYOUT = 'us';
var DEFAULT_VARIANT = '';

let _xkbInfo = null;

function getXkbInfo() {
    if (_xkbInfo == null)
        _xkbInfo = new CinnamonDesktop.XkbInfo();
    return _xkbInfo;
}

let _keyboardManager = null;

function getKeyboardManager() {
    if (_keyboardManager == null)
        _keyboardManager = new KeyboardManager();
    return _keyboardManager;
}

function releaseKeyboard() {
    if (Main.modalCount > 0)
        global.display.unfreeze_keyboard(global.get_current_time());
    else
        global.display.ungrab_keyboard(global.get_current_time());
}

function holdKeyboard() {
    global.display.freeze_keyboard(global.get_current_time());
}

var KeyboardManager = class {
    constructor() {
        // The XKB protocol doesn't allow for more that 4 layouts in a
        // keymap. Wayland doesn't impose this limit and libxkbcommon can
        // handle up to 32 layouts but since we need to support X clients
        // even as a Wayland compositor, we can't bump this.
        this.MAX_LAYOUTS_PER_GROUP = 4;

        this._xkbInfo = getXkbInfo();
        this._current = null;
        this._localeLayoutInfo = this._getLocaleLayout();
        this._layoutInfos = {};
        this._currentKeymap = null;
    }

    _applyLayoutGroup(group) {
        let options = this._buildOptionsString();
        let [layouts, variants] = this._buildGroupStrings(group);

        if (this._currentKeymap &&
            this._currentKeymap.layouts == layouts &&
            this._currentKeymap.variants == variants &&
            this._currentKeymap.options == options)
            return;

        this._currentKeymap = { layouts, variants, options };
        Meta.get_backend().set_keymap(layouts, variants, options);
    }

    _applyLayoutGroupIndex(idx) {
        Meta.get_backend().lock_layout_group(idx);
    }

    apply(id) {
        let info = this._layoutInfos[id];
        if (!info)
            return;

        if (this._current && this._current.group == info.group) {
            if (this._current.groupIndex != info.groupIndex)
                this._applyLayoutGroupIndex(info.groupIndex);
        } else {
            this._applyLayoutGroup(info.group);
            this._applyLayoutGroupIndex(info.groupIndex);
        }

        this._current = info;
    }

    reapply() {
        if (!this._current)
            return;

        this._applyLayoutGroup(this._current.group);
        this._applyLayoutGroupIndex(this._current.groupIndex);
    }

    setUserLayouts(ids) {
        this._current = null;
        this._layoutInfos = {};

        for (let i = 0; i < ids.length; ++i) {
            let [found, , , _layout, _variant] = this._xkbInfo.get_layout_info(ids[i]);
            if (found)
                this._layoutInfos[ids[i]] = { id: ids[i], layout: _layout, variant: _variant };
        }

        let i = 0;
        let group = [];
        for (let id in this._layoutInfos) {
            // We need to leave one slot on each group free so that we
            // can add a layout containing the symbols for the
            // language used in UI strings to ensure that toolkits can
            // handle mnemonics like Alt+Ф even if the user is
            // actually typing in a different layout.
            let groupIndex = i % (this.MAX_LAYOUTS_PER_GROUP - 1);
            if (groupIndex == 0)
                group = [];

            let info = this._layoutInfos[id];
            group[groupIndex] = info;
            info.group = group;
            info.groupIndex = groupIndex;

            i += 1;
        }
    }

    _getLocaleLayout() {
        let locale = GLib.get_language_names()[0];
        if (!locale.includes('_'))
            locale = DEFAULT_LOCALE;

        let [found, , id] = CinnamonDesktop.get_input_source_from_locale(locale);
        if (!found)
            [, , id] = CinnamonDesktop.get_input_source_from_locale(DEFAULT_LOCALE);

        let _layout, _variant;
        [found, , , _layout, _variant] = this._xkbInfo.get_layout_info(id);
        if (found)
            return { layout: _layout, variant: _variant };
        else
            return { layout: DEFAULT_LAYOUT, variant: DEFAULT_VARIANT };
    }

    _buildGroupStrings(_group) {
        let group = _group.concat(this._localeLayoutInfo);
        let layouts = group.map(g => g.layout).join(',');
        let variants = group.map(g => g.variant).join(',');
        return [layouts, variants];
    }

    setKeyboardOptions(options) {
        this._xkbOptions = options;
    }

    _buildOptionsString() {
        let options = this._xkbOptions.join(',');
        return options;
    }
};
/*
var LayoutMenuItem = GObject.registerClass(
class LayoutMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(displayName, shortName) {
        super._init();

        this.label = new St.Label({
            text: displayName,
            x_expand: true,
        });
        this.indicator = new St.Label({ text: shortName });
        this.add_child(this.label);
        this.add(this.indicator);
        this.label_actor = this.label;
    }
});
*/
var InputSource = class {
    constructor(type, id, displayName, shortName, index) {
        this.type = type;
        this.id = id;
        this.displayName = displayName;
        this._shortName = shortName;
        this.index = index;

        this.properties = null;

        this.xkbId = this._getXkbId();
    }

    get shortName() {
        return this._shortName;
    }

    set shortName(v) {
        this._shortName = v;
        this.emit('changed');
    }

    activate(interactive) {
        this.emit('activate', !!interactive);
    }

    _getXkbId() {
        let engineDesc = IBusManager.getIBusManager().getEngineDesc(this.id);
        if (!engineDesc)
            return this.id;

        if (engineDesc.variant && engineDesc.variant.length > 0)
            return '%s+%s'.format(engineDesc.layout, engineDesc.variant);
        else
            return engineDesc.layout;
    }
};
Signals.addSignalMethods(InputSource.prototype);

var InputSourcePopup = GObject.registerClass(
class InputSourcePopup extends SwitcherPopup.SwitcherPopup {
    _init(items, action, actionBackward) {
        super._init(items);

        this._action = action;
        this._actionBackward = actionBackward;

        this._switcherList = new InputSourceSwitcher(this._items);
    }

    _keyPressHandler(keysym, action) {
        if (action == this._action)
            this._select(this._next());
        else if (action == this._actionBackward)
            this._select(this._previous());
        else if (keysym == Clutter.KEY_Left)
            this._select(this._previous());
        else if (keysym == Clutter.KEY_Right)
            this._select(this._next());
        else
            return Clutter.EVENT_PROPAGATE;

        return Clutter.EVENT_STOP;
    }

    _finish() {
        super._finish();

        this._items[this._selectedIndex].activate(true);
    }
});

var InputSourceSwitcher = GObject.registerClass(
class InputSourceSwitcher extends SwitcherPopup.SwitcherList {
    _init(items) {
        super._init(true);

        for (let i = 0; i < items.length; i++)
            this._addIcon(items[i]);
    }

    _addIcon(item) {
        let box = new St.BoxLayout({ vertical: true });

        let bin = new St.Bin({ style_class: 'input-source-switcher-symbol' });
        let symbol = new St.Label({
            text: item.shortName,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        bin.set_child(symbol);
        box.add_child(bin);

        let text = new St.Label({
            text: item.displayName,
            x_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(text);

        this.addItem(box, text);
    }
});

var InputSourceSettings = class {
    constructor() {
        if (this.constructor === InputSourceSettings)
            throw new TypeError('Cannot instantiate abstract class %s'.format(this.constructor.name));
    }

    _emitInputSourcesChanged() {
        this.emit('input-sources-changed');
    }

    _emitKeyboardOptionsChanged() {
        this.emit('keyboard-options-changed');
    }

    _emitPerWindowChanged() {
        this.emit('per-window-changed');
    }

    get inputSources() {
        return [];
    }

    get mruSources() {
        return [];
    }

    set mruSources(sourcesList) {
        // do nothing
    }

    get keyboardOptions() {
        return [];
    }

    get perWindow() {
        return false;
    }
};
Signals.addSignalMethods(InputSourceSettings.prototype);

var InputSourceSessionSettings = class extends InputSourceSettings {
    constructor() {
        super();

        this._DESKTOP_INPUT_SOURCES_SCHEMA = 'org.cinnamon.desktop.input-sources';
        this._KEY_INPUT_SOURCES = 'sources';
        this._KEY_MRU_SOURCES = 'mru-sources';
        this._KEY_KEYBOARD_OPTIONS = 'xkb-options';
        this._KEY_PER_WINDOW = 'per-window';

        this._settings = new Gio.Settings({ schema_id: this._DESKTOP_INPUT_SOURCES_SCHEMA });
        this._settings.connect('changed::%s'.format(this._KEY_INPUT_SOURCES), this._emitInputSourcesChanged.bind(this));
        this._settings.connect('changed::%s'.format(this._KEY_KEYBOARD_OPTIONS), this._emitKeyboardOptionsChanged.bind(this));
        this._settings.connect('changed::%s'.format(this._KEY_PER_WINDOW), this._emitPerWindowChanged.bind(this));
    }

    _getSourcesList(key) {
        let sourcesList = [];
        let sources = this._settings.get_value(key);
        let nSources = sources.n_children();

        for (let i = 0; i < nSources; i++) {
            let [type, id] = sources.get_child_value(i).deep_unpack();
            sourcesList.push({ type, id });
        }
        return sourcesList;
    }

    get inputSources() {
        return this._getSourcesList(this._KEY_INPUT_SOURCES);
    }

    get mruSources() {
        return this._getSourcesList(this._KEY_MRU_SOURCES);
    }

    set mruSources(sourcesList) {
        let sources = GLib.Variant.new('a(ss)', sourcesList);
        this._settings.set_value(this._KEY_MRU_SOURCES, sources);
    }

    get keyboardOptions() {
        return this._settings.get_strv(this._KEY_KEYBOARD_OPTIONS);
    }

    get perWindow() {
        return this._settings.get_boolean(this._KEY_PER_WINDOW);
    }
};

var InputSourceManager = class {
    constructor() {
        // All valid input sources currently in the gsettings
        // KEY_INPUT_SOURCES list indexed by their index there
        this._inputSources = {};
        // All valid input sources currently in the gsettings
        // KEY_INPUT_SOURCES list of type INPUT_SOURCE_TYPE_IBUS
        // indexed by the IBus ID
        this._ibusSources = {};

        this._currentSource = null;

        // All valid input sources currently in the gsettings
        // KEY_INPUT_SOURCES list ordered by most recently used
        this._mruSources = [];
        this._mruSourcesBackup = null;
        this._kb_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.keybindings.wm" });

        this._keybindingAction = global.display.add_keybinding(
            'switch-input-source',
            this._kb_settings,
            Meta.KeyBindingFlags.NONE,
            this._switchInputSource.bind(this)
        );
        this._keybindingActionBackward = global.display.add_keybinding(
            'switch-input-source-backward',
            this._kb_settings,
            Meta.KeyBindingFlags.NONE,
            this._switchInputSource.bind(this)
        );
        this._settings = new InputSourceSessionSettings();
        this._settings.connect('input-sources-changed', this._inputSourcesChanged.bind(this));
        this._settings.connect('keyboard-options-changed', this._keyboardOptionsChanged.bind(this));

        this._xkbInfo = getXkbInfo();
        this._keyboardManager = getKeyboardManager();

        this._ibusReady = false;
        this._ibusManager = IBusManager.getIBusManager();
        this._ibusManager.connect('ready', this._ibusReadyCallback.bind(this));
        this._ibusManager.connect('properties-registered', this._ibusPropertiesRegistered.bind(this));
        this._ibusManager.connect('property-updated', this._ibusPropertyUpdated.bind(this));
        this._ibusManager.connect('set-content-type', this._ibusSetContentType.bind(this));

        global.display.connect('modifiers-accelerator-activated', this._modifiersSwitcher.bind(this));

        this._sourcesPerWindow = false;
        this._focusWindowNotifyId = 0;
        this._overviewShowingId = 0;
        this._overviewHiddenId = 0;
        this._settings.connect('per-window-changed', this._sourcesPerWindowChanged.bind(this));
        this._sourcesPerWindowChanged();
        this._disableIBus = false;
        this._reloading = false;
    }

    reload() {
        this._reloading = true;
        this._keyboardManager.setKeyboardOptions(this._settings.keyboardOptions);
        this._inputSourcesChanged();
        this._reloading = false;
    }

    _ibusReadyCallback(im, ready) {
        if (this._ibusReady == ready)
            return;

        this._ibusReady = ready;
        this._mruSources = [];
        this._inputSourcesChanged();
    }

    _modifiersSwitcher() {
        let sourceIndexes = Object.keys(this._inputSources);
        if (sourceIndexes.length == 0) {
            releaseKeyboard();
            return true;
        }

        let is = this._currentSource;
        if (!is)
            is = this._inputSources[sourceIndexes[0]];

        let nextIndex = is.index + 1;
        if (nextIndex > sourceIndexes[sourceIndexes.length - 1])
            nextIndex = 0;

        while (!(is = this._inputSources[nextIndex]))
            nextIndex += 1;

        is.activate(true);
        return true;
    }

    _switchInputSource(display, window, binding) {
        if (this._mruSources.length < 2)
            return;

        // HACK: Fall back on simple input source switching since we
        // can't show a popup switcher while a GrabHelper grab is in
        // effect without considerable work to consolidate the usage
        // of pushModal/popModal and grabHelper. See
        // https://bugzilla.gnome.org/show_bug.cgi?id=695143 .
        // if (Main.actionMode == Shell.ActionMode.POPUP) {
        //     this._modifiersSwitcher();
        //     return;
        // }

        let popup = new InputSourcePopup(this._mruSources, this._keybindingAction, this._keybindingActionBackward);
        if (!popup.show(binding.is_reversed(), binding.get_name(), binding.get_mask()))
            popup.fadeAndDestroy();
    }

    _keyboardOptionsChanged() {
        this._keyboardManager.setKeyboardOptions(this._settings.keyboardOptions);
        this._keyboardManager.reapply();
    }

    _updateMruSettings() {
        // If IBus is not ready we don't have a full picture of all
        // the available sources, so don't update the setting
        if (!this._ibusReady)
            return;

        // If IBus is temporarily disabled, don't update the setting
        if (this._disableIBus)
            return;

        let sourcesList = [];
        for (let i = 0; i < this._mruSources.length; ++i) {
            let source = this._mruSources[i];
            sourcesList.push([source.type, source.id]);
        }

        this._settings.mruSources = sourcesList;
    }

    _currentInputSourceChanged(newSource) {
        let oldSource;
        [oldSource, this._currentSource] = [this._currentSource, newSource];

        this.emit('current-source-changed', oldSource);

        for (let i = 1; i < this._mruSources.length; ++i) {
            if (this._mruSources[i] == newSource) {
                let currentSource = this._mruSources.splice(i, 1);
                this._mruSources = currentSource.concat(this._mruSources);
                break;
            }
        }
        this._changePerWindowSource();
    }

    activateInputSource(is, interactive) {
        // The focus changes during holdKeyboard/releaseKeyboard may trick
        // the client into hiding UI containing the currently focused entry.
        // So holdKeyboard/releaseKeyboard are not called when
        // 'set-content-type' signal is received.
        // E.g. Focusing on a password entry in a popup in Xorg Firefox
        // will emit 'set-content-type' signal.
        // https://gitlab.gnome.org/GNOME/gnome-shell/issues/391
        if (!this._reloading)
            holdKeyboard();
        this._keyboardManager.apply(is.xkbId);

        // All the "xkb:..." IBus engines simply "echo" back symbols,
        // despite their naming implying differently, so we always set
        // one in order for XIM applications to work given that we set
        // XMODIFIERS=@im=ibus in the first place so that they can
        // work without restarting when/if the user adds an IBus input
        // source.
        let engine;
        if (is.type == INPUT_SOURCE_TYPE_IBUS)
            engine = is.id;
        else
            engine = 'xkb:us::eng';

        if (!this._reloading)
            this._ibusManager.setEngine(engine, releaseKeyboard);
        else
            this._ibusManager.setEngine(engine);
        this._currentInputSourceChanged(is);

        if (interactive)
            this._updateMruSettings();
    }

    _updateMruSources() {
        let sourcesList = [];
        for (let i in this._inputSources)
            sourcesList.push(this._inputSources[i]);

        this._keyboardManager.setUserLayouts(sourcesList.map(x => x.xkbId));

        if (!this._disableIBus && this._mruSourcesBackup) {
            this._mruSources = this._mruSourcesBackup;
            this._mruSourcesBackup = null;
        }

        // Initialize from settings when we have no MRU sources list
        if (this._mruSources.length == 0) {
            let mruSettings = this._settings.mruSources;
            for (let i = 0; i < mruSettings.length; i++) {
                let mruSettingSource = mruSettings[i];
                let mruSource = null;

                for (let j = 0; j < sourcesList.length; j++) {
                    let source = sourcesList[j];
                    if (source.type == mruSettingSource.type &&
                        source.id == mruSettingSource.id) {
                        mruSource = source;
                        break;
                    }
                }

                if (mruSource)
                    this._mruSources.push(mruSource);
            }
        }

        let mruSources = [];
        for (let i = 0; i < this._mruSources.length; i++) {
            for (let j = 0; j < sourcesList.length; j++) {
                if (this._mruSources[i].type == sourcesList[j].type &&
                    this._mruSources[i].id == sourcesList[j].id) {
                    mruSources = mruSources.concat(sourcesList.splice(j, 1));
                    break;
                }
            }
        }
        this._mruSources = mruSources.concat(sourcesList);
    }

    _inputSourcesChanged() {
        let sources = this._settings.inputSources;
        let nSources = sources.length;

        this._currentSource = null;
        this._inputSources = {};
        this._ibusSources = {};

        let infosList = [];
        for (let i = 0; i < nSources; i++) {
            let displayName;
            let shortName;
            let type = sources[i].type;
            let id = sources[i].id;
            let exists = false;

            if (type == INPUT_SOURCE_TYPE_XKB) {
                [exists, displayName, shortName] =
                    this._xkbInfo.get_layout_info(id);
            } else if (type == INPUT_SOURCE_TYPE_IBUS) {
                if (this._disableIBus)
                    continue;
                let engineDesc = this._ibusManager.getEngineDesc(id);
                if (engineDesc) {
                    let language = IBus.get_language_name(engineDesc.get_language());
                    let longName = engineDesc.get_longname();
                    let textdomain = engineDesc.get_textdomain();
                    if (textdomain != '')
                        longName = Gettext.dgettext(textdomain, longName);
                    exists = true;
                    displayName = '%s (%s)'.format(language, longName);
                    shortName = this._makeEngineShortName(engineDesc);
                }
            }

            if (exists)
                infosList.push({ type, id, displayName, shortName });
        }

        if (infosList.length == 0) {
            let type = INPUT_SOURCE_TYPE_XKB;
            let id = DEFAULT_LAYOUT;
            let [, displayName, shortName] = this._xkbInfo.get_layout_info(id);
            infosList.push({ type, id, displayName, shortName });
        }

        let inputSourcesByShortName = {};
        for (let i = 0; i < infosList.length; i++) {
            let is = new InputSource(infosList[i].type,
                                     infosList[i].id,
                                     infosList[i].displayName,
                                     infosList[i].shortName,
                                     i);
            is.connect('activate', this.activateInputSource.bind(this));

            if (!(is.shortName in inputSourcesByShortName))
                inputSourcesByShortName[is.shortName] = [];
            inputSourcesByShortName[is.shortName].push(is);

            this._inputSources[is.index] = is;

            if (is.type == INPUT_SOURCE_TYPE_IBUS)
                this._ibusSources[is.id] = is;
        }

        for (let i in this._inputSources) {
            let is = this._inputSources[i];
            if (inputSourcesByShortName[is.shortName].length > 1) {
                let sub = inputSourcesByShortName[is.shortName].indexOf(is) + 1;
                is.shortName += String.fromCharCode(0x2080 + sub);
            }
        }

        this.emit('sources-changed');

        this._updateMruSources();

        if (this._mruSources.length > 0)
            this._mruSources[0].activate(false);

        // All ibus engines are preloaded here to reduce the launching time
        // when users switch the input sources.
        this._ibusManager.preloadEngines(Object.keys(this._ibusSources));
    }

    _makeEngineShortName(engineDesc) {
        let symbol = engineDesc.get_symbol();
        if (symbol && symbol[0])
            return symbol;

        let langCode = engineDesc.get_language().split('_', 1)[0];
        if (langCode.length == 2 || langCode.length == 3)
            return langCode.toLowerCase();

        return String.fromCharCode(0x2328); // keyboard glyph
    }

    _ibusPropertiesRegistered(im, engineName, props) {
        let source = this._ibusSources[engineName];
        if (!source)
            return;

        source.properties = props;

        if (source == this._currentSource)
            this.emit('current-source-changed', null);
    }

    _ibusPropertyUpdated(im, engineName, prop) {
        let source = this._ibusSources[engineName];
        if (!source)
            return;

        if (this._updateSubProperty(source.properties, prop) &&
            source == this._currentSource)
            this.emit('current-source-changed', null);
    }

    _updateSubProperty(props, prop) {
        if (!props)
            return false;

        let p;
        for (let i = 0; (p = props.get(i)) != null; ++i) {
            if (p.get_key() == prop.get_key() && p.get_prop_type() == prop.get_prop_type()) {
                p.update(prop);
                return true;
            } else if (p.get_prop_type() == IBus.PropType.MENU) {
                if (this._updateSubProperty(p.get_sub_props(), prop))
                    return true;
            }
        }
        return false;
    }

    _ibusSetContentType(im, purpose, _hints) {
        if (purpose == IBus.InputPurpose.PASSWORD) {
            if (Object.keys(this._inputSources).length == Object.keys(this._ibusSources).length)
                return;

            if (this._disableIBus)
                return;
            this._disableIBus = true;
            this._mruSourcesBackup = this._mruSources.slice();
        } else {
            if (!this._disableIBus)
                return;
            this._disableIBus = false;
        }
        this.reload();
    }

    _getNewInputSource(current) {
        let sourceIndexes = Object.keys(this._inputSources);
        if (sourceIndexes.length == 0)
            return null;

        if (current) {
            for (let i in this._inputSources) {
                let is = this._inputSources[i];
                if (is.type == current.type &&
                    is.id == current.id)
                    return is;
            }
        }

        return this._inputSources[sourceIndexes[0]];
    }

    _getCurrentWindow() {
        if (Main.overview.visible)
            return Main.overview;
        else
            return global.display.focus_window;
    }

    _setPerWindowInputSource() {
        let window = this._getCurrentWindow();
        if (!window)
            return;

        if (!window._inputSources ||
            window._inputSources !== this._inputSources) {
            window._inputSources = this._inputSources;
            window._currentSource = this._getNewInputSource(window._currentSource);
        }

        if (window._currentSource)
            window._currentSource.activate(false);
    }

    _sourcesPerWindowChanged() {
        this._sourcesPerWindow = this._settings.perWindow;

        if (this._sourcesPerWindow && this._focusWindowNotifyId == 0) {
            this._focusWindowNotifyId = global.display.connect('notify::focus-window',
                                                               this._setPerWindowInputSource.bind(this));
            this._overviewShowingId = Main.overview.connect('showing',
                                                            this._setPerWindowInputSource.bind(this));
            this._overviewHiddenId = Main.overview.connect('hidden',
                                                           this._setPerWindowInputSource.bind(this));
        } else if (!this._sourcesPerWindow && this._focusWindowNotifyId != 0) {
            global.display.disconnect(this._focusWindowNotifyId);
            this._focusWindowNotifyId = 0;
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = 0;
            Main.overview.disconnect(this._overviewHiddenId);
            this._overviewHiddenId = 0;

            let windows = global.get_window_actors().map(w => w.meta_window);
            for (let i = 0; i < windows.length; ++i) {
                delete windows[i]._inputSources;
                delete windows[i]._currentSource;
            }
            delete Main.overview._inputSources;
            delete Main.overview._currentSource;
        }
    }

    _changePerWindowSource() {
        if (!this._sourcesPerWindow)
            return;

        let window = this._getCurrentWindow();
        if (!window)
            return;

        window._inputSources = this._inputSources;
        window._currentSource = this._currentSource;
    }

    get currentSource() {
        return this._currentSource;
    }

    get inputSources() {
        return this._inputSources;
    }
};
Signals.addSignalMethods(InputSourceManager.prototype);

let _inputSourceManager = null;

function getInputSourceManager() {
    if (_inputSourceManager == null)
        _inputSourceManager = new InputSourceManager();
    return _inputSourceManager;
}

var InputSourceIndicatorContainer = GObject.registerClass(
class InputSourceIndicatorContainer extends St.Widget {

    vfunc_get_preferred_width(forHeight) {
        // Here, and in vfunc_get_preferred_height, we need to query
        // for the height of all children, but we ignore the results
        // for those we don't actually display.
        return this.get_children().reduce((maxWidth, child) => {
            let width = child.get_preferred_width(forHeight);
            return [Math.max(maxWidth[0], width[0]),
                    Math.max(maxWidth[1], width[1])];
        }, [0, 0]);
    }

    vfunc_get_preferred_height(forWidth) {
        return this.get_children().reduce((maxHeight, child) => {
            let height = child.get_preferred_height(forWidth);
            return [Math.max(maxHeight[0], height[0]),
                    Math.max(maxHeight[1], height[1])];
        }, [0, 0]);
    }

    vfunc_allocate(box, flags) {
        this.set_allocation(box, flags);

        // translate box to (0, 0)
        box.x2 -= box.x1;
        box.x1 = 0;
        box.y2 -= box.y1;
        box.y1 = 0;

        this.get_children().forEach(c => {
            c.allocate_align_fill(box, 0.5, 0.5, false, false, flags);
        });
    }
});
/*
var InputSourceIndicator = GObject.registerClass(
class InputSourceIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.5, _("Keyboard"));

        this.connect('destroy', this._onDestroy.bind(this));

        this._menuItems = {};
        this._indicatorLabels = {};

        this._container = new InputSourceIndicatorContainer();

        this._hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        this._hbox.add_child(this._container);
        this._hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));

        this.add_child(this._hbox);

        this._propSeparator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._propSeparator);
        this._propSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._propSection);
        this._propSection.actor.hide();

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._showLayoutItem = this.menu.addAction(_("Show Keyboard Layout"), this._showLayout.bind(this));

        Main.sessionMode.connect('updated', this._sessionUpdated.bind(this));
        this._sessionUpdated();

        this._inputSourceManager = getInputSourceManager();
        this._inputSourceManagerSourcesChangedId =
            this._inputSourceManager.connect('sources-changed', this._sourcesChanged.bind(this));
        this._inputSourceManagerCurrentSourceChangedId =
            this._inputSourceManager.connect('current-source-changed', this._currentSourceChanged.bind(this));
        this._inputSourceManager.reload();
    }

    _onDestroy() {
        if (this._inputSourceManager) {
            this._inputSourceManager.disconnect(this._inputSourceManagerSourcesChangedId);
            this._inputSourceManager.disconnect(this._inputSourceManagerCurrentSourceChangedId);
            this._inputSourceManager = null;
        }
    }

    _sessionUpdated() {
        // re-using "allowSettings" for the keyboard layout is a bit shady,
        // but at least for now it is used as "allow popping up windows
        // from shell menus"; we can always add a separate sessionMode
        // option if need arises.
        this._showLayoutItem.visible = Main.sessionMode.allowSettings;
    }

    _sourcesChanged() {
        for (let i in this._menuItems)
            this._menuItems[i].destroy();
        for (let i in this._indicatorLabels)
            this._indicatorLabels[i].destroy();

        this._menuItems = {};
        this._indicatorLabels = {};

        let menuIndex = 0;
        for (let i in this._inputSourceManager.inputSources) {
            let is = this._inputSourceManager.inputSources[i];

            let menuItem = new LayoutMenuItem(is.displayName, is.shortName);
            menuItem.connect('activate', () => is.activate(true));

            let indicatorLabel = new St.Label({ text: is.shortName,
                                                visible: false });

            this._menuItems[i] = menuItem;
            this._indicatorLabels[i] = indicatorLabel;
            is.connect('changed', () => {
                menuItem.indicator.set_text(is.shortName);
                indicatorLabel.set_text(is.shortName);
            });

            this.menu.addMenuItem(menuItem, menuIndex++);
            this._container.add_actor(indicatorLabel);
        }
    }

    _currentSourceChanged(manager, oldSource) {
        let nVisibleSources = Object.keys(this._inputSourceManager.inputSources).length;
        let newSource = this._inputSourceManager.currentSource;

        if (oldSource) {
            this._menuItems[oldSource.index].setOrnament(PopupMenu.Ornament.NONE);
            this._indicatorLabels[oldSource.index].hide();
        }

        if (!newSource || (nVisibleSources < 2 && !newSource.properties)) {
            // This source index might be invalid if we weren't able
            // to build a menu item for it, so we hide ourselves since
            // we can't fix it here. *shrug*

            // We also hide if we have only one visible source unless
            // it's an IBus source with properties.
            this.menu.close();
            this.hide();
            return;
        }

        this.show();

        this._buildPropSection(newSource.properties);

        this._menuItems[newSource.index].setOrnament(PopupMenu.Ornament.DOT);
        this._indicatorLabels[newSource.index].show();
    }

    _buildPropSection(properties) {
        this._propSeparator.hide();
        this._propSection.actor.hide();
        this._propSection.removeAll();

        this._buildPropSubMenu(this._propSection, properties);

        if (!this._propSection.isEmpty()) {
            this._propSection.actor.show();
            this._propSeparator.show();
        }
    }

    _buildPropSubMenu(menu, props) {
        if (!props)
            return;

        let ibusManager = IBusManager.getIBusManager();
        let radioGroup = [];
        let p;
        for (let i = 0; (p = props.get(i)) != null; ++i) {
            let prop = p;

            if (!prop.get_visible())
                continue;

            if (prop.get_key() == 'InputMode') {
                let text;
                if (prop.get_symbol)
                    text = prop.get_symbol().get_text();
                else
                    text = prop.get_label().get_text();

                let currentSource = this._inputSourceManager.currentSource;
                if (currentSource) {
                    let indicatorLabel = this._indicatorLabels[currentSource.index];
                    if (text && text.length > 0 && text.length < 3)
                        indicatorLabel.set_text(text);
                }
            }

            let item;
            let type = prop.get_prop_type();
            switch (type) {
            case IBus.PropType.MENU:
                item = new PopupMenu.PopupSubMenuMenuItem(prop.get_label().get_text());
                this._buildPropSubMenu(item.menu, prop.get_sub_props());
                break;

            case IBus.PropType.RADIO:
                item = new PopupMenu.PopupMenuItem(prop.get_label().get_text());
                item.prop = prop;
                radioGroup.push(item);
                item.radioGroup = radioGroup;
                item.setOrnament(prop.get_state() == IBus.PropState.CHECKED
                    ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
                item.connect('activate', () => {
                    if (item.prop.get_state() == IBus.PropState.CHECKED)
                        return;

                    let group = item.radioGroup;
                    for (let j = 0; j < group.length; ++j) {
                        if (group[j] == item) {
                            item.setOrnament(PopupMenu.Ornament.DOT);
                            item.prop.set_state(IBus.PropState.CHECKED);
                            ibusManager.activateProperty(item.prop.get_key(),
                                                         IBus.PropState.CHECKED);
                        } else {
                            group[j].setOrnament(PopupMenu.Ornament.NONE);
                            group[j].prop.set_state(IBus.PropState.UNCHECKED);
                            ibusManager.activateProperty(group[j].prop.get_key(),
                                                         IBus.PropState.UNCHECKED);
                        }
                    }
                });
                break;

            case IBus.PropType.TOGGLE:
                item = new PopupMenu.PopupSwitchMenuItem(prop.get_label().get_text(), prop.get_state() == IBus.PropState.CHECKED);
                item.prop = prop;
                item.connect('toggled', () => {
                    if (item.state) {
                        item.prop.set_state(IBus.PropState.CHECKED);
                        ibusManager.activateProperty(item.prop.get_key(),
                                                     IBus.PropState.CHECKED);
                    } else {
                        item.prop.set_state(IBus.PropState.UNCHECKED);
                        ibusManager.activateProperty(item.prop.get_key(),
                                                     IBus.PropState.UNCHECKED);
                    }
                });
                break;

            case IBus.PropType.NORMAL:
                item = new PopupMenu.PopupMenuItem(prop.get_label().get_text());
                item.prop = prop;
                item.connect('activate', () => {
                    ibusManager.activateProperty(item.prop.get_key(),
                                                 item.prop.get_state());
                });
                break;

            case IBus.PropType.SEPARATOR:
                item = new PopupMenu.PopupSeparatorMenuItem();
                break;

            default:
                log('IBus property %s has invalid type %d'.format(prop.get_key(), type));
                continue;
            }

            item.setSensitive(prop.get_sensitive());
            menu.addMenuItem(item);
        }
    }

    _showLayout() {
        Main.overview.hide();

        let source = this._inputSourceManager.currentSource;
        let xkbLayout = '';
        let xkbVariant = '';

        if (source.type == INPUT_SOURCE_TYPE_XKB) {
            [, , , xkbLayout, xkbVariant] = getXkbInfo().get_layout_info(source.id);
        } else if (source.type == INPUT_SOURCE_TYPE_IBUS) {
            let engineDesc = IBusManager.getIBusManager().getEngineDesc(source.id);
            if (engineDesc) {
                xkbLayout = engineDesc.get_layout();
                xkbVariant = engineDesc.get_layout_variant();
            }
        }

        if (!xkbLayout || xkbLayout.length == 0)
            return;

        let description = xkbLayout;
        if (xkbVariant.length > 0)
            description = '%s\t%s'.format(description, xkbVariant);

        Util.spawn(['gkbd-keyboard-display', '-l', description]);
    }
});
*/
