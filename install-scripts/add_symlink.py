#!/usr/bin/python3

import os
import subprocess

link_path = os.path.join('etc', 'xdg', 'menus', 'cinnamon-applications-merged')
dest = os.environ.get('DESTDIR')

if dest:
    link_path = os.path.join(dest, link_path)
else:
    link_path = os.path.join('/', link_path)

if os.path.lexists(link_path):
    print('%s already exists, skipping symlink creation' % link_path)
else:
    print('adding symlink %s...' % link_path)
    subprocess.call(['ln', '-s', 'applications-merged', link_path])
