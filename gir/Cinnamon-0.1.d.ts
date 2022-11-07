/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.Cinnamon {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link App} instead.
	 */
	interface IApp {
		/**
		 * The high-level state of the application, effectively whether it's
		 * running or not, or transitioning between those states.
		 */
		readonly state: AppState;
		/**
		 * Like {@link Cinnamon.App.activate_full}, but using the default workspace and
		 * event timestamp.
		 */
		activate(): void;
		/**
		 * Perform an appropriate default action for operating on this application,
		 * dependent on its current state.  For example, if the application is not
		 * currently running, launch it.  If it is running, activate the most
		 * recently used NORMAL window (or if that window has a transient, the most
		 * recently used transient for that window).
		 * @param workspace launch on this workspace, or -1 for default. Ignored if
		 *   activating an existing window
		 * @param timestamp Event timestamp
		 */
		activate_full(workspace: number, timestamp: number): void;
		/**
		 * Bring all windows for the given app to the foreground,
		 * but ensure that #window is on top.  If #window is %NULL,
		 * the window with the most recent user time for the app
		 * will be used.
		 * 
		 * This function has no effect if #app is not currently running.
		 * @param window Window to be focused
		 * @param timestamp Event timestamp
		 */
		activate_window(window: Meta.Window | null, timestamp: number): void;
		/**
		 * Returns %TRUE if the app supports opening a new window through
		 * {@link Cinnamon.App.open_new_window} (ie, if calling that function will
		 * result in actually opening a new window and not something else,
		 * like presenting the most recently active one)
		 * @returns 
		 */
		can_open_new_window(): boolean;
		/**
		 * Look up the icon for this application, and create a #ClutterActor
		 * for it at the given size.
		 * @param size
		 * @returns A floating #ClutterActor
		 */
		create_icon_texture(size: number): Clutter.Actor;
		/**
		 * Look up the icon for this application, and create a #ClutterTexture
		 * for it at the given size.  If for_window is NULL, it bases the icon
		 * off the most-recently-used window for the app, otherwise it attempts to
		 * use for_window for determining the icon.
		 * @param size the size of the icon to create
		 * @param for_window Optional - the backing MetaWindow to look up for.
		 * @returns A floating #ClutterActor
		 */
		create_icon_texture_for_window(size: number, for_window?: Meta.Window | null): Clutter.Actor;
		get_app_info(): CMenu.DesktopAppInfo;
		get_description(): string;
		get_flatpak_app_id(): string;
		get_id(): string;
		get_is_flatpak(): boolean;
		get_keywords(): string;
		get_n_windows(): number;
		get_name(): string;
		get_nodisplay(): boolean;
		get_pids(): number[];
		get_state(): AppState;
		get_tree_entry(): CMenu.TreeEntry;
		/**
		 * Get the toplevel, interesting windows which are associated with this
		 * application.  The returned list will be sorted first by whether
		 * they're on the active workspace, then by whether they're visible,
		 * and finally by the time the user last interacted with them.
		 * @returns List of windows
		 */
		get_windows(): Meta.Window[];
		is_on_workspace(workspace: Meta.Workspace): boolean;
		/**
		 * A window backed application is one which represents just an open
		 * window, i.e. there's no .desktop file association, so we don't know
		 * how to launch it again.
		 * @returns 
		 */
		is_window_backed(): boolean;
		launch(timestamp: number, uris: string[], workspace: number): [ boolean, string ];
		/**
		 * Launch an application using the dedicated gpu (if available)
		 * @param timestamp Event timestamp, or 0 for current event timestamp
		 * @param uris List of uris to pass to application
		 * @param workspace Start on this workspace, or -1 for default
		 * @returns 
		 * 
		 * Returned startup notification ID, or %NULL if none
		 */
		launch_offloaded(timestamp: number, uris: string[], workspace: number): [ boolean, string ];
		/**
		 * Request that the application create a new window.
		 * @param workspace open on this workspace, or -1 for default
		 */
		open_new_window(workspace: number): void;
		/**
		 * Initiate an asynchronous request to quit this application.
		 * The application may interact with the user, and the user
		 * might cancel the quit request from the application UI.
		 * 
		 * This operation may not be supported for all applications.
		 * @returns %TRUE if a quit request is supported for this application
		 */
		request_quit(): boolean;
		connect(signal: "windows-changed", callback: (owner: this) => void): number;

		connect(signal: "notify::state", callback: (owner: this, ...args: any) => void): number;

	}

	type AppInitOptionsMixin = GObject.ObjectInitOptions
	export interface AppInitOptions extends AppInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link App} instead.
	 */
	type AppMixin = IApp & GObject.Object;

	interface App extends AppMixin {}

	class App {
		public constructor(options?: Partial<AppInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AppSystem} instead.
	 */
	interface IAppSystem {
		get_all(): App[];
		/**
		 * Returns the set of applications which currently have at least one
		 * open window in the given context.
		 * @returns Active applications
		 */
		get_running(): App[];
		get_tree(): CMenu.Tree;
		/**
		 * Find a {@link App} corresponding to an id.
		 * @param id
		 * @returns The {@link App} for id, or %NULL if none
		 */
		lookup_app(id: string): App;
		/**
		 * Find a valid application whose .desktop file, without the extension
		 * and properly canonicalized, matches #wmclass.
		 * @param wmclass A WM_CLASS value
		 * @returns A {@link App} for #wmclass
		 */
		lookup_desktop_wmclass(wmclass?: string | null): App;
		/**
		 * Find a {@link App} corresponding to a flatpak app id.
		 * @param app_id
		 * @returns The {@link App} for app_id, or %NULL if none
		 */
		lookup_flatpak_app_id(app_id: string): App;
		/**
		 * Find a valid application whose .desktop file contains a
		 * StartupWMClass entry matching #wmclass.
		 * @param wmclass A WM_CLASS value
		 * @returns A {@link App} for #wmclass
		 */
		lookup_startup_wmclass(wmclass?: string | null): App;
		connect(signal: "app-state-changed", callback: (owner: this, object: App) => void): number;
		connect(signal: "installed-changed", callback: (owner: this) => void): number;

	}

	type AppSystemInitOptionsMixin = GObject.ObjectInitOptions
	export interface AppSystemInitOptions extends AppSystemInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AppSystem} instead.
	 */
	type AppSystemMixin = IAppSystem & GObject.Object;

	interface AppSystem extends AppSystemMixin {}

	class AppSystem {
		public constructor(options?: Partial<AppSystemInitOptions>);
		public static get_default(): AppSystem;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CalendarServerProxy} instead.
	 */
	interface ICalendarServerProxy {

	}

	type CalendarServerProxyInitOptionsMixin = Gio.DBusProxyInitOptions & CalendarServerInitOptions & Gio.AsyncInitableInitOptions & Gio.DBusInterfaceInitOptions & Gio.InitableInitOptions
	export interface CalendarServerProxyInitOptions extends CalendarServerProxyInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CalendarServerProxy} instead.
	 */
	type CalendarServerProxyMixin = ICalendarServerProxy & Gio.DBusProxy & CalendarServer & Gio.AsyncInitable & Gio.DBusInterface & Gio.Initable;

	/**
	 * The {@link CalendarServerProxy} structure contains only private data and should only be accessed using the provided API.
	 */
	interface CalendarServerProxy extends CalendarServerProxyMixin {}

	class CalendarServerProxy {
		public constructor(options?: Partial<CalendarServerProxyInitOptions>);
		/**
		 * Finishes an operation started with {@link Cinnamon.CalendarServerProxy.new}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Cinnamon.CalendarServerProxy.new}.
		 * @returns The constructed proxy object or %NULL if #error is set.
		 */
		public static new_finish(res: Gio.AsyncResult): CalendarServerProxy;
		/**
		 * Finishes an operation started with {@link Cinnamon.CalendarServerProxy.new_for_bus}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Cinnamon.CalendarServerProxy.new_for_bus}.
		 * @returns The constructed proxy object or %NULL if #error is set.
		 */
		public static new_for_bus_finish(res: Gio.AsyncResult): CalendarServerProxy;
		/**
		 * Like {@link Cinnamon.CalendarServerProxy.new_sync} but takes a #GBusType instead of a #GDBusConnection.
		 * 
		 * The calling thread is blocked until a reply is received.
		 * 
		 * See cinnamon_calendar_server_proxy_new_for_bus() for the asynchronous version of this constructor.
		 * @param bus_type A #GBusType.
		 * @param flags Flags from the #GDBusProxyFlags enumeration.
		 * @param name A bus name (well-known or unique).
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns The constructed proxy object or %NULL if #error is set.
		 */
		public static new_for_bus_sync(bus_type: Gio.BusType, flags: Gio.DBusProxyFlags, name: string, object_path: string, cancellable?: Gio.Cancellable | null): CalendarServerProxy;
		/**
		 * Synchronously creates a proxy for the D-Bus interface <link linkend="gdbus-interface-org-cinnamon-CalendarServer.top_of_page">org.cinnamon.CalendarServer</link>. See {@link Glib.dbus_proxy_new_sync} for more details.
		 * 
		 * The calling thread is blocked until a reply is received.
		 * 
		 * See cinnamon_calendar_server_proxy_new() for the asynchronous version of this constructor.
		 * @param connection A #GDBusConnection.
		 * @param flags Flags from the #GDBusProxyFlags enumeration.
		 * @param name A bus name (well-known or unique) or %NULL if #connection is not a message bus connection.
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns The constructed proxy object or %NULL if #error is set.
		 */
		public static new_sync(connection: Gio.DBusConnection, flags: Gio.DBusProxyFlags, name: string | null, object_path: string, cancellable?: Gio.Cancellable | null): CalendarServerProxy;
		/**
		 * Asynchronously creates a proxy for the D-Bus interface <link linkend="gdbus-interface-org-cinnamon-CalendarServer.top_of_page">org.cinnamon.CalendarServer</link>. See {@link Glib.dbus_proxy_new} for more details.
		 * 
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call cinnamon_calendar_server_proxy_new_finish() to get the result of the operation.
		 * 
		 * See cinnamon_calendar_server_proxy_new_sync() for the synchronous, blocking version of this constructor.
		 * @param connection A #GDBusConnection.
		 * @param flags Flags from the #GDBusProxyFlags enumeration.
		 * @param name A bus name (well-known or unique) or %NULL if #connection is not a message bus connection.
		 * @param object_path An object path.
		 * @param cancellable A #GCancellable or %NULL.
		 * @param callback A #GAsyncReadyCallback to call when the request is satisfied.
		 */
		public static new(connection: Gio.DBusConnection, flags: Gio.DBusProxyFlags, name: string | null, object_path: string, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Like {@link Cinnamon.CalendarServerProxy.new} but takes a #GBusType instead of a #GDBusConnection.
		 * 
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call cinnamon_calendar_server_proxy_new_for_bus_finish() to get the result of the operation.
		 * 
		 * See cinnamon_calendar_server_proxy_new_for_bus_sync() for the synchronous, blocking version of this constructor.
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
	 * use {@link CalendarServerSkeleton} instead.
	 */
	interface ICalendarServerSkeleton {

	}

	type CalendarServerSkeletonInitOptionsMixin = Gio.DBusInterfaceSkeletonInitOptions & CalendarServerInitOptions & Gio.DBusInterfaceInitOptions
	export interface CalendarServerSkeletonInitOptions extends CalendarServerSkeletonInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CalendarServerSkeleton} instead.
	 */
	type CalendarServerSkeletonMixin = ICalendarServerSkeleton & Gio.DBusInterfaceSkeleton & CalendarServer & Gio.DBusInterface;

	/**
	 * The {@link CalendarServerSkeleton} structure contains only private data and should only be accessed using the provided API.
	 */
	interface CalendarServerSkeleton extends CalendarServerSkeletonMixin {}

	class CalendarServerSkeleton {
		public constructor(options?: Partial<CalendarServerSkeletonInitOptions>);
		/**
		 * Creates a skeleton object for the D-Bus interface <link linkend="gdbus-interface-org-cinnamon-CalendarServer.top_of_page">org.cinnamon.CalendarServer</link>.
		 * @returns The skeleton object.
		 */
		public static new(): CalendarServerSkeleton;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DocSystem} instead.
	 */
	interface IDocSystem {
		/**
		 * Returns the currently cached set of recent files. Recent files are read initially
		 * from the underlying #GtkRecentManager, and updated when it changes.
		 * This function does not perform I/O.
		 * @returns Cached recent file infos
		 */
		get_all(): Gtk.RecentInfo[];
		connect(signal: "changed", callback: (owner: this) => void): number;

	}

	type DocSystemInitOptionsMixin = GObject.ObjectInitOptions
	export interface DocSystemInitOptions extends DocSystemInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DocSystem} instead.
	 */
	type DocSystemMixin = IDocSystem & GObject.Object;

	interface DocSystem extends DocSystemMixin {}

	class DocSystem {
		public constructor(options?: Partial<DocSystemInitOptions>);
		public static get_default(): DocSystem;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link EmbeddedWindow} instead.
	 */
	interface IEmbeddedWindow {

	}

	type EmbeddedWindowInitOptionsMixin = Gtk.WindowInitOptions & Atk.ImplementorIfaceInitOptions & Gtk.BuildableInitOptions
	export interface EmbeddedWindowInitOptions extends EmbeddedWindowInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link EmbeddedWindow} instead.
	 */
	type EmbeddedWindowMixin = IEmbeddedWindow & Gtk.Window & Atk.ImplementorIface & Gtk.Buildable;

	interface EmbeddedWindow extends EmbeddedWindowMixin {}

	class EmbeddedWindow {
		public constructor(options?: Partial<EmbeddedWindowInitOptions>);
		public static new(): Gtk.Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GLSLQuad} instead.
	 */
	interface IGLSLQuad {
		/**
		 * Adds a GLSL snippet to the pipeline used for drawing the actor texture.
		 * See #CoglSnippet for details.
		 * 
		 * This is only valid inside the a call to the {@link Build.pipeline} virtual
		 * function.
		 * @param hook where to insert the code
		 * @param declarations GLSL declarations
		 * @param code GLSL code
		 * @param is_replace wheter Cogl code should be replaced by the custom shader
		 */
		add_glsl_snippet(hook: SnippetHook, declarations: string, code: string, is_replace: boolean): void;
		get_uniform_location(name: string): number;
		set_uniform_float(uniform: number, n_components: number, value: number[]): void;
	}

	type GLSLQuadInitOptionsMixin = Clutter.ActorInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions
	export interface GLSLQuadInitOptions extends GLSLQuadInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GLSLQuad} instead.
	 */
	type GLSLQuadMixin = IGLSLQuad & Clutter.Actor & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface GLSLQuad extends GLSLQuadMixin {}

	class GLSLQuad {
		public constructor(options?: Partial<GLSLQuadInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GenericContainer} instead.
	 */
	interface IGenericContainer {
		get_n_skip_paint(): number;
		/**
		 * Gets whether or not #actor is skipped when painting.
		 * @param child Child #ClutterActor
		 * @returns %TRUE or %FALSE
		 */
		get_skip_paint(child: Clutter.Actor): boolean;
		/**
		 * Set whether or not we should skip painting #actor.  Workaround for
		 * lack of gjs ability to override _paint vfunc.
		 * @param child Child #ClutterActor
		 * @param skip %TRUE if we should skip painting
		 */
		set_skip_paint(child: Clutter.Actor, skip: boolean): void;
		/**
		 * Emitted when #self is allocated, after chaining up to the parent
		 * allocate method.
		 * 
		 * Note that #box is #self's content box (qv
		 * {@link St.ThemeNode.get_content_box}), NOT its allocation.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - box: #self's content box 
		 *  - flags: the allocation flags. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "allocate", callback: (owner: this, box: Clutter.ActorBox, flags: Clutter.AllocationFlags) => void): number;
		/**
		 * Emitted when {@link Clutter.Actor.get_preferred_height} is called
		 * on #self. You should fill in the fields of #alloc with the
		 * your minimum and natural heights. {@link GenericContainer}
		 * will deal with taking its borders and padding into account
		 * for you.
		 * 
		 * #alloc's fields are initialized to 0, so unless you have a fixed
		 * height specified (via #ClutterActor:height or CSS), you must
		 * connect to this signal and fill in the values.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - for_width: as in {@link Clutter.Actor.get_preferred_height} 
		 *  - alloc: a {@link GenericContainerAllocation} to be filled in 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "get-preferred-height", callback: (owner: this, for_width: number, alloc: GenericContainerAllocation) => void): number;
		/**
		 * Emitted when {@link Clutter.Actor.get_preferred_width} is called
		 * on #self. You should fill in the fields of #alloc with the
		 * your minimum and natural widths. {@link GenericContainer}
		 * will deal with taking its borders and padding into account
		 * for you.
		 * 
		 * #alloc's fields are initialized to 0, so unless you have a fixed
		 * width specified (via #ClutterActor:width or CSS), you must
		 * connect to this signal and fill in the values.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - for_height: as in {@link Clutter.Actor.get_preferred_width} 
		 *  - alloc: a {@link GenericContainerAllocation} to be filled in 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "get-preferred-width", callback: (owner: this, for_height: number, alloc: GenericContainerAllocation) => void): number;

	}

	type GenericContainerInitOptionsMixin = St.WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions
	export interface GenericContainerInitOptions extends GenericContainerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GenericContainer} instead.
	 */
	type GenericContainerMixin = IGenericContainer & St.Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface GenericContainer extends GenericContainerMixin {}

	class GenericContainer {
		public constructor(options?: Partial<GenericContainerInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Global} instead.
	 */
	interface IGlobal {
		readonly background_actor: Clutter.Actor;
		readonly bottom_window_group: Gtk.WindowGroup;
		readonly datadir: string;
		readonly desklet_container: Clutter.Actor;
		readonly display: Meta.Display;
		readonly focus_manager: St.FocusManager;
		readonly gdk_screen: Gdk.Screen;
		readonly imagedir: string;
		readonly overlay_group: Clutter.Actor;
		readonly screen: Screen;
		readonly screen_height: number;
		readonly screen_width: number;
		session_running: boolean;
		readonly settings: Gio.Settings;
		readonly stage: Clutter.Stage;
		stage_input_mode: StageInputMode;
		readonly top_window_group: Gtk.WindowGroup;
		readonly ui_scale: number;
		readonly userdatadir: string;
		readonly window_group: Gtk.WindowGroup;
		readonly window_manager: WM;
		readonly workspace_manager: Meta.WorkspaceManager;
		/**
		 * Request mb megabytes allocated. This is just for debugging.
		 * @param mb How many mb to leak
		 */
		alloc_leak(mb: number): void;
		/**
		 * Grabs the keyboard and mouse to the stage window. The stage will
		 * receive all keyboard and mouse events until {@link Cinnamon.Global.end_modal}
		 * is called. This is used to implement "modes" for the shell, such as the
		 * overview mode or the "looking glass" debug overlay, that block
		 * application and normal key shortcuts.
		 * @param timestamp
		 * @param options
		 * @returns %TRUE if we succesfully entered the mode. %FALSE if we couldn't
		 *  enter the mode. Failure may occur because an application has the pointer
		 *  or keyboard grabbed, because Mutter is in a mode itself like moving a
		 *  window or alt-Tab window selection, or because {@link Cinnamon.Global.begin_modal}
		 *  was previouly called.
		 */
		begin_modal(timestamp: number, options: Meta.ModalOptions): boolean;
		/**
		 * Marks that we are currently doing work. This is used to to track
		 * whether we are busy for the purposes of {@link Cinnamon.Global.run_at_leisure}.
		 * A count is kept and cinnamon_global_end_work() must be called exactly
		 * as many times as cinnamon_global_begin_work().
		 */
		begin_work(): void;
		/**
		 * Create a #GAppLaunchContext set up with the correct timestamp, and
		 * targeted to activate on the current workspace.
		 * @returns A new #GAppLaunchContext
		 */
		create_app_launch_context(): Gio.AppLaunchContext;
		create_pointer_barrier(x1: number, y1: number, x2: number, y2: number, directions: number): number;
		destroy_pointer_barrier(barrier: number): void;
		/**
		 * Prints out the gjs stack
		 */
		dump_gjs_stack(): void;
		/**
		 * Undoes the effect of {@link Cinnamon.Global.begin_modal}.
		 * @param timestamp
		 */
		end_modal(timestamp: number): void;
		/**
		 * Marks the end of work that we started with {@link Cinnamon.Global.begin_work}.
		 * If no other work is ongoing and functions have been added with
		 * cinnamon_global_run_at_leisure(), they will be run at the next
		 * opportunity.
		 */
		end_work(): void;
		get_current_time(): number;
		get_display(): Meta.Display;
		get_gdk_screen(): Gdk.Screen;
		get_md5_for_string(string: string): string;
		get_pid(): number;
		/**
		 * Gets the pointer coordinates and current modifier key state.
		 * This is a wrapper around {@link Gdk.Display.get_pointer} that strips
		 * out any un-declared modifier flags, to make gjs happy; see
		 * https://bugzilla.gnome.org/show_bug.cgi?id=597292.
		 * @returns the X coordinate of the pointer, in global coordinates
		 * 
		 * the Y coordinate of the pointer, in global coordinates
		 * 
		 * the current set of modifier keys that are pressed down
		 */
		get_pointer(): [ x: number, y: number, mods: Clutter.ModifierType ];
		get_screen(): Screen;
		/**
		 * Get the global GSettings instance.
		 * @returns The GSettings object
		 */
		get_settings(): Gio.Settings;
		get_stage(): Clutter.Stage;
		/**
		 * Gets the list of #MetaWindowActor for the plugin's screen
		 * @returns the list of windows
		 */
		get_window_actors(): GLib.List<Meta.WindowActor>;
		/**
		 * Show a system error notification.  Use this function
		 * when a user-initiated action results in a non-fatal problem
		 * from causes that may not be under system control.  For
		 * example, an application crash.
		 * @param msg Error message
		 * @param details Error details
		 */
		notify_error(msg: string, details: string): void;
		/**
		 * Restart the current process.
		 */
		real_restart(): void;
		/**
		 * Initiates the shutdown sequence.
		 */
		reexec_self(): void;
		/**
		 * Schedules a function to be called the next time Cinnamon is idle.
		 * Idle means here no animations, no redrawing, and no ongoing background
		 * work. Since there is currently no way to hook into the Clutter master
		 * clock and know when is running, the implementation here is somewhat
		 * approximation. Animations done through Cinnamon's Tweener module will
		 * be handled properly, but other animations may be detected as terminating
		 * early if they can be drawn fast enough so that the event loop goes idle
		 * between frames.
		 * 
		 * The intent of this function is for performance measurement runs
		 * where a number of actions should be run serially and each action is
		 * timed individually. Using this function for other purposes will
		 * interfere with the ability to use it for performance measurement so
		 * should be avoided.
		 * @param func function to call at leisure
		 */
		run_at_leisure(func: LeisureFunction): void;
		/**
		 * Crashes Cinnamon by causing a segfault
		 */
		segfault(): void;
		/**
		 * Set the cursor on the stage window.
		 * @param type the type of the cursor
		 */
		set_cursor(type: Cursor): void;
		/**
		 * Sets the pointer coordinates.
		 * This is a wrapper around {@link Gdk.Device.warp}.
		 * @param x the X coordinate of the pointer, in global coordinates
		 * @param y the Y coordinate of the pointer, in global coordinates
		 */
		set_pointer(x: number, y: number): void;
		/**
		 * Sets the input mode of the stage; when #mode is
		 * %CINNAMON_STAGE_INPUT_MODE_NONREACTIVE, then the stage does not absorb
		 * any clicks, but just passes them through to underlying windows.
		 * When it is %CINNAMON_STAGE_INPUT_MODE_NORMAL, then the stage accepts
		 * clicks in the region defined by
		 * {@link Cinnamon.Global.set_stage_input_region} but passes through clicks
		 * outside that region. When it is %CINNAMON_STAGE_INPUT_MODE_FULLSCREEN,
		 * the stage absorbs all input.
		 * 
		 * When the input mode is %CINNAMON_STAGE_INPUT_MODE_FOCUSED, the pointer
		 * is handled as with %CINNAMON_STAGE_INPUT_MODE_NORMAL, but additionally
		 * the stage window has the keyboard focus. If the stage loses the
		 * focus (eg, because the user clicked into a window) the input mode
		 * will revert to %CINNAMON_STAGE_INPUT_MODE_NORMAL.
		 * 
		 * Note that whenever a muffin-internal Gtk widget has a pointer grab,
		 * Cinnamon behaves as though it was in
		 * %CINNAMON_STAGE_INPUT_MODE_NONREACTIVE, to ensure that the widget gets
		 * any clicks it is expecting.
		 * @param mode the stage input mode
		 */
		set_stage_input_mode(mode: StageInputMode): void;
		/**
		 * Sets the area of the stage that is responsive to mouse clicks when
		 * the stage mode is %CINNAMON_STAGE_INPUT_MODE_NORMAL (but does not change the
		 * current stage mode).
		 * @param rectangles a list of #MetaRectangle
		 * describing the input region.
		 */
		set_stage_input_region(rectangles: Meta.Rectangle[]): void;
		/**
		 * Ensures that clutter is aware of the current pointer position,
		 * causing enter and leave events to be emitted if the pointer moved
		 * behind our back (ie, during a pointer grab).
		 */
		sync_pointer(): void;
		/**
		 * Unset the cursor on the stage window.
		 */
		unset_cursor(): void;
		connect(signal: "notify-error", callback: (owner: this, object: string, p0: string) => void): number;
		connect(signal: "scale-changed", callback: (owner: this) => void): number;
		connect(signal: "shutdown", callback: (owner: this) => void): number;

		connect(signal: "notify::background-actor", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::bottom-window-group", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::datadir", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::desklet-container", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::display", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::focus-manager", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::gdk-screen", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::imagedir", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::overlay-group", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::screen", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::screen-height", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::screen-width", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::session-running", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::settings", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::stage", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::stage-input-mode", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::top-window-group", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ui-scale", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::userdatadir", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window-group", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window-manager", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::workspace-manager", callback: (owner: this, ...args: any) => void): number;

	}

	type GlobalInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IGlobal,
		"session_running" |
		"stage_input_mode">;

	export interface GlobalInitOptions extends GlobalInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Global} instead.
	 */
	type GlobalMixin = IGlobal & GObject.Object;

	interface Global extends GlobalMixin {}

	class Global {
		public constructor(options?: Partial<GlobalInitOptions>);
		/**
		 * Gets the singleton global object that represents the desktop.
		 * @returns the singleton global object
		 */
		public static get(): Global;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GtkEmbed} instead.
	 */
	interface IGtkEmbed {
		window: EmbeddedWindow;

		connect(signal: "notify::window", callback: (owner: this, ...args: any) => void): number;

	}

	type GtkEmbedInitOptionsMixin = Clutter.CloneInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IGtkEmbed,
		"window">;

	export interface GtkEmbedInitOptions extends GtkEmbedInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GtkEmbed} instead.
	 */
	type GtkEmbedMixin = IGtkEmbed & Clutter.Clone & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface GtkEmbed extends GtkEmbedMixin {}

	class GtkEmbed {
		public constructor(options?: Partial<GtkEmbedInitOptions>);
		public static new(window: EmbeddedWindow): Clutter.Actor;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PerfLog} instead.
	 */
	interface IPerfLog {
		/**
		 * Adds a function that will be called before statistics are recorded.
		 * The function would typically compute one or more statistics values
		 * and call a function such as {@link Cinnamon.PerfLog.update_statistic_i}
		 * to update the value that will be recorded.
		 * @param callback function to call before recording statistics
		 */
		add_statistics_callback(callback: PerfStatisticsCallback): void;
		/**
		 * Calls all the update functions added with
		 * {@link Cinnamon.PerfLog.add_statistics_callback} and then records events
		 * for all statistics, followed by a perf.statisticsCollected event.
		 */
		collect_statistics(): void;
		/**
		 * Defines a performance event for later recording.
		 * @param name name of the event. This should of the form
		 *   '<namespace>.<specific event>', for example
		 *   'clutter.stagePaintDone'.
		 * @param description human readable description of the event.
		 * @param signature signature defining the arguments that event takes.
		 *   This is a string of type characters, using the same characters
		 *   as D-Bus or GVariant. Only a very limited number of signatures
		 *   are supported: , '', 's', 'i', and 'x'. This mean respectively:
		 *   no arguments, one string, one 32-bit integer, and one 64-bit
		 *   integer.
		 */
		define_event(name: string, description: string, signature: string): void;
		/**
		 * Defines a statistic. A statistic is a numeric value that is stored
		 * by the performance log and recorded periodically or when
		 * {@link Cinnamon.PerfLog.collect_statistics} is called explicitly.
		 * 
		 * Code that defines a statistic should update it by calling
		 * the update function for the particular data type of the statistic,
		 * such as cinnamon_perf_log_update_statistic_i(). This can be done
		 * at any time, but would normally done inside a function registered
		 * with cinnamon_perf_log_add_statistics_callback(). These functions
		 * are called immediately before statistics are recorded.
		 * @param name name of the statistic and of the corresponding event.
		 *  This should follow the same guidelines as for {@link Cinnamon.PerfLog.define_event}
		 * @param description human readable description of the statistic.
		 * @param signature The type of the data stored for statistic. Must
		 *  currently be 'i' or 'x'.
		 */
		define_statistic(name: string, description: string, signature: string): void;
		/**
		 * Dump the definition of currently defined events and statistics, formatted
		 * as JSON, to the specified output stream. The JSON output is an array,
		 * with each element being a dictionary of the form:
		 * 
		 * { name: <name of event>,
		 *   description: <descrition of string,
		 *   statistic: true } (only for statistics)
		 * @param out output stream into which to write the event definitions
		 * @returns %TRUE if the dump succeeded. %FALSE if an IO error occurred
		 */
		dump_events(out: Gio.OutputStream): boolean;
		/**
		 * Writes the performance event log, formatted as JSON, to the specified
		 * output stream. For performance reasons, the output stream passed
		 * in should generally be a buffered (or memory) output stream, since
		 * it will be written to in small pieces. The JSON output is an array
		 * with the elements of the array also being arrays, of the form
		 * '[' <time>, <event name> [, <event_arg>... ] ']'.
		 * @param out output stream into which to write the event log
		 * @returns %TRUE if the dump succeeded. %FALSE if an IO error occurred
		 */
		dump_log(out: Gio.OutputStream): boolean;
		/**
		 * Records a performance event with no arguments.
		 * @param name name of the event
		 */
		event(name: string): void;
		/**
		 * Records a performance event with one 32-bit integer argument.
		 * @param name name of the event
		 * @param arg the argument
		 */
		event_i(name: string, arg: number): void;
		/**
		 * Records a performance event with one string argument.
		 * @param name name of the event
		 * @param arg the argument
		 */
		event_s(name: string, arg: string): void;
		/**
		 * Records a performance event with one 64-bit integer argument.
		 * @param name name of the event
		 * @param arg the argument
		 */
		event_x(name: string, arg: number): void;
		/**
		 * Replays the log by calling the given function for each event
		 * in the log.
		 * @param replay_function function to call for each event in the log
		 */
		replay(replay_function: PerfReplayFunction): void;
		/**
		 * Sets whether events are currently being recorded.
		 * @param enabled whether to record events
		 */
		set_enabled(enabled: boolean): void;
		/**
		 * Updates the current value of an 32-bit integer statistic.
		 * @param name name of the statistic
		 * @param value new value for the statistic
		 */
		update_statistic_i(name: string, value: number): void;
		/**
		 * Updates the current value of an 64-bit integer statistic.
		 * @param name name of the statistic
		 * @param value new value for the statistic
		 */
		update_statistic_x(name: string, value: number): void;
	}

	type PerfLogInitOptionsMixin = GObject.ObjectInitOptions
	export interface PerfLogInitOptions extends PerfLogInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PerfLog} instead.
	 */
	type PerfLogMixin = IPerfLog & GObject.Object;

	interface PerfLog extends PerfLogMixin {}

	class PerfLog {
		public constructor(options?: Partial<PerfLogInitOptions>);
		/**
		 * Gets the global singleton performance log. This is initially disabled
		 * and must be explicitly enabled with {@link Cinnamon.PerfLog.set_enabled}.
		 * @returns the global singleton performance log
		 */
		public static get_default(): PerfLog;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Recorder} instead.
	 */
	interface IRecorder {
		draw_cursor: boolean;
		file_template: string;
		framerate: number;
		pipeline: string;
		stage: Clutter.Stage;
		/**
		 * Stops recording. It's possible to call {@link Cinnamon.Recorder.record}
		 * again to reopen a new recording stream, but unless change the
		 * recording filename, this may result in the old recording being
		 * overwritten.
		 */
		close(): void;
		/**
		 * Determine if recording is currently in progress. (The recorder
		 * is not paused or closed.)
		 * @returns %TRUE if the recorder is currently recording.
		 */
		is_recording(): boolean;
		/**
		 * Starts recording, Starting the recording may fail if the output file
		 * cannot be opened, or if the output stream cannot be created
		 * for other reasons. In that case a warning is printed to
		 * stderr. There is no way currently to get details on how
		 * recording failed to start.
		 * 
		 * An extra reference count is added to the recorder if recording
		 * is succesfully started; the recording object will not be freed
		 * until recording is stopped even if the creator no longer holds
		 * a reference. Recording is automatically stopped if the stage
		 * is destroyed.
		 * @returns %TRUE if recording was succesfully started
		 * 
		 * actual filename used for recording
		 */
		record(): [ boolean, string | null ];
		set_area(x: number, y: number, width: number, height: number): void;
		set_draw_cursor(draw_cursor: boolean): void;
		/**
		 * Sets the filename that will be used when creating output
		 * files. This is only used if the configured pipeline has an
		 * unconnected source pad (as the default pipeline does). If
		 * the pipeline is complete, then the filename is unused. The
		 * provided string is used as a template.It can contain
		 * the following escapes:
		 * 
		 * %d: The current date as YYYYYMMDD
		 * %%: A literal percent
		 * 
		 * The default value is 'cinnamon-%d%u-%c.ogg'.
		 * @param file_template the filename template to use for output files,
		 *                 or %NULL for the defalt value.
		 */
		set_file_template(file_template: string): void;
		/**
		 * Sets the number of frames per second we try to record. Less frames
		 * will be recorded when the screen doesn't need to be redrawn this
		 * quickly. (This value will also be set as the framerate for the
		 * GStreamer pipeline; whether that has an effect on the resulting
		 * video will depend on the details of the pipeline and the codec. The
		 * default encoding to webm format doesn't pay attention to the pipeline
		 * framerate.)
		 * 
		 * The default value is 30.
		 * @param framerate Framerate used for resulting video in frames-per-second.
		 */
		set_framerate(framerate: number): void;
		/**
		 * Sets the GStreamer pipeline used to encode recordings.
		 * It follows the syntax used for gst-launch. The pipeline
		 * should have an unconnected sink pad where the recorded
		 * video is recorded. It will normally have a unconnected
		 * source pad; output from that pad will be written into the
		 * output file. (See {@link Cinnamon.Recorder.set_file_template}.) However
		 * the pipeline can also take care of its own output - this
		 * might be used to send the output to an icecast server
		 * via shout2send or similar.
		 * 
		 * The default value is 'vp8enc min_quantizer=13 max_quantizer=13 cpu-used=5 deadline=1000000 threads=%T ! queue ! webmmux'
		 * @param pipeline the GStreamer pipeline used to encode recordings
		 *            or %NULL for the default value.
		 */
		set_pipeline(pipeline?: string | null): void;
		connect(signal: "notify::draw-cursor", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::file-template", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::framerate", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pipeline", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::stage", callback: (owner: this, ...args: any) => void): number;

	}

	type RecorderInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IRecorder,
		"draw_cursor" |
		"file_template" |
		"framerate" |
		"pipeline" |
		"stage">;

	export interface RecorderInitOptions extends RecorderInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Recorder} instead.
	 */
	type RecorderMixin = IRecorder & GObject.Object;

	interface Recorder extends RecorderMixin {}

	class Recorder {
		public constructor(options?: Partial<RecorderInitOptions>);
		/**
		 * Create a new {@link Recorder} to record movies of a #ClutterStage
		 * @param stage The #ClutterStage
		 * @returns The newly created {@link Recorder} object
		 */
		public static new(stage: Clutter.Stage): Recorder;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Screen} instead.
	 */
	interface IScreen {
		display: Meta.Display;
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
		append_new_workspace(activate: boolean, timestamp: number): Meta.Workspace;
		get_active_workspace(): Meta.Workspace;
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
		get_display(): Meta.Display;
		/**
		 * Stores the location and size of the indicated monitor in #geometry.
		 * @param monitor the monitor number
		 * @returns location to store the monitor geometry
		 */
		get_monitor_geometry(monitor: number): Meta.Rectangle;
		/**
		 * Determines whether there is a fullscreen window obscuring the specified
		 * monitor. If there is a fullscreen window, the desktop environment will
		 * typically hide any controls that might obscure the fullscreen window.
		 * 
		 * You can get notification when this changes by connecting to
		 * CinnamonScreen::in-fullscreen-changed.
		 * @param monitor the monitor number
		 * @returns %TRUE if there is a fullscreen window covering the specified monitor.
		 */
		get_monitor_in_fullscreen(monitor: number): boolean;
		get_monitor_index_for_rect(rect: Meta.Rectangle): number;
		/**
		 * Gets the #MetaWindow pointed by the mouse
		 * @param not_this_one window to be excluded
		 * @returns the #MetaWindow pointed by the mouse
		 *  %NULL when window not found
		 */
		get_mouse_window(not_this_one?: Meta.Window | null): Meta.Window;
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
		/**
		 * Retrieve the size of the screen.
		 * @returns The width of the screen
		 * 
		 * The height of the screen
		 */
		get_size(): [ width: number, height: number ];
		/**
		 * Gets the workspace object for one of a screen's workspaces given the workspace
		 * index. It's valid to call this function with an out-of-range index and it
		 * will robustly return %NULL.
		 * @param index index of one of the screen's workspaces
		 * @returns the workspace object with specified index, or %NULL
		 *   if the index is out of range.
		 */
		get_workspace_by_index(index: number): Meta.Workspace;
		get_workspaces(): Meta.Workspace[];
		get_xwindow_for_window(window: Meta.Window): number;
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
		override_workspace_layout(starting_corner: Meta.DisplayCorner, vertical_layout: boolean, n_rows: number, n_columns: number): void;
		remove_workspace(workspace: Meta.Workspace, timestamp: number): void;
		show_desktop(timestamp: number): void;
		toggle_desktop(timestamp: number): void;
		unshow_desktop(): void;
		connect(signal: "in-fullscreen-changed", callback: (owner: this) => void): number;
		connect(signal: "monitors-changed", callback: (owner: this) => void): number;
		connect(signal: "restacked", callback: (owner: this) => void): number;
		connect(signal: "window-added", callback: (owner: this, object: Meta.Window, p0: number) => void): number;
		connect(signal: "window-entered-monitor", callback: (owner: this, object: number, p0: Meta.Window) => void): number;
		connect(signal: "window-left-monitor", callback: (owner: this, object: number, p0: Meta.Window) => void): number;
		connect(signal: "window-monitor-changed", callback: (owner: this, object: Meta.Window, p0: number) => void): number;
		connect(signal: "window-removed", callback: (owner: this, object: Meta.Window) => void): number;
		connect(signal: "window-skip-taskbar-changed", callback: (owner: this, object: Meta.Window) => void): number;
		connect(signal: "window-workspace-changed", callback: (owner: this, object: Meta.Window, p0: Meta.Workspace) => void): number;
		connect(signal: "workareas-changed", callback: (owner: this) => void): number;
		connect(signal: "workspace-added", callback: (owner: this, object: number) => void): number;
		connect(signal: "workspace-removed", callback: (owner: this, object: number) => void): number;
		connect(signal: "workspace-switched", callback: (owner: this, object: number, p0: number, p1: Meta.MotionDirection) => void): number;

		connect(signal: "notify::display", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::n-workspaces", callback: (owner: this, ...args: any) => void): number;

	}

	type ScreenInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IScreen,
		"display">;

	export interface ScreenInitOptions extends ScreenInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Screen} instead.
	 */
	type ScreenMixin = IScreen & GObject.Object;

	interface Screen extends ScreenMixin {}

	class Screen {
		public constructor(options?: Partial<ScreenInitOptions>);
		public static new(display: Meta.Display): Screen;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Screenshot} instead.
	 */
	interface IScreenshot {
		/**
		 * Takes a screenshot of the whole screen
		 * in #filename as png image.
		 * @param include_cursor Whether to include the cursor or not
		 * @param filename The filename for the screenshot
		 * @param callback function to call returning success or failure
		 * of the async grabbing
		 */
		screenshot(include_cursor: boolean, filename: string, callback: ScreenshotCallback): void;
		/**
		 * Takes a screenshot of the passed in area and saves it
		 * in #filename as png image.
		 * @param include_cursor
		 * @param x The X coordinate of the area
		 * @param y The Y coordinate of the area
		 * @param width The width of the area
		 * @param height The height of the area
		 * @param filename The filename for the screenshot
		 * @param callback function to call returning success or failure
		 * of the async grabbing
		 */
		screenshot_area(include_cursor: boolean, x: number, y: number, width: number, height: number, filename: string, callback: ScreenshotCallback): void;
		/**
		 * Takes a screenshot of the focused window (optionally omitting the frame)
		 * in #filename as png image.
		 * @param include_frame Whether to include the frame or not
		 * @param include_cursor Whether to include the cursor or not
		 * @param filename The filename for the screenshot
		 * @param callback function to call returning success or failure
		 * of the async grabbing
		 */
		screenshot_window(include_frame: boolean, include_cursor: boolean, filename: string, callback: ScreenshotCallback): void;
	}

	type ScreenshotInitOptionsMixin = GObject.ObjectInitOptions
	export interface ScreenshotInitOptions extends ScreenshotInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Screenshot} instead.
	 */
	type ScreenshotMixin = IScreenshot & GObject.Object;

	interface Screenshot extends ScreenshotMixin {}

	class Screenshot {
		public constructor(options?: Partial<ScreenshotInitOptions>);
		public static new(): Screenshot;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Slicer} instead.
	 */
	interface ISlicer {

	}

	type SlicerInitOptionsMixin = St.BinInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions
	export interface SlicerInitOptions extends SlicerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Slicer} instead.
	 */
	type SlicerMixin = ISlicer & St.Bin & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface Slicer extends SlicerMixin {}

	class Slicer {
		public constructor(options?: Partial<SlicerInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Stack} instead.
	 */
	interface IStack {

	}

	type StackInitOptionsMixin = St.WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions
	export interface StackInitOptions extends StackInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Stack} instead.
	 */
	type StackMixin = IStack & St.Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface Stack extends StackMixin {}

	class Stack {
		public constructor(options?: Partial<StackInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TrayIcon} instead.
	 */
	interface ITrayIcon {
		readonly pid: number;
		readonly title: string;
		readonly wm_class: string;
		/**
		 * Converts a ClutterEvent into an XEvent.
		 * @param event_type a #ClutterEventType
		 * @param event the #ClutterEvent
		 * @returns Whether to continue the event chain.
		 */
		handle_event(event_type: Clutter.EventType, event: Clutter.Event): boolean;
		connect(signal: "notify::pid", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::title", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::wm-class", callback: (owner: this, ...args: any) => void): number;

	}

	type TrayIconInitOptionsMixin = GtkEmbedInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions
	export interface TrayIconInitOptions extends TrayIconInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TrayIcon} instead.
	 */
	type TrayIconMixin = ITrayIcon & GtkEmbed & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface TrayIcon extends TrayIconMixin {}

	class TrayIcon {
		public constructor(options?: Partial<TrayIconInitOptions>);
		public static new(window: EmbeddedWindow): Clutter.Actor;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TrayManager} instead.
	 */
	interface ITrayManager {
		bg_color: Clutter.Color;
		manage_screen(theme_widget: St.Widget): void;
		redisplay(): void;
		set_orientation(orientation: Clutter.Orientation): void;
		unmanage_screen(): void;
		connect(signal: "tray-icon-added", callback: (owner: this, object: Clutter.Actor) => void): number;
		connect(signal: "tray-icon-removed", callback: (owner: this, object: Clutter.Actor) => void): number;

		connect(signal: "notify::bg-color", callback: (owner: this, ...args: any) => void): number;

	}

	type TrayManagerInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<ITrayManager,
		"bg_color">;

	export interface TrayManagerInitOptions extends TrayManagerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TrayManager} instead.
	 */
	type TrayManagerMixin = ITrayManager & GObject.Object;

	interface TrayManager extends TrayManagerMixin {}

	class TrayManager {
		public constructor(options?: Partial<TrayManagerInitOptions>);
		public static new(): TrayManager;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WM} instead.
	 */
	interface IWM {
		/**
		 * The plugin must call this after the user responded to the confirmation dialog.
		 * @param ok if the new configuration was OK
		 */
		complete_display_change(ok: boolean): void;
		/**
		 * The plugin must call this when it has completed a window destroy effect.
		 * @param actor the MetaWindowActor actor
		 */
		completed_destroy(actor: Meta.WindowActor): void;
		/**
		 * The plugin must call this when it has completed a window map effect.
		 * @param actor the MetaWindowActor actor
		 */
		completed_map(actor: Meta.WindowActor): void;
		/**
		 * The plugin must call this when it has completed a window minimize effect.
		 * @param actor the MetaWindowActor actor
		 */
		completed_minimize(actor: Meta.WindowActor): void;
		completed_size_change(actor: Meta.WindowActor): void;
		/**
		 * The plugin must call this when it has finished switching the
		 * workspace.
		 */
		completed_switch_workspace(): void;
		/**
		 * The plugin must call this when it has completed a window unminimize effect.
		 * @param actor the MetaWindowActor actor
		 */
		completed_unminimize(actor: Meta.WindowActor): void;
		connect(signal: "confirm-display-change", callback: (owner: this) => void): number;
		/**
		 * Creates a close dialog for the given window.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - window: The window to create the dialog for 
		 *  - returns The close dialog instance. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "create-close-dialog", callback: (owner: this, window: Meta.Window) => Meta.CloseDialog): number;
		/**
		 * Creates an inhibit shortcuts dialog for the given window.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - window: The window to create the dialog for 
		 *  - returns The inhibit shortcuts dialog instance. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "create-inhibit-shortcuts-dialog", callback: (owner: this, window: Meta.Window) => Meta.InhibitShortcutsDialog): number;
		connect(signal: "destroy", callback: (owner: this, object: Meta.WindowActor) => void): number;
		connect(signal: "filter-keybinding", callback: (owner: this, object: Meta.KeyBinding) => boolean): number;
		connect(signal: "hide-tile-preview", callback: (owner: this) => void): number;
		connect(signal: "kill-switch-workspace", callback: (owner: this) => void): number;
		connect(signal: "kill-window-effects", callback: (owner: this, object: Meta.WindowActor) => void): number;
		connect(signal: "map", callback: (owner: this, object: Meta.WindowActor) => void): number;
		connect(signal: "minimize", callback: (owner: this, object: Meta.WindowActor) => void): number;
		connect(signal: "show-tile-preview", callback: (owner: this, object: Meta.Window, p0: Meta.Rectangle, p1: number) => void): number;
		connect(signal: "show-window-menu", callback: (owner: this, object: Meta.Window, p0: number, p1: Meta.Rectangle) => void): number;
		connect(signal: "size-change", callback: (owner: this, object: Meta.WindowActor, p0: Meta.SizeChange, p1: Meta.Rectangle, p2: Meta.Rectangle) => void): number;
		connect(signal: "size-changed", callback: (owner: this, object: Meta.WindowActor) => void): number;
		connect(signal: "switch-workspace", callback: (owner: this, object: number, p0: number, p1: number) => void): number;
		connect(signal: "switch-workspace-complete", callback: (owner: this) => void): number;
		connect(signal: "unminimize", callback: (owner: this, object: Meta.WindowActor) => void): number;

	}

	type WMInitOptionsMixin = GObject.ObjectInitOptions
	export interface WMInitOptions extends WMInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WM} instead.
	 */
	type WMMixin = IWM & GObject.Object;

	interface WM extends WMMixin {}

	class WM {
		public constructor(options?: Partial<WMInitOptions>);
		/**
		 * Creates a new window management interface by hooking into #plugin.
		 * @param plugin the #MetaPlugin
		 * @returns the new window-management interface
		 */
		public static new(plugin: Meta.Plugin): WM;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WindowTracker} instead.
	 */
	interface IWindowTracker {
		readonly focus_app: App;
		/**
		 * #self; A {@link AppSystem}
		 * Look up the application corresponding to a process.
		 * @param pid A Unix process identifier
		 * @returns A {@link App}, or %NULL if none
		 */
		get_app_from_pid(pid: number): App;
		get_startup_sequences(): Meta.StartupSequence[];
		get_window_app(metawin: Meta.Window): App;
		/**
		 * The CinnamonWindowTracker associates certain kinds of windows with
		 * applications; however, others we don't want to
		 * appear in places where we want to give a list of windows
		 * for an application, such as the alt-tab dialog.
		 * 
		 * An example of a window we don't want to show is the root
		 * desktop window.  We skip all override-redirect types, and also
		 * exclude other window types like tooltip explicitly, though generally
		 * most of these should be override-redirect.
		 * @param window a #MetaWindow
		 * @returns %TRUE if a window is "interesting"
		 */
		is_window_interesting(window: Meta.Window): boolean;
		connect(signal: "startup-sequence-changed", callback: (owner: this, object: Meta.StartupSequence) => void): number;
		connect(signal: "window-app-changed", callback: (owner: this, object: Meta.Window) => void): number;

		connect(signal: "notify::focus-app", callback: (owner: this, ...args: any) => void): number;

	}

	type WindowTrackerInitOptionsMixin = GObject.ObjectInitOptions
	export interface WindowTrackerInitOptions extends WindowTrackerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WindowTracker} instead.
	 */
	type WindowTrackerMixin = IWindowTracker & GObject.Object;

	interface WindowTracker extends WindowTrackerMixin {}

	class WindowTracker {
		public constructor(options?: Partial<WindowTrackerInitOptions>);
		public static get_default(): WindowTracker;
	}

	export interface CalendarServerIfaceInitOptions {}
	/**
	 * Virtual table for the D-Bus interface <link linkend="gdbus-interface-org-cinnamon-CalendarServer.top_of_page">org.cinnamon.CalendarServer</link>.
	 */
	interface CalendarServerIface {}
	class CalendarServerIface {
		public constructor(options?: Partial<CalendarServerIfaceInitOptions>);
		/**
		 * The parent interface.
		 */
		public readonly parent_iface: GObject.TypeInterface;
		public handle_exit: {(object: CalendarServer, invocation: Gio.DBusMethodInvocation): boolean;};
		public handle_set_time_range: {(object: CalendarServer, invocation: Gio.DBusMethodInvocation, arg_since: number, arg_until: number, arg_force_reload: boolean): boolean;};
		public get_since: {(object: CalendarServer): number;};
		public get_status: {(object: CalendarServer): number;};
		public get_until: {(object: CalendarServer): number;};
		public client_disappeared: {(object: CalendarServer, arg_source_uid: string): void;};
		public events_added_or_updated: {(object: CalendarServer, arg_events: GLib.Variant): void;};
		public events_removed: {(object: CalendarServer, arg_ids: string): void;};
	}

	export interface GenericContainerAllocationInitOptions {}
	interface GenericContainerAllocation {}
	class GenericContainerAllocation {
		public constructor(options?: Partial<GenericContainerAllocationInitOptions>);
		public min_size: number;
		public natural_size: number;
		public readonly _refcount: number;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CalendarServer} instead.
	 */
	interface ICalendarServer {
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-cinnamon-CalendarServer.Since">"Since"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		since: number;
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-cinnamon-CalendarServer.Status">"Status"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		status: number;
		/**
		 * Represents the D-Bus property <link linkend="gdbus-property-org-cinnamon-CalendarServer.Until">"Until"</link>.
		 * 
		 * Since the D-Bus property for this #GObject property is readable but not writable, it is meaningful to read from it on both the client- and service-side. It is only meaningful, however, to write to it on the service-side.
		 */
		until: number;
		/**
		 * Asynchronously invokes the <link linkend="gdbus-method-org-cinnamon-CalendarServer.Exit">Exit()</link> D-Bus method on #proxy.
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call cinnamon_calendar_server_call_exit_finish() to get the result of the operation.
		 * 
		 * See cinnamon_calendar_server_call_exit_sync() for the synchronous, blocking version of this method.
		 * @param cancellable A #GCancellable or %NULL.
		 * @param callback A #GAsyncReadyCallback to call when the request is satisfied or %NULL.
		 */
		call_exit(cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Finishes an operation started with {@link Cinnamon.CalendarServer.call_exit}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Cinnamon.CalendarServer.call_exit}.
		 * @returns %TRUE if the call succeeded, %FALSE if #error is set.
		 */
		call_exit_finish(res: Gio.AsyncResult): boolean;
		/**
		 * Synchronously invokes the <link linkend="gdbus-method-org-cinnamon-CalendarServer.Exit">Exit()</link> D-Bus method on #proxy. The calling thread is blocked until a reply is received.
		 * 
		 * See cinnamon_calendar_server_call_exit() for the asynchronous version of this method.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns %TRUE if the call succeeded, %FALSE if #error is set.
		 */
		call_exit_sync(cancellable?: Gio.Cancellable | null): boolean;
		/**
		 * Asynchronously invokes the <link linkend="gdbus-method-org-cinnamon-CalendarServer.SetTimeRange">SetTimeRange()</link> D-Bus method on #proxy.
		 * When the operation is finished, #callback will be invoked in the thread-default main loop of the thread you are calling this method from (see g_main_context_push_thread_default()).
		 * You can then call cinnamon_calendar_server_call_set_time_range_finish() to get the result of the operation.
		 * 
		 * See cinnamon_calendar_server_call_set_time_range_sync() for the synchronous, blocking version of this method.
		 * @param arg_since Argument to pass with the method invocation.
		 * @param arg_until Argument to pass with the method invocation.
		 * @param arg_force_reload Argument to pass with the method invocation.
		 * @param cancellable A #GCancellable or %NULL.
		 * @param callback A #GAsyncReadyCallback to call when the request is satisfied or %NULL.
		 */
		call_set_time_range(arg_since: number, arg_until: number, arg_force_reload: boolean, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Finishes an operation started with {@link Cinnamon.CalendarServer.call_set_time_range}.
		 * @param res The #GAsyncResult obtained from the #GAsyncReadyCallback passed to {@link Cinnamon.CalendarServer.call_set_time_range}.
		 * @returns %TRUE if the call succeeded, %FALSE if #error is set.
		 */
		call_set_time_range_finish(res: Gio.AsyncResult): boolean;
		/**
		 * Synchronously invokes the <link linkend="gdbus-method-org-cinnamon-CalendarServer.SetTimeRange">SetTimeRange()</link> D-Bus method on #proxy. The calling thread is blocked until a reply is received.
		 * 
		 * See cinnamon_calendar_server_call_set_time_range() for the asynchronous version of this method.
		 * @param arg_since Argument to pass with the method invocation.
		 * @param arg_until Argument to pass with the method invocation.
		 * @param arg_force_reload Argument to pass with the method invocation.
		 * @param cancellable A #GCancellable or %NULL.
		 * @returns %TRUE if the call succeeded, %FALSE if #error is set.
		 */
		call_set_time_range_sync(arg_since: number, arg_until: number, arg_force_reload: boolean, cancellable?: Gio.Cancellable | null): boolean;
		/**
		 * Helper function used in service implementations to finish handling invocations of the <link linkend="gdbus-method-org-cinnamon-CalendarServer.Exit">Exit()</link> D-Bus method. If you instead want to finish handling an invocation by returning an error, use g_dbus_method_invocation_return_error() or similar.
		 * 
		 * This method will free #invocation, you cannot use it afterwards.
		 * @param invocation A #GDBusMethodInvocation.
		 */
		complete_exit(invocation: Gio.DBusMethodInvocation): void;
		/**
		 * Helper function used in service implementations to finish handling invocations of the <link linkend="gdbus-method-org-cinnamon-CalendarServer.SetTimeRange">SetTimeRange()</link> D-Bus method. If you instead want to finish handling an invocation by returning an error, use g_dbus_method_invocation_return_error() or similar.
		 * 
		 * This method will free #invocation, you cannot use it afterwards.
		 * @param invocation A #GDBusMethodInvocation.
		 */
		complete_set_time_range(invocation: Gio.DBusMethodInvocation): void;
		/**
		 * Emits the <link linkend="gdbus-signal-org-cinnamon-CalendarServer.ClientDisappeared">"ClientDisappeared"</link> D-Bus signal.
		 * @param arg_source_uid Argument to pass with the signal.
		 */
		emit_client_disappeared(arg_source_uid: string): void;
		/**
		 * Emits the <link linkend="gdbus-signal-org-cinnamon-CalendarServer.EventsAddedOrUpdated">"EventsAddedOrUpdated"</link> D-Bus signal.
		 * @param arg_events Argument to pass with the signal.
		 */
		emit_events_added_or_updated(arg_events: GLib.Variant): void;
		/**
		 * Emits the <link linkend="gdbus-signal-org-cinnamon-CalendarServer.EventsRemoved">"EventsRemoved"</link> D-Bus signal.
		 * @param arg_ids Argument to pass with the signal.
		 */
		emit_events_removed(arg_ids: string): void;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-cinnamon-CalendarServer.Since">"Since"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value.
		 */
		get_since(): number;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-cinnamon-CalendarServer.Status">"Status"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value.
		 */
		get_status(): number;
		/**
		 * Gets the value of the <link linkend="gdbus-property-org-cinnamon-CalendarServer.Until">"Until"</link> D-Bus property.
		 * 
		 * Since this D-Bus property is readable, it is meaningful to use this function on both the client- and service-side.
		 * @returns The property value.
		 */
		get_until(): number;
		/**
		 * Sets the <link linkend="gdbus-property-org-cinnamon-CalendarServer.Since">"Since"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_since(value: number): void;
		/**
		 * Sets the <link linkend="gdbus-property-org-cinnamon-CalendarServer.Status">"Status"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_status(value: number): void;
		/**
		 * Sets the <link linkend="gdbus-property-org-cinnamon-CalendarServer.Until">"Until"</link> D-Bus property to #value.
		 * 
		 * Since this D-Bus property is not writable, it is only meaningful to use this function on the service-side.
		 * @param value The value to set.
		 */
		set_until(value: number): void;
		/**
		 * On the client-side, this signal is emitted whenever the D-Bus signal <link linkend="gdbus-signal-org-cinnamon-CalendarServer.ClientDisappeared">"ClientDisappeared"</link> is received.
		 * 
		 * On the service-side, this signal can be used with e.g. {@link Glib.signal_emit_by_name} to make the object emit the D-Bus signal.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - arg_source_uid: Argument. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "client-disappeared", callback: (owner: this, arg_source_uid: string) => void): number;
		/**
		 * On the client-side, this signal is emitted whenever the D-Bus signal <link linkend="gdbus-signal-org-cinnamon-CalendarServer.EventsAddedOrUpdated">"EventsAddedOrUpdated"</link> is received.
		 * 
		 * On the service-side, this signal can be used with e.g. {@link Glib.signal_emit_by_name} to make the object emit the D-Bus signal.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - arg_events: Argument. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "events-added-or-updated", callback: (owner: this, arg_events: GLib.Variant) => void): number;
		/**
		 * On the client-side, this signal is emitted whenever the D-Bus signal <link linkend="gdbus-signal-org-cinnamon-CalendarServer.EventsRemoved">"EventsRemoved"</link> is received.
		 * 
		 * On the service-side, this signal can be used with e.g. {@link Glib.signal_emit_by_name} to make the object emit the D-Bus signal.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - arg_ids: Argument. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "events-removed", callback: (owner: this, arg_ids: string) => void): number;
		/**
		 * Signal emitted when a remote caller is invoking the <link linkend="gdbus-method-org-cinnamon-CalendarServer.Exit">Exit()</link> D-Bus method.
		 * 
		 * If a signal handler returns %TRUE, it means the signal handler will handle the invocation (e.g. take a reference to #invocation and eventually call cinnamon_calendar_server_complete_exit() or e.g. g_dbus_method_invocation_return_error() on it) and no other signal handlers will run. If no signal handler handles the invocation, the %G_DBUS_ERROR_UNKNOWN_METHOD error is returned.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - invocation: A #GDBusMethodInvocation. 
		 *  - returns %G_DBUS_METHOD_INVOCATION_HANDLED or %TRUE if the invocation was handled, %G_DBUS_METHOD_INVOCATION_UNHANDLED or %FALSE to let other signal handlers run. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "handle-exit", callback: (owner: this, invocation: Gio.DBusMethodInvocation) => boolean): number;
		/**
		 * Signal emitted when a remote caller is invoking the <link linkend="gdbus-method-org-cinnamon-CalendarServer.SetTimeRange">SetTimeRange()</link> D-Bus method.
		 * 
		 * If a signal handler returns %TRUE, it means the signal handler will handle the invocation (e.g. take a reference to #invocation and eventually call cinnamon_calendar_server_complete_set_time_range() or e.g. g_dbus_method_invocation_return_error() on it) and no other signal handlers will run. If no signal handler handles the invocation, the %G_DBUS_ERROR_UNKNOWN_METHOD error is returned.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - invocation: A #GDBusMethodInvocation. 
		 *  - arg_since: Argument passed by remote caller. 
		 *  - arg_until: Argument passed by remote caller. 
		 *  - arg_force_reload: Argument passed by remote caller. 
		 *  - returns %G_DBUS_METHOD_INVOCATION_HANDLED or %TRUE if the invocation was handled, %G_DBUS_METHOD_INVOCATION_UNHANDLED or %FALSE to let other signal handlers run. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "handle-set-time-range", callback: (owner: this, invocation: Gio.DBusMethodInvocation, arg_since: number, arg_until: number, arg_force_reload: boolean) => boolean): number;

		connect(signal: "notify::since", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::status", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::until", callback: (owner: this, ...args: any) => void): number;

	}

	type CalendarServerInitOptionsMixin = Pick<ICalendarServer,
		"since" |
		"status" |
		"until">;

	export interface CalendarServerInitOptions extends CalendarServerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CalendarServer} instead.
	 */
	type CalendarServerMixin = ICalendarServer;

	/**
	 * Abstract interface type for the D-Bus interface <link linkend="gdbus-interface-org-cinnamon-CalendarServer.top_of_page">org.cinnamon.CalendarServer</link>.
	 */
	interface CalendarServer extends CalendarServerMixin {}

	class CalendarServer {
		public constructor(options?: Partial<CalendarServerInitOptions>);
		/**
		 * Gets a machine-readable description of the <link linkend="gdbus-interface-org-cinnamon-CalendarServer.top_of_page">org.cinnamon.CalendarServer</link> D-Bus interface.
		 * @returns A #GDBusInterfaceInfo. Do not free.
		 */
		public static interface_info(): Gio.DBusInterfaceInfo;
		/**
		 * Overrides all #GObject properties in the {@link CalendarServer} interface for a concrete class.
		 * The properties are overridden in the order they are defined.
		 * @param klass The class structure for a #GObject derived class.
		 * @param property_id_begin The property id to assign to the first overridden property.
		 * @returns The last property id.
		 */
		public static override_properties(klass: any, property_id_begin: number): number;
	}



	enum AppState {
		STOPPED = 0,
		STARTING = 1,
		RUNNING = 2
	}

	enum Cursor {
		DND_IN_DRAG = 0,
		DND_UNSUPPORTED_TARGET = 1,
		DND_MOVE = 2,
		DND_COPY = 3,
		POINTING_HAND = 4,
		RESIZE_BOTTOM = 5,
		RESIZE_TOP = 6,
		RESIZE_LEFT = 7,
		RESIZE_RIGHT = 8,
		RESIZE_BOTTOM_RIGHT = 9,
		RESIZE_BOTTOM_LEFT = 10,
		RESIZE_TOP_RIGHT = 11,
		RESIZE_TOP_LEFT = 12,
		CROSSHAIR = 13,
		TEXT = 14
	}

	/**
	 * Temporary hack to work around Cogl not exporting CoglSnippetHook in
	 * the 1.0 API. Don't use.
	 */
	enum SnippetHook {
		VERTEX = 0,
		VERTEX_TRANSFORM = 1,
		FRAGMENT = 2048,
		TEXTURE_COORD_TRANSFORM = 4096,
		LAYER_FRAGMENT = 6144,
		TEXTURE_LOOKUP = 6145
	}

	enum StageInputMode {
		NONREACTIVE = 0,
		NORMAL = 1,
		FOCUSED = 2,
		FULLSCREEN = 3
	}

	/**
	 * Controls in which Cinnamon states an action (like keybindings and gestures)
	 * should be handled.
	 */
	enum ActionMode {
		/**
		 * block action
		 */
		NONE = 0,
		/**
		 * allow action when in window mode,
		 *     e.g. when the focus is in an application window
		 */
		NORMAL = 1,
		/**
		 * allow action while the overview
		 *     is active
		 */
		OVERVIEW = 2,
		/**
		 * allow action when the screen
		 *     is locked, e.g. when the screen shield is shown
		 */
		LOCK_SCREEN = 4,
		/**
		 * allow action in the unlock
		 *     dialog
		 */
		UNLOCK_SCREEN = 8,
		/**
		 * allow action in the login screen
		 */
		LOGIN_SCREEN = 16,
		/**
		 * allow action when a system modal
		 *     dialog (e.g. authentification or session dialogs) is open
		 */
		SYSTEM_MODAL = 32,
		/**
		 * allow action in looking glass
		 */
		LOOKING_GLASS = 64,
		/**
		 * allow action while a shell menu is open
		 */
		POPUP = 128,
		/**
		 * always allow action
		 */
		ALL = -1
	}

	/**
	 * Callback type for {@link Cinnamon.get.file_contents_utf8}
	 */
	interface FileContentsCallback {
		/**
		 * Callback type for {@link Cinnamon.get.file_contents_utf8}
		 * @param utf8_contents The contents of the file
		 */
		(utf8_contents: string): void;
	}

	interface LeisureFunction {
		(data?: any | null): void;
	}

	interface PerfReplayFunction {
		(time: number, name: string, signature: string, arg: GObject.Value): void;
	}

	interface PerfStatisticsCallback {
		(perf_log: PerfLog, data?: any | null): void;
	}

	interface ScreenshotCallback {
		(screenshot: Screenshot, success: boolean, screenshot_area: cairo.RectangleInt): void;
	}

	/**
	 * Using {@link G.BREAKPOINT}, interrupt the current process.  This is useful
	 * in conjunction with a debugger such as gdb.
	 */
	function breakpoint(): void;
	/**
	 * Gets a machine-readable description of the <link linkend="gdbus-interface-org-cinnamon-CalendarServer.top_of_page">org.cinnamon.CalendarServer</link> D-Bus interface.
	 * @returns A #GDBusInterfaceInfo. Do not free.
	 */
	function calendar_server_interface_info(): Gio.DBusInterfaceInfo;
	/**
	 * Overrides all #GObject properties in the {@link CalendarServer} interface for a concrete class.
	 * The properties are overridden in the order they are defined.
	 * @param klass The class structure for a #GObject derived class.
	 * @param property_id_begin The property id to assign to the first overridden property.
	 * @returns The last property id.
	 */
	function calendar_server_override_properties(klass: any, property_id_begin: number): number;
	/**
	 * Gets the current state of the event (the set of modifier keys that
	 * are pressed down). Thhis is a wrapper around
	 * {@link Clutter.event.get_state} that strips out any un-declared modifier
	 * flags, to make gjs happy; see
	 * https://bugzilla.gnome.org/show_bug.cgi?id=597292.
	 * @param event a #ClutterEvent
	 * @returns the state from the event
	 */
	function get_event_state(event: Clutter.Event): Clutter.ModifierType;
	/**
	 * Asynchronously load the contents of a file as a NUL terminated
	 * string, validating it as UTF-8.  Embedded NUL characters count as
	 * invalid content.
	 * @param path UTF-8 encoded filename path
	 * @param callback The callback to call when finished
	 */
	function get_file_contents_utf8(path: string, callback: FileContentsCallback): void;
	/**
	 * Synchronously load the contents of a file as a NUL terminated
	 * string, validating it as UTF-8.  Embedded NUL characters count as
	 * invalid content.
	 * @param path UTF-8 encoded filename path
	 * @returns File contents
	 */
	function get_file_contents_utf8_sync(path: string): string;
	/**
	 * Performs a check to see if on-demand mode for discrete graphics
	 * is supported.
	 * @returns %TRUE if supported.
	 */
	function get_gpu_offload_supported(): boolean;
	function parse_search_provider(data: string): [ boolean, string, string, string[], string ];
	/**
	 * Set a double uniform on a ClutterShaderEffect.
	 * 
	 * The problem here is that JavaScript doesn't have more than
	 * one number type, and gjs tries to automatically guess what
	 * type we want to set a GValue to. If the number is "1.0" or
	 * something, it will use an integer, which will cause errors
	 * in GLSL.
	 * @param effect The #ClutterShaderEffect
	 * @param name The name of the uniform
	 * @param value The value to set it to.
	 */
	function shader_effect_set_double_uniform(effect: Clutter.ShaderEffect, name: string, value: number): void;
	function util_composite_capture_images(captures: Clutter.Capture, n_captures: number, x: number, y: number, target_width: number, target_height: number, target_scale: number): cairo.Surface;
	/**
	 * Formats a date for the current locale. This should be
	 * used instead of the Spidermonkey Date.toLocaleFormat()
	 * extension because Date.toLocaleFormat() is buggy for
	 * Unicode format strings:
	 * https://bugzilla.mozilla.org/show_bug.cgi?id=508783
	 * @param format a strftime-style string format, as parsed by
	 *   {@link Glib.date_time_format}
	 * @param time_ms milliseconds since 1970-01-01 00:00:00 UTC; the
	 *   value returned by Date.getTime()
	 * @returns the formatted date. If the date is
	 *  outside of the range of a GDateTime (which contains
	 *  any plausible dates we actually care about), will
	 *  return an empty string.
	 */
	function util_format_date(format: string, time_ms: number): string;
	function util_get_content_for_window_actor(window_actor: Meta.WindowActor, window_rect: Meta.Rectangle): Clutter.Content | null;
	/**
	 * Look up the icon that should be associated with a given URI.  Handles
	 * various special GNOME-internal cases like x-nautilus-search, etc.
	 * @param text_uri A URI
	 * @returns A new #GIcon
	 */
	function util_get_icon_for_uri(text_uri: string): Gio.Icon;
	function util_get_label_for_uri(text_uri: string): string;
	/**
	 * This function is similar to a combination of {@link Clutter.Actor.get_transformed_position},
	 * and clutter_actor_get_transformed_size(), but unlike
	 * clutter_actor_get_transformed_size(), it always returns a transform
	 * of the current allocation, while clutter_actor_get_transformed_size() returns
	 * bad values (the transform of the requested size) if a relayout has been
	 * queued.
	 * 
	 * This function is more convenient to use than
	 * clutter_actor_get_abs_allocation_vertices() if no transformation is in effect
	 * and also works around limitations in the GJS binding of arrays.
	 * @param actor a #ClutterActor
	 * @returns location to store returned box in stage coordinates
	 */
	function util_get_transformed_allocation(actor: Clutter.Actor): Clutter.ActorBox;
	/**
	 * Gets the first week day for the current locale, expressed as a
	 * number in the range 0..6, representing week days from Sunday to
	 * Saturday.
	 * @returns A number representing the first week day for the current
	 *          locale
	 */
	function util_get_week_start(): number;
	/**
	 * If #hidden is %TRUE, hide #actor from pick even with a mode of
	 * %CLUTTER_PICK_ALL; if #hidden is %FALSE, unhide #actor.
	 * @param actor A #ClutterActor
	 * @param hidden Whether #actor should be hidden from pick
	 */
	function util_set_hidden_from_pick(actor: Clutter.Actor, hidden: boolean): void;
	/**
	 * Write a string to a GOutputStream as binary data. This is a
	 * workaround for the lack of proper binary strings in GJS.
	 * @param stream a #GOutputStream
	 * @param message a #SoupMessage
	 */
	function write_soup_message_to_stream(stream: Gio.OutputStream, message: Soup.Message): void;
	/**
	 * Write a string to a GOutputStream as UTF-8. This is a workaround
	 * for not having binary buffers in GJS.
	 * @param stream a #GOutputStream
	 * @param str a UTF-8 string to write to #stream
	 * @returns %TRUE if write succeeded
	 */
	function write_string_to_stream(stream: Gio.OutputStream, str: string): boolean;
}