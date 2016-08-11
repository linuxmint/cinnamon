#!/usr/bin/env python2

import os
import sys

os.system("rm /usr/share/glib-2.0/schemas/%s" % (sys.argv[1]))
os.system("glib-compile-schemas /usr/share/glib-2.0/schemas/")
