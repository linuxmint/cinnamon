#!/usr/bin/python3

import subprocess

try:
    print(subprocess.check_output(['/usr/bin/lpstat', '-a']).decode("utf-8"))
except subprocess.CalledProcessError as e:
    print("No printers available!")
