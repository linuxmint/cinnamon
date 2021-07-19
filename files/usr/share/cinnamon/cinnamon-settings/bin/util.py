#!/usr/bin/python3

def strip_syspath_locals():
    import sys
    import os

    new_path = []
    for path in sys.path:
        if path.startswith(("/usr/local", os.path.expanduser("~/.local"))):
            continue
        new_path.append(path)

    sys.path = new_path
