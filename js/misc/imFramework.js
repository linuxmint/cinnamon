// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported getFramework, FRAMEWORK_IBUS, FRAMEWORK_FCITX, FRAMEWORK_NONE */

// Which input-method framework is active for this session.
//
// The detection is deliberately asymmetric between X11 and Wayland, because the
// input method lives in a different place in each:
//
//   X11:     input methods are the toolkit's / X server's domain - muffin is not
//            involved. The user's choice is applied by mintlocale-im / im-config
//            at session start as GTK_IM_MODULE / XMODIFIERS, and we trust that
//            env: it is the live truth of what actually took effect this session
//            (not merely what was selected), and needs no subprocess to query.
//
//   Wayland: the env is NOT a signal - apps reach the input method through the
//            compositor (muffin funnels their text-input-v3 into an external
//            fcitx via input-method-v2, with virtual-keyboard-v1 for key
//            re-injection), so we deliberately never export GTK_IM_MODULE=fcitx,
//            and cinnamon-session actively clears the client-side IM env. muffin
//            is the authority here: it reads the im-config selection
//            (~/.xinputrc: run_im fcitx5) to decide whether to run that bridge,
//            so we simply ask it - Meta.im_mode_is_fcitx() - rather than re-parse
//            the file and risk disagreeing with the compositor.
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

    let isFcitx;
    if (Meta.is_wayland_compositor()) {
        // Ask the compositor - it already made this call (and checked that
        // fcitx5 is installed) when deciding whether to bridge fcitx.
        isFcitx = Meta.im_mode_is_fcitx();
    } else {
        // On X11 trust the env im-config exported. Require fcitx5 to actually be
        // installed too (im-config does not check, and this pins us to fcitx5).
        let hasFcitx5 = GLib.find_program_in_path('fcitx5') != null;
        let mod = (GLib.getenv('GTK_IM_MODULE') || GLib.getenv('XMODIFIERS') || '').toLowerCase();
        isFcitx = hasFcitx5 && mod.includes('fcitx');
    }
    _framework = isFcitx ? FRAMEWORK_FCITX : FRAMEWORK_IBUS;

    return _framework;
}
