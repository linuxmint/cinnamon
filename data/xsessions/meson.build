session_deskop_files = [
  'cinnamon.desktop',
  'cinnamon2d.desktop',
]

foreach session_deskop_file : session_deskop_files
    configure_file(
        input: session_deskop_file + '.in',
        output: session_deskop_file,
        configuration: desktop_conf,
        install_dir: x_sessiondir
    )
endforeach
