// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Clutter, GObject} = imports.gi;

var InputMethod = GObject.registerClass(
class InputMethod extends Clutter.InputMethod {
    _init() {
        super._init();
    }

    vfunc_focus_in(focus) {
    }

    vfunc_focus_out() {
    }

    vfunc_reset() {
    }

    vfunc_set_cursor_location(rect) {
    }

    vfunc_set_surrounding(text, cursor, anchor) {
    }

    vfunc_update_content_hints(hints) {
    }

    vfunc_update_content_purpose(purpose) {
    }

    vfunc_filter_key_event(event) {
    }
});
