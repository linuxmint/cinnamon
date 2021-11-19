#!/usr/bin/python3

import platform
import subprocess
import shlex
import os
import re
import threading
from json import loads

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *


def killProcess(process):
    process.kill()


def getProcessOut(command):
    timeout = 2.0  # Timeout for any subprocess before aborting it

    lines = []
    p = subprocess.Popen(command, stdout=subprocess.PIPE)
    timer = threading.Timer(timeout, killProcess, [p])
    timer.start()
    while True:
        line = p.stdout.readline()
        if not line:
            break
        if line != '':
            lines.append(line.decode('utf-8'))
    timer.cancel()
    return lines


def getGraphicsInfos():
    cards = {}
    count = 0
    envpath = os.environ["PATH"]
    os.environ["PATH"] = envpath + ":/usr/local/sbin:/usr/sbin:/sbin"
    for card in getProcessOut(("lspci")):
        if not "VGA" in card:
            continue
        cardId = card.split()[0]
        cardName = None
        for line in getProcessOut(("lspci", "-v", "-s", cardId)):
            if line.startswith(cardId):
                cardName = (line.split(":")[2].split("(rev")[0].strip())

        if cardName:
            cards[count] = (cardName)
            count += 1
    os.environ["PATH"] = envpath
    return cards


def getDiskSize():
    disksize = 0
    try:
        out = getProcessOut(("lsblk", "--json", "--output", "size", "--bytes", "--nodeps"))
        jsonobj = loads(''.join(out))
    except Exception:
        return _("Unknown size"), False

    for blk in jsonobj['blockdevices']:
        disksize += int(blk['size'])

    return disksize, (len(jsonobj['blockdevices']) > 1)


def getProcInfos():
    # For some platforms, 'model name' will no longer take effect.
    # We can try our best to detect it, but if all attempts failed just leave it to be "Unknown".
    # Source: https://github.com/dylanaraps/neofetch/blob/6dd85d67fc0d4ede9248f2df31b2cd554cca6c2f/neofetch#L2163
    cpudetect = ("model name", "Hardware", "Processor", "cpu model", "chip type", "cpu type")
    infos = [
        ("/proc/cpuinfo", [("cpu_name", cpudetect), ("cpu_siblings", ("siblings",)), ("cpu_cores", ("cpu cores",))]),
        ("/proc/meminfo", [("mem_total", ("MemTotal",))])
    ]

    result = {}
    for (proc, pairs) in infos:
        for line in getProcessOut(("cat", proc)):
            for (key, start) in pairs:
                for item in start:
                    if line.startswith(item):
                        result[key] = line.split(':', 1)[1].strip()
                        break
    if "cpu_name" not in result:
        result["cpu_name"] = _("Unknown CPU")
    if "mem_total" not in result:
        result["mem_total"] = _("Unknown size")
    return result


def createSystemInfos():
    procInfos = getProcInfos()
    infos = []
    arch = platform.machine().replace("_", "-")
    try:
        (memsize, memunit) = procInfos['mem_total'].split(" ")
        memsize = float(memsize)
    except ValueError:
        memsize = procInfos['mem_total']
        memunit = ""
    processorName = procInfos['cpu_name'].replace("(R)", "\u00A9").replace("(TM)", "\u2122")
    if 'cpu_cores' in procInfos:
        processorName = processorName + " \u00D7 " + procInfos['cpu_cores']

    if os.path.exists("/etc/linuxmint/info"):
        args = shlex.split("awk -F \"=\" '/GRUB_TITLE/ {print $2}' /etc/linuxmint/info")
        title = subprocess.check_output(args).decode('utf-8').rstrip("\n")
        infos.append((_("Operating System"), title))
    elif os.path.exists("/etc/arch-release"):
        contents = open("/etc/arch-release", 'r').readline().split()
        title = ' '.join(contents[:2]) or "Arch Linux"
        infos.append((_("Operating System"), title))
    elif os.path.exists("/etc/manjaro-release"):
        contents = open("/etc/manjaro-release", 'r').readline().split()
        title = ' '.join(contents[:2]) or "Manjaro Linux"
        infos.append((_("Operating System"), title))
    else:
        import distro
        s = '%s (%s)' % (' '.join(distro.linux_distribution()), arch)
        # Normalize spacing in distribution name
        s = re.sub(r'\s{2,}', ' ', s)
        infos.append((_("Operating System"), s))
    if 'CINNAMON_VERSION' in os.environ:
        infos.append((_("Cinnamon Version"), os.environ['CINNAMON_VERSION']))
    infos.append((_("Linux Kernel"), platform.release()))
    infos.append((_("Processor"), processorName))
    if memunit == "kB":
        infos.append((_("Memory"), '%.1f %s' % ((float(memsize)/(1024*1024)), _("GiB"))))
    else:
        infos.append((_("Memory"), procInfos['mem_total']))

    diskSize, multipleDisks = getDiskSize()
    if (multipleDisks):
        diskText = _("Hard Drives")
    else:
        diskText = _("Hard Drive")
    try:
        infos.append((diskText, '%.1f %s' % ((diskSize / (1000*1000*1000)), _("GB"))))
    except:
        infos.append((diskText, diskSize))
    cards = getGraphicsInfos()
    for card in cards:
        infos.append((_("Graphics Card"), cards[card]))

    return infos


class Module:
    name = "info"
    category = "hardware"
    comment = _("Display system information")

    def __init__(self, content_box):
        keywords = _("system, information, details, graphic, sound, kernel, version")
        sidePage = SidePage(_("System Info"), "cs-details", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Info module")

            infos = createSystemInfos()

            page = SettingsPage()
            self.sidePage.add_widget(page)

            settings = page.add_section(_("System info"))

            for (key, value) in infos:
                widget = SettingsWidget()
                widget.set_spacing(40)
                labelKey = Gtk.Label.new(key)
                widget.pack_start(labelKey, False, False, 0)
                labelKey.get_style_context().add_class("dim-label")
                labelValue = Gtk.Label.new(value)
                labelValue.set_selectable(True)
                labelValue.set_line_wrap(True)
                widget.pack_end(labelValue, False, False, 0)
                settings.add_row(widget)

            if os.path.exists("/usr/bin/upload-system-info"):
                widget = SettingsWidget()

                spinner = Gtk.Spinner(visible=True)
                button = Gtk.Button(label=_("Upload system information"),
                                    tooltip_text=_("No personal information included"),
                                    always_show_image=True,
                                    image=spinner)
                button.connect("clicked", self.on_button_clicked, spinner)
                widget.pack_start(button, True, True, 0)
                settings.add_row(widget)

    def on_button_clicked(self, button, spinner):

        try:
            subproc = Gio.Subprocess.new(["upload-system-info"], Gio.SubprocessFlags.NONE)
            subproc.wait_check_async(None, self.on_subprocess_complete, spinner)
            spinner.start()
        except GLib.Error as e:
            print("upload-system-info failed to run: %s" % e.message)

    def on_subprocess_complete(self, subproc, result, spinner):
        spinner.stop()

        try:
            success = subproc.wait_check_finish(result)
        except GLib.Error as e:
            print("upload-system-info failed: %s" % e.message)
