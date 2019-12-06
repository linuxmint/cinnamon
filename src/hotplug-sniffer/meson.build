sniffer_headers = [
    'hotplug-mimetypes.h',
    'cinnamon-mime-sniffer.h',
]

sniffer_sources = [
    'cinnamon-mime-sniffer.c',
    'hotplug-sniffer.c',
]

sniffer_deps = [
    glib,
    gio,
    gtk,
]

executable(
    'cinnamon-hotplug-sniffer',
    sniffer_sources,
    include_directories: include_root,
    dependencies: sniffer_deps,
    install: true,
    install_dir: pkglibdir,
)

sniffer_conf = configuration_data()
sniffer_conf.set('pkglibexecdir', join_paths(prefix, pkglibdir))

configure_file(
    input: 'org.Cinnamon.HotplugSniffer.service.in',
    output: 'org.Cinnamon.HotplugSniffer.service',
    configuration: sniffer_conf,
    install_dir: servicedir,
)
