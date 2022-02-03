st_headers = [
    'st-adjustment.h',
    'st-background-effect.h',
    'st-bin.h',
    'st-border-image.h',
    'st-box-layout.h',
    'st-box-layout-child.h',
    'st-button.h',
    'st-clipboard.h',
    'st-drawing-area.h',
    'st-entry.h',
    'st-focus-manager.h',
    'st-group.h',
    'st-icon.h',
    'st-icon-colors.h',
    'st-im-text.h',
    'st-label.h',
    'st-polygon.h',
    'st-private.h',
    'st-scrollable.h',
    'st-scroll-bar.h',
    'st-scroll-view.h',
    'st-scroll-view-fade.h',
    'st-settings.h',
    'st-shadow.h',
    'st-table.h',
    'st-table-child.h',
    'st-texture-cache.h',
    'st-theme.h',
    'st-theme-context.h',
    'st-theme-node.h',
    'st-types.h',
    'st-widget.h',
    'st-widget-accessible.h',
    'st-cogl-wrapper.h',
]

st_non_gir = [
    'croco/cr-additional-sel.c',
    'croco/cr-attr-sel.c',
    'croco/cr-cascade.c',
    'croco/cr-declaration.c',
    'croco/cr-doc-handler.c',
    'croco/cr-enc-handler.c',
    'croco/cr-fonts.c',
    'croco/cr-input.c',
    'croco/cr-num.c',
    'croco/cr-om-parser.c',
    'croco/cr-parser.c',
    'croco/cr-parsing-location.c',
    'croco/cr-prop-list.c',
    'croco/cr-pseudo.c',
    'croco/cr-rgb.c',
    'croco/cr-selector.c',
    'croco/cr-simple-sel.c',
    'croco/cr-statement.c',
    'croco/cr-string.c',
    'croco/cr-stylesheet.c',
    'croco/cr-term.c',
    'croco/cr-tknzr.c',
    'croco/cr-token.c',
    'croco/cr-utils.c',
]

st_private_headers = [
    'croco/cr-additional-sel.h',
    'croco/cr-attr-sel.h',
    'croco/cr-cascade.h',
    'croco/cr-declaration.h',
    'croco/cr-doc-handler.h',
    'croco/cr-enc-handler.h',
    'croco/cr-fonts.h',
    'croco/cr-input.h',
    'croco/cr-num.h',
    'croco/cr-om-parser.h',
    'croco/cr-parser.h',
    'croco/cr-parsing-location.h',
    'croco/cr-prop-list.h',
    'croco/cr-pseudo.h',
    'croco/cr-rgb.h',
    'croco/cr-selector.h',
    'croco/cr-simple-sel.h',
    'croco/cr-statement.h',
    'croco/cr-string.h',
    'croco/cr-stylesheet.h',
    'croco/cr-term.h',
    'croco/cr-tknzr.h',
    'croco/cr-token.h',
    'croco/cr-utils.h',
    'croco/libcroco-config.h',
    'croco/libcroco.h',
    'st-private.h',
    'st-table-private.h',
    'st-theme-private.h',
    'st-theme-node-private.h',
    'st-theme-node-transition.h',
]

st_gir_sources = [
    'st-adjustment.c',
    'st-background-effect.c',
    'st-bin.c',
    'st-border-image.c',
    'st-box-layout.c',
    'st-box-layout-child.c',
    'st-button.c',
    'st-clipboard.c',
    'st-cogl-wrapper.c',
    'st-drawing-area.c',
    'st-entry.c',
    'st-focus-manager.c',
    'st-group.c',
    'st-icon.c',
    'st-icon-colors.c',
    'st-im-text.c',
    'st-label.c',
    'st-polygon.c',
    'st-private.c',
    'st-scrollable.c',
    'st-scroll-bar.c',
    'st-scroll-view.c',
    'st-scroll-view-fade.c',
    'st-settings.c',
    'st-shadow.c',
    'st-table.c',
    'st-table-child.c',
    'st-texture-cache.c',
    'st-theme.c',
    'st-theme-context.c',
    'st-theme-node.c',
    'st-theme-node-drawing.c',
    'st-theme-node-transition.c',
    'st-widget.c',
    st_headers,
]

st_enum_types = gnome.mkenums_simple(
    'st-enum-types',
    sources: st_headers,
)
st_gir_sources += st_enum_types

st_sources = [
    st_gir_sources,
    st_non_gir,
]

st_include_list = []
foreach include : st_headers
  st_include_list += '#include <@0@>'.format(include)
endforeach

st_includes = configuration_data()
st_includes.set('includes', '\n'.join(st_include_list))

st_h = configure_file(
    input: 'st.h.in',
    output: 'st.h',
    configuration: st_includes,
)

libst_deps = [
    clutter,
    cogl,
    cogl_path,
    config_h,
    gio,
    glib,
    gtk,
    math,
    muffin,
]

libst = library(
    'st',
    st_sources,
    c_args: [
        '-DST_H_INSIDE',
        '-DG_LOG_DOMAIN="St"'
    ],
    build_rpath: muffinlibdir,
    install_rpath: muffinlibdir,
    include_directories: include_root,
    dependencies: libst_deps,
    install: true,
    install_dir: pkglibdir,
)

st_dep = declare_dependency(
    include_directories: include_directories('.', 'croco'),
    dependencies: libst_deps,
    sources: st_enum_types[1],
    link_with: libst,
    link_args: ['-Wl,-Bsymbolic', '-Wl,-z,relro', '-Wl,-z,now'],
)

st_gir_includes = [
    'Clutter-0',
    'ClutterX11-0',
    'Meta-Muffin.0',
    'Gtk-3.0',
]

st_gir = gnome.generate_gir(
    libst,
    namespace: 'St',
    nsversion: '1.0',
    sources: st_gir_sources,
    dependencies: libst_deps,
    identifier_prefix: 'St',
    symbol_prefix: 'st',
    export_packages: 'st',
    includes: st_gir_includes,
    install: true,
    install_dir_typelib: pkglibdir,
    install_dir_gir: false,
    extra_args: [
        '-DST_COMPILATION',
        '--quiet',
    ],
)
