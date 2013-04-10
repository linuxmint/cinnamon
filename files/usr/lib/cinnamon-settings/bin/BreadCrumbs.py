import cairo
import math
import gi
from gi.repository import Gio, Gtk, Gdk, GObject, GdkPixbuf, GtkClutter, Gst, Pango, PangoCairo

_270_DEG = 270.0 * (math.pi/180.0)
_180_DEG = 180.0 * (math.pi/180.0)
_90_DEG = 90.0 * (math.pi/180.0)
_0_DEG = 0.0 * (math.pi/180.0)
BUTTON_OFFSET_FACTOR = 2.125

BREAD_CRUMB_STYLE = '''
.no-displacement {
    -GtkButton-child-displacement-x: 0;
    -GtkButton-child-displacement-y: 0;
}
.first-breadcrumb {
    padding-left: 10px;
    padding-right: 15px;
}
.last-breadcrumb {
    padding-left: 15px;
    padding-right: 10px;
}
.mid-breadcrumb {
    padding-left: 15px;
    padding-right: 15px;
}
.single-breadcrumb {
    padding-left: 10px;
    padding-right: 10px;
}
'''

class BreadCrumb(Gtk.ToggleButton):
    def __init__(self, text):
        Gtk.ToggleButton.__init__(self, text)
        self.previous = None
        self.next = None
        
        provider = Gtk.CssProvider()
        provider.load_from_data(BREAD_CRUMB_STYLE)
        
        styleContext = self.get_style_context()
        styleContext.add_provider(provider, 600) 
        styleContext.add_class("no-displacement")
        styleContext.add_class("raised")
        
        self.connect('draw', self.expose)
        
    def update_classes(self):
        context = self.get_style_context()
        context.remove_class("single-breadcrumb")
        context.remove_class("first-breadcrumb")
        context.remove_class("last-breadcrumb")
        context.remove_class("mid-breadcrumb")
        
        if self.previous == None and self.next == None:
            context.add_class("single-breadcrumb")
        elif self.previous == None:
            context.add_class("first-breadcrumb")
        elif self.next == None:
            context.add_class("last-breadcrumb")
        else:
            context.add_class("mid-breadcrumb")

    def do_draw_single_element(self, cr, x, y, w, h, offset, borderRadius):
        cr.move_to(x+borderRadius+1, y)
        cr.line_to(x+w-borderRadius-1, y)
        cr.arc(x+w-borderRadius-1, y+borderRadius+1, borderRadius, _270_DEG, _0_DEG)
        cr.line_to(x+w-1, y+h-borderRadius-1)
        cr.arc(x+w-borderRadius-1, y+h-borderRadius-1, borderRadius, _0_DEG, _90_DEG)
        cr.line_to(x+borderRadius+1, y+h-1)
        cr.arc(x+borderRadius+1, y+h-borderRadius-1, borderRadius, _90_DEG, _180_DEG)
        cr.line_to(x, y+borderRadius+1)
        cr.arc(x+borderRadius+1, y+borderRadius+1, borderRadius, _180_DEG, _270_DEG)
        
    def do_draw_first_element(self, cr, x, y, w, h, offset, borderRadius):
        cr.move_to(x+borderRadius+1, y)
        cr.line_to(x+w-offset, y)
        cr.line_to(x+w-1, y+(h/2))
        cr.line_to(x+w-offset, y+h)
        cr.line_to(x+borderRadius+1, y+h-1)
        cr.arc(x+borderRadius+1, y+h-borderRadius-1, borderRadius, _90_DEG, _180_DEG)
        cr.line_to(x, y+borderRadius+1)
        cr.arc(x+borderRadius+1, y+borderRadius+1, borderRadius, _180_DEG, _270_DEG)
        
    def do_draw_middle_element(self, cr, x, y, w, h, offset, borderRadius):
        cr.move_to(x, y)
        cr.line_to(x+w-offset, y)
        cr.line_to(x+w-1, y+(h/2))
        cr.line_to(x+w-offset, y+h-1)
        cr.line_to(x, y+h-1)
        cr.line_to(x+offset-1, y+(h/2))
        cr.line_to(x, y)
        
    def do_draw_last_element(self, cr, x, y, w, h, offset, borderRadius):
        cr.move_to(x, y)
        cr.line_to(x+w-borderRadius-1, y)
        cr.arc(x+w-borderRadius-1, y+borderRadius+1, borderRadius, _270_DEG, _0_DEG)
        cr.line_to(x+w-1, y+h-borderRadius-1)
        cr.arc(x+w-borderRadius-1, y+h-borderRadius-1, borderRadius, _0_DEG, _90_DEG)
        cr.line_to(x, y+h-1)
        cr.line_to(x+offset-1, y+(h/2))
        cr.line_to(x, y)
        
    def begin_element_drawing(self, context, cr, x, y, w, h):
        cr.save()
        cr.set_antialias(cairo.ANTIALIAS_SUBPIXEL)

        state = context.get_state()
        borderColor = context.get_border_color(state)
        
        # some themes just won't give us their border color, so we'll just dictate one
        if borderColor.alpha == 0:
            cr.set_source_rgba(0.5, 0.5, 0.5, 0.5)
            border = 2
        else:
            cr.set_source_rgba(borderColor.red, borderColor.green, borderColor.blue, borderColor.alpha)
            border = context.get_border(state).left * 2
        
        cr.set_line_width(border)

    def end_element_drawing(self, context, cr, x, y, w, h):
        cr.stroke_preserve()
        cr.clip()

        Gtk.render_background(context, cr, x, y, w, h)
        cr.restore()
    
    def expose(self, widget, cr):
        context = self.get_style_context()
        state = context.get_state()

        context.save()

        allocation = self.get_allocation()

        x = 0
        y = 0
        width = allocation.width
        height = allocation.height

        borderRadius = context.get_property("border-radius", state)
        offset = round(height / BUTTON_OFFSET_FACTOR)
        
        self.begin_element_drawing(context, cr, x, y, width, height)
        if self.previous == None and self.next == None:
            self.do_draw_single_element(cr, x, y, width, height, offset, borderRadius)
        elif self.previous == None:
            self.do_draw_first_element(cr, x, y, width, height, offset, borderRadius)
        elif self.next == None:
            self.do_draw_last_element(cr, x, y, width, height, offset, borderRadius)
        else:
            self.do_draw_middle_element(cr, x, y, width, height, offset, borderRadius)
        self.end_element_drawing(context, cr, x, y, width, height)

        context.restore()
        
        res = Gtk.Bin.do_draw(self, cr)
        return True
        
    def get_preferred_size_for_height(self, height):
        (succ, req) = self.get_preferred_size()
        offset = round(req.height / BUTTON_OFFSET_FACTOR) + 2
        if self.previous != None:
            req.width -= offset

        req.height = height
        return req
        
class BreadCrumbsManager:
    def __init__(self, box, callback):
        self.callback = callback
        self.box = box
        self.buttons = []
        self.activeButton = None
        self.ignoreClicks = False
        self.box.connect('size-allocate', self.do_size_allocate)
    
    def dropRightCrumbs(self):
        buttons = self.buttons
        self.buttons = []
        right = False
        for button in buttons:
            if right == False:
                self.buttons.append(button)
                if button == self.activeButton:
                    button.next = None
                    button.update_classes()
                    right = True
            else:
                self.box.remove(button)
                button.destroy()

    def popCrumb(self):
        self.activeButton = self.buttons[len(self.buttons)-2]
        self.dropRightCrumbs()
        self.setActiveCrumb(self.activeButton)
        self.activeButton.update_classes()
        self.callback(self.activeButton.__data)
        
    def pushCrumb(self, label, data):
        self.dropRightCrumbs()
        
        button = BreadCrumb(label)
        button.connect("clicked", self.onButtonClicked)
        button.__data = data
        
        num = len(self.buttons)
        if num != 0:
            button.previous = self.buttons[num-1]
            button.previous.next = button
            button.previous.update_classes()
        button.update_classes()
        
        self.buttons.append(button)
        self.box.add(button)
        self.setActiveCrumb(button)
        button.show()
        return button
    
    def setActiveCrumb(self, button):
        self.ignoreClicks = True
        self.activeButton = None
        num = len(self.buttons)
        for button2 in self.buttons:
            if button2 != button:
                button2.set_active(False)
            else:
                self.activeButton = button
            
        if self.activeButton == None:
            print "Error: active button not found, this should never happen!"
        button.set_active(True)
        self.ignoreClicks = False
        
    def onButtonClicked(self, button):
        if self.ignoreClicks == False:
            changed = button != self.activeButton
            self.setActiveCrumb(button)
            if changed:
                self.callback(button.__data)
    
    def hide(self):
        self.box.hide()
        
    def show(self):
        self.box.show_all()


    def do_size_allocate (self, widget, allocation):
        allocation.y += 5
        allocation.height -= 10

        self.box.set_allocation(allocation)

        # No path is set so we don't have to allocate anything.
        if len(self.buttons) == 0:
            return
        
        direction = self.box.get_direction()
        allocation_width = allocation.width
        offset = round(allocation.height / BUTTON_OFFSET_FACTOR + 2)

        # Now, we allocate space to the buttons
        button_allocation = Gdk.Rectangle()
        button_allocation.y = allocation.y
        button_allocation.height = allocation.height

        if (direction == Gtk.TextDirection.RTL):
            button_allocation.x = allocation.x + allocation.width
        else:
            button_allocation.x = allocation.x

        first_element = True
        for button in self.buttons:
            (succ, child_requisition) = button.get_preferred_size()

            button_allocation.width = child_requisition.width
            if (direction == Gtk.TextDirection.RTL):
                button_allocation.x -= button_allocation.width

            if first_element:
                first_element = False
            elif (direction == Gtk.TextDirection.RTL):
                button_allocation.x += offset
            else:
                button_allocation.x -= offset

            button.size_allocate(button_allocation)

            if (direction != Gtk.TextDirection.RTL):
                button_allocation.x += button_allocation.width
