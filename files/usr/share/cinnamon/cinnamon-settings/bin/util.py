#!/usr/bin/python3

import os
import shutil

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

def _get_gsound_context() -> GSound.Context:
    global gsound_context
    if gsound_context is None:
        gsound_context = GSound.Context()
        gsound_context.init()
    return gsound_context

def play_sound_name(name, channel = None) -> None:
    params = {GSound.ATTR_EVENT_ID: name, GSound.ATTR_MEDIA_ROLE: "test"}
    if channel is not None:
        params[GSound.ATTR_CANBERRA_FORCE_CHANNEL] = channel
    _get_gsound_context().play_simple(params)

def play_sound_file(path, channel = None) -> None:
    params = {GSound.ATTR_MEDIA_FILENAME: path, GSound.ATTR_MEDIA_ROLE: "test"}
    if channel is not None:
        params[GSound.ATTR_CANBERRA_FORCE_CHANNEL] = channel
    _get_gsound_context().play_simple(params)

def get_session_type():
    try:
        return os.environ["XDG_SESSION_TYPE"]
    except KeyError:
        pass

    return None

def _xinputrc_selects_fcitx():
    # The "run_im fcitx5" prefix match (with '#'-comment skip) is duplicated
    # in muffin src/core/meta-im-mode.c and cinnamon-session main.c. If im-config
    # ever changes its line format, all three must change together.
    path = os.path.join(os.path.expanduser("~"), ".xinputrc")
    try:
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("#"):
                    continue
                if line.startswith("run_im fcitx5"):
                    return True
    except OSError:
        pass
    return False

def using_fcitx():
    # Mirror js/misc/imFramework.js
    if shutil.which("fcitx5") is None:
        return False

    # On Wayland the env is not set to fcitx (apps use text-input-v3 via the
    # compositor); read the im-config selection directly. X11 uses the env.
    if get_session_type() == "wayland":
        return _xinputrc_selects_fcitx()

    mod = (os.environ.get("GTK_IM_MODULE") or os.environ.get("XMODIFIERS") or "").lower()
    return "fcitx" in mod
