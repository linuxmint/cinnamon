#!/usr/bin/python3

import subprocess
import os
import json
import sys
import random

cli = sys.argv

def parseArgs(command):
    return command.split(' ')

def spawn(command):
    try:
        process = subprocess.run(
            parseArgs(command),
            stdout=subprocess.PIPE,
            check=True
        )
    except Exception:
        raise subprocess.CalledProcessError(1, command)
    out = process.stdout.decode('utf-8')
    return out

"""
Utility script that creates GDesktop files for Wine and other window backed applications.
"""
def handleCli():

    if cli[1] == 'get_process':
        process = spawn('cat /proc/{}/cmdline'.format(cli[2]))

        if '.exe' in process:
            if 'Z:' in process:
                process = process.split('Z:')[1]

            process = process.replace('\\', '/')
            process = process.split('.exe')[0] + '.exe'
            process = 'wine '+process.replace(' ', '\ ')

        process = json.dumps(process)
        if '\\u0000' in process:
            process = process.replace('\\u0000', ' ')
        process = json.loads(process)

        if not '.exe' in process:
            process = process[:-1]

        if process == 'python mainwindow.py':
            process = 'playonlinux'

        try:
            procArray = process.split('/')
            paLen = len(procArray)
            processName = procArray[paLen - 1].title()

            # Since this is a window backed app, make sure it has an icon association.

            iconsDir = '{}/.local/share/icons/hicolor/48x48/apps/'.format(os.getenv('HOME'))

            if '\\ ' in processName:
                processName = processName.replace('\\ ', ' ')

            if '.Exe' in processName:
                processName = processName.replace('.Exe', '')

            iconFile = processName+'.png'

            if ' ' in iconFile:
                iconFile = iconFile.replace(' ', '')

            icon = iconsDir+iconFile

            try:
                try:
                    spawn('gnome-exe-thumbnailer {} {}'.format(process.split('wine ')[1], icon))
                except IndexError:
                    spawn('gnome-exe-thumbnailer {} {}'.format(process, icon))
            except subprocess.CalledProcessError:
                icon = None

            gMenu = '[Desktop Entry]\n' \
                    'Type=Application\n' \
                    'Encoding=UTF-8\n' \
                    'Name={}\n' \
                    'Comment={}\n' \
                    'Exec={}\n' \
                    'Terminal=false\n' \
                    'StartupNotify=true\n'.format(processName, processName, process)

            if icon:
                gMenu += 'Icon={}\n'.format(icon)


            if '.exe' in process:
                gMenu += 'GenericName=Wine application\n' \
                         'Categories=Wine;\n' \
                         'MimeType=application/x-ms-dos-executable;application/x-msi;application/x-ms-shortcut; \n' \

            desktopFile = 'icing_{}.desktop'.format(str(random.random()).split('.')[1])
            desktopPath = '{}/.local/share/applications/{}'.format(os.getenv('HOME'), desktopFile)

            with open(desktopPath, 'w', encoding='utf-8') as desktop:
                print(gMenu)
                desktop.write(gMenu)
                spawn('chmod +x {}'.format(desktopPath))
                print(desktopFile)

        except KeyError as e:
            print(e)
            return

handleCli()