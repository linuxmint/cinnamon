service_files = [
  'org.Cinnamon.Melange.service',
  'org.Cinnamon.Slideshow.service',
]

foreach service_file : service_files
    configure_file(
        input: service_file + '.in',
        output: service_file,
        configuration: desktop_conf,
        install_dir: servicedir
    )
endforeach
