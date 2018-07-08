service_conf = configuration_data()
service_conf.set('pkglibexecdir', join_paths(get_option('prefix'), libexecdir))

srcInclude = include_directories('.')

subdir('hotplug-sniffer')
subdir('st')
subdir('tray')


if true#build_recorder
  libcinnamon_recorder = static_library('cinnamon-recorder',
    [
      'cinnamon-recorder.c',
      'cinnamon-recorder-src.c',
    ],
    include_directories: [ rootInclude, stInclude, ],
    dependencies: [
      clutter,
      gstreamer,
      gstreamer_base,
    ],
    link_with: [
      libcinnamon_st,
    ],
  )

  test('recorder',
    executable('test-recorder',
      'test-recorder.c',
      link_whole: libcinnamon_recorder,
      include_directories: [ rootInclude, ],
      dependencies: [
        clutter,
        gstreamer,
      ],
    )
  )

else
  libcinnamon_recorder = [ ]
endif


cinnamon_headers = [
  'cinnamon-app-system.h',
  'cinnamon-app.h',
  'cinnamon-doc-system.h',
  'cinnamon-embedded-window.h',
  'cinnamon-generic-container.h',
  'cinnamon-global.h',
  'cinnamon-gtk-embed.h',
  'cinnamon-mount-operation.h',
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

cinnamon_enums = gnome.mkenums('cinnamon-enum-types',
  h_template: 'cinnamon-enum-types.h.in',
  c_template: 'cinnamon-enum-types.c.in',
  sources: cinnamon_headers,
)

cinnamon_sources = [
  'cinnamon-app-system.c',
  'cinnamon-app.c',
  'cinnamon-doc-system.c',
  'cinnamon-embedded-window.c',
  'cinnamon-generic-container.c',
  'cinnamon-global.c',
  'cinnamon-gtk-embed.c',
  'cinnamon-mount-operation.c',
  'cinnamon-perf-log.c',
  'cinnamon-plugin.c',
  'cinnamon-screenshot.c',
  'cinnamon-slicer.c',
  'cinnamon-stack.c',
  'cinnamon-tray-icon.c',
  'cinnamon-tray-manager.c',
  'cinnamon-util.c',
  'cinnamon-window-tracker.c',
  'cinnamon-wm.c',
  'cinnamon-xfixes-cursor.c',
  cinnamon_enums,
]

cinnamon_deps = [
  atk_bridge,
  cjs,
  clutter_x11,
  dbus_glib,
  gdk_x11,
  gio_unix,
  gio,
  gl,
  gobject,
  gstreamer_base,
  gstreamer,
  gtk3,
  libcinnamon_menu,
  libmuffin,
  libnm_glib,
  libnm_util,
  libsoup,
  libstartup_notif,
  libxml,
  polkit_agent,
  x11,
  xfixes,
]

libcinnamon = shared_library('cinnamon',
  cinnamon_sources,
  include_directories: [
    rootInclude,
    stInclude,
    trayInclude,
  ],
  dependencies: cinnamon_deps,
  link_whole: [
    libcinnamon_st,
    libcinnamon_tray,
  ],
  install: true,
  install_dir: pkglibdir,
)


cinn_conf = configuration_data()
cinn_conf.set('PYTHON',             import('python3').find_python().path())
cinn_conf.set('VERSION',            meson.project_version())
cinn_conf.set('JHBUILD_TYPELIBDIR', jhbuild_typelibdir)
cinn_conf.set('bindir',             get_option('bindir'))
cinn_conf.set('datadir',            get_option('datadir'))
cinn_conf.set('libdir',             get_option('libdir'))
cinn_conf.set('libexecdir',         get_option('libexecdir'))
cinn_conf.set('pkgdatadir',         pkgdatadir)
cinn_conf.set('pkglibexecdir',      join_paths(get_option('libexecdir'), meson.project_name()))
cinn_conf.set('sysconfdir',         get_option('sysconfdir'))


if use_jhbuild_wrapper_script
  cinnamon_jhbuild = configure_file(
    input : 'cinnamon-jhbuild.in',
    output: 'cinnamon',
    configuration: cinn_conf,
  )
  install_data(cinnamon_jhbuild,
    install_mode: 'rwxr-xr-x',
    install_dir: get_option('bindir'),
  )
endif

cinnamon_exename = use_jhbuild_wrapper_script ? 'cinnamon-real' : 'cinnamon'

cinnamon = executable(cinnamon_exename,
  'main.c',
  include_directories: [ rootInclude, stInclude, ],
  dependencies: cinnamon_deps,
  link_with: libcinnamon,
  install: true,
  install_rpath: join_paths(get_option('prefix'), pkglibdir),
)



cinnamon_extension_tool = configure_file(
  input : 'cinnamon-extension-tool.in',
  output: 'cinnamon-extension-tool',
  configuration: cinn_conf,
)

# install_data(cinnamon_extension_tool,
#   install_dir: get_option('bindir'),
#   install_mode: 'rwxr-xr-x',
# )

cinnamon_perf_helper = executable('cinnamon-perf-helper',
  'cinnamon-perf-helper.c',
  include_directories: rootInclude,
  dependencies: [
    gtk3,
    gio,
  ],
  install: true,
  install_dir: libexecdir,
)

test('run-js',
  executable('run-js-test',
    'run-js-test.c',
    include_directories: rootInclude,
    link_with: libcinnamon,
    dependencies: [
      cjs,
      clutter,
      gobject,
      libmuffin,
    ],
    install: false,
  ),
)


st_gir = gnome.generate_gir(libcinnamon,
  namespace: 'St',
  nsversion: '1.0',
  extra_args: [
    '-DST_COMPILATION',
  ],
  sources: [
    st_headers,
  ],
  includes: [
    'Clutter-1.0',
    'Gtk-3.0',
  ],
  include_directories: [
    include_directories('.'),
  ],
  # dependencies: deps to use during introspection scanning
  # export_packages: extra packages the gir file exports
  # header: (Added 0.43.0) name of main c header to include for the library, e.g. glib.h
  # identifier_prefix: the identifier prefix for the gir object, e.g. Gtk
  # install_dir_gir: (Added 0.35.0) which directory to install the gir file into
  # install_dir_typelib: (Added 0.35.0) which directory to install the typelib file into
  # install: if true, install the generated files
  # link_with: list of libraries to link with
  # symbol_prefix: the symbol prefix for the gir object, e.g. gtk, (Since 0.43.0) an ordered list of multiple prefixes is allowed
)

gnome.generate_gir(libcinnamon,
  namespace: 'Cinnamon',
  nsversion: '0.1',
  sources: [
    cinnamon_headers,
    cinnamon_sources,
  ],
  includes: [
    'Clutter-1.0',
    'ClutterX11-1.0',
    'CMenu-3.0',
    'Meta-Muffin.0',
    'NetworkManager-1.0',
    'NMClient-1.0',
    'Soup-2.4',
    st_gir[0],
  ],
  include_directories: srcInclude,

  # dependencies: deps to use during introspection scanning
  # extra_args: command line arguments to pass to gir compiler
  # export_packages: extra packages the gir file exports
  # identifier_prefix: the identifier prefix for the gir object, e.g. Gtk
  # header: (Added 0.43.0) name of main c header to include for the library, e.g. glib.h
  # dependencies: deps to use during introspection scanning
  # include_directories: extra include paths to look for gir files
  install: true,
  # install_dir_gir: (Added 0.35.0) which directory to install the gir file into
  # install_dir_typelib: (Added 0.35.0) which directory to install the typelib file into
  # link_with: list of libraries to link with
  # symbol_prefix: the symbol prefix for the gir object, e.g. gtk, (Since 0.43.0) an ordered list of multiple prefixes is allowed
)
