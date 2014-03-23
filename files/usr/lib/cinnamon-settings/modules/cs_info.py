#!/usr/bin/env python

from SettingsWidgets import *

import platform
import subprocess
import os
import re
import threading

PATH = "/usr/lib/cinnamon-settings/"
CHAR_LIMIT = 50 #Used to prevent abuse ;)
IMG_SIZE = 128

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
    
def getVersion():
    output = str(subprocess.Popen(["cinnamon", "--version"], stdout=subprocess.PIPE).communicate()[0]) # "str" prevents it from outputting results
    output1 = output.replace("Cinnamon ", "") #Removes "Cinnamon" from the output
    version = output1.replace("\n", "") #Removes creepy newline from terminal output
    
    return version
    
def getOemInfo():
    inpt = open(PATH + '/data/oem/info.txt', 'r')
    inpt1 = inpt.read(CHAR_LIMIT)
    info = str(inpt1.replace("\n", "")) #Need to keep newlines off or they will screw with layout

    return info

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
    
    if os.path.exists("/etc/linuxmint/info"):
        title = commands.getoutput("awk -F \"=\" '/GRUB_TITLE/ {print $2}' /etc/linuxmint/info")
        infos.append((_("Operating System"), title))    
    else:
        infos.append((_("Operating System"), dname + " " + dversion +  " '" + dsuffix.title() + "' (" + arch + ")"))
    
    if (os.path.exists(PATH + "/data/oem/info.txt") and not getOemInfo() == ""):
        infos.append((_("OEM"), getOemInfo()))
        
    if os.path.exists("/usr/bin/cinnamon"):
        infos.append((_("Cinnamon Version"), getVersion()))
    infos.append((_("Linux Kernel"), platform.release()))
    infos.append((_("Processor"), processorName))
    if memunit == "kB":
        infos.append((_("Memory"), '%.1f %s' % ((float(memsize)/(1024*1024)), _("GiB"))))
    else:
        infos.append((_("Memory"), procInfos['mem_total']))
    infos.append((_("Hard Drive"), '%.1f %s' % ((getDiskSize() / (1000*1000)), _("GB"))))

    cards = getGraphicsInfos()
    for card in cards:
        infos.append((_("Graphics Card"), cards[card]))

    return infos

class Module:
    def __init__(self, content_box):
        keywords = _("system, information, details, graphic, sound, kernel, version")
        advanced = False
        sidePage = SidePage(_("System Info"), "cs-details", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "info"
        self.category = "hardware"
        self.comment = _("Display system information")
        
        if os.path.exists(PATH + "/data/oem/oem.png"):
            image = Gtk.Image()
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(PATH + "/data/oem/oem.png", IMG_SIZE, IMG_SIZE)
            image.set_from_pixbuf(pixbuf)
            sidePage.add_widget(image, False)
        else:
            image = Gtk.Image()
            image.set_from_file(PATH + "/data/cinnamon.png")
            sidePage.add_widget(image, False)
        
        infos = createSystemInfos()                        
        
        table = Gtk.Table.new(len(infos), 2, False)
        table.set_row_spacings(8)
        table.set_col_spacings(15)
        sidePage.add_widget(table, False)

        row = 0
        for (key, value) in infos:
            labelKey = Gtk.Label.new(key)
            labelKey.set_alignment(1, 0.5)
            labelKey.get_style_context().add_class("dim-label")
            labelValue = Gtk.Label.new(value)
            labelValue.set_alignment(0, 0.5)
            table.attach(labelKey, 0, 1, row, row+1)
            table.attach(labelValue, 1, 2, row, row+1)
            row += 1

