gen_doc = files('gen_doc.py')

parts_files = custom_target(
    'js-doc-gen',
    command: [python, gen_doc, meson.project_source_root(), join_paths(meson.project_build_root(), '@OUTDIR@')],
    # input: ['cinnamon-js-docs.sgml'],
    output: ['ui.xml', 'misc.xml'],
    build_by_default: true,
)

gnome.gtkdoc(
    'cinnamon-js',
    mode: 'xml',
    main_xml: 'cinnamon-js-docs.sgml',
    src_dir: meson.current_build_dir(),
    install: true,
)
