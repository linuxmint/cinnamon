pymodule = import('python')

python3 = pymodule.find_installation('python3')

install_path = python3.get_install_dir()
if get_option('py3modules_dir') != ''
  install_path = get_option('py3modules_dir')
endif

message('Installing python modules to: @0@'.format(install_path))

# python3.install_sources says it accepts the same args as install_data, but it doesn't
# recognize install_dir.
install_data(
  [
    'cinnamon/__init__.py',
    'cinnamon/harvester.py',
    'cinnamon/logger.py',
    'cinnamon/proxygsettings.py',
    'cinnamon/updates.py'
  ],
  install_dir: join_paths(install_path, 'cinnamon'),
)
