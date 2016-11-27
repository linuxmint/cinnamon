#!/usr/bin/python2

import platform
import subprocess
import shlex
import os
import re
import threading

from GSettingsWidgets import *


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
            lines.append(line)
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
    moreThanOnce = 0
    for line in getProcessOut(("df", "-l")):
        if line.startswith("/dev/"):
            moreThanOnce += 1
            disksize += float(line.split()[1])

    if (moreThanOnce > 1):
        return disksize, True
    else:
        return disksize, False


def getProcInfos():
    infos = [
        ("/proc/cpuinfo", [("cpu_name", "model name"), ("cpu_siblings", "siblings"), ("cpu_cores", "cpu cores")]),
        ("/proc/meminfo", [("mem_total", "MemTotal")])
    ]

    result = {}
    for (proc, pairs) in infos:
        for line in getProcessOut(("cat", proc)):
            for (key, start) in pairs:
                if line.startswith(start):
                    result[key] = line.split(':', 1)[1].strip()
                    break
    return result


def createSystemInfos():
    procInfos = getProcInfos()
    infos = []
    arch = platform.machine().replace("_", "-")
    (memsize, memunit) = procInfos['mem_total'].split(" ")
    processorName = procInfos['cpu_name'].replace("(R)", u"\u00A9").replace("(TM)", u"\u2122")
    if 'cpu_cores' in procInfos:
        processorName = processorName + u" \u00D7 " + procInfos['cpu_cores']

    if os.path.exists("/etc/linuxmint/info"):
        args = shlex.split("awk -F \"=\" '/GRUB_TITLE/ {print $2}' /etc/linuxmint/info")
        title = subprocess.check_output(args).rstrip("\n")
        infos.append((_("Operating System"), title))
    elif os.path.exists("/etc/arch-release"):
        contents = open("/etc/arch-release", 'r').readline().split()
        title = ' '.join(contents[:2]) or "Arch Linux"
        infos.append((_("Operating System"), title))
    else:
        s = '%s (%s)' % (' '.join(platform.linux_distribution()), arch)
        # Normalize spacing in distribution name
        s = re.sub('\s{2,}', ' ', s)
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
    infos.append((diskText, '%.1f %s' % ((diskSize / (1000*1000)), _("GB"))))

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
            print "Loading Info module"

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
                widget.pack_end(labelValue, False, False, 0)
                settings.add_row(widget)

            if os.path.exists("/usr/bin/upload-system-info"):
                button = Gtk.Button(_("Upload system information"))
                button.set_tooltip_text(_("This includes no personal information"))
                button.connect("clicked", self.on_button_clicked)
                page.pack_start(button, False, False, 0)

    def on_button_clicked(self, button):
        subprocess.Popen(["upload-system-info"])