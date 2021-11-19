#!/usr/bin/python3

from gi.repository import GLib, Gio
import sys
import signal

from xml.etree import ElementTree 

signal.signal(signal.SIGINT, signal.SIG_DFL)

class MethodArg:
    def __init__(self, method, arg_index, arg_type):
        self.method = method
        self.arg_index = arg_index
        self.arg_type = arg_type

class CinnamonDBusCommand:
    def __init__(self, mainloop):
        self.mainloop = mainloop

        try:
            self.cinnamon_proxy = Gio.DBusProxy.new_for_bus_sync(Gio.BusType.SESSION,
                                                             Gio.DBusProxyFlags.NONE,
                                                             None,
                                                             "org.Cinnamon",
                                                             "/org/Cinnamon",
                                                             "org.Cinnamon",
                                                             None)
        except GLib.Error:
            self.cinnamon_proxy = None
            print("Cannot acquire org.Cinnamon proxy")

        introspection_info = Gio.DBusConnection.call_sync(Gio.bus_get_sync(Gio.BusType.SESSION),
                                                          "org.Cinnamon",
                                                          "/org/Cinnamon",
                                                          "org.freedesktop.DBus.Introspectable",
                                                          "Introspect",
                                                          None,
                                                          GLib.VariantType(type_string="(s)"),
                                                          0,
                                                          -1,
                                                          None)

        unpacked = introspection_info.unpack()[0]
        self.tree = ElementTree.fromstring(unpacked)

        self.arg_list = []
        list_methods = False

        if len(sys.argv) < 2:
            list_methods = True
            print("\nProvide a method name and any parameters.  Available commands are:\n")

        for interface in self.tree:
            if interface.attrib["name"] == "org.Cinnamon":
                for entry in interface:
                    if entry.tag != "method":
                        continue
                    arg_str = ""

                    i = 0

                    for arg in entry:
                        if arg.attrib["direction"] != "in":
                            continue

                        if list_methods:
                            arg_str += "--- %s ('%s') " % (arg.attrib["name"], arg.attrib["type"])

                        self.arg_list.append(MethodArg(entry.attrib["name"], i, arg.attrib["type"]))
                        i += 1

                    if list_methods:
                        print("%s %s" % (entry.attrib["name"], arg_str))

        if list_methods:
            print("\nNote: boolean arguments should be specified as 0 (false) and 1 (true)")
            print("\nAn example is:   cinnamon-dbus-command GetMonitorWorkRect 0\n")
            exit(1)

        self.parse_command(sys.argv[1:])

    def method_call_finished_callback(self, proxy, result, data=None):
        try:
            variant = proxy.call_finish(result)
            print("Returned: %s" % str(variant.unpack()))
        except GLib.Error as e:
            print("An error occurred attempting to run the command: %s" % e.message)

        self.mainloop.quit()

    def parse_command(self, args):
        method_name = args[0]

        parameters = self.build_variant(method_name, args[1:])

        try:
            self.cinnamon_proxy.call(method_name,
                                 parameters,
                                 0,
                                 -1,
                                 None,
                                 self.method_call_finished_callback,
                                 None)
        except TypeError as e:
            print("Could not send command over the bus: %s" % str(e))
            exit(1)

    def build_variant(self, method_name, in_args):
        i = 0

        variant_string = "("

        while i < len(in_args):
            arg = in_args[i]

            arg_info = self.lookup_arg(method_name, i)

            if arg_info:
                variant_string += arg_info.arg_type
            else:
                print("The parameter '%s' seems invalid for method '%s'" % (arg, method_name))
                exit(1)

            i += 1

        variant_string += ")"

        parsed_args = []
        for arg_as_str in in_args:
            try:
                parsed_args.append(eval(arg_as_str))
            except:
                parsed_args.append(arg_as_str)

        print("Parsed: %s(format_string='%s', args=%s)\n" % (method_name, variant_string, parsed_args))

        try:
            variant = GLib.Variant(variant_string, tuple(parsed_args))
        except TypeError as e:
            print("Could not construct argument variant for method: %s" % str(e))
            exit(1)

        return variant

    def lookup_arg(self, method_name, index):
        for arg in self.arg_list:
            if arg.method == method_name and arg.arg_index == index:
                return arg

        return None

if __name__ == "__main__":
    ml = GLib.MainLoop.new(None, True)
    main = CinnamonDBusCommand(ml)

    ml.run()
