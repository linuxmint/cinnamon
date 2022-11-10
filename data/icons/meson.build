icons = run_command('find_icons.sh', check: true).stdout().strip().split()

# double-click, drag-click, right-click, single-click icons imported from mousetweaks
# (git@github.com:GNOME/mousetweaks.git)

foreach icon : icons
    parts = icon.split('_')
    theme = parts[0]
    category = parts[1]
    icontype = parts[2]
    filename = parts[3]

    install_data(
        icon,
        rename: filename,
        install_dir: join_paths(datadir, 'icons', theme, icontype, category),
    )
endforeach
