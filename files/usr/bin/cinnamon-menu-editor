#!/usr/bin/python3

""" Launch the Cinnamon menu editor utility

Usage:  cinnamon-menu-editor
"""

import sys
from setproctitle import setproctitle

sys.path.insert(0, '/usr/share/cinnamon/cinnamon-menu-editor')  # noqa
from cme import MainWindow


def main():
    try:
        from MenuEditor import config
        datadir = config.pkgdatadir
        version = config.VERSION
    except Exception:
        datadir = '.'
        version = '0.9'
    app = MainWindow.MainWindow(datadir, version)
    app.run()


if __name__ == '__main__':
    setproctitle("cinnamon-menu-editor")
    main()
