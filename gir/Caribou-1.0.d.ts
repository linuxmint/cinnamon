/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.Caribou {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DisplayAdapter} instead.
	 */
	interface IDisplayAdapter {
		display: Gdk.Display;
		keyval_press(keyval: number): void;
		keyval_release(keyval: number): void;
		mod_lock(mask: number): void;
		mod_unlock(mask: number): void;
		mod_latch(mask: number): void;
		mod_unlatch(mask: number): void;
		get_current_group(): [ number, string, string ];
		get_groups(): [ string[], number, string[], number ];
		register_key_func(keyval: number, func: Caribou.KeyButtonCallback | null, func_target: any | null): void;
		register_button_func(button: number, func: Caribou.KeyButtonCallback | null, func_target: any | null): void;
		get_display(): Gdk.Display;
		connect(signal: "modifiers-changed", callback: (owner: this, modifiers: number) => void): number;
		connect(signal: "group-changed", callback: (owner: this, gid: number, group: string, variant: string) => void): number;
		connect(signal: "config-changed", callback: (owner: this) => void): number;

		connect(signal: "notify::display", callback: (owner: this, ...args: any) => void): number;

	}

	type DisplayAdapterInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IDisplayAdapter,
		"display">;

	export interface DisplayAdapterInitOptions extends DisplayAdapterInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DisplayAdapter} instead.
	 */
	type DisplayAdapterMixin = IDisplayAdapter & GObject.Object;

	interface DisplayAdapter extends DisplayAdapterMixin {}

	class DisplayAdapter {
		public constructor(options?: Partial<DisplayAdapterInitOptions>);
		public static set_default(adapter: Caribou.DisplayAdapter): boolean;
		public static get_default(): Caribou.DisplayAdapter;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link NullAdapter} instead.
	 */
	interface INullAdapter {

	}

	type NullAdapterInitOptionsMixin = Caribou.DisplayAdapterInitOptions
	export interface NullAdapterInitOptions extends NullAdapterInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link NullAdapter} instead.
	 */
	type NullAdapterMixin = INullAdapter & Caribou.DisplayAdapter;

	interface NullAdapter extends NullAdapterMixin {}

	class NullAdapter {
		public constructor(options?: Partial<NullAdapterInitOptions>);
		public static new(): Caribou.NullAdapter;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link XAdapter} instead.
	 */
	interface IXAdapter {

	}

	type XAdapterInitOptionsMixin = Caribou.DisplayAdapterInitOptions
	export interface XAdapterInitOptions extends XAdapterInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link XAdapter} instead.
	 */
	type XAdapterMixin = IXAdapter & Caribou.DisplayAdapter;

	interface XAdapter extends XAdapterMixin {}

	class XAdapter {
		public constructor(options?: Partial<XAdapterInitOptions>);
		public static new(): Caribou.XAdapter;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyboardModel} instead.
	 */
	interface IKeyboardModel {
		active_group: string;
		keyboard_type: string;
		keyboard_file: string;
		get_groups(): [ string[], number ];
		get_group(group_name: string): Caribou.GroupModel;
		get_active_group(): string;
		get_keyboard_type(): string;
		get_keyboard_file(): string;
		connect(signal: "group-added", callback: (owner: this, name: string) => void): number;
		connect(signal: "group-removed", callback: (owner: this, name: string) => void): number;

		connect(signal: "notify::active-group", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::keyboard-type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::keyboard-file", callback: (owner: this, ...args: any) => void): number;

	}

	type KeyboardModelInitOptionsMixin = GObject.ObjectInitOptions & Caribou.IKeyboardObjectInitOptions & 
	Pick<IKeyboardModel,
		"active_group" |
		"keyboard_type" |
		"keyboard_file">;

	export interface KeyboardModelInitOptions extends KeyboardModelInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyboardModel} instead.
	 */
	type KeyboardModelMixin = IKeyboardModel & GObject.Object & Caribou.IKeyboardObject;

	interface KeyboardModel extends KeyboardModelMixin {}

	class KeyboardModel {
		public constructor(options?: Partial<KeyboardModelInitOptions>);
		public static new(): Caribou.KeyboardModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyboardService} instead.
	 */
	interface IKeyboardService {
		set_cursor_location(x: number, y: number, w: number, h: number): void;
		set_entry_location(x: number, y: number, w: number, h: number): void;
		show(timestamp: number): void;
		hide(timestamp: number): void;
		register_keyboard(name: string): void;
		name_lost(name: string): void;
	}

	type KeyboardServiceInitOptionsMixin = GObject.ObjectInitOptions
	export interface KeyboardServiceInitOptions extends KeyboardServiceInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyboardService} instead.
	 */
	type KeyboardServiceMixin = IKeyboardService & GObject.Object;

	interface KeyboardService extends KeyboardServiceMixin {}

	class KeyboardService {
		public constructor(options?: Partial<KeyboardServiceInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GroupModel} instead.
	 */
	interface IGroupModel {
		active_level: string;
		readonly group: string;
		readonly variant: string;
		get_levels(): [ string[], number ];
		get_level(level_name: string): Caribou.LevelModel;
		get_active_level(): string;
		connect(signal: "notify::active-level", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::group", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::variant", callback: (owner: this, ...args: any) => void): number;

	}

	type GroupModelInitOptionsMixin = GObject.ObjectInitOptions & Caribou.IKeyboardObjectInitOptions & 
	Pick<IGroupModel,
		"active_level">;

	export interface GroupModelInitOptions extends GroupModelInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GroupModel} instead.
	 */
	type GroupModelMixin = IGroupModel & GObject.Object & Caribou.IKeyboardObject;

	interface GroupModel extends GroupModelMixin {}

	class GroupModel {
		public constructor(options?: Partial<GroupModelInitOptions>);
		public static new(group: string, variant: string): Caribou.GroupModel;
		public static create_group_name(group: string, variant: string): string;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link LevelModel} instead.
	 */
	interface ILevelModel {
		mode: string;
		get_rows(): [ Caribou.RowModel[], number ];
		get_mode(): string;
		connect(signal: "level-toggled", callback: (owner: this, new_level: string) => void): number;

		connect(signal: "notify::mode", callback: (owner: this, ...args: any) => void): number;

	}

	type LevelModelInitOptionsMixin = Caribou.ScannableGroupInitOptions & Caribou.IKeyboardObjectInitOptions & 
	Pick<ILevelModel,
		"mode">;

	export interface LevelModelInitOptions extends LevelModelInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link LevelModel} instead.
	 */
	type LevelModelMixin = ILevelModel & Caribou.ScannableGroup & Caribou.IKeyboardObject;

	interface LevelModel extends LevelModelMixin {}

	class LevelModel {
		public constructor(options?: Partial<LevelModelInitOptions>);
		public static new(mode: string): Caribou.LevelModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RowModel} instead.
	 */
	interface IRowModel {
		get_columns(): [ Caribou.ColumnModel[], number ];
	}

	type RowModelInitOptionsMixin = Caribou.ScannableGroupInitOptions & Caribou.IScannableItemInitOptions & Caribou.IKeyboardObjectInitOptions
	export interface RowModelInitOptions extends RowModelInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RowModel} instead.
	 */
	type RowModelMixin = IRowModel & Caribou.ScannableGroup & Caribou.IScannableItem & Caribou.IKeyboardObject;

	interface RowModel extends RowModelMixin {}

	class RowModel {
		public constructor(options?: Partial<RowModelInitOptions>);
		public static new(): Caribou.RowModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyModel} instead.
	 */
	interface IKeyModel {
		align: string;
		width: number;
		toggle: string;
		repeatable: boolean;
		is_modifier: boolean;
		show_subkeys: boolean;
		name: string;
		keyval: number;
		text: string;
		label: string;
		readonly modifier_state: Caribou.ModifierState;
		press(): void;
		release(): void;
		get_extended_keys(): [ Caribou.KeyModel[], number ];
		activate(): void;
		get_align(): string;
		set_align(value: string): void;
		get_width(): number;
		set_width(value: number): void;
		get_toggle(): string;
		set_toggle(value: string): void;
		get_repeatable(): boolean;
		set_repeatable(value: boolean): void;
		get_is_modifier(): boolean;
		set_is_modifier(value: boolean): void;
		get_show_subkeys(): boolean;
		get_name(): string;
		get_keyval(): number;
		get_text(): string | null;
		get_label(): string;
		set_label(value: string): void;
		connect(signal: "key-hold-end", callback: (owner: this) => void): number;
		connect(signal: "key-hold", callback: (owner: this) => void): number;

		connect(signal: "notify::align", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::width", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::toggle", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::repeatable", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::is-modifier", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::show-subkeys", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::keyval", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::text", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::label", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::modifier_state", callback: (owner: this, ...args: any) => void): number;

	}

	type KeyModelInitOptionsMixin = GObject.ObjectInitOptions & Caribou.IScannableItemInitOptions & Caribou.IKeyboardObjectInitOptions & 
	Pick<IKeyModel,
		"align" |
		"width" |
		"toggle" |
		"repeatable" |
		"is_modifier" |
		"show_subkeys" |
		"name" |
		"keyval" |
		"text" |
		"label">;

	export interface KeyModelInitOptions extends KeyModelInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link KeyModel} instead.
	 */
	type KeyModelMixin = IKeyModel & GObject.Object & Caribou.IScannableItem & Caribou.IKeyboardObject;

	interface KeyModel extends KeyModelMixin {}

	class KeyModel {
		public constructor(options?: Partial<KeyModelInitOptions>);
		public static new(name: string, text: string | null): Caribou.KeyModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ColumnModel} instead.
	 */
	interface IColumnModel {
		get_key(index: number): Caribou.KeyModel;
		first_key(): Caribou.KeyModel;
	}

	type ColumnModelInitOptionsMixin = Caribou.ScannableGroupInitOptions & Caribou.IScannableItemInitOptions & Caribou.IKeyboardObjectInitOptions
	export interface ColumnModelInitOptions extends ColumnModelInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ColumnModel} instead.
	 */
	type ColumnModelMixin = IColumnModel & Caribou.ScannableGroup & Caribou.IScannableItem & Caribou.IKeyboardObject;

	interface ColumnModel extends ColumnModelMixin {}

	class ColumnModel {
		public constructor(options?: Partial<ColumnModelInitOptions>);
		public static new(): Caribou.ColumnModel;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Scanner} instead.
	 */
	interface IScanner {
		bind_settings: boolean;
		scan_grouping: number;
		scan_enabled: boolean;
		step_time: number;
		switch_device: string;
		keyboard_key: string;
		mouse_button: number;
		scan_cycles: number;
		autorestart: boolean;
		inverse_scanning: boolean;
		set_keyboard(keyboard: Caribou.KeyboardModel): void;
		reset(): void;
		get_bind_settings(): boolean;
		get_scan_grouping(): number;
		set_scan_grouping(value: number): void;
		get_scan_enabled(): boolean;
		set_scan_enabled(value: boolean): void;
		get_step_time(): number;
		set_step_time(value: number): void;
		get_switch_device(): string;
		set_switch_device(value: string): void;
		get_keyboard_key(): string;
		set_keyboard_key(value: string): void;
		get_mouse_button(): number;
		set_mouse_button(value: number): void;
		get_scan_cycles(): number;
		set_scan_cycles(value: number): void;
		get_autorestart(): boolean;
		set_autorestart(value: boolean): void;
		get_inverse_scanning(): boolean;
		set_inverse_scanning(value: boolean): void;
		connect(signal: "notify::bind-settings", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::scan-grouping", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::scan-enabled", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::step-time", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::switch-device", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::keyboard-key", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::mouse-button", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::scan-cycles", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::autorestart", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::inverse-scanning", callback: (owner: this, ...args: any) => void): number;

	}

	type ScannerInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IScanner,
		"bind_settings" |
		"scan_grouping" |
		"scan_enabled" |
		"step_time" |
		"switch_device" |
		"keyboard_key" |
		"mouse_button" |
		"scan_cycles" |
		"autorestart" |
		"inverse_scanning">;

	export interface ScannerInitOptions extends ScannerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Scanner} instead.
	 */
	type ScannerMixin = IScanner & GObject.Object;

	interface Scanner extends ScannerMixin {}

	class Scanner {
		public constructor(options?: Partial<ScannerInitOptions>);
		public static new(): Caribou.Scanner;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScannableGroup} instead.
	 */
	interface IScannableGroup {
		get_scan_children(): [ Caribou.IScannableItem[], number ];
		child_select(): Caribou.IScannableItem | null;
	}

	type ScannableGroupInitOptionsMixin = GObject.ObjectInitOptions & Caribou.IScannableGroupInitOptions
	export interface ScannableGroupInitOptions extends ScannableGroupInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ScannableGroup} instead.
	 */
	type ScannableGroupMixin = IScannableGroup & GObject.Object & Caribou.IScannableGroup;

	interface ScannableGroup extends ScannableGroupMixin {}

	class ScannableGroup {
		public constructor(options?: Partial<ScannableGroupInitOptions>);
	}

	export interface IScannableItemIfaceInitOptions {}
	interface IScannableItemIface {}
	class IScannableItemIface {
		public constructor(options?: Partial<IScannableItemIfaceInitOptions>);
		public readonly parent_iface: GObject.TypeInterface;
		public get_scan_stepping: {(self: Caribou.IScannableItem): boolean;};
		public set_scan_stepping: {(self: Caribou.IScannableItem, value: boolean): void;};
		public get_scan_selected: {(self: Caribou.IScannableItem): boolean;};
		public set_scan_selected: {(self: Caribou.IScannableItem, value: boolean): void;};
	}

	export interface IScannableGroupIfaceInitOptions {}
	interface IScannableGroupIface {}
	class IScannableGroupIface {
		public constructor(options?: Partial<IScannableGroupIfaceInitOptions>);
		public readonly parent_iface: GObject.TypeInterface;
		public child_select: {(self: Caribou.IScannableGroup): Caribou.IScannableItem | null;};
		public scan_reset: {(self: Caribou.IScannableGroup): void;};
		public get_scan_children: {(self: Caribou.IScannableGroup): [ Caribou.IScannableItem[], number ];};
		public child_step: {(self: Caribou.IScannableGroup, cycles: number): Caribou.IScannableItem | null;};
		public get_step_path: {(self: Caribou.IScannableGroup): [ Caribou.IScannableItem[], number ];};
		public get_selected_path: {(self: Caribou.IScannableGroup): [ Caribou.IScannableItem[], number ];};
		public get_scan_grouping: {(self: Caribou.IScannableGroup): Caribou.ScanGrouping;};
		public set_scan_grouping: {(self: Caribou.IScannableGroup, value: Caribou.ScanGrouping): void;};
	}

	export interface IKeyboardObjectIfaceInitOptions {}
	interface IKeyboardObjectIface {}
	class IKeyboardObjectIface {
		public constructor(options?: Partial<IKeyboardObjectIfaceInitOptions>);
		public readonly parent_iface: GObject.TypeInterface;
		public get_children: {(self: Caribou.IKeyboardObject): [ Caribou.IKeyboardObject[], number ];};
		public get_keys: {(self: Caribou.IKeyboardObject): [ Caribou.KeyModel[], number ];};
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IScannableItem} instead.
	 */
	interface IIScannableItem {
		scan_stepping: boolean;
		scan_selected: boolean;
		get_scan_stepping(): boolean;
		set_scan_stepping(value: boolean): void;
		get_scan_selected(): boolean;
		set_scan_selected(value: boolean): void;
		connect(signal: "notify::scan-stepping", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::scan-selected", callback: (owner: this, ...args: any) => void): number;

	}

	type IScannableItemInitOptionsMixin = Pick<IIScannableItem,
		"scan_stepping" |
		"scan_selected">;

	export interface IScannableItemInitOptions extends IScannableItemInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IScannableItem} instead.
	 */
	type IScannableItemMixin = IIScannableItem;

	interface IScannableItem extends IScannableItemMixin {}

	class IScannableItem {
		public constructor(options?: Partial<IScannableItemInitOptions>);
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IScannableGroup} instead.
	 */
	interface IIScannableGroup {
		scan_grouping: Caribou.ScanGrouping;
		child_select(): Caribou.IScannableItem | null;
		scan_reset(): void;
		get_scan_children(): [ Caribou.IScannableItem[], number ];
		child_step(cycles: number): Caribou.IScannableItem | null;
		get_step_path(): [ Caribou.IScannableItem[], number ];
		get_selected_path(): [ Caribou.IScannableItem[], number ];
		get_scan_grouping(): Caribou.ScanGrouping;
		set_scan_grouping(value: Caribou.ScanGrouping): void;
		connect(signal: "selected-item-changed", callback: (owner: this, selected_item: Caribou.IScannableItem | null) => void): number;
		connect(signal: "step-item-changed", callback: (owner: this, step_item: Caribou.IScannableItem | null) => void): number;
		connect(signal: "scan-cleared", callback: (owner: this) => void): number;

		connect(signal: "notify::scan-grouping", callback: (owner: this, ...args: any) => void): number;

	}

	type IScannableGroupInitOptionsMixin = Pick<IIScannableGroup,
		"scan_grouping">;

	export interface IScannableGroupInitOptions extends IScannableGroupInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IScannableGroup} instead.
	 */
	type IScannableGroupMixin = IIScannableGroup;

	interface IScannableGroup extends IScannableGroupMixin {}

	class IScannableGroup {
		public constructor(options?: Partial<IScannableGroupInitOptions>);
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IKeyboardObject} instead.
	 */
	interface IIKeyboardObject {
		get_children(): [ Caribou.IKeyboardObject[], number ];
		get_keys(): [ Caribou.KeyModel[], number ];
		connect(signal: "key-clicked", callback: (owner: this, key: Caribou.KeyModel) => void): number;
		connect(signal: "key-pressed", callback: (owner: this, key: Caribou.KeyModel) => void): number;
		connect(signal: "key-released", callback: (owner: this, key: Caribou.KeyModel) => void): number;

	}

	type IKeyboardObjectInitOptionsMixin  = {};
	export interface IKeyboardObjectInitOptions extends IKeyboardObjectInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IKeyboardObject} instead.
	 */
	type IKeyboardObjectMixin = IIKeyboardObject;

	interface IKeyboardObject extends IKeyboardObjectMixin {}

	class IKeyboardObject {
		public constructor(options?: Partial<IKeyboardObjectInitOptions>);
	}



	enum ModifierState {
		NONE = 0,
		LATCHED = 1,
		LOCKED = 2
	}

	enum ScanGrouping {
		NONE = 0,
		SUBGROUPS = 1,
		ROWS = 2,
		LINEAR = 3
	}

	interface KeyButtonCallback {
		(keybuttoncode: number, pressed: boolean): void;
	}

}