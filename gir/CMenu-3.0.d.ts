/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.CMenu {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DesktopAppInfo} instead.
	 */
	interface IDesktopAppInfo {
		/**
		 * Gets the user-visible display name of the "additional application
		 * action" specified by #action_name.
		 * 
		 * This corresponds to the "Name" key within the keyfile group for the
		 * action.
		 * @param action_name the name of the action as from
		 *   {@link CMenu.DesktopAppInfo.list_actions}
		 * @returns the locale-specific action name
		 */
		get_action_name(action_name: string): string;
		/**
		 * Looks up a boolean value in the keyfile backing #info.
		 * 
		 * The #key is looked up in the "Desktop Entry" group.
		 * @param key the key to look up
		 * @returns the boolean value, or %FALSE if the key
		 *     is not found
		 */
		get_boolean(key: string): boolean;
		/**
		 * Gets the categories from the desktop file.
		 * @returns The unparsed Categories key from the desktop file;
		 *     i.e. no attempt is made to split it by ';' or validate it.
		 */
		get_categories(): string;
		/**
		 * When #info was created from a known filename, return it.  In some
		 * situations such as the #GMenuDesktopAppInfo returned from
		 * {@link CMenu.DesktopAppInfo.new_from_keyfile}, this function will return %NULL.
		 * @returns The full path to the file for #info,
		 *     or %NULL if not known.
		 */
		get_filename(): string;
		/**
		 * This function looks up the "X-Flatpak" key of the [Desktop Entry] group,
		 * which contains the Flatpak App ID
		 * @returns the flatpak app id or %NULL
		 */
		get_flatpak_app_id(): string | null;
		/**
		 * Gets the generic name from the destkop file.
		 * @returns The value of the GenericName key
		 */
		get_generic_name(): string;
		get_is_flatpak(): boolean;
		/**
		 * A desktop file is hidden if the Hidden key in it is
		 * set to True.
		 * @returns %TRUE if hidden, %FALSE otherwise.
		 */
		get_is_hidden(): boolean;
		/**
		 * Gets the keywords from the desktop file.
		 * @returns The value of the Keywords key
		 */
		get_keywords(): string[];
		/**
		 * Looks up a localized string value in the keyfile backing #info
		 * translated to the current locale.
		 * 
		 * The #key is looked up in the "Desktop Entry" group.
		 * @param key the key to look up
		 * @returns a newly allocated string, or %NULL if the key
		 *     is not found
		 */
		get_locale_string(key: string): string | null;
		/**
		 * Gets the value of the NoDisplay key, which helps determine if the
		 * application info should be shown in menus. See
		 * #G_KEY_FILE_DESKTOP_KEY_NO_DISPLAY and {@link Gio.AppInfo.should_show}.
		 * @returns The value of the NoDisplay key
		 */
		get_nodisplay(): boolean;
		/**
		 * Checks if the application info should be shown in menus that list available
		 * applications for a specific name of the desktop, based on the
		 * `OnlyShowIn` and `NotShowIn` keys.
		 * 
		 * #desktop_env should typically be given as %NULL, in which case the
		 * `XDG_CURRENT_DESKTOP` environment variable is consulted.  If you want
		 * to override the default mechanism then you may specify #desktop_env,
		 * but this is not recommended.
		 * 
		 * Note that {@link Gio.AppInfo.should_show} for #info will include this check (with
		 * %NULL for #desktop_env) as well as additional checks.
		 * @param desktop_env a string specifying a desktop name
		 * @returns %TRUE if the #info should be shown in #desktop_env according to the
		 * `OnlyShowIn` and `NotShowIn` keys, %FALSE
		 * otherwise.
		 */
		get_show_in(desktop_env?: string | null): boolean;
		/**
		 * Retrieves the StartupWMClass field from #info. This represents the
		 * WM_CLASS property of the main window of the application, if launched
		 * through #info.
		 * 
		 * Note: The returned value contain the suffix ":flatpak" if #info specifies a flatpak app
		 * and if the desktop file has a StartupWMClass
		 * @returns the startup WM class, or %NULL if none is set
		 * in the desktop file.
		 */
		get_startup_wm_class(): string;
		/**
		 * Looks up a string value in the keyfile backing #info.
		 * 
		 * The #key is looked up in the "Desktop Entry" group.
		 * @param key the key to look up
		 * @returns a newly allocated string, or %NULL if the key
		 *     is not found
		 */
		get_string(key: string): string;
		/**
		 * Returns whether #key exists in the "Desktop Entry" group
		 * of the keyfile backing #info.
		 * @param key the key to look up
		 * @returns %TRUE if the #key exists
		 */
		has_key(key: string): boolean;
		/**
		 * Activates the named application action.
		 * 
		 * You may only call this function on action names that were
		 * returned from {@link Gio.DesktopAppInfo.list_actions}.
		 * 
		 * Note that if the main entry of the desktop file indicates that the
		 * application supports startup notification, and #launch_context is
		 * non-%NULL, then startup notification will be used when activating the
		 * action (and as such, invocation of the action on the receiving side
		 * must signal the end of startup notification when it is completed).
		 * This is the expected behaviour of applications declaring additional
		 * actions, as per the desktop file specification.
		 * 
		 * As with g_app_info_launch() there is no way to detect failures that
		 * occur while using this function.
		 * @param action_name the name of the action as from
		 *   {@link Gio.DesktopAppInfo.list_actions}
		 * @param launch_context a #GAppLaunchContext
		 */
		launch_action(action_name: string, launch_context?: Gio.AppLaunchContext | null): void;
		/**
		 * This function performs the equivalent of {@link Gio.AppInfo.launch_uris},
		 * but is intended primarily for operating system components that
		 * launch applications.  Ordinary applications should use
		 * g_app_info_launch_uris().
		 * 
		 * If the application is launched via GSpawn, then #spawn_flags, #user_setup
		 * and #user_setup_data are used for the call to g_spawn_async().
		 * Additionally, #pid_callback (with #pid_callback_data) will be called to
		 * inform about the PID of the created process. See g_spawn_async_with_pipes()
		 * for information on certain parameter conditions that can enable an
		 * optimized posix_spawn() codepath to be used.
		 * 
		 * If application launching occurs via some other mechanism (eg: D-Bus
		 * activation) then #spawn_flags, #user_setup, #user_setup_data,
		 * #pid_callback and #pid_callback_data are ignored.
		 * @param uris List of URIs
		 * @param launch_context a #GAppLaunchContext
		 * @param spawn_flags #GSpawnFlags, used for each process
		 * @returns %TRUE on successful launch, %FALSE otherwise.
		 */
		launch_uris_as_manager(uris: string[], launch_context: Gio.AppLaunchContext | null, spawn_flags: GLib.SpawnFlags): boolean;
		/**
		 * Returns the list of "additional application actions" supported on the
		 * desktop file, as per the desktop file specification.
		 * 
		 * As per the specification, this is the list of actions that are
		 * explicitly listed in the "Actions" key of the [Desktop Entry] group.
		 * @returns a list of strings, always non-%NULL
		 */
		list_actions(): string[];
	}

	type DesktopAppInfoInitOptionsMixin = GObject.ObjectInitOptions & Gio.AppInfoInitOptions
	export interface DesktopAppInfoInitOptions extends DesktopAppInfoInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DesktopAppInfo} instead.
	 */
	type DesktopAppInfoMixin = IDesktopAppInfo & GObject.Object & Gio.AppInfo;

	interface DesktopAppInfo extends DesktopAppInfoMixin {}

	class DesktopAppInfo {
		public constructor(options?: Partial<DesktopAppInfoInitOptions>);
		/**
		 * This is currently unused in Cinnamon and does not make sense here
		 * because the desktop id as used here is not necessarily unique
		 * @param desktop_id the desktop file id
		 * @returns %NULL
		 */
		public static new(desktop_id: string): DesktopAppInfo | null;
		/**
		 * Creates a new #GMenuDesktopAppInfo.
		 * @param filename the path of a desktop file, in the GLib
		 *      filename encoding
		 * @returns a new #GMenuDesktopAppInfo or %NULL on error.
		 */
		public static new_from_filename(filename: string): DesktopAppInfo | null;
		/**
		 * Creates a new #GMenuDesktopAppInfo.
		 * @param key_file an opened #GKeyFile
		 * @returns a new #GMenuDesktopAppInfo or %NULL on error.
		 */
		public static new_from_keyfile(key_file: GLib.KeyFile): DesktopAppInfo | null;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Tree} instead.
	 */
	interface ITree {
		/**
		 * Flags controlling the content of the menu.
		 */
		flags: TreeFlags;
		/**
		 * The name of the menu file; must be a basename or a relative path. The file
		 * will be looked up in $XDG_CONFIG_DIRS/menus/. See the Desktop Menu
		 * specification.
		 */
		menu_basename: string;
		/**
		 * The full path of the menu file. If set, GMenuTree:menu-basename will get
		 * ignored.
		 */
		menu_path: string;
		/**
		 * This function is only available if the tree has been loaded via
		 * {@link CMenu.Tree.load_sync} or a variant thereof.
		 * @returns The absolute and canonicalized path to the loaded menu file
		 */
		get_canonical_menu_path(): string;
		get_directory_from_path(path: string): TreeDirectory;
		/**
		 * Look up the entry corresponding to the given "desktop file id".
		 * @param id a desktop file ID
		 * @returns A newly referenced #GMenuTreeEntry, or %NULL if none
		 */
		get_entry_by_id(id: string): TreeEntry;
		/**
		 * Get the root directory; you must have loaded the tree first (at
		 * least once) via {@link CMenu.Tree.load_sync} or a variant thereof.
		 * @returns Root of the tree
		 */
		get_root_directory(): TreeDirectory;
		/**
		 * Synchronously load the menu contents.  This function
		 * performs a significant amount of blocking I/O if the
		 * tree has not been loaded yet.
		 * @returns %TRUE on success, %FALSE on error
		 */
		load_sync(): boolean;
		connect(signal: "changed", callback: (owner: this) => void): number;

		connect(signal: "notify::flags", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::menu-basename", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::menu-path", callback: (owner: this, ...args: any) => void): number;

	}

	type TreeInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<ITree,
		"flags" |
		"menu_basename" |
		"menu_path">;

	export interface TreeInitOptions extends TreeInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Tree} instead.
	 */
	type TreeMixin = ITree & GObject.Object;

	interface Tree extends TreeMixin {}

	class Tree {
		public constructor(options?: Partial<TreeInitOptions>);
		public static new(menu_basename: string, flags: TreeFlags): Tree;
		public static new_for_path(menu_path: string, flags: TreeFlags): Tree;
		public static item_ref(item?: any | null): any | null;
		public static item_unref(item?: any | null): void;
	}

	export interface TreeAliasInitOptions {}
	interface TreeAlias {}
	class TreeAlias {
		public constructor(options?: Partial<TreeAliasInitOptions>);
		public get_aliased_directory(): TreeDirectory;
		public get_aliased_entry(): TreeEntry;
		public get_aliased_item_type(): TreeItemType;
		public get_directory(): TreeDirectory;
		public get_parent(): TreeDirectory;
		/**
		 * Grab the tree associated with a #GMenuTreeAlias.
		 * @returns The #GMenuTree
		 */
		public get_tree(): Tree;
	}

	export interface TreeDirectoryInitOptions {}
	interface TreeDirectory {}
	class TreeDirectory {
		public constructor(options?: Partial<TreeDirectoryInitOptions>);
		public get_comment(): string;
		public get_desktop_file_path(): string;
		public get_generic_name(): string;
		/**
		 * Gets the icon for the directory.
		 * @returns The #GIcon for this directory
		 */
		public get_icon(): Gio.Icon;
		public get_is_nodisplay(): boolean;
		public get_menu_id(): string;
		public get_name(): string;
		public get_parent(): TreeDirectory;
		/**
		 * Grab the tree associated with a #GMenuTreeItem.
		 * @returns The #GMenuTree
		 */
		public get_tree(): Tree;
		public iter(): TreeIter;
		public make_path(entry: TreeEntry): string;
	}

	export interface TreeEntryInitOptions {}
	interface TreeEntry {}
	class TreeEntry {
		public constructor(options?: Partial<TreeEntryInitOptions>);
		public get_app_info(): DesktopAppInfo;
		public get_desktop_file_id(): string;
		public get_desktop_file_path(): string;
		public get_is_excluded(): boolean;
		public get_is_flatpak(): boolean;
		public get_is_nodisplay_recurse(): boolean;
		public get_is_unallocated(): boolean;
		public get_parent(): TreeDirectory;
		/**
		 * Grab the tree associated with a #GMenuTreeEntry.
		 * @returns The #GMenuTree
		 */
		public get_tree(): Tree;
	}

	export interface TreeHeaderInitOptions {}
	interface TreeHeader {}
	class TreeHeader {
		public constructor(options?: Partial<TreeHeaderInitOptions>);
		public get_directory(): TreeDirectory;
		public get_parent(): TreeDirectory;
		/**
		 * Grab the tree associated with a #GMenuTreeHeader.
		 * @returns The #GMenuTree
		 */
		public get_tree(): Tree;
	}

	export interface TreeIterInitOptions {}
	interface TreeIter {}
	class TreeIter {
		public constructor(options?: Partial<TreeIterInitOptions>);
		/**
		 * This method may only be called if {@link CMenu.TreeIter.next}
		 * returned GMENU_TREE_ITEM_ALIAS.
		 * @returns An alias
		 */
		public get_alias(): TreeAlias;
		/**
		 * This method may only be called if {@link CMenu.TreeIter.next}
		 * returned GMENU_TREE_ITEM_DIRECTORY.
		 * @returns A directory
		 */
		public get_directory(): TreeDirectory;
		/**
		 * This method may only be called if {@link CMenu.TreeIter.next}
		 * returned GMENU_TREE_ITEM_ENTRY.
		 * @returns An entry
		 */
		public get_entry(): TreeEntry;
		/**
		 * This method may only be called if {@link CMenu.TreeIter.next}
		 * returned GMENU_TREE_ITEM_HEADER.
		 * @returns A header
		 */
		public get_header(): TreeHeader;
		/**
		 * This method may only be called if {@link CMenu.TreeIter.next}
		 * returned #GMENU_TREE_ITEM_SEPARATOR.
		 * @returns A separator
		 */
		public get_separator(): TreeSeparator;
		/**
		 * Change the iterator to the next item, and return its type.  If
		 * there are no more items, %GMENU_TREE_ITEM_INVALID is returned.
		 * @returns The type of the next item that can be retrived from the iterator
		 */
		public next(): TreeItemType;
		/**
		 * Increment the reference count of #iter
		 * @returns 
		 */
		public ref(): TreeIter;
		/**
		 * Decrement the reference count of #iter
		 */
		public unref(): void;
	}

	export interface TreeSeparatorInitOptions {}
	interface TreeSeparator {}
	class TreeSeparator {
		public constructor(options?: Partial<TreeSeparatorInitOptions>);
		public get_parent(): TreeDirectory;
		/**
		 * Grab the tree associated with a #GMenuTreeSeparator.
		 * @returns The #GMenuTree
		 */
		public get_tree(): Tree;
	}

	enum TreeItemType {
		INVALID = 0,
		DIRECTORY = 1,
		ENTRY = 2,
		SEPARATOR = 3,
		HEADER = 4,
		ALIAS = 5
	}

	enum TreeFlags {
		NONE = 0,
		INCLUDE_EXCLUDED = 1,
		SHOW_EMPTY = 256,
		INCLUDE_NODISPLAY = 2,
		SHOW_ALL_SEPARATORS = 512,
		SORT_DISPLAY_NAME = 65536,
		INCLUDE_UNALLOCATED = 4
	}

	const DESKTOPAPPINFO_FLATPAK_SUFFIX: string;

}