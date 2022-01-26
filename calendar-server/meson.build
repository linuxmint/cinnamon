
server_launcher_conf = configuration_data()
server_launcher_conf.set('MUFFINLIBDIR', muffin_typelibdir)
server_launcher_conf.set('PKGLIBDIR', join_paths(prefix, pkglibdir))
server_launcher_conf.set('LIBEXECDIR', join_paths(prefix, libexecdir))

launcher = configure_file(
    input: 'cinnamon-calendar-server.in',
    output: 'cinnamon-calendar-server',
    configuration: server_launcher_conf,
    install_dir: bindir,
    install_mode: 'rwxr-xr-x'
)

service_conf = configuration_data()
service_conf.set('BINDIR', join_paths(prefix, bindir))

launcher = configure_file(
    input: 'org.cinnamon.CalendarServer.service.in',
    output: 'org.cinnamon.CalendarServer.service',
    configuration: service_conf,
    install_dir: dbus_services_dir
)

install_data(
    'cinnamon-calendar-server.py',
    install_dir: libexecdir,
    install_mode: 'rwxr-xr-x'
)

