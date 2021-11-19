subdir('icons')

install_subdir(
    'search_providers',
    install_dir: pkgdatadir,
)

install_subdir(
    'theme',
    exclude_files: ['theme-changelog.txt'],
    install_dir: pkgdatadir,
)

desktop_conf = configuration_data()
desktop_conf.set('bindir', join_paths(prefix, bindir))
desktop_conf.set('VERSION', meson.project_version())

desktop = configure_file(
    input: 'cinnamon.desktop.in.in',
    output: 'cinnamon.desktop.in',
    configuration: desktop_conf,
)

custom_target(
    'desktop',
    input: desktop,
    output: 'cinnamon.desktop',
    command: [intltool_merge, '-d', '-u', po_dir, '@INPUT@', '@OUTPUT@'],
    install: true,
    install_dir: desktopdir,
)

install_data(
    'org.cinnamon.gschema.xml',
    install_dir: schemadir,
)
