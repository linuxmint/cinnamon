#!/usr/bin/python3

import argparse
import sys
import os
import json
import gettext
import datetime
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GdkPixbuf, GLib

gettext.install('cinnamon', '/usr/share/locale')

home = os.path.expanduser('~')


class AboutDialog(Gtk.AboutDialog):
    def __init__(self, metadata, stype):
        super().__init__()
        self.metadata = metadata
        self.stype = stype

        self.set_icon()

        if 'version' in metadata:
            version = self.metadata['version']
            if 'last-edited' in metadata:
                timestamp = datetime.datetime.fromtimestamp(self.metadata['last-edited']).isoformat(' ')
                self.props.version = _("Version %s (%s)") % (version, timestamp)
            else:
                self.props.version = _("Version %s") % version
        elif 'last-edited' in metadata:
            timestamp = datetime.datetime.fromtimestamp(int(self.metadata['last-edited'])).isoformat(' ')
            self.props.version = _("Updated on %s") % timestamp

        comments = self._(self.metadata.get('description', ''))

        if 'comments' in self.metadata:
            comments += '\n\n' + self._(self.metadata['comments'])
        self.props.comments = comments

        s_id = self.get_spices_id()
        if s_id:
            self.props.website = f'https://cinnamon-spices.linuxmint.com/{self.stype}/view/{s_id}'
            self.props.website_label = _("More info")

        if 'contributors' in self.metadata:
            self.props.authors = self.metadata['contributors'].split(',')

        xlet_name = self._(self.metadata.get('name'))
        self.props.program_name = f"{xlet_name} ({self.metadata.get('uuid')})"

        self.connect('response', self.close)
        self.set_title(_("About %s") % self.props.program_name)
        self.show()

    def close(self, *args):
        Gtk.main_quit()

    def set_icon(self):
        # Use the generic type icon
        self.set_logo_icon_name(f"cs-{self.metadata['type']}")
        # Override with metadata if set..
        if 'icon' in self.metadata:
            self.set_logo_icon_name(self.metadata['icon'])
        # Override with icon.png if present
        icon_path = os.path.join(self.metadata['path'], 'icon.png')
        if os.path.exists(icon_path):
            icon = GdkPixbuf.Pixbuf.new_from_file_at_size(icon_path, 48, 48)
            self.set_logo(icon)
        self.set_default_icon_name(f"cs-{self.metadata['type']}")

    def _(self, msg):
        gettext.bindtextdomain(self.metadata.get('uuid'), home + '/.local/share/locale')
        translation = gettext.dgettext(self.metadata.get('uuid'), msg)
        # try with cinnamon domain if the xlet domain doesn't work
        if translation == msg:
            return _(msg)

        return translation

    def get_spices_id(self):
        try:
            cache_path = os.path.join(GLib.get_user_cache_dir(), 'cinnamon', 'spices', self.stype[0:-1], 'index.json')
            if os.path.exists(cache_path):
                with open(cache_path, 'r', encoding='utf-8') as cache_file:
                    index_cache = json.load(cache_file)
                    if self.metadata['uuid'] in index_cache:
                        return index_cache[self.metadata['uuid']]['spices-id']
            return None
        except Exception as e:
            print('Failed to load/parse index.json')
            print(e)
            return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.description = 'Arguments for xlet-about-dialog'
    parser.add_argument('xlet_type', type=str, help=_('the type of the Spice'),
                        choices=['applets', 'desklets', 'extensions',
                                 'actions', 'themes'])
    parser.add_argument('uuid', type=str, metavar='UUID', nargs=1,
                        help=_('the UUID of the Spice'))
    _args = parser.parse_args()

    xlet_type = _args.xlet_type
    uuid = _args.uuid[0]

    suffix = f'share/nemo/actions/{uuid}' if xlet_type == 'actions' else f'share/cinnamon/{xlet_type}/{uuid}'
    prefixes = [os.path.join(home, '.local'), '/usr']

    path = None
    for prefix in prefixes:
        path = os.path.join(prefix, suffix)
        if os.path.exists(path):
            break

    if path is None:
        print(_('Unable to locate %s %s') % (xlet_type, uuid))
        sys.exit(1)

    try:
        with open(os.path.join(path, 'metadata.json'), encoding='utf-8') as meta:
            _metadata = json.load(meta)

        _metadata['path'] = path
        _metadata['type'] = xlet_type

        AboutDialog(_metadata, xlet_type)

        Gtk.main()
    except FileNotFoundError:
        pass
