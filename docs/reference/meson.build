version_conf = configuration_data()
version_conf.set('VERSION', version)

configure_file(
    input: 'version.xml.in',
    output: 'version.xml',
    configuration: version_conf,
)

subdir('cinnamon')
subdir('cinnamon-js')
subdir('cinnamon-tutorials')
subdir('st')
