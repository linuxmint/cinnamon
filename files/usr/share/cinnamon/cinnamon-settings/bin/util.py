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
    if gsound_context is None:
        gsound_context = GSound.Context()
        gsound_context.init()
    return gsound_context

def play_sound_name(name, channel = None):
    params = {GSound.ATTR_EVENT_ID: name, GSound.ATTR_MEDIA_ROLE: "test"}
    if channel is not None:
        params[GSound.ATTR_CANBERRA_FORCE_CHANNEL] = channel
    _get_gsound_context().play_simple(params)

def play_sound_file(path, channel = None):
    params = {GSound.ATTR_MEDIA_FILENAME: path, GSound.ATTR_MEDIA_ROLE: "test"}
    if channel is not None:
        params[GSound.ATTR_CANBERRA_FORCE_CHANNEL] = channel
    _get_gsound_context().play_simple(params)
