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
    install_dir: libexecdir,
)
