# Screensaver authentication library
screensaver_sources = [
    'cs-auth-pam.c',
    'setuid.c',
    'subprocs.c',
]

libcinnamon_screensaver = static_library(
    'cinnamon_screensaver',
    screensaver_sources,
    include_directories: include_root,
    dependencies: [glib, gio, gio_unix, pam],
)

# PAM helper executable
executable(
    'cinnamon-screensaver-pam-helper',
    'cinnamon-screensaver-pam-helper.c',
    link_with: libcinnamon_screensaver,
    include_directories: include_root,
    dependencies: [glib, gio, gio_unix],
    install: true,
    install_dir: libexecdir,
)

subdir('backup-locker')
