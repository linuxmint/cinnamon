#!/usr/bin/env python

from SettingsWidgets import *

import platform
import subprocess
import os
import re
import threading


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
    return cards

def getDiskSize():
    disksize = 0
    for line in getProcessOut("df"):
        if line.startswith("/"):
            disksize += float(line.split()[1])
            
    return disksize

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
    (dname, dversion, dsuffix) = platform.linux_distribution()
    arch = platform.machine().replace("_", "-")
    (memsize, memunit) = procInfos['mem_total'].split(" ")
    processorName = procInfos['cpu_name'].replace("(R)", u"\u00A9").replace("(TM)", u"\u2122")
    if 'cpu_cores' in procInfos:
        processorName = processorName + " x " + procInfos['cpu_cores']
    
    infos.append((_('Device Name'), platform.node()))
    infos.append((_('Distribution'), dname + " " + dversion +  ": " + dsuffix + " (" + arch + ")"))
    infos.append((_('Kernel / Build'), platform.release() + " / " + platform.version()))
    infos.append((_('Processor'), processorName))
    if memunit == "kB":
        infos.append((_('Memory'), '%.1f GiB' % (float(memsize)/(1024*1024))))
    else:
        infos.append((_('Memory'), procInfos['mem_total']))
    infos.append((_('Disk Size'), '%.1f GB' % (getDiskSize() / (1000*1000))))

    cards = getGraphicsInfos()
    for card in cards:
        infos.append((_('Graphics Card %s') % card, cards[card]))

    return infos

class Module:
    def __init__(self, content_box):
        keywords = _("system, information, details, graphic, sound, kernel, version")
        advanced = False
        sidePage = SidePage(_("System Info"), "details.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "info"
        self.category = "hardware"
        
        infos = createSystemInfos()
        
        image = Gtk.Image()
        image.set_from_file("/usr/lib/cinnamon-settings/data/cinnamon.png")
        sidePage.add_widget(image, False)
        
        label = Gtk.Label("?")
        if 'CINNAMON_VERSION' in os.environ:
            label.set_markup('<span size="12000">%s: %s\n</span>' % (_("Version"), os.environ['CINNAMON_VERSION']))
        sidePage.add_widget(label, False)
        
        table = Gtk.Table(len(infos), 2, False)
        table.set_row_spacings(8)
        table.set_col_spacings(15)
        sidePage.add_widget(table, False)

        row = 0
        for (key, value) in infos:
            labelKey = Gtk.Label(key)
            labelKey.set_alignment(1, 0.5)
            labelKey.get_style_context().add_class("dim-label")
            labelValue = Gtk.Label(value)
            labelValue.set_alignment(0, 0.5)
            table.attach(labelKey, 0, 1, row, row+1)
            table.attach(labelValue, 1, 2, row, row+1)
            row += 1

