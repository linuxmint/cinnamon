sassc = find_program('pysassc', 'sassc')

custom_target(
  'cinnamon_css',
  input: 'cinnamon.scss',
  output: 'cinnamon.css',
  command: [sassc, '@INPUT@', '@OUTPUT@'],
  build_always_stale: true,
  install: true,
  install_dir: join_paths(pkgdatadir, 'theme')
)
