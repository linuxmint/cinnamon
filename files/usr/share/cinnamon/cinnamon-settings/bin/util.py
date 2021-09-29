#!/usr/bin/python3
import gi
gi.require_version('GSound', '1.0')
from gi.repository import GSound

def strip_syspath_locals():
    import sys
    import os

    new_path = []
    for path in sys.path:
        if path.startswith(("/usr/local", os.path.expanduser("~/.local"))):
            continue
        new_path.append(path)

    sys.path = new_path


gsound_context = None

def _get_gsound_context():
    global gsound_context
    if (gsound_context == None):
        gsound_context = GSound.Context()
        gsound_context.init()
    return gsound_context

def play_sound_name(name):
    _get_gsound_context().play_simple({ GSound.ATTR_EVENT_ID: name })

def play_sound_file(path):
    _get_gsound_context().play_simple({ GSound.ATTR_MEDIA_FILENAME: path })
