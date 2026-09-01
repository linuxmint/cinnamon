#!/usr/bin/python3
#
# Copyright 2015  Daiki Ueno <dueno@src.gnome.org>
#           2016  Parag Nemade <pnemade@redhat.com>
#           2017  Alan <alan@boum.org>
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU Lesser General Public License as
# published by the Free Software Foundation; either version 2 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public
# License along with this program; if not, see
# <http://www.gnu.org/licenses/>.

import glob
import json
import locale
import logging
import os
import re
import sys
import xml.etree.ElementTree

import gi
gi.require_version('GnomeDesktop', '3.0')   # NOQA: E402
from gi.repository import GnomeDesktop

ESCAPE_PATTERN = re.compile(r'\\u\{([0-9A-Fa-f]+?)\}')
ISO_PATTERN = re.compile(r'[A-E]([0-9]+)')

LOCALE_TO_XKB_OVERRIDES = {
    'af':    'za',
    'en':    'us',
    'en-GB': 'uk',
    'es-US': 'latam',
    'fr-CA': 'ca',
    'hi':    'in+bolnagri',
    'ky':    'kg',
    'nl-BE': 'be',
    'zu':    None
}


def parse_single_key(value):
    def unescape(m):
        return chr(int(m.group(1), 16))
    value = ESCAPE_PATTERN.sub(unescape, value)
    return value


def parse_rows(keymap):
    unsorted_rows = {}
    for _map in keymap.iter('map'):
        value = _map.get('to')
        key = [parse_single_key(value)]
        iso = _map.get('iso')
        if not ISO_PATTERN.match(iso):
            sys.stderr.write('invalid ISO key name: %s\n' % iso)
            continue
        if not iso[0] in unsorted_rows:
            unsorted_rows[iso[0]] = []
        unsorted_rows[iso[0]].append((int(iso[1:]), key))
        # add subkeys
        longPress = _map.get('longPress')
        if longPress:
            for value in longPress.split(' '):
                subkey = parse_single_key(value)
                key.append(subkey)

    rows = []
    for k, v in sorted(list(unsorted_rows.items()),
                       key=lambda x: x[0],
                       reverse=True):
        row = []
        for key in sorted(v, key=lambda x: x):
            row.append(key[1])
        rows.append(row)

    return rows


def convert_xml(tree):
    root = {}
    for xml_keyboard in tree.iter("keyboard"):
        locale_full = xml_keyboard.get("locale")
        locale, sep, end = locale_full.partition("-t-")
    root["locale"] = locale
    for xml_name in tree.iter("name"):
        name = xml_name.get("value")
    root["name"] = name
    root["levels"] = []
    # parse levels
    for index, keymap in enumerate(tree.iter('keyMap')):
        # FIXME: heuristics here
        modifiers = keymap.get('modifiers')
        if not modifiers:
            mode = 'default'
            modifiers = ''
        elif 'shift' in modifiers.split(' '):
            mode = 'latched'
            modifiers = 'shift'
        else:
            mode = 'locked'
        level = {}
        level["level"] = modifiers
        level["mode"] = mode
        level["rows"] = parse_rows(keymap)
        root["levels"].append(level)
    return root


def locale_to_xkb(locale, name):
    if locale in sorted(LOCALE_TO_XKB_OVERRIDES.keys()):
        xkb = LOCALE_TO_XKB_OVERRIDES[locale]
        logging.debug("override for %s → %s",
                      locale, xkb)
        if xkb:
            return xkb
        else:
            raise KeyError("layout %s explicitly disabled in overrides"
                           % locale)
    xkb_names = sorted(name_to_xkb.keys())
    if name in xkb_names:
        return name_to_xkb[name]
    else:
        logging.debug("name %s failed" % name)
    for sub_name in name.split(' '):
        if sub_name in xkb_names:
            xkb = name_to_xkb[sub_name]
            logging.debug("dumb mapping failed but match with locale word: "
                          "%s (%s) → %s (%s)",
                          locale, name, xkb, sub_name)
            return xkb
        else:
            logging.debug("sub_name failed")
    for xkb_name in xkb_names:
        for xkb_sub_name in xkb_name.split(' '):
            if xkb_sub_name.strip('()') == name:
                xkb = name_to_xkb[xkb_name]
                logging.debug("dumb mapping failed but match with xkb word: "
                              "%s (%s) → %s (%s)",
                              locale, name, xkb, xkb_name)
                return xkb
    raise KeyError("failed to find XKB mapping for %s" % locale)


def convert_file(source_file, destination_path):
    logging.info("Parsing %s", source_file)

    itree = xml.etree.ElementTree.ElementTree()
    itree.parse(source_file)

    root = convert_xml(itree)

    try:
        xkb_name = locale_to_xkb(root["locale"], root["name"])
    except KeyError as e:
        logging.warning(e)
        return False
    destination_file = os.path.join(destination_path, xkb_name + ".json")

    try:
        with open(destination_file, 'x', encoding="utf-8") as dest_fd:
            json.dump(root, dest_fd, ensure_ascii=False, indent=2, sort_keys=True)
    except FileExistsError as e:
        logging.info("File %s exists, not updating", destination_file)
        return False

    logging.debug("written %s", destination_file)


def load_xkb_mappings():
    xkb = GnomeDesktop.XkbInfo()
    layouts = xkb.get_all_layouts()
    name_to_xkb = {}

    for layout in layouts:
        name = xkb.get_layout_info(layout).display_name
        name_to_xkb[name] = layout

    return name_to_xkb


locale.setlocale(locale.LC_ALL, "C")
name_to_xkb = load_xkb_mappings()


if __name__ == "__main__":
    if "DEBUG" in os.environ:
        logging.basicConfig(level=logging.DEBUG)

    if len(sys.argv) < 2:
        print("supply a CLDR keyboard file")
        sys.exit(1)

    if len(sys.argv) < 3:
        print("supply an output directory")
        sys.exit(1)

    source = sys.argv[1]
    destination = sys.argv[2]
    if os.path.isfile(source):
        convert_file(source, destination)
    elif os.path.isdir(source):
        for path in glob.glob(source + "/*-t-k0-android.xml"):
            convert_file(path, destination)
