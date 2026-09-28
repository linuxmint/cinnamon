cinnamon_bg_sources = [
    'cinnamon-bg-item.c',
    'cinnamon-bg-list.c',
    'cinnamon-bg-monitors.c',
]

cinnamon_bg_headers = [
    'cinnamon-bg-enums.h',
    'cinnamon-bg-item.h',
    'cinnamon-bg-list.h',
    'cinnamon-bg-monitor-info.h',
]

cinnamon_bg_enums = gnome.mkenums_simple('cinnamon-bg-enum-types',
    sources: 'cinnamon-bg-enums.h')

cinnamon_bg_deps = [gio, math]

libcinnamon_bg = shared_library('cinnamon-bg',
    cinnamon_bg_sources + cinnamon_bg_headers + cinnamon_bg_enums,
    dependencies: cinnamon_bg_deps,
    c_args: ['-DG_LOG_DOMAIN="CinnamonBg"'],
    install: true,
    install_dir: pkglibdir,
)

libcinnamon_bg_dep = declare_dependency(
    link_with: libcinnamon_bg,
    include_directories: include_directories('.'),
    sources: cinnamon_bg_enums[1],
    dependencies: cinnamon_bg_deps,
)

# Private, like Cinnamon-0.1: the typelib lands in pkglibdir, which the shell
# adds to the repository search path in main.c. The python tools do the same
# via config.add_private_typelib_path(), which also points the loader here.
gnome.generate_gir(libcinnamon_bg,
    sources: cinnamon_bg_sources + cinnamon_bg_headers + cinnamon_bg_enums,
    namespace: 'CinnamonBg',
    nsversion: '1.0',
    identifier_prefix: 'CinnamonBg',
    symbol_prefix: 'cinnamon_bg',
    includes: ['GObject-2.0', 'Gio-2.0'],
    install: true,
    install_dir_typelib: pkglibdir,
    install_dir_gir: pkgdatadir,
    extra_args: ['--quiet', '--warn-all'],
)
