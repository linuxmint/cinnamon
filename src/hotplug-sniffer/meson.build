
service_file = configure_file(
  input : 'org.Cinnamon.HotplugSniffer.service.in',
  output: 'org.Cinnamon.HotplugSniffer.service',
  configuration: service_conf,
  install: true,
  install_dir: join_paths(get_option('datadir'), 'dbus-1', 'services'),
)

cinnamon_hotplug_sniffer = executable('cinnamon-hotplug-sniffer',
  [
    'cinnamon-mime-sniffer.c',
    'hotplug-sniffer.c',
  ],
  dependencies: [
    gio,
    gdk_pixbuf,
  ],
  install: true,
  install_dir: libexecdir,
)
