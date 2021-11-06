
server_launcher_conf = configuration_data()
server_launcher_conf.set('muffinlibdir', muffinlibdir)
server_launcher_conf.set('pkglibdir', join_paths(prefix, pkglibdir))

launcher = configure_file(
    input: 'cinnamon-calendar-server.in',
    output: 'cinnamon-calendar-server',
    configuration: server_launcher_conf,
    install_dir: bindir,
    install_mode: 'rwxr-xr-x'
)

install_data(
    'cinnamon-calendar-server.py',
    install_dir: libexecdir,
    install_mode: 'rwxr-xr-x'
)

