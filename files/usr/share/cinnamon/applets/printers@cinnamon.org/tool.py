#!/usr/bin/python3

# This is a command-helper for the printers@cinnamon.org applet.js

import subprocess
import sys

if len(sys.argv)>1:
    try:
        process = subprocess.run(sys.argv[1:], capture_output=True)
        if len(process.stderr)==0:
            print("OK:\n"+process.stdout.decode("utf-8"), end="")
        else:
            print("ERRORS:\n"+process.stderr.decode("utf-8"), end="")
    except Exception as error:
        print("ERRORS:\n"+str(error))
else:
    print("Wrong arguments")
