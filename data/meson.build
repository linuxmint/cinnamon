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
desktop_conf.set('libexecdir', join_paths(prefix, libexecdir))
desktop_conf.set('VERSION', meson.project_version())

desktop_files = [
  'cinnamon.desktop',
  'cinnamon2d.desktop',
]

foreach desktop_file : desktop_files
    desktop = configure_file(
        input: desktop_file + '.in.in',
        output: desktop_file + '.in',
        configuration: desktop_conf,
    )

    custom_target(
        desktop_file,
        input: desktop,
        output: desktop_file,
        command: [intltool_merge, '-d', '-u', po_dir, '@INPUT@', '@OUTPUT@'],
        install: true,
        install_dir: desktopdir,
    )
endforeach

subdir('xsessions')
subdir('services')

install_data(
    ['org.cinnamon.gschema.xml', 'org.cinnamon.gestures.gschema.xml'],
    install_dir: schemadir,
)
