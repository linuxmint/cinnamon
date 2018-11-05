install_subdir('.',
  exclude_files: [
    'Makefile.am',
    'Makefile.in',
    'Makefile',
    'meson.build',
    'misc/config.js.in',
    'misc/config.js',
    'misc/state.js',
  ],
  install_dir: join_paths(pkgdatadir, 'js'),
)

configure_file(
  input : 'misc/config.js.in',
  output: 'config.js',
  configuration: conf,
  install: true,
  install_dir: join_paths(pkgdatadir, 'js', 'misc'),
)
