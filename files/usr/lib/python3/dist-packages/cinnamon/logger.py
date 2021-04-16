#!/usr/bin/python3

import os
import threading
import queue

# Share among multiple Harvesters
logfile = '%s/.cinnamon/harvester.log' % os.path.expanduser("~")

class ActivityLogger():
    def __init__(self):
        self.queue = queue.SimpleQueue()
        self.thread = threading.Thread(target=self.write_to_file_thread, daemon=True)
        self.thread.start()

    def log(self, entry):
        self.queue.put(entry)

    def write_to_file_thread(self):
        while True:
            entry = self.queue.get()
            with open(logfile, "a") as f:
                f.write("%s\n" % entry)
