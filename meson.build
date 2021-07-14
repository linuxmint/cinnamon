project('Cinnamon', 'c', version : '5.0.5', meson_version : '>=0.46.0')

gnome = import('gnome')
i18n = import('i18n')

version = meson.project_version()

# directories
prefix = get_option('prefix')
bindir = get_option('bindir')
datadir = get_option('datadir')
libdir = get_option('libdir')
includedir = get_option('includedir')
libexecdir = get_option('libexecdir')
desktopdir = join_paths(datadir, 'applications')
schemadir = join_paths(datadir, 'glib-2.0', 'schemas')
pkglibdir = join_paths(libdir, meson.project_name().to_lower())
servicedir = join_paths(datadir, 'dbus-1', 'services')
pkgdatadir = join_paths(datadir, meson.project_name().to_lower())
po_dir = join_paths(meson.source_root(), 'po')

# dependencies
cjs = dependency('cjs-1.0', version: '>= 4.8.0')
clutter = dependency('muffin-clutter-0')
cmenu = dependency('libcinnamon-menu-3.0', version: '>= 4.8.0')
cogl = dependency('muffin-cogl-0')
cogl_path = dependency('muffin-cogl-path-0')
dbus = dependency('dbus-1')
gdkx11 = dependency('gdk-x11-3.0')
gi = dependency('gobject-introspection-1.0', version: '>= 0.9.2')
polkit = dependency('polkit-agent-1', version: '>= 0.100')
xfixes = dependency('xfixes')
atk = dependency('atk-bridge-2.0')
gio = dependency('gio-2.0', version: '>= 2.36.0')
gio_unix = dependency('gio-unix-2.0')
gl = dependency('gl')
glib_version = '2.52.0'
glib = dependency('glib-2.0', version: '>= ' + glib_version)
gtk = dependency('gtk+-3.0', version: '>= 3.12.0')
muffin = dependency('libmuffin', version: '>= 4.0.3')
muffinlibdir = muffin.get_pkgconfig_variable('typelibdir')
pango = dependency('muffin-cogl-pango-0')
sn = dependency('libstartup-notification-1.0')
soup = dependency('libsoup-2.4')
X11 = dependency('x11')
xml = dependency('libxml-2.0')

has_nm = not get_option('disable_networkmanager')
if has_nm
    # only ever used in *.js via gi import
    dependency('libnm')
endif

if get_option('build_recorder')
	gstreamer = dependency('gstreamer-1.0')
	gstreamer_base = dependency('gstreamer-base-1.0')
else
	gstreamer = dependency('', required: false)
	gstreamer_base = dependency('', required: false)
endif

# on some systems we need to find the math lib to make sure it builds
cc = meson.get_compiler('c')
math = cc.find_library('m', required: false)

intltool_merge = find_program('intltool-merge')
python = find_program('python3')

# generate config.h
cinnamon_conf = configuration_data()
cinnamon_conf.set_quoted('VERSION', version)
cinnamon_conf.set_quoted('GETTEXT_PACKAGE', meson.project_name().to_lower())

have_xfixes = cc.has_function('XFixesCreatePointerBarrier', dependencies: xfixes)
if have_xfixes
    cinnamon_conf.set10('HAVE_XFIXESCREATEPOINTERBARRIER', true)
endif

have_mallinfo = cc.has_function('mallinfo', prefix: '#include <malloc.h>')
if have_mallinfo
    cinnamon_conf.set10('HAVE_MALLINFO', true)
endif

langinfo_test = '''
#include <langinfo.h>
int main () {
    nl_langinfo(_NL_TIME_FIRST_WEEKDAY);
}
'''
have_nl_time_first_weekday = cc.compiles(
    langinfo_test,
    name : 'langinfo _NL_TIME_FIRST_WEEKDAY check')

if have_nl_time_first_weekday
    cinnamon_conf.set10('HAVE__NL_TIME_FIRST_WEEKDAY', true)
endif

config_h_file = configure_file(
    output : 'config.h',
    configuration : cinnamon_conf
)

config_h = declare_dependency(
    sources: config_h_file
)

# includes
include_root = include_directories('.')

# compiler flags
c_args = [
    '-DDATADIR="@0@"'.format(join_paths(prefix, datadir)),
    '-DLIBDIR="@0@"'.format(join_paths(prefix, libdir)),
    '-DBINDIR="@0@"'.format(join_paths(prefix, bindir)),
    '-DCINNAMON_DATADIR="@0@"'.format(join_paths(prefix, pkgdatadir)),
    '-DJSDIR="@0@/js"'.format(join_paths(prefix, pkgdatadir)),
    '-DMUFFIN_TYPELIB_DIR="@0@"'.format(muffinlibdir),
]

if not get_option('deprecated_warnings')
    c_args += [
        '-Wno-deprecated-declarations',
        '-Wno-deprecated',
        '-Wno-declaration-after-statement',
    ]
endif

add_global_arguments(c_args, language: 'c')

subdir('data')
subdir('src')
# tests are not currently functional
# subdir('tests')
subdir('docs/reference')

install_subdir(
    'js',
    exclude_files: ['misc/config.js.in'],
    install_dir: join_paths(datadir, meson.project_name().to_lower()),
)

config_js_conf = configuration_data()
config_js_conf.set('PACKAGE_NAME', meson.project_name().to_lower())
config_js_conf.set('PACKAGE_VERSION', version)

configure_file(
    input: 'js/misc/config.js.in',
    output: 'config.js',
    configuration: config_js_conf,
    install_dir: 'share/cinnamon/js/misc/'
)

install_subdir(
    'files',
    install_dir: '/',
    strip_directory: true,
)

session_conf = configuration_data()
if has_nm
    session_conf.set('REQUIRED', 'nm-applet;')
else
    session_conf.set('REQUIRED', '')
endif

foreach file : ['cinnamon.session', 'cinnamon2d.session']
    configure_file(
        input: file + '.in',
        output: file,
        configuration: session_conf,
        install_dir: join_paths(prefix, datadir, 'cinnamon-session', 'sessions'),
    )
endforeach

install_subdir(
    'man',
    install_dir: join_paths(prefix, get_option('mandir'), 'man1'),
    strip_directory: true,
)

subdir('python3')
subdir('install-scripts')
