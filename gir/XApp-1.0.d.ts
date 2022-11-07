/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.XApp {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Favorites} instead.
	 */
	interface IFavorites {
		/**
		 * Adds a new favorite.  If the uri already exists, this does nothing.
		 * @param uri The uri the favorite is for
		 */
		add(uri: string): void;
		/**
		 * Generates a list of favorite GtkActions.
		 * @param mimetypes The mimetypes to filter for, or NULL to include all favorites.
		 * @returns a new #GtkActionGroup populated with a list of favorites, or NULL
		 *             if there are no favorites.
		 */
		create_actions(mimetypes?: string | null): Gtk.Action[];
		/**
		 * Generates a GtkMenu widget populated with favorites. The callback will be called when
		 * a menu item has been activated, and will include the uri of the respective item.
		 * @param mimetypes The mimetypes to filter for, or NULL to include all favorites.
		 * @param callback (closure user_data): The callback to use when a menu item has been selected.
		 * @returns a new #GtkMenu populated with a list of favorites, or NULL
		 *             if there are no favorites.
		 */
		create_menu(mimetypes: string | null, callback: FavoritesItemSelectedCallback): Gtk.Widget;
		/**
		 * Looks for an XAppFavoriteInfo that corresponds to #display_name.
		 * @param display_name The display name to lookup info for.
		 * @returns an XAppFavoriteInfo or NULL if one was not found. This is owned
		 *          by the favorites manager and should not be freed.
		 */
		find_by_display_name(display_name: string): FavoriteInfo;
		/**
		 * Looks for an XAppFavoriteInfo that corresponds to #uri.
		 * @param uri The uri to lookup info for.
		 * @returns an XAppFavoriteInfo or NULL if one was not found. This is owned
		 *          by the favorites manager and should not be freed.
		 */
		find_by_uri(uri: string): FavoriteInfo;
		/**
		 * Gets a list of all favorites.  If mimetype is not %NULL, the list will
		 * contain only favorites with that mimetype.
		 * @param mimetypes The mimetypes to filter by for results
		 * @returns a list of {@link FavoriteInfos}.
		 *             Free the list with #g_list_free, free elements with #xapp_favorite_info_free.
		 */
		get_favorites(mimetypes?: string | null): FavoriteInfo[];
		get_n_favorites(): number;
		/**
		 * Opens a favorite in its default app.
		 * @param uri The uri for the favorite to launch
		 * @param timestamp The timestamp from an event or 0
		 */
		launch(uri: string, timestamp: number): void;
		/**
		 * Removes a favorite from the list.
		 * @param uri The uri for the favorite being removed
		 */
		remove(uri: string): void;
		/**
		 * Removes old_uri and adds new_uri. This is mainly for file managers to use as
		 * a convenience instead of add/remove, and guarantees the result, without having to
		 * worry about multiple dbus calls (gsettings).
		 * @param old_uri the old favorite's uri.
		 * @param new_uri The new uri.
		 */
		rename(old_uri: string, new_uri: string): void;
		/**
		 * Notifies when the favorites list has changed.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "changed", callback: (owner: this) => void): number;

	}

	type FavoritesInitOptionsMixin = GObject.ObjectInitOptions
	export interface FavoritesInitOptions extends FavoritesInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Favorites} instead.
	 */
	type FavoritesMixin = IFavorites & GObject.Object;

	interface Favorites extends FavoritesMixin {}

	class Favorites {
		public constructor(options?: Partial<FavoritesInitOptions>);
		/**
		 * Returns the {@link Favorites} instance.
		 * @returns the XAppFavorites instance for the process. Do not free.
		 */
		public static get_default(): Favorites;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GtkWindow} instead.
	 */
	interface IGtkWindow {
		/**
		 * Sets the icon name hint for a window manager (like muffin) to make
		 * available when applications want to change their icons during runtime
		 * without having to resort to the internal low-res pixbufs that GdkWindow
		 * sets on the client side.  This also chains up and calls GtkWindow.set_icon_from_file
		 * for convenience and compatibility.  Set to %NULL to unset.
		 * @param file_name The icon path to set, or %NULL to unset.
		 */
		set_icon_from_file(file_name?: string | null): void;
		/**
		 * Sets the icon name hint for a window manager (like muffin) to make
		 * available when applications want to change their icons during runtime
		 * without having to resort to the internal low-res pixbufs that GdkWindow
		 * sets on the client side.  This also chains up and calls GtkWindow.set_icon_name
		 * for convenience and compatibility.  Set to %NULL to unset.
		 * @param icon_name The icon name or path to set, or %NULL to unset.
		 */
		set_icon_name(icon_name?: string | null): void;
		/**
		 * Sets the progress hint for a window manager (like muffin) to make
		 * available when applications want to display the application's progress
		 * in some operation. The value sent to the WM will be clamped to
		 * between 0 and 100.
		 * 
		 * Note: If a window will stick around after progress is complete, you will
		 * probaby need to set progress to 0 to remove any progress effects on taskbars
		 * and window lists.
		 * 
		 * Setting progress will also cancel the 'pulsing' flag on the window as
		 * well, if it has been set.
		 * @param progress The value to set for progress.
		 */
		set_progress(progress: number): void;
		/**
		 * Sets the progress pulse hint hint for a window manager (like muffin)
		 * to make available when applications want to display indeterminate or
		 * ongoing progress in a task manager.
		 * 
		 * Note: If a window will stick around after progress is complete, you will
		 * probaby need to set progress to 0 to remove any progress effects on taskbars
		 * and window lists.  This will also remove the pulse state, if it is set.
		 * 
		 * Setting an explicit progress value will unset this flag.
		 * @param pulse Whether to have pulsing set or not.
		 */
		set_progress_pulse(pulse: boolean): void;
	}

	type GtkWindowInitOptionsMixin = Gtk.WindowInitOptions & Atk.ImplementorIfaceInitOptions & Gtk.BuildableInitOptions
	export interface GtkWindowInitOptions extends GtkWindowInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GtkWindow} instead.
	 */
	type GtkWindowMixin = IGtkWindow & Gtk.Window & Atk.ImplementorIface & Gtk.Buildable;

	interface GtkWindow extends GtkWindowMixin {}

	class GtkWindow {
		public constructor(options?: Partial<GtkWindowInitOptions>);
		/**
		 * Creates a new {@link GtkWindow} of type #type.  See {@link Gtk.Window.new}
		 * for more details.
		 * @param type The #GtkWindowType to use
		 * @returns A new {@link GtkWindow} (transfer: full)
		 */
		public static new(type: Gtk.WindowType): Gtk.Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IconChooserButton} instead.
	 */
	interface IIconChooserButton {
		/**
		 * The category selected by default.
		 */
		category: string;
		/**
		 * The preferred size to use when looking up icons. This only works with icon names.
		 * Additionally, there is no guarantee that a selected icon name will exist in a
		 * particular size.
		 */
		icon: string;
		/**
		 * The size to use when displaying the icon.
		 */
		icon_size: Gtk.IconSize;
		/**
		 * Gets a reference to the icon chooser dialog for the {@link IconChooserButton}.
		 * This is useful for setting properties on the dialog.
		 * @returns the {@link IconChooserDialog}
		 */
		get_dialog(): IconChooserDialog;
		/**
		 * Gets the icon from the {@link IconChooserButton}.
		 * @returns a string representing the icon. This may be an icon name or a file path.
		 */
		get_icon(): string;
		/**
		 * Sets the icon on the {@link IconChooserButton}.
		 * @param category a string representing the category selected by default.
		 */
		set_default_category(category?: string | null): void;
		/**
		 * Sets the icon on the {@link IconChooserButton}.
		 * @param icon a string representing the icon to be set. This may be an icon name or a file path.
		 */
		set_icon(icon?: string | null): void;
		/**
		 * Sets the icon size used in the button.
		 * @param icon_size the size of icon to use in the button, or -1 to use the default value.
		 */
		set_icon_size(icon_size: Gtk.IconSize): void;
		connect(signal: "notify::category", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::icon", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::icon-size", callback: (owner: this, ...args: any) => void): number;

	}

	type IconChooserButtonInitOptionsMixin = Gtk.ButtonInitOptions & Atk.ImplementorIfaceInitOptions & Gtk.ActionableInitOptions & Gtk.ActivatableInitOptions & Gtk.BuildableInitOptions & 
	Pick<IIconChooserButton,
		"category" |
		"icon" |
		"icon_size">;

	export interface IconChooserButtonInitOptions extends IconChooserButtonInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IconChooserButton} instead.
	 */
	type IconChooserButtonMixin = IIconChooserButton & Gtk.Button & Atk.ImplementorIface & Gtk.Actionable & Gtk.Activatable & Gtk.Buildable;

	interface IconChooserButton extends IconChooserButtonMixin {}

	class IconChooserButton {
		public constructor(options?: Partial<IconChooserButtonInitOptions>);
		/**
		 * Creates a new {@link IconChooserButton} and sets its icon to #icon.
		 * @returns a newly created {@link IconChooserButton}
		 */
		public static new(): IconChooserButton;
		/**
		 * Creates a new {@link IconChooserButton}, and sets the sizes of the button image and the icons in
		 * the dialog. Note that xapp_icon_chooser_button_new_with_size (NULL, NULL) is the same as calling
		 * xapp_icon_chooser_button_new ().
		 * @param icon_size the size of icon to use in the button, or NULL to use the default value.
		 * @returns a newly created {@link IconChooserButton}
		 */
		public static new_with_size(icon_size: Gtk.IconSize): IconChooserButton;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IconChooserDialog} instead.
	 */
	interface IIconChooserDialog {
		/**
		 * Whether to allow paths to be searched and selected or only icon names.
		 */
		allow_paths: boolean;
		/**
		 * The icon to use by default.
		 */
		default_icon: string;
		/**
		 * The preferred size to use when looking up icons. This only works with icon names.
		 * Additionally, there is no guarantee that a selected icon name will exist in a
		 * particular size.
		 */
		icon_size: IconSize;
		/**
		 * Allows a button to be added to the #GtkActionBar of the dialog with a custom
		 * response id.
		 * @param button a #GtkButton to add
		 * @param packing the #GtkPackType to specify start or end packing to the action bar
		 * @param response_id the dialog response id to return when this button is clicked.
		 */
		add_button(button: Gtk.Widget, packing: Gtk.PackType, response_id: Gtk.ResponseType): void;
		/**
		 * Adds a custom category to the dialog.
		 * @param name the name of the category as it will be displayed in the category list
		 * @param icons a list of icon names to add to the new category
		 */
		add_custom_category(name: string, icons: string[]): void;
		/**
		 * Returns the default icon (if set).
		 * @returns the default icon, or NULL if none is set
		 */
		get_default_icon(): string;
		/**
		 * Gets the currently selected icon from the dialog. If allow-paths is TRUE, this function may return
		 * either an icon name or a path depending on what the user selects. Otherwise it will only return an
		 * icon name.
		 * @returns the string representation of the currently selected icon or NULL
		 * if no icon is selected.
		 */
		get_icon_string(): string;
		/**
		 * Shows the dialog and enters a separate main loop until an icon is chosen or the action is canceled.
		 * 
		 * xapp_icon_chooser_dialog_run (), {@link Xapp.icon_chooser_dialog_run_with_icon}, and
		 * xapp_icon_chooser_dialog_run_with_category () may all be called multiple times. This is useful for
		 * applications which use this dialog multiple times, as it may improve performance for subsequent
		 * calls.
		 * @returns GTK_RESPONSE_OK if the user selected an icon, or GTK_RESPONSE_CANCEL otherwise
		 */
		run(): number;
		/**
		 * Like xapp_icon_chooser_dialog_run but selects a particular category specified by #category.
		 * This is used when there is a particular category of icon that is more appropriate than the
		 * others. If the category does not exist, the first category in the list will be selected. To
		 * get a list of possible categories, use gtk_icon_theme_list_contexts ().
		 * 
		 * xapp_icon_chooser_dialog_run (), {@link Xapp.icon_chooser_dialog_run_with_icon}, and
		 * xapp_icon_chooser_dialog_run_with_category () may all be called multiple times. This is useful for
		 * applications which use this dialog multiple times, as it may improve performance for subsequent
		 * calls.
		 * @param category
		 * @returns GTK_RESPONSE_OK if the user selected an icon, or GTK_RESPONSE_CANCEL otherwise
		 */
		run_with_category(category: string): number;
		/**
		 * Like xapp_icon_chooser_dialog_run but selects the icon specified by #icon. This can be either an
		 * icon name or a path. Passing an icon string or path that doesn't exist is accepted, but it may show
		 * multiple results, or none at all. This behavior is useful if, for example, you wish to have the
		 * user select an image file from a particular directory.
		 * 
		 * If the property allow_paths is FALSE, setting a path will yield no results when the dialog is opened.
		 * 
		 * xapp_icon_chooser_dialog_run (), {@link Xapp.icon_chooser_dialog_run_with_icon}, and
		 * xapp_icon_chooser_dialog_run_with_category () may all be called multiple times. This is useful for
		 * applications which use this dialog multiple times, as it may improve performance for subsequent
		 * calls.
		 * @param icon a string representing the icon that should be selected
		 * @returns GTK_RESPONSE_OK if the user selected an icon, or GTK_RESPONSE_CANCEL otherwise
		 */
		run_with_icon(icon: string): number;
		/**
		 * Sets the default icon. If #icon is not NULL, a button will be shown that
		 * will reset the dialog to it's default value.
		 * @param icon the default icon, or NULL to unset
		 */
		set_default_icon(icon: string): void;
		connect(signal: "close", callback: (owner: this) => void): number;
		connect(signal: "select", callback: (owner: this) => void): number;

		connect(signal: "notify::allow-paths", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default-icon", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::icon-size", callback: (owner: this, ...args: any) => void): number;

	}

	type IconChooserDialogInitOptionsMixin = GtkWindowInitOptions & Atk.ImplementorIfaceInitOptions & Gtk.BuildableInitOptions & 
	Pick<IIconChooserDialog,
		"allow_paths" |
		"default_icon" |
		"icon_size">;

	export interface IconChooserDialogInitOptions extends IconChooserDialogInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IconChooserDialog} instead.
	 */
	type IconChooserDialogMixin = IIconChooserDialog & GtkWindow & Atk.ImplementorIface & Gtk.Buildable;

	interface IconChooserDialog extends IconChooserDialogMixin {}

	class IconChooserDialog {
		public constructor(options?: Partial<IconChooserDialogInitOptions>);
		/**
		 * Creates a new {@link IconChooserDialog}.
		 * @returns a newly created {@link IconChooserDialog}
		 */
		public static new(): IconChooserDialog;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KbdLayoutController} instead.
	 */
	interface IKbdLayoutController {
		readonly enabled: boolean;
		readonly parent_object: GObject.Object;
		/**
		 * Returns an array of all full layout names
		 * @returns array of names
		 */
		get_all_names(): string[];
		/**
		 * Returns the duplicate id for the current layout
		 * @returns the id
		 */
		get_current_flag_id(): number;
		/**
		 * Selects the previous group in the group list.
		 * @returns 
		 */
		get_current_group(): number;
		/**
		 * Returns the icon file name (no path or extension) to use for the current layout
		 * @returns a new string with the icon name.
		 */
		get_current_icon_name(): string;
		/**
		 * Returns the full name of the current keyboard layout.
		 * @returns the newly created string or NULL
		 * if something went wrong.
		 */
		get_current_name(): string;
		/**
		 * Returns the short group label (and subscript, if any) of the current layout
		 * @returns a new string or NULL.
		 */
		get_current_short_group_label(): string;
		/**
		 * Returns the variant label (and subscript, if any) of the current layout
		 * @returns a new string or NULL.
		 */
		get_current_variant_label(): string;
		/**
		 * Returns whether or not the layout controller is enabled
		 * @returns 
		 */
		get_enabled(): boolean;
		get_flag_id_for_group(group: number): number;
		/**
		 * Returns the icon file name (no path or extension) to use for the specified layout.
		 * @param group a group number
		 * @returns a new string with the icon name.
		 */
		get_icon_name_for_group(group: number): string;
		/**
		 * Returns the short group label and subscript of the specified layout.
		 * @param group a group number
		 * @returns a new string or NULL.
		 */
		get_short_group_label_for_group(group: number): string;
		/**
		 * Returns the variant label and subscript of the specified layout.
		 * @param group a group number
		 * @returns a new string or NULL.
		 */
		get_variant_label_for_group(group: number): string;
		/**
		 * Selects the next group in the group list.
		 */
		next_group(): void;
		/**
		 * Selects the previous group in the group list.
		 */
		previous_group(): void;
		/**
		 * Selects the given group number as active.
		 * @param group the group number to make active
		 */
		set_current_group(group: number): void;
		connect(signal: "config-changed", callback: (owner: this) => void): number;
		connect(signal: "layout-changed", callback: (owner: this, object: number) => void): number;

		connect(signal: "notify::enabled", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::parent_object", callback: (owner: this, ...args: any) => void): number;

	}

	type KbdLayoutControllerInitOptionsMixin = GObject.ObjectInitOptions
	export interface KbdLayoutControllerInitOptions extends KbdLayoutControllerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KbdLayoutController} instead.
	 */
	type KbdLayoutControllerMixin = IKbdLayoutController & GObject.Object;

	interface KbdLayoutController extends KbdLayoutControllerMixin {}

	class KbdLayoutController {
		public constructor(options?: Partial<KbdLayoutControllerInitOptions>);
		/**
		 * Creates a new XAppKbdLayoutController instance.
		 * @returns a new {@link KbdLayoutController} instance
		 */
		public static new(): KbdLayoutController;
		/**
		 * Renders a subscript number in the given work area.  This should
		 * be called from within a "draw" or "paint" widget/actor function,
		 * where a valid cairo_t is provided to draw with.
		 * @param cr a #cairo_t
		 * @param x the x position of the drawing area
		 * @param y the y position of the drawing area
		 * @param width the width of the drawing area
		 * @param height the height of the drawing area
		 * @param subscript the number to render
		 */
		public static render_cairo_subscript(cr: cairo.Context, x: number, y: number, width: number, height: number, subscript: number): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MonitorBlanker} instead.
	 */
	interface IMonitorBlanker {
		/**
		 * Returns whether monitors are currently blanked.
		 * See {@link Xapp.monitor_blanker_blank_other_monitors}.
		 * @returns %TRUE if monitors are blanked.
		 */
		are_monitors_blanked(): boolean;
		/**
		 * Blanks monitors besides the one where the #window is.
		 * @param window a #GtkWindow
		 */
		blank_other_monitors(window: Gtk.Window): void;
		/**
		 * Unblanks monitors that were blanked by
		 * {@link Xapp.monitor_blanker_blank_other_monitors};
		 */
		unblank_monitors(): void;
	}

	type MonitorBlankerInitOptionsMixin = GObject.ObjectInitOptions
	export interface MonitorBlankerInitOptions extends MonitorBlankerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MonitorBlanker} instead.
	 */
	type MonitorBlankerMixin = IMonitorBlanker & GObject.Object;

	interface MonitorBlanker extends MonitorBlankerMixin {}

	class MonitorBlanker {
		public constructor(options?: Partial<MonitorBlankerInitOptions>);
		/**
		 * Creates a new {@link MonitorBlanker}.
		 * @returns a newly created {@link MonitorBlanker}
		 */
		public static new(): MonitorBlanker;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ObjectManagerClient} instead.
	 */
	interface IObjectManagerClient {

	}

	type ObjectManagerClientInitOptionsMixin = Gio.DBusObjectManagerClientInitOptions & Gio.AsyncInitableInitOptions & Gio.DBusObjectManagerInitOptions & Gio.InitableInitOptions
	export interface ObjectManagerClientInitOptions extends ObjectManagerClientInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ObjectManagerClient} instead.
	 */
	type ObjectManagerClientMixin = IObjectManagerClient & Gio.DBusObjectManagerClient & Gio.AsyncInitable & Gio.DBusObjectManager & Gio.Initable;

	/**
	 * The {@link ObjectManagerClient} structure contains only private data and should only be accessed using the provided API.
	 */
	interface ObjectManagerClient extends ObjectManagerClientMixin {}

	class ObjectManagerClient {
		public constructor(options?: Partial<ObjectManagerClientInitOptions>);
		/**
		 * Finishes an operation started with {@link Xapp.object_manager_client_new}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Xapp.object_manager_client_new}.
		 * @returns The constructed object manager client or %NULL if #error is set.
		 */
		public static new_finish(res: Gio.AsyncResult): ObjectManagerClient;
		/**
		 * Finishes an operation started with {@link Xapp.object_manager_client_new_for_bus}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Xapp.object_manager_client_new_for_bus}.
		 * @returns The constructed object manager client or %NULL if #error is set.
		 */
		public static new_for_bus_finish(res: Gio.AsyncResult): ObjectManagerClient;
		/**
		 * Like {@link Xapp.object_manager_client_new_sync} but takes a #GBusType instead of a #GDBusConnection.
		 * 
		 * The calling thread is blocked until a reply is received.
		 * 
		 * See xapp_object_manager_client_new_for_bus() for the asynchronous version of this constructor.
		 * @param bus_type A #GBusType.
		 * @param flags Flags from the #GDBusObjectManagerClientFlags enumeration.
		 * @param name A bus name (well-known or unique).
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns The constructed object manager client or %NULL if #error is set.
		 */
		public static new_for_bus_sync(bus_type: Gio.BusType, flags: Gio.DBusObjectManagerClientFlags, name: string, object_path: string, cancellable?: Gio.Cancellable | null): ObjectManagerClient;
		/**
		 * Synchronously creates #GDBusObjectManagerClient using {@link Xapp.object_manager_client_get_proxy_type} as the #GDBusProxyTypeFunc. See g_dbus_object_manager_client_new_sync() for more details.
		 * 
		 * The calling thread is blocked until a reply is received.
		 * 
		 * See xapp_object_manager_client_new() for the asynchronous version of this constructor.
		 * @param connection A #GDBusConnection.
		 * @param flags Flags from the #GDBusObjectManagerClientFlags enumeration.
		 * @param name A bus name (well-known or unique) or %NULL if #connection is not a message bus connection.
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns The constructed object manager client or %NULL if #error is set.
		 */
		public static new_sync(connection: Gio.DBusConnection, flags: Gio.DBusObjectManagerClientFlags, name: string | null, object_path: string, cancellable?: Gio.Cancellable | null): ObjectManagerClient;
		/**
		 * A #GDBusProxyTypeFunc that maps #interface_name to the generated #GDBusObjectProxy derived and #GDBusProxy derived types.
		 * @param manager A #GDBusObjectManagerClient.
		 * @param object_path The object path of the remote object (unused).
		 * @param interface_name Interface name of the remote object or %NULL to get the object proxy #GType.
		 * @param user_data User data (unused).
		 * @returns A #GDBusProxy derived #GType if #interface_name is not %NULL, otherwise the #GType for {@link ObjectProxy}.
		 */
		public static get_proxy_type(manager: Gio.DBusObjectManagerClient, object_path: string, interface_name?: string | null, user_data?: any | null): GObject.Type;
		/**
		 * Asynchronously creates #GDBusObjectManagerClient using {@link Xapp.object_manager_client_get_proxy_type} as the #GDBusProxyTypeFunc. See g_dbus_object_manager_client_new() for more details.
		 * 
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call xapp_object_manager_client_new_finish() to get the result of the operation.
		 * 
		 * See xapp_object_manager_client_new_sync() for the synchronous, blocking version of this constructor.
		 * @param connection A #GDBusConnection.
		 * @param flags Flags from the #GDBusObjectManagerClientFlags enumeration.
		 * @param name A bus name (well-known or unique) or %NULL if #connection is not a message bus connection.
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @param callback A #GAsyncReadyCallback to call when the request is satisfied.
		 */
		public static new(connection: Gio.DBusConnection, flags: Gio.DBusObjectManagerClientFlags, name: string | null, object_path: string, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Like {@link Xapp.object_manager_client_new} but takes a #GBusType instead of a #GDBusConnection.
		 * 
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call xapp_object_manager_client_new_for_bus_finish() to get the result of the operation.
		 * 
		 * See xapp_object_manager_client_new_for_bus_sync() for the synchronous, blocking version of this constructor.
		 * @param bus_type A #GBusType.
		 * @param flags Flags from the #GDBusObjectManagerClientFlags enumeration.
		 * @param name A bus name (well-known or unique).
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @param callback A #GAsyncReadyCallback to call when the request is satisfied.
		 */
		public static new_for_bus(bus_type: Gio.BusType, flags: Gio.DBusObjectManagerClientFlags, name: string, object_path: string, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ObjectProxy} instead.
	 */
	interface IObjectProxy {

	}

	type ObjectProxyInitOptionsMixin = Gio.DBusObjectProxyInitOptions & Gio.DBusObjectInitOptions & ObjectInitOptions
	export interface ObjectProxyInitOptions extends ObjectProxyInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ObjectProxy} instead.
	 */
	type ObjectProxyMixin = IObjectProxy & Gio.DBusObjectProxy & Gio.DBusObject & Object;

	/**
	 * The {@link ObjectProxy} structure contains only private data and should only be accessed using the provided API.
	 */
	interface ObjectProxy extends ObjectProxyMixin {}

	class ObjectProxy {
		public constructor(options?: Partial<ObjectProxyInitOptions>);
		/**
		 * Creates a new proxy object.
		 * @param connection A #GDBusConnection.
		 * @param object_path An object path.
		 * @returns The proxy object.
		 */
		public static new(connection: Gio.DBusConnection, object_path: string): ObjectProxy;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ObjectSkeleton} instead.
	 */
	interface IObjectSkeleton {
		/**
		 * Sets the {@link StatusIconInterface} instance for the D-Bus interface <link linkend="gdbus-interface-org-x-StatusIcon.top_of_page">org.x.StatusIcon</link> on #object.
		 * @param interface_ A {@link StatusIconInterface} or %NULL to clear the interface.
		 */
		set_status_icon_interface(interface_?: StatusIconInterface | null): void;
	}

	type ObjectSkeletonInitOptionsMixin = Gio.DBusObjectSkeletonInitOptions & Gio.DBusObjectInitOptions & ObjectInitOptions
	export interface ObjectSkeletonInitOptions extends ObjectSkeletonInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ObjectSkeleton} instead.
	 */
	type ObjectSkeletonMixin = IObjectSkeleton & Gio.DBusObjectSkeleton & Gio.DBusObject & Object;

	/**
	 * The {@link ObjectSkeleton} structure contains only private data and should only be accessed using the provided API.
	 */
	interface ObjectSkeleton extends ObjectSkeletonMixin {}

	class ObjectSkeleton {
		public constructor(options?: Partial<ObjectSkeletonInitOptions>);
		/**
		 * Creates a new skeleton object.
		 * @param object_path An object path.
		 * @returns The skeleton object.
		 */
		public static new(object_path: string): ObjectSkeleton;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PreferencesWindow} instead.
	 */
	interface IPreferencesWindow {
		/**
		 * Adds a button to the bottom action bar of the window. Where
		 * the button is place will be determined by the #GtkPackType. The
		 * action bar will show automatically once at least one button is
		 * added.
		 * @param button a #GtkWidget to add
		 * @param pack_type a #GtkPackType to use
		 */
		add_button(button: Gtk.Widget, pack_type: Gtk.PackType): void;
		/**
		 * Adds a page to the window. The page is identified by name. The
		 * title will be used in the sidebar so should be short. The sidebar
		 * will show automatically once at least two pages are added.
		 * @param widget a #GtkWidget to add
		 * @param name the name for the page
		 * @param title a human-readable title for the page
		 */
		add_page(widget: Gtk.Widget, name: string, title: string): void;
		connect(signal: "close", callback: (owner: this) => void): number;

	}

	type PreferencesWindowInitOptionsMixin = Gtk.WindowInitOptions & Atk.ImplementorIfaceInitOptions & Gtk.BuildableInitOptions
	export interface PreferencesWindowInitOptions extends PreferencesWindowInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PreferencesWindow} instead.
	 */
	type PreferencesWindowMixin = IPreferencesWindow & Gtk.Window & Atk.ImplementorIface & Gtk.Buildable;

	interface PreferencesWindow extends PreferencesWindowMixin {}

	class PreferencesWindow {
		public constructor(options?: Partial<PreferencesWindowInitOptions>);
		/**
		 * Creates a new {@link PreferencesWindow}.
		 * @returns a newly created {@link PreferencesWindow}
		 */
		public static new(): PreferencesWindow;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StackSidebar} instead.
	 */
	interface IStackSidebar {
		stack: Gtk.Stack;
		/**
		 * Retrieves the stack.
		 * See {@link Xapp.stack_sidebar_set_stack}.
		 * @returns the associated #GtkStack or
		 *     %NULL if none has been set explicitly
		 */
		get_stack(): Gtk.Stack | null;
		/**
		 * Set the #GtkStack associated with this {@link StackSidebar}.
		 * 
		 * The sidebar widget will automatically update according to the order
		 * (packing) and items within the given #GtkStack.
		 * @param stack a #GtkStack
		 */
		set_stack(stack: Gtk.Stack): void;
		connect(signal: "notify::stack", callback: (owner: this, ...args: any) => void): number;

	}

	type StackSidebarInitOptionsMixin = Gtk.BinInitOptions & Atk.ImplementorIfaceInitOptions & Gtk.BuildableInitOptions & 
	Pick<IStackSidebar,
		"stack">;

	export interface StackSidebarInitOptions extends StackSidebarInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StackSidebar} instead.
	 */
	type StackSidebarMixin = IStackSidebar & Gtk.Bin & Atk.ImplementorIface & Gtk.Buildable;

	interface StackSidebar extends StackSidebarMixin {}

	class StackSidebar {
		public constructor(options?: Partial<StackSidebarInitOptions>);
		/**
		 * Creates a new sidebar.
		 * @returns the new {@link StackSidebar}
		 */
		public static new(): StackSidebar;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StatusIcon} instead.
	 */
	interface IStatusIcon {
		/**
		 * The icon size that is preferred by icon monitor/host - this is usually a product
		 * of some calculation based on the panel size.  It can be used by the client to size
		 * an icon to be saved as a file and its path sent to the host.
		 * 
		 * If this value is 0 it has not been set, and its value can be unreliable if the host
		 * has multiple {@link StatusIconMonitors} active.
		 */
		icon_size: number;
		/**
		 * The name of the icon for sorting purposes. If this is in the form of 'org.x.StatusIcon.foo`
		 * and set immediately upon creation of the icon, it will also attempt to own this dbus name;
		 * this can be useful in sandboxed environments where a well-defined name is required. If
		 * additional icons are created, only the name given to the initial one will be used for dbus,
		 * though different names can still affect the sort order. This is set to the value of
		 * {@link G.get_prgname} if no other name is provided.
		 */
		name: string;
		/**
		 * A #GtkMenu to use when requested by the remote monitor via a left (or primary) click.
		 * 
		 * When this property is not %NULL, the menu will be automatically positioned and
		 * displayed during a primary button release.
		 * 
		 * When this property IS %NULL, the {@link StatusIcon.activate} will be sent for primary
		 * button presses.
		 * 
		 * In both cases, the #XAppStatusIcon::button-press-event and #XAppStatusIcon::button-release-events
		 * will be fired like normal.
		 * 
		 * Setting this will remove any floating reference to the menu and assume ownership.
		 * As a result, it is not necessary to maintain a reference to it in the parent
		 * application (or unref it when finished with it - if you wish to replace the menu,
		 * simply call this method again with a new menu.
		 * 
		 * The same #GtkMenu widget can be set as both the primary and secondary.
		 */
		primary_menu: Gtk.Widget;
		/**
		 * A #GtkMenu to use when requested by the remote monitor via a right (or secondary) click.
		 * 
		 * When this property is not %NULL, the menu will be automatically positioned and
		 * displayed during a secondary button release.
		 * 
		 * When this property IS %NULL, the {@link StatusIcon.activate} will be sent for secondary
		 * button presses.
		 * 
		 * In both cases, the #XAppStatusIcon::button-press-event and #XAppStatusIcon::button-release-events
		 * will be fired like normal.
		 * 
		 * Setting this will remove any floating reference to the menu and assume ownership.
		 * As a result, it is not necessary to maintain a reference to it in the parent
		 * application (or unref it when finished with it - if you wish to replace the menu,
		 * simply call this method again with a new menu.
		 * 
		 * The same #GtkMenu widget can be set as both the primary and secondary.
		 */
		secondary_menu: Gtk.Widget;
		get_icon_size(): number;
		/**
		 * Returns a pointer to a #GtkMenu that was set previously for the
		 * primary mouse button.  If no menu was set, this returns %NULL.
		 * @returns the #GtkMenu or %NULL if none was set.
		 */
		get_primary_menu(): Gtk.Widget;
		/**
		 * Returns a pointer to a #GtkMenu that was set previously for the
		 * secondary mouse button.  If no menu was set, this returns %NULL.
		 * @returns the #GtkMenu or %NULL if none was set.
		 */
		get_secondary_menu(): Gtk.Widget;
		/**
		 * Gets the current {@link StatusIconState} of icon. The state is determined by whether
		 * the icon is being displayed by an #XAppStatusMonitor client, a fallback tray icon,
		 * or not being displayed at all.
		 * 
		 * See #XAppStatusIconState for more details.
		 * @returns the icon's state.
		 */
		get_state(): StatusIconState;
		/**
		 * Returns whether or not the icon should currently be visible.
		 * @returns the current visibility state.
		 */
		get_visible(): boolean;
		/**
		 * Pop up #menu using the positioning arguments. These arguments should be
		 * those provided by a {@link StatusIcon.button_release_event}.
		 * @param menu A #GtkMenu to display when the primary mouse button is released.
		 * @param x The x anchor position for the menu.
		 * @param y The y anchor position for the menu.
		 * @param button The button used to initiate this action (or 0)
		 * @param _time The event time (or 0)
		 * @param panel_position The #GtkPositionType for the position of the icon.
		 */
		popup_menu(menu: Gtk.Menu | null, x: number, y: number, button: number, _time: number, panel_position: number): void;
		/**
		 * Sets the icon name or local path to use.
		 * @param icon_name An icon name or absolute path to an icon.
		 */
		set_icon_name(icon_name: string): void;
		/**
		 * Sets a label, shown beside the icon
		 * @param label some text
		 */
		set_label(label: string): void;
		/**
		 * Sets metadata to pass to the icon proxy for an applet's use. Right now this is only so
		 * xapp-sn-watcher can tell the applets when the icon is originating from appindicator so panel
		 * button 'highlighting' can behave correctly.
		 * @param metadata A json-formatted string of key:values.
		 */
		set_metadata(metadata?: string | null): void;
		/**
		 * Sets the status icon name. This is not shown to users.
		 * @param name a name (this defaults to the name of the application, if not set)
		 */
		set_name(name: string): void;
		/**
		 * See the {@link StatusIcon.primary_menu} property for details
		 * @param menu A #GtkMenu to display when the primary mouse button is released.
		 */
		set_primary_menu(menu?: Gtk.Menu | null): void;
		/**
		 * See the {@link StatusIcon.secondary_menu} property for details
		 * @param menu A #GtkMenu to display when the primary mouse button is released.
		 */
		set_secondary_menu(menu?: Gtk.Menu | null): void;
		/**
		 * Sets the tooltip text
		 * @param tooltip_text the text to show in the tooltip
		 */
		set_tooltip_text(tooltip_text: string): void;
		/**
		 * Sets the visibility of the status icon
		 * @param visible whether or not the status icon should be visible
		 */
		set_visible(visible: boolean): void;
		/**
		 * Gets emitted when the user activates the status icon.  If the XAppStatusIcon:primary-menu or
		 * XAppStatusIcon:secondary-menu is not %NULL, this signal is skipped for the respective button
		 * presses.  A middle button click will always send this signal when pressed.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - button: The button that was pressed 
		 *  - time: The time supplied by the event, or 0 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "activate", callback: (owner: this, button: number, time: number) => void): number;
		/**
		 * Gets emitted when there is a button press received from an applet
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - x: The absolute x position to use for menu positioning 
		 *  - y: The absolute y position to use for menu positioning 
		 *  - button: The button that was pressed 
		 *  - time: The time supplied by the event, or 0 
		 *  - panel_position: The #GtkPositionType to use for menu positioning 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "button-press-event", callback: (owner: this, x: number, y: number, button: number, time: number, panel_position: number) => void): number;
		/**
		 * Gets emitted when there is a button release received from an applet
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - x: The absolute x position to use for menu positioning 
		 *  - y: The absolute y position to use for menu positioning 
		 *  - button: The button that was released 
		 *  - time: The time supplied by the event, or 0 
		 *  - panel_position: The #GtkPositionType to use for menu positioning 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "button-release-event", callback: (owner: this, x: number, y: number, button: number, time: number, panel_position: number) => void): number;
		/**
		 * Gets emitted when the user uses the mouse scroll wheel over the status icon.
		 * For the most part, amounts will always be 1, unless an applet supports smooth
		 * scrolling.  Generally the direction value is most important.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - amount: The amount of movement for the scroll event 
		 *  - direction: the {@link ScrollDirection} of the scroll event 
		 *  - time: The time supplied by the event, or 0 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "scroll-event", callback: (owner: this, amount: number, direction: ScrollDirection, time: number) => void): number;
		/**
		 * Gets emitted when the state of the icon changes. If you wish
		 * to react to changes in how the status icon is being handled
		 * (perhaps to alter the menu or other click behavior), you should
		 * connect to this - see {@link StatusIconState} for more details.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - new_state: The new {@link StatusIconState} of the icon 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "state-changed", callback: (owner: this, new_state: StatusIconState) => void): number;

		connect(signal: "notify::icon-size", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::primary-menu", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::secondary-menu", callback: (owner: this, ...args: any) => void): number;

	}

	type StatusIconInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IStatusIcon,
		"icon_size" |
		"name" |
		"primary_menu" |
		"secondary_menu">;

	export interface StatusIconInitOptions extends StatusIconInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StatusIcon} instead.
	 */
	type StatusIconMixin = IStatusIcon & GObject.Object;

	interface StatusIcon extends StatusIconMixin {}

	class StatusIcon {
		public constructor(options?: Partial<StatusIconInitOptions>);
		/**
		 * Creates a new {@link StatusIcon} instance
		 * @returns a new {@link StatusIcon}. Use g_object_unref when finished.
		 */
		public static new(): StatusIcon;
		/**
		 * Creates a new {@link StatusIcon} instance and sets its name to %name.
		 * @param name
		 * @returns a new {@link StatusIcon}. Use g_object_unref when finished.
		 */
		public static new_with_name(name: string): StatusIcon;
		/**
		 * Looks for the existence of any active {@link StatusIconMonitors} on the bus.
		 * @returns %TRUE if at least one monitor was found.
		 */
		public static any_monitors(): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StatusIconInterfaceProxy} instead.
	 */
	interface IStatusIconInterfaceProxy {

	}

	type StatusIconInterfaceProxyInitOptionsMixin = Gio.DBusProxyInitOptions & Gio.AsyncInitableInitOptions & Gio.DBusInterfaceInitOptions & Gio.InitableInitOptions & StatusIconInterfaceInitOptions
	export interface StatusIconInterfaceProxyInitOptions extends StatusIconInterfaceProxyInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StatusIconInterfaceProxy} instead.
	 */
	type StatusIconInterfaceProxyMixin = IStatusIconInterfaceProxy & Gio.DBusProxy & Gio.AsyncInitable & Gio.DBusInterface & Gio.Initable & StatusIconInterface;

	/**
	 * The {@link StatusIconInterfaceProxy} structure contains only private data and should only be accessed using the provided API.
	 */
	interface StatusIconInterfaceProxy extends StatusIconInterfaceProxyMixin {}

	class StatusIconInterfaceProxy {
		public constructor(options?: Partial<StatusIconInterfaceProxyInitOptions>);
		/**
		 * Finishes an operation started with {@link Xapp.status_icon_interface_proxy_new}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Xapp.status_icon_interface_proxy_new}.
		 * @returns The constructed proxy object or %NULL if #error is set.
		 */
		public static new_finish(res: Gio.AsyncResult): StatusIconInterfaceProxy;
		/**
		 * Finishes an operation started with {@link Xapp.status_icon_interface_proxy_new_for_bus}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Xapp.status_icon_interface_proxy_new_for_bus}.
		 * @returns The constructed proxy object or %NULL if #error is set.
		 */
		public static new_for_bus_finish(res: Gio.AsyncResult): StatusIconInterfaceProxy;
		/**
		 * Like {@link Xapp.status_icon_interface_proxy_new_sync} but takes a #GBusType instead of a #GDBusConnection.
		 * 
		 * The calling thread is blocked until a reply is received.
		 * 
		 * See xapp_status_icon_interface_proxy_new_for_bus() for the asynchronous version of this constructor.
		 * @param bus_type A #GBusType.
		 * @param flags Flags from the #GDBusProxyFlags enumeration.
		 * @param name A bus name (well-known or unique).
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns The constructed proxy object or %NULL if #error is set.
		 */
		public static new_for_bus_sync(bus_type: Gio.BusType, flags: Gio.DBusProxyFlags, name: string, object_path: string, cancellable?: Gio.Cancellable | null): StatusIconInterfaceProxy;
		/**
		 * Synchronously creates a proxy for the D-Bus interface <link linkend="gdbus-interface-org-x-StatusIcon.top_of_page">org.x.StatusIcon</link>. See {@link G.dbus_proxy_new_sync} for more details.
		 * 
		 * The calling thread is blocked until a reply is received.
		 * 
		 * See xapp_status_icon_interface_proxy_new() for the asynchronous version of this constructor.
		 * @param connection A #GDBusConnection.
		 * @param flags Flags from the #GDBusProxyFlags enumeration.
		 * @param name A bus name (well-known or unique) or %NULL if #connection is not a message bus connection.
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns The constructed proxy object or %NULL if #error is set.
		 */
		public static new_sync(connection: Gio.DBusConnection, flags: Gio.DBusProxyFlags, name: string | null, object_path: string, cancellable?: Gio.Cancellable | null): StatusIconInterfaceProxy;
		/**
		 * Asynchronously creates a proxy for the D-Bus interface <link linkend="gdbus-interface-org-x-StatusIcon.top_of_page">org.x.StatusIcon</link>. See {@link G.dbus_proxy_new} for more details.
		 * 
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call xapp_status_icon_interface_proxy_new_finish() to get the result of the operation.
		 * 
		 * See xapp_status_icon_interface_proxy_new_sync() for the synchronous, blocking version of this constructor.
		 * @param connection A #GDBusConnection.
		 * @param flags Flags from the #GDBusProxyFlags enumeration.
		 * @param name A bus name (well-known or unique) or %NULL if #connection is not a message bus connection.
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @param callback A #GAsyncReadyCallback to call when the request is satisfied.
		 */
		public static new(connection: Gio.DBusConnection, flags: Gio.DBusProxyFlags, name: string | null, object_path: string, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Like {@link Xapp.status_icon_interface_proxy_new} but takes a #GBusType instead of a #GDBusConnection.
		 * 
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call xapp_status_icon_interface_proxy_new_for_bus_finish() to get the result of the operation.
		 * 
		 * See xapp_status_icon_interface_proxy_new_for_bus_sync() for the synchronous, blocking version of this constructor.
		 * @param bus_type A #GBusType.
		 * @param flags Flags from the #GDBusProxyFlags enumeration.
		 * @param name A bus name (well-known or unique).
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @param callback A #GAsyncReadyCallback to call when the request is satisfied.
		 */
		public static new_for_bus(bus_type: Gio.BusType, flags: Gio.DBusProxyFlags, name: string, object_path: string, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StatusIconInterfaceSkeleton} instead.
	 */
	interface IStatusIconInterfaceSkeleton {

	}

	type StatusIconInterfaceSkeletonInitOptionsMixin = Gio.DBusInterfaceSkeletonInitOptions & Gio.DBusInterfaceInitOptions & StatusIconInterfaceInitOptions
	export interface StatusIconInterfaceSkeletonInitOptions extends StatusIconInterfaceSkeletonInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StatusIconInterfaceSkeleton} instead.
	 */
	type StatusIconInterfaceSkeletonMixin = IStatusIconInterfaceSkeleton & Gio.DBusInterfaceSkeleton & Gio.DBusInterface & StatusIconInterface;

	/**
	 * The {@link StatusIconInterfaceSkeleton} structure contains only private data and should only be accessed using the provided API.
	 */
	interface StatusIconInterfaceSkeleton extends StatusIconInterfaceSkeletonMixin {}

	class StatusIconInterfaceSkeleton {
		public constructor(options?: Partial<StatusIconInterfaceSkeletonInitOptions>);
		/**
		 * Creates a skeleton object for the D-Bus interface <link linkend="gdbus-interface-org-x-StatusIcon.top_of_page">org.x.StatusIcon</link>.
		 * @returns The skeleton object.
		 */
		public static new(): StatusIconInterfaceSkeleton;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StatusIconMonitor} instead.
	 */
	interface IStatusIconMonitor {
		/**
		 * List known icon proxies.
		 * @returns a #GList of icons
		 */
		list_icons(): StatusIconMonitor[];
		/**
		 * This signal is emitted by the monitor when it has discovered a new
		 * {@link StatusIcon} on the bus.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - proxy: the interface proxy for the {@link StatusIcon} that has been added. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "icon-added", callback: (owner: this, proxy: StatusIconInterfaceProxy) => void): number;
		/**
		 * This signal is emitted by the monitor when an {@link StatusIcon} has disappeared
		 * from the bus.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - proxy: the {@link StatusIcon} proxy that has been removed. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "icon-removed", callback: (owner: this, proxy: StatusIconInterfaceProxy) => void): number;

	}

	type StatusIconMonitorInitOptionsMixin = GObject.ObjectInitOptions
	export interface StatusIconMonitorInitOptions extends StatusIconMonitorInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StatusIconMonitor} instead.
	 */
	type StatusIconMonitorMixin = IStatusIconMonitor & GObject.Object;

	interface StatusIconMonitor extends StatusIconMonitorMixin {}

	class StatusIconMonitor {
		public constructor(options?: Partial<StatusIconMonitorInitOptions>);
		/**
		 * Creates a new monitor.
		 * @returns a new {@link StatusIconMonitor}. Use g_object_unref when finished.
		 */
		public static new(): StatusIconMonitor;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StyleManager} instead.
	 */
	interface IStyleManager {
		/**
		 * The widget to be styled.
		 */
		widget: Gtk.Widget;
		/**
		 * Gets the #GtkWidget the style manager currently applies styles to.
		 * @returns the #GtkWidget previously set on the style manager, or %NULL.
		 */
		get_widget(): Gtk.Widget;
		/**
		 * Removes the given style property from the widget if set.
		 * @param name the property name
		 */
		remove_style_property(name: string): void;
		/**
		 * Sets the css font property on the widget based on the supplied pango font description string.
		 * @param desc_string a pango font description string
		 */
		set_from_pango_font_string(desc_string: string): void;
		/**
		 * Adds the given style property to the widget. If the property has already been set, the value will be replaced.
		 * @param name the property name
		 * @param value the value to set the property to
		 */
		set_style_property(name: string, value: string): void;
		/**
		 * Sets the #GtkWidget the style manager will apply styles to.
		 * @param widget the #GtkWidget that the style manager will apply styles to, or
		 * %NULL to unset the current widget and remove all styles currently set by
		 * this {@link StyleManager} instance.
		 */
		set_widget(widget: Gtk.Widget): void;
		connect(signal: "notify::widget", callback: (owner: this, ...args: any) => void): number;

	}

	type StyleManagerInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IStyleManager,
		"widget">;

	export interface StyleManagerInitOptions extends StyleManagerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StyleManager} instead.
	 */
	type StyleManagerMixin = IStyleManager & GObject.Object;

	interface StyleManager extends StyleManagerMixin {}

	class StyleManager {
		public constructor(options?: Partial<StyleManagerInitOptions>);
		/**
		 * Creates a new {@link StyleManager} instance
		 * @returns a new {@link StyleManager}. Use g_object_unref when finished.
		 */
		public static new(): StyleManager;
	}

	export interface FavoriteInfoInitOptions {}
	/**
	 * Information related to a single favorite file.
	 */
	interface FavoriteInfo {}
	class FavoriteInfo {
		public constructor(options?: Partial<FavoriteInfoInitOptions>);
		/**
		 * The uri to the favorite file.
		 */
		public uri: string;
		/**
		 * The name for use when displaying the item. This may not exactly match
		 * the filename if there are files with the same name but in different folders.
		 */
		public display_name: string;
		/**
		 * The mimetype calculated for the uri when it was added to favorites.
		 */
		public cached_mimetype: string;
		/**
		 * Makes an exact copy of an existing {@link FavoriteInfo}.
		 * @returns a new {@link FavoriteInfo}.  Free using #xapp_favorite_info_free.
		 * 
		 * Since 2.0
		 */
		public copy(): FavoriteInfo;
		/**
		 * Destroys the {@link FavoriteInfo}.
		 * 
		 * Since 2.0
		 */
		public free(): void;
	}

	export interface ObjectIfaceInitOptions {}
	/**
	 * Virtual table for the {@link Object} interface.
	 */
	interface ObjectIface {}
	class ObjectIface {
		public constructor(options?: Partial<ObjectIfaceInitOptions>);
		/**
		 * The parent interface.
		 */
		public readonly parent_iface: GObject.TypeInterface;
	}

	export interface StatusIconInterfaceIfaceInitOptions {}
	/**
	 * Virtual table for the D-Bus interface <link linkend="gdbus-interface-org-x-StatusIcon.top_of_page">org.x.StatusIcon</link>.
	 */
	interface StatusIconInterfaceIface {}
	class StatusIconInterfaceIface {
		public constructor(options?: Partial<StatusIconInterfaceIfaceInitOptions>);
		/**
		 * The parent interface.
		 */
		public readonly parent_iface: GObject.TypeInterface;
		public handle_button_press: {(object: StatusIconInterface, invocation: Gio.DBusMethodInvocation, arg_x: number, arg_y: number, arg_button: number, arg_time: number, arg_panel_position: number): boolean;};
		public handle_button_release: {(object: StatusIconInterface, invocation: Gio.DBusMethodInvocation, arg_x: number, arg_y: number, arg_button: number, arg_time: number, arg_panel_position: number): boolean;};
		public handle_scroll: {(object: StatusIconInterface, invocation: Gio.DBusMethodInvocation, arg_delta: number, arg_orientation: number, arg_time: number): boolean;};
		public get_icon_name: {(object: StatusIconInterface): string | null;};
		public get_icon_size: {(object: StatusIconInterface): number;};
		public get_label: {(object: StatusIconInterface): string | null;};
		public get_metadata: {(object: StatusIconInterface): string | null;};
		public get_name: {(object: StatusIconInterface): string | null;};
		public get_primary_menu_is_open: {(object: StatusIconInterface): boolean;};
		public get_secondary_menu_is_open: {(object: StatusIconInterface): boolean;};
		public get_tooltip_text: {(object: StatusIconInterface): string | null;};
		public get_visible: {(object: StatusIconInterface): boolean;};
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Object} instead.
	 */
	interface IObject {
		/**
		 * The {@link StatusIconInterface} instance corresponding to the D-Bus interface <link linkend="gdbus-interface-org-x-StatusIcon.top_of_page">org.x.StatusIcon</link>, if any.
		 * 
		 * Connect to the #GObject::notify signal to get informed of property changes.
		 */
		status_icon_interface: StatusIconInterface;
		/**
		 * Gets the {@link StatusIconInterface} instance for the D-Bus interface <link linkend="gdbus-interface-org-x-StatusIcon.top_of_page">org.x.StatusIcon</link> on #object, if any.
		 * @returns A {@link StatusIconInterface} that must be freed with {@link GObject.unref} or %NULL if #object does not implement the interface.
		 */
		get_status_icon_interface(): StatusIconInterface | null;
		/**
		 * Like {@link Xapp.object_get_status_icon_interface} but doesn't increase the reference count on the returned object.
		 * 
		 * It is not safe to use the returned object if you are on another thread than the one where the #GDBusObjectManagerClient or #GDBusObjectManagerServer for #object is running.
		 * @returns A {@link StatusIconInterface} or %NULL if #object does not implement the interface. Do not free the returned object, it is owned by #object.
		 */
		peek_status_icon_interface(): StatusIconInterface | null;
		connect(signal: "notify::status-icon-interface", callback: (owner: this, ...args: any) => void): number;

	}

	type ObjectInitOptionsMixin = Pick<IObject,
		"status_icon_interface">;

	export interface ObjectInitOptions extends ObjectInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Object} instead.
	 */
	type ObjectMixin = IObject;

	/**
	 * The {@link Object} type is a specialized container of interfaces.
	 */
	interface Object extends ObjectMixin {}

	class Object {
		public constructor(options?: Partial<ObjectInitOptions>);
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StatusIconInterface} instead.
	 */
	interface IStatusIconInterface {
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-x-StatusIcon.IconName">"IconName"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		icon_name: string;
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-x-StatusIcon.IconSize">"IconSize"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is both readable and writable, it is meaningful to both read from it and write to it on both the service- and client-side.
		 */
		icon_size: number;
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-x-StatusIcon.Label">"Label"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		label: string;
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-x-StatusIcon.Metadata">"Metadata"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		metadata: string;
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-x-StatusIcon.Name">"Name"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		name: string;
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-x-StatusIcon.PrimaryMenuIsOpen">"PrimaryMenuIsOpen"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		primary_menu_is_open: boolean;
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-x-StatusIcon.SecondaryMenuIsOpen">"SecondaryMenuIsOpen"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		secondary_menu_is_open: boolean;
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-x-StatusIcon.TooltipText">"TooltipText"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		tooltip_text: string;
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-x-StatusIcon.Visible">"Visible"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		visible: boolean;
		/**
		 * Asynchronously invokes the <link linkend="gdbus-method-org-x-StatusIcon.ButtonPress">ButtonPress()</link> D-Bus method on #proxy.
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call xapp_status_icon_interface_call_button_press_finish() to get the result of the operation.
		 * 
		 * See xapp_status_icon_interface_call_button_press_sync() for the synchronous, blocking version of this method.
		 * @param arg_x Argument to pass with the method invocation.
		 * @param arg_y Argument to pass with the method invocation.
		 * @param arg_button Argument to pass with the method invocation.
		 * @param arg_time Argument to pass with the method invocation.
		 * @param arg_panel_position Argument to pass with the method invocation.
		 * @param cancellable A #GCancellable or %NULL.
		 * @param callback A #GAsyncReadyCallback to call when the request is satisfied or %NULL.
		 */
		call_button_press(arg_x: number, arg_y: number, arg_button: number, arg_time: number, arg_panel_position: number, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Finishes an operation started with {@link Xapp.status_icon_interface_call_button_press}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Xapp.status_icon_interface_call_button_press}.
		 * @returns %TRUE if the call succeeded, %FALSE if #error is set.
		 */
		call_button_press_finish(res: Gio.AsyncResult): boolean;
		/**
		 * Synchronously invokes the <link linkend="gdbus-method-org-x-StatusIcon.ButtonPress">ButtonPress()</link> D-Bus method on #proxy. The calling thread is blocked until a reply is received.
		 * 
		 * See xapp_status_icon_interface_call_button_press() for the asynchronous version of this method.
		 * @param arg_x Argument to pass with the method invocation.
		 * @param arg_y Argument to pass with the method invocation.
		 * @param arg_button Argument to pass with the method invocation.
		 * @param arg_time Argument to pass with the method invocation.
		 * @param arg_panel_position Argument to pass with the method invocation.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns %TRUE if the call succeeded, %FALSE if #error is set.
		 */
		call_button_press_sync(arg_x: number, arg_y: number, arg_button: number, arg_time: number, arg_panel_position: number, cancellable?: Gio.Cancellable | null): boolean;
		/**
		 * Asynchronously invokes the <link linkend="gdbus-method-org-x-StatusIcon.ButtonRelease">ButtonRelease()</link> D-Bus method on #proxy.
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call xapp_status_icon_interface_call_button_release_finish() to get the result of the operation.
		 * 
		 * See xapp_status_icon_interface_call_button_release_sync() for the synchronous, blocking version of this method.
		 * @param arg_x Argument to pass with the method invocation.
		 * @param arg_y Argument to pass with the method invocation.
		 * @param arg_button Argument to pass with the method invocation.
		 * @param arg_time Argument to pass with the method invocation.
		 * @param arg_panel_position Argument to pass with the method invocation.
		 * @param cancellable A #GCancellable or %NULL.
		 * @param callback A #GAsyncReadyCallback to call when the request is satisfied or %NULL.
		 */
		call_button_release(arg_x: number, arg_y: number, arg_button: number, arg_time: number, arg_panel_position: number, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Finishes an operation started with {@link Xapp.status_icon_interface_call_button_release}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Xapp.status_icon_interface_call_button_release}.
		 * @returns %TRUE if the call succeeded, %FALSE if #error is set.
		 */
		call_button_release_finish(res: Gio.AsyncResult): boolean;
		/**
		 * Synchronously invokes the <link linkend="gdbus-method-org-x-StatusIcon.ButtonRelease">ButtonRelease()</link> D-Bus method on #proxy. The calling thread is blocked until a reply is received.
		 * 
		 * See xapp_status_icon_interface_call_button_release() for the asynchronous version of this method.
		 * @param arg_x Argument to pass with the method invocation.
		 * @param arg_y Argument to pass with the method invocation.
		 * @param arg_button Argument to pass with the method invocation.
		 * @param arg_time Argument to pass with the method invocation.
		 * @param arg_panel_position Argument to pass with the method invocation.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns %TRUE if the call succeeded, %FALSE if #error is set.
		 */
		call_button_release_sync(arg_x: number, arg_y: number, arg_button: number, arg_time: number, arg_panel_position: number, cancellable?: Gio.Cancellable | null): boolean;
		/**
		 * Asynchronously invokes the <link linkend="gdbus-method-org-x-StatusIcon.Scroll">Scroll()</link> D-Bus method on #proxy.
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call xapp_status_icon_interface_call_scroll_finish() to get the result of the operation.
		 * 
		 * See xapp_status_icon_interface_call_scroll_sync() for the synchronous, blocking version of this method.
		 * @param arg_delta Argument to pass with the method invocation.
		 * @param arg_orientation Argument to pass with the method invocation.
		 * @param arg_time Argument to pass with the method invocation.
		 * @param cancellable A #GCancellable or %NULL.
		 * @param callback A #GAsyncReadyCallback to call when the request is satisfied or %NULL.
		 */
		call_scroll(arg_delta: number, arg_orientation: number, arg_time: number, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Finishes an operation started with {@link Xapp.status_icon_interface_call_scroll}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Xapp.status_icon_interface_call_scroll}.
		 * @returns %TRUE if the call succeeded, %FALSE if #error is set.
		 */
		call_scroll_finish(res: Gio.AsyncResult): boolean;
		/**
		 * Synchronously invokes the <link linkend="gdbus-method-org-x-StatusIcon.Scroll">Scroll()</link> D-Bus method on #proxy. The calling thread is blocked until a reply is received.
		 * 
		 * See xapp_status_icon_interface_call_scroll() for the asynchronous version of this method.
		 * @param arg_delta Argument to pass with the method invocation.
		 * @param arg_orientation Argument to pass with the method invocation.
		 * @param arg_time Argument to pass with the method invocation.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns %TRUE if the call succeeded, %FALSE if #error is set.
		 */
		call_scroll_sync(arg_delta: number, arg_orientation: number, arg_time: number, cancellable?: Gio.Cancellable | null): boolean;
		/**
		 * Helper function used in service implementations to finish handling invocations of the <link linkend="gdbus-method-org-x-StatusIcon.ButtonPress">ButtonPress()</link> D-Bus method. If you instead want to finish handling an invocation by returning an error, use g_dbus_method_invocation_return_error() or similar.
		 * 
		 * This method will free #invocation, you cannot use it afterwards.
		 * @param invocation A #GDBusMethodInvocation.
		 */
		complete_button_press(invocation: Gio.DBusMethodInvocation): void;
		/**
		 * Helper function used in service implementations to finish handling invocations of the <link linkend="gdbus-method-org-x-StatusIcon.ButtonRelease">ButtonRelease()</link> D-Bus method. If you instead want to finish handling an invocation by returning an error, use g_dbus_method_invocation_return_error() or similar.
		 * 
		 * This method will free #invocation, you cannot use it afterwards.
		 * @param invocation A #GDBusMethodInvocation.
		 */
		complete_button_release(invocation: Gio.DBusMethodInvocation): void;
		/**
		 * Helper function used in service implementations to finish handling invocations of the <link linkend="gdbus-method-org-x-StatusIcon.Scroll">Scroll()</link> D-Bus method. If you instead want to finish handling an invocation by returning an error, use g_dbus_method_invocation_return_error() or similar.
		 * 
		 * This method will free #invocation, you cannot use it afterwards.
		 * @param invocation A #GDBusMethodInvocation.
		 */
		complete_scroll(invocation: Gio.DBusMethodInvocation): void;
		/**
		 * Gets a copy of the <link linkend="gdbus-property-org-x-StatusIcon.IconName">"IconName"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value or %NULL if the property is not set. The returned value should be freed with {@link G.free}.
		 */
		dup_icon_name(): string | null;
		/**
		 * Gets a copy of the <link linkend="gdbus-property-org-x-StatusIcon.Label">"Label"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value or %NULL if the property is not set. The returned value should be freed with {@link G.free}.
		 */
		dup_label(): string | null;
		/**
		 * Gets a copy of the <link linkend="gdbus-property-org-x-StatusIcon.Metadata">"Metadata"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value or %NULL if the property is not set. The returned value should be freed with {@link G.free}.
		 */
		dup_metadata(): string | null;
		/**
		 * Gets a copy of the <link linkend="gdbus-property-org-x-StatusIcon.Name">"Name"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value or %NULL if the property is not set. The returned value should be freed with {@link G.free}.
		 */
		dup_name(): string | null;
		/**
		 * Gets a copy of the <link linkend="gdbus-property-org-x-StatusIcon.TooltipText">"TooltipText"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value or %NULL if the property is not set. The returned value should be freed with {@link G.free}.
		 */
		dup_tooltip_text(): string | null;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-x-StatusIcon.IconName">"IconName"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * 
		 * The returned value is only valid until the property changes so on the client-side it is only safe to use this function on the thread where #object was constructed. Use {@link Xapp.status_icon_interface_dup_icon_name} if on another thread.
		 * @returns The property value or %NULL if the property is not set. Do not free the returned value, it belongs to #object.
		 */
		get_icon_name(): string | null;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-x-StatusIcon.IconSize">"IconSize"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is both readable and writable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value.
		 */
		get_icon_size(): number;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-x-StatusIcon.Label">"Label"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * 
		 * The returned value is only valid until the property changes so on the client-side it is only safe to use this function on the thread where #object was constructed. Use {@link Xapp.status_icon_interface_dup_label} if on another thread.
		 * @returns The property value or %NULL if the property is not set. Do not free the returned value, it belongs to #object.
		 */
		get_label(): string | null;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-x-StatusIcon.Metadata">"Metadata"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * 
		 * The returned value is only valid until the property changes so on the client-side it is only safe to use this function on the thread where #object was constructed. Use {@link Xapp.status_icon_interface_dup_metadata} if on another thread.
		 * @returns The property value or %NULL if the property is not set. Do not free the returned value, it belongs to #object.
		 */
		get_metadata(): string | null;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-x-StatusIcon.Name">"Name"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * 
		 * The returned value is only valid until the property changes so on the client-side it is only safe to use this function on the thread where #object was constructed. Use {@link Xapp.status_icon_interface_dup_name} if on another thread.
		 * @returns The property value or %NULL if the property is not set. Do not free the returned value, it belongs to #object.
		 */
		get_name(): string | null;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-x-StatusIcon.PrimaryMenuIsOpen">"PrimaryMenuIsOpen"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value.
		 */
		get_primary_menu_is_open(): boolean;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-x-StatusIcon.SecondaryMenuIsOpen">"SecondaryMenuIsOpen"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value.
		 */
		get_secondary_menu_is_open(): boolean;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-x-StatusIcon.TooltipText">"TooltipText"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * 
		 * The returned value is only valid until the property changes so on the client-side it is only safe to use this function on the thread where #object was constructed. Use {@link Xapp.status_icon_interface_dup_tooltip_text} if on another thread.
		 * @returns The property value or %NULL if the property is not set. Do not free the returned value, it belongs to #object.
		 */
		get_tooltip_text(): string | null;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-x-StatusIcon.Visible">"Visible"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value.
		 */
		get_visible(): boolean;
		/**
		 * Sets the <link linkend="gdbus-property-org-x-StatusIcon.IconName">"IconName"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_icon_name(value: string): void;
		/**
		 * Sets the <link linkend="gdbus-property-org-x-StatusIcon.IconSize">"IconSize"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is both readable and writable, it is meaningful to use this function on both the client- and service-side.
		 * @param value The value to set.
		 */
		set_icon_size(value: number): void;
		/**
		 * Sets the <link linkend="gdbus-property-org-x-StatusIcon.Label">"Label"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_label(value: string): void;
		/**
		 * Sets the <link linkend="gdbus-property-org-x-StatusIcon.Metadata">"Metadata"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_metadata(value: string): void;
		/**
		 * Sets the <link linkend="gdbus-property-org-x-StatusIcon.Name">"Name"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_name(value: string): void;
		/**
		 * Sets the <link linkend="gdbus-property-org-x-StatusIcon.PrimaryMenuIsOpen">"PrimaryMenuIsOpen"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_primary_menu_is_open(value: boolean): void;
		/**
		 * Sets the <link linkend="gdbus-property-org-x-StatusIcon.SecondaryMenuIsOpen">"SecondaryMenuIsOpen"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_secondary_menu_is_open(value: boolean): void;
		/**
		 * Sets the <link linkend="gdbus-property-org-x-StatusIcon.TooltipText">"TooltipText"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_tooltip_text(value: string): void;
		/**
		 * Sets the <link linkend="gdbus-property-org-x-StatusIcon.Visible">"Visible"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_visible(value: boolean): void;
		/**
		 * Signal emitted when a remote caller is invoking the <link linkend="gdbus-method-org-x-StatusIcon.ButtonPress">ButtonPress()</link> D-Bus method.
		 * 
		 * If a signal handler returns %TRUE, it means the signal handler will handle the invocation (e.g. take a reference to #invocation and eventually call xapp_status_icon_interface_complete_button_press() or e.g. g_dbus_method_invocation_return_error() on it) and no order signal handlers will run. If no signal handler handles the invocation, the %G_DBUS_ERROR_UNKNOWN_METHOD error is returned.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - invocation: A #GDBusMethodInvocation. 
		 *  - arg_x: Argument passed by remote caller. 
		 *  - arg_y: Argument passed by remote caller. 
		 *  - arg_button: Argument passed by remote caller. 
		 *  - arg_time: Argument passed by remote caller. 
		 *  - arg_panel_position: Argument passed by remote caller. 
		 *  - returns %G_DBUS_METHOD_INVOCATION_HANDLED or %TRUE if the invocation was handled, %G_DBUS_METHOD_INVOCATION_UNHANDLED or %FALSE to let other signal handlers run. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "handle-button-press", callback: (owner: this, invocation: Gio.DBusMethodInvocation, arg_x: number, arg_y: number, arg_button: number, arg_time: number, arg_panel_position: number) => boolean): number;
		/**
		 * Signal emitted when a remote caller is invoking the <link linkend="gdbus-method-org-x-StatusIcon.ButtonRelease">ButtonRelease()</link> D-Bus method.
		 * 
		 * If a signal handler returns %TRUE, it means the signal handler will handle the invocation (e.g. take a reference to #invocation and eventually call xapp_status_icon_interface_complete_button_release() or e.g. g_dbus_method_invocation_return_error() on it) and no order signal handlers will run. If no signal handler handles the invocation, the %G_DBUS_ERROR_UNKNOWN_METHOD error is returned.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - invocation: A #GDBusMethodInvocation. 
		 *  - arg_x: Argument passed by remote caller. 
		 *  - arg_y: Argument passed by remote caller. 
		 *  - arg_button: Argument passed by remote caller. 
		 *  - arg_time: Argument passed by remote caller. 
		 *  - arg_panel_position: Argument passed by remote caller. 
		 *  - returns %G_DBUS_METHOD_INVOCATION_HANDLED or %TRUE if the invocation was handled, %G_DBUS_METHOD_INVOCATION_UNHANDLED or %FALSE to let other signal handlers run. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "handle-button-release", callback: (owner: this, invocation: Gio.DBusMethodInvocation, arg_x: number, arg_y: number, arg_button: number, arg_time: number, arg_panel_position: number) => boolean): number;
		/**
		 * Signal emitted when a remote caller is invoking the <link linkend="gdbus-method-org-x-StatusIcon.Scroll">Scroll()</link> D-Bus method.
		 * 
		 * If a signal handler returns %TRUE, it means the signal handler will handle the invocation (e.g. take a reference to #invocation and eventually call xapp_status_icon_interface_complete_scroll() or e.g. g_dbus_method_invocation_return_error() on it) and no order signal handlers will run. If no signal handler handles the invocation, the %G_DBUS_ERROR_UNKNOWN_METHOD error is returned.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - invocation: A #GDBusMethodInvocation. 
		 *  - arg_delta: Argument passed by remote caller. 
		 *  - arg_orientation: Argument passed by remote caller. 
		 *  - arg_time: Argument passed by remote caller. 
		 *  - returns %G_DBUS_METHOD_INVOCATION_HANDLED or %TRUE if the invocation was handled, %G_DBUS_METHOD_INVOCATION_UNHANDLED or %FALSE to let other signal handlers run. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "handle-scroll", callback: (owner: this, invocation: Gio.DBusMethodInvocation, arg_delta: number, arg_orientation: number, arg_time: number) => boolean): number;

		connect(signal: "notify::icon-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::icon-size", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::label", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::metadata", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::primary-menu-is-open", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::secondary-menu-is-open", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::tooltip-text", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::visible", callback: (owner: this, ...args: any) => void): number;

	}

	type StatusIconInterfaceInitOptionsMixin = Pick<IStatusIconInterface,
		"icon_name" |
		"icon_size" |
		"label" |
		"metadata" |
		"name" |
		"primary_menu_is_open" |
		"secondary_menu_is_open" |
		"tooltip_text" |
		"visible">;

	export interface StatusIconInterfaceInitOptions extends StatusIconInterfaceInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StatusIconInterface} instead.
	 */
	type StatusIconInterfaceMixin = IStatusIconInterface;

	/**
	 * Abstract interface type for the D-Bus interface <link linkend="gdbus-interface-org-x-StatusIcon.top_of_page">org.x.StatusIcon</link>.
	 */
	interface StatusIconInterface extends StatusIconInterfaceMixin {}

	class StatusIconInterface {
		public constructor(options?: Partial<StatusIconInterfaceInitOptions>);
		/**
		 * Gets a machine-readable description of the <link linkend="gdbus-interface-org-x-StatusIcon.top_of_page">org.x.StatusIcon</link> D-Bus interface.
		 * @returns A #GDBusInterfaceInfo. Do not free.
		 */
		public static interface_info(): Gio.DBusInterfaceInfo;
		/**
		 * Overrides all #GObject properties in the {@link StatusIconInterface} interface for a concrete class.
		 * The properties are overridden in the order they are defined.
		 * @param klass The class structure for a #GObject derived class.
		 * @param property_id_begin The property id to assign to the first overridden property.
		 * @returns The last property id.
		 */
		public static override_properties(klass: any, property_id_begin: number): number;
	}



	enum IconSize {
		_16 = 16,
		_22 = 22,
		_24 = 24,
		_32 = 32,
		_48 = 48,
		_96 = 96
	}

	/**
	 * Represents the direction of icon scroll events.
	 */
	enum ScrollDirection {
		/**
		 * Scroll theoretical content up.
		 */
		UP = 0,
		/**
		 * Scroll theoretical content down.
		 */
		DOWN = 1,
		/**
		 * Scroll theoretical content left.
		 */
		LEFT = 2,
		/**
		 * Scroll theoretical content right.
		 */
		RIGHT = 3
	}

	enum StatusIconState {
		/**
		 * The {@link StatusIcon} is currently being handled
		 * by an #XAppStatusIconMonitor (usually in an applet).
		 */
		NATIVE = 0,
		/**
		 * The {@link StatusIcon} is currently being handled
		 * by a legacy system tray implementation (using GtkStatusIcon).
		 */
		FALLBACK = 1,
		/**
		 * The {@link StatusIcon} is not currently being handled by any
		 * kind of status icon implementation.
		 */
		NO_SUPPORT = 2
	}

	interface FavoritesItemSelectedCallback {
		(favorites: Favorites, uri: string): void;
	}

	/**
	 * Converts a pango font description string to a string suitable for use with the css "font" tag. The font description must contain the font family and font size or conversion will fail and %NULL will be returned
	 * @param pango_font_string a pango font description string
	 * @returns the css compatible font string or %NULL if the conversion failed.
	 */
	function pango_font_string_to_css(pango_font_string: string): string;
	/**
	 * Sets the icon name hint for a window manager (like muffin) to make
	 * available when applications want to change their icons during runtime
	 * without having to resort to the internal low-res pixbufs that GdkWindow
	 * sets on the client side.  This also chains up and calls GtkWindow.set_icon_from_file
	 * for convenience and compatibility.  Set to %NULL to unset.
	 * @param window The #GtkWindow to set the icon name for
	 * @param file_name The icon path to set, or %NULL to unset.
	 */
	function set_window_icon_from_file(window: Gtk.Window, file_name: string | null): void;
	/**
	 * Sets the icon name hint for a window manager (like muffin) to make
	 * available when applications want to change their icons during runtime
	 * without having to resort to the internal low-res pixbufs that GdkWindow
	 * sets on the client side.  This is a function, not a method, for taking
	 * advantage of this feature with descendants of GtkWindows, such as
	 * GtkDialogs.  Sets gtk_window_set_icon_name as well, to avoid needing
	 * to have two calls each time.  Set to %NULL to unset.
	 * @param window The #GtkWindow to set the icon name for
	 * @param icon_name The icon name to set, or %NULL to unset.
	 */
	function set_window_icon_name(window: Gtk.Window, icon_name: string | null): void;
	/**
	 * Sets the progress hint for a window manager (like muffin) to make
	 * available when applications want to display the application's progress
	 * in some operation. The value sent to the WM will be clamped to
	 * between 0 and 100.
	 * 
	 * Note: If a window will stick around after progress is complete, you will
	 * probaby need to set progress to 0 to remove any progress effects on taskbars
	 * and window lists.
	 * 
	 * Setting progress will also cancel the 'pulsing' flag on the window as
	 * well, if it has been set.
	 * @param window The #GtkWindow to set the progress for
	 * @param progress The value to set for progress.
	 */
	function set_window_progress(window: Gtk.Window, progress: number): void;
	/**
	 * Sets the progress pulse hint hint for a window manager (like muffin)
	 * to make available when applications want to display indeterminate or
	 * ongoing progress in a task manager.
	 * 
	 * Note: If a window will stick around after progress is complete, you will
	 * probaby need to set progress to 0 to remove any progress effects on taskbars
	 * and window lists.  This will also remove the pulse state, if it is set.
	 * 
	 * Setting an explicit progress value will unset this flag.
	 * @param window The #GtkWindow to set the progress for
	 * @param pulse Whether to have pulsing set or not.
	 */
	function set_window_progress_pulse(window: Gtk.Window, pulse: boolean): void;
	/**
	 * Sets the icon name hint for a window manager (like muffin) to make
	 * available when applications want to change their icons during runtime
	 * without having to resort to the internal low-res pixbufs that GdkWindow
	 * sets on the client side.  This is a function, not a method, for applying
	 * the icon name property for a given (possibly foreign) window, by passing
	 * the window's XID.  Set to %NULL to unset.
	 * @param xid The Window to set the icon name for
	 * @param file_name The icon path to set, or %NULL to unset.
	 */
	function set_xid_icon_from_file(xid: number, file_name: string | null): void;
	/**
	 * Sets the icon name hint for a window manager (like muffin) to make
	 * available when applications want to change their icons during runtime
	 * without having to resort to the internal low-res pixbufs that GdkWindow
	 * sets on the client side.  This is a function, not a method, for applying
	 * the icon name property for a given (possibly foreign) window, by passing
	 * the window's XID.  Set to %NULL to unset.
	 * @param xid The Window to set the icon name for
	 * @param icon_name The icon name to set, or %NULL to unset.
	 */
	function set_xid_icon_name(xid: number, icon_name: string | null): void;
	/**
	 * Sets the progress hint for a window manager (like muffin) to make
	 * available when applications want to display the application's progress
	 * in some operation. The value sent to the WM will be clamped to
	 * between 0 and 100.
	 * 
	 * Setting progress will also cancel the 'pulsing' flag on the window as
	 * well, if it has been set.
	 * 
	 * Note: If a window will stick around after progress is complete, you will
	 * probaby need to set progress to 0 to remove any progress effects on taskbars
	 * and window lists.
	 * 
	 * This is a function, not a method, for applying the progress property for
	 * a given (possibly foreign) window, by passing the window's XID.
	 * @param xid The Window to set the progress for
	 * @param progress The value to set for progress.
	 */
	function set_xid_progress(xid: number, progress: number): void;
	/**
	 * Sets the progress pulse hint hint for a window manager (like muffin)
	 * to make available when applications want to display indeterminate or
	 * ongoing progress in a task manager.
	 * 
	 * Note: If a window will stick around after progress is complete, you will
	 * probaby need to set progress to 0 to remove any progress effects on taskbars
	 * and window lists.
	 * 
	 * Setting an explicit progress value will unset this flag.
	 * @param xid The Window to set the progress for
	 * @param pulse Whether to have pulsing set or not.
	 */
	function set_xid_progress_pulse(xid: number, pulse: boolean): void;
	/**
	 * Gets a machine-readable description of the <link linkend="gdbus-interface-org-x-StatusIcon.top_of_page">org.x.StatusIcon</link> D-Bus interface.
	 * @returns A #GDBusInterfaceInfo. Do not free.
	 */
	function status_icon_interface_interface_info(): Gio.DBusInterfaceInfo;
	/**
	 * Overrides all #GObject properties in the {@link StatusIconInterface} interface for a concrete class.
	 * The properties are overridden in the order they are defined.
	 * @param klass The class structure for a #GObject derived class.
	 * @param property_id_begin The property id to assign to the first overridden property.
	 * @returns The last property id.
	 */
	function status_icon_interface_override_properties(klass: any, property_id_begin: number): number;
	/**
	 * Check if the Session Manager is currently in the "Running" phase.
	 * @returns %TRUE if the session is running.
	 */
	function util_get_session_is_running(): boolean;
	/**
	 * Performs a check to see if on-demand mode for discrete graphics
	 * is supported.
	 * @returns %TRUE if supported.
	 */
	function util_gpu_offload_supported(): boolean;
}