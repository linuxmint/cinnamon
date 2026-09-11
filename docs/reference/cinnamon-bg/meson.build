# CinnamonBg gets its own book rather than joining the cinnamon one: it is a
# separate library, so its types cannot be scanned by a target that links only
# libcinnamon (see the 'background' prune in ../cinnamon/meson.build).
gnome.gtkdoc(
    'cinnamon-bg',
    mode: 'xml',
    main_xml: 'cinnamon-bg-docs.xml',
    gobject_typesfile: 'cinnamon-bg.types',
    dependencies: [libcinnamon_bg_dep],
    src_dir: [
        join_paths(meson.project_source_root(), 'src', 'background', 'lib'),
        join_paths(meson.project_build_root(), 'src', 'background', 'lib'),
    ],
    scan_args: ['--rebuild-types', '--rebuild-sections'],
    mkdb_args: ['--xml-mode', '--output-format=xml'],
    ignore_headers: ['cinnamon-bg-enum-types.h', 'cinnamon-bg-private.h'],
    install: true,
)
