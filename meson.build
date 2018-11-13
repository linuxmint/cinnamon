# https://github.com/linuxmint/cinnamon
project('cinnamon', 'c',
  version: '4.0.1',
  meson_version: '>=0.42.0',
  default_options: [
    'sysconfdir=/etc',
  ],
)

################################################################################
i18n = import('i18n')
gnome = import('gnome')
pkgconfig = import('pkgconfig')

cc = meson.get_compiler('c')


prefix = get_option('prefix')



conf = configuration_data()
# Surround the version in quotes to make it a C string
conf.set_quoted ('GETTEXT_NAME',    meson.project_name())
conf.set_quoted ('GETTEXT_PACKAGE', meson.project_name())
conf.set        ('PACKAGE_NAME',    meson.project_name())
conf.set        ('PACKAGE_VERSION', meson.project_version())


################################################################################
# Find dependencies

math            = cc.find_library('m')

atk_bridge      = dependency('atk-bridge-2.0')
cinnamon_desktop= dependency('cinnamon-desktop',            version: '>=2.4.0')
cjs             = dependency('cjs-1.0',                     version: '>=3.2.0')
muffin_clutter  = dependency('muffin-clutter-0')
muffin_coglpango= dependency('muffin-cogl-pango-0')
muffin_coglpath = dependency('muffin-cogl-path-0')
muffin_cogl     = dependency('muffin-cogl-0')
# clutter_x11     = dependency('clutter-x11-1.0',             version: '>=1.10.0')
dbus_glib       = dependency('dbus-glib-1')
gdk_pixbuf      = dependency('gdk-pixbuf-2.0')
gdk_x11         = dependency('gdk-x11-3.0')
gio             = dependency('gio-2.0',                     version: '>=2.35.0')
gio_unix        = dependency('gio-unix-2.0')
gl              = dependency('gl')
gobject         = dependency('gobject-introspection-1.0',   version: '>=0.9.2')
gstreamer       = dependency('gstreamer-1.0',               version: '>=0.11.92')
gstreamer_base  = dependency('gstreamer-base-1.0',          version: '>=0.11.92')
gtk3            = dependency('gtk+-3.0',                    version: '>=3.12.0')
libcinnamon_menu= dependency('libcinnamon-menu-3.0')
libcroco        = dependency('libcroco-0.6',                version: '>=0.6.2')
libmuffin       = dependency('libmuffin',                   version: '>=3.5.0')
libnm_glib      = dependency('libnm-glib')
libnm_util      = dependency('libnm-util')
libsoup         = dependency('libsoup-2.4')
libstartup_notif= dependency('libstartup-notification-1.0', version: '>=0.11')
libxml          = dependency('libxml-2.0')
polkit_agent    = dependency('polkit-agent-1',              version: '>=0.100')
x11             = dependency('x11')
xfixes          = dependency('xfixes')

gdmuser_deps = [
  dbus_glib,
  gtk3,
]

conf.set('GJS_VERSION', cjs.version())
gjs_console = cjs.get_pkgconfig_variable('cjs_console')

muffin_gir_dir     = libmuffin.get_pkgconfig_variable('girdir')
muffin_typelib_dir = libmuffin.get_pkgconfig_variable('typelibdir')


conf.set('HAVE_MALLINFO', cc.has_function('mallinfo'))

# Check for HAVE__NL_TIME_FIRST_WEEKDAY to be an enum, not a define.

check_nl = cc.compiles('''
#include <langinfo.h>
int main() {
  nl_langinfo(_NL_TIME_FIRST_WEEKDAY);
  return 0;
}
''')
conf.set('HAVE__NL_TIME_FIRST_WEEKDAY', check_nl)

enable_gtkdoc = get_option('gtkdoc')

# TODO is this still used ?
ca_certif_path= get_option('ca-certificates')

test = find_program('test')
if ca_certif_path == ''
  path_ssl = '/etc/ssl/certs/ca-certificates.crt'
  path_pki = '/etc/pki/tls/certs/ca-bundle.crt'
  if   run_command('ls', path_ssl).returncode() == 0
    ca_certif_path = path_ssl
  elif run_command('ls', path_pki).returncode() == 0
    ca_certif_path = path_pki
  else
    error('\n'.join(['',
      'Usual paths for ca-certificates do not exist:',
      '* ' + path_ssl,
      '* ' + path_pki,
      'Please specifiy a ca-certificates path.',
    ]))
  endif
else
  if run_command('ls', ca_certif_path).returncode() != 0
    error('\n'.join(['',
      'Specified path for ca-certificates does not exist:',
      ca_certif_path,
      'Please specifiy a valid ca-certificates path.',
    ]))
  endif
endif

conf.set('CINNAMON_SYSTEM_CA_FILE', ca_certif_path)

conf.set('HAVE_XFIXESCREATEPOINTERBARRIER', cc.has_function(
  'XFixesCreatePointerBarrier',
  dependencies: xfixes,
) ? 1 : false)
conf.set('HAVE_SYS_RESOURCE_H', cc.has_header('sys/resource.h'))
conf.set('HAVE_FDWALK', cc.has_function('fdwalk'))



pkglibdir  = join_paths(get_option('libdir'),     meson.project_name())
libexecdir = join_paths(pkglibdir, meson.project_name())
# libexecdir = join_paths(get_option('libexecdir'), meson.project_name())
pkgdatadir = join_paths(get_option('datadir'),    meson.project_name())



conf.set_quoted('CINNAMON_DATADIR',       join_paths(get_option('prefix'), pkgdatadir))
conf.set_quoted('CINNAMON_LIBEXECDIR',    join_paths(get_option('prefix'), get_option('libexecdir')))
conf.set_quoted('CINNAMON_PKGLIBDIR',     join_paths(get_option('prefix'), pkglibdir))
conf.set_quoted('CINNAMON_PKGLIBEXECDIR', join_paths(get_option('prefix'), libexecdir))
conf.set_quoted('DATADIR',                join_paths(get_option('prefix'), get_option('datadir')))
conf.set_quoted('JSDIR',                  join_paths(get_option('prefix'), pkgdatadir, 'js'))
conf.set_quoted('LIBDIR',                 join_paths(get_option('prefix'), get_option('libdir')))
conf.set_quoted('LOCALEDIR',              join_paths(get_option('prefix'), get_option('localedir')))
conf.set_quoted('PACKAGE_DATA_DIR',       join_paths(get_option('prefix'), pkgdatadir))
conf.set_quoted('PREFIX',                 join_paths(get_option('prefix')))
conf.set_quoted('VERSION',    meson.project_version())

configure_file(
  output: 'config.h',
  configuration: conf
)

add_project_arguments([
    '-DHAVE_CONFIG_H',
    '-DCLUTTER_DISABLE_DEPRECATION_WARNINGS',
    '-DCLUTTER_ENABLE_EXPERIMENTAL_API',
    '-DCOGL_DISABLE_DEPRECATION_WARNINGS',
    '-DCOGL_ENABLE_EXPERIMENTAL_2_0_API',
    '-DCOGL_ENABLE_EXPERIMENTAL_API',
    '-DG_DISABLE_DEPRECATED',
  ],
  language: 'c'
)

rootInclude = include_directories('.')

subdir('data')
# subdir('docs')
subdir('files')
subdir('js')
subdir('man')
subdir('po')
subdir('src')
subdir('tests')
