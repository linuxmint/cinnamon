#!/usr/bin/python3

import os
import threading
import queue
from pathlib import Path
from gi.repository import GLib

# Share among multiple Harvesters
try:
    logfile = os.path.join(GLib.get_user_state_dir(), 'cinnamon', 'harvester.log')
except AttributeError:
    logfile = f'{os.path.expanduser("~")}/.cinnamon/harvester.log'


class ActivityLogger:
    def __init__(self):
        self.queue = queue.SimpleQueue()
        self.thread = threading.Thread(target=self.write_to_file_thread, daemon=True)
        self.thread.start()

    def log(self, entry):
        self.queue.put(entry)

    def write_to_file_thread(self):
        directory = Path(logfile).parent
        if not directory.exists():
            os.makedirs(directory)
        while True:
            entry = self.queue.get()
            with open(logfile, "a", encoding='utf-8') as f:
                f.write(f"{entry}\n")
