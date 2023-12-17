/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.CinnamonDesktop {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BG} instead.
	 */
	interface IBG {
		changes_with_time(): boolean;
		create_and_set_gtk_image(image: Gtk.Image, width: number, height: number): void;
		create_and_set_surface_as_root(root_window: Gdk.Window, screen: Gdk.Screen): void;
		/**
		 * Creates a thumbnail for a certain frame, where 'frame' is somewhat
		 * vaguely defined as 'suitable point to show while single-stepping
		 * through the slideshow'.
		 * @param factory
		 * @param screen
		 * @param dest_width
		 * @param dest_height
		 * @param frame_num
		 * @returns the newly created thumbnail or
		 * or NULL if frame_num is out of bounds.
		 */
		create_frame_thumbnail(factory: DesktopThumbnailFactory, screen: Gdk.Screen, dest_width: number, dest_height: number, frame_num: number): GdkPixbuf.Pixbuf;
		/**
		 * Create a surface that can be set as background for #window. If #is_root is
		 * TRUE, the surface created will be created by a temporary X server connection
		 * so that if someone calls XKillClient on it, it won't affect the application
		 * who created it.
		 * @param window
		 * @param width
		 * @param height
		 * @param root
		 * @returns %NULL on error (e.g. out of X connections)
		 */
		create_surface(window: Gdk.Window, width: number, height: number, root: boolean): cairo.Surface;
		create_thumbnail(factory: DesktopThumbnailFactory, screen: Gdk.Screen, dest_width: number, dest_height: number): GdkPixbuf.Pixbuf;
		draw(dest: GdkPixbuf.Pixbuf, screen: Gdk.Screen, is_root: boolean): void;
		get_color(type: CDesktopEnums.BackgroundShading, primary: Gdk.Color, secondary: Gdk.Color): void;
		get_filename(): string;
		get_image_size(factory: DesktopThumbnailFactory, best_width: number, best_height: number, width: number, height: number): boolean;
		get_placement(): CDesktopEnums.BackgroundStyle;
		has_multiple_sizes(): boolean;
		is_dark(dest_width: number, dest_height: number): boolean;
		load_from_preferences(settings: Gio.Settings): void;
		save_to_preferences(settings: Gio.Settings): void;
		set_color(type: CDesktopEnums.BackgroundShading, primary: Gdk.Color, secondary: Gdk.Color): void;
		set_filename(filename: string): void;
		set_placement(placement: CDesktopEnums.BackgroundStyle): void;
		connect(signal: "changed", callback: (owner: this) => void): number;
		connect(signal: "transitioned", callback: (owner: this) => void): number;

	}

	type BGInitOptionsMixin = GObject.ObjectInitOptions
	export interface BGInitOptions extends BGInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BG} instead.
	 */
	type BGMixin = IBG & GObject.Object;

	interface BG extends BGMixin {}

	class BG {
		public constructor(options?: Partial<BGInitOptions>);
		public static new(): BG;
		/**
		 * This function queries the _XROOTPMAP_ID property from
		 * the root window associated with #screen to determine
		 * the current root window background pixmap and returns
		 * a copy of it. If the _XROOTPMAP_ID is not set, then
		 * a black surface is returned.
		 * @param screen a #GdkScreen
		 * @returns a #cairo_surface_t if successful or %NULL
		 */
		public static get_surface_from_root(screen: Gdk.Screen): cairo.Surface;
		public static set_accountsservice_background(background: string): void;
		/**
		 * Set the root pixmap, and properties pointing to it. We
		 * do this atomically with a server grab to make sure that
		 * we won't leak the pixmap if somebody else it setting
		 * it at the same time. (This assumes that they follow the
		 * same conventions we do).  #surface should come from a call
		 * to {@link Gnome.bg_create_surface}.
		 * @param screen the #GdkScreen to change root background on
		 * @param surface the #cairo_surface_t to set root background from.
		 *   Must be an xlib surface backing a pixmap.
		 */
		public static set_surface_as_root(screen: Gdk.Screen, surface: cairo.Surface): void;
		/**
		 * Set the root pixmap, and properties pointing to it.
		 * This function differs from {@link Gnome.bg_set_surface_as_root}
		 * in that it adds a subtle crossfade animation from the
		 * current root pixmap to the new one.
		 * @param screen the #GdkScreen to change root background on
		 * @param surface the cairo xlib surface to set root background from
		 * @returns a #GnomeBGCrossfade object
		 */
		public static set_surface_as_root_with_crossfade(screen: Gdk.Screen, surface: cairo.Surface): BGCrossfade;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BGCrossfade} instead.
	 */
	interface IBGCrossfade {
		/**
		 * When a crossfade is running, this is height of the fading
		 * surface.
		 */
		height: number;
		/**
		 * When a crossfade is running, this is width of the fading
		 * surface.
		 */
		width: number;
		readonly parent_object: GObject.Object;
		/**
		 * This function reveals whether or not #fade is currently
		 * running on a window.  See {@link Gnome.bg_crossfade_start} for
		 * information on how to initiate a crossfade.
		 * @returns %TRUE if fading, or %FALSE if not fading
		 */
		is_started(): boolean;
		/**
		 * Before initiating a crossfade with {@link Gnome.bg_crossfade_start}
		 * a start and end surface have to be set.  This function sets
		 * the surface shown at the end of the crossfade effect.
		 * @param surface The cairo surface to fade to
		 * @returns %TRUE if successful, or %FALSE if the surface
		 * could not be copied.
		 */
		set_end_surface(surface: cairo.Surface): boolean;
		/**
		 * Before initiating a crossfade with {@link Gnome.bg_crossfade_start}
		 * a start and end surface have to be set.  This function sets
		 * the surface shown at the beginning of the crossfade effect.
		 * @param surface The cairo surface to fade from
		 * @returns %TRUE if successful, or %FALSE if the surface
		 * could not be copied.
		 */
		set_start_surface(surface: cairo.Surface): boolean;
		/**
		 * This function initiates a quick crossfade between two surfaces on
		 * the background of #window.  Before initiating the crossfade both
		 * {@link Gnome.bg_crossfade_start} and gnome_bg_crossfade_end() need to
		 * be called. If animations are disabled, the crossfade is skipped,
		 * and the window background is set immediately to the end surface.
		 * @param window The #GdkWindow to draw crossfade on
		 */
		start(window: Gdk.Window): void;
		/**
		 * This function stops any in progress crossfades that may be
		 * happening.  It's harmless to call this function if #fade is
		 * already stopped.
		 */
		stop(): void;
		/**
		 * When a crossfade finishes, #window will have a copy
		 * of the end surface as its background, and this signal will
		 * get emitted.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - window: the #GdkWindow the crossfade happend on. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "finished", callback: (owner: this, window: GObject.Object) => void): number;

		connect(signal: "notify::height", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::width", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::parent_object", callback: (owner: this, ...args: any) => void): number;

	}

	type BGCrossfadeInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IBGCrossfade,
		"height" |
		"width">;

	export interface BGCrossfadeInitOptions extends BGCrossfadeInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BGCrossfade} instead.
	 */
	type BGCrossfadeMixin = IBGCrossfade & GObject.Object;

	interface BGCrossfade extends BGCrossfadeMixin {}

	class BGCrossfade {
		public constructor(options?: Partial<BGCrossfadeInitOptions>);
		/**
		 * Creates a new object to manage crossfading a
		 * window background between two #cairo_surface_ts.
		 * @param width The width of the crossfading window
		 * @param height The height of the crossfading window
		 * @returns the new #GnomeBGCrossfade
		 */
		public static new(width: number, height: number): BGCrossfade;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DesktopThumbnailFactory} instead.
	 */
	interface IDesktopThumbnailFactory {
		/**
		 * Returns TRUE if this GnomeIconFactory can (at least try) to thumbnail
		 * this file. Thumbnails or files with failed thumbnails won't be thumbnailed.
		 * 
		 * Usage of this function is threadsafe.
		 * @param uri the uri of a file
		 * @param mime_type the mime type of the file
		 * @param mtime the mtime of the file
		 * @returns TRUE if the file can be thumbnailed.
		 */
		can_thumbnail(uri: string, mime_type: string, mtime: number): boolean;
		/**
		 * Creates a failed thumbnail for the file so that we don't try
		 * to re-thumbnail the file later.
		 * 
		 * Usage of this function is threadsafe.
		 * @param uri the uri of a file
		 * @param mtime the modification time of the file
		 */
		create_failed_thumbnail(uri: string, mtime: number): void;
		/**
		 * Tries to generate a thumbnail for the specified file. If it succeeds
		 * it returns a pixbuf that can be used as a thumbnail.
		 * 
		 * Usage of this function is threadsafe.
		 * @param uri the uri of a file
		 * @param mime_type the mime type of the file
		 * @returns thumbnail pixbuf if thumbnailing succeeded, %NULL otherwise.
		 */
		generate_thumbnail(uri: string, mime_type: string): GdkPixbuf.Pixbuf;
		/**
		 * Tries to locate an failed thumbnail for the file specified. Writing
		 * and looking for failed thumbnails is important to avoid to try to
		 * thumbnail e.g. broken images several times.
		 * 
		 * Usage of this function is threadsafe.
		 * @param uri the uri of a file
		 * @param mtime the mtime of the file
		 * @returns TRUE if there is a failed thumbnail for the file.
		 */
		has_valid_failed_thumbnail(uri: string, mtime: number): boolean;
		/**
		 * Tries to locate an existing thumbnail for the file specified.
		 * 
		 * Usage of this function is threadsafe.
		 * @param uri the uri of a file
		 * @param mtime the mtime of the file
		 * @returns The absolute path of the thumbnail, or %NULL if none exist.
		 */
		lookup(uri: string, mtime: number): string;
		/**
		 * Saves #thumbnail at the right place. If the save fails a
		 * failed thumbnail is written.
		 * 
		 * Usage of this function is threadsafe.
		 * @param thumbnail the thumbnail as a pixbuf
		 * @param uri the uri of a file
		 * @param original_mtime the modification time of the original file
		 */
		save_thumbnail(thumbnail: GdkPixbuf.Pixbuf, uri: string, original_mtime: number): void;
	}

	type DesktopThumbnailFactoryInitOptionsMixin = GObject.ObjectInitOptions
	export interface DesktopThumbnailFactoryInitOptions extends DesktopThumbnailFactoryInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DesktopThumbnailFactory} instead.
	 */
	type DesktopThumbnailFactoryMixin = IDesktopThumbnailFactory & GObject.Object;

	interface DesktopThumbnailFactory extends DesktopThumbnailFactoryMixin {}

	class DesktopThumbnailFactory {
		public constructor(options?: Partial<DesktopThumbnailFactoryInitOptions>);
		/**
		 * Creates a new #GnomeDesktopThumbnailFactory.
		 * 
		 * This function must be called on the main thread.
		 * @param size The thumbnail size to use
		 * @returns a new #GnomeDesktopThumbnailFactory
		 */
		public static new(size: DesktopThumbnailSize): DesktopThumbnailFactory;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PnpIds} instead.
	 */
	interface IPnpIds {
		/**
		 * Find the full manufacturer name for the given PNP ID.
		 * @param pnp_id the PNP ID to look for
		 * @returns a new string representing the manufacturer name,
		 * or %NULL when not found.
		 */
		get_pnp_id(pnp_id: string): string;
	}

	type PnpIdsInitOptionsMixin = GObject.ObjectInitOptions
	export interface PnpIdsInitOptions extends PnpIdsInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PnpIds} instead.
	 */
	type PnpIdsMixin = IPnpIds & GObject.Object;

	interface PnpIds extends PnpIdsMixin {}

	class PnpIds {
		public constructor(options?: Partial<PnpIdsInitOptions>);
		/**
		 * Returns a reference to a #GnomePnpIds object, or creates
		 * a new one if none have been created.
		 * @returns a #GnomePnpIds object.
		 */
		public static new(): PnpIds;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RRConfig} instead.
	 */
	interface IRRConfig {
		applicable(screen: RRScreen): boolean;
		apply_with_time(screen: RRScreen, timestamp: number): boolean;
		ensure_primary(): boolean;
		equal(config2: RRConfig): boolean;
		get_auto_scale(): boolean;
		get_base_scale(): number;
		get_clone(): boolean;
		get_outputs(): RROutputInfo[];
		load_current(): boolean;
		load_filename(filename: string): boolean;
		match(config2: RRConfig): boolean;
		sanitize(): void;
		save(): boolean;
		set_auto_scale(auto_scale: boolean): void;
		set_base_scale(base_scale: number): void;
		set_clone(clone: boolean): void;
	}

	type RRConfigInitOptionsMixin = GObject.ObjectInitOptions
	export interface RRConfigInitOptions extends RRConfigInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RRConfig} instead.
	 */
	type RRConfigMixin = IRRConfig & GObject.Object;

	interface RRConfig extends RRConfigMixin {}

	class RRConfig {
		public constructor(options?: Partial<RRConfigInitOptions>);
		public static new_current(screen: RRScreen): RRConfig;
		public static new_stored(screen: RRScreen): RRConfig;
		public static apply_from_filename_with_time(screen: RRScreen, filename: string, timestamp: number): boolean;
		public static get_backup_filename(): string;
		public static get_intended_filename(): string;
		public static get_legacy_filename(): string;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RRLabeler} instead.
	 */
	interface IRRLabeler {
		/**
		 * Get the color used for the label on a given output (monitor).
		 * @param output Output device (i.e. monitor) to query
		 * @returns Color of selected monitor.
		 */
		get_rgba_for_output(output: RROutputInfo): Gdk.RGBA;
		/**
		 * Hide ouput labels.
		 */
		hide(): void;
		/**
		 * Show the labels.
		 */
		show(): void;
	}

	type RRLabelerInitOptionsMixin = GObject.ObjectInitOptions
	export interface RRLabelerInitOptions extends RRLabelerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RRLabeler} instead.
	 */
	type RRLabelerMixin = IRRLabeler & GObject.Object;

	interface RRLabeler extends RRLabelerMixin {}

	class RRLabeler {
		public constructor(options?: Partial<RRLabelerInitOptions>);
		/**
		 * Create a GUI element that will display colored labels on each connected monitor.
		 * This is useful when users are required to identify which monitor is which, e.g. for
		 * for configuring multiple monitors.
		 * The labels will be shown by default, use gnome_rr_labeler_hide to hide them.
		 * @param config Configuration of the screens to label
		 * @returns A new #GnomeRRLabeler
		 */
		public static new(config: RRConfig): RRLabeler;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RROutputInfo} instead.
	 */
	interface IRROutputInfo {
		get_aspect_ratio(): number;
		get_display_name(): string;
		get_flags(doublescan: boolean, interlaced: boolean, vsync: boolean): void;
		get_geometry(): [ x: number | null, y: number | null, width: number | null, height: number | null ];
		get_name(): string;
		get_preferred_height(): number;
		get_preferred_width(): number;
		get_primary(): boolean;
		get_product(): number;
		get_refresh_rate(): number;
		get_refresh_rate_f(): number;
		get_rotation(): RRRotation;
		get_scale(): number;
		get_serial(): number;
		get_vendor(): string[];
		is_active(): boolean;
		is_connected(): boolean;
		set_active(active: boolean): void;
		set_flags(doublescan: boolean, interlaced: boolean, vsync: boolean): void;
		set_geometry(x: number, y: number, width: number, height: number): void;
		set_primary(primary: boolean): void;
		set_refresh_rate(rate: number): void;
		set_refresh_rate_f(rate: number): void;
		set_rotation(rotation: RRRotation): void;
		set_scale(scale: number): void;
	}

	type RROutputInfoInitOptionsMixin = GObject.ObjectInitOptions
	export interface RROutputInfoInitOptions extends RROutputInfoInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RROutputInfo} instead.
	 */
	type RROutputInfoMixin = IRROutputInfo & GObject.Object;

	interface RROutputInfo extends RROutputInfoMixin {}

	class RROutputInfo {
		public constructor(options?: Partial<RROutputInfoInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RRScreen} instead.
	 */
	interface IRRScreen {
		gdk_screen: Gdk.Screen;
		calculate_best_global_scale(index: number): number;
		calculate_supported_scales(width: number, height: number, n_supported_scales: number): number;
		create_clone_modes(): RRMode;
		get_crtc_by_id(id: number): RRCrtc;
		get_dpms_mode(mode: RRDpmsMode): boolean;
		get_global_scale(): number;
		get_global_scale_setting(): number;
		get_output_by_id(id: number): RROutput;
		get_output_by_name(name: string): RROutput;
		/**
		 * Get the ranges of the screen
		 * @returns the minimum width
		 * 
		 * the maximum width
		 * 
		 * the minimum height
		 * 
		 * the maximum height
		 */
		get_ranges(): [ min_width: number, max_width: number, min_height: number, max_height: number ];
		/**
		 * Queries the two timestamps that the X RANDR extension maintains.  The X
		 * server will prevent change requests for stale configurations, those whose
		 * timestamp is not equal to that of the latest request for configuration.  The
		 * X server will also prevent change requests that have an older timestamp to
		 * the latest change request.
		 * @returns Location in which to store the timestamp at which the RANDR configuration was last changed
		 * 
		 * Location in which to store the timestamp at which the RANDR configuration was last obtained
		 */
		get_timestamps(): [ change_timestamp_ret: number, config_timestamp_ret: number ];
		get_use_upscaling(): boolean;
		/**
		 * List available XRandR clone modes
		 * @returns 
		 */
		list_clone_modes(): RRMode[];
		/**
		 * List all CRTCs
		 * @returns 
		 */
		list_crtcs(): RRCrtc[];
		/**
		 * List available XRandR modes
		 * @returns 
		 */
		list_modes(): RRMode[];
		/**
		 * List all outputs
		 * @returns 
		 */
		list_outputs(): RROutput[];
		/**
		 * Refreshes the screen configuration, and calls the screen's callback if it
		 * exists and if the screen's configuration changed.
		 * @returns TRUE if the screen's configuration changed; otherwise, the
		 * function returns FALSE and a NULL error if the configuration didn't change,
		 * or FALSE and a non-NULL error if there was an error while refreshing the
		 * configuration.
		 */
		refresh(): boolean;
		/**
		 * This method also disables the DPMS timeouts.
		 * @param mode
		 * @returns 
		 */
		set_dpms_mode(mode: RRDpmsMode): boolean;
		set_global_scale_setting(scale_factor: number): void;
		set_primary_output(output: RROutput): void;
		set_size(width: number, height: number, mm_width: number, mm_height: number): void;
		connect(signal: "changed", callback: (owner: this) => void): number;
		/**
		 * This signal is emitted when a display device is connected to a
		 * port, or a port is hotplugged with an active output. The latter
		 * can happen if a laptop is docked, and the dock provides a new
		 * active output.
		 * 
		 * The #output value is not a #GObject. The returned #output value can
		 * only assume to be valid during the emission of the signal (i.e. within
		 * your signal handler only), as it may change later when the #screen
		 * is modified due to an event from the X server, or due to another
		 * place in the application modifying the #screen and the #output.
		 * Therefore, deal with changes to the #output right in your signal
		 * handler, instead of keeping the #output reference for an async or
		 * idle function.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - output: the #GnomeRROutput that was connected 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "output-connected", callback: (owner: this, output: any | null) => void): number;
		/**
		 * This signal is emitted when a display device is disconnected from
		 * a port, or a port output is hot-unplugged. The latter can happen
		 * if a laptop is undocked, and the dock provided the output.
		 * 
		 * The #output value is not a #GObject. The returned #output value can
		 * only assume to be valid during the emission of the signal (i.e. within
		 * your signal handler only), as it may change later when the #screen
		 * is modified due to an event from the X server, or due to another
		 * place in the application modifying the #screen and the #output.
		 * Therefore, deal with changes to the #output right in your signal
		 * handler, instead of keeping the #output reference for an async or
		 * idle function.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - output: the #GnomeRROutput that was disconnected 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "output-disconnected", callback: (owner: this, output: any | null) => void): number;

		connect(signal: "notify::gdk-screen", callback: (owner: this, ...args: any) => void): number;

	}

	type RRScreenInitOptionsMixin = GObject.ObjectInitOptions & Gio.InitableInitOptions & 
	Pick<IRRScreen,
		"gdk_screen">;

	export interface RRScreenInitOptions extends RRScreenInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RRScreen} instead.
	 */
	type RRScreenMixin = IRRScreen & GObject.Object & Gio.Initable;

	interface RRScreen extends RRScreenMixin {}

	class RRScreen {
		public constructor(options?: Partial<RRScreenInitOptions>);
		/**
		 * Creates a unique #GnomeRRScreen instance for the specified #screen.
		 * @param screen the #GdkScreen on which to operate
		 * @returns a unique #GnomeRRScreen instance, specific to the #screen, or NULL
		 * if this could not be created, for instance if the driver does not support
		 * Xrandr 1.2.  Each #GdkScreen thus has a single instance of #GnomeRRScreen.
		 */
		public static new(screen: Gdk.Screen): RRScreen;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WallClock} instead.
	 */
	interface IWallClock {
		/**
		 * A formatted string representing the current clock display.
		 */
		readonly clock: string;
		/**
		 * If not NULL, the wall clock will format the time/date according to
		 * this format string.  If the format string is invalid, the default string
		 * will be used instead.
		 */
		format_string: string;
		readonly parent_object: GObject.Object;
		/**
		 * Returns a formatted date and time based on either default format
		 * settings, or via a custom-set format string.
		 * 
		 * The returned string should be ready to be set on a label.
		 * @returns The formatted date/time string.
		 */
		get_clock(): string;
		/**
		 * Returns a formatted date and time based on the provided format string.
		 * The returned string should be ready to be set on a label.
		 * @param format_string
		 * @returns The formatted date/time string, or NULL
		 * if there was a problem with the format string.
		 */
		get_clock_for_format(format_string: string): string;
		/**
		 * Returns the current date-only format based on current locale
		 * defaults and clock settings.
		 * @returns The default date format string.
		 */
		get_default_date_format(): string;
		/**
		 * Returns the current time-only format based on current locale
		 * defaults and clock settings.
		 * @returns The default time format string.
		 */
		get_default_time_format(): string;
		/**
		 * Sets the wall clock to use the provided format string for any
		 * subsequent updates.  Passing NULL will un-set any custom format,
		 * and rely on a default locale format.
		 * 
		 * Any invalid format string passed will cause it to be ignored,
		 * and the default locale format used instead.
		 * @param format_string
		 * @returns Whether or not the format string was valid and accepted.
		 */
		set_format_string(format_string?: string | null): boolean;
		connect(signal: "notify::clock", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::format-string", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::parent_object", callback: (owner: this, ...args: any) => void): number;

	}

	type WallClockInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IWallClock,
		"format_string">;

	export interface WallClockInitOptions extends WallClockInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WallClock} instead.
	 */
	type WallClockMixin = IWallClock & GObject.Object;

	interface WallClock extends WallClockMixin {}

	class WallClock {
		public constructor(options?: Partial<WallClockInitOptions>);
		/**
		 * Returns a new GnomeWallClock instance
		 * @returns A pointer to a new GnomeWallClock instance.
		 */
		public static new(): WallClock;
		/**
		 * Returns the translation of the format string according to
		 * the LC_TIME locale.
		 * @param gettext_domain
		 * @param format_string
		 * @returns The translated format string.
		 */
		public static lctime_format(gettext_domain?: string | null, format_string?: string | null): string;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link XkbInfo} instead.
	 */
	interface IXkbInfo {
		readonly parent_object: GObject.Object;
		description_for_option(group_id: string, id: string): string;
		/**
		 * Returns a list of all layout identifiers we know about.
		 * @returns the list
		 * of layout names. The caller takes ownership of the #GList but not
		 * of the strings themselves, those are internally allocated and must
		 * not be modified.
		 */
		get_all_layouts(): string[];
		/**
		 * Returns a list of all option group identifiers we know about.
		 * @returns the list
		 * of option group ids. The caller takes ownership of the #GList but
		 * not of the strings themselves, those are internally allocated and
		 * must not be modified.
		 */
		get_all_option_groups(): string[];
		/**
		 * Retrieves information about a layout. Both #display_name and
		 * #short_name are suitable to show in UIs and might be localized if
		 * translations are available.
		 * 
		 * Some layouts don't provide a short name (2 or 3 letters) or don't
		 * specify a XKB variant, in those cases #short_name or #xkb_variant
		 * are empty strings, i.e. "".
		 * 
		 * If the given layout doesn't exist the return value is %FALSE and
		 * all the (out) parameters are set to %NULL.
		 * @param id layout's identifier about which to retrieve the info
		 * @returns %TRUE if the layout exists or %FALSE otherwise.
		 * 
		 * location to store
		 * the layout's display name, or %NULL
		 * 
		 * location to store
		 * the layout's short name, or %NULL
		 * 
		 * location to store
		 * the layout's XKB name, or %NULL
		 * 
		 * location to store
		 * the layout's XKB variant, or %NULL
		 */
		get_layout_info(id: string): [ boolean, string | null, string | null, string | null, string | null ];
		/**
		 * Retrieves the layout that better fits #language. It also fetches
		 * information about that layout like {@link Gnome.xkb_info_get_layout_info}.
		 * 
		 * If a layout can't be found the return value is %FALSE and all the
		 * (out) parameters are set to %NULL.
		 * @param language an ISO 639 code
		 * @returns %TRUE if a layout exists or %FALSE otherwise.
		 * 
		 * location to store the
		 * layout's indentifier, or %NULL
		 * 
		 * location to store
		 * the layout's display name, or %NULL
		 * 
		 * location to store
		 * the layout's short name, or %NULL
		 * 
		 * location to store
		 * the layout's XKB name, or %NULL
		 * 
		 * location to store
		 * the layout's XKB variant, or %NULL
		 */
		get_layout_info_for_language(language: string): [ boolean, string | null, string | null, string | null, string | null, string | null ];
		/**
		 * Returns a list of all option identifiers we know about for group
		 * #group_id.
		 * @param group_id group's identifier about which to retrieve the options
		 * @returns the list
		 * of option ids. The caller takes ownership of the #GList but not of
		 * the strings themselves, those are internally allocated and must not
		 * be modified.
		 */
		get_options_for_group(group_id: string): string[];
		connect(signal: "notify::parent_object", callback: (owner: this, ...args: any) => void): number;

	}

	type XkbInfoInitOptionsMixin = GObject.ObjectInitOptions
	export interface XkbInfoInitOptions extends XkbInfoInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link XkbInfo} instead.
	 */
	type XkbInfoMixin = IXkbInfo & GObject.Object;

	interface XkbInfo extends XkbInfoMixin {}

	class XkbInfo {
		public constructor(options?: Partial<XkbInfoInitOptions>);
		public static new(): XkbInfo;
		/**
		 * Frees an #XkbRF_VarDefsRec instance allocated by
		 * {@link Gnome.xkb_info_get_var_defs}.
		 * @param var_defs #XkbRF_VarDefsRec instance to free
		 */
		public static free_var_defs(var_defs: any): void;
		/**
		 * Gets both the XKB rules file path and the current XKB parameters in
		 * use by the X server.
		 * @returns location to store the rules file
		 * path. Use {@link GObject.free} when it's no longer needed
		 * 
		 * location to store a
		 * #XkbRF_VarDefsRec pointer. Use gnome_xkb_info_free_var_defs() to
		 * free it
		 */
		public static get_var_defs(): [ rules: string, var_defs: any ];
	}

	export interface RRCrtcInitOptions {}
	interface RRCrtc {}
	class RRCrtc {
		public constructor(options?: Partial<RRCrtcInitOptions>);
		public can_drive_output(output: RROutput): boolean;
		public get_current_mode(): RRMode;
		public get_current_rotation(): RRRotation;
		public get_gamma(size: number, red: number, green: number, blue: number): boolean;
		public get_id(): number;
		public get_position(x: number, y: number): void;
		public get_rotations(): RRRotation;
		public get_scale(): number;
		public set_config_with_time(timestamp: number, x: number, y: number, mode: RRMode, rotation: RRRotation, outputs: RROutput, n_outputs: number, scale: number, global_scale: number): boolean;
		public set_gamma(size: number, red: number, green: number, blue: number): void;
		public supports_rotation(rotation: RRRotation): boolean;
	}

	export interface RRModeInitOptions {}
	interface RRMode {}
	class RRMode {
		public constructor(options?: Partial<RRModeInitOptions>);
		public get_flags(doublescan: boolean, interlaced: boolean, vsync: boolean): void;
		public get_freq(): number;
		public get_freq_f(): number;
		public get_height(): number;
		public get_id(): number;
		public get_width(): number;
	}

	export interface RROutputInitOptions {}
	interface RROutput {}
	class RROutput {
		public constructor(options?: Partial<RROutputInitOptions>);
		public can_clone(clone: RROutput): boolean;
		public get_backlight(): number;
		public get_backlight_max(): number;
		public get_backlight_min(): number;
		public get_connector_type(): string;
		public get_crtc(): RRCrtc;
		public get_current_mode(): RRMode;
		public get_edid_data(size: number): number;
		public get_height_mm(): number;
		public get_id(): number;
		public get_ids_from_edid(vendor: string, product: number, serial: number): boolean;
		public get_is_primary(): boolean;
		public get_name(): string;
		public get_position(x: number, y: number): void;
		public get_possible_crtcs(): RRCrtc;
		public get_preferred_mode(): RRMode;
		public get_size_inches(): number;
		public get_width_mm(): number;
		public is_connected(): boolean;
		public is_laptop(): boolean;
		public list_modes(): RRMode;
		public set_backlight(value: number): boolean;
		public supports_mode(mode: RRMode): boolean;
	}

	enum DesktopThumbnailSize {
		NORMAL = 0,
		LARGE = 1
	}

	enum RRDpmsMode {
		ON = 0,
		STANDBY = 1,
		SUSPEND = 2,
		OFF = 3,
		DISABLED = 4,
		UNKNOWN = 5
	}

	enum RRError {
		UNKNOWN = 0,
		NO_RANDR_EXTENSION = 1,
		RANDR_ERROR = 2,
		BOUNDS_ERROR = 3,
		CRTC_ASSIGNMENT = 4,
		NO_MATCHING_CONFIG = 5,
		NO_DPMS_EXTENSION = 6
	}

	enum RRRotation {
		ROTATION_NEXT = 0,
		ROTATION_0 = 1,
		ROTATION_90 = 2,
		ROTATION_180 = 4,
		ROTATION_270 = 8,
		REFLECT_X = 16,
		REFLECT_Y = 32
	}

	interface InstallerClientCallback {
		(success: boolean): void;
	}

	/**
	 * Returns the GSettings key string of the
	 * given media key type.
	 * @param type The CDesktopMediaKeyType
	 * @returns the string corresponding to the
	 * provided media key type or %NULL
	 */
	function desktop_get_media_key_string(type: number): string;
	/**
	 * Makes a best effort to retrieve the currently logged-in user's passwd
	 * struct (containing uid, gid, home, etc...) based on the process uid
	 * and various environment variables.
	 * @returns the passwd struct corresponding to the
	 * session user (or, as a last resort, the user returned by getuid())
	 */
	function desktop_get_session_user_pwent(): any | null;
	/**
	 * Prepends a terminal (either the one configured as default in
	 * the user's GNOME setup, or one of the common xterm emulators) to the passed
	 * in vector, modifying it in the process.  The vector should be allocated with
	 * #g_malloc, as this will #g_free the original vector.  Also all elements must
	 * have been allocated separately.  That is the standard glib/GNOME way of
	 * doing vectors however.  If the integer that #argc points to is negative, the
	 * size will first be computed.  Also note that passing in pointers to a vector
	 * that is empty, will just create a new vector for you.
	 * @param argc a pointer to the vector size
	 * @param argv a pointer to the vector
	 */
	function desktop_prepend_terminal_to_vector(argc: number, argv: string): void;
	function desktop_thumbnail_cache_check_permissions(factory: DesktopThumbnailFactory, quick: boolean): boolean;
	function desktop_thumbnail_cache_fix_permissions(): void;
	/**
	 * Returns whether the thumbnail has the correct uri embedded in the
	 * Thumb::URI option in the png.
	 * @param pixbuf an loaded thumbnail pixbuf
	 * @param uri a uri
	 * @returns TRUE if the thumbnail is for #uri
	 */
	function desktop_thumbnail_has_uri(pixbuf: GdkPixbuf.Pixbuf, uri: string): boolean;
	/**
	 * Returns whether the thumbnail has the correct uri and mtime embedded in the
	 * png options.
	 * @param pixbuf an loaded thumbnail #GdkPixbuf
	 * @param uri a uri
	 * @param mtime the mtime
	 * @returns TRUE if the thumbnail has the right #uri and #mtime
	 */
	function desktop_thumbnail_is_valid(pixbuf: GdkPixbuf.Pixbuf, uri: string, mtime: number): boolean;
	/**
	 * Calculates the MD5 checksum of the uri. This can be useful
	 * if you want to manually handle thumbnail files.
	 * @param uri an uri
	 * @returns A string with the MD5 digest of the uri string.
	 */
	function desktop_thumbnail_md5(uri: string): string;
	/**
	 * Returns the filename that a thumbnail of size #size for #uri would have.
	 * @param uri an uri
	 * @param size a thumbnail size
	 * @returns an absolute filename
	 */
	function desktop_thumbnail_path_for_uri(uri: string, size: DesktopThumbnailSize): string;
	/**
	 * Scales the pixbuf to the desired size. This function
	 * is a lot faster than gdk-pixbuf when scaling down by
	 * large amounts.
	 * @param pixbuf a #GdkPixbuf
	 * @param dest_width the desired new width
	 * @param dest_height the desired new height
	 * @returns a scaled pixbuf
	 */
	function desktop_thumbnail_scale_down_pixbuf(pixbuf: GdkPixbuf.Pixbuf, dest_width: number, dest_height: number): GdkPixbuf.Pixbuf;
	/**
	 * Uses packagekit to check if provided package names are installed.
	 * @param packages a null-terminated array of package names
	 * @param callback the callback to run for the result
	 */
	function installer_check_for_packages(packages: string[], callback: InstallerClientCallback): void;
	/**
	 * Uses packagekit to install the provided list of packages.
	 * @param packages a null-terminated array of package names
	 * @param callback the callback to run for the result
	 */
	function installer_install_packages(packages: string[], callback: InstallerClientCallback): void;
	/**
	 * Returns the #GQuark that will be used for #GError values returned by the
	 * GnomeRR API.
	 * @returns a #GQuark used to identify errors coming from the GnomeRR API.
	 */
	function rr_error_quark(): GLib.Quark;
	const RR_CONNECTOR_TYPE_PANEL: string;

}