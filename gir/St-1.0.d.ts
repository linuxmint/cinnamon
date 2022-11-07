/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.St {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Adjustment} instead.
	 */
	interface IAdjustment {
		lower: number;
		page_increment: number;
		page_size: number;
		step_increment: number;
		upper: number;
		value: number;
		add_transition(name: string, transition: Clutter.Transition): void;
		/**
		 * Adjusts the adjustment using delta values from a scroll event.
		 * You should use this instead of using {@link St.Adjustment.set_value}
		 * as this method will tweak the values directly using the same
		 * math as GTK+, to ensure that scrolling is consistent across
		 * the environment.
		 * @param delta A delta, retrieved directly from {@link Clutter.event.get_scroll_delta}
		 *   or similar.
		 */
		adjust_for_scroll_event(delta: number): void;
		clamp_page(lower: number, upper: number): void;
		get_transition(name: string): Clutter.Transition | null;
		get_value(): number;
		/**
		 * Gets all of #adjustment's values at once.
		 * @returns the current value
		 * 
		 * the lower bound
		 * 
		 * the upper bound
		 * 
		 * the step increment
		 * 
		 * the page increment
		 * 
		 * the page size
		 */
		get_values(): [ value: number, lower: number, upper: number, step_increment: number, page_increment: number, page_size: number ];
		remove_transition(name: string): void;
		set_value(value: number): void;
		set_values(value: number, lower: number, upper: number, step_increment: number, page_increment: number, page_size: number): void;
		/**
		 * Emitted when any of the adjustment values have changed
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "changed", callback: (owner: this) => void): number;

		connect(signal: "notify::lower", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::page-increment", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::page-size", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::step-increment", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::upper", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::value", callback: (owner: this, ...args: any) => void): number;

	}

	type AdjustmentInitOptionsMixin = GObject.ObjectInitOptions & Clutter.AnimatableInitOptions & 
	Pick<IAdjustment,
		"lower" |
		"page_increment" |
		"page_size" |
		"step_increment" |
		"upper" |
		"value">;

	export interface AdjustmentInitOptions extends AdjustmentInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Adjustment} instead.
	 */
	type AdjustmentMixin = IAdjustment & GObject.Object & Clutter.Animatable;

	interface Adjustment extends AdjustmentMixin {}

	class Adjustment {
		public constructor(options?: Partial<AdjustmentInitOptions>);
		public static new(value: number, lower: number, upper: number, step_increment: number, page_increment: number, page_size: number): Adjustment;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Bin} instead.
	 */
	interface IBin {
		/**
		 * The child #ClutterActor of the {@link Bin} container.
		 */
		child: Clutter.Actor | null;
		/**
		 * The horizontal alignment of the {@link Bin} child.
		 */
		x_align: Align;
		/**
		 * Whether the child should fill the horizontal allocation
		 */
		x_fill: boolean;
		/**
		 * The vertical alignment of the {@link Bin} child.
		 */
		y_align: Align;
		/**
		 * Whether the child should fill the vertical allocation
		 */
		y_fill: boolean;
		/**
		 * Retrieves the horizontal and vertical alignment of the child
		 * inside a {@link Bin}, as set by {@link St.Bin.set_alignment}.
		 * @param x_align return location for the horizontal alignment, or %NULL
		 * @param y_align return location for the vertical alignment, or %NULL
		 */
		get_alignment(x_align: Align, y_align: Align): void;
		/**
		 * Retrieves a pointer to the child of #bin.
		 * @returns a #ClutterActor, or %NULL
		 */
		get_child(): Clutter.Actor;
		/**
		 * Retrieves the horizontal and vertical fill settings
		 * @returns return location for the horizontal fill, or %NULL
		 * 
		 * return location for the vertical fill, or %NULL
		 */
		get_fill(): [ x_fill: boolean, y_fill: boolean ];
		/**
		 * Sets the horizontal and vertical alignment of the child
		 * inside a {@link Bin}.
		 * @param x_align horizontal alignment
		 * @param y_align vertical alignment
		 */
		set_alignment(x_align: Align, y_align: Align): void;
		/**
		 * Sets #child as the child of #bin.
		 * 
		 * If #bin already has a child, the previous child is removed.
		 * @param child a #ClutterActor, or %NULL
		 */
		set_child(child?: Clutter.Actor | null): void;
		/**
		 * Sets whether the child of #bin should fill out the horizontal
		 * and/or vertical allocation of the parent
		 * @param x_fill %TRUE if the child should fill horizontally the #bin
		 * @param y_fill %TRUE if the child should fill vertically the #bin
		 */
		set_fill(x_fill: boolean, y_fill: boolean): void;
		connect(signal: "notify::child", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::x-align", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::x-fill", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::y-align", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::y-fill", callback: (owner: this, ...args: any) => void): number;

	}

	type BinInitOptionsMixin = WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IBin,
		"child" |
		"x_align" |
		"x_fill" |
		"y_align" |
		"y_fill">;

	export interface BinInitOptions extends BinInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Bin} instead.
	 */
	type BinMixin = IBin & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The {@link Bin} struct contains only private data
	 */
	interface Bin extends BinMixin {}

	class Bin {
		public constructor(options?: Partial<BinInitOptions>);
		/**
		 * Creates a new {@link Bin}, a simple container for one child.
		 * @returns the newly created {@link Bin} actor
		 */
		public static new(): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BorderImage} instead.
	 */
	interface IBorderImage {
		/**
		 * Check if two border_image objects are identical.
		 * @param other a different {@link Border_Image}
		 * @returns %TRUE if the two border image objects are identical
		 */
		equal(other: BorderImage): boolean;
		get_borders(border_top: number, border_right: number, border_bottom: number, border_left: number): void;
		get_filename(): string;
	}

	type BorderImageInitOptionsMixin = GObject.ObjectInitOptions
	export interface BorderImageInitOptions extends BorderImageInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BorderImage} instead.
	 */
	type BorderImageMixin = IBorderImage & GObject.Object;

	interface BorderImage extends BorderImageMixin {}

	class BorderImage {
		public constructor(options?: Partial<BorderImageInitOptions>);
		public static new(filename: string, border_top: number, border_right: number, border_bottom: number, border_left: number): BorderImage;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BoxLayout} instead.
	 */
	interface IBoxLayout {
		pack_start: boolean;
		vertical: boolean;
		/**
		 * Get the value of the {@link BoxLayout.pack_start} property.
		 * @returns %TRUE if pack-start is enabled
		 */
		get_pack_start(): boolean;
		/**
		 * Get the value of the {@link BoxLayout.vertical} property.
		 * @returns %TRUE if the layout is vertical
		 */
		get_vertical(): boolean;
		/**
		 * Adds #actor to #self at position #pos.  If #pos is
		 * negative or larger than the number of elements in the
		 * list then #actor is added after all the others previously
		 * added.
		 * @param actor A #ClutterActor
		 * @param pos position to insert actor
		 */
		insert_actor(actor: Clutter.Actor, pos: number): void;
		/**
		 * Adds #actor to #self at the position before #sibling.
		 * #sibling cannot be %NULL and must be already a child
		 * of #self.
		 * @param actor A #ClutterActor
		 * @param sibling A previously added #ClutterActor
		 */
		insert_before(actor: Clutter.Actor, sibling: Clutter.Actor): void;
		/**
		 * Set the value of the {@link BoxLayout.pack_start} property.
		 * @param pack_start %TRUE if the layout should use pack-start
		 */
		set_pack_start(pack_start: boolean): void;
		/**
		 * Set the value of the {@link BoxLayout.vertical} property
		 * @param vertical %TRUE if the layout should be vertical
		 */
		set_vertical(vertical: boolean): void;
		connect(signal: "notify::pack-start", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::vertical", callback: (owner: this, ...args: any) => void): number;

	}

	type BoxLayoutInitOptionsMixin = ViewportInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & ScrollableInitOptions & 
	Pick<IBoxLayout,
		"pack_start" |
		"vertical">;

	export interface BoxLayoutInitOptions extends BoxLayoutInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BoxLayout} instead.
	 */
	type BoxLayoutMixin = IBoxLayout & Viewport & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable & Scrollable;

	/**
	 * The contents of this structure are private and should only be accessed
	 * through the public API.
	 */
	interface BoxLayout extends BoxLayoutMixin {}

	class BoxLayout {
		public constructor(options?: Partial<BoxLayoutInitOptions>);
		/**
		 * Create a new {@link BoxLayout}.
		 * @returns a newly allocated {@link BoxLayout}
		 */
		public static new(): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BoxLayoutChild} instead.
	 */
	interface IBoxLayoutChild {
		expand: boolean;
		x_align: Align;
		x_fill: boolean;
		y_align: Align;
		y_fill: boolean;

		connect(signal: "notify::expand", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::x-align", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::x-fill", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::y-align", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::y-fill", callback: (owner: this, ...args: any) => void): number;

	}

	type BoxLayoutChildInitOptionsMixin = Clutter.ChildMetaInitOptions & 
	Pick<IBoxLayoutChild,
		"expand" |
		"x_align" |
		"x_fill" |
		"y_align" |
		"y_fill">;

	export interface BoxLayoutChildInitOptions extends BoxLayoutChildInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BoxLayoutChild} instead.
	 */
	type BoxLayoutChildMixin = IBoxLayoutChild & Clutter.ChildMeta;

	/**
	 * The contents of this structure are private and should only be accessed
	 * through the public API.
	 */
	interface BoxLayoutChild extends BoxLayoutChildMixin {}

	class BoxLayoutChild {
		public constructor(options?: Partial<BoxLayoutChildInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Button} instead.
	 */
	interface IButton {
		button_mask: ButtonMask;
		checked: boolean;
		label: string;
		readonly pressed: boolean;
		toggle_mode: boolean;
		/**
		 * If this widget is holding a pointer grab, this function will
		 * will ungrab it, and reset the pressed state.  The effect is
		 * similar to if the user had released the mouse button, but without
		 * emitting the clicked signal.
		 * 
		 * This function is useful if for example you want to do something
		 * after the user is holding the mouse button for a given period of
		 * time, breaking the grab.
		 */
		fake_release(): void;
		/**
		 * Gets the mask of mouse buttons that #button emits the
		 * {@link Button.clicked} signal for.
		 * @returns the mask of mouse buttons that #button emits the
		 * {@link Button.clicked} signal for.
		 */
		get_button_mask(): ButtonMask;
		/**
		 * Get the state of the button that is in toggle mode.
		 * @returns %TRUE if the button is checked, or %FALSE if not
		 */
		get_checked(): boolean;
		/**
		 * Get the text displayed on the button
		 * @returns the text for the button. This must not be freed by the application
		 */
		get_label(): string;
		/**
		 * Get the toggle mode status of the button.
		 * @returns %TRUE if toggle mode is set, otherwise %FALSE
		 */
		get_toggle_mode(): boolean;
		/**
		 * Sets which mouse buttons #button emits {@link Button.clicked} for.
		 * @param mask the mask of mouse buttons that #button responds to
		 */
		set_button_mask(mask: ButtonMask): void;
		/**
		 * Sets the pressed state of the button. This is only really useful if the
		 * button has #toggle-mode mode set to %TRUE.
		 * @param checked %TRUE or %FALSE
		 */
		set_checked(checked: boolean): void;
		/**
		 * Sets the text displayed on the button
		 * @param text text to set the label to
		 */
		set_label(text: string): void;
		/**
		 * Enables or disables toggle mode for the button. In toggle mode, the active
		 * state will be "toggled" when the user clicks the button.
		 * @param toggle %TRUE or %FALSE
		 */
		set_toggle_mode(toggle: boolean): void;
		/**
		 * Emitted when the user activates the button, either with a mouse press and
		 * release or with the keyboard.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - clicked_button: the mouse button that was used 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "clicked", callback: (owner: this, clicked_button: number) => void): number;

		connect(signal: "notify::button-mask", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::checked", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::label", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pressed", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::toggle-mode", callback: (owner: this, ...args: any) => void): number;

	}

	type ButtonInitOptionsMixin = BinInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IButton,
		"button_mask" |
		"checked" |
		"label" |
		"toggle_mode">;

	export interface ButtonInitOptions extends ButtonInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Button} instead.
	 */
	type ButtonMixin = IButton & Bin & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The contents of this structure is private and should only be accessed using
	 * the provided API.
	 */
	interface Button extends ButtonMixin {}

	class Button {
		public constructor(options?: Partial<ButtonInitOptions>);
		/**
		 * Create a new button
		 * @returns a new {@link Button}
		 */
		public static new(): Widget;
		/**
		 * Create a new {@link Button} with the specified label
		 * @param text text to set the label to
		 * @returns a new {@link Button}
		 */
		public static new_with_label(text: string): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Clipboard} instead.
	 */
	interface IClipboard {
		/**
		 * Request the data from the clipboard in text form. #callback is executed
		 * when the data is retreived.
		 * @param type The type of clipboard data you want
		 * @param callback function to be called when the text is retreived
		 */
		get_text(type: ClipboardType, callback: ClipboardCallbackFunc): void;
		/**
		 * Sets text as the current contents of the clipboard.
		 * @param type The type of clipboard that you want to set
		 * @param text text to copy to the clipboard
		 */
		set_text(type: ClipboardType, text: string): void;
	}

	type ClipboardInitOptionsMixin = GObject.ObjectInitOptions
	export interface ClipboardInitOptions extends ClipboardInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Clipboard} instead.
	 */
	type ClipboardMixin = IClipboard & GObject.Object;

	/**
	 * The contents of this structure is private and should only be accessed using
	 * the provided API.
	 */
	interface Clipboard extends ClipboardMixin {}

	class Clipboard {
		public constructor(options?: Partial<ClipboardInitOptions>);
		/**
		 * Get the global {@link Clipboard} object that represents the clipboard.
		 * @returns a {@link Clipboard} owned by St and must not be
		 * unrefferenced or freed.
		 */
		public static get_default(): Clipboard;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DrawingArea} instead.
	 */
	interface IDrawingArea {
		/**
		 * Gets the Cairo context to paint to. This function must only be called
		 * from a signal hander for the ::repaint signal.
		 * @returns the Cairo context for the paint operation
		 */
		get_context(): cairo.Context;
		/**
		 * Gets the size of the cairo surface being painted to, which is equal
		 * to the size of the content area of the widget. This function must
		 * only be called from a signal hander for the ::repaint signal.
		 * @returns location to store the width of the painted area
		 * 
		 * location to store the height of the painted area
		 */
		get_surface_size(): [ width: number, height: number ];
		/**
		 * Will cause the actor to emit a ::repaint signal before it is next
		 * drawn to the scene. Useful if some parameters for the area being
		 * drawn other than the size or style have changed. Note that
		 * {@link Clutter.Actor.queue_redraw} will simply result in the same
		 * contents being drawn to the scene again.
		 */
		queue_repaint(): void;
		connect(signal: "repaint", callback: (owner: this) => void): number;

	}

	type DrawingAreaInitOptionsMixin = WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions
	export interface DrawingAreaInitOptions extends DrawingAreaInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DrawingArea} instead.
	 */
	type DrawingAreaMixin = IDrawingArea & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface DrawingArea extends DrawingAreaMixin {}

	class DrawingArea {
		public constructor(options?: Partial<DrawingAreaInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Entry} instead.
	 */
	interface IEntry {
		readonly clutter_text: Clutter.Text;
		hint_text: string;
		text: string;
		/**
		 * Retrieve the internal #ClutterText so that extra parameters can be set
		 * @returns the #ClutterText used by {@link Entry}. The entry is
		 * owned by the #StEntry and should not be unref'ed by the application.
		 */
		get_clutter_text(): Clutter.Text;
		/**
		 * Gets the text that is displayed when the entry is empty and unfocused
		 * @returns the current value of the hint property. This string is owned by the
		 * {@link Entry} and should not be freed or modified.
		 */
		get_hint_text(): string;
		/**
		 * Get the text displayed on the entry
		 * @returns the text for the entry. This must not be freed by the application
		 */
		get_text(): string;
		/**
		 * Sets the text to display when the entry is empty and unfocused. When the
		 * entry is displaying the hint, it has a pseudo class of "indeterminate".
		 * A value of NULL unsets the hint.
		 * @param text text to set as the entry hint
		 */
		set_hint_text(text?: string | null): void;
		/**
		 * Set the primary icon of the entry to #icon
		 * @param icon a #ClutterActor
		 */
		set_primary_icon(icon?: Clutter.Actor | null): void;
		/**
		 * Set the primary icon of the entry to the given filename
		 * @param filename filename of an icon
		 */
		set_primary_icon_from_file(filename?: string | null): void;
		/**
		 * Set the secondary icon of the entry to #icon
		 * @param icon an #ClutterActor
		 */
		set_secondary_icon(icon?: Clutter.Actor | null): void;
		/**
		 * Set the primary icon of the entry to the given filename
		 * @param filename filename of an icon
		 */
		set_secondary_icon_from_file(filename?: string | null): void;
		/**
		 * Sets the text displayed on the entry
		 * @param text text to set the entry to
		 */
		set_text(text?: string | null): void;
		/**
		 * Emitted when the primary icon is clicked
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "primary-icon-clicked", callback: (owner: this) => void): number;
		/**
		 * Emitted when the secondary icon is clicked
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "secondary-icon-clicked", callback: (owner: this) => void): number;

		connect(signal: "notify::clutter-text", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::hint-text", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::text", callback: (owner: this, ...args: any) => void): number;

	}

	type EntryInitOptionsMixin = WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IEntry,
		"hint_text" |
		"text">;

	export interface EntryInitOptions extends EntryInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Entry} instead.
	 */
	type EntryMixin = IEntry & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The contents of this structure is private and should only be accessed using
	 * the provided API.
	 */
	interface Entry extends EntryMixin {}

	class Entry {
		public constructor(options?: Partial<EntryInitOptions>);
		/**
		 * Create a new {@link Entry} with the specified entry
		 * @param text text to set the entry to
		 * @returns a new {@link Entry}
		 */
		public static new(text: string): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link FocusManager} instead.
	 */
	interface IFocusManager {
		/**
		 * Adds a new focus group to #manager. When the focus is in an actor
		 * that is a descendant of #root, #manager will handle moving focus
		 * from one actor to another within #root based on keyboard events.
		 * @param root the root container of the group
		 */
		add_group(root: Widget): void;
		/**
		 * Checks if #widget is inside a focus group, and if so, returns
		 * the root of that group.
		 * @param widget an {@link Widget}
		 * @returns the focus group root, or %NULL if
		 * #widget is not in a focus group
		 */
		get_group(widget: Widget): Widget;
		/**
		 * Removes the group rooted at #root from #manager
		 * @param root the root container of the group
		 */
		remove_group(root: Widget): void;
	}

	type FocusManagerInitOptionsMixin = GObject.ObjectInitOptions
	export interface FocusManagerInitOptions extends FocusManagerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link FocusManager} instead.
	 */
	type FocusManagerMixin = IFocusManager & GObject.Object;

	/**
	 * The {@link FocusManager} struct contains only private data
	 */
	interface FocusManager extends FocusManagerMixin {}

	class FocusManager {
		public constructor(options?: Partial<FocusManagerInitOptions>);
		/**
		 * Gets the {@link FocusManager} for #stage, creating it if necessary.
		 * @param stage a #ClutterStage
		 * @returns the focus manager for #stage
		 */
		public static get_for_stage(stage: Clutter.Stage): FocusManager;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Group} instead.
	 */
	interface IGroup {

	}

	type GroupInitOptionsMixin = WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions
	export interface GroupInitOptions extends GroupInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Group} instead.
	 */
	type GroupMixin = IGroup & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The {@link Group} struct contains only private data
	 */
	interface Group extends GroupMixin {}

	class Group {
		public constructor(options?: Partial<GroupInitOptions>);
		/**
		 * @deprecated
		 * Use {@link St.Widget.new} instead.
		 * 
		 * Create a new  {@link Group}.
		 * @returns the newly created {@link Group} actor
		 */
		public static new(): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Icon} instead.
	 */
	interface IIcon {
		gicon: Gio.Icon;
		icon_name: string;
		icon_size: number;
		icon_type: IconType;
		get_gicon(): Gio.Icon;
		get_icon_name(): string;
		/**
		 * Gets the size explicit size on the icon. This is not necesariily
		 *  the size that the icon will actually be displayed at.
		 * @returns the size explicitly set, or -1 if no size has been set
		 */
		get_icon_size(): number;
		/**
		 * Gets the type of icon we'll look up to display in the actor.
		 * See {@link St.Icon.set_icon_type}.
		 * @returns the icon type.
		 */
		get_icon_type(): IconType;
		set_gicon(gicon?: Gio.Icon | null): void;
		set_icon_name(icon_name: string): void;
		/**
		 * Sets an explicit size for the icon.
		 * @param size if positive, the new size, otherwise the size will be
		 *   derived from the current style
		 */
		set_icon_size(size: number): void;
		/**
		 * Sets the type of icon we'll look up to display in the actor.
		 * The icon type determines whether we use a symbolic icon or
		 * a full color icon and also is used for specific handling for
		 * application and document icons.
		 * @param icon_type the type of icon to use
		 */
		set_icon_type(icon_type: IconType): void;
		connect(signal: "notify::gicon", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::icon-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::icon-size", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::icon-type", callback: (owner: this, ...args: any) => void): number;

	}

	type IconInitOptionsMixin = WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IIcon,
		"gicon" |
		"icon_name" |
		"icon_size" |
		"icon_type">;

	export interface IconInitOptions extends IconInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Icon} instead.
	 */
	type IconMixin = IIcon & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The contents of this structure are private and should only be accessed
	 * through the public API.
	 */
	interface Icon extends IconMixin {}

	class Icon {
		public constructor(options?: Partial<IconInitOptions>);
		/**
		 * Create a newly allocated {@link Icon}
		 * @returns A newly allocated {@link Icon}
		 */
		public static new(): Clutter.Actor;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ImageContent} instead.
	 */
	interface IImageContent {
		preferred_height: number;
		preferred_width: number;

		connect(signal: "notify::preferred-height", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::preferred-width", callback: (owner: this, ...args: any) => void): number;

	}

	type ImageContentInitOptionsMixin = Clutter.ImageInitOptions & Clutter.ContentInitOptions & 
	Pick<IImageContent,
		"preferred_height" |
		"preferred_width">;

	export interface ImageContentInitOptions extends ImageContentInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ImageContent} instead.
	 */
	type ImageContentMixin = IImageContent & Clutter.Image & Clutter.Content;

	interface ImageContent extends ImageContentMixin {}

	class ImageContent {
		public constructor(options?: Partial<ImageContentInitOptions>);
		/**
		 * Creates a new {@link ImageContent}, a simple content for sized images.
		 * @param width The preferred width to be used when drawing the content
		 * @param height The preferred width to be used when drawing the content
		 * @returns the newly created {@link ImageContent} content
		 *   Use {@link GObject.unref} when done.
		 */
		public static new_with_preferred_size(width: number, height: number): Clutter.Content;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Label} instead.
	 */
	interface ILabel {
		readonly clutter_text: Clutter.Text;
		text: string;
		/**
		 * Retrieve the internal #ClutterText so that extra parameters can be set
		 * @returns ethe #ClutterText used by {@link Label}. The label
		 * is owned by the #StLabel and should not be unref'ed by the application.
		 */
		get_clutter_text(): Clutter.Text;
		/**
		 * Get the text displayed on the label
		 * @returns the text for the label. This must not be freed by the application
		 */
		get_text(): string;
		/**
		 * Sets the text displayed on the label
		 * @param text text to set the label to
		 */
		set_text(text: string): void;
		connect(signal: "notify::clutter-text", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::text", callback: (owner: this, ...args: any) => void): number;

	}

	type LabelInitOptionsMixin = WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<ILabel,
		"text">;

	export interface LabelInitOptions extends LabelInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Label} instead.
	 */
	type LabelMixin = ILabel & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The contents of this structure is private and should only be accessed using
	 * the provided API.
	 */
	interface Label extends LabelMixin {}

	class Label {
		public constructor(options?: Partial<LabelInitOptions>);
		/**
		 * Create a new {@link Label} with the specified label
		 * @param text text to set the label to
		 * @returns a new {@link Label}
		 */
		public static new(text: string): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Polygon} instead.
	 */
	interface IPolygon {
		debug: boolean;
		llc_x: number;
		llc_y: number;
		lrc_x: number;
		lrc_y: number;
		ulc_x: number;
		ulc_y: number;
		urc_x: number;
		urc_y: number;
		/**
		 * Will cause the actor to emit a ::repaint signal before it is next
		 * drawn to the scene. Useful if some parameters for the area being
		 * drawn other than the size or style have changed. Note that
		 * {@link Clutter.Actor.queue_redraw} will simply result in the same
		 * contents being drawn to the scene again.
		 */
		queue_repaint(): void;
		connect(signal: "repaint", callback: (owner: this) => void): number;

		connect(signal: "notify::debug", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::llc-x", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::llc-y", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::lrc-x", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::lrc-y", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ulc-x", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ulc-y", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::urc-x", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::urc-y", callback: (owner: this, ...args: any) => void): number;

	}

	type PolygonInitOptionsMixin = Clutter.ActorInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IPolygon,
		"debug" |
		"llc_x" |
		"llc_y" |
		"lrc_x" |
		"lrc_y" |
		"ulc_x" |
		"ulc_y" |
		"urc_x" |
		"urc_y">;

	export interface PolygonInitOptions extends PolygonInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Polygon} instead.
	 */
	type PolygonMixin = IPolygon & Clutter.Actor & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	interface Polygon extends PolygonMixin {}

	class Polygon {
		public constructor(options?: Partial<PolygonInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollBar} instead.
	 */
	interface IScrollBar {
		adjustment: Adjustment;
		vertical: boolean;
		/**
		 * Gets the adjustment object that stores the current position
		 * of the scrollbar.
		 * @returns the adjustment
		 */
		get_adjustment(): Adjustment;
		set_adjustment(adjustment: Adjustment): void;
		connect(signal: "scroll-start", callback: (owner: this) => void): number;
		connect(signal: "scroll-stop", callback: (owner: this) => void): number;

		connect(signal: "notify::adjustment", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::vertical", callback: (owner: this, ...args: any) => void): number;

	}

	type ScrollBarInitOptionsMixin = WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IScrollBar,
		"adjustment" |
		"vertical">;

	export interface ScrollBarInitOptions extends ScrollBarInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollBar} instead.
	 */
	type ScrollBarMixin = IScrollBar & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The contents of this structure are private and should only be accessed
	 * through the public API.
	 */
	interface ScrollBar extends ScrollBarMixin {}

	class ScrollBar {
		public constructor(options?: Partial<ScrollBarInitOptions>);
		public static new(adjustment: Adjustment): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollView} instead.
	 */
	interface IScrollView {
		enable_auto_scrolling: boolean;
		enable_mouse_scrolling: boolean;
		readonly hscroll: ScrollBar;
		hscrollbar_policy: PolicyType;
		readonly hscrollbar_visible: boolean;
		overlay_scrollbars: boolean;
		readonly vscroll: ScrollBar;
		vscrollbar_policy: PolicyType;
		readonly vscrollbar_visible: boolean;
		get_auto_scrolling(): boolean;
		get_column_size(): number;
		/**
		 * Gets the horizontal scrollbar of the scrollbiew
		 * @returns the horizontal {@link ScrollBar}
		 */
		get_hscroll_bar(): ScrollBar;
		get_mouse_scrolling(): boolean;
		/**
		 * Gets the value set by {@link St.ScrollView.set_overlay_scrollbars}.
		 * @returns 
		 */
		get_overlay_scrollbars(): boolean;
		get_row_size(): number;
		/**
		 * Gets the vertical scrollbar of the scrollbiew
		 * @returns the vertical {@link ScrollBar}
		 */
		get_vscroll_bar(): ScrollBar;
		set_auto_scrolling(enabled: boolean): void;
		set_column_size(column_size: number): void;
		set_mouse_scrolling(enabled: boolean): void;
		/**
		 * Sets whether scrollbars are painted on top of the content.
		 * @param enabled Whether to enable overlay scrollbars
		 */
		set_overlay_scrollbars(enabled: boolean): void;
		/**
		 * Set the scroll policy.
		 * @param hscroll Whether to enable horizontal scrolling
		 * @param vscroll Whether to enable vertical scrolling
		 */
		set_policy(hscroll: PolicyType, vscroll: PolicyType): void;
		set_row_size(row_size: number): void;
		/**
		 * Sets the height of the fade area area in pixels. A value of 0
		 * disables the effect.
		 * @param vfade_offset The length of the veritcal fade effect, in pixels.
		 * @param hfade_offset The length of the horizontal fade effect, in pixels.
		 */
		update_fade_effect(vfade_offset: number, hfade_offset: number): void;
		connect(signal: "notify::enable-auto-scrolling", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::enable-mouse-scrolling", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::hscroll", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::hscrollbar-policy", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::hscrollbar-visible", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::overlay-scrollbars", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::vscroll", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::vscrollbar-policy", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::vscrollbar-visible", callback: (owner: this, ...args: any) => void): number;

	}

	type ScrollViewInitOptionsMixin = BinInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IScrollView,
		"enable_auto_scrolling" |
		"enable_mouse_scrolling" |
		"hscrollbar_policy" |
		"overlay_scrollbars" |
		"vscrollbar_policy">;

	export interface ScrollViewInitOptions extends ScrollViewInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollView} instead.
	 */
	type ScrollViewMixin = IScrollView & Bin & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The contents of this structure are private and should only be accessed
	 * through the public API.
	 */
	interface ScrollView extends ScrollViewMixin {}

	class ScrollView {
		public constructor(options?: Partial<ScrollViewInitOptions>);
		public static new(): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollViewFade} instead.
	 */
	interface IScrollViewFade {
		/**
		 * Whether the faded area should extend to the edges of the {@link ScrollViewFade}.
		 */
		fade_edges: boolean;
		/**
		 * The height of area which is faded at the left and right edges of the
		 * {@link ScrollViewFade}.
		 */
		hfade_offset: number;
		/**
		 * The height of area which is faded at the top and bottom edges of the
		 * {@link ScrollViewFade}.
		 */
		vfade_offset: number;

		connect(signal: "notify::fade-edges", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::hfade-offset", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::vfade-offset", callback: (owner: this, ...args: any) => void): number;

	}

	type ScrollViewFadeInitOptionsMixin = Clutter.ShaderEffectInitOptions & 
	Pick<IScrollViewFade,
		"fade_edges" |
		"hfade_offset" |
		"vfade_offset">;

	export interface ScrollViewFadeInitOptions extends ScrollViewFadeInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScrollViewFade} instead.
	 */
	type ScrollViewFadeMixin = IScrollViewFade & Clutter.ShaderEffect;

	interface ScrollViewFade extends ScrollViewFadeMixin {}

	class ScrollViewFade {
		public constructor(options?: Partial<ScrollViewFadeInitOptions>);
		/**
		 * Create a new {@link ScrollViewFade}.
		 * @returns a new {@link ScrollViewFade}
		 */
		public static new(): Clutter.Effect;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Settings} instead.
	 */
	interface ISettings {
		readonly font_name: string;
		readonly gtk_icon_theme: string;
		readonly magnifier_active: boolean;

		connect(signal: "notify::font-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::gtk-icon-theme", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::magnifier-active", callback: (owner: this, ...args: any) => void): number;

	}

	type SettingsInitOptionsMixin = GObject.ObjectInitOptions
	export interface SettingsInitOptions extends SettingsInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Settings} instead.
	 */
	type SettingsMixin = ISettings & GObject.Object;

	interface Settings extends SettingsMixin {}

	class Settings {
		public constructor(options?: Partial<SettingsInitOptions>);
		/**
		 * Gets the {@link Settings}
		 * @returns a settings object
		 */
		public static get(): Settings;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Table} instead.
	 */
	interface ITable {
		readonly column_count: number;
		homogeneous: boolean;
		readonly row_count: number;
		/**
		 * Determine if the child is allocated even if it is hidden
		 * @param child A #ClutterActor
		 * @returns %TRUE if the actor is allocated when hidden
		 */
		child_get_allocate_hidden(child: Clutter.Actor): boolean;
		/**
		 * Get the column span of the child. Defaults to 1.
		 * @param child a #ClutterActor
		 * @returns the column span of the child
		 */
		child_get_col_span(child: Clutter.Actor): number;
		/**
		 * Get the row span of the child. Defaults to 1.
		 * @param child A #ClutterActor
		 * @returns the row span of the child
		 */
		child_get_row_span(child: Clutter.Actor): number;
		/**
		 * Get the x-align value of the child
		 * @param child A #ClutterActor
		 * @returns An {@link Align} value
		 */
		child_get_x_align(child: Clutter.Actor): Align;
		/**
		 * Get the x-expand property of the child
		 * @param child A #ClutterActor
		 * @returns %TRUE if the child is set to x-expand
		 */
		child_get_x_expand(child: Clutter.Actor): boolean;
		/**
		 * Get the x-fill state of the child
		 * @param child A #ClutterActor
		 * @returns %TRUE if the child is set to x-fill
		 */
		child_get_x_fill(child: Clutter.Actor): boolean;
		/**
		 * Get the y-align value of the child
		 * @param child A #ClutterActor
		 * @returns An {@link Align} value
		 */
		child_get_y_align(child: Clutter.Actor): Align;
		/**
		 * Get the y-expand property of the child.
		 * @param child A #ClutterActor
		 * @returns %TRUE if the child is set to y-expand
		 */
		child_get_y_expand(child: Clutter.Actor): boolean;
		/**
		 * Get the y-fill state of the child
		 * @param child A #ClutterActor
		 * @returns %TRUE if the child is set to y-fill
		 */
		child_get_y_fill(child: Clutter.Actor): boolean;
		/**
		 * Set whether the child should be allocate even if it is hidden
		 * @param child A #ClutterActor
		 * @param value %TRUE if the actor should be allocated when hidden
		 */
		child_set_allocate_hidden(child: Clutter.Actor, value: boolean): void;
		/**
		 * Set the column span of the child.
		 * @param child An #ClutterActor
		 * @param span The number of columns to span
		 */
		child_set_col_span(child: Clutter.Actor, span: number): void;
		/**
		 * Set the row span of the child.
		 * @param child A #ClutterActor
		 * @param span the number of rows to span
		 */
		child_set_row_span(child: Clutter.Actor, span: number): void;
		/**
		 * Set the alignment of the child within its cell. This will only have an effect
		 * if the the x-fill property is FALSE.
		 * @param child A #ClutterActor
		 * @param align A {@link Align} value
		 */
		child_set_x_align(child: Clutter.Actor, align: Align): void;
		/**
		 * Set x-expand on the child. This causes the column which the child
		 * resides in to be allocated any extra space if the allocation of the table is
		 * larger than the preferred size.
		 * @param child A #ClutterActor
		 * @param expand the new value of the x expand child property
		 */
		child_set_x_expand(child: Clutter.Actor, expand: boolean): void;
		/**
		 * Set the fill state of the child on the x-axis. This will cause the child to
		 * be allocated the maximum available space.
		 * @param child A #ClutterActor
		 * @param fill the fill state
		 */
		child_set_x_fill(child: Clutter.Actor, fill: boolean): void;
		/**
		 * Set the value of the y-align property. This will only have an effect if
		 * y-fill value is set to FALSE.
		 * @param child A #ClutterActor
		 * @param align A {@link Align} value
		 */
		child_set_y_align(child: Clutter.Actor, align: Align): void;
		/**
		 * Set y-expand on the child. This causes the row which the child
		 * resides in to be allocated any extra space if the allocation of the table is
		 * larger than the preferred size.
		 * @param child A #ClutterActor
		 * @param expand the new value of the y-expand child property
		 */
		child_set_y_expand(child: Clutter.Actor, expand: boolean): void;
		/**
		 * Set the fill state of the child on the y-axis. This will cause the child to
		 * be allocated the maximum available space.
		 * @param child A #ClutterActor
		 * @param fill the fill state
		 */
		child_set_y_fill(child: Clutter.Actor, fill: boolean): void;
		/**
		 * Retrieve the current number of columns in #table
		 * @returns the number of columns
		 */
		get_column_count(): number;
		/**
		 * Retrieve the current number rows in the #table
		 * @returns the number of rows
		 */
		get_row_count(): number;
		connect(signal: "notify::column-count", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::homogeneous", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::row-count", callback: (owner: this, ...args: any) => void): number;

	}

	type TableInitOptionsMixin = WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<ITable,
		"homogeneous">;

	export interface TableInitOptions extends TableInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Table} instead.
	 */
	type TableMixin = ITable & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * The contents of this structure is private and should only be accessed using
	 * the provided API.
	 */
	interface Table extends TableMixin {}

	class Table {
		public constructor(options?: Partial<TableInitOptions>);
		/**
		 * Create a new {@link Table}
		 * @returns a new {@link Table}
		 */
		public static new(): Widget;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TableChild} instead.
	 */
	interface ITableChild {
		allocate_hidden: boolean;
		col: number;
		col_span: number;
		row: number;
		row_span: number;
		x_align: Align;
		x_expand: boolean;
		x_fill: boolean;
		y_align: Align;
		y_expand: boolean;
		y_fill: boolean;

		connect(signal: "notify::allocate-hidden", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::col", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::col-span", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::row", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::row-span", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::x-align", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::x-expand", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::x-fill", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::y-align", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::y-expand", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::y-fill", callback: (owner: this, ...args: any) => void): number;

	}

	type TableChildInitOptionsMixin = Clutter.ChildMetaInitOptions & 
	Pick<ITableChild,
		"allocate_hidden" |
		"col" |
		"col_span" |
		"row" |
		"row_span" |
		"x_align" |
		"x_expand" |
		"x_fill" |
		"y_align" |
		"y_expand" |
		"y_fill">;

	export interface TableChildInitOptions extends TableChildInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TableChild} instead.
	 */
	type TableChildMixin = ITableChild & Clutter.ChildMeta;

	/**
	 * The contents of the this structure are private and should only be accessed
	 * through the public API.
	 */
	interface TableChild extends TableChildMixin {}

	class TableChild {
		public constructor(options?: Partial<TableChildInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TextureCache} instead.
	 */
	interface ITextureCache {
		/**
		 * Create a #ClutterActor which tracks the #cairo_surface_t value of a GObject property
		 * named by #property_name.  Unlike other methods in StTextureCache, the underlying
		 * #CoglTexture is not shared by default with other invocations to this method.
		 * 
		 * If the source object is destroyed, the texture will continue to show the last
		 * value of the property.
		 * @param object A #GObject with a property #property_name of type #GdkPixbuf
		 * @param property_name Name of a property
		 * @param size
		 * @returns A new {@link Widget}
		 */
		bind_cairo_surface_property(object: GObject.Object, property_name: string, size: number): Widget;
		/**
		 * Load an arbitrary texture, caching it.  The string chosen for #key
		 * should be of the form "type-prefix:type-uuid".  For example,
		 * "url:file:///usr/share/icons/hicolor/48x48/apps/firefox.png", or
		 * "stock-icon:gtk-ok".
		 * @param key Arbitrary string used to refer to item
		 * @param policy Caching policy
		 * @param load Function to create the texture, if not already cached
		 * @returns A newly-referenced handle to the texture
		 */
		load(key: string, policy: TextureCachePolicy, load: TextureCacheLoader): Cogl.Texture;
		/**
		 * Asynchronously load an image.   Initially, the returned texture will have a natural
		 * size of zero.  At some later point, either the image will be loaded successfully
		 * and at that point size will be negotiated, or upon an error, no image will be set.
		 * @param file a #GFile of the image file from which to create a pixbuf
		 * @param available_width available width for the image, can be -1 if not limited
		 * @param available_height available height for the image, can be -1 if not limited
		 * @param paint_scale scale factor of the display
		 * @param resource_scale Resource scale factor
		 * @returns A new #ClutterActor with no image loaded initially.
		 */
		load_file_async(file: Gio.File, available_width: number, available_height: number, paint_scale: number, resource_scale: number): Clutter.Actor;
		/**
		 * Synchronously load an image into a texture.  The texture will be cached
		 * indefinitely.  On error, this function returns an empty texture and prints a warning.
		 * @param file_path Filesystem path
		 * @returns A new #ClutterTexture
		 */
		load_file_simple(file_path: string): Clutter.Actor;
		/**
		 * This function synchronously loads the given file path
		 * into a cairo surface.  On error, a warning is emitted
		 * and %NULL is returned.
		 * @param file_path Path to a file in supported image format
		 * @returns a new #cairo_surface_t
		 */
		load_file_to_cairo_surface(file_path: string): cairo.Surface;
		/**
		 * This function synchronously loads the given file path
		 * into a COGL texture.  On error, a warning is emitted
		 * and %NULL is returned.
		 * @param file_path Path to a file in supported image format
		 * @returns a new #CoglTexture
		 */
		load_file_to_cogl_texture(file_path: string): Cogl.Texture;
		/**
		 * Creates (or retrieves from cache) an icon based on raw pixel data.
		 * @param data raw pixel data
		 * @param has_alpha whether #data includes an alpha channel
		 * @param width width in pixels of #data
		 * @param height width in pixels of #data
		 * @param rowstride rowstride of #data
		 * @param size size of icon to return
		 * @returns a new #ClutterActor displaying a
		 * pixbuf created from #data and the other parameters.
		 */
		load_from_raw(data: number[], has_alpha: boolean, width: number, height: number, rowstride: number, size: number): Clutter.Actor;
		/**
		 * This function synchronously loads the given file path
		 * into a cairo surface.  On error, a warning is emitted
		 * and %NULL is returned.
		 * @param file A #GFile in supported image format
		 * @param paint_scale Scale factor of the display
		 * @param resource_scale Resource scale factor
		 * @returns a new #cairo_surface_t
		 */
		load_gfile_to_cairo_surface(file: Gio.File, paint_scale: number, resource_scale: number): cairo.Surface;
		/**
		 * This function synchronously loads the given file path
		 * into a COGL texture.  On error, a warning is emitted
		 * and %NULL is returned.
		 * @param file A #GFile in supported image format
		 * @param paint_scale Scale factor of the display
		 * @param resource_scale Resource scale factor
		 * @returns a new #CoglTexture
		 */
		load_gfile_to_cogl_texture(file: Gio.File, paint_scale: number, resource_scale: number): Cogl.Texture;
		/**
		 * This method returns a new #ClutterActor for a given #GIcon. If the
		 * icon isn't loaded already, the texture will be filled
		 * asynchronously.
		 * @param theme_node The {@link ThemeNode} to use for colors, or NULL
		 *                            if the icon must not be recolored
		 * @param icon the #GIcon to load
		 * @param size Size of themed
		 * @returns A new #ClutterActor for the icon, or an empty ClutterActor
		 * if none was found.
		 */
		load_gicon(theme_node: ThemeNode | null, icon: Gio.Icon, size: number): Clutter.Actor;
		/**
		 * This method returns a new #ClutterActor for a given #GIcon. If the
		 * icon isn't loaded already, the texture will be filled
		 * asynchronously.
		 * @param theme_node The {@link ThemeNode} to use for colors, or NULL
		 *                            if the icon must not be recolored
		 * @param icon the #GIcon to load
		 * @param size Size of themed
		 * @param paint_scale Scale factor of display
		 * @param resource_scale Resource scale factor
		 * @returns A new #ClutterActor for the icon, or %NULL if not found
		 */
		load_gicon_with_scale(theme_node: ThemeNode | null, icon: Gio.Icon, size: number, paint_scale: number, resource_scale: number): Clutter.Actor;
		/**
		 * Load a themed icon into a texture. See the {@link IconType} documentation
		 * for an explanation of how #icon_type affects the returned icon. The
		 * colors used for symbolic icons are derived from #theme_node.
		 * @param theme_node a {@link ThemeNode}
		 * @param name Name of a themed icon
		 * @param icon_type the type of icon to load
		 * @param size Size of themed
		 * @returns A new #ClutterTexture for the icon
		 */
		load_icon_name(theme_node: ThemeNode | null, name: string, icon_type: IconType, size: number): Clutter.Actor;
		/**
		 * This function loads an image file into a clutter actor asynchronously.  This is
		 * mostly useful for situations where you want to load an image asynchronously, but don't
		 * want the actor back until it's fully loaded and sized (as opposed to load_uri_async,
		 * which provides no callback function, and leaves size negotiation to its own devices.)
		 * 
		 * The image's aspect ratio is always maintained and if both width and height are > 0
		 * the image will never exceed these dimensions.
		 * @param path Path to a filename
		 * @param width Width in pixels (or -1 to leave unconstrained)
		 * @param height Height in pixels (or -1 to leave unconstrained)
		 * @param callback Function called when the image is loaded (required)
		 * @returns A handle that can be used to verify the actor issued in the callback
		 * is the expected one.
		 */
		load_image_from_file_async(path: string, width: number, height: number, callback: TextureCacheLoadImageCallback): number;
		/**
		 * This function reads a single image file which contains multiple images internally.
		 * The image file will be divided using #grid_width and #grid_height;
		 * note that the dimensions of the image loaded from #path
		 * should be a multiple of the specified grid dimensions.
		 * @param path Path to a filename
		 * @param grid_width Width in pixels
		 * @param grid_height Height in pixels
		 * @param load_callback Function called when the image is loaded, or %NULL
		 * @returns A new #ClutterActor
		 */
		load_sliced_image(path: string, grid_width: number, grid_height: number, load_callback?: GLib.Func | null): Clutter.Actor;
		/**
		 * This function reads a single image file which contains multiple images internally.
		 * The image file will be divided using #grid_width and #grid_height;
		 * note that the dimensions of the image loaded from #path
		 * should be a multiple of the specified grid dimensions.
		 * @param file A #GFile
		 * @param grid_width Width in pixels
		 * @param grid_height Height in pixels
		 * @param paint_scale Scale factor of the display
		 * @param resource_scale
		 * @param load_callback Function called when the image is loaded, or %NULL
		 * @returns A new #ClutterActor
		 */
		load_sliced_image_file(file: Gio.File, grid_width: number, grid_height: number, paint_scale: number, resource_scale: number, load_callback?: GLib.Func | null): Clutter.Actor;
		/**
		 * Asynchronously load an image.   Initially, the returned texture will have a natural
		 * size of zero.  At some later point, either the image will be loaded successfully
		 * and at that point size will be negotiated, or upon an error, no image will be set.
		 * @param uri uri of the image file from which to create a pixbuf
		 * @param available_width available width for the image, can be -1 if not limited
		 * @param available_height available height for the image, can be -1 if not limited
		 * @returns A new #ClutterActor with no image loaded initially.
		 */
		load_uri_async(uri: string, available_width: number, available_height: number): Clutter.Actor;
		rescan_icon_theme(): boolean;
		connect(signal: "icon-theme-changed", callback: (owner: this) => void): number;
		connect(signal: "texture-file-changed", callback: (owner: this, object: Gio.File) => void): number;

	}

	type TextureCacheInitOptionsMixin = GObject.ObjectInitOptions
	export interface TextureCacheInitOptions extends TextureCacheInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TextureCache} instead.
	 */
	type TextureCacheMixin = ITextureCache & GObject.Object;

	interface TextureCache extends TextureCacheMixin {}

	class TextureCache {
		public constructor(options?: Partial<TextureCacheInitOptions>);
		public static get_default(): TextureCache;
		/**
		 * Converts a #GdkPixbuf into a #ClutterTexture.
		 * @param pixbuf A #GdkPixbuf
		 * @param size int
		 * @returns A new #ClutterActor
		 */
		public static load_from_pixbuf(pixbuf: GdkPixbuf.Pixbuf, size: number): Clutter.Actor;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Theme} instead.
	 */
	interface ITheme {
		/**
		 * The highest priority stylesheet, representing application-specific
		 * styling; this is associated with the CSS "author" stylesheet.
		 */
		application_stylesheet: string;
		/**
		 * The lowest priority stylesheet, representing global default
		 * styling; this is associated with the CSS "user agent" stylesheet.
		 */
		default_stylesheet: string;
		/**
		 * Fallback stylesheet - non-cascading.  It is applied only if the user-selected stylesheets
		 * fail to return any properties, and the StWidget has its "important" property set.
		 */
		fallback_stylesheet: string;
		/**
		 * The second priority stylesheet, representing theme-specific styling;
		 * this is associated with the CSS "user" stylesheet.
		 */
		theme_stylesheet: string;
		get_custom_stylesheets(): string[];
		load_stylesheet(path: string): boolean;
		unload_stylesheet(path: string): void;
		connect(signal: "custom-stylesheets-changed", callback: (owner: this) => void): number;

		connect(signal: "notify::application-stylesheet", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default-stylesheet", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::fallback-stylesheet", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::theme-stylesheet", callback: (owner: this, ...args: any) => void): number;

	}

	type ThemeInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<ITheme,
		"application_stylesheet" |
		"default_stylesheet" |
		"fallback_stylesheet" |
		"theme_stylesheet">;

	export interface ThemeInitOptions extends ThemeInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Theme} instead.
	 */
	type ThemeMixin = ITheme & GObject.Object;

	interface Theme extends ThemeMixin {}

	class Theme {
		public constructor(options?: Partial<ThemeInitOptions>);
		public static new(application_stylesheet: string, theme_stylesheet: string, default_stylesheet: string): Theme;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ThemeContext} instead.
	 */
	interface IThemeContext {
		/**
		 * The scaling factor used or high dpi scaling.
		 */
		scale_factor: number;
		/**
		 * Gets the default font for the theme context. See {@link St.ThemeContext.set_font}.
		 * @returns the default font for the theme context.
		 */
		get_font(): Pango.FontDescription;
		/**
		 * Gets the root node of the tree of theme style nodes that associated with this
		 * context. For the node tree associated with a stage, this node represents
		 * styles applied to the stage itself.
		 * @returns the root node of the context's style tree
		 */
		get_root_node(): ThemeNode;
		/**
		 * Gets the default theme for the context. See {@link St.ThemeContext.set_theme}
		 * @returns the default theme for the context
		 */
		get_theme(): Theme;
		/**
		 * Return an existing node matching #node, or if that isn't possible,
		 * #node itself.
		 * @param node a {@link ThemeNode}
		 * @returns a node with the same properties as #node
		 */
		intern_node(node: ThemeNode): ThemeNode;
		/**
		 * Sets the default font for the theme context. This is the font that
		 * is inherited by the root node of the tree of theme nodes. If the
		 * font is not overridden, then this font will be used. If the font is
		 * partially modified (for example, with 'font-size: 110%', then that
		 * modification is based on this font.
		 * @param font the default font for theme context
		 */
		set_font(font: Pango.FontDescription): void;
		/**
		 * Sets the default set of theme stylesheets for the context. This theme will
		 * be used for the root node and for nodes descending from it, unless some other
		 * style is explicitely specified.
		 * @param theme
		 */
		set_theme(theme: Theme): void;
		connect(signal: "changed", callback: (owner: this) => void): number;

		connect(signal: "notify::scale-factor", callback: (owner: this, ...args: any) => void): number;

	}

	type ThemeContextInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IThemeContext,
		"scale_factor">;

	export interface ThemeContextInitOptions extends ThemeContextInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ThemeContext} instead.
	 */
	type ThemeContextMixin = IThemeContext & GObject.Object;

	interface ThemeContext extends ThemeContextMixin {}

	class ThemeContext {
		public constructor(options?: Partial<ThemeContextInitOptions>);
		/**
		 * Create a new theme context not associated with any #ClutterStage.
		 * This can be useful in testing scenarios, or if using StThemeContext
		 * with something other than #ClutterActor objects, but you generally
		 * should use {@link St.ThemeContext.get_for_stage} instead.
		 * @returns 
		 */
		public static new(): ThemeContext;
		/**
		 * Gets a singleton theme context associated with the stage.
		 * @param stage a #ClutterStage
		 * @returns the singleton theme context for the stage
		 */
		public static get_for_stage(stage: Clutter.Stage): ThemeContext;
		public static get_scale_for_stage(): number;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ThemeNode} instead.
	 */
	interface IThemeNode {
		/**
		 * Adjusts a "for height" passed to {@link Clutter.Actor.get_preferred_width} to
		 * account for borders and padding. This is a convenience function meant
		 * to be called from a get_preferred_width() method of a #ClutterActor
		 * subclass. The value after adjustment is the height available for the actor's
		 * content.
		 */
		adjust_for_height(): void;
		/**
		 * Adjusts a "for width" passed to {@link Clutter.Actor.get_preferred_height} to
		 * account for borders and padding. This is a convenience function meant
		 * to be called from a get_preferred_height() method of a #ClutterActor
		 * subclass. The value after adjustment is the width available for the actor's
		 * content.
		 */
		adjust_for_width(): void;
		/**
		 * Adjusts the minimum and natural height computed for an actor by
		 * adding on the necessary space for borders and padding and taking
		 * into account any minimum or maximum height. This is a convenience
		 * function meant to be called from the {@link Get.preferred_height} method
		 * of a #ClutterActor subclass
		 */
		adjust_preferred_height(): void;
		/**
		 * Adjusts the minimum and natural width computed for an actor by
		 * adding on the necessary space for borders and padding and taking
		 * into account any minimum or maximum width. This is a convenience
		 * function meant to be called from the {@link Get.preferred_width} method
		 * of a #ClutterActor subclass
		 */
		adjust_preferred_width(): void;
		/**
		 * Copy cached painting state from #other to #node. This function can be used to
		 * optimize redrawing cached background images when the style on an element changess
		 * in a way that doesn't affect background drawing. This function must only be called
		 * if st_theme_node_paint_equal (node, other) returns %TRUE.
		 * @param other a different {@link ThemeNode}
		 */
		copy_cached_paint_state(other: ThemeNode): void;
		/**
		 * Compare two {@link ThemeNodes}. Two nodes which compare equal will match
		 * the same CSS rules and have the same style properties. However, two
		 * nodes that have ended up with identical style properties do not
		 * necessarily compare equal.
		 * In detail, #node_a and #node_b are considered equal iff
		 * <itemizedlist>
		 *   <listitem>
		 *     <para>they share the same #StTheme and #StThemeContext</para>
		 *   </listitem>
		 *   <listitem>
		 *     <para>they have the same parent</para>
		 *   </listitem>
		 *   <listitem>
		 *     <para>they have the same element type</para>
		 *   </listitem>
		 *   <listitem>
		 *     <para>their id, class, pseudo-class and inline-style match</para>
		 *   </listitem>
		 * </itemizedlist>
		 * @param node_b second {@link ThemeNode}
		 * @returns %TRUE if #node_a equals #node_b
		 */
		equal(node_b: ThemeNode): boolean;
		/**
		 * Tests if two theme nodes have the same borders and padding; this can be
		 * used to optimize having to relayout when the style applied to a Clutter
		 * actor changes colors without changing the geometry.
		 * @param other a different {@link ThemeNode}
		 * @returns 
		 */
		geometry_equal(other: ThemeNode): boolean;
		/**
		 * Returns #node's background bumpmap.
		 * @returns 
		 */
		get_background_bumpmap(): string;
		/**
		 * Returns #node's background color.
		 * @returns location to store the color
		 */
		get_background_color(): Clutter.Color;
		/**
		 * The #start and #end arguments will only be set if #type is not #ST_GRADIENT_NONE.
		 * @returns Type of gradient
		 * 
		 * Color at start of gradient
		 * 
		 * Color at end of gradient
		 */
		get_background_gradient(): [ type: GradientType, start: Clutter.Color, end: Clutter.Color ];
		/**
		 * Returns #node's background image.
		 * @returns 
		 */
		get_background_image(): string;
		/**
		 * Gets the value for the -st-background-image-shadow style property
		 * @returns the node's background image shadow, or %NULL
		 *   if node has no such shadow
		 */
		get_background_image_shadow(): Shadow;
		/**
		 * Gets the box used to paint the actor's background, including the area
		 * occupied by properties which paint outside the actor's assigned allocation.
		 * @param allocation the box allocated to a #ClutterActor
		 * @returns computed box occupied when painting the actor's background
		 */
		get_background_paint_box(allocation: Clutter.ActorBox): Clutter.ActorBox;
		/**
		 * Returns the color of #node's border on #side
		 * @param side a {@link Side}
		 * @returns location to store the color
		 */
		get_border_color(side: Side): Clutter.Color;
		/**
		 * Gets the value for the border-image style property
		 * @returns the border image, or %NULL
		 *   if there is no border image.
		 */
		get_border_image(): BorderImage;
		get_border_radius(corner: Corner): number;
		get_border_width(side: Side): number;
		/**
		 * Gets the value for the box-shadow style property
		 * @returns the node's shadow, or %NULL
		 *   if node has no shadow
		 */
		get_box_shadow(): Shadow;
		/**
		 * Generically looks up a property containing a single color value. When
		 * specific getters (like {@link St.ThemeNode.get_background_color}) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * If #property_name is not found, a warning will be logged and a
		 * default color returned.
		 * 
		 * See also st_theme_node_lookup_color(), which provides more options,
		 * and lets you handle the case where the theme does not specify the
		 * indicated color.
		 * @param property_name The name of the color property
		 * @returns location to store the color that
		 *   was determined.
		 */
		get_color(property_name: string): Clutter.Color;
		/**
		 * Gets the box within an actor's allocation that contents the content
		 * of an actor (excluding borders and padding). This is a convenience function
		 * meant to be used from the allocate() or paint() methods of a #ClutterActor
		 * subclass.
		 * @param allocation the box allocated to a #ClutterAlctor
		 * @returns computed box occupied by the actor's content
		 */
		get_content_box(allocation: Clutter.ActorBox): Clutter.ActorBox;
		/**
		 * Generically looks up a property containing a single numeric value
		 *  without units.
		 * 
		 * See also {@link St.ThemeNode.lookup_double}, which provides more options,
		 * and lets you handle the case where the theme does not specify the
		 * indicated value.
		 * @param property_name The name of the numeric property
		 * @returns the value found. If #property_name is not
		 *  found, a warning will be logged and 0 will be returned.
		 */
		get_double(property_name: string): number;
		get_element_classes(): string[];
		get_element_id(): string;
		get_element_type(): GObject.Type;
		get_font(): Pango.FontDescription;
		get_font_features(): string;
		/**
		 * Returns #node's foreground color.
		 * @returns location to store the color
		 */
		get_foreground_color(): Clutter.Color;
		get_height(): number;
		/**
		 * Gets the total horizonal padding (left + right padding)
		 * @returns the total horizonal padding
		 *   in pixels
		 */
		get_horizontal_padding(): number;
		/**
		 * Gets the colors that should be used for colorizing symbolic icons according
		 * the style of this node.
		 * @returns the icon colors to use for this theme node
		 */
		get_icon_colors(): IconColors;
		get_icon_style(): IconStyle;
		/**
		 * Generically looks up a property containing a single length value. When
		 * specific getters (like {@link St.ThemeNode.get_border_width}) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * Unlike st_theme_node_get_color() and st_theme_node_get_double(),
		 * this does not print a warning if the property is not found; it just
		 * returns 0.
		 * 
		 * See also st_theme_node_lookup_length(), which provides more options.
		 * @param property_name The name of the length property
		 * @returns the length, in pixels, or 0 if the property was not found.
		 */
		get_length(property_name: string): number;
		/**
		 * Gets the value for the letter-spacing style property, in pixels.
		 * @returns the value of the letter-spacing property, if
		 *   found, or zero if such property has not been found.
		 */
		get_letter_spacing(): number;
		get_margin(side: Side): number;
		get_max_height(): number;
		get_max_width(): number;
		get_min_height(): number;
		get_min_width(): number;
		/**
		 * Returns the color of #node's outline.
		 * @returns location to store the color
		 */
		get_outline_color(): Clutter.Color;
		get_outline_width(): number;
		get_padding(side: Side): number;
		/**
		 * Gets the box used to paint the actor, including the area occupied
		 * by properties which paint outside the actor's assigned allocation.
		 * When painting #node to an offscreen buffer, this function can be
		 * used to determine the necessary size of the buffer.
		 * @param allocation the box allocated to a #ClutterActor
		 * @returns computed box occupied when painting the actor
		 */
		get_paint_box(allocation: Clutter.ActorBox): Clutter.ActorBox;
		/**
		 * Gets the parent themed element node.
		 * @returns the parent {@link ThemeNode}, or %NULL if this
		 *  is the root node of the tree of theme elements.
		 */
		get_parent(): ThemeNode;
		get_pseudo_classes(): string[];
		/**
		 * Generically looks up a property containing a set of shadow values. When
		 * specific getters (like {@link St.ThemeNode.get_box_shadow}) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * Like st_theme_get_length(), this does not print a warning if the property is
		 * not found; it just returns %NULL
		 * 
		 * See also st_theme_node_lookup_shadow (), which provides more options.
		 * @param property_name The name of the shadow property
		 * @returns the shadow, or %NULL if the property was not found.
		 */
		get_shadow(property_name: string): Shadow;
		get_text_align(): TextAlign;
		get_text_decoration(): TextDecoration;
		/**
		 * Gets the value for the text-shadow style property
		 * @returns the node's text-shadow, or %NULL
		 *   if node has no text-shadow
		 */
		get_text_shadow(): Shadow;
		/**
		 * Gets the theme stylesheet set that styles this node
		 * @returns the theme stylesheet set
		 */
		get_theme(): Theme;
		/**
		 * Get the value of the transition-duration property, which
		 * specifies the transition time between the previous {@link ThemeNode}
		 * and #node.
		 * @returns the node's transition duration in milliseconds
		 */
		get_transition_duration(): number;
		/**
		 * Gets the total vertical padding (top + bottom padding)
		 * @returns the total vertical padding
		 *   in pixels
		 */
		get_vertical_padding(): number;
		get_width(): number;
		hash(): number;
		/**
		 * Generically looks up a property containing a single color value. When
		 * specific getters (like {@link St.ThemeNode.get_background_color}) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * See also st_theme_node_get_color(), which provides a simpler API.
		 * @param property_name The name of the color property
		 * @param inherit if %TRUE, if a value is not found for the property on the
		 *   node, then it will be looked up on the parent node, and then on the
		 *   parent's parent, and so forth. Note that if the property has a
		 *   value of 'inherit' it will be inherited even if %FALSE is passed
		 *   in for #inherit; this only affects the default behavior for inheritance.
		 * @returns %TRUE if the property was found in the properties for this
		 *  theme node (or in the properties of parent nodes when inheriting.)
		 * 
		 * location to store the color that was
		 *   determined. If the property is not found, the value in this location
		 *   will not be changed.
		 */
		lookup_color(property_name: string, inherit: boolean): [ boolean, Clutter.Color ];
		/**
		 * Generically looks up a property containing a single numeric value
		 *  without units.
		 * 
		 * See also {@link St.ThemeNode.get_double}, which provides a simpler API.
		 * @param property_name The name of the numeric property
		 * @param inherit if %TRUE, if a value is not found for the property on the
		 *   node, then it will be looked up on the parent node, and then on the
		 *   parent's parent, and so forth. Note that if the property has a
		 *   value of 'inherit' it will be inherited even if %FALSE is passed
		 *   in for #inherit; this only affects the default behavior for inheritance.
		 * @returns %TRUE if the property was found in the properties for this
		 *  theme node (or in the properties of parent nodes when inheriting.)
		 * 
		 * location to store the value that was determined.
		 *   If the property is not found, the value in this location
		 *   will not be changed.
		 */
		lookup_double(property_name: string, inherit: boolean): [ boolean, number ];
		/**
		 * Generically looks up a property containing a single length value. When
		 * specific getters (like {@link St.ThemeNode.get_border_width}) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * See also st_theme_node_get_length(), which provides a simpler API.
		 * @param property_name The name of the length property
		 * @param inherit if %TRUE, if a value is not found for the property on the
		 *   node, then it will be looked up on the parent node, and then on the
		 *   parent's parent, and so forth. Note that if the property has a
		 *   value of 'inherit' it will be inherited even if %FALSE is passed
		 *   in for #inherit; this only affects the default behavior for inheritance.
		 * @returns %TRUE if the property was found in the properties for this
		 *  theme node (or in the properties of parent nodes when inheriting.)
		 * 
		 * location to store the length that was determined.
		 *   If the property is not found, the value in this location
		 *   will not be changed. The returned length is resolved
		 *   to pixels.
		 */
		lookup_length(property_name: string, inherit: boolean): [ boolean, number ];
		/**
		 * If the property is not found, the value in the shadow variable will not
		 * be changed.
		 * 
		 * Generically looks up a property containing a set of shadow values. When
		 * specific getters (like st_theme_node_get_box_shadow ()) exist, they
		 * should be used instead. They are cached, so more efficient, and have
		 * handling for shortcut properties and other details of CSS.
		 * 
		 * See also {@link St.ThemeNode.get_shadow}, which provides a simpler API.
		 * @param property_name The name of the shadow property
		 * @param inherit if %TRUE, if a value is not found for the property on the
		 *   node, then it will be looked up on the parent node, and then on the
		 *   parent's parent, and so forth. Note that if the property has a
		 *   value of 'inherit' it will be inherited even if %FALSE is passed
		 *   in for #inherit; this only affects the default behavior for inheritance.
		 * @returns %TRUE if the property was found in the properties for this
		 * theme node (or in the properties of parent nodes when inheriting.), %FALSE
		 * if the property was not found, or was explicitly set to 'none'.
		 * 
		 * location to store the shadow
		 */
		lookup_shadow(property_name: string, inherit: boolean): [ boolean, Shadow ];
		paint(framebuffer: Cogl.Framebuffer, box: Clutter.ActorBox, paint_opacity: number): void;
		/**
		 * Check if {@link St.ThemeNode.paint} will paint identically for #node as it does
		 * for #other. Note that in some cases this function may return %TRUE even
		 * if there is no visible difference in the painting.
		 * @param other a different {@link ThemeNode}
		 * @returns %TRUE if the two theme nodes paint identically. %FALSE if the
		 *   two nodes potentially paint differently.
		 */
		paint_equal(other: ThemeNode): boolean;
	}

	type ThemeNodeInitOptionsMixin = GObject.ObjectInitOptions
	export interface ThemeNodeInitOptions extends ThemeNodeInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ThemeNode} instead.
	 */
	type ThemeNodeMixin = IThemeNode & GObject.Object;

	interface ThemeNode extends ThemeNodeMixin {}

	class ThemeNode {
		public constructor(options?: Partial<ThemeNodeInitOptions>);
		/**
		 * Creates a new {@link ThemeNode}. Once created, a node is immutable. Of any
		 * of the attributes of the node (like the #element_class) change the node
		 * and its child nodes must be destroyed and recreated.
		 * @param context the context representing global state for this themed tree
		 * @param parent_node the parent node of this node
		 * @param theme a theme (stylesheet set) that overrides the
		 *   theme inherited from the parent node
		 * @param element_type the type of the GObject represented by this node
		 *  in the tree (corresponding to an element if we were theming an XML
		 *  document. %G_TYPE_NONE means this style was created for the stage
		 * actor and matches a selector element name of 'stage'.
		 * @param element_id the ID to match CSS rules against
		 * @param element_class a whitespace-separated list of classes
		 *   to match CSS rules against
		 * @param pseudo_class a whitespace-separated list of pseudo-classes
		 *   (like 'hover' or 'visited') to match CSS rules against
		 * @param inline_style
		 * @param important
		 * @returns the theme node
		 */
		public static new(context: ThemeContext, parent_node: ThemeNode | null, theme: Theme | null, element_type: GObject.Type, element_id: string | null, element_class: string | null, pseudo_class: string | null, inline_style: string, important: boolean): ThemeNode;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Viewport} instead.
	 */
	interface IViewport {

	}

	type ViewportInitOptionsMixin = WidgetInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & ScrollableInitOptions
	export interface ViewportInitOptions extends ViewportInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Viewport} instead.
	 */
	type ViewportMixin = IViewport & Widget & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable & Scrollable;

	/**
	 * The {@link Viewport} struct contains only private data
	 */
	interface Viewport extends ViewportMixin {}

	class Viewport {
		public constructor(options?: Partial<ViewportInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Widget} instead.
	 */
	interface IWidget {
		/**
		 * Object instance's name for assistive technology access.
		 */
		accessible_name: string;
		/**
		 * The accessible role of this object
		 */
		accessible_role: Atk.Role;
		/**
		 * Whether or not the widget can be focused via keyboard navigation.
		 */
		can_focus: boolean;
		/**
		 * Whether or not the pointer is currently hovering over the widget. This is
		 * only tracked automatically if {@link Widget.track_hover} is %TRUE, but you can
		 * adjust it manually in any case.
		 */
		hover: boolean;
		/**
		 * Whether or not the fallback theme should be used for lookups in case the user theme fails.
		 */
		important: boolean;
		label_actor: Clutter.Actor;
		/**
		 * The pseudo-class of the actor. Typical values include "hover", "active",
		 * "focus".
		 */
		pseudo_class: string;
		/**
		 * Inline style information for the actor as a ';'-separated list of
		 * CSS properties.
		 */
		style: string;
		/**
		 * The style-class of the actor for use in styling.
		 */
		style_class: string;
		/**
		 * A theme set on this actor overriding the global theming for this actor
		 * and its descendants
		 */
		theme: Theme;
		/**
		 * Determines whether the widget tracks pointer hover state. If
		 * %TRUE (and the widget is visible and reactive), the
		 * {@link Widget.hover} property and "hover" style pseudo class will be
		 * adjusted automatically as the pointer moves in and out of the
		 * widget.
		 */
		track_hover: boolean;
		/**
		 * This method adds #state as one of the accessible states for
		 * #widget. The list of states of a widget describes the current state
		 * of user interface element #widget and is provided so that assistive
		 * technologies know how to present #widget to the user.
		 * 
		 * Usually you will have no need to add accessible states for an
		 * object, as the accessible object can extract most of the states
		 * from the object itself (ie: a {@link Button} knows when it is pressed).
		 * This method is only required when one cannot extract the
		 * information automatically from the object itself (i.e.: a generic
		 * container used as a toggle menu item will not automatically include
		 * the toggled state).
		 * @param state #AtkStateType state to add
		 */
		add_accessible_state(state: Atk.StateType): void;
		/**
		 * Adds #style_class to #actor's style class name list, if it is not
		 * already present.
		 * @param style_class a style class name string
		 */
		add_style_class_name(style_class: string): void;
		/**
		 * Adds #pseudo_class to #actor's pseudo class list, if it is not
		 * already present.
		 * @param pseudo_class a pseudo class string
		 */
		add_style_pseudo_class(pseudo_class: string): void;
		/**
		 * Adds #pseudo_class to #actor's pseudo class list if #add is true,
		 * removes if #add is false.
		 * @param pseudo_class a pseudo class string
		 * @param add whether to add or remove pseudo class
		 */
		change_style_pseudo_class(pseudo_class: string, add: boolean): void;
		/**
		 * @deprecated
		 * Use clutter_actor_destroy_all_children instead
		 * 
		 * Destroys all child actors from #widget.
		 */
		destroy_children(): void;
		/**
		 * Ensures that #widget has read its style information.
		 */
		ensure_style(): void;
		/**
		 * Gets the accessible name for this widget. See
		 * {@link St.Widget.set_accessible_name} for more information.
		 * @returns a character string representing the accessible name
		 * of the widget.
		 */
		get_accessible_name(): string;
		/**
		 * Gets the #AtkRole for this widget. See
		 * {@link St.Widget.set_accessible_role} for more information.
		 * @returns accessible #AtkRole for this widget
		 */
		get_accessible_role(): Atk.Role;
		/**
		 * Returns the current value of the can-focus property. See
		 * {@link St.Widget.set_can_focus} for more information.
		 * @returns current value of can-focus on #widget
		 */
		get_can_focus(): boolean;
		get_direction(): TextDirection;
		/**
		 * Gets a list of the focusable children of #widget, in "Tab"
		 * order. By default, this returns all visible
		 * (as in {@link Clutter.Actor.is_visible}) children of #widget.
		 * @returns 
		 *   #widget's focusable children
		 */
		get_focus_chain(): Clutter.Actor[];
		/**
		 * If {@link Widget.track_hover} is set, this returns whether the pointer
		 * is currently over the widget.
		 * @returns current value of hover on #widget
		 */
		get_hover(): boolean;
		/**
		 * Returns if the #actor is flagged set as important
		 * @returns 
		 */
		get_important(): boolean;
		/**
		 * Gets the label that identifies #widget if it is defined
		 * @returns the label that identifies the widget
		 */
		get_label_actor(): Clutter.Actor;
		/**
		 * Get the current inline style string. See {@link St.Widget.set_style}.
		 * @returns The inline style string, or %NULL. The string is owned by the
		 * {@link Widget} and should not be modified or freed.
		 */
		get_style(): string;
		/**
		 * Get the current style class name
		 * @returns the class name string. The string is owned by the {@link Widget} and
		 * should not be modified or freed.
		 */
		get_style_class_name(): string;
		/**
		 * Get the current style pseudo class list.
		 * 
		 * Note that an actor can have multiple pseudo classes; if you just
		 * want to test for the presence of a specific pseudo class, use
		 * {@link St.Widget.has_style_pseudo_class}.
		 * @returns the pseudo class list string. The string is owned by the
		 * {@link Widget} and should not be modified or freed.
		 */
		get_style_pseudo_class(): string;
		/**
		 * Gets the overriding theme set on the actor. See {@link St.Widget.set_theme}
		 * @returns the overriding theme, or %NULL
		 */
		get_theme(): Theme;
		/**
		 * Gets the theme node holding style information for the widget.
		 * The theme node is used to access standard and custom CSS
		 * properties of the widget.
		 * 
		 * Note: this should only be called on a widget that has been
		 * added to the stage
		 * @returns the theme node for the widget.
		 *   This is owned by the widget. When attributes of the widget
		 *   or the environment that affect the styling change (for example
		 *   the style_class property of the widget), it will be recreated,
		 *   and the ::style-changed signal will be emitted on the widget.
		 */
		get_theme_node(): ThemeNode;
		/**
		 * Returns the current value of the track-hover property. See
		 * {@link St.Widget.set_track_hover} for more information.
		 * @returns current value of track-hover on #widget
		 */
		get_track_hover(): boolean;
		/**
		 * Tests if #actor's style class list includes #style_class.
		 * @param style_class a style class string
		 * @returns whether or not #actor's style class list includes
		 * #style_class.
		 */
		has_style_class_name(style_class: string): boolean;
		/**
		 * Tests if #actor's pseudo class list includes #pseudo_class.
		 * @param pseudo_class a pseudo class string
		 * @returns whether or not #actor's pseudo class list includes
		 * #pseudo_class.
		 */
		has_style_pseudo_class(pseudo_class: string): boolean;
		move_before(actor: Clutter.Actor, sibling: Clutter.Actor): void;
		move_child(actor: Clutter.Actor, pos: number): void;
		/**
		 * Tries to update the keyboard focus within #widget in response to a
		 * keyboard event.
		 * 
		 * If #from is a descendant of #widget, this attempts to move the
		 * keyboard focus to the next descendant of #widget (in the order
		 * implied by #direction) that has the {@link Widget.can_focus} property
		 * set. If #from is %NULL, or outside of #widget, this attempts to
		 * focus either #widget itself, or its first descendant in the order
		 * implied by #direction.
		 * 
		 * If a container type is marked #StWidget:can-focus, the expected
		 * behavior is that it will only take up a single slot on the focus
		 * chain as a whole, rather than allowing navigation between its child
		 * actors (or having a distinction between itself being focused and
		 * one of its children being focused).
		 * 
		 * Some widget classes might have slightly different behavior from the
		 * above, where that would make more sense.
		 * 
		 * If #wrap_around is %TRUE and #from is a child of #widget, but the
		 * widget has no further children that can accept the focus in the
		 * given direction, then {@link St.Widget.navigate_focus} will try a second
		 * time, using a %NULL #from, which should cause it to reset the focus
		 * to the first available widget in the given direction.
		 * @param from the actor that the focus is coming from
		 * @param direction the direction focus is moving in
		 * @param wrap_around whether focus should wrap around
		 * @returns %TRUE if {@link Clutter.Actor.grab_key_focus} has been
		 * called on an actor. %FALSE if not.
		 */
		navigate_focus(from: Clutter.Actor | null, direction: Gtk.DirectionType, wrap_around: boolean): boolean;
		/**
		 * Paint the background of the widget. This is meant to be called by
		 * subclasses of StWiget that need to paint the background without
		 * painting children.
		 * @param paint_context
		 */
		paint_background(paint_context: Clutter.PaintContext): void;
		/**
		 * Returns the theme node for the widget if it has already been
		 * computed, %NULL if the widget hasn't been added to a  stage or the theme
		 * node hasn't been computed. If %NULL is returned, then ::style-changed
		 * will be reliably emitted before the widget is allocated or painted.
		 * @returns the theme node for the widget.
		 *   This is owned by the widget. When attributes of the widget
		 *   or the environment that affect the styling change (for example
		 *   the style_class property of the widget), it will be recreated,
		 *   and the ::style-changed signal will be emitted on the widget.
		 */
		peek_theme_node(): ThemeNode;
		/**
		 * Asks the widget to pop-up a context menu.
		 */
		popup_menu(): void;
		/**
		 * This method removes #state as on of the accessible states for
		 * #widget. See {@link St.Widget.add_accessible_state} for more information.
		 * @param state #AtkState state to remove
		 */
		remove_accessible_state(state: Atk.StateType): void;
		/**
		 * Removes #style_class from #actor's style class name, if it is
		 * present.
		 * @param style_class a style class name string
		 */
		remove_style_class_name(style_class: string): void;
		/**
		 * Removes #pseudo_class from #actor's pseudo class, if it is present.
		 * @param pseudo_class a pseudo class string
		 */
		remove_style_pseudo_class(pseudo_class: string): void;
		/**
		 * This method allows to set a customly created accessible object to
		 * this widget. For example if you define a new subclass of
		 * {@link WidgetAccessible} at the javascript code.
		 * 
		 * NULL is a valid value for #accessible. That contemplates the
		 * hypothetical case of not needing anymore a custom accessible object
		 * for the widget. Next call of {@link St.Widget.get_accessible} would
		 * create and return a default accessible.
		 * 
		 * It assumes that the call to atk_object_initialize that bound the
		 * gobject with the custom accessible object was already called, so
		 * not a responsibility of this method.
		 * @param accessible an accessible (#AtkObject)
		 */
		set_accessible(accessible: Atk.Object): void;
		/**
		 * This method sets #name as the accessible name for #widget.
		 * 
		 * Usually you will have no need to set the accessible name for an
		 * object, as usually there is a label for most of the interface
		 * elements. So in general it is better to just use
		 * #st_widget_set_label_actor. This method is only required when you
		 * need to set an accessible name and there is no available label
		 * object.
		 * @param name a character string to be set as the accessible name
		 */
		set_accessible_name(name?: string | null): void;
		/**
		 * This method sets #role as the accessible role for #widget. This
		 * role describes what kind of user interface element #widget is and
		 * is provided so that assistive technologies know how to present
		 * #widget to the user.
		 * 
		 * Usually you will have no need to set the accessible role for an
		 * object, as this information is extracted from the context of the
		 * object (ie: a {@link Button} has by default a push button role). This
		 * method is only required when you need to redefine the role
		 * currently associated with the widget, for instance if it is being
		 * used in an unusual way (ie: a #StButton used as a togglebutton), or
		 * if a generic object is used directly (ie: a container as a menu
		 * item).
		 * 
		 * If #role is #ATK_ROLE_INVALID, the role will not be changed
		 * and the accessible's default role will be used instead.
		 * @param role The role to use
		 */
		set_accessible_role(role: Atk.Role): void;
		/**
		 * Marks #widget as being able to receive keyboard focus via
		 * keyboard navigation.
		 * @param can_focus %TRUE if the widget can receive keyboard focus
		 *   via keyboard navigation
		 */
		set_can_focus(can_focus: boolean): void;
		set_direction(dir: TextDirection): void;
		/**
		 * Sets #widget's hover property and adds or removes "hover" from its
		 * pseudo class accordingly
		 * 
		 * If you have set {@link Widget.track_hover}, you should not need to call
		 * this directly. You can call {@link St.Widget.sync_hover} if the hover
		 * state might be out of sync due to another actor's pointer grab.
		 * @param hover whether the pointer is hovering over the widget
		 */
		set_hover(hover: boolean): void;
		/**
		 * When an actor is set to important, and the active theme does not
		 * account for it, a fallback lookup is made to the default cinnamon theme
		 * which (presumably) will always have support for all stock elements
		 * of the desktop.
		 * 
		 * This property is inherited by the actor's children.
		 * @param important whether the actor is to be considered important.
		 */
		set_important(important: boolean): void;
		/**
		 * Sets #label as the #ClutterActor that identifies (labels)
		 * #widget. #label can be %NULL to indicate that #widget is not
		 * labelled any more
		 * @param label a #ClutterActor
		 */
		set_label_actor(label: Clutter.Actor): void;
		/**
		 * Set the inline style string for this widget. The inline style string is an
		 * optional ';'-separated list of CSS properties that override the style as
		 * determined from the stylesheets of the current theme.
		 * @param style a inline style string, or %NULL
		 */
		set_style(style?: string | null): void;
		/**
		 * Set the style class name list. #style_class_list can either be
		 * %NULL, for no classes, or a space-separated list of style class
		 * names. See also {@link St.Widget.add_style_class_name} and
		 * st_widget_remove_style_class_name().
		 * @param style_class_list a new style class list string
		 */
		set_style_class_name(style_class_list?: string | null): void;
		/**
		 * Set the style pseudo class list. #pseudo_class_list can either be
		 * %NULL, for no classes, or a space-separated list of pseudo class
		 * names. See also {@link St.Widget.add_style_pseudo_class} and
		 * st_widget_remove_style_pseudo_class().
		 * @param pseudo_class_list a new pseudo class list string
		 */
		set_style_pseudo_class(pseudo_class_list?: string | null): void;
		/**
		 * Overrides the theme that would be inherited from the actor's parent
		 * or the stage with an entirely new theme (set of stylesheets).
		 * @param theme a new style class string
		 */
		set_theme(theme: Theme): void;
		/**
		 * Enables hover tracking on the {@link Widget}.
		 * 
		 * If hover tracking is enabled, and the widget is visible and
		 * reactive, then #widget's #StWidget:hover property will be updated
		 * automatically to reflect whether the pointer is in #widget (or one
		 * of its children), and #widget's #StWidget:pseudo-class will have
		 * the "hover" class added and removed from it accordingly.
		 * 
		 * Note that currently it is not possible to correctly track the hover
		 * state when another actor has a pointer grab. You can use
		 * {@link St.Widget.sync_hover} to update the property manually in this
		 * case.
		 * @param track_hover %TRUE if the widget should track the pointer hover state
		 */
		set_track_hover(track_hover: boolean): void;
		style_changed(): void;
		/**
		 * Sets #widget's hover state according to the current pointer
		 * position. This can be used to ensure that it is correct after
		 * (or during) a pointer grab.
		 */
		sync_hover(): void;
		/**
		 * Emitted when the user has requested a context menu (eg, via a
		 * keybinding)
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "popup-menu", callback: (owner: this) => void): number;
		/**
		 * Emitted when the style information that the widget derives from the
		 * theme changes
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "style-changed", callback: (owner: this) => void): number;

		connect(signal: "notify::accessible-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::accessible-role", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::can-focus", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::hover", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::important", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::label-actor", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pseudo-class", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::style", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::style-class", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::theme", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::track-hover", callback: (owner: this, ...args: any) => void): number;

	}

	type WidgetInitOptionsMixin = Clutter.ActorInitOptions & Atk.ImplementorIfaceInitOptions & Clutter.AnimatableInitOptions & Clutter.ContainerInitOptions & Clutter.ScriptableInitOptions & 
	Pick<IWidget,
		"accessible_name" |
		"accessible_role" |
		"can_focus" |
		"hover" |
		"important" |
		"label_actor" |
		"pseudo_class" |
		"style" |
		"style_class" |
		"theme" |
		"track_hover">;

	export interface WidgetInitOptions extends WidgetInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Widget} instead.
	 */
	type WidgetMixin = IWidget & Clutter.Actor & Atk.ImplementorIface & Clutter.Animatable & Clutter.Container & Clutter.Scriptable;

	/**
	 * Base class for stylable actors. The contents of the {@link Widget}
	 * structure are private and should only be accessed through the
	 * public API.
	 */
	interface Widget extends WidgetMixin {}

	class Widget {
		public constructor(options?: Partial<WidgetInitOptions>);
		public static get_default_direction(): TextDirection;
		public static set_default_direction(dir: TextDirection): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WidgetAccessible} instead.
	 */
	interface IWidgetAccessible {

	}

	type WidgetAccessibleInitOptionsMixin = Atk.GObjectAccessibleInitOptions & Atk.ActionInitOptions & Atk.ComponentInitOptions
	export interface WidgetAccessibleInitOptions extends WidgetAccessibleInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WidgetAccessible} instead.
	 */
	type WidgetAccessibleMixin = IWidgetAccessible & Atk.GObjectAccessible & Atk.Action & Atk.Component;

	interface WidgetAccessible extends WidgetAccessibleMixin {}

	class WidgetAccessible {
		public constructor(options?: Partial<WidgetAccessibleInitOptions>);
	}

	export interface IconColorsInitOptions {}
	/**
	 * The {@link IconColors} structure encapsulates colors for colorizing a symbolic
	 * icon.
	 */
	interface IconColors {}
	class IconColors {
		public constructor(options?: Partial<IconColorsInitOptions>);
		/**
		 * Creates a new {@link IconColors}. All colors are initialized to transparent black.
		 * @returns a newly created {@link IconColors}. Free with {@link St.IconColors.unref}
		 */
		public static new(): IconColors;
		public ref_count: number;
		/**
		 * foreground color
		 */
		public foreground: Clutter.Color;
		/**
		 * color indicating a warning state
		 */
		public warning: Clutter.Color;
		/**
		 * color indicating an error state
		 */
		public error: Clutter.Color;
		/**
		 * color indicating a successful operation
		 */
		public success: Clutter.Color;
		/**
		 * Creates a new StIconColors structure that is a copy of the passed
		 * in #colors. You would use this function instead of {@link St.IconColors.ref}
		 * if you were planning to change colors in the result.
		 * @returns a newly created {@link IconColors}.
		 */
		public copy(): IconColors;
		/**
		 * Atomically increments the reference count of #colors by one.
		 * @returns the passed in {@link IconColors}.
		 */
		public ref(): IconColors;
		/**
		 * Atomically decrements the reference count of #colors by one.
		 * If the reference count drops to 0, all memory allocated by the
		 * {@link IconColors} is released.
		 */
		public unref(): void;
	}

	export interface ScrollableInterfaceInitOptions {}
	interface ScrollableInterface {}
	class ScrollableInterface {
		public constructor(options?: Partial<ScrollableInterfaceInitOptions>);
		public set_adjustments: {(scrollable: Scrollable, hadjustment: Adjustment, vadjustment: Adjustment): void;};
		public get_adjustments: {(scrollable: Scrollable, hadjustment: Adjustment, vadjustment: Adjustment): void;};
	}

	export interface ShadowInitOptions {}
	/**
	 * Attributes of the -st-shadow property.
	 */
	interface Shadow {}
	class Shadow {
		public constructor(options?: Partial<ShadowInitOptions>);
		/**
		 * Creates a new {@link Shadow}
		 * @param color shadow's color
		 * @param xoffset horizontal offset
		 * @param yoffset vertical offset
		 * @param blur blur radius
		 * @param spread spread radius
		 * @param inset whether the shadow should be inset
		 * @returns the newly allocated shadow. Use {@link St.Shadow.free} when done
		 */
		public static new(color: Clutter.Color, xoffset: number, yoffset: number, blur: number, spread: number, inset: boolean): Shadow;
		/**
		 * shadow's color
		 */
		public color: Clutter.Color;
		/**
		 * horizontal offset - positive values mean placement to the right,
		 *           negative values placement to the left of the element.
		 */
		public xoffset: number;
		/**
		 * vertical offset - positive values mean placement below, negative
		 *           values placement above the element.
		 */
		public yoffset: number;
		/**
		 * shadow's blur radius - a value of 0.0 will result in a hard shadow.
		 */
		public blur: number;
		/**
		 * shadow's spread radius - grow the shadow without enlarging the
		 *           blur.
		 */
		public spread: number;
		public inset: boolean;
		public ref_count: number;
		/**
		 * Check if two shadow objects are identical. Note that two shadows may
		 * compare non-identically if they differ only by floating point rounding
		 * errors.
		 * @param other a different {@link Shadow}
		 * @returns %TRUE if the two shadows are identical
		 */
		public equal(other: Shadow): boolean;
		/**
		 * Gets the box used to paint #shadow, which will be partly
		 * outside of #actor_box
		 * @param actor_box the box allocated to a #ClutterAlctor
		 * @param shadow_box computed box occupied by #shadow
		 */
		public get_box(actor_box: Clutter.ActorBox, shadow_box: Clutter.ActorBox): void;
		/**
		 * Atomically increments the reference count of #shadow by one.
		 * @returns the passed in {@link Shadow}.
		 */
		public ref(): Shadow;
		/**
		 * Atomically decrements the reference count of #shadow by one.
		 * If the reference count drops to 0, all memory allocated by the
		 * {@link Shadow} is released.
		 */
		public unref(): void;
	}

	export interface ShadowHelperInitOptions {}
	interface ShadowHelper {}
	class ShadowHelper {
		public constructor(options?: Partial<ShadowHelperInitOptions>);
		/**
		 * Builds a {@link ShadowHelper} that will build a drop shadow
		 * using #source as the mask.
		 * @param shadow a {@link Shadow} representing the shadow properties
		 * @returns a new {@link ShadowHelper}
		 */
		public static new(shadow: Shadow): ShadowHelper;
		public copy(): ShadowHelper;
		/**
		 * Free resources associated with #helper.
		 */
		public free(): void;
		/**
		 * Paints the shadow associated with #helper This must only
		 * be called from the implementation of ClutterActor::paint().
		 * @param framebuffer a #CoglFramebuffer
		 * @param actor_box the bounding box of the shadow
		 * @param paint_opacity the opacity at which the shadow is painted
		 */
		public paint(framebuffer: Cogl.Framebuffer, actor_box: Clutter.ActorBox, paint_opacity: number): void;
		public update(source: Clutter.Actor): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Scrollable} instead.
	 */
	interface IScrollable {
		hadjustment: Adjustment;
		vadjustment: Adjustment;
		get_adjustments(hadjustment: Adjustment, vadjustment: Adjustment): void;
		set_adjustments(hadjustment: Adjustment, vadjustment: Adjustment): void;
		connect(signal: "notify::hadjustment", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::vadjustment", callback: (owner: this, ...args: any) => void): number;

	}

	type ScrollableInitOptionsMixin = Pick<IScrollable,
		"hadjustment" |
		"vadjustment">;

	export interface ScrollableInitOptions extends ScrollableInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Scrollable} instead.
	 */
	type ScrollableMixin = IScrollable;

	interface Scrollable extends ScrollableMixin {}

	class Scrollable {
		public constructor(options?: Partial<ScrollableInitOptions>);
	}



	enum Align {
		START = 0,
		MIDDLE = 1,
		END = 2
	}

	enum BackgroundSize {
		AUTO = 0,
		CONTAIN = 1,
		COVER = 2,
		FIXED = 3
	}

	enum ClipboardType {
		PRIMARY = 0,
		CLIPBOARD = 1
	}

	enum Corner {
		TOPLEFT = 0,
		TOPRIGHT = 1,
		BOTTOMRIGHT = 2,
		BOTTOMLEFT = 3
	}

	enum GradientType {
		NONE = 0,
		VERTICAL = 1,
		HORIZONTAL = 2,
		RADIAL = 3
	}

	enum IconStyle {
		REQUESTED = 0,
		REGULAR = 1,
		SYMBOLIC = 2
	}

	enum IconType {
		SYMBOLIC = 0,
		FULLCOLOR = 1,
		APPLICATION = 2,
		DOCUMENT = 3
	}

	enum PolicyType {
		ALWAYS = 0,
		AUTOMATIC = 1,
		NEVER = 2,
		EXTERNAL = 3
	}

	enum Side {
		TOP = 0,
		RIGHT = 1,
		BOTTOM = 2,
		LEFT = 3
	}

	enum TextAlign {
		LEFT = 0,
		CENTER = 1,
		RIGHT = 2,
		JUSTIFY = 3
	}

	enum TextDirection {
		NONE = 0,
		LTR = 1,
		RTL = 2
	}

	enum TextureCachePolicy {
		NONE = 0,
		FOREVER = 1
	}

	/**
	 * A mask representing which mouse buttons an StButton responds to.
	 */
	enum ButtonMask {
		/**
		 * button 1 (left)
		 */
		ONE = 1,
		/**
		 * button 2 (middle)
		 */
		TWO = 2,
		/**
		 * button 3 (right)
		 */
		THREE = 4
	}

	/**
	 * Denotes the child properties an StTable child will have.
	 */
	enum TableChildOptions {
		/**
		 * whether to respect the widget's aspect ratio
		 */
		KEEP_ASPECT_RATIO = 1,
		/**
		 * whether to allocate extra space on the widget's x-axis
		 */
		X_EXPAND = 2,
		/**
		 * whether to allocate extra space on the widget's y-axis
		 */
		Y_EXPAND = 4,
		/**
		 * whether to stretch the child to fill the cell horizontally
		 */
		X_FILL = 8,
		/**
		 * whether to stretch the child to fill the cell vertically
		 */
		Y_FILL = 16
	}

	enum TextDecoration {
		UNDERLINE = 1,
		OVERLINE = 2,
		LINE_THROUGH = 4,
		BLINK = 8
	}

	/**
	 * Callback function called when text is retrieved from the clipboard.
	 */
	interface ClipboardCallbackFunc {
		/**
		 * Callback function called when text is retrieved from the clipboard.
		 * @param clipboard A {@link Clipboard}
		 * @param text text from the clipboard
		 */
		(clipboard: Clipboard, text: string): void;
	}

	/**
	 * Callback from st_texture_cache_load_image_from_file_async. The handle should match
	 * the one returned by _load_image_from_file_async.
	 */
	interface TextureCacheLoadImageCallback {
		/**
		 * Callback from st_texture_cache_load_image_from_file_async. The handle should match
		 * the one returned by _load_image_from_file_async.
		 * @param cache a {@link TextureCache}
		 * @param handle the handle returned to the caller in the original call.
		 * @param actor the actor containing the loaded image
		 */
		(cache: TextureCache, handle: number, actor: Clutter.Actor): void;
	}

	/**
	 * See {@link St.TextureCache.load}.  Implementations should return a
	 * texture handle for the given key, or set #error.
	 */
	interface TextureCacheLoader {
		/**
		 * See {@link St.TextureCache.load}.  Implementations should return a
		 * texture handle for the given key, or set #error.
		 * @param cache a {@link TextureCache}
		 * @param key Unique identifier for this texture
		 * @param data Callback user data
		 * @returns 
		 */
		(cache: TextureCache, key: string, data?: any | null): Cogl.Texture;
	}

	/**
	 * Creates a string describing #actor, for use in debugging. This
	 * includes the class name and actor name (if any), plus if #actor
	 * is an {@link Widget}, its style class and pseudo class names.
	 * @param actor a #ClutterActor
	 * @returns the debug name.
	 */
	function describe_actor(actor: Clutter.Actor): string;
	function get_slow_down_factor(): number;
	/**
	 * Set a global factor applied to all animation durations
	 * @param factor new slow-down factor
	 */
	function set_slow_down_factor(factor: number): void;
	const PARAM_READABLE: number;

	const PARAM_READWRITE: number;

	const PARAM_WRITABLE: number;

}