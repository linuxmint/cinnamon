# The wallpaper painter - GTK4

background_daemon_sources = [
    'bg-accounts.c',
    'bg-geometry.c',
    'bg-renderer.c',
    'bg-x11.c',
    'cinnamon-background-daemon.c',
    background_generated,
]

background_daemon_deps = [
    config_h,
    gtk4,
    cairo_xlib,
    X11,
    libcinnamon_bg_dep,
    math,
]

if get_option('wayland')
    background_daemon_sources += ['bg-wayland.c']
    background_daemon_deps += [gtk4_layer_shell]
endif

executable(
    'cinnamon-background-daemon',
    background_daemon_sources,
    include_directories: include_root,
    dependencies: background_daemon_deps,
    c_args: ['-DG_LOG_DOMAIN="cinnamon-background-daemon"'],
    install: true,
    install_dir: libexecdir,
    install_rpath: pkglibdir,
)

background_service_conf = configuration_data()
background_service_conf.set('LIBEXECDIR', join_paths(prefix, libexecdir))
configure_file(
    input: 'org.Cinnamon.Background.service.in',
    output: 'org.Cinnamon.Background.service',
    configuration: background_service_conf,
    install_dir: servicedir,
)
