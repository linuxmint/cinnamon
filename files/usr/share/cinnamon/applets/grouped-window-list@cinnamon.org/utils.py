#!/usr/bin/python3

import subprocess
import os
import json
import sys

CLI = sys.argv

def parse_args(command):
    return command.split(' ')

def spawn(command):
    try:
        process = subprocess.run(
            parse_args(command),
            stdout=subprocess.PIPE,
            check=True
        )
    except Exception:
        raise subprocess.CalledProcessError(1, command)
    out = process.stdout.decode('utf-8')
    return out

# Utility script that creates GDesktop files for Wine and other window backed applications.
def handle_cli():

    if CLI[1] == 'get_process':
        process = spawn('cat /proc/{}/cmdline'.format(CLI[2]))

        if '.exe' in process:
            if 'Z:' in process:
                process = process.split('Z:')[1]

            process = process.replace('\\', '/')
            process = process.split('.exe')[0] + '.exe'
            process = 'wine '+process.replace(' ', r'\ ')

        process = json.dumps(process)
        if '\\u0000' in process:
            process = process.replace('\\u0000', ' ')
        process = json.loads(process)

        if not '.exe' in process:
            process = process[:-1]

        if process == 'python mainwindow.py':
            process = 'playonlinux'

        try:
            proc_array = process.split('/')
            pa_len = len(proc_array)
            process_name = proc_array[pa_len - 1].title()

            # Since this is a window backed app, make sure it has an icon association.

            icons_dir = '{}/.local/share/icons/hicolor/48x48/apps/'.format(os.getenv('HOME'))

            if '\\ ' in process_name:
                process_name = process_name.replace('\\ ', ' ')

            if '.Exe' in process_name:
                process_name = process_name.replace('.Exe', '')

            icon_file = process_name+'.png'

            if ' ' in icon_file:
                icon_file = icon_file.replace(' ', '')

            icon = icons_dir+icon_file

            try:
                try:
                    spawn('gnome-exe-thumbnailer {} {}'.format(process.split('wine ')[1], icon))
                except IndexError:
                    spawn('gnome-exe-thumbnailer {} {}'.format(process, icon))
            except subprocess.CalledProcessError:
                icon = None

            g_menu = '[Desktop Entry]\n' \
                     'Type=Application\n' \
                     'Encoding=UTF-8\n' \
                     'Name={}\n' \
                     'Comment={}\n' \
                     'Exec={}\n' \
                     'Terminal=false\n' \
                     'StartupNotify=true\n'.format(process_name, process_name, process)

            if icon:
                g_menu += 'Icon={}\n'.format(icon)


            if '.exe' in process:
                g_menu += 'GenericName=Wine application\n' \
                          'Categories=Wine;\n' \
                          'MimeType=application/x-ms-dos-executable;' \
                          'application/x-msi;application/x-ms-shortcut; \n' \

            desktop_file = '{}.cinnamon-generated.desktop'.format(process_name)
            desktop_path = '{}/.local/share/applications/{}'.format(os.getenv('HOME'), desktop_file)

            with open(desktop_path, 'w', encoding='utf-8') as desktop:
                print(g_menu)
                desktop.write(g_menu)
                spawn('chmod +x {}'.format(desktop_path))
                print(desktop_file)

        except KeyError as err:
            print(err)
            return

handle_cli()
