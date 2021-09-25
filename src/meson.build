subdir('st')
subdir('hotplug-sniffer')

include_src = include_directories('.')

cinnamon_headers = [
    'cinnamon-app.h',
    'cinnamon-app-system.h',
    'cinnamon-doc-system.h',
    'cinnamon-embedded-window.h',
    'cinnamon-generic-container.h',
    'cinnamon-glsl-quad.h',
    'cinnamon-gtk-embed.h',
    'cinnamon-global.h',
    'cinnamon-perf-log.h',
    'cinnamon-screenshot.h',
    'cinnamon-slicer.h',
    'cinnamon-stack.h',
    'cinnamon-tray-icon.h',
    'cinnamon-tray-manager.h',
    'cinnamon-util.h',
    'cinnamon-window-tracker.h',
    'cinnamon-wm.h',
    'cinnamon-xfixes-cursor.h',
]

cinnamon_private_headers = [
    'cinnamon-app-private.h',
    'cinnamon-app-system-private.h',
    'cinnamon-embedded-window-private.h',
    'cinnamon-global-private.h',
    'cinnamon-window-tracker-private.h',
    'cinnamon-wm-private.h',
]

cinnamon_sources = [
    'cinnamon-plugin.c',
    'cinnamon-app.c',
    'cinnamon-app-system.c',
    'cinnamon-doc-system.c',
    'cinnamon-embedded-window.c',
    'cinnamon-generic-container.c',
    'cinnamon-glsl-quad.c',
    'cinnamon-gtk-embed.c',
    'cinnamon-global.c',
    'cinnamon-perf-log.c',
    'cinnamon-screenshot.c',
    'cinnamon-slicer.c',
    'cinnamon-stack.c',
    'cinnamon-tray-icon.c',
    'cinnamon-tray-manager.c',
    'cinnamon-util.c',
    'cinnamon-window-tracker.c',
    'cinnamon-wm.c',
    'cinnamon-xfixes-cursor.c',
    cinnamon_headers,
]

cinnamon_enum_types = gnome.mkenums_simple(
    'cinnamon-enum-types',
    sources: cinnamon_headers,
)

cinnamon_sources += cinnamon_enum_types

tray_headers = [
    'tray/na-tray-child.h',
    'tray/na-tray-manager.h',
]

tray_sources = [
    'tray/na-tray-child.c',
    'tray/na-tray-manager.c',
    tray_headers,
]

libcinnamon_deps = [
    atk,
    cjs,
    clutter,
    cmenu,
    cogl,
    cogl_path,
    dbus,
    gdkx11,
    gi,
    gio,
    gio_unix,
    gl,
    gtk,
    muffin,
    pango,
    polkit,
    sn,
    soup,
    st_dep,
    xfixes,
    xml,
]

non_gir = []
if get_option('build_recorder')
    cinnamon_sources += [
        'cinnamon-recorder.c',
        'cinnamon-recorder.h',
    ]

    non_gir += [
        'cinnamon-recorder-src.c',
        'cinnamon-recorder-src.h',
    ]

    libcinnamon_deps += [
        gstreamer,
        gstreamer_base,
    ]
endif

libcinnamon = library(
    'cinnamon',
    [cinnamon_sources, non_gir, tray_sources, st_enum_types[1]],
    include_directories: [include_root, include_directories('st', 'tray')],
    install_rpath: join_paths(prefix, pkglibdir),
    dependencies: libcinnamon_deps,
    install: true,
    install_dir: pkglibdir,
)

cinnamon_dep = declare_dependency(
    include_directories: include_directories('.'),
    dependencies: libcinnamon_deps,
    link_with: libcinnamon,
    link_args: ['-Wl,-Bsymbolic', '-Wl,-z,relro', '-Wl,-z,now'],
)

executable(
    'cinnamon-perf-helper',
    'cinnamon-perf-helper.c',
    include_directories: include_root,
    dependencies: [config_h, gtk],
    install: true,
    install_dir: libexecdir,
)

js_tester = executable(
    'run-js-test',
    ['run-js-test.c', cinnamon_enum_types[1], st_enum_types[1]],
    c_args: [
        '-DCINNAMON_PKGLIBDIR="@0@"'.format(join_paths(prefix, pkglibdir)),
    ],
    include_directories: include_root,
    dependencies: cinnamon_dep,
    install: false,
)

executable(
    'cinnamon',
    ['main.c', cinnamon_enum_types[1], st_enum_types[1]],
    c_args: [
        '-DLOCALEDIR="@0@"'.format(join_paths(prefix, datadir, 'locale')),
        '-DCINNAMON_PKGLIBDIR="@0@"'.format(join_paths(prefix, pkglibdir)),
    ],
    install_rpath: ':'.join([join_paths(prefix, pkglibdir), muffinlibdir]),
    include_directories: include_root,
    dependencies: cinnamon_dep,
    install: true,
)

cinnamon_gir_includes = [
    'Clutter-0',
    'ClutterX11-0',
    'CoglPango-0',
    'Cogl-0',
    'Meta-Muffin.0',
    'Soup-2.4',
    'CMenu-3.0',
    st_gir[0],
]

cinnamon_gir = gnome.generate_gir(
    libcinnamon,
    namespace: 'Cinnamon',
    nsversion: '0.1',
    sources: cinnamon_sources,
    dependencies: libcinnamon_deps,
    identifier_prefix: 'Cinnamon',
    symbol_prefix: 'cinnamon',
    export_packages: 'cinnamon',
    includes: cinnamon_gir_includes,
    install: true,
    install_dir_typelib: pkglibdir,
    install_dir_gir: false,
    extra_args: [
        '-DST_COMPILATION',
        '--quiet',
        '--warn-all',
    ],
)

