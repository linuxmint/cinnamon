#!/usr/bin/python3

import os
import sys
import subprocess

schemadir = os.path.join(os.environ['MESON_INSTALL_PREFIX'], 'share', 'glib-2.0', 'schemas')

if not os.environ.get('DESTDIR'):
    print('Compiling gsettings schemas...')
    out = subprocess.run(['glib-compile-schemas', "--strict", schemadir], capture_output=True)

    if out.returncode != 0:
        print("compile error: ", out.stderr)
        sys.exit(1)
