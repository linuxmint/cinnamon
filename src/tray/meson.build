
trayInclude = include_directories('.')

libcinnamon_tray = static_library('cinnamon-tray',
  [
    'na-tray-child.c',
    'na-tray-manager.c',
  ],
  dependencies: [
    gtk3,
    x11,
  ],
  include_directories: [ rootInclude, ],
  c_args: [
    '-DG_LOG_DOMAIN="notification_area"',
  ],
)
