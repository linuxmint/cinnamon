#! /usr/bin/python

import os
import sys

os.system("cp %s /usr/share/glib-2.0/schemas/" % (sys.argv[1]))
os.system("glib-compile-schemas /usr/share/glib-2.0/schemas/")

