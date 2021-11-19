gnome.gtkdoc(
    'cinnamon-tutorials',
    mode: 'xml',
    main_xml: 'cinnamon-tutorials-docs.sgml',
    src_dir: [
        join_paths(meson.source_root(), 'src'),
        join_paths(meson.build_root(), 'src'),
    ],
    mkdb_args: ['--xml-mode', '--output-format=xml'],
    html_assets: 'settings.png',
    content_files: [
        'building.xml',
        'documenting-source.xml',
        'documenting-tutorial.xml',
        'using-documentation.xml',
        'write-applet.xml',
        'xlet-settings.xml',
        'xlet-settings-ref.xml',
        'xlet-versioning.xml',
        'xlet-translating.xml',
    ],
    install: true,
)
