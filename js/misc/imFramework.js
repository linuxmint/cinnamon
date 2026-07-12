// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported getFramework, FRAMEWORK_IBUS, FRAMEWORK_FCITX, FRAMEWORK_NONE */

// Which input-method framework is active for this session.
//
// On X11 the choice is made by the user via mintlocale-im / im-config, which
// exports GTK_IM_MODULE / XMODIFIERS at session start. We trust those: they are
// the live truth for this session and need no subprocess to query.
//
// On Wayland, muffin routes app text-input (text-input-v3) through the in-process
// ClutterInputMethod, which only has an ibus backend; there is no path for an
// external fcitx to connect. So Wayland is always treated as ibus for now.
//
// Only an explicit fcitx selection changes behaviour; everything else stays on
// the historical ibus path, so non-fcitx sessions are unaffected.

const { GLib, Meta } = imports.gi;

var FRAMEWORK_IBUS = 'ibus';
var FRAMEWORK_FCITX = 'fcitx';
var FRAMEWORK_NONE = 'none';

let _framework = null;

function getFramework() {
    if (_framework != null)
        return _framework;

    if (Meta.is_wayland_compositor()) {
        _framework = FRAMEWORK_IBUS;
        return _framework;
    }

    // im-config sets GTK_IM_MODULE=fcitx from ~/.xinputrc without checking that
    // fcitx is installed, so a stale config after uninstalling fcitx would still
    // claim fcitx. Require the fcitx5 binary to actually be present (this also
    // pins us to fcitx5, never fcitx4).
    let mod = (GLib.getenv('GTK_IM_MODULE') || GLib.getenv('XMODIFIERS') || '').toLowerCase();
    let isFcitx = mod.includes('fcitx') && GLib.find_program_in_path('fcitx5') != null;
    _framework = isFcitx ? FRAMEWORK_FCITX : FRAMEWORK_IBUS;

    return _framework;
}
