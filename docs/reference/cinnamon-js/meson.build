gen_doc = files('gen_doc.py')

parts_files = custom_target(
    'js-doc-gen',
    command: [python, gen_doc, meson.source_root(), join_paths(meson.build_root(), '@OUTDIR@')],
    # input: ['cinnamon-js-docs.sgml'],
    output: ['ui.xml', 'misc.xml'],
    build_by_default: true,
)

gnome.gtkdoc(
    'cinnamon-js',
    mode: 'xml',
    main_xml: 'cinnamon-js-docs.sgml',
    dependencies: parts_files,
    src_dir: meson.current_build_dir(),
    install: true,
)
