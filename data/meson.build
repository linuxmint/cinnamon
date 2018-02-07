data_conf = configuration_data()
data_conf.set('bindir', join_paths(get_option('prefix'), get_option('bindir')))
data_conf.set('VERSION', meson.project_version())
data_conf.set('GETTEXT_PACKAGE', meson.project_name())

desktop_file_in = configure_file(
  input : 'cinnamon.desktop.in.notrad',
  output: 'cinnamon.desktop.in',
  configuration: data_conf,
)
# i18n.merge_file(
configure_file(
  input : desktop_file_in,
  output: 'cinnamon.desktop',
  # po_dir: join_paths(meson.source_root(), 'po'),
  configuration: data_conf,
  install: true,
  install_dir: join_paths(get_option('datadir'), 'applications'),
)

configure_file(
  input : 'org.cinnamon.gschema.xml.in',
  output: 'org.cinnamon.gschema.xml',
  configuration: data_conf,
  install: true,
  install_dir: join_paths(get_option('datadir'), 'glib-2.0', 'schemas'),
)

install_subdir('icons',
  exclude_files: 'Makefile.am',
  install_dir: get_option('datadir'),
)

install_subdir('search_providers',
  install_dir: pkgdatadir,
)

install_subdir('theme',
  exclude_files: 'theme-changelog.txt',
  install_dir: pkgdatadir,
)
