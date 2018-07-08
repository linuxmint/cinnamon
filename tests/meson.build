
test_conf = configuration_data()
test_conf.set('MUFFIN_TYPELIB_DIR', muffin_typelib_dir)
test_conf.set('srcdir',             meson.current_source_dir())


run_test = find_program(configure_file(
  input : 'run-test.sh.in',
  output: 'run-test.sh',
  configuration: test_conf,
))

test('js-test',
  run_test,
)
