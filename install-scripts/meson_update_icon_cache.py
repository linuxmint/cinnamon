#!/usr/bin/python3

import os
import subprocess

themedir = os.path.join(os.environ['MESON_INSTALL_PREFIX'], 'share', 'icons', 'hicolor')

if not os.environ.get('DESTDIR'):
    print('Updating gtk icon cache... %s' % themedir)
    subprocess.call(['gtk-update-icon-cache', '-f', '-t', themedir])
