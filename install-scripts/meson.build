# These scripts run as post-installation scripts.

# They're designed to do nothing if DESTDIR is set, which happens
# during debian builds for instance - there's a fake install target
# so running these would be pointless.

# When using deb packaging, these aren't needed, as these operations
# are run automatically by the package manager.

# They're really only necessary in straight builds where 'ninja install'
# will be run directly, to install the program onto the system.


# Re-compile gsettings
meson.add_install_script('meson_install_schemas.py')

# Update the Gtk icon cache
meson.add_install_script('meson_update_icon_cache.py')

# Add a symlink to applications-merged
meson.add_install_script('add_symlink.py')
