#!/usr/bin/python3

# This is a command-helper for the printers@cinnamon.org applet.js

import subprocess
import sys

if len(sys.argv)>1 and not len(sys.argv)>2:
    match sys.argv[1]:
        case "lpstat-a":
            lpstat_a = subprocess.run(['/usr/bin/lpstat', '-a'], capture_output=True)
            if len(lpstat_a.stderr)==0:
                print(lpstat_a.stdout.decode("utf-8"))
            else:
                print("ERRORS:\n"+lpstat_a.stderr.decode("utf-8"))
        case _:
            print("Wrong arguments")
else:
    print("Wrong arguments")
