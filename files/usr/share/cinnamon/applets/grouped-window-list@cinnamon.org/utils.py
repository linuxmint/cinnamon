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

def get_valid_pid():
    if len(CLI) < 3 or not CLI[2].isdigit():
        print("Invalid PID provided")
        sys.exit(1)
    return int(CLI[2])

def read_process_cmdline(pid):
    return spawn(f"cat /proc/{pid}/cmdline")

def normalize_process(process):
    if '.exe' in process:
        if 'Z:' in process:
            process = process.split('Z:')[1]
        process = process.replace('\\', '/')
        process = process.split('.exe')[0] + '.exe'
        process = 'wine ' + process.replace(' ', r'\ ')
    else:
        process = process[:-1]  # remove trailing null byte

    if process == 'python mainwindow.py':
        process = 'playonlinux'

    return process

# Utility script that creates GDesktop files for Wine and other window backed applications.
def handle_cli():
    if len(CLI) < 2 or CLI[1] != 'get_process':
        return

    pid = get_valid_pid()
    process = read_process_cmdline(pid)
    process = normalize_process(process)

    try:
        proc_array = process.split('/')
        process_name = proc_array[-1].title()

        icons_dir = os.path.join(os.getenv('HOME'), '.local/share/icons/hicolor/48x48/apps/')

        if '\\ ' in process_name:
            process_name = process_name.replace('\\ ', ' ')
        if '.Exe' in process_name:
            process_name = process_name.replace('.Exe', '')

        icon_file = process_name + '.png'
        if ' ' in icon_file:
            icon_file = icon_file.replace(' ', '')

        icon = os.path.join(icons_dir, icon_file)

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
                      'MimeType=application/x-ms-dos-executable;application/x-msi;application/x-ms-shortcut;\n'

        desktop_file = f"{process_name}.cinnamon-generated.desktop"
        desktop_path = os.path.join(os.getenv('HOME'), '.local/share/applications', desktop_file)

        with open(desktop_path, 'w', encoding='utf-8') as desktop:
            print(g_menu)
            desktop.write(g_menu)
            spawn(f"chmod +x {desktop_path}")
            print(desktop_file)

    except (KeyError, IndexError) as err:
        print(err)

handle_cli()
