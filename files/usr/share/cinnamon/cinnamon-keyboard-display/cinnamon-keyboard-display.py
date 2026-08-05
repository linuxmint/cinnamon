#!/usr/bin/python3

import argparse
import collections
import copy
import functools
import gettext
import json
import math
import sys
import unicodedata
from pathlib import Path

from setproctitle import setproctitle

import gi
gi.require_version("CinnamonDesktop", "3.0")
gi.require_version("Gtk", "3.0")
gi.require_version("Pango", "1.0")
gi.require_version("PangoCairo", "1.0")
gi.require_version("XApp", "1.0")
from gi.repository import (CinnamonDesktop, Gtk, Gdk, Gio, GLib, Pango,
                           PangoCairo, XApp)

from xkbcommon import xkb

gettext.install("cinnamon", "/usr/share/locale")

PROGRAM_NAME = "cinnamon-keyboard-display"

_HERE = Path(__file__).resolve().parent
GEOMETRY_PATH = _HERE / "geometries.json"
UI_PATH = _HERE / "cinnamon-keyboard-display.ui"

SETTINGS_PATH = "/usr/share/cinnamon/cinnamon-settings"

LAYOUT_VIEWER_SCHEMA = "org.cinnamon.layout-viewer"
MODEL_KEY = "model"

INPUT_SOURCES_SCHEMA = "org.cinnamon.desktop.input-sources"
XKB_OPTIONS_KEY = "xkb-options"

DEFAULT_MODEL = "pc105"

KEY_UNIT = 44
# Gap and corner fillet, given in pixels at the default key size and
# scaling with it.
KEY_PAD = 3.0 / KEY_UNIT
KEY_RADIUS = 2.0 / KEY_UNIT
# Kept clear inside the outline so a label filling its key does not run
# into the border.
LABEL_PAD = 1.0 / KEY_UNIT

# How far the ISO Return's lower leg is inset from its left edge, in key
# units. The outline and the hit test both work from this, or the Return
# answers for the strip of the backslash key beneath it.
ISO_RETURN_INSET = 0.25

# Font sizes as a fraction of the key size, so they track the zoom.
LEVEL_FONT = 0.255
LABEL_FONT = 0.22
# Larger, since one level has the whole key.
SINGLE_FONT = 0.29

TOOLTIP_KEY_SIZE = 32

# Where each level sits on a key face, as (column, row) in level order:
# L1 bottom-left, L2 top-left, L3 bottom-right, L4 top-right.
LEVEL_SLOTS = ((0, 1), (0, 0), (1, 1), (1, 0))

# Every keymap here is built from one layout name, so it holds a single
# group - xkb's term for one of the layouts a keymap can carry.
KEYMAP_GROUP = 0

# A stack switcher shows an icon in place of the page label.
ALL_PAGE_ICON = "xsi-keyboard-symbolic"

# What a key position carrying nothing reports: an unused level, or one
# an option has deliberately blanked - caps:none does that to Caps Lock.
# Neither spelling is anything to put on a key face.
NO_KEYSYMS = ("NoSymbol", "VoidSymbol")

# What Control reaches that is a command rather than something typed:
# the VT switches on the function keys, the X server's own on the numpad
# operators, and the Break every layout hangs off Pause.

# Options bring commands of their own: terminate:ctrl_alt_bksp reaches
# Terminate_Server, the grp: switches reach ISO_Next_Group. Those are
# left to count as content deliberately, so that a keyboard shows what
# an option did to it rather than hiding it.
CONTROL_COMMANDS = {
    *(f"XF86Switch_VT_{n}" for n in range(1, 13)),
    "XF86Ungrab", "XF86ClearGrab", "XF86Prev_VMode", "XF86Next_VMode",
    "Break",
}

Level = collections.namedtuple("Level", "index keysym text mask mods mark")
KeyInfo = collections.namedtuple("KeyInfo", "levels label shown faces extra")
PlacedKey = collections.namedtuple("PlacedKey", "name x y w h shape")

# Key labels: names GTK gives us

# Looked up under GTK's "keyboard label" msgid context, so these arrive
# translated through the distro's GNOME language pack and cost us no
# strings of our own. Declared in gdk/keyname-table.h, bar the modifier
# names in gtkaccellabel.c.

# Keys naming a function rather than a character, labelled from the
# keysym they carry rather than from where they sit: an option can move
# any of them, and caps:swapescape would otherwise leave "Caps" on a key
# that now sends Escape.

# FK13 upwards are here because what they carry varies with the options:
# XF86Tools and the Launch and media series under inet(evdev),
# Print/Scroll Lock/Pause under apple:alupckeys, and the F13-F24 their
# caps read only under fkeys:basic_13-24.

# Caps Lock reaches MODIFIER_LABELS first while it really is Caps Lock,
# GTK having no msgid for that keysym.
KEYSYM_LABEL_KEYS = {
    "ESC", "CAPS", "NMLK", "SCLK", "PAUS",
    "HOME", "END", "INS", "DELE",
    "COMP", "LWIN", "RWIN",
    *(f"FK{n:02d}" for n in range(13, 25)),
}

# Labeled from the keysym carried, not the position: right Alt is AltGr
# on the three quarters of layouts pulling in level3(ralt_switch) and
# plain Alt on the rest, so a fixed label would lie either way.

# The names double as msgids - GTK keys modifiers on the label, having no
# entry for Shift_L, which accelerator_get_label would spell "Shift L".
# AltGr, Level5, Caps and Menu are not msgids and stay English.
MODIFIER_LABELS = {
    "Shift_L": "Shift", "Shift_R": "Shift",
    "Control_L": "Ctrl", "Control_R": "Ctrl",
    "Alt_L": "Alt", "Alt_R": "Alt",
    "Meta_L": "Meta", "Meta_R": "Meta",
    "Super_L": "Super", "Super_R": "Super",
    "Hyper_L": "Hyper", "Hyper_R": "Hyper",
    "ISO_Level3_Shift": "AltGr", "Mode_switch": "AltGr",
    "ISO_Level5_Shift": "Level5",
    "Caps_Lock": "Caps",
    "Menu": "Menu",
}

# XKB names mask bits where GTK names keys, so the two want bridging:
# "Mod1" is a bit position and means nothing to a reader. Shift needs no
# entry, being GTK's own msgid already. The names themselves come from
# the keymap, which defines sixteen - see keymap_mod_names.

# Mod3 and Mod4 have no entry and so reach a tooltip as bit names.
# Naming them would mean picking one of the meanings each carries:
# symbols/pc binds Mod3 to ISO_Level5_Shift, which de(neo) uses, and
# grp:win_space_toggle puts a group switch behind Mod4 alone.
MOD_FRIENDLY = {
    "Lock": "Caps",
    "Control": "Ctrl",
    "Mod1": "Alt",
    "Mod2": "Num_Lock",
    "Mod5": "AltGr",
    # The virtual modifiers, spelt like the core bit each doubles so that
    # brai(left_hand)'s NumLock does not read differently from a
    # layout's Mod2.
    "NumLock": "Num_Lock",
    "LevelThree": "AltGr",
    "LevelFive": "Level5",
    "ScrollLock": "Scroll_Lock",
}

# Numpad keys that borrow a main key's name. GTK's own KP_Insert is
# "Einfg (Nmblck)" in German, which no half-height cell will take.
KP_BORROWED = {"KP_Insert": "Insert", "KP_Delete": "Delete"}

# Key labels: glyphs and symbols
# Literals of our own, but ones that read the same in every language:
# glyphs, F-numbering, and Japanese keys already in their board's script.
GLYPH_KEYS = {
    "BKSP": "⌫", "RTRN": "↵", "SPCE": "", "KPEN": "↵",
    "UP": "↑", "DOWN": "↓", "LEFT": "←", "RGHT": "→",
    "KPDV": "/", "KPMU": "*", "KPSU": "-", "KPAD": "+",
    "HKTG": "かな", "HENK": "変換", "MUHE": "無変換",
    # Stopping at twelve; above that see KEYSYM_LABEL_KEYS.
    **{f"FK{n:02d}": f"F{n}" for n in range(1, 13)},
}

# The numpad's cursor functions, which look more consistent than labels
# that could not be abbreviated, and would shrink at varying amounts.
# Insert and Delete have no clear symbol, see KP_BORROWED.
KP_LABELS = {
    "KP_Home": "↖", "KP_Up": "↑", "KP_Prior": "⇑",
    "KP_Left": "←", "KP_Right": "→",
    "KP_End": "↘", "KP_Down": "↓", "KP_Next": "⇓",
}

# Characters with no visible glyph: the joiners an Indic layout types
# (in carries the most, some of them on level one), the bidirectional
# controls an Arabic, Persian or Hebrew layout puts on its upper levels,
# plus the no-break spaces and the soft hyphen. Shown by the
# abbreviations Unicode itself uses, which none translate.

# Keyed on the name libxkbcommon reports: U+00A0 and U+00AD arrive as
# nobreakspace and hyphen, so U00A0 and U00AD entries would never match.
FORMAT_KEYS = {
    "U200B": "ZWSP", "U200C": "ZWNJ", "U200D": "ZWJ",
    "U061C": "ALM", "U200E": "LRM", "U200F": "RLM",
    "U202A": "LRE", "U202B": "RLE", "U202C": "PDF",
    "U202D": "LRO", "U202E": "RLO",
    "U2066": "LRI", "U2067": "RLI", "U2068": "FSI", "U2069": "PDI",
    "U202F": "NNBSP", "nobreakspace": "NBSP", "hyphen": "SHY",
}

# Numpad 5 carries no legend on a real keyboard, and GTK's name for it -
# "Begin (keypad)" - is of no use on a key face.
SUPPRESSED_KEYSYMS = {"KP_Begin"}

# Named outright because spelled_key reads the levels, and apl(dyalog)
# puts undrawable private-use codepoints on Tab, which would leave it
# quartered while every other layout spells it. spelled_key finds both
# of these unaided everywhere else.
SPELLED_KEYS = {"TAB", "PRSC"}

# Key labels: our own English
# English we invent rather than borrow, so it stays English in every
# locale. Wrapping any of it in _() would move it into cinnamon's own
# catalog at the cost of a new msgid.

ENGLISH_KEYS = {"PGUP": "PgUp", "PGDN": "PgDn"}

# What a key cap reads where GTK's own English is too long for a key
# face. Only reached when GTK has no translation to offer: a German
# board is labelled "Einfg", and saying "Ins" there would be our
# abbreviation of an English word the user never sees.

# brai's keys are chords, not characters. Not Unicode's single-dot
# patterns: those differ only in where one dot sits in a 2x4 cell,
# indistinguishable at key size, and dots 9 and 10 have none.
SHORT_LABELS = {
    "Sys_Req": "SysRq", "Insert": "Ins", "Delete": "Del",
    **{f"braille_dot_{n}": f"Dot {n}" for n in range(1, 11)},
}

# Dead keys
# Keysyms with no UTF-8 representation, mapped to a printable stand-in:
# a spacing accent where a legible one exists, the combining mark
# otherwise. Dead letter keys render as the letter.
_DEAD_MARKS = {
    **{f"dead_{letter}": letter for letter in "aeiouAEIOU"},
    "dead_grave": "`",
    "dead_acute": "´",
    "dead_circumflex": "^",
    "dead_tilde": "~",
    "dead_macron": "¯",
    "dead_breve": "˘",
    "dead_abovedot": "˙",
    "dead_diaeresis": "¨",
    "dead_abovering": "˚",
    "dead_doubleacute": "˝",
    "dead_caron": "ˇ",
    "dead_cedilla": "¸",
    "dead_ogonek": "˛",
    "dead_iota": "ͺ",
    "dead_voiced_sound": "゙",
    "dead_semivoiced_sound": "゚",
    "dead_belowdot": "̣",
    "dead_hook": "̉",
    "dead_horn": "̛",
    "dead_stroke": "̸",
    "dead_belowcomma": "̦",
    "dead_belowmacron": "̱",
    "dead_belowbreve": "̮",
    "dead_belowtilde": "̰",
    "dead_belowcircumflex": "̭",
    "dead_belowring": "̥",
    "dead_invertedbreve": "̑",
    "dead_doublegrave": "̏",
    "dead_greek": "ι",
    "dead_abovecomma": "ʼ",
    "dead_abovereversedcomma": "ʽ",
    "dead_capital_schwa": "Ə",
    "dead_small_schwa": "ə",
    "dead_currency": "¤",
}

# A combining mark shown alone needs a dotted circle to sit on, or it
# lands on whatever precedes it - or the font supplies a placeholder of
# its own, positioned to suit the script rather than our key faces.
DOTTED_CIRCLE = "◌"
DEAD_KEYS = {name: (DOTTED_CIRCLE + mark if unicodedata.combining(mark) else mark)
             for name, mark in _DEAD_MARKS.items()}

# An Arabic mark needs a font of its own to sit on its carrier; a general
# one leaves it beside rather than over. Only marks use these - they hold
# no Latin at all - so every other key keeps the theme's font.
ARABIC_MARK_FONTS = ("Noto Naskh Arabic", "Noto Kufi Arabic")
ARABIC_BLOCKS = ((0x0600, 0x06FF), (0x0750, 0x077F),
                 (0x08A0, 0x08FF), (0xFE70, 0xFEFF))


def level_text(keysym):
    """Return (display text, is_mark) for a keysym.

    A mark is an accent rather than a letter: a dead key's, or a
    combining character a layout types outright, as the Arabic harakat
    do under ordinary keysym names. The drawing colours it as an accent.
    """
    name = xkb.keysym_get_name(keysym)
    if name in DEAD_KEYS:
        return DEAD_KEYS[name], True
    if name.startswith("dead_"):
        return DOTTED_CIRCLE, True
    text = xkb.keysym_to_string(keysym)
    if text is None or not text.isprintable():
        return "", False
    if len(text) == 1 and unicodedata.combining(text):
        # Left bare, unlike DEAD_KEYS: the shaper supplies a circle where
        # the font has one, and ours would make two.
        return text, True
    return text, False


def mods_mask(keymap, keycode, level):
    """The modifier combination that reaches this level.

    A level can be reachable more than one way; the first mask is the
    one we describe.
    """
    masks = keymap.key_get_mods_for_level(keycode, KEYMAP_GROUP, level)
    return masks[0] if masks else 0


def keymap_mod_names(keymap):
    """Every modifier the keymap defines, in bit order.

    Read from the keymap because it names more than the core eight: the
    brai left_hand variants reach their numpad levels through NumLock,
    bit 8, which a fixed list of eight leaves nameless.
    """
    return [keymap.mod_get_name(index) for index in range(keymap.num_mods())]


def mods_label(names, mask):
    """Human-readable modifier combination, named as GTK names them.

    Routed through gtk_key_label so an untranslated run cannot leave a
    msgid on screen: Num_Lock reads "Num Lock" where GTK has nothing to
    say, and the names that are not keysyms at all come back untouched.
    """
    return "+".join(gtk_key_label(MOD_FRIENDLY.get(name, name))
                    for index, name in enumerate(names)
                    if mask & (1 << index))


def extract_keys(keymap, names):
    """Map XKB key name -> KeyInfo, for the keys a geometry draws.

    Asked for by name rather than swept from the keycode range: a keymap
    carries symbols for some 460 keys and no model draws more than 109
    of them.

    Levels without a keysym are kept as empty placeholders so that a
    level's position in the list always equals its level index - the
    renderer maps those positions onto key-face quadrants.
    """
    keys = {}
    mod_names = keymap_mod_names(keymap)
    for name in names:
        try:
            keycode = keymap.key_by_name(name)
        except xkb.XKBKeyDoesNotExist:
            continue
        levels = []
        populated = False
        for index in range(keymap.num_levels_for_key(keycode, KEYMAP_GROUP)):
            syms = keymap.key_get_syms_by_level(keycode, KEYMAP_GROUP, index)
            if syms:
                keysym = xkb.keysym_get_name(syms[0])
                text, mark = level_text(syms[0])
                populated = True
            else:
                keysym = "NoSymbol"
                text, mark = "", False
            mask = mods_mask(keymap, keycode, index)
            levels.append(Level(index=index,
                                keysym=keysym,
                                text=text,
                                mask=mask,
                                mods=mods_label(mod_names, mask) if mask else "",
                                mark=mark))
        if populated:
            keys[name] = key_info(name, levels)
    return keys


def _iter_keys(definition):
    """Every key in a definition, with the row holding it.

    The row list is copied so a caller may remove from it as it goes.
    """
    for block in definition["blocks"]:
        for row in block["rows"]:
            for key in list(row["keys"]):
                yield row, key


def _target_row(definition, index):
    """A row of the alphanumeric block, the only one a delta can target."""
    for block in definition["blocks"]:
        if block.get("name") == "alpha":
            return block["rows"][index]
    raise KeyError("geometry has no alpha block")


def _resolve_definition(data, model):
    """Follow 'inherits' and apply drop/override/insert deltas."""
    definition = data[model]
    if "inherits" not in definition:
        return copy.deepcopy(definition)

    resolved = _resolve_definition(data, definition["inherits"])
    resolved["description"] = definition.get("description",
                                             resolved.get("description", ""))

    dropped = set(definition.get("drop", []))
    overrides = definition.get("override", {})

    for row, key in _iter_keys(resolved):
        name = key.get("k")
        if name in dropped:
            row["keys"].remove(key)
        elif name in overrides:
            key.update(overrides[name])

    # A list rather than an object because the order is load-bearing: an
    # insert may anchor on one this same delta added, as jp106 hangs HKTG
    # off the HENK before it.
    for spec in definition.get("insert", []):
        name = spec["k"]
        entry = {"k": name}
        for field in ("w", "h", "shape"):
            if field in spec:
                entry[field] = spec[field]
        row = _target_row(resolved, spec["row"])
        anchor = spec.get("after") or spec.get("before")
        if anchor is None:
            position = len(row["keys"])
        else:
            for index, key in enumerate(row["keys"]):
                if key.get("k") == anchor:
                    position = index + 1 if "after" in spec else index
                    break
            else:
                raise KeyError(f"{model}: no {anchor} in alpha row "
                               f"{spec['row']} to anchor {name} to")
        row["keys"].insert(position, entry)

    return resolved


@functools.cache
def geometry_data():
    """Every model in the geometry file, keyed by name.  """
    return json.loads(GEOMETRY_PATH.read_text(encoding="utf-8"))

def geometry_models():
    """Every model we can draw, as (name, description) in file order. """
    return [(name, GLib.dgettext("xkeyboard-config",
                                 definition.get("description", name)))
            for name, definition in geometry_data().items()]

def geometry_model_names():
    return [name for name, _description in geometry_models()]

def load_geometry(model):
    """Return (list of PlacedKey, width in units, height in units).

    The model is one of geometry_models()' own names: --model is checked
    against them and so is the remembered one.
    """
    definition = _resolve_definition(geometry_data(), model)

    placed = []
    width = 0.0
    height = 0.0
    for block in definition["blocks"]:
        for row_index, row in enumerate(block["rows"]):
            x = block["x"]
            y = block["y"] + row_index
            for key in row["keys"]:
                if "gap" in key:
                    x += key["gap"]
                    continue
                w = key.get("w", 1.0)
                h = key.get("h", 1.0)
                placed.append(PlacedKey(name=key["k"], x=x, y=y,
                                        w=w, h=h, shape=key.get("shape")))
                x += w
                width = max(width, x)
                height = max(height, y + h)
    return placed, width, height

def keymap_from_names(context, model, layout, variant, options=None):
    """Compile a keymap from RMLVO names."""
    return context.keymap_new_from_names(model=model,
                                         layout=layout,
                                         variant=variant or None,
                                         options=options or None)

def layout_title(layout, variant):
    return f"{layout} ({variant})" if variant else layout

def split_options(options):
    """The -o argument as a list, tolerating spacing and a stray comma."""
    return [option.strip() for option in (options or "").split(",")
            if option.strip()]

@functools.cache
def option_catalog():
    """Every xkb option's description, keyed by option id.

    Built by asking each group what it holds, because an option's group
    is often not the part before its colon and description_for_option
    gives nothing for a guess: every compose: option sits in "Compose
    key", eurosign: and rupeesign: in "currencysign", and numpad:,
    apple:, misc:, shift: and grab: in "compat".
    """
    xkb_info = CinnamonDesktop.XkbInfo.new_with_extras()
    return {option: xkb_info.description_for_option(group, option)
            for group in xkb_info.get_all_option_groups()
            for option in xkb_info.get_options_for_group(group)}


def option_descriptions(options):
    """Each option as "code: description" markup, one to a line.

    The descriptions are xkeyboard-config's own, so they arrive
    translated and cost us no strings. One it does not know - a name from
    a newer version than the running session has - keeps its code alone.
    """
    known = option_catalog()
    lines = []
    for option in options:
        description = known.get(option)
        code = f"<b>{GLib.markup_escape_text(option)}</b>"
        lines.append(f"{code}: {GLib.markup_escape_text(description)}"
                     if description else code)
    return "\n".join(lines)


def layout_description(keymap):
    """The layout's full name, as the keymap itself records it.

    Read through the C call rather than the binding's layout_get_name,
    which decodes as ASCII and so raises on every name carrying a
    character outside it - fr(ergol)'s non-breaking hyphen, tr(us)'s
    dotless i, and four more among the layouts we ship.

    Taken from the keymap rather than from XkbInfo because only the
    keymap knows the model: an Apple board makes de "German (Macintosh)",
    a different symbols set and worth saying. xkeyboard-config's catalog
    translates the whole name.
    """
    name = xkb.lib.xkb_keymap_layout_get_name(keymap._keymap, KEYMAP_GROUP)
    if name == xkb.ffi.NULL:
        return ""
    return GLib.dgettext("xkeyboard-config",
                         xkb.ffi.string(name).decode("utf-8", "replace"))


def gtk_keyboard_label(msgid):
    """GTK's translation of a key name, or "" if it has none.

    dpgettext2 hands the msgid straight back when the catalog holds no
    entry for it, which is also what an English run looks like - so an
    unchanged answer means "GTK has nothing to add here".
    """
    label = GLib.dpgettext2("gtk30", "keyboard label", msgid)
    return "" if label == msgid else label


@functools.cache
def gtk_key_label(keysym_name):
    """Localised label for a keysym, via GTK's own translations.

    English has to be recognised rather than assumed absent before
    SHORT_LABELS stands in: GTK's en catalog rewrites Sys_Req as "Sys
    Req", a changed string but not a translation. Opening out the msgid's
    underscores identifies it, and a real translation - de's "S-Abf" -
    wins over our abbreviation.
    """
    label = gtk_keyboard_label(keysym_name) or accelerator_label(keysym_name)
    if label == keysym_name.replace("_", " "):
        return SHORT_LABELS.get(keysym_name, label)
    return label


def is_unicode_keysym(name):
    return (len(name) >= 5 and name[0] == "U"
            and all(c in "0123456789ABCDEF" for c in name[1:]))


def accelerator_label(keysym_name):
    """GTK's untranslated spelling of a keysym, or "" if it has none.

    U<hex> is an internal spelling, not a legend. What reaches here that
    way is mostly private-use and unassigned codepoints, with a handful
    of format and space characters FORMAT_KEYS does not name - none of
    them with a glyph to put on a key face.
    """
    if is_unicode_keysym(keysym_name):
        return ""
    keyval = Gdk.keyval_from_name(keysym_name)
    if keyval in (0, Gdk.KEY_VoidSymbol):
        return keysym_name.replace("_", " ")
    return Gtk.accelerator_get_label(keyval, 0)


def key_label(name, keysym=None):
    """Fixed label for a key, or None if it should show its keysyms."""
    if keysym in MODIFIER_LABELS:
        modifier = MODIFIER_LABELS[keysym]
        return gtk_keyboard_label(modifier) or modifier
    if name in GLYPH_KEYS:
        return GLYPH_KEYS[name]
    if name in KEYSYM_LABEL_KEYS and keysym is not None and keysym not in NO_KEYSYMS:
        return gtk_key_label(keysym)
    return ENGLISH_KEYS.get(name)

def is_typing_level(level):
    """Whether a level is something you can type.

    Control usually means a command rather than a level, but not always:
    the EIGHT_LEVEL_BY_CTRL type reaches real characters that way, which
    is how nbsp:level4nl puts U+202F on the space bar. So a Control level
    is dropped only when it carries one of the known commands.
    """
    if level.keysym in NO_KEYSYMS:
        return False
    return not (level.mask & Gdk.ModifierType.CONTROL_MASK
                and level.keysym in CONTROL_COMMANDS)


def _installed_mark_font():
    """The first of ARABIC_MARK_FONTS installed here, or None."""
    installed = {family.get_name()
                 for family in PangoCairo.FontMap.get_default().list_families()}
    return next((name for name in ARABIC_MARK_FONTS if name in installed), None)


ARABIC_MARK_FONT = _installed_mark_font()


def mark_font(text):
    """The family text has to be drawn in, or None to keep the current one."""
    if ARABIC_MARK_FONT is None:
        return None
    for char in text:
        if unicodedata.combining(char) and any(low <= ord(char) <= high
                                               for low, high in ARABIC_BLOCKS):
            return ARABIC_MARK_FONT
    return None


def sized_layout(widget, text, size):
    """A Pango layout at an absolute pixel size, in the widget's family."""
    layout = widget.create_pango_layout(text)
    description = Pango.FontDescription()
    family = mark_font(text)
    if family is not None:
        description.set_family(family)
    description.set_absolute_size(size * Pango.SCALE)
    layout.set_font_description(description)
    return layout


def fit_scale(tw, th, width, height):
    """How far text measuring tw by th must shrink to fit a box. """
    scale = 1.0
    if tw > width > 0:
        scale = min(scale, width / tw)
    if th > height > 0:
        scale = min(scale, height / th)
    return scale


def wrap_label(text, width_units):
    """Break a label's last word onto its own line on a narrow key,
    rather than shrinking it."""
    if width_units > 1.6 or " " not in text:
        return text
    head, _sep, tail = text.rpartition(" ")
    return f"{head}\n{tail}"

# Control-point distance that turns a cubic into a quarter circle.
ARC_KAPPA = 0.5523

def rounded_polygon(cr, points, radius):
    """Trace a polygon with its corners filleted.

    Works for the ISO Return as well as a plain key: each fillet is
    derived from the corner it rounds, so it follows whichever way the
    outline turns and the one concave corner needs no special handling.
    """
    def toward(start, end, distance):
        dx, dy = end[0] - start[0], end[1] - start[1]
        length = math.hypot(dx, dy)
        if length == 0:
            return start
        fraction = min(distance / length, 0.5)
        return (start[0] + dx * fraction, start[1] + dy * fraction)

    def control(anchor, corner):
        # Held back from the corner by ARC_KAPPA, which is what makes the
        # curve a circular arc rather than a tighter fillet.
        return (anchor[0] + (corner[0] - anchor[0]) * ARC_KAPPA,
                anchor[1] + (corner[1] - anchor[1]) * ARC_KAPPA)

    count = len(points)
    cr.move_to(*toward(points[0], points[1], radius))
    for index in range(count):
        corner = points[(index + 1) % count]
        start = toward(corner, points[index], radius)
        end = toward(corner, points[(index + 2) % count], radius)
        cr.line_to(*start)
        cr.curve_to(*control(start, corner), *control(end, corner), *end)
    cr.close_path()


def label_box(placed, unit, margin):
    """The (width, height) a key's own label is centred in.

    A double-height key centres over its whole face - the numpad's plus
    and Enter - bar the ISO Return, whose legend belongs on the upper
    leg, the only part of it the row below does not share.
    """
    height = unit if placed.shape == "iso-return" else placed.h * unit
    return placed.w * unit - margin * 2, height - margin * 2


def key_path(cr, placed, x, y, unit, pad, radius):
    """Trace a key outline, L-shaped for an ISO Return and square otherwise."""
    left = x + pad
    right = x + placed.w * unit - pad
    top = y + pad
    bottom = y + placed.h * unit - pad

    if placed.shape == "iso-return":
        # The upper leg is full width; the lower leg is inset from the
        # left so the backslash key on the row below sits beside it.
        inset = left + ISO_RETURN_INSET * unit
        middle = y + unit - pad
        points = [(left, top), (right, top), (right, bottom),
                  (inset, bottom), (inset, middle), (left, middle)]
    else:
        points = [(left, top), (right, top), (right, bottom), (left, bottom)]

    rounded_polygon(cr, points, radius)


def level_count(keys, geometry):
    """How many levels the layout actually puts to use.

    A level counts when some key produces something there that none of
    its lower levels already did. Comparing against the whole set rather
    than against level one alone matters: mv puts bar, brokenbar, bar,
    brokenbar on its LSGT key, and that repeat of levels one and two
    would otherwise read as a fourth level in use.
    """
    highest = 1
    for placed in geometry:
        info = keys.get(placed.name)
        if info is None:
            continue
        seen = set()
        for level in info.levels:
            if not is_typing_level(level):
                continue
            if level.keysym not in seen:
                highest = max(highest, level.index + 1)
            seen.add(level.keysym)
    return highest


def level_pages(levels):
    """Stack pages as (name, title, icon, level), All first then one per level.

    A page is titled with the level it shows, so a level nothing draws on
    reads as the gap it is rather than renumbering the ones above it.
    """
    pages = [("all", "", ALL_PAGE_ICON, None)]
    if len(levels) > 1:
        pages += [(str(n + 1), str(n + 1), None, n) for n in levels]
    return pages


def level_glyph(level):
    """What a level prints, or "" when it names a function instead."""
    if level.text:
        return level.text
    if level.keysym in KP_LABELS:
        return KP_LABELS[level.keysym]
    if level.keysym in KP_BORROWED:
        return gtk_key_label(KP_BORROWED[level.keysym])
    if level.keysym in FORMAT_KEYS:
        return FORMAT_KEYS[level.keysym]
    return ""


def level_face(level):
    """What to draw on a key face for a level, blank if it has no legend.

    Callers must skip levels is_typing_level rejects: NoSymbol has no
    glyph but does have a name, and naming it would put "NoSymbol" on
    up to 160 of the faces one keyboard shows - ph(qwerty-bay)'s count.
    """
    if level.keysym in SUPPRESSED_KEYSYMS:
        return ""
    return level_glyph(level) or gtk_key_label(level.keysym)


def single_face(name, level):
    """What a key shows when one level is displayed on its own."""
    if level.index == 0 and not level_glyph(level):
        # Level one is what the key is normally labelled with, so
        # Escape stays Escape and Return stays its glyph.
        label = key_label(name, level.keysym)
        if label is not None:
            return label
    return level_face(level)


def level_drawn(keys, geometry, index):
    """Whether any key has something to show at a level."""
    for placed in geometry:
        info = keys.get(placed.name)
        if info is None or index >= len(info.levels):
            continue
        level = info.levels[index]
        if is_typing_level(level) and single_face(placed.name, level).strip():
            return True
    return False


def used_levels(keys, geometry):
    """Which levels are worth a page of their own, lowest first. """
    return [index for index in range(level_count(keys, geometry))
            if level_drawn(keys, geometry, index)]


def spelled_key(name, levels):
    """Whether each level wants the whole key width rather than a quadrant.

    True for a key carrying functions rather than characters: its labels
    are words, and a word in a quarter face is a smudge. Read from the
    levels, so any layout putting two functions on a key gets what Tab
    and Print get.

    A key with nothing to draw is not spelled - se(swl) types private-use
    codepoints, which have neither glyph nor name.
    """
    if name in SPELLED_KEYS:
        return True
    typing = [level for level in levels if is_typing_level(level)]
    return (any(level_face(level) for level in typing)
            and not any(level_glyph(level) for level in typing))


def functions(levels):
    """How many distinct things a key's typing levels produce."""
    return len({level.keysym for level in levels if is_typing_level(level)})


def shown_levels(name, levels):
    """How many levels a key face has room for.

    A fixed-label key stands for its first level only. A spelled key
    gives every level the whole key width - "Left Tab" will not fit in
    half of one - so two fit where an ordinary key takes four.
    """
    spelled = spelled_key(name, levels)
    if key_label(name, levels[0].keysym if levels else None) is not None:
        # A label that is only the first of two keysyms does not speak
        # for the key: jp's Caps Lock is also Eisu, and both belong on
        # the face. A printed legend does speak for it, kana being what
        # that key says, and a second keysym that is a character - the
        # space bar's no-break space - is spelled_key's to refuse.
        if name in KEYSYM_LABEL_KEYS and spelled and functions(levels) > 1:
            return 2
        return 1
    return 2 if spelled else 4


def extra_levels(levels, shown):
    """Whether a key holds something its face does not show.

    Levels repeating a keysym already on the face do not count - the
    numpad's '+' is four levels of the same thing.
    """
    on_face = {level.keysym for level in levels[:shown]}
    return any(is_typing_level(level) and level.keysym not in on_face
               for level in levels[shown:])


def key_info(name, levels):
    """Everything about a key that the keymap alone decides.

    Worked out once per keymap: none of it changes afterwards, and the
    drawing wants all of it for every key of every frame.
    """
    shown = shown_levels(name, levels)
    return KeyInfo(levels=levels,
                   label=key_label(name, levels[0].keysym if levels else None),
                   shown=shown,
                   faces=[level_face(level) if is_typing_level(level) else ""
                          for level in levels[:shown]],
                   extra=extra_levels(levels, shown))


class TooltipKey(Gtk.DrawingArea):
    """A single key, drawn for the tooltip."""

    def __init__(self, text, mark):
        super().__init__()
        self.text = text
        self.mark = mark
        self.set_size_request(TOOLTIP_KEY_SIZE, TOOLTIP_KEY_SIZE)

    def _layout(self):
        return sized_layout(self, self.text, TOOLTIP_KEY_SIZE * 0.44)

    def do_get_preferred_width(self):
        # A level naming a key rather than typing a character - "Page Up" -
        # needs a wider face, the way such keys are wider in real life.
        text_width, _height = self._layout().get_pixel_size()
        width = max(TOOLTIP_KEY_SIZE, text_width + 14)
        return width, width

    def do_draw(self, cr):
        context = self.get_style_context()
        fg = context.get_color(Gtk.StateFlags.NORMAL)
        found, accent = context.lookup_color("theme_selected_bg_color")
        if not found:
            accent = fg

        width = self.get_allocated_width()
        height = self.get_allocated_height()
        rounded_polygon(cr, [(0.5, 0.5), (width - 0.5, 0.5),
                             (width - 0.5, height - 0.5), (0.5, height - 0.5)],
                        TOOLTIP_KEY_SIZE * KEY_RADIUS)
        cr.set_source_rgba(fg.red, fg.green, fg.blue, 0.10)
        cr.fill_preserve()
        cr.set_source_rgba(fg.red, fg.green, fg.blue, 0.45)
        cr.set_line_width(1)
        cr.stroke()

        layout = self._layout()
        tw, th = layout.get_pixel_size()
        colour = accent if self.mark else fg
        cr.set_source_rgba(colour.red, colour.green, colour.blue, 1.0)
        cr.move_to((width - tw) / 2.0, (height - th) / 2.0)
        PangoCairo.show_layout(cr, layout)
        return False


# Worn by the tooltip window only while a key's levels are inside it, so
# that none of this reaches the plain tooltips elsewhere in the window.
KEY_TOOLTIP_CLASS = "keyboard-key-tooltip"

KEY_TOOLTIP_CSS = b"""
tooltip.keyboard-key-tooltip.background {
    background-color: alpha(@theme_bg_color, 0.99);
    border: 1px solid alpha(@theme_fg_color, 0.15);
}
tooltip.keyboard-key-tooltip,
tooltip.keyboard-key-tooltip * {
    color: @theme_fg_color;
}
tooltip.keyboard-key-tooltip .keyboard-dim {
    color: alpha(@theme_fg_color, 0.55);
}
"""


@functools.cache
def _load_popup_style():
    provider = Gtk.CssProvider()
    provider.load_from_data(KEY_TOOLTIP_CSS)
    # Screen-wide because a provider set on one widget does not reach its
    # children, and these rules have to. The class is what narrows them.
    Gtk.StyleContext.add_provider_for_screen(
        Gdk.Screen.get_default(), provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)


def _tooltip_window_class(widget, add):
    """Tag the tooltip window holding widget, if it is in one yet.

    GTK keeps one tooltip window per display and hands it to whoever asks
    next, so the class goes on as the levels are mapped and comes off
    again as they go - or the next plain tooltip would inherit it.
    """
    window = widget.get_toplevel()
    if not isinstance(window, Gtk.Window):
        return
    context = window.get_style_context()
    if add:
        context.add_class(KEY_TOOLTIP_CLASS)
    else:
        context.remove_class(KEY_TOOLTIP_CLASS)


def level_column(levels):
    """A vertical run of levels: number, key face, keysym, modifiers, to show as
    a key's tooltip.
    """
    _load_popup_style()
    grid = Gtk.Grid(row_spacing=4, column_spacing=10)
    grid.connect("map", _tooltip_window_class, True)
    grid.connect("unmap", _tooltip_window_class, False)
    for row, level in enumerate(levels):
        number = Gtk.Label(xalign=1.0)
        number.set_markup(f"<b>{level.index + 1}</b>")
        number.get_style_context().add_class("keyboard-dim")
        grid.attach(number, 0, row, 1, 1)

        face = TooltipKey(level_face(level), level.mark)
        face.set_halign(Gtk.Align.START)
        grid.attach(face, 1, row, 1, 1)

        keysym = Gtk.Label(label=level.keysym, xalign=0.0)
        grid.attach(keysym, 2, row, 1, 1)

        if level.mods:
            mods = Gtk.Label(label=level.mods, xalign=0.0)
            mods.get_style_context().add_class("keyboard-dim")
            grid.attach(mods, 3, row, 1, 1)
    grid.show_all()
    return grid


class KeyboardArea(Gtk.DrawingArea):
    def __init__(self, keys, geometry, width_units, height_units, level=None):
        """Draw a keyboard, either every level at once or just one of them."""
        super().__init__()
        self.keys = keys
        self.geometry = geometry
        self.width_units = width_units
        self.height_units = height_units
        self.unit = 0
        self.level = level
        # Built on first hover and kept - a new layout or model builds
        # new pages, so these never go stale.
        self.tooltip_columns = {}
        self.set_size_request(int(width_units * KEY_UNIT),
                              int(height_units * KEY_UNIT))
        if level is None:
            self.set_has_tooltip(True)
            self.connect("query-tooltip", self._on_query_tooltip)

    def do_draw(self, cr):
        allocation = self.get_allocation()
        unit = min(allocation.width / self.width_units,
                   allocation.height / self.height_units)
        unit = max(unit, 12)
        self.unit = unit

        context = self.get_style_context()
        fg = context.get_color(Gtk.StateFlags.NORMAL)
        found, accent = context.lookup_color("theme_selected_bg_color")
        if not found:
            accent = Gdk.RGBA(0.2, 0.4, 0.8, 1.0)

        for placed in self.geometry:
            self._draw_key(cr, placed, unit, fg, accent)
        return False

    def _draw_key(self, cr, placed, unit, fg, accent):
        x = placed.x * unit
        y = placed.y * unit
        pad = unit * KEY_PAD
        margin = pad + unit * LABEL_PAD
        radius = unit * KEY_RADIUS

        info = self.keys.get(placed.name)
        # A key the keymap says nothing about - jp106's AE13 on a us
        # layout - is drawn as an empty cap. None of the keys that go
        # missing this way carry a label from their position alone, so
        # the fallback only decides which fill the cap gets.
        label = info.label if info else key_label(placed.name)

        key_path(cr, placed, x, y, unit, pad, radius)

        if label is not None:
            cr.set_source_rgba(fg.red, fg.green, fg.blue, 0.10)
        else:
            cr.set_source_rgba(fg.red, fg.green, fg.blue, 0.04)
        cr.fill_preserve()
        cr.set_source_rgba(fg.red, fg.green, fg.blue, 0.35)
        cr.set_line_width(1)
        cr.stroke()

        # The corner nick means "more levels than are shown here", which says
        # nothing when a single level is being shown deliberately.
        if self.level is None and info is not None and info.extra:
            # Clipped to the key so the wedge picks up the same filleted
            # corner, and kept larger than the fillet so that a generous
            # radius cannot round the whole thing away.
            nick = max(unit * 0.16, radius * 1.6)
            right = x + placed.w * unit - pad
            cr.save()
            key_path(cr, placed, x, y, unit, pad, radius)
            cr.clip()
            cr.move_to(right - nick, y + pad)
            cr.line_to(right, y + pad)
            cr.line_to(right, y + pad + nick)
            cr.close_path()
            cr.set_source_rgba(accent.red, accent.green, accent.blue, 0.55)
            cr.fill()
            cr.restore()

        if self.level is not None:
            self._draw_single_level(cr, placed, unit, fg, accent)
            return

        # A labelled key that does two things shows both, so it takes the
        # level path below instead.
        if label is not None and (info is None or info.shown == 1):
            box_w, box_h = label_box(placed, unit, margin)
            self._draw_text(cr, wrap_label(label, placed.w),
                            x + margin, y + margin, box_w, box_h,
                            unit * LABEL_FONT, fg, 0.75)
            return

        if info is None:
            return

        levels = info.levels
        shown = info.shown
        spelled = shown == 2
        faces = info.faces
        inset = unit * 0.09
        cell_w = (placed.w * unit - margin * 2) / (1.0 if spelled else 2.0)
        cell_h = (unit - margin * 2) / 2.0
        size = unit * LEVEL_FONT

        if spelled:
            # One size for the whole key, fitting its longest label, so
            # the two halves of Print/SysRq are lettered alike. Stacking
            # helps a label too long to spell across and hurts one that
            # fits, so whichever reads larger wins.
            plain = self._fitting_size(faces, size, cell_w - inset, cell_h)
            stacked = [wrap_label(face, placed.w) for face in faces]
            wrapped = self._fitting_size(stacked, size, cell_w - inset, cell_h)
            if wrapped > plain:
                faces, plain = stacked, wrapped
            size = plain

        for level_index, (col, row) in enumerate(LEVEL_SLOTS[:shown]):
            if level_index >= len(faces):
                break
            level = levels[level_index]
            text = faces[level_index]
            if not text:
                continue
            cx = x + margin + col * cell_w + inset
            cy = y + margin + row * cell_h
            colour = accent if level.mark else fg
            alpha = 0.9 if level_index < 2 else 0.65
            # Left-aligned so a column shares an edge; centring each makes
            # a wide "Ins" look offset from the narrow "0" above it.
            self._draw_text(cr, text, cx, cy, cell_w - inset, cell_h,
                            size, colour, alpha, centred=False)

    def _draw_single_level(self, cr, placed, unit, fg, accent):
        info = self.keys.get(placed.name)
        if info is None or self.level >= len(info.levels):
            return
        level = info.levels[self.level]
        if not is_typing_level(level):
            return
        text = single_face(placed.name, level)
        if not text:
            return

        margin = unit * (KEY_PAD + LABEL_PAD)
        text = wrap_label(text, placed.w)
        colour = accent if level.mark else fg
        box_w, box_h = label_box(placed, unit, margin)
        self._draw_text(cr, text,
                        placed.x * unit + margin, placed.y * unit + margin,
                        box_w, box_h, unit * SINGLE_FONT, colour, 0.9)

    def _fitting_size(self, texts, size, width, height):
        """The largest size at or below size at which every text fits. """
        scale = 1.0
        for text in texts:
            layout = sized_layout(self, text, size)
            scale = min(scale, fit_scale(*layout.get_pixel_size(),
                                         width, height))
        return size * scale

    def _draw_text(self, cr, text, x, y, w, h, size, colour, alpha,
                   centred=True):
        # Draw text in a box, shrinking it if it does not fit.
        layout = sized_layout(self, text, size)
        tw, th = layout.get_pixel_size()
        scale = fit_scale(tw, th, w, h)
        if scale < 1.0:
            layout = sized_layout(self, text, size * scale)
            tw, th = layout.get_pixel_size()
        cr.set_source_rgba(colour.red, colour.green, colour.blue, alpha)
        cr.move_to(x + (w - tw) / 2.0 if centred else x, y + (h - th) / 2.0)
        PangoCairo.show_layout(cr, layout)

    def tooltip_levels(self, name):
        """A key's typing levels, or None if it only does one thing.

        Keys offering a single function have nothing to list - Escape, and
        most function keys, whose typing levels repeat the one F-keysym.
        Their fifth level is a VT switch, which is_typing_level drops
        before the count is taken.
        """
        info = self.keys.get(name)
        if info is None or functions(info.levels) < 2:
            return None
        return [level for level in info.levels if is_typing_level(level)]

    def key_rect(self, placed):
        """A key's box in widget coordinates, for the tooltip's tip area.

        An ISO Return gives its upper leg only. Covering the lower one
        would take in the strip of the backslash key that key_at hands to
        its neighbour, and GTK holds the tooltip still while the pointer
        stays inside the area it was given.
        """
        height = self.unit if placed.shape == "iso-return" else placed.h * self.unit
        rect = Gdk.Rectangle()
        rect.x = int(placed.x * self.unit)
        rect.y = int(placed.y * self.unit)
        rect.width = int(placed.w * self.unit)
        rect.height = int(height)
        return rect

    def _on_query_tooltip(self, widget, x, y, keyboard_mode, tooltip):
        placed = self.key_at(x, y)
        if placed is None:
            return False
        levels = self.tooltip_levels(placed.name)
        if levels is None:
            return False

        column = self.tooltip_columns.get(placed.name)
        if column is None:
            column = level_column(levels)
            self.tooltip_columns[placed.name] = column
        tooltip.set_custom(column)

        tooltip.set_tip_area(self.key_rect(placed))
        return True

    def key_at(self, px, py):
        """The key drawn under a point, or None.

        The ISO Return's notch is cut out rather than tested as a box: it
        overlaps the backslash key and comes first in geometry order, so
        a plain box would answer Return over part of a key the user can
        see is separate.
        """
        if not self.unit:
            return None
        for placed in self.geometry:
            x = placed.x * self.unit
            y = placed.y * self.unit
            if not (x <= px <= x + placed.w * self.unit and
                    y <= py <= y + placed.h * self.unit):
                continue
            if placed.shape == "iso-return" and \
               px < x + ISO_RETURN_INSET * self.unit and \
               py > y + self.unit:
                continue
            return placed
        return None


class KeyboardWindow:
    def __init__(self, layout, variant, model, options, settings):
        self.keys = {}
        self.layout = layout
        self.variant = variant
        self.model = model
        self.settings = settings

        # Named on the command line the options are fixed for the run;
        # Otherwise Cinnamon's xkb-options is queried, and the drawing
        # follows changes.
        self.input_settings = None
        if options is None:
            self.input_settings = Gio.Settings(schema_id=INPUT_SOURCES_SCHEMA)
            self.options = self.input_settings.get_strv(XKB_OPTIONS_KEY)
            self.input_settings.connect(f"changed::{XKB_OPTIONS_KEY}",
                                        self.on_options_changed)
        else:
            self.options = split_options(options)

        builder = Gtk.Builder()
        builder.set_translation_domain("cinnamon")
        builder.add_from_file(str(UI_PATH))

        self.window = builder.get_object("main_window")
        self.menu_button = builder.get_object("menu_button")
        self.main_stack = builder.get_object("main_stack")
        self.level_stack = builder.get_object("level_stack")
        self.level_switcher = builder.get_object("level_switcher")
        self.layout_button = builder.get_object("layout_button")
        self.title_label = builder.get_object("title_label")
        self.subtitle_label = builder.get_object("subtitle_label")
        self.options_bar = builder.get_object("options_bar")
        self.options_label = builder.get_object("options_label")

        self.window.connect("destroy", Gtk.main_quit)
        self.window.set_icon_name("keyboard")
        self.layout_button.connect("clicked", self.on_layout_clicked)

        self.update_options()

        menu = Gtk.Menu()

        item = Gtk.MenuItem(label=_("Keyboard Model"))
        menu.add(item)

        models = Gtk.Menu()
        group = None
        entries = []
        for name, description in geometry_models():
            entry = Gtk.RadioMenuItem(label=description)
            entry.join_group(group)
            group = group or entry
            entry.set_active(name == self.model)
            models.add(entry)
            entries.append((entry, name))

        for entry, name in entries:
            entry.connect("toggled", self.on_model_toggled, name)

        item.set_submenu(models)
        menu.show_all()
        self.menu_button.set_popup(menu)

        self.show_keymap(layout, variant, model)

    def update_options(self):
        """Show the options in effect, or nothing at all if there are none."""
        if self.options:
            heading = GLib.markup_escape_text(_("XKB Options:"))
            listed = GLib.markup_escape_text(", ".join(self.options))
            self.options_label.set_markup(f"<b>{heading}</b> {listed}")
            self.options_label.set_tooltip_markup(
                option_descriptions(self.options))
        self.options_bar.set_visible(bool(self.options))

    def on_options_changed(self, settings, key):
        self.options = settings.get_strv(key)
        self.update_options()
        self.show_keymap(self.layout, self.variant, self.model)

    def set_titles(self, title, subtitle):
        self.window.set_title(title)
        self.title_label.set_text(title)

        show_subtitle = bool(subtitle) and subtitle != title
        self.subtitle_label.set_text(subtitle if show_subtitle else "")
        self.subtitle_label.set_visible(show_subtitle)

    def on_layout_clicked(self, button):
        if SETTINGS_PATH not in sys.path:
            sys.path.insert(0, SETTINGS_PATH)
        from bin import AddKeyboardLayout

        dialog = AddKeyboardLayout.AddKeyboardLayoutDialog([], self.window, xkb_only=True)
        response = dialog.dialog.run()
        selected = dialog.response if response == Gtk.ResponseType.OK else None
        dialog.dialog.destroy()

        if selected is not None:
            self.set_layout(selected.layout, selected.variant)

    def show_keymap(self, layout, variant, model):
        self.layout = layout
        self.variant = variant or None
        self.model = model

        try:
            geometry, width_units, height_units = load_geometry(model)
            keymap = keymap_from_names(xkb.Context(), model, layout, variant,
                                       ",".join(self.options))
            self.keys = extract_keys(keymap, [placed.name for placed in geometry])
            self.set_titles(layout_title(layout, variant),
                            layout_description(keymap))
            self.build_keyboard(geometry, width_units, height_units)
        except Exception as error:
            print(f"Could not draw {layout_title(layout, variant)} "
                  f"on {model}: {error}", file=sys.stderr)
            self.show_error()
            return False

        return True

    def set_layout(self, layout, variant):
        if (layout, variant or None) == (self.layout, self.variant):
            return
        self.show_keymap(layout, variant, self.model)

    def on_model_toggled(self, item, model):
        if item.get_active():
            self.set_model(model)

    def set_model(self, model):
        if model == self.model:
            return
        if self.show_keymap(self.layout, self.variant, model):
            # Remembered so the next run opens on the keyboard the user owns.
            self.settings.set_string(MODEL_KEY, model)

    def clear_keyboard(self):
        for page in self.level_stack.get_children():
            page.destroy()

    def show_error(self):
        self.keys = {}
        self.set_titles(layout_title(self.layout, self.variant), "")
        self.clear_keyboard()
        self.level_switcher.set_visible(False)
        self.main_stack.set_visible_child_name("error")

    def build_keyboard(self, geometry, width_units, height_units):
        pages = level_pages(used_levels(self.keys, geometry))
        showing = self.level_stack.get_visible_child_name()

        self.clear_keyboard()
        for name, title, icon, level in pages:
            area = KeyboardArea(self.keys, geometry, width_units,
                                height_units, level)
            area.show()
            self.level_stack.add_titled(area, name, title)
            if icon is not None:
                self.level_stack.child_set_property(area, "icon-name", icon)

        # Restore the page the user was on
        if any(showing == name for name, *_rest in pages):
            self.level_stack.set_visible_child_name(showing)

        self.level_switcher.set_visible(len(pages) > 1)
        self.main_stack.set_visible_child_name("keyboard")


def remembered_model(settings):
    model = settings.get_string(MODEL_KEY)
    return model if model in geometry_model_names() else None

def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Show a keyboard layout with all levels on each key.")
    parser.add_argument("-l", "--layout", required=True,
                        help="XKB layout, e.g. 'de'")
    parser.add_argument("-v", "--variant", help="XKB variant, e.g. 'neo'")
    parser.add_argument("-m", "--model", choices=geometry_model_names(),
                        help="keyboard model to draw")
    parser.add_argument("-o", "--options",
                        help="XKB options to draw in place of the session's, "
                             "which are otherwise read and followed")
    args = parser.parse_args(argv)
    if not args.layout:
        parser.error("argument -l/--layout: expected a layout name")
    return args

def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[1:])

    GLib.set_prgname(PROGRAM_NAME)

    settings = Gio.Settings.new(LAYOUT_VIEWER_SCHEMA)

    model = args.model or remembered_model(settings) or DEFAULT_MODEL

    window = KeyboardWindow(args.layout, args.variant, model, args.options,
                            settings)
    window.window.show()
    Gtk.main()
    return 0


if __name__ == "__main__":
    setproctitle(PROGRAM_NAME)
    sys.exit(main())
