ignore = [
    'cinnamon-recorder-src.h',
    'cinnamon-recorder.h',
    st_headers,
    st_private_headers,
    tray_headers,
    sniffer_headers,
]

if not build_nm_agent
    ignore += 'cinnamon-network-agent.h'
endif

if not get_option('build_recorder')
    ignore += 'cinnamon-recorder.h'
endif

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
