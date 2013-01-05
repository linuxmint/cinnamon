#!/usr/bin/env python
import gtk
import pygtk
import subprocess

window = gtk.Window()
window.set_title(" ")
close = gtk.Button("Close")
close.connect("clicked",  subprocess.Popen("xkill")) 
window.add(close)
window.show_all()

gtk.main()
