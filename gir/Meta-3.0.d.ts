/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.Meta {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BackgroundActor} instead.
	 */
	interface IBackgroundActor {
		/**
		 * Factor to dim the background by, between 0.0 (black) and 1.0 (original
		 * colors)
		 */
		dim_factor: number;

		connect(signal: "notify::dim-factor", callback: (owner: this, ...args: any) => void): number;

	}

	type BackgroundActorInitOptionsMixin = Clutter.ActorInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IBackgroundActor,
		"dim_factor">;

	export interface BackgroundActorInitOptions extends BackgroundActorInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BackgroundActor} instead.
	 */
	type BackgroundActorMixin = IBackgroundActor & Clutter.Actor & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * This class handles tracking and painting the root window background.
	 * By integrating with {@link WindowGroup} we can avoid painting parts of
	 * the background that are obscured by other windows.
	 */
	interface BackgroundActor extends BackgroundActorMixin {}

	class BackgroundActor {
		public constructor(options?: Partial<BackgroundActorInitOptions>);
		/**
		 * Creates a new actor to draw the background for the given screen.
		 * @param screen the {@link Screen}
		 * @returns the newly created background actor
		 */
		public static new_for_screen(screen: Screen): Clutter.Actor;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Display} instead.
	 */
	interface IDisplay {
		readonly focus_window: Window;
		/**
		 * Use {@link Meta.Display.remove_custom_keybinding} to remove the binding.
		 * @param name the binding's unique name
		 * @param bindings array of parseable keystrokes
		 * @param callback function to run when the keybinding is invoked
		 * @param free_data function to free #user_data
		 * @returns %TRUE if the keybinding was added successfully,
		 *          otherwise %FALSE
		 */
		add_custom_keybinding(name: string, bindings: string[] | null, callback: KeyHandlerFunc, free_data: GLib.DestroyNotify): boolean;
		/**
		 * Save the specified serial and ignore crossing events with that
		 * serial for the purpose of focus-follows-mouse. This can be used
		 * for certain changes to the window hierarchy that we don't want
		 * to change the focus window, even if they cause the pointer to
		 * end up in a new window.
		 * @param serial the serial to ignore
		 */
		add_ignored_crossing_serial(serial: number): void;
		/**
		 * Add a keybinding at runtime. The key #name in #schema needs to be of type
		 * %G_VARIANT_TYPE_STRING_ARRAY, with each string describing a keybinding in
		 * the form of "&lt;Control&gt;a" or "&lt;Shift&gt;&lt;Alt&gt;F1". The parser
		 * is fairly liberal and allows lower or upper case, and also abbreviations
		 * such as "&lt;Ctl&gt;" and "&lt;Ctrl&gt;". If the key is set to the empty
		 * list or a list with a single element of either "" or "disabled", the
		 * keybinding is disabled.  If %META_KEY_BINDING_REVERSES is specified in
		 * #flags, the binding may be reversed by holding down the "shift" key;
		 * therefore, "&lt;Shift&gt;"
		 * cannot be one of the keys used. #handler is expected to check for the
		 * "shift" modifier in this case and reverse its action.
		 * 
		 * Use {@link Meta.Display.remove_keybinding} to remove the binding.
		 * @param name the binding's name
		 * @param schema the #GSettings schema where #name is stored
		 * @param flags flags to specify binding details
		 * @param handler function to run when the keybinding is invoked
		 * @param free_data function to free #user_data
		 * @returns %TRUE if the keybinding was added successfully,
		 *          otherwise %FALSE
		 */
		add_keybinding(name: string, schema: string, flags: KeyBindingFlags, handler: KeyHandlerFunc, free_data: GLib.DestroyNotify): boolean;
		begin_grab_op(screen: Screen, window: Window, op: GrabOp, pointer_already_grabbed: boolean, frame_action: boolean, button: number, modmask: number, timestamp: number, root_x: number, root_y: number): boolean;
		end_grab_op(timestamp: number): void;
		focus_the_no_focus_window(screen: Screen, timestamp: number): void;
		get_compositor(): Compositor;
		get_compositor_version(major: number, minor: number): void;
		get_current_time(): number;
		get_current_time_roundtrip(): number;
		get_damage_event_base(): number;
		/**
		 * Get the window that, according to events received from X server,
		 * currently has the input focus. We may have already sent a request
		 * to the X server to move the focus window elsewhere. (The
		 * expected_focus_window records where we've last set the input
		 * focus.)
		 * @returns The current focus window
		 */
		get_focus_window(): Window;
		/**
		 * Gets the current grab operation, if any.
		 * @returns the current grab operation, or %META_GRAB_OP_NONE if
		 * Muffin doesn't currently have a grab. %META_GRAB_OP_COMPOSITOR will
		 * be returned if a compositor-plugin modal operation is in effect
		 * (See {@link Muffin.begin_modal_for_plugin})
		 */
		get_grab_op(): GrabOp;
		get_ignored_modifier_mask(): number;
		/**
		 * Get the {@link KeyBindingAction} bound to %keycode. Only builtin
		 * keybindings have an associated #MetaKeyBindingAction, for
		 * bindings added dynamically with {@link Meta.Display.add_keybinding}
		 * the function will always return %META_KEYBINDING_ACTION_NONE.
		 * @param keycode Raw keycode
		 * @param mask Event mask
		 * @returns The action that should be taken for the given key, or
		 * %META_KEYBINDING_ACTION_NONE.
		 */
		get_keybinding_action(keycode: number, mask: number): KeyBindingAction;
		get_last_user_time(): number;
		/**
		 * Returns the window manager's leader window (as defined by the
		 * _NET_SUPPORTING_WM_CHECK mechanism of EWMH). For use by plugins that wish
		 * to attach additional custom properties to this window.
		 * @returns xid of the leader window.
		 */
		get_leader_window(): xlib.Window;
		get_screens(): Screen[];
		get_shape_event_base(): number;
		/**
		 * Determine the active window that should be displayed for Alt-TAB.
		 * @param type type of tab list
		 * @param screen a {@link Screen}
		 * @param workspace origin workspace
		 * @returns Current window
		 */
		get_tab_current(type: TabList, screen: Screen, workspace: Workspace): Window;
		/**
		 * Determine the list of windows that should be displayed for Alt-TAB
		 * functionality.  The windows are returned in most recently used order.
		 * @param type type of tab list
		 * @param screen a {@link Screen}
		 * @param workspace origin workspace
		 * @returns List of windows
		 */
		get_tab_list(type: TabList, screen: Screen, workspace: Workspace): Window[];
		/**
		 * Determine the next window that should be displayed for Alt-TAB
		 * functionality.
		 * @param type type of tab list
		 * @param screen a {@link Screen}
		 * @param workspace origin workspace
		 * @param window starting window
		 * @param backward If %TRUE, look for the previous window.
		 * @returns Next window
		 */
		get_tab_next(type: TabList, screen: Screen, workspace: Workspace, window: Window | null, backward: boolean): Window;
		get_xdisplay(): xlib.Display;
		has_shape(): boolean;
		keybinding_action_invoke_by_code(keycode: number, mask: number): void;
		/**
		 * Lists windows for the display, the #flags parameter for
		 * now determines whether override-redirect windows will be
		 * included.
		 * @param flags options for listing
		 * @returns the list of windows.
		 */
		list_windows(flags: ListWindowsFlags): Window[];
		lookup_group(group_leader: xlib.Window): Group;
		/**
		 * Rebuild all keybindings (typically done after adding, removing, or changing
		 * one or more keybindings)
		 */
		rebuild_keybindings(): void;
		/**
		 * Remove keybinding #name; the function will fail if #name is not a known
		 * keybinding or has not been added with {@link Meta.Display.add_custom_keybinding}.
		 * @param name name of the keybinding to remove
		 * @returns %TRUE if the binding has been removed sucessfully,
		 *          otherwise %FALSE
		 */
		remove_custom_keybinding(name: string): boolean;
		/**
		 * Remove keybinding #name; the function will fail if #name is not a known
		 * keybinding or has not been added with {@link Meta.Display.add_keybinding}.
		 * @param name name of the keybinding to remove
		 * @returns %TRUE if the binding has been removed sucessfully,
		 *          otherwise %FALSE
		 */
		remove_keybinding(name: string): boolean;
		/**
		 * Restart the current process.  Only intended for development purposes.
		 */
		restart(): void;
		/**
		 * Return the {@link Screen} corresponding to a specified X root window ID.
		 * @param xroot
		 * @returns the screen for the specified root window ID, or %NULL
		 */
		screen_for_root(xroot: xlib.Window): Screen;
		set_input_focus_window(window: Window, focus_frame: boolean, timestamp: number): void;
		/**
		 * Sorts a set of windows according to their current stacking order. If windows
		 * from multiple screens are present in the set of input windows, then all the
		 * windows on screen 0 are sorted below all the windows on screen 1, and so forth.
		 * Since the stacking order of override-redirect windows isn't controlled by
		 * Metacity, if override-redirect windows are in the input, the result may not
		 * correspond to the actual stacking order in the X server.
		 * 
		 * An example of using this would be to sort the list of transient dialogs for a
		 * window into their current stacking order.
		 * @param windows Set of windows
		 * @returns Input windows sorted by stacking order, from lowest to highest
		 */
		sort_windows_by_stacking(windows: Window[]): Window[];
		unmanage_screen(screen: Screen, timestamp: number): void;
		/**
		 * Xserver time can wraparound, thus comparing two timestamps needs to take
		 * this into account. If no wraparound has occurred, this is equivalent to
		 *   time1 < time2
		 * Otherwise, we need to account for the fact that wraparound can occur
		 * and the fact that a timestamp of 0 must be special-cased since it
		 * means "older than anything else".
		 * 
		 * Note that this is NOT an equivalent for time1 <= time2; if that's what
		 * you need then you'll need to swap the order of the arguments and negate
		 * the result.
		 * @param time1 An event timestamp
		 * @param time2 An event timestamp
		 * @returns 
		 */
		xserver_time_is_before(time1: number, time2: number): boolean;
		/**
		 * Returns %TRUE iff window is one of muffin's internal "no focus" windows
		 * (there is one per screen) which will have the focus when there is no
		 * actual client window focused.
		 * @param xwindow An X11 window
		 * @returns 
		 */
		xwindow_is_a_no_focus_window(xwindow: xlib.Window): boolean;
		connect(signal: "bell", callback: (owner: this, object: Window) => void): number;
		connect(signal: "gl-video-memory-purged", callback: (owner: this) => void): number;
		connect(signal: "grab-op-begin", callback: (owner: this, object: Screen, p0: Window, p1: GrabOp) => void): number;
		connect(signal: "grab-op-end", callback: (owner: this, object: Screen, p0: Window, p1: GrabOp) => void): number;
		/**
		 * The ::restart signal is emitted to indicate that Muffin
		 * will restart the process.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "restart", callback: (owner: this) => void): number;
		connect(signal: "window-created", callback: (owner: this, object: Window) => void): number;
		connect(signal: "window-demands-attention", callback: (owner: this, object: Window) => void): number;
		connect(signal: "window-marked-urgent", callback: (owner: this, object: Window) => void): number;
		connect(signal: "zoom-scroll-in", callback: (owner: this) => void): number;
		connect(signal: "zoom-scroll-out", callback: (owner: this) => void): number;

		connect(signal: "notify::focus-window", callback: (owner: this, ...args: any) => void): number;

	}

	type DisplayInitOptionsMixin = GObject.ObjectInitOptions
	export interface DisplayInitOptions extends DisplayInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Display} instead.
	 */
	type DisplayMixin = IDisplay & GObject.Object;

	interface Display extends DisplayMixin {}

	class Display {
		public constructor(options?: Partial<DisplayInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Plugin} instead.
	 */
	interface IPlugin {
		// readonly debug_mode: boolean;
		screen: Screen;
		/**
		 * This function is used to grab the keyboard and mouse for the exclusive
		 * use of the plugin. Correct operation requires that both the keyboard
		 * and mouse are grabbed, or thing will break. (In particular, other
		 * passive X grabs in Meta can trigger but not be handled by the normal
		 * keybinding handling code.) However, the plugin can establish the keyboard
		 * and/or mouse grabs ahead of time and pass in the
		 * %META_MODAL_POINTER_ALREADY_GRABBED and/or %META_MODAL_KEYBOARD_ALREADY_GRABBED
		 * options. This facility is provided for two reasons: first to allow using
		 * this function to establish modality after a passive grab, and second to
		 * allow using obscure features of XGrabPointer() and XGrabKeyboard() without
		 * having to add them to this API.
		 * @param grab_window the X window to grab the keyboard and mouse on
		 * @param cursor the cursor to use for the pointer grab, or None,
		 *          to use the normal cursor for the grab window and
		 *          its descendants.
		 * @param options flags that modify the behavior of the modal grab
		 * @param timestamp the timestamp used for establishing grabs
		 * @returns whether we successfully grabbed the keyboard and
		 *  mouse and made the plugin modal.
		 */
		begin_modal(grab_window: xlib.Window, cursor: xlib.Cursor, options: ModalOptions, timestamp: number): boolean;
		debug_mode(): boolean;
		destroy_completed(actor: WindowActor): void;
		/**
		 * Ends the modal operation begun with {@link Meta.Plugin.begin_modal}. This
		 * ungrabs both the mouse and keyboard even when
		 * %META_MODAL_POINTER_ALREADY_GRABBED or
		 * %META_MODAL_KEYBOARD_ALREADY_GRABBED were provided as options
		 * when beginnning the modal operation.
		 * @param timestamp the time used for releasing grabs
		 */
		end_modal(timestamp: number): void;
		get_info(): PluginInfo;
		/**
		 * Gets the {@link Screen} corresponding to a plugin. Each plugin instance
		 * is associated with exactly one screen; if Metacity is managing
		 * multiple screens, multiple plugin instances will be created.
		 * @returns the {@link Screen} for the plugin
		 */
		get_screen(): Screen;
		map_completed(actor: WindowActor): void;
		maximize_completed(actor: WindowActor): void;
		minimize_completed(actor: WindowActor): void;
		running(): boolean;
		switch_workspace_completed(): void;
		tile_completed(actor: WindowActor): void;
		unmaximize_completed(actor: WindowActor): void;
		connect(signal: "notify::debug-mode", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::screen", callback: (owner: this, ...args: any) => void): number;

	}

	type PluginInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IPlugin,
		"screen">;

	export interface PluginInitOptions extends PluginInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Plugin} instead.
	 */
	type PluginMixin = IPlugin & GObject.Object;

	interface Plugin extends PluginMixin {}

	class Plugin {
		public constructor(options?: Partial<PluginInitOptions>);
		public static manager_set_plugin_type(gtype: GObject.Type): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Screen} instead.
	 */
	interface IScreen {
		readonly keyboard_grabbed: boolean;
		readonly n_workspaces: number;
		/**
		 * Append a new workspace to the screen and (optionally) switch to that
		 * screen.
		 * @param activate %TRUE if the workspace should be switched to after creation
		 * @param timestamp if switching to a new workspace, timestamp to be used when
		 *   focusing a window on the new workspace. (Doesn't hurt to pass a valid
		 *   timestamp when available even if not switching workspaces.)
		 * @returns the newly appended workspace.
		 */
		append_new_workspace(activate: boolean, timestamp: number): Workspace;
		get_active_workspace(): Workspace;
		get_active_workspace_index(): number;
		/**
		 * Gets the index of the monitor that currently has the mouse pointer.
		 * @returns a monitor index
		 */
		get_current_monitor(): number;
		/**
		 * Retrieve the display associated with screen.
		 * @returns Display
		 */
		get_display(): Display;
		/**
		 * Stores the location and size of the indicated monitor in #geometry.
		 * @param monitor the monitor number
		 * @returns location to store the monitor geometry
		 */
		get_monitor_geometry(monitor: number): Rectangle;
		/**
		 * Determines whether there is a fullscreen window obscuring the specified
		 * monitor. If there is a fullscreen window, the desktop environment will
		 * typically hide any controls that might obscure the fullscreen window.
		 * 
		 * You can get notification when this changes by connecting to
		 * MetaScreen::in-fullscreen-changed.
		 * @param monitor the monitor number
		 * @returns %TRUE if there is a fullscreen window covering the specified monitor.
		 */
		get_monitor_in_fullscreen(monitor: number): boolean;
		get_monitor_index_for_rect(rect: Rectangle): number;
		/**
		 * Gets the {@link Window} pointed by the mouse
		 * @param not_this_one window to be excluded
		 * @returns the {@link Window} pointed by the mouse
		 *  %NULL when window not found
		 */
		get_mouse_window(not_this_one: Window | null): Window;
		/**
		 * Gets the number of monitors that are joined together to form #screen.
		 * @returns the number of monitors
		 */
		get_n_monitors(): number;
		get_n_workspaces(): number;
		/**
		 * Gets the index of the primary monitor on this #screen.
		 * @returns a monitor index
		 */
		get_primary_monitor(): number;
		get_screen_number(): number;
		/**
		 * Retrieve the size of the screen.
		 * @returns The width of the screen
		 * 
		 * The height of the screen
		 */
		get_size(): [ width: number, height: number ];
		get_startup_sequences(): any[];
		/**
		 * Gets the workspace object for one of a screen's workspaces given the workspace
		 * index. It's valid to call this function with an out-of-range index and it
		 * will robustly return %NULL.
		 * @param index index of one of the screen's workspaces
		 * @returns the workspace object with specified index, or %NULL
		 *   if the index is out of range.
		 */
		get_workspace_by_index(index: number): Workspace;
		get_workspaces(): Workspace[];
		get_xroot(): xlib.Window;
		grab_all_keys(timestamp: number): boolean;
		/**
		 * Explicitly set the layout of workspaces. Once this has been called, the contents of the
		 * _NET_DESKTOP_LAYOUT property on the root window are completely ignored.
		 * @param starting_corner the corner at which the first workspace is found
		 * @param vertical_layout if %TRUE the workspaces are laid out in columns rather than rows
		 * @param n_rows number of rows of workspaces, or -1 to determine the number of rows from
		 *   #n_columns and the total number of workspaces
		 * @param n_columns number of columns of workspaces, or -1 to determine the number of columns from
		 *   #n_rows and the total number of workspaces
		 */
		override_workspace_layout(starting_corner: ScreenCorner, vertical_layout: boolean, n_rows: number, n_columns: number): void;
		remove_workspace(workspace: Workspace, timestamp: number): void;
		set_cm_selection(): void;
		show_desktop(timestamp: number): void;
		toggle_desktop(timestamp: number): void;
		ungrab_all_keys(timestamp: number): void;
		unset_cm_selection(): void;
		unshow_desktop(): void;
		connect(signal: "hide-snap-osd", callback: (owner: this) => void): number;
		connect(signal: "in-fullscreen-changed", callback: (owner: this) => void): number;
		connect(signal: "monitors-changed", callback: (owner: this) => void): number;
		connect(signal: "restacked", callback: (owner: this) => void): number;
		connect(signal: "show-snap-osd", callback: (owner: this, object: number) => void): number;
		connect(signal: "show-workspace-osd", callback: (owner: this) => void): number;
		connect(signal: "startup-sequence-changed", callback: (owner: this, object: any | null) => void): number;
		connect(signal: "toggle-recording", callback: (owner: this) => void): number;
		connect(signal: "window-added", callback: (owner: this, object: Window, p0: number) => void): number;
		connect(signal: "window-entered-monitor", callback: (owner: this, object: number, p0: Window) => void): number;
		connect(signal: "window-left-monitor", callback: (owner: this, object: number, p0: Window) => void): number;
		connect(signal: "window-monitor-changed", callback: (owner: this, object: Window, p0: number) => void): number;
		connect(signal: "window-removed", callback: (owner: this, object: Window) => void): number;
		connect(signal: "window-skip-taskbar-changed", callback: (owner: this, object: Window) => void): number;
		connect(signal: "window-workspace-changed", callback: (owner: this, object: Window, p0: Workspace) => void): number;
		connect(signal: "workareas-changed", callback: (owner: this) => void): number;
		connect(signal: "workspace-added", callback: (owner: this, object: number) => void): number;
		connect(signal: "workspace-removed", callback: (owner: this, object: number) => void): number;
		connect(signal: "workspace-switched", callback: (owner: this, object: number, p0: number, p1: MotionDirection) => void): number;

		connect(signal: "notify::keyboard-grabbed", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::n-workspaces", callback: (owner: this, ...args: any) => void): number;

	}

	type ScreenInitOptionsMixin = GObject.ObjectInitOptions
	export interface ScreenInitOptions extends ScreenInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Screen} instead.
	 */
	type ScreenMixin = IScreen & GObject.Object;

	interface Screen extends ScreenMixin {}

	class Screen {
		public constructor(options?: Partial<ScreenInitOptions>);
		/**
		 * Gets the {@link Screen} corresponding to an X screen structure.
		 * @param xscreen an X screen structure.
		 * @returns the {@link Screen} for the X screen
		 *   %NULL if Metacity is not managing the screen.
		 */
		public static for_x_screen(xscreen: xlib.Screen): Screen;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ShadowFactory} instead.
	 */
	interface IShadowFactory {
		/**
		 * Gets the shadow parameters for a particular class of shadows
		 * for either the focused or unfocused state. If the class name
		 * does not name an existing class, default values will be returned
		 * without printing an error.
		 * @param class_name name of the class of shadow to get the params for
		 * @param focused whether the shadow is for a focused window
		 * @returns location to store the current parameter values
		 */
		get_params(class_name: string, focused: boolean): ShadowParams;
		/**
		 * Updates the shadow parameters for a particular class of shadows
		 * for either the focused or unfocused state. If the class name
		 * does not name an existing class, a new class will be created
		 * (the other focus state for that class will have default values
		 * assigned to it.)
		 * @param class_name name of the class of shadow to set the params for.
		 *  the default shadow classes are the names of the different
		 *  theme frame types (normal, dialog, modal_dialog, utility,
		 *  border, menu, attached) and in addition, popup-menu
		 *  and dropdown-menu.
		 * @param focused whether the shadow is for a focused window
		 * @param params new parameter values
		 */
		set_params(class_name: string, focused: boolean, params: ShadowParams): void;
	}

	type ShadowFactoryInitOptionsMixin = GObject.ObjectInitOptions
	export interface ShadowFactoryInitOptions extends ShadowFactoryInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ShadowFactory} instead.
	 */
	type ShadowFactoryMixin = IShadowFactory & GObject.Object;

	/**
	 * {@link ShadowFactory} is used to create window shadows. It caches shadows internally
	 * so that multiple shadows created for the same shape with the same radius will
	 * share the same MetaShadow.
	 */
	interface ShadowFactory extends ShadowFactoryMixin {}

	class ShadowFactory {
		public constructor(options?: Partial<ShadowFactoryInitOptions>);
		public static get_default(): ShadowFactory;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ShapedTexture} instead.
	 */
	interface IShapedTexture {
		dirty_mask(): void;
		ensure_mask(shape_region: cairo.Region, has_frame: boolean): void;
		/**
		 * Flattens the two layers of the shaped texture into one ARGB32
		 * image by alpha blending the two images, and returns the flattened
		 * image.
		 * @param clip A clipping rectangle, to help prevent extra processing.
		 * In the case that the clipping rectangle is partially or fully
		 * outside the bounds of the texture, the rectangle will be clipped.
		 * @returns a new cairo surface to be freed with
		 * {@link Cairo.Surface.destroy}.
		 */
		get_image(clip: cairo.RectangleInt): cairo.Surface;
		get_texture(): Cogl.Texture;
		/**
		 * Provides a hint to the texture about what areas of the texture
		 * are not completely obscured and thus need to be painted. This
		 * is an optimization and is not supposed to have any effect on
		 * the output.
		 * 
		 * Typically a parent container will set the clip region before
		 * painting its children, and then unset it afterwards.
		 * @param clip_region the region of the texture that is visible and
		 *   should be painted.
		 */
		set_clip_region(clip_region: cairo.Region): void;
		set_create_mipmaps(create_mipmaps: boolean): void;
		/**
		 * As most windows have a large portion that does not require blending,
		 * we can easily turn off blending if we know the areas that do not
		 * require blending. This sets the region where we will not blend for
		 * optimization purposes.
		 * @param opaque_region the region of the texture that
		 *   can have blending turned off.
		 */
		set_opaque_region(opaque_region: cairo.Region): void;
		set_overlay_path(overlay_region: cairo.Region, overlay_path: cairo.Path): void;
		/**
		 * Repairs the damaged area indicated by #x, #y, #width and #height
		 * and queues a redraw for the intersection #visibible_region and
		 * the damage area. If #visibible_region is %NULL a redraw will always
		 * get queued.
		 * @param x the x coordinate of the damaged area
		 * @param y the y coordinate of the damaged area
		 * @param width the width of the damaged area
		 * @param height the height of the damaged area
		 * @param unobscured_region The unobscured region of the window or %NULL if
		 * there is no valid one (like when the actor is transformed or
		 * has a mapped clone)
		 * @returns Whether a redraw have been queued or not
		 */
		update_area(x: number, y: number, width: number, height: number, unobscured_region: cairo.Region): boolean;
		connect(signal: "size-changed", callback: (owner: this) => void): number;

	}

	type ShapedTextureInitOptionsMixin = Clutter.ActorInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions
	export interface ShapedTextureInitOptions extends ShapedTextureInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ShapedTexture} instead.
	 */
	type ShapedTextureMixin = IShapedTexture & Clutter.Actor & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface ShapedTexture extends ShapedTextureMixin {}

	class ShapedTexture {
		public constructor(options?: Partial<ShapedTextureInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Window} instead.
	 */
	interface IWindow {
		readonly above: boolean;
		// readonly appears_focused: boolean;
		readonly decorated: boolean;
		readonly demands_attention: boolean;
		readonly fullscreen: boolean;
		readonly gtk_app_menu_object_path: string;
		readonly gtk_application_id: string;
		readonly gtk_application_object_path: string;
		readonly gtk_menubar_object_path: string;
		readonly gtk_unique_bus_name: string;
		readonly gtk_window_object_path: string;
		readonly maximized_horizontally: boolean;
		readonly maximized_vertically: boolean;
		readonly minimized: boolean;
		readonly muffin_hints: string;
		readonly progress: number;
		readonly progress_pulse: boolean;
		readonly resizeable: boolean;
		readonly tile_type: number;
		readonly title: string;
		readonly urgent: boolean;
		readonly user_time: number;
		readonly window_type: WindowType;
		readonly wm_class: string;
		activate(current_time: number): void;
		activate_with_workspace(current_time: number, workspace: Workspace): void;
		/**
		 * Determines if the window should be drawn with a focused appearance. This is
		 * true for focused windows but also true for windows with a focused modal
		 * dialog attached.
		 * @returns %TRUE if the window should be drawn with a focused frame
		 */
		appears_focused(): boolean;
		can_close(): boolean;
		can_maximize(): boolean;
		can_minimize(): boolean;
		can_move(): boolean;
		can_resize(): boolean;
		can_shade(): boolean;
		/**
		 * Tests if #window can be tiled or snapped in the supplied
		 * tiling zone
		 * @param mode the {@link TileMode} to check for
		 * @returns whether #window can be tiled
		 */
		can_tile(mode: TileMode): boolean;
		/**
		 * Moves the window to the specified workspace.
		 * @param workspace the {@link Workspace} where to put the window
		 */
		change_workspace(workspace: Workspace): void;
		change_workspace_by_index(space_index: number, append: boolean, timestamp: number): void;
		compute_group(): void;
		/**
		 * This is used to notify us of an unrequested configuration
		 * (only applicable to override redirect windows)
		 * @param event a #XConfigureEvent
		 */
		configure_notify(event: any): void;
		/**
		 * Creates an icon for #window. This is intended to only be used for
		 * window-backed apps.
		 * @param size icon width and height
		 * @returns a #GdkPixbuf, or NULL.
		 */
		create_icon(size: number): GdkPixbuf.Pixbuf;
		delete(timestamp: number): void;
		/**
		 * Follow the chain of parents of #window, skipping transient windows,
		 * and return the "root" window which has no non-transient parent.
		 * @returns The root ancestor window
		 */
		find_root_ancestor(): Window;
		/**
		 * If #window is transient, call #func with the window for which it's transient,
		 * repeatedly until either we find a non-transient window, or #func returns %FALSE.
		 * @param func Called for each window which is a transient parent of #window
		 */
		foreach_ancestor(func: WindowForeachFunc): void;
		/**
		 * Call #func for every window which is either transient for #window, or is
		 * a transient of a window which is in turn transient for #window.
		 * The order of window enumeration is not defined.
		 * 
		 * Iteration will stop if #func at any point returns %FALSE.
		 * @param func Called for each window which is a transient of #window (transitively)
		 */
		foreach_transient(func: WindowForeachFunc): void;
		get_all_monitors(): [ number[], number ];
		/**
		 * Returns name of the client machine from which this windows was created,
		 * if known (obtained from the WM_CLIENT_MACHINE property).
		 * @returns the machine name, or NULL; the string is
		 * owned by the window manager and should not be freed or modified by the
		 * caller.
		 */
		get_client_machine(): string;
		/**
		 * Returns the client pid of the process that created this window, if known (obtained from XCB).
		 * @returns the pid, or -1 if not known.
		 */
		get_client_pid(): number;
		/**
		 * Gets the compositor's wrapper object for #window.
		 * @returns the wrapper object.
		 */
		get_compositor_private(): WindowActor;
		get_description(): string;
		get_display(): Display;
		get_frame(): Frame;
		/**
		 * Gets a region representing the outer bounds of the window's frame.
		 * @returns a #cairo_region_t
		 *  holding the outer bounds of the window, or %NULL if the window
		 *  doesn't have a frame.
		 */
		get_frame_bounds(): cairo.Region | null;
		/**
		 * Gets the type of window decorations that should be used for this window.
		 * @returns the frame type
		 */
		get_frame_type(): FrameType;
		get_group(): Group;
		get_gtk_app_menu_object_path(): string;
		get_gtk_application_id(): string;
		get_gtk_application_object_path(): string;
		get_gtk_menubar_object_path(): string;
		get_gtk_unique_bus_name(): string;
		get_gtk_window_object_path(): string;
		get_icon_geometry(rect: Rectangle): boolean;
		/**
		 * Returns the currently set icon name or icon path for the window.
		 * 
		 * Note:
		 * 
		 * This will currently only be non-NULL for programs that use XAppGtkWindow
		 * in place of GtkWindow and use {@link Xapp.gtk_window_set_icon_name} or
		 * set_icon_from_file().  These methods will need to be used explicitly in
		 * C programs, but for introspection use you should not need to treat it any
		 * differently (except for using the correct window class.)
		 * @returns 
		 */
		get_icon_name(): string;
		/**
		 * Gets the rectangle that bounds #window that is responsive to mouse events.
		 * This includes decorations - the visible portion of its border - and (if
		 * present) any invisible area that we make make responsive to mouse clicks in
		 * order to allow convenient border dragging.
		 * @returns pointer to an allocated {@link Rectangle}
		 */
		get_input_rect(): Rectangle;
		get_layer(): StackLayer;
		/**
		 * Gets the current maximization state of the window, as combination
		 * of the %META_MAXIMIZE_HORIZONTAL and %META_MAXIMIZE_VERTICAL flags;
		 * @returns current maximization state
		 */
		get_maximized(): MaximizeFlags;
		/**
		 * Gets index of the monitor that this window is on.
		 * @returns The index of the monitor in the screens monitor list
		 */
		get_monitor(): number;
		/**
		 * Gets the current value of the _MUFFIN_HINTS property.
		 * 
		 * The purpose of the hints is to allow fine-tuning of the Window Manager and
		 * Compositor behaviour on per-window basis, and is intended primarily for
		 * hints that are plugin-specific.
		 * 
		 * The property is a list of colon-separated key=value pairs. The key names for
		 * any plugin-specific hints must be suitably namespaced to allow for shared
		 * use; 'muffin-' key prefix is reserved for internal use, and must not be used
		 * by plugins.
		 * @returns the _MUFFIN_HINTS string, or %NULL if no hints
		 * are set.
		 */
		get_muffin_hints(): string;
		/**
		 * Gets the rectangle that bounds #window that is responsive to mouse events.
		 * This includes only what is visible; it doesn't include any extra reactive
		 * area we add to the edges of windows.
		 * @returns pointer to an allocated {@link Rectangle}
		 */
		get_outer_rect(): Rectangle;
		/**
		 * Returns pid of the process that created this window, if known (obtained from
		 * the _NET_WM_PID property).
		 * @returns the pid, or -1 if not known.
		 */
		get_pid(): number;
		/**
		 * Gets the rectangle that bounds #window, ignoring any window decorations.
		 * @returns the {@link Rectangle} for the window
		 */
		get_rect(): Rectangle;
		get_role(): string;
		/**
		 * Gets the {@link Screen} that the window is on.
		 * @returns the {@link Screen} for the window
		 */
		get_screen(): Screen;
		/**
		 * The stable sequence number is a monotonicially increasing
		 * unique integer assigned to each {@link Window} upon creation.
		 * 
		 * This number can be useful for sorting windows in a stable
		 * fashion.
		 * @returns Internal sequence number for this window
		 */
		get_stable_sequence(): number;
		get_startup_id(): string;
		/**
		 * Returns the matching tiled window on the same monitory as #window. This is
		 * the topmost tiled window in a complementary tile mode that is:
		 * 
		 *  - on the same monitor;
		 *  - on the same workspace;
		 *  - spanning the remaining monitor width;
		 *  - there is no 3rd window stacked between both tiled windows that's
		 *    partially visible in the common edge.
		 * @returns the matching tiled window or
		 * %NULL if it doesn't exist.
		 */
		get_tile_match(): Window | null;
		/**
		 * Returns the current title of the window.
		 * @returns 
		 */
		get_title(): string;
		/**
		 * Returns the {@link Window} for the window that is pointed to by the
		 * WM_TRANSIENT_FOR hint on this window (see XGetTransientForHint()
		 * or XSetTransientForHint()). Metacity keeps transient windows above their
		 * parents. A typical usage of this hint is for a dialog that wants to stay
		 * above its associated window.
		 * @returns the window this window is transient for, or
		 * %NULL if the WM_TRANSIENT_FOR hint is unset or does not point to a toplevel
		 * window that Metacity knows about.
		 */
		get_transient_for(): Window;
		/**
		 * Returns the XID of the window that is pointed to by the
		 * WM_TRANSIENT_FOR hint on this window (see XGetTransientForHint()
		 * or XSetTransientForHint()). Metacity keeps transient windows above their
		 * parents. A typical usage of this hint is for a dialog that wants to stay
		 * above its associated window.
		 * @returns the window this window is transient for, or
		 * None if the WM_TRANSIENT_FOR hint is unset.
		 */
		get_transient_for_as_xid(): xlib.Window;
		/**
		 * The user time represents a timestamp for the last time the user
		 * interacted with this window.  Note this property is only available
		 * for non-override-redirect windows.
		 * 
		 * The property is set by Muffin initially upon window creation,
		 * and updated thereafter on input events (key and button presses) seen by Muffin,
		 * client updates to the _NET_WM_USER_TIME property (if later than the current time)
		 * and when focusing the window.
		 * @returns The last time the user interacted with this window.
		 */
		get_user_time(): number;
		get_window_type(): WindowType;
		/**
		 * Gets the X atom from the _NET_WM_WINDOW_TYPE property used by the
		 * application to set the window type. (Note that this is constrained
		 * to be some value that Muffin recognizes - a completely unrecognized
		 * type atom will be returned as None.)
		 * @returns the raw X atom for the window type, or None
		 */
		get_window_type_atom(): xlib.Atom;
		/**
		 * Return the current value of the name part of WM_CLASS X property.
		 * @returns 
		 */
		get_wm_class(): string;
		/**
		 * Return the current value of the instance part of WM_CLASS X property.
		 * @returns 
		 */
		get_wm_class_instance(): string;
		/**
		 * Gets the {@link Workspace} that the window is currently displayed on.
		 * If the window is on all workspaces, returns the currently active
		 * workspace.
		 * @returns the {@link Workspace} for the window
		 */
		get_workspace(): Workspace;
		get_xwindow(): number;
		group_leader_changed(): void;
		has_focus(): boolean;
		is_always_on_all_workspaces(): boolean;
		is_always_on_top(): boolean;
		/**
		 * The function determines whether #window is an ancestor of #transient; it does
		 * so by traversing the #transient's ancestors until it either locates #window
		 * or reaches an ancestor that is not transient.
		 * @param _transient a {@link Window}
		 * @returns %TRUE if window is an ancestor of transient.
		 */
		is_ancestor_of_transient(_transient: Window): boolean;
		/**
		 * Tests if #window is should be attached to its parent window.
		 * (If the "attach_modal_dialogs" option is not enabled, this will
		 * always return %FALSE.)
		 * @returns whether #window should be attached to its parent
		 */
		is_attached_dialog(): boolean;
		/**
		 * Returns true if window has the demands-attention flag set.
		 * @returns %TRUE if wm_state_demands_attention is set.
		 */
		is_demanding_attention(): boolean;
		is_fullscreen(): boolean;
		is_hidden(): boolean;
		is_interesting(): boolean;
		/**
		 * Queries whether the window is in a modal state as described by the
		 * _NET_WM_STATE protocol.
		 * @returns TRUE if the window is in modal state.
		 */
		is_modal(): boolean;
		is_monitor_sized(): boolean;
		is_on_all_workspaces(): boolean;
		is_on_primary_monitor(): boolean;
		/**
		 * Returns if this window isn't managed by muffin; it will
		 * control its own positioning and muffin won't draw decorations
		 * among other things.  In X terminology this is "override redirect".
		 * @returns 
		 */
		is_override_redirect(): boolean;
		is_remote(): boolean;
		is_shaded(): boolean;
		/**
		 * Gets whether this window should be ignored by task lists.
		 * @returns %TRUE if the skip bar hint is set.
		 */
		is_skip_taskbar(): boolean;
		/**
		 * Returns true if window has the urgent hint set.
		 * @returns %TRUE if wm_hints_urgent is set.
		 */
		is_urgent(): boolean;
		lower(): void;
		maximize(directions: MaximizeFlags): void;
		minimize(): void;
		/**
		 * Moves the window to the desired location on window's assigned workspace.
		 * NOTE: does NOT place according to the origin of the enclosing
		 * frame/window-decoration, but according to the origin of the window,
		 * itself.
		 * @param user_op bool to indicate whether or not this is a user operation
		 * @param root_x_nw desired x pos
		 * @param root_y_nw desired y pos
		 */
		move(user_op: boolean, root_x_nw: number, root_y_nw: number): void;
		/**
		 * Moves the window to the desired location on window's assigned
		 * workspace, using the northwest edge of the frame as the reference,
		 * instead of the actual window's origin, but only if a frame is present.
		 * Otherwise, acts identically to {@link Meta.Window.move}.
		 * @param user_op bool to indicate whether or not this is a user operation
		 * @param root_x_nw desired x pos
		 * @param root_y_nw desired y pos
		 */
		move_frame(user_op: boolean, root_x_nw: number, root_y_nw: number): void;
		/**
		 * Resizes the window so that its outer bounds (including frame)
		 * fit within the given rect
		 * @param user_op bool to indicate whether or not this is a user operation
		 * @param root_x_nw new x
		 * @param root_y_nw new y
		 * @param w desired width
		 * @param h desired height
		 */
		move_resize_frame(user_op: boolean, root_x_nw: number, root_y_nw: number, w: number, h: number): void;
		/**
		 * Moves the window to the monitor with index #monitor, keeping
		 * the relative position of the window's top left corner.
		 * @param monitor desired monitor index
		 */
		move_to_monitor(monitor: number): void;
		raise(): void;
		requested_bypass_compositor(): boolean;
		requested_dont_bypass_compositor(): boolean;
		reset_opacity(): void;
		/**
		 * Resize the window to the desired size.
		 * @param user_op bool to indicate whether or not this is a user operation
		 * @param w desired width
		 * @param h desired height
		 */
		resize(user_op: boolean, w: number, h: number): void;
		set_compositor_private(priv: GObject.Object): void;
		set_demands_attention(): void;
		/**
		 * Sets or unsets the location of the icon corresponding to the window. If
		 * set, the location should correspond to a dock, task bar or other user
		 * interface element displaying the icon, and is relative to the root window.
		 * @param rect rectangle with the desired geometry or %NULL.
		 */
		set_icon_geometry(rect: Rectangle | null): void;
		showing_on_its_workspace(): boolean;
		shutdown_group(): void;
		stick(): void;
		/**
		 * Tiles or snaps the window in the requested configuration
		 * @param mode the {@link TileMode} to use
		 * @param snap whether to snap the window (as opposed to simple tile)
		 * @returns whether or not #window was successfully tiled
		 */
		tile(mode: TileMode, snap: boolean): boolean;
		unmaximize(directions: MaximizeFlags): void;
		unminimize(): void;
		unset_demands_attention(): void;
		unstick(): void;
		connect(signal: "focus", callback: (owner: this) => void): number;
		connect(signal: "icon-changed", callback: (owner: this) => void): number;
		connect(signal: "position-changed", callback: (owner: this) => void): number;
		connect(signal: "raised", callback: (owner: this) => void): number;
		connect(signal: "size-changed", callback: (owner: this) => void): number;
		connect(signal: "unmanaged", callback: (owner: this) => void): number;
		connect(signal: "workspace-changed", callback: (owner: this, object: number) => void): number;

		connect(signal: "notify::above", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::appears-focused", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::decorated", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::demands-attention", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::fullscreen", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::gtk-app-menu-object-path", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::gtk-application-id", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::gtk-application-object-path", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::gtk-menubar-object-path", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::gtk-unique-bus-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::gtk-window-object-path", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximized-horizontally", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximized-vertically", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::minimized", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::muffin-hints", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::progress", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::progress-pulse", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::resizeable", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::tile-type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::title", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::urgent", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::user-time", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window-type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::wm-class", callback: (owner: this, ...args: any) => void): number;

	}

	type WindowInitOptionsMixin = GObject.ObjectInitOptions
	export interface WindowInitOptions extends WindowInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Window} instead.
	 */
	type WindowMixin = IWindow & GObject.Object;

	interface Window extends WindowMixin {}

	class Window {
		public constructor(options?: Partial<WindowInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WindowActor} instead.
	 */
	interface IWindowActor {
		meta_screen: any;
		meta_window: Window;
		no_shadow: boolean;
		shadow_class: string;
		x_window: number;
		/**
		 * Gets the {@link Window} object that the the #MetaWindowActor is displaying
		 * @returns the displayed {@link Window}
		 */
		get_meta_window(): Window;
		/**
		 * Gets the ClutterActor that is used to display the contents of the window
		 * @returns the #ClutterActor for the contents
		 */
		get_texture(): Clutter.Actor;
		/**
		 * Returns the index of workspace on which this window is located; if the
		 * window is sticky, or is not currently located on any workspace, returns -1.
		 * This function is deprecated  and should not be used in newly written code;
		 * {@link Meta.Window.get_workspace} instead.
		 * @returns index of workspace on which this window is
		 * located.
		 */
		get_workspace(): number;
		get_x_window(): xlib.Window;
		/**
		 * Gets whether the X window that the actor was displaying has been destroyed
		 * @returns %TRUE when the window is destroyed, otherwise %FALSE
		 */
		is_destroyed(): boolean;
		is_override_redirect(): boolean;
		showing_on_its_workspace(): boolean;
		connect(signal: "position-changed", callback: (owner: this) => void): number;
		connect(signal: "size-changed", callback: (owner: this) => void): number;

		connect(signal: "notify::meta-screen", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::meta-window", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::no-shadow", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::shadow-class", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::x-window", callback: (owner: this, ...args: any) => void): number;

	}

	type WindowActorInitOptionsMixin = Clutter.ActorInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IWindowActor,
		"meta_screen" |
		"meta_window" |
		"no_shadow" |
		"shadow_class" |
		"x_window">;

	export interface WindowActorInitOptions extends WindowActorInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WindowActor} instead.
	 */
	type WindowActorMixin = IWindowActor & Clutter.Actor & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface WindowActor extends WindowActorMixin {}

	class WindowActor {
		public constructor(options?: Partial<WindowActorInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Workspace} instead.
	 */
	interface IWorkspace {
		readonly n_windows: number;
		activate(timestamp: number): void;
		/**
		 * Switches to #workspace in the specified #direction (if possible)
		 * @param direction the suggested {@link MotionDirection}
		 * @param timestamp timestamp for #focus_this
		 */
		activate_with_direction_hint(direction: MotionDirection, timestamp: number): void;
		/**
		 * Switches to #workspace and possibly activates the window #focus_this.
		 * 
		 * The window #focus_this is activated by calling {@link Meta.Window.activate}
		 * which will unminimize it and transient parents, raise it and give it
		 * the focus.
		 * 
		 * If a window is currently being moved by the user, it will be
		 * moved to #workspace.
		 * 
		 * The advantage of calling this function instead of meta_workspace_activate()
		 * followed by meta_window_activate() is that it happens as a unit, so
		 * no other window gets focused first before #focus_this.
		 * @param focus_this the {@link Window} to be focused, or %NULL
		 * @param timestamp timestamp for #focus_this
		 */
		activate_with_focus(focus_this: Window, timestamp: number): void;
		focus_default_window(not_this_one: Window, timestamp: number): void;
		/**
		 * Gets the neighbor of the {@link Workspace} in the given direction
		 * @param direction a {@link MotionDirection}, direction in which to look for the neighbor
		 * @returns the neighbor {@link Workspace}
		 */
		get_neighbor(direction: MotionDirection): Workspace;
		get_work_area_all_monitors(area: Rectangle): void;
		/**
		 * Stores the work area for #which_monitor on #workspace
		 * in #area.
		 * @param which_monitor a monitor index
		 * @returns location to store the work area
		 */
		get_work_area_for_monitor(which_monitor: number): Rectangle;
		index(): number;
		/**
		 * Gets windows contained on the workspace, including workspace->windows
		 * and also sticky windows. Override-redirect windows are not included.
		 * @returns the list of windows.
		 */
		list_windows(): Window[];
		/**
		 * Sets a list of struts that will be used in addition to the struts
		 * of the windows in the workspace when computing the work area of
		 * the workspace.
		 * @param struts list of {@link Strut}
		 */
		set_builtin_struts(struts: Strut[]): void;
		update_window_hints(): void;
		connect(signal: "window-added", callback: (owner: this, object: Window) => void): number;
		connect(signal: "window-removed", callback: (owner: this, object: Window) => void): number;

		connect(signal: "notify::n-windows", callback: (owner: this, ...args: any) => void): number;

	}

	type WorkspaceInitOptionsMixin = GObject.ObjectInitOptions
	export interface WorkspaceInitOptions extends WorkspaceInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Workspace} instead.
	 */
	type WorkspaceMixin = IWorkspace & GObject.Object;

	interface Workspace extends WorkspaceMixin {}

	class Workspace {
		public constructor(options?: Partial<WorkspaceInitOptions>);
	}

	export interface ButtonLayoutInitOptions {}
	interface ButtonLayout {}
	class ButtonLayout {
		public constructor(options?: Partial<ButtonLayoutInitOptions>);
		public left_buttons: ButtonFunction[];
		public left_buttons_has_spacer: boolean[];
		public right_buttons: ButtonFunction[];
		public right_buttons_has_spacer: boolean[];
	}

	export interface CompositorInitOptions {}
	interface Compositor {}
	class Compositor {
		public constructor(options?: Partial<CompositorInitOptions>);
		public static new(display: Display): Compositor;
		public static on_shadow_factory_changed(): void;
		public static toggle_send_frame_timings(screen: Screen): void;
		public add_window(window: Window): void;
		public destroy(): void;
		public flash_screen(screen: Screen): void;
		public hide_hud_preview(screen: Screen): void;
		public hide_tile_preview(screen: Screen): void;
		public hide_window(window: Window, effect: CompEffect): void;
		public manage_screen(screen: Screen): void;
		public maximize_window(window: Window, old_rect: Rectangle, new_rect: Rectangle): void;
		public process_event(event: any, window: Window): boolean;
		public queue_frame_drawn(window: Window, no_delay_frame: boolean): void;
		public remove_window(window: Window): void;
		public set_updates_frozen(window: Window, updates_frozen: boolean): void;
		public show_hud_preview(screen: Screen, current_proximity_zone: number, work_area: Rectangle, snap_queued: number): void;
		public show_tile_preview(screen: Screen, window: Window, tile_rect: Rectangle, tile_monitor_number: number, snap_queued: number): void;
		public show_window(window: Window, effect: CompEffect): void;
		public switch_workspace(screen: Screen, from: Workspace, to: Workspace, direction: MotionDirection): void;
		public sync_screen_size(screen: Screen, width: number, height: number): void;
		public sync_stack(screen: Screen, stack: any[]): void;
		public sync_window_geometry(window: Window, did_placement: boolean): void;
		public tile_window(window: Window, old_rect: Rectangle, new_rect: Rectangle): void;
		public unmanage_screen(screen: Screen): void;
		public unmaximize_window(window: Window, old_rect: Rectangle, new_rect: Rectangle): void;
		public window_shape_changed(window: Window): void;
	}

	export interface EdgeInitOptions {}
	interface Edge {}
	class Edge {
		public constructor(options?: Partial<EdgeInitOptions>);
		public rect: Rectangle;
		public side_type: Side;
		public edge_type: EdgeType;
	}

	export interface FrameInitOptions {}
	interface Frame {}
	class Frame {
		public constructor(options?: Partial<FrameInitOptions>);
	}

	export interface FrameBordersInitOptions {}
	interface FrameBorders {}
	class FrameBorders {
		public constructor(options?: Partial<FrameBordersInitOptions>);
		public visible: Gtk.Border;
		public invisible: Gtk.Border;
		public total: Gtk.Border;
		public clear(): void;
	}

	export interface GroupInitOptions {}
	interface Group {}
	class Group {
		public constructor(options?: Partial<GroupInitOptions>);
		public get_size(): number;
		public get_startup_id(): string;
		public list_windows(): Window[];
		public property_notify(event: any): boolean;
		public update_layers(): void;
	}

	export interface KeyBindingInitOptions {}
	interface KeyBinding {}
	class KeyBinding {
		public constructor(options?: Partial<KeyBindingInitOptions>);
		public get_mask(): number;
		public get_modifiers(): VirtualModifier;
		public get_name(): string;
	}

	export interface KeyComboInitOptions {}
	interface KeyCombo {}
	class KeyCombo {
		public constructor(options?: Partial<KeyComboInitOptions>);
		public keysym: number;
		public keycode: number;
		public modifiers: VirtualModifier;
	}

	export interface KeyHandlerInitOptions {}
	interface KeyHandler {}
	class KeyHandler {
		public constructor(options?: Partial<KeyHandlerInitOptions>);
	}

	export interface KeyPrefInitOptions {}
	interface KeyPref {}
	class KeyPref {
		public constructor(options?: Partial<KeyPrefInitOptions>);
		public name: string;
		public schema: string;
		public action: KeyBindingAction;
		public bindings: any[];
		public add_shift: boolean;
		public per_window: boolean;
		public builtin: boolean;
	}

	export interface PluginInfoInitOptions {}
	interface PluginInfo {}
	class PluginInfo {
		public constructor(options?: Partial<PluginInfoInitOptions>);
		public name: string;
		public version: string;
		public author: string;
		public license: string;
		public description: string;
	}

	export interface PluginVersionInitOptions {}
	interface PluginVersion {}
	class PluginVersion {
		public constructor(options?: Partial<PluginVersionInitOptions>);
		public version_major: number;
		public version_minor: number;
		public version_micro: number;
		public version_api: number;
	}

	export interface RectangleInitOptions {}
	interface Rectangle {}
	class Rectangle {
		public constructor(options?: Partial<RectangleInitOptions>);
		public x: number;
		public y: number;
		public width: number;
		public height: number;
		public area(): number;
		public contains_rect(inner_rect: Rectangle): boolean;
		public copy(): Rectangle;
		public could_fit_rect(inner_rect: Rectangle): boolean;
		public equal(src2: Rectangle): boolean;
		public free(): void;
		public horiz_overlap(rect2: Rectangle): boolean;
		public intersect(src2: Rectangle): [ boolean, Rectangle ];
		public overlap(rect2: Rectangle): boolean;
		public union(rect2: Rectangle): Rectangle;
		public vert_overlap(rect2: Rectangle): boolean;
	}

	export interface ResizePopupInitOptions {}
	interface ResizePopup {}
	class ResizePopup {
		public constructor(options?: Partial<ResizePopupInitOptions>);
	}

	export interface ShadowParamsInitOptions {}
	/**
	 * The {@link ShadowParams} structure holds information about how to draw
	 * a particular style of shadow.
	 */
	interface ShadowParams {}
	class ShadowParams {
		public constructor(options?: Partial<ShadowParamsInitOptions>);
		/**
		 * the radius (gaussian standard deviation) of the shadow
		 */
		public radius: number;
		/**
		 * if >= 0, the shadow doesn't extend above the top
		 *  of the shape, and fades out over the given number of pixels
		 */
		public top_fade: number;
		/**
		 * horizontal offset of the shadow with respect to the
		 *  shape being shadowed, in pixels
		 */
		public x_offset: number;
		/**
		 * vertical offset of the shadow with respect to the
		 *  shape being shadowed, in pixels
		 */
		public y_offset: number;
		/**
		 * opacity of the shadow, from 0 to 255
		 */
		public opacity: number;
	}

	export interface StrutInitOptions {}
	interface Strut {}
	class Strut {
		public constructor(options?: Partial<StrutInitOptions>);
		public rect: Rectangle;
		public side: Side;
	}

	export interface ThemeInitOptions {}
	interface Theme {}
	class Theme {
		public constructor(options?: Partial<ThemeInitOptions>);
		public static get_current(): Theme;
		public static load(theme_name: string): Theme;
		public static new(): Theme;
		public static set_current(name: string, force_reload: boolean): void;
		public free(): void;
		public validate(): boolean;
	}

	export interface WindowMenuInitOptions {}
	interface WindowMenu {}
	class WindowMenu {
		public constructor(options?: Partial<WindowMenuInitOptions>);
	}

	enum BackgroundTransition {
		NONE = 0,
		FADEIN = 1,
		BLEND = 2
	}

	enum BellType {
		NONE = 0,
		STICKY_KEYS = 1,
		SLOW_KEYS = 2,
		BOUNCE_KEYS = 3
	}

	enum ButtonFunction {
		MENU = 0,
		MINIMIZE = 1,
		MAXIMIZE = 2,
		CLOSE = 3,
		SHADE = 4,
		ABOVE = 5,
		STICK = 6,
		UNSHADE = 7,
		UNABOVE = 8,
		UNSTICK = 9,
		LAST = 10
	}

	/**
	 * Indicates the appropriate effect to show the user for
	 * {@link Meta.Compositor.show_window} and meta_compositor_hide_window()
	 */
	enum CompEffect {
		/**
		 * The window is newly created
		 *   (also used for a window that was previously on a different
		 *   workspace and is changed to become visible on the active
		 *   workspace.)
		 */
		CREATE = 0,
		/**
		 * The window should be shown
		 *   as unminimizing from its icon geometry.
		 */
		UNMINIMIZE = 1,
		/**
		 * The window is being destroyed
		 */
		DESTROY = 2,
		/**
		 * The window should be shown
		 *   as minimizing to its icon geometry.
		 */
		MINIMIZE = 3,
		/**
		 * No effect, the window should be
		 *   shown or hidden immediately.
		 */
		NONE = 4
	}

	enum Cursor {
		DEFAULT = 0,
		NORTH_RESIZE = 1,
		SOUTH_RESIZE = 2,
		WEST_RESIZE = 3,
		EAST_RESIZE = 4,
		SE_RESIZE = 5,
		SW_RESIZE = 6,
		NE_RESIZE = 7,
		NW_RESIZE = 8,
		MOVE_OR_RESIZE_WINDOW = 9,
		BUSY = 10
	}

	enum EdgeType {
		WINDOW = 0,
		MONITOR = 1,
		SCREEN = 2
	}

	enum ExitCode {
		/**
		 * Success
		 */
		SUCCESS = 0,
		/**
		 * Error
		 */
		ERROR = 1
	}

	enum FrameType {
		NORMAL = 0,
		DIALOG = 1,
		MODAL_DIALOG = 2,
		UTILITY = 3,
		MENU = 4,
		BORDER = 5,
		ATTACHED = 6,
		LAST = 7
	}

	enum GrabOp {
		NONE = 0,
		MOVING = 1,
		RESIZING_SE = 2,
		RESIZING_S = 3,
		RESIZING_SW = 4,
		RESIZING_N = 5,
		RESIZING_NE = 6,
		RESIZING_NW = 7,
		RESIZING_W = 8,
		RESIZING_E = 9,
		KEYBOARD_MOVING = 10,
		KEYBOARD_RESIZING_UNKNOWN = 11,
		KEYBOARD_RESIZING_S = 12,
		KEYBOARD_RESIZING_N = 13,
		KEYBOARD_RESIZING_W = 14,
		KEYBOARD_RESIZING_E = 15,
		KEYBOARD_RESIZING_SE = 16,
		KEYBOARD_RESIZING_NE = 17,
		KEYBOARD_RESIZING_SW = 18,
		KEYBOARD_RESIZING_NW = 19,
		KEYBOARD_TABBING_NORMAL = 20,
		KEYBOARD_TABBING_DOCK = 21,
		KEYBOARD_ESCAPING_NORMAL = 22,
		KEYBOARD_ESCAPING_DOCK = 23,
		KEYBOARD_ESCAPING_GROUP = 24,
		KEYBOARD_TABBING_GROUP = 25,
		KEYBOARD_WORKSPACE_SWITCHING = 26,
		CLICKING_MINIMIZE = 27,
		CLICKING_MAXIMIZE = 28,
		CLICKING_UNMAXIMIZE = 29,
		CLICKING_DELETE = 30,
		CLICKING_MENU = 31,
		CLICKING_SHADE = 32,
		CLICKING_UNSHADE = 33,
		CLICKING_ABOVE = 34,
		CLICKING_UNABOVE = 35,
		CLICKING_STICK = 36,
		CLICKING_UNSTICK = 37,
		COMPOSITOR = 38
	}

	enum GradientType {
		VERTICAL = 0,
		HORIZONTAL = 1,
		DIAGONAL = 2,
		LAST = 3
	}

	enum KeyBindingAction {
		NONE = -1,
		WORKSPACE_1 = 0,
		WORKSPACE_2 = 1,
		WORKSPACE_3 = 2,
		WORKSPACE_4 = 3,
		WORKSPACE_5 = 4,
		WORKSPACE_6 = 5,
		WORKSPACE_7 = 6,
		WORKSPACE_8 = 7,
		WORKSPACE_9 = 8,
		WORKSPACE_10 = 9,
		WORKSPACE_11 = 10,
		WORKSPACE_12 = 11,
		WORKSPACE_LEFT = 12,
		WORKSPACE_RIGHT = 13,
		WORKSPACE_UP = 14,
		WORKSPACE_DOWN = 15,
		SWITCH_GROUP = 16,
		SWITCH_GROUP_BACKWARD = 17,
		SWITCH_WINDOWS = 18,
		SWITCH_WINDOWS_BACKWARD = 19,
		SWITCH_PANELS = 20,
		SWITCH_PANELS_BACKWARD = 21,
		CYCLE_GROUP = 22,
		CYCLE_GROUP_BACKWARD = 23,
		CYCLE_WINDOWS = 24,
		CYCLE_WINDOWS_BACKWARD = 25,
		CYCLE_PANELS = 26,
		CYCLE_PANELS_BACKWARD = 27,
		TAB_POPUP_SELECT = 28,
		TAB_POPUP_CANCEL = 29,
		SHOW_DESKTOP = 30,
		PANEL_RUN_DIALOG = 31,
		TOGGLE_RECORDING = 32,
		SET_SPEW_MARK = 33,
		ACTIVATE_WINDOW_MENU = 34,
		TOGGLE_FULLSCREEN = 35,
		TOGGLE_MAXIMIZED = 36,
		PUSH_TILE_LEFT = 37,
		PUSH_TILE_RIGHT = 38,
		PUSH_TILE_UP = 39,
		PUSH_TILE_DOWN = 40,
		PUSH_SNAP_LEFT = 41,
		PUSH_SNAP_RIGHT = 42,
		PUSH_SNAP_UP = 43,
		PUSH_SNAP_DOWN = 44,
		TOGGLE_ABOVE = 45,
		MAXIMIZE = 46,
		UNMAXIMIZE = 47,
		TOGGLE_SHADED = 48,
		MINIMIZE = 49,
		CLOSE = 50,
		BEGIN_MOVE = 51,
		BEGIN_RESIZE = 52,
		TOGGLE_ON_ALL_WORKSPACES = 53,
		MOVE_TO_WORKSPACE_1 = 54,
		MOVE_TO_WORKSPACE_2 = 55,
		MOVE_TO_WORKSPACE_3 = 56,
		MOVE_TO_WORKSPACE_4 = 57,
		MOVE_TO_WORKSPACE_5 = 58,
		MOVE_TO_WORKSPACE_6 = 59,
		MOVE_TO_WORKSPACE_7 = 60,
		MOVE_TO_WORKSPACE_8 = 61,
		MOVE_TO_WORKSPACE_9 = 62,
		MOVE_TO_WORKSPACE_10 = 63,
		MOVE_TO_WORKSPACE_11 = 64,
		MOVE_TO_WORKSPACE_12 = 65,
		MOVE_TO_WORKSPACE_LEFT = 66,
		MOVE_TO_WORKSPACE_RIGHT = 67,
		MOVE_TO_WORKSPACE_UP = 68,
		MOVE_TO_WORKSPACE_DOWN = 69,
		MOVE_TO_WORKSPACE_NEW = 70,
		MOVE_TO_MONITOR_LEFT = 71,
		MOVE_TO_MONITOR_RIGHT = 72,
		MOVE_TO_MONITOR_DOWN = 73,
		MOVE_TO_MONITOR_UP = 74,
		RAISE_OR_LOWER = 75,
		RAISE = 76,
		LOWER = 77,
		MAXIMIZE_VERTICALLY = 78,
		MAXIMIZE_HORIZONTALLY = 79,
		MOVE_TO_CORNER_NW = 80,
		MOVE_TO_CORNER_NE = 81,
		MOVE_TO_CORNER_SW = 82,
		MOVE_TO_CORNER_SE = 83,
		MOVE_TO_SIDE_N = 84,
		MOVE_TO_SIDE_S = 85,
		MOVE_TO_SIDE_E = 86,
		MOVE_TO_SIDE_W = 87,
		MOVE_TO_CENTER = 88,
		INCREASE_OPACITY = 89,
		DECREASE_OPACITY = 90,
		CUSTOM = 91,
		LAST = 92
	}

	enum LaterType {
		/**
		 * call in a resize processing phase that is done
		 *   before GTK+ repainting (including window borders) is done.
		 */
		RESIZE = 0,
		/**
		 * used by Muffin to compute which windows should be mapped
		 */
		CALC_SHOWING = 1,
		/**
		 * used by Muffin to see if there's a fullscreen window
		 */
		CHECK_FULLSCREEN = 2,
		/**
		 * used by Muffin to send it's idea of the stacking order to the server
		 */
		SYNC_STACK = 3,
		/**
		 * call before the stage is redrawn
		 */
		BEFORE_REDRAW = 4,
		/**
		 * call at a very low priority (can be blocked
		 *    by running animations or redrawing applications)
		 */
		IDLE = 5
	}

	enum MotionDirection {
		UP = -1,
		DOWN = -2,
		LEFT = -3,
		RIGHT = -4,
		UP_LEFT = -5,
		UP_RIGHT = -6,
		DOWN_LEFT = -7,
		DOWN_RIGHT = -8,
		NOT_EXIST_YET = -30
	}

	enum PlacementMode {
		AUTOMATIC = 0,
		POINTER = 1,
		MANUAL = 2,
		CENTER = 3
	}

	enum Preference {
		MOUSE_BUTTON_MODS = 0,
		FOCUS_MODE = 1,
		FOCUS_NEW_WINDOWS = 2,
		ATTACH_MODAL_DIALOGS = 3,
		IGNORE_HIDE_TITLEBAR_WHEN_MAXIMIZED = 4,
		RAISE_ON_CLICK = 5,
		ACTION_DOUBLE_CLICK_TITLEBAR = 6,
		ACTION_MIDDLE_CLICK_TITLEBAR = 7,
		ACTION_RIGHT_CLICK_TITLEBAR = 8,
		ACTION_SCROLL_WHEEL_TITLEBAR = 9,
		AUTO_RAISE = 10,
		AUTO_RAISE_DELAY = 11,
		THEME = 12,
		TITLEBAR_FONT = 13,
		NUM_WORKSPACES = 14,
		DYNAMIC_WORKSPACES = 15,
		UNREDIRECT_FULLSCREEN_WINDOWS = 16,
		DESKTOP_EFFECTS = 17,
		SYNC_METHOD = 18,
		THREADED_SWAP = 19,
		SEND_FRAME_TIMINGS = 20,
		APPLICATION_BASED = 21,
		KEYBINDINGS = 22,
		DISABLE_WORKAROUNDS = 23,
		BUTTON_LAYOUT = 24,
		WORKSPACE_NAMES = 25,
		WORKSPACE_CYCLE = 26,
		VISUAL_BELL = 27,
		AUDIBLE_BELL = 28,
		VISUAL_BELL_TYPE = 29,
		GNOME_ANIMATIONS = 30,
		CURSOR_THEME = 31,
		CURSOR_SIZE = 32,
		RESIZE_WITH_RIGHT_BUTTON = 33,
		EDGE_TILING = 34,
		FORCE_FULLSCREEN = 35,
		EDGE_RESISTANCE_WINDOW = 36,
		WORKSPACES_ONLY_ON_PRIMARY = 37,
		DRAGGABLE_BORDER_WIDTH = 38,
		TILE_HUD_THRESHOLD = 39,
		RESIZE_THRESHOLD = 40,
		SNAP_MODIFIER = 41,
		LEGACY_SNAP = 42,
		INVERT_WORKSPACE_FLIP_DIRECTION = 43,
		TILE_MAXIMIZE = 44,
		PLACEMENT_MODE = 45,
		BACKGROUND_TRANSITION = 46,
		MIN_WIN_OPACITY = 47,
		MOUSE_ZOOM_ENABLED = 48,
		MOUSE_BUTTON_ZOOM_MODS = 49,
		UI_SCALE = 50,
		BRING_WINDOWS_TO_CURRENT_WORKSPACE = 51
	}

	enum ScreenCorner {
		TOPLEFT = 0,
		TOPRIGHT = 1,
		BOTTOMLEFT = 2,
		BOTTOMRIGHT = 3
	}

	enum Side {
		LEFT = 1,
		RIGHT = 2,
		TOP = 4,
		BOTTOM = 8
	}

	enum StackLayer {
		DESKTOP = 0,
		BOTTOM = 1,
		NORMAL = 2,
		TOP = 4,
		DOCK = 4,
		FULLSCREEN = 5,
		FOCUSED_WINDOW = 6,
		OVERRIDE_REDIRECT = 7,
		LAST = 8
	}

	enum SyncMethod {
		NONE = 0,
		FALLBACK = 1,
		SWAP_THROTTLING = 2,
		PRESENTATION_TIME = 3
	}

	enum TabList {
		NORMAL = 0,
		DOCKS = 1,
		GROUP = 2,
		NORMAL_ALL = 3
	}

	enum TabShowType {
		ICON = 0,
		INSTANTLY = 1
	}

	enum TileMode {
		NONE = 0,
		LEFT = 1,
		RIGHT = 2,
		ULC = 3,
		LLC = 4,
		URC = 5,
		LRC = 6,
		TOP = 7,
		BOTTOM = 8,
		MAXIMIZE = 9
	}

	enum WindowTileType {
		NONE = 0,
		TILED = 1,
		SNAPPED = 2
	}

	enum WindowType {
		NORMAL = 0,
		DESKTOP = 1,
		DOCK = 2,
		DIALOG = 3,
		MODAL_DIALOG = 4,
		TOOLBAR = 5,
		MENU = 6,
		UTILITY = 7,
		SPLASHSCREEN = 8,
		DROPDOWN_MENU = 9,
		POPUP_MENU = 10,
		TOOLTIP = 11,
		NOTIFICATION = 12,
		COMBO = 13,
		DND = 14,
		OVERRIDE_OTHER = 15
	}

	enum DebugTopic {
		VERBOSE = -1,
		FOCUS = 1,
		WORKAREA = 2,
		STACK = 4,
		THEMES = 8,
		SM = 16,
		EVENTS = 32,
		WINDOW_STATE = 64,
		WINDOW_OPS = 128,
		GEOMETRY = 256,
		PLACEMENT = 512,
		PING = 1024,
		XINERAMA = 2048,
		KEYBINDINGS = 4096,
		SYNC = 8192,
		ERRORS = 16384,
		STARTUP = 32768,
		PREFS = 65536,
		GROUPS = 131072,
		RESIZING = 262144,
		SHAPES = 524288,
		COMPOSITOR = 1048576,
		EDGE_RESISTANCE = 2097152
	}

	enum Direction {
		LEFT = 1,
		RIGHT = 2,
		TOP = 4,
		BOTTOM = 8,
		UP = 4,
		DOWN = 8,
		HORIZONTAL = 3,
		VERTICAL = 12
	}

	enum FrameFlags {
		ALLOWS_DELETE = 1,
		ALLOWS_MENU = 2,
		ALLOWS_MINIMIZE = 4,
		ALLOWS_MAXIMIZE = 8,
		ALLOWS_LEFT_RESIZE = 16,
		ALLOWS_RIGHT_RESIZE = 32,
		ALLOWS_TOP_RESIZE = 64,
		ALLOWS_BOTTOM_RESIZE = 128,
		HAS_FOCUS = 256,
		SHADED = 512,
		STUCK = 1024,
		MAXIMIZED = 2048,
		ALLOWS_SHADE = 4096,
		ALLOWS_MOVE = 8192,
		FULLSCREEN = 16384,
		IS_FLASHING = 32768,
		ABOVE = 65536,
		TILED_LEFT = 131072,
		TILED_RIGHT = 262144,
		ALLOWS_VERTICAL_RESIZE = 192,
		ALLOWS_HORIZONTAL_RESIZE = 48
	}

	enum KeyBindingFlags {
		NONE = 0,
		PER_WINDOW = 1,
		BUILTIN = 2,
		REVERSES = 4,
		IS_REVERSED = 8
	}

	enum ListWindowsFlags {
		DEFAULT = 0,
		INCLUDE_OVERRIDE_REDIRECT = 1
	}

	enum MaximizeFlags {
		HORIZONTAL = 1,
		VERTICAL = 2
	}

	enum MenuOp {
		NONE = 0,
		DELETE = 1,
		MINIMIZE = 2,
		UNMAXIMIZE = 4,
		MAXIMIZE = 8,
		UNSHADE = 16,
		SHADE = 32,
		UNSTICK = 64,
		STICK = 128,
		WORKSPACES = 256,
		MOVE = 512,
		RESIZE = 1024,
		ABOVE = 2048,
		UNABOVE = 4096,
		MOVE_LEFT = 8192,
		MOVE_RIGHT = 16384,
		MOVE_UP = 32768,
		MOVE_DOWN = 65536,
		RECOVER = 131072,
		MOVE_NEW = 262144
	}

	/**
	 * Options that can be provided when calling {@link Meta.Plugin.begin_modal}.
	 */
	enum ModalOptions {
		/**
		 * if set the pointer is already
		 *   grabbed by the plugin and should not be grabbed again.
		 */
		POINTER_ALREADY_GRABBED = 1,
		/**
		 * if set the keyboard is already
		 *   grabbed by the plugin and should not be grabbed again.
		 */
		KEYBOARD_ALREADY_GRABBED = 2
	}

	enum VirtualModifier {
		SHIFT_MASK = 32,
		CONTROL_MASK = 64,
		ALT_MASK = 128,
		META_MASK = 256,
		SUPER_MASK = 512,
		HYPER_MASK = 1024,
		MOD2_MASK = 2048,
		MOD3_MASK = 4096,
		MOD4_MASK = 8192,
		MOD5_MASK = 16384
	}

	interface KeyHandlerFunc {
		(display: Display, screen: Screen, window: Window, event: any | null, binding: KeyBinding): void;
	}

	interface PrefsChangedFunc {
		(pref: Preference, data: any | null): void;
	}

	interface WindowForeachFunc {
		(window: Window, data: any | null): boolean;
	}

	interface WindowMenuFunc {
		(menu: WindowMenu, xdisplay: xlib.Display, client_xwindow: xlib.Window, timestamp: number, op: MenuOp, workspace: number, data: any | null): void;
	}

	/**
	 * Ensure log messages for the given topic #topic
	 * will be printed.
	 * @param topic Topic for which logging will be started
	 */
	function add_verbose_topic(topic: DebugTopic): void;

	function bug(format: string): void;

	function compositor_new(display: Display): Compositor;

	function compositor_on_shadow_factory_changed(): void;

	function compositor_toggle_send_frame_timings(screen: Screen): void;

	function debug_spew_real(format: string): void;

	/**
	 * Disables unredirection, can be usefull in situations where having
	 * unredirected windows is undesireable like when recording a video.
	 * @param screen a {@link Screen}
	 */
	function disable_unredirect_for_screen(screen: Screen): void;

	function empty_stage_input_region(screen: Screen): void;

	/**
	 * Enables unredirection which reduces the overhead for apps like games.
	 * @param screen a {@link Screen}
	 */
	function enable_unredirect_for_screen(screen: Screen): void;

	function error_trap_pop(display: Display): void;

	function error_trap_pop_with_return(display: Display): number;

	function error_trap_push(display: Display): void;

	function error_trap_push_with_return(display: Display): void;

	function exit(code: ExitCode): void;

	function fatal(format: string): void;

	/**
	 * Converts a frame type enum value to the name string that would
	 * appear in the theme definition file.
	 * @param type
	 * @returns the string value
	 */
	function frame_type_to_string(type: FrameType): string;

	function free_gslist_and_elements(list_to_deep_free: any[]): void;

	function g_utf8_strndup(src: string, n: number): string;

	/**
	 * Gets the actor that draws the root window background under the windows.
	 * The root window background automatically tracks the image or color set
	 * by the environment.
	 * @param screen a {@link Screen}
	 * @returns The background actor corresponding to #screen
	 */
	function get_background_actor_for_screen(screen: Screen): Clutter.Actor;

	function get_bottom_window_group_for_screen(screen: Screen): Clutter.Actor;

	/**
	 * Returns a #GOptionContext initialized with muffin-related options.
	 * Parse the command-line args with this before calling meta_init().
	 * @returns the #GOptionContext
	 */
	function get_option_context(): GLib.OptionContext;

	function get_overlay_group_for_screen(screen: Screen): Clutter.Actor;

	function get_overlay_window(screen: Screen): xlib.Window;

	function get_replace_current_wm(): boolean;

	function get_stage_for_screen(screen: Screen): Clutter.Actor;

	function get_top_window_group_for_screen(screen: Screen): Clutter.Actor;

	function get_window_actors(screen: Screen): Clutter.Actor[];

	function get_window_group_for_screen(screen: Screen): Clutter.Actor;

	function gradient_add_alpha(pixbuf: GdkPixbuf.Pixbuf, alphas: number, n_alphas: number, type: GradientType): void;

	/**
	 * Interwoven essentially means we have two vertical gradients,
	 * cut into horizontal strips of the given thickness, and then the strips
	 * are alternated. I'm not sure what it's good for, just copied since
	 * WindowMaker had it.
	 * @param width
	 * @param height
	 * @param colors1
	 * @param thickness1
	 * @param colors2
	 * @param thickness2
	 * @returns 
	 */
	function gradient_create_interwoven(width: number, height: number, colors1: Gdk.RGBA, thickness1: number, colors2: Gdk.RGBA, thickness2: number): GdkPixbuf.Pixbuf;

	function gradient_create_multi(width: number, height: number, colors: Gdk.RGBA[], n_colors: number, style: GradientType): GdkPixbuf.Pixbuf;

	function gradient_create_simple(width: number, height: number, from: Gdk.RGBA, to: Gdk.RGBA, style: GradientType): GdkPixbuf.Pixbuf;

	function gravity_to_string(gravity: number): string;

	/**
	 * Initialize muffin. Call this after {@link Meta.get.option_context} and
	 * meta_plugin_manager_set_plugin_type(), and before meta_run().
	 */
	function init(): void;

	function is_debugging(): boolean;

	function is_syncing(): boolean;

	function is_verbose(): boolean;

	function keybindings_set_custom_handler(name: string, handler: KeyHandlerFunc, free_data: GLib.DestroyNotify): boolean;

	/**
	 * Sets up a callback  to be called at some later time. #when determines the
	 * particular later occasion at which it is called. This is much like {@link G.idle_add},
	 * except that the functions interact properly with clutter event handling.
	 * If a "later" function is added from a clutter event handler, and is supposed
	 * to be run before the stage is redrawn, it will be run before that redraw
	 * of the stage, not the next one.
	 * @param when enumeration value determining the phase at which to run the callback
	 * @param func callback to run later
	 * @param data data to pass to the callback
	 * @param notify function to call to destroy #data when it is no longer in use, or %NULL
	 * @returns an integer ID (guaranteed to be non-zero) that can be used
	 *  to cancel the callback and prevent it from being run.
	 */
	function later_add(when: LaterType, func: GLib.SourceFunc, data: any | null, notify: GLib.DestroyNotify): number;

	/**
	 * Removes a callback added with {@link Meta.later.add}
	 * @param later_id the integer ID returned from {@link Meta.later.add}
	 */
	function later_remove(later_id: number): void;

	function pop_no_msg_prefix(): void;

	function pre_exec_close_fds(): void;

	function preference_to_string(pref: Preference): string;

	function prefs_add_listener(func: PrefsChangedFunc, data: any | null): void;

	function prefs_bell_is_audible(): boolean;

	function prefs_change_workspace_name(i: number, name: string): void;

	function prefs_get_action_double_click_titlebar(): CDesktopEnums.TitlebarAction;

	function prefs_get_action_middle_click_titlebar(): CDesktopEnums.TitlebarAction;

	function prefs_get_action_right_click_titlebar(): CDesktopEnums.TitlebarAction;

	function prefs_get_action_scroll_wheel_titlebar(): CDesktopEnums.TitlebarScrollAction;

	function prefs_get_application_based(): boolean;

	function prefs_get_attach_modal_dialogs(): boolean;

	function prefs_get_auto_raise(): boolean;

	function prefs_get_auto_raise_delay(): number;

	function prefs_get_background_transition(): BackgroundTransition;

	function prefs_get_bring_windows_to_current_workspace(): boolean;

	/**
	 * Returns the titlebar button definitions.
	 * @returns the {@link ButtonLayout}
	 */
	function prefs_get_button_layout(): ButtonLayout;

	function prefs_get_compositing_manager(): boolean;

	function prefs_get_cursor_size(): number;

	function prefs_get_cursor_theme(): string;

	function prefs_get_disable_workarounds(): boolean;

	function prefs_get_draggable_border_width(): number;

	function prefs_get_dynamic_workspaces(): boolean;

	function prefs_get_edge_resistance_window(): boolean;

	function prefs_get_edge_tiling(): boolean;

	function prefs_get_focus_mode(): CDesktopEnums.FocusMode;

	function prefs_get_focus_new_windows(): CDesktopEnums.FocusNewWindows;

	function prefs_get_force_fullscreen(): boolean;

	function prefs_get_gnome_accessibility(): boolean;

	function prefs_get_gnome_animations(): boolean;

	function prefs_get_ignore_hide_titlebar_when_maximized(): boolean;

	function prefs_get_invert_flip_direction(): boolean;

	function prefs_get_keybinding_action(name: string): KeyBindingAction;

	function prefs_get_keybindings(): KeyPref[];

	function prefs_get_legacy_snap(): boolean;

	function prefs_get_min_win_opacity(): number;

	function prefs_get_mouse_button_menu(): number;

	function prefs_get_mouse_button_mods(): VirtualModifier;

	function prefs_get_mouse_button_resize(): number;

	function prefs_get_mouse_button_zoom_mods(): VirtualModifier;

	function prefs_get_mouse_zoom_enabled(): boolean;

	function prefs_get_num_workspaces(): number;

	function prefs_get_placement_mode(): PlacementMode;

	function prefs_get_raise_on_click(): boolean;

	function prefs_get_resize_threshold(): number;

	function prefs_get_screenshot_command(): string;

	function prefs_get_send_frame_timings(): boolean;

	function prefs_get_snap_modifier(): number;

	function prefs_get_sync_method(): SyncMethod;

	function prefs_get_terminal_command(): string;

	function prefs_get_theme(): string;

	function prefs_get_threaded_swap(): boolean;

	function prefs_get_tile_hud_threshold(): number;

	function prefs_get_tile_maximize(): boolean;

	function prefs_get_titlebar_font(): Pango.FontDescription;

	function prefs_get_ui_scale(): number;

	function prefs_get_unredirect_fullscreen_windows(): boolean;

	function prefs_get_visual_bell(): boolean;

	function prefs_get_visual_bell_type(): CDesktopEnums.VisualBellType;

	function prefs_get_window_binding(name: string, keysym: number, modifiers: VirtualModifier): void;

	function prefs_get_window_screenshot_command(): string;

	function prefs_get_workspace_cycle(): boolean;

	function prefs_get_workspace_name(i: number): string;

	function prefs_get_workspaces_only_on_primary(): boolean;

	function prefs_init(): void;

	/**
	 * Specify a schema whose keys are used to override the standard Metacity
	 * keys. This might be used if a plugin expected a different value for
	 * some preference than the Metacity default. While this function can be
	 * called at any point, this function should generally be called in a
	 * plugin's constructor, rather than in its start() method so the preference
	 * isn't first loaded with one value then changed to another value.
	 * @param key the preference name
	 * @param schema new schema for preference %key
	 */
	function prefs_override_preference_schema(key: string, schema: string): void;

	function prefs_remove_listener(func: PrefsChangedFunc, data: any | null): void;

	function prefs_set_compositing_manager(whether: boolean): void;

	function prefs_set_force_fullscreen(whether: boolean): void;

	function prefs_set_num_workspaces(n_workspaces: number): void;

	function prefs_set_ui_scale(ui_scale: number): void;

	function print_backtrace(): void;

	function push_no_msg_prefix(): void;

	function quit(code: ExitCode): void;

	function rect(x: number, y: number, width: number, height: number): Rectangle;

	/**
	 * Stop printing log messages for the given topic #topic.  Note
	 * that this method does not stack with {@link Meta.add.verbose_topic};
	 * i.e. if two calls to meta_add_verbose_topic() for the same
	 * topic are made, one call to meta_remove_verbose_topic() will
	 * remove it.
	 * @param topic Topic for which logging will be stopped
	 */
	function remove_verbose_topic(topic: DebugTopic): void;

	/**
	 * Starts the process of restarting the compositor.
	 */
	function restart(): void;

	/**
	 * Runs muffin. Call this after completing your own initialization.
	 * @returns muffin's exit status
	 */
	function run(): number;

	function set_gnome_wm_keybindings(wm_keybindings: string): void;

	function set_stage_input_region(screen: Screen, region: xfixes.XserverRegion): void;

	function set_wm_name(wm_name: string): void;

	function show_dialog(type: string, message: string, timeout: string, display: string, ok_text: string, cancel_text: string, transient_for: number, columns: any[], entries: any[]): GLib.Pid;

	function theme_get_current(): Theme;

	function theme_load(theme_name: string): Theme;

	function theme_new(): Theme;

	function theme_set_current(name: string, force_reload: boolean): void;

	function topic_real(topic: DebugTopic, format: string): void;

	function unsigned_long_equal(v1: any | null, v2: any | null): number;

	function unsigned_long_hash(v: any | null): number;

	function verbose_real(format: string): void;

	function warning(format: string): void;

	const DEFAULT_ICON_NAME: string;

	const PRIORITY_BEFORE_REDRAW: number;

	const PRIORITY_PREFS_NOTIFY: number;

	const PRIORITY_REDRAW: number;

	const PRIORITY_RESIZE: number;

}