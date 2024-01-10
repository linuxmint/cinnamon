#!/usr/bin/python3

"""
This script is now just a wrapper around the cinnamon-xlet-makepot utility.
It is kept for backwards compatibility as it is currently used by other scripts
(notably the cinnamon-spices-makepot script found in the 3rd party spices repos).

for usage info type:
cinnamon-xlet-makepot -h
* Note that the Javascript argument is inverted because previously Javascript files
were not scanned by default, but now are.
"""

import os
import sys

args = sys.argv[1:]
if '-h' in args:
    print("cinnamon-json-makepot is deprecated - please use cinnamon-xlet-makepot instead\ntype cinnamon-xlet-makepot -h for usage information.")
    quit()
if '-i' not in args and '--install' not in args and \
   '-r' not in args and '--remove' not in args:
    potfile = args.pop()
    if '-j' in args:
        args.remove('-j')
    elif '--js' in args:
        args.remove('--js')
    else:
        args.append('-j')

    args.append('-o')
    args.append(potfile)

args.append(os.getcwd())
command = 'cinnamon-xlet-makepot'
args.insert(0, command)
os.execvp(command, args)
