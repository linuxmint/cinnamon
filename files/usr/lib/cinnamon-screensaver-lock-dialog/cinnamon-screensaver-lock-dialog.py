#!/usr/bin/env python

import sys
import os
import gettext
import gtk
import gtk.glade   
import pwd
import socket

# i18n
gettext.install("cinnamon", "/usr/share/cinnamon/locale")

class MainWindow:
  
    ''' Create the UI '''
    def __init__(self):

        user_id = os.getuid()
        username =  pwd.getpwuid(user_id).pw_name
        real_name = pwd.getpwuid(user_id).pw_gecos
        home_dir = pwd.getpwuid(user_id).pw_dir
        
        real_name = real_name.replace(",", "")
        if real_name == "":
            real_name = username        

        gladefile = "/usr/lib/cinnamon-screensaver-lock-dialog/cinnamon-screensaver-lock-dialog.glade"
        self.wTree = gtk.glade.XML(gladefile, "main_dialog")        
        
        self.window = self.wTree.get_widget("main_dialog")        
        self.button_cancel = self.wTree.get_widget("button_cancel")
        self.button_ok = self.wTree.get_widget("button_ok")                        
        self.entry = self.wTree.get_widget("entry_away_message")
        self.image = self.wTree.get_widget("image_face")
                    
        self.window.set_title(_("Lock screen"))
        self.window.set_icon_from_file("/usr/lib/cinnamon-settings/data/icons/screensaver.svg")
                
        self.wTree.get_widget("label_description").set_markup("<i>%s</i>" % _("Please type an away message for the lock screen"))
        self.wTree.get_widget("label_away_message").set_markup("<b>%s: </b>" % real_name)        
        
        if os.path.exists("%s/.face" % home_dir):
            self.image.set_from_file("%s/.face" % home_dir)
        else:
            self.image.set_from_file("/usr/share/pixmaps/nobody.png")
        
        self.window.connect("destroy", gtk.main_quit)
        self.button_cancel.connect("clicked", gtk.main_quit)
        self.button_ok.connect('clicked', self.lock_screen)
        self.entry.connect('activate', self.lock_screen)
        
        self.wTree.get_widget("dialog-action_area1").set_focus_chain((self.button_ok, self.button_cancel))
          
        self.window.show()                    
        
    def lock_screen(self, data):
        os.system("cinnamon-screensaver-command --lock --away-message \"%s\" &" % self.entry.get_text())
        gtk.main_quit()
   
if __name__ == "__main__":    
    MainWindow()
    gtk.main()
