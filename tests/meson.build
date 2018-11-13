
test_conf = configuration_data()
test_conf.set('MUFFIN_TYPELIB_DIR', muffin_typelib_dir)
test_conf.set('srcdir',             meson.current_source_dir())


run_test = find_program(configure_file(
  input : 'run-test.sh.in',
  output: 'run-test.sh',
  configuration: test_conf,
))


tests_js = [
  'interactive/border-radius.js',
  'interactive/border-width.js',
  'interactive/borders.js',
  'interactive/box-layout.js',
  'interactive/box-shadows.js',
  'interactive/calendar.js',
  'interactive/css-fonts.js',
  'interactive/entry.js',
  'interactive/icons.js',
  'interactive/inline-style.js',
  'interactive/scroll-view-sizing.js',
  'interactive/scrolling.js',
  'interactive/table.js',
  'interactive/transitions.js',
  'testcommon/border-image.png',
  'testcommon/face-plain.png',
  'testcommon/ui.js',
  'unit/format.js',
  'unit/markup.js',
  'unit/url.js',
]

foreach test : tests_js
  test('js-test',
    run_test,
    args: ['-v', join_paths(meson.current_source_dir(), test)]
  )
endforeach
