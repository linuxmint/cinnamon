gnome.gtkdoc(
    'cinnamon-st',
    mode: 'xml',
    main_xml: 'cinnamon-st-docs.sgml',
    gobject_typesfile: 'cinnamon-st.types',
    dependencies: [st_dep],
    src_dir: [
        join_paths(meson.source_root(), 'src', 'st'),
        join_paths(meson.build_root(), 'src', 'st'),
    ],
    scan_args: '--rebuild-types',
    mkdb_args: ['--xml-mode', '--output-format=xml'],
    ignore_headers: st_private_headers,
    install: true,
)
