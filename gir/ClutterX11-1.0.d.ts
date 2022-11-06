/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.ClutterX11 {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TexturePixmap} instead.
	 */
	interface ITexturePixmap {
		automatic_updates: boolean;
		readonly destroyed: boolean;
		pixmap: number;
		readonly pixmap_depth: number;
		readonly pixmap_height: number;
		readonly pixmap_width: number;
		window: number;
		readonly window_mapped: boolean;
		readonly window_override_redirect: boolean;
		window_redirect_automatic: boolean;
		readonly window_x: number;
		readonly window_y: number;
		/**
		 * Enables or disables the automatic updates ot #texture in case the backing
		 * pixmap or window is damaged
		 * @param setting %TRUE to enable automatic updates
		 */
		set_automatic(setting: boolean): void;
		/**
		 * Sets the X Pixmap to which the texture should be bound.
		 * @param pixmap the X Pixmap to which the texture should be bound
		 */
		set_pixmap(pixmap: xlib.Pixmap): void;
		/**
		 * Sets up a suitable pixmap for the window, using the composite and damage
		 * extensions if possible, and then calls
		 * {@link ClutterX11.TexturePixmap.set_pixmap}.
		 * 
		 * If you want to display a window in a #ClutterTexture, you probably want
		 * this function, or its older sister, clutter_glx_texture_pixmap_set_window().
		 * 
		 * This function has no effect unless the XComposite extension is available.
		 * @param window the X window to which the texture should be bound
		 * @param automatic %TRUE for automatic window updates, %FALSE for manual.
		 */
		set_window(window: xlib.Window, automatic: boolean): void;
		/**
		 * Resets the texture's pixmap from its window, perhaps in response to the
		 * pixmap's invalidation as the window changed size.
		 */
		sync_window(): void;
		/**
		 * Performs the actual binding of texture to the current content of
		 * the pixmap. Can be called to update the texture if the pixmap
		 * content has changed.
		 * @param x the X coordinate of the area to update
		 * @param y the Y coordinate of the area to update
		 * @param width the width of the area to update
		 * @param height the height of the area to update
		 */
		update_area(x: number, y: number, width: number, height: number): void;
		/**
		 * ::queue-damage-redraw is emitted to notify that some sub-region
		 * of the texture has been changed (either by an automatic damage
		 * update or by an explicit call to
		 * clutter_x11_texture_pixmap_update_area). This usually means a
		 * redraw needs to be queued for the actor.
		 * 
		 * The default handler will queue a clipped redraw in response to
		 * the damage, using the assumption that the pixmap is being painted
		 * to a rectangle covering the transformed allocation of the actor.
		 * If you sub-class and change the paint method so this isn't true
		 * then you must also provide your own damage signal handler to
		 * queue a redraw that blocks this default behaviour.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - x: The top left x position of the damage region 
		 *  - y: The top left y position of the damage region 
		 *  - width: The width of the damage region 
		 *  - height: The height of the damage region 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "queue-damage-redraw", callback: (owner: this, x: number, y: number, width: number, height: number) => void): number;
		/**
		 * The ::update-area signal is emitted to ask the texture to update its
		 * content from its source pixmap.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - x: X coordinate of the area to update 
		 *  - y: Y coordinate of the area to update 
		 *  - width: width of the area to update 
		 *  - height: height of the area to update 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "update-area", callback: (owner: this, x: number, y: number, width: number, height: number) => void): number;

		connect(signal: "notify::automatic-updates", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::destroyed", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pixmap", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pixmap-depth", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pixmap-height", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pixmap-width", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window-mapped", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window-override-redirect", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window-redirect-automatic", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window-x", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window-y", callback: (owner: this, ...args: any) => void): number;

	}

	type TexturePixmapInitOptionsMixin = Clutter.TextureInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<ITexturePixmap,
		"automatic_updates" |
		"pixmap" |
		"window" |
		"window_redirect_automatic">;

	export interface TexturePixmapInitOptions extends TexturePixmapInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TexturePixmap} instead.
	 */
	type TexturePixmapMixin = ITexturePixmap & Clutter.Texture & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The {@link TexturePixmap} structure contains only private data
	 */
	interface TexturePixmap extends TexturePixmapMixin {}

	class TexturePixmap {
		public constructor(options?: Partial<TexturePixmapInitOptions>);
		/**
		 * Creates a new {@link TexturePixmap} which can be used to display the
		 * contents of an X11 Pixmap inside a Clutter scene graph
		 * @returns A new {@link TexturePixmap}
		 */
		public static new(): Clutter.Actor;
		/**
		 * Creates a new {@link TexturePixmap} for #pixmap
		 * @param pixmap the X Pixmap to which this texture should be bound
		 * @returns A new {@link TexturePixmap} bound to the given X Pixmap
		 */
		public static new_with_pixmap(pixmap: xlib.Pixmap): Clutter.Actor;
		/**
		 * Creates a new {@link TexturePixmap} for #window
		 * @param window the X window to which this texture should be bound
		 * @returns A new {@link TexturePixmap} bound to the given X window.
		 */
		public static new_with_window(window: xlib.Window): Clutter.Actor;
	}

	export interface XInputDeviceInitOptions {}
	interface XInputDevice {}
	class XInputDevice {
		public constructor(options?: Partial<XInputDeviceInitOptions>);
	}

	/**
	 * Return values for the {@link FilterFunc} function.
	 */
	enum FilterReturn {
		/**
		 * The event was not handled, continues the
		 *   processing
		 */
		CONTINUE = 0,
		/**
		 * Native event translated into a Clutter
		 *   event, stops the processing
		 */
		TRANSLATE = 1,
		/**
		 * Remove the event, stops the processing
		 */
		REMOVE = 2
	}

	/**
	 * Filter function for X11 native events.
	 */
	interface FilterFunc {
		/**
		 * Filter function for X11 native events.
		 * @param xev Native X11 event structure
		 * @param cev Clutter event structure
		 * @param data user data passed to the filter function
		 * @returns the result of the filtering
		 */
		(xev: xlib.XEvent, cev: Clutter.Event, data: any | null): FilterReturn;
	}

	/**
	 * Adds an event filter function.
	 * @param func a filter function
	 * @param data user data to be passed to the filter function, or %NULL
	 */
	function add_filter(func: FilterFunc, data: any | null): void;

	/**
	 * Disables the internal polling of X11 events in the main loop.
	 * 
	 * Libraries or applications calling this function will be responsible of
	 * polling all X11 events.
	 * 
	 * You also must call {@link ClutterX11.handle.event} to let Clutter process
	 * events and maintain its internal state.
	 * 
	 * This function can only be called before calling clutter_init().
	 * 
	 * Even with event handling disabled, Clutter will still select
	 * all the events required to maintain its internal state on the stage
	 * Window; compositors using Clutter and input regions to pass events
	 * through to application windows should not rely on an empty input
	 * region, and should instead clear it themselves explicitly using the
	 * XFixes extension.
	 * 
	 * This function should not be normally used by applications.
	 */
	function disable_event_retrieval(): void;

	/**
	 * Enables the use of the XInput extension if present on connected
	 * XServer and support built into Clutter. XInput allows for multiple
	 * pointing devices to be used.
	 * 
	 * This function must be called before clutter_init().
	 * 
	 * Since XInput might not be supported by the X server, you might
	 * want to use clutter_x11_has_xinput() to see if support was enabled.
	 */
	function enable_xinput(): void;

	/**
	 * Retrieves the group for the modifiers set in #event
	 * @param event a #ClutterEvent of type %CLUTTER_KEY_PRESS or %CLUTTER_KEY_RELEASE
	 * @returns the group id
	 */
	function event_get_key_group(event: Clutter.Event): number;

	/**
	 * Retrieves the touch detail froma #ClutterEventSequence.
	 * @param sequence a #ClutterEventSequence
	 * @returns the touch detail
	 */
	function event_sequence_get_touch_detail(sequence: Clutter.EventSequence): number;

	/**
	 * Retrieves the timestamp of the last X11 event processed by
	 * Clutter. This might be different from the timestamp returned
	 * by {@link Clutter.get.current_event_time}, as Clutter may synthesize
	 * or throttle events.
	 * @returns a timestamp, in milliseconds
	 */
	function get_current_event_time(): xlib.Time;

	/**
	 * Retrieves the pointer to the default display.
	 * @returns the default display
	 */
	function get_default_display(): xlib.Display;

	/**
	 * Gets the number of the default X Screen object.
	 * @returns the number of the default screen
	 */
	function get_default_screen(): number;

	/**
	 * Retrieves a pointer to the list of input devices
	 * @returns a
	 *   pointer to the internal list of input devices; the returned list is
	 *   owned by Clutter and should not be modified or freed
	 */
	function get_input_devices(): Clutter.InputDevice[];

	/**
	 * Retrieves the root window.
	 * @returns the id of the root window
	 */
	function get_root_window(): xlib.Window;

	/**
	 * Gets the stage for a particular X window.
	 * @param win an X Window ID
	 * @returns A #ClutterStage, or% NULL if a stage
	 *   does not exist for the window
	 */
	function get_stage_from_window(win: xlib.Window): Clutter.Stage;

	/**
	 * Returns an XVisualInfo suitable for creating a foreign window for the given
	 * stage. NOTE: It doesn't do as the name may suggest, which is return the
	 * XVisualInfo that was used to create an existing window for the given stage.
	 * 
	 * XXX: It might be best to deprecate this function and replace with something
	 * along the lines of clutter_backend_x11_get_foreign_visual () or perhaps
	 * clutter_stage_x11_get_foreign_visual ()
	 * @param stage a #ClutterStage
	 * @returns An XVisualInfo suitable for creating a
	 *   foreign stage. Use XFree() to free the returned value instead
	 */
	function get_stage_visual(stage: Clutter.Stage): xlib.XVisualInfo;

	/**
	 * Gets the stages X Window.
	 * @param stage a #ClutterStage
	 * @returns An XID for the stage window.
	 */
	function get_stage_window(stage: Clutter.Stage): xlib.Window;

	/**
	 * Retrieves whether the Clutter X11 backend is using ARGB visuals by default
	 * @returns %TRUE if ARGB visuals are queried by default
	 */
	function get_use_argb_visual(): boolean;

	/**
	 * Retrieves whether the Clutter X11 backend will create stereo
	 * stages if possible.
	 * @returns %TRUE if stereo stages are used if possible
	 */
	function get_use_stereo_stage(): boolean;

	/**
	 * Retrieves the `XVisualInfo` used by the Clutter X11 backend.
	 * @returns a `XVisualInfo`, or `None`.
	 *   The returned value should be freed using `XFree()` when done
	 */
	function get_visual_info(): xlib.XVisualInfo;

	/**
	 * This function processes a single X event; it can be used to hook
	 * into external X11 event processing (for example, a GDK filter
	 * function).
	 * 
	 * If {@link ClutterX11.disable.event_retrieval} has been called, you must
	 * let this function process events to update Clutter's internal state.
	 * @param xevent pointer to XEvent structure
	 * @returns {@link FilterReturn}. %CLUTTER_X11_FILTER_REMOVE
	 *  indicates that Clutter has internally handled the event and the
	 *  caller should do no further processing. %CLUTTER_X11_FILTER_CONTINUE
	 *  indicates that Clutter is either not interested in the event,
	 *  or has used the event to update internal state without taking
	 *  any exclusive action. %CLUTTER_X11_FILTER_TRANSLATE will not
	 *  occur.
	 */
	function handle_event(xevent: xlib.XEvent): FilterReturn;

	/**
	 * Retrieves whether Clutter is running on an X11 server with the
	 * XComposite extension
	 * @returns %TRUE if the XComposite extension is available
	 */
	function has_composite_extension(): boolean;

	/**
	 * Queries the X11 backend to check if event collection has been disabled.
	 * @returns TRUE if event retrival has been disabled. FALSE otherwise.
	 */
	function has_event_retrieval(): boolean;

	/**
	 * Gets whether Clutter has XInput support.
	 * @returns %TRUE if Clutter was compiled with XInput support
	 *   and XInput support is available at run time.
	 */
	function has_xinput(): boolean;

	/**
	 * Removes the given filter function.
	 * @param func a filter function
	 * @param data user data to be passed to the filter function, or %NULL
	 */
	function remove_filter(func: FilterFunc, data: any | null): void;

	/**
	 * Sets the display connection Clutter should use; must be called
	 * before clutter_init(), clutter_init_with_args() or other functions
	 * pertaining Clutter's initialization process.
	 * 
	 * If you are parsing the command line arguments by retrieving Clutter's
	 * #GOptionGroup with clutter_get_option_group() and calling
	 * g_option_context_parse() yourself, you should also call
	 * clutter_x11_set_display() before g_option_context_parse().
	 * @param xdpy pointer to a X display connection.
	 */
	function set_display(xdpy: xlib.Display): void;

	/**
	 * Target the #ClutterStage to use an existing external X Window
	 * @param stage a #ClutterStage
	 * @param xwindow an existing X Window id
	 * @returns %TRUE if foreign window is valid
	 */
	function set_stage_foreign(stage: Clutter.Stage, xwindow: xlib.Window): boolean;

	/**
	 * Sets whether the Clutter X11 backend should request ARGB visuals by default
	 * or not.
	 * 
	 * By default, Clutter requests RGB visuals.
	 * 
	 * If no ARGB visuals are found, the X11 backend will fall back to
	 * requesting a RGB visual instead.
	 * 
	 * ARGB visuals are required for the #ClutterStage:use-alpha property to work.
	 * 
	 * This function can only be called once, and before clutter_init() is
	 * called.
	 * @param use_argb %TRUE if ARGB visuals should be requested by default
	 */
	function set_use_argb_visual(use_argb: boolean): void;

	/**
	 * Sets whether the backend object for Clutter stages, will,
	 * if possible, be created with the ability to support stereo drawing
	 * (drawing separate images for the left and right eyes).
	 * 
	 * This function must be called before clutter_init() is called.
	 * During paint callbacks, cogl_framebuffer_is_stereo() can be called
	 * on the framebuffer retrieved by cogl_get_draw_framebuffer() to
	 * determine if stereo support was successfully enabled, and
	 * cogl_framebuffer_set_stereo_mode() to determine which buffers
	 * will be drawn to.
	 * 
	 * Note that this function *does not* cause the stage to be drawn
	 * multiple times with different perspective transformations and thus
	 * appear in 3D, it simply enables individual ClutterActors to paint
	 * different images for the left and and right eye.
	 * @param use_stereo %TRUE if the stereo stages should be used if possible.
	 */
	function set_use_stereo_stage(use_stereo: boolean): void;

	/**
	 * Traps every X error until {@link ClutterX11.untrap.x_errors} is called.
	 */
	function trap_x_errors(): void;

	/**
	 * Removes the X error trap and returns the current status.
	 * @returns the trapped error code, or 0 for success
	 */
	function untrap_x_errors(): number;

}