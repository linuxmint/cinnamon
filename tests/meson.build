tests = [
    'interactive/borders.js',
    'interactive/border-radius.js',
    'interactive/border-width.js',
    'interactive/box-layout.js',
    'interactive/box-shadows.js',
    'interactive/calendar.js',
    'interactive/css-fonts.js',
    'interactive/entry.js',
    'interactive/icons.js',
    'interactive/inline-style.js',
    'interactive/scrolling.js',
    'interactive/scroll-view-sizing.js',
    'interactive/table.js',
    'interactive/transitions.js',
    'testcommon/border-image.png',
    'testcommon/face-plain.png',
    'testcommon/ui.js',
    'unit/format.js',
    'unit/markup.js',
    'unit/url.js',
    'testcommon/test.css',
]

test_conf = configuration_data()
test_conf.set('MUFFIN_TYPELIB_DIR', muffinlibdir)
test_conf.set('srcdir', muffinlibdir)

test_script = configure_file(
    input: 'run-test.sh.in',
    output: 'run-test.sh',
    configuration: test_conf,
)

foreach jstest : tests
    test(
        'test' + jstest,
        js_tester,
        args: [join_paths(meson.current_source_dir(), jstest)],
    )
endforeach
