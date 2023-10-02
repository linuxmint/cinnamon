ignore = [
    'cinnamon-recorder-src.h',
    'cinnamon-recorder.h',
    st_headers,
    st_private_headers,
    tray_headers,
    sniffer_headers,
]

recorder_conf = configuration_data()

if get_option('build_recorder')
    recorder_conf.set('BUILD_RECORDER_XML_START', '-->')
    recorder_conf.set('BUILD_RECORDER_XML_END', '<!--')
else
    recorder_conf.set('BUILD_RECORDER_XML_START', '')
    recorder_conf.set('BUILD_RECORDER_XML_END', '')
    ignore += 'cinnamon-recorder.h'
endif

configure_file(
    input: 'recorder.xml.in',
    output: 'recorder.xml',
    configuration: recorder_conf,
)

gnome.gtkdoc(
    'cinnamon',
    mode: 'xml',
    main_xml: 'cinnamon-docs.sgml',
    gobject_typesfile: 'cinnamon.types',
    dependencies: [libcinnamon_deps, st_dep, cinnamon_dep],
    src_dir: [
        join_paths(meson.project_source_root(), 'src'),
        join_paths(meson.project_build_root(), 'src'),
    ],
    scan_args: '--rebuild-types',
    mkdb_args: ['--xml-mode', '--output-format=xml'],
    ignore_headers: ignore,
    install: true,
)
