#!/usr/bin/python3

import sys
import os
import argparse

import gi
gi.require_version('Gtk', '3.0')

sys.path.append('/usr/share/cinnamon/cinnamon-settings/bin')
from Spices import Spice_Harvester

USAGE_DESCRIPTION = 'Installs an applet, desklet, extension, or theme from a local folder. Rather than just doing a shallow copy, it will also install translations, schema files (if present) and update the metadata with a timestamp for version comparison.'
USAGE_EPILOG = 'This script is designed for developers to test their work. It is recommended that everyone else continue to use cinnamon-settings to install their spices as this script has no safeguards in place to prevent malicious code.'
SPICE_TYPES = ['applet', 'desklet', 'extension', 'theme', 'search_provider']

parser = argparse.ArgumentParser(description=USAGE_DESCRIPTION, epilog=USAGE_EPILOG)
parser.add_argument('spice_type', type=str, choices=SPICE_TYPES, help='The type of spice you are installing.')
parser.add_argument('path', type=str, default=os.getcwd(), nargs='?', help='The path from which you are installing. Default is the current directory.')

args = parser.parse_args()

source_dir = os.path.abspath(args.path)
spice_type = args.spice_type

if not os.path.exists(source_dir):
    print('invalid directory - %s does not exist' % source_dir)
    quit()

uuid = os.path.basename(source_dir)
if os.path.exists(os.path.join(source_dir, 'files', uuid)):
    source_dir = os.path.join(source_dir, 'files', uuid)

if spice_type == 'theme':
    theme_file = os.path.join(source_dir, 'cinnamon/cinnamon.css')
    if not os.path.exists(theme_file):
        print('Invalid theme - missing file cinnamon.css')
        quit()
else:
    # we always need metadata.json as well as the corresponding applet.js, deskelt.js, etc.
    if not os.path.exists(os.path.join(source_dir, 'metadata.json')):
        print('Invalid %s - metadata.json not found' % spice_type)
        quit()
    if not os.path.exists(os.path.join(source_dir, '%s.js' % spice_type)):
        # multi-version xlets may not have it in the root directory, so check subdirectories as well
        found = False
        for name in os.listdir(source_dir):
            if os.path.exists(os.path.join(source_dir, name, '%s.js' % spice_type)):
                found = True
                break
        if not found:
            print('Invalid %s - %s.js not found' % (spice_type, spice_type))
            quit()

spices = Spice_Harvester(spice_type)

spices.install_from_folder(source_dir, uuid)
