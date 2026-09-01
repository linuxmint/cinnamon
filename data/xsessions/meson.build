session_desktop_files = [
  'cinnamon.desktop',
]

foreach session_desktop_file : session_desktop_files
    configure_file(
        input: session_desktop_file + '.in',
        output: session_desktop_file,
        configuration: desktop_conf,
        install_dir: x_sessiondir
    )
endforeach
