/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.Cvc {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ChannelMap} instead.
	 */
	interface IChannelMap {
		can_balance(): boolean;
		can_fade(): boolean;
		can_lfe(): boolean;
		get_balance(): number;
		get_fade(): number;
		get_lfe(): number;
		get_mapping(): string;
		get_num_channels(): number;
		get_volume(): number;
		has_position(position: number): boolean;
		set_balance(value: number): void;
		set_fade(value: number): void;
		set_lfe(value: number): void;
		connect(signal: "volume-changed", callback: (owner: this, object: boolean) => void): number;

	}

	type ChannelMapInitOptionsMixin = GObject.ObjectInitOptions
	export interface ChannelMapInitOptions extends ChannelMapInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ChannelMap} instead.
	 */
	type ChannelMapMixin = IChannelMap & GObject.Object;

	interface ChannelMap extends ChannelMapMixin {}

	class ChannelMap {
		public constructor(options?: Partial<ChannelMapInitOptions>);
		public static new(): ChannelMap;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerCard} instead.
	 */
	interface IMixerCard {
		readonly human_profile: string;
		icon_name: string;
		id: number;
		index: number;
		name: string;
		pa_context: any;
		profile: string;
		change_profile(profile: string): boolean;
		get_gicon(): Gio.Icon;
		get_icon_name(): string;
		get_id(): number;
		get_index(): number;
		get_name(): string;
		get_ports(): MixerCardPort[];
		get_profile(): MixerCardProfile;
		get_profiles(): MixerCardProfile[];
		set_icon_name(name: string): boolean;
		set_name(name: string): boolean;
		set_ports(ports: MixerCardPort[]): boolean;
		set_profile(profile: string): boolean;
		set_profiles(profiles: MixerCardProfile[]): boolean;
		connect(signal: "notify::human-profile", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::icon-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::id", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::index", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pa-context", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::profile", callback: (owner: this, ...args: any) => void): number;

	}

	type MixerCardInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IMixerCard,
		"icon_name" |
		"id" |
		"index" |
		"name" |
		"pa_context" |
		"profile">;

	export interface MixerCardInitOptions extends MixerCardInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerCard} instead.
	 */
	type MixerCardMixin = IMixerCard & GObject.Object;

	interface MixerCard extends MixerCardMixin {}

	class MixerCard {
		public constructor(options?: Partial<MixerCardInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerControl} instead.
	 */
	interface IMixerControl {
		name: string;
		change_input(input: MixerUIDevice): void;
		change_output(output: MixerUIDevice): void;
		change_profile_on_selected_device(device: MixerUIDevice, profile: string): boolean;
		close(): boolean;
		get_cards(): MixerCard[];
		get_default_sink(): MixerStream;
		get_default_source(): MixerStream;
		get_event_sink_input(): MixerStream;
		get_sink_inputs(): MixerSinkInput[];
		get_sinks(): MixerSink[];
		get_source_outputs(): MixerSourceOutput[];
		get_sources(): MixerSource[];
		get_state(): MixerControlState;
		get_stream_from_device(device: MixerUIDevice): MixerStream;
		get_streams(): MixerStream[];
		get_vol_max_amplified(): number;
		get_vol_max_norm(): number;
		lookup_card_id(id: number): MixerCard;
		lookup_device_from_stream(stream: MixerStream): MixerUIDevice;
		lookup_input_id(id: number): MixerUIDevice;
		lookup_output_id(id: number): MixerUIDevice;
		lookup_stream_id(id: number): MixerStream;
		open(): boolean;
		set_default_sink(stream: MixerStream): boolean;
		set_default_source(stream: MixerStream): boolean;
		set_headset_port(id: number, choices: HeadsetPortChoice): void;
		connect(signal: "active-input-update", callback: (owner: this, object: number) => void): number;
		connect(signal: "active-output-update", callback: (owner: this, object: number) => void): number;
		connect(signal: "audio-device-selection-needed", callback: (owner: this, object: number, p0: boolean, p1: number) => void): number;
		connect(signal: "card-added", callback: (owner: this, object: number) => void): number;
		connect(signal: "card-removed", callback: (owner: this, object: number) => void): number;
		connect(signal: "default-sink-changed", callback: (owner: this, object: number) => void): number;
		connect(signal: "default-source-changed", callback: (owner: this, object: number) => void): number;
		connect(signal: "input-added", callback: (owner: this, object: number) => void): number;
		connect(signal: "input-removed", callback: (owner: this, object: number) => void): number;
		connect(signal: "output-added", callback: (owner: this, object: number) => void): number;
		connect(signal: "output-removed", callback: (owner: this, object: number) => void): number;
		connect(signal: "state-changed", callback: (owner: this, object: number) => void): number;
		connect(signal: "stream-added", callback: (owner: this, object: number) => void): number;
		connect(signal: "stream-changed", callback: (owner: this, object: number) => void): number;
		connect(signal: "stream-removed", callback: (owner: this, object: number) => void): number;

		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;

	}

	type MixerControlInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IMixerControl,
		"name">;

	export interface MixerControlInitOptions extends MixerControlInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerControl} instead.
	 */
	type MixerControlMixin = IMixerControl & GObject.Object;

	interface MixerControl extends MixerControlMixin {}

	class MixerControl {
		public constructor(options?: Partial<MixerControlInitOptions>);
		public static new(name: string): MixerControl;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerEventRole} instead.
	 */
	interface IMixerEventRole {
		device: string;

		connect(signal: "notify::device", callback: (owner: this, ...args: any) => void): number;

	}

	type MixerEventRoleInitOptionsMixin = MixerStreamInitOptions & 
	Pick<IMixerEventRole,
		"device">;

	export interface MixerEventRoleInitOptions extends MixerEventRoleInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerEventRole} instead.
	 */
	type MixerEventRoleMixin = IMixerEventRole & MixerStream;

	interface MixerEventRole extends MixerEventRoleMixin {}

	class MixerEventRole {
		public constructor(options?: Partial<MixerEventRoleInitOptions>);
		public static new(context: any, device: string, channel_map: ChannelMap): MixerStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSink} instead.
	 */
	interface IMixerSink {

	}

	type MixerSinkInitOptionsMixin = MixerStreamInitOptions
	export interface MixerSinkInitOptions extends MixerSinkInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSink} instead.
	 */
	type MixerSinkMixin = IMixerSink & MixerStream;

	interface MixerSink extends MixerSinkMixin {}

	class MixerSink {
		public constructor(options?: Partial<MixerSinkInitOptions>);
		public static new(context: any, index: number, channel_map: ChannelMap): MixerStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSinkInput} instead.
	 */
	interface IMixerSinkInput {

	}

	type MixerSinkInputInitOptionsMixin = MixerStreamInitOptions
	export interface MixerSinkInputInitOptions extends MixerSinkInputInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSinkInput} instead.
	 */
	type MixerSinkInputMixin = IMixerSinkInput & MixerStream;

	interface MixerSinkInput extends MixerSinkInputMixin {}

	class MixerSinkInput {
		public constructor(options?: Partial<MixerSinkInputInitOptions>);
		public static new(context: any, index: number, channel_map: ChannelMap): MixerStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSource} instead.
	 */
	interface IMixerSource {

	}

	type MixerSourceInitOptionsMixin = MixerStreamInitOptions
	export interface MixerSourceInitOptions extends MixerSourceInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSource} instead.
	 */
	type MixerSourceMixin = IMixerSource & MixerStream;

	interface MixerSource extends MixerSourceMixin {}

	class MixerSource {
		public constructor(options?: Partial<MixerSourceInitOptions>);
		public static new(context: any, index: number, channel_map: ChannelMap): MixerStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSourceOutput} instead.
	 */
	interface IMixerSourceOutput {

	}

	type MixerSourceOutputInitOptionsMixin = MixerStreamInitOptions
	export interface MixerSourceOutputInitOptions extends MixerSourceOutputInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSourceOutput} instead.
	 */
	type MixerSourceOutputMixin = IMixerSourceOutput & MixerStream;

	interface MixerSourceOutput extends MixerSourceOutputMixin {}

	class MixerSourceOutput {
		public constructor(options?: Partial<MixerSourceOutputInitOptions>);
		public static new(context: any, index: number, channel_map: ChannelMap): MixerStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerStream} instead.
	 */
	interface IMixerStream {
		application_id: string;
		can_decibel: boolean;
		card_index: number;
		channel_map: ChannelMap;
		decibel: number;
		description: string;
		form_factor: string;
		icon_name: string;
		id: number;
		index: number;
		// is_event_stream: boolean;
		is_muted: boolean;
		// is_virtual: boolean;
		name: string;
		pa_context: any;
		port: string;
		sysfs_path: string;
		volume: number;
		change_is_muted(is_muted: boolean): boolean;
		change_port(port: string): boolean;
		create_monitor(): void;
		get_application_id(): string;
		get_base_volume(): number;
		get_can_decibel(): boolean;
		get_card_index(): number;
		get_channel_map(): ChannelMap;
		get_decibel(): number;
		get_description(): string;
		get_form_factor(): string;
		get_gicon(): Gio.Icon;
		get_icon_name(): string;
		get_id(): number;
		get_index(): number;
		get_is_muted(): boolean;
		get_name(): string;
		get_port(): MixerStreamPort;
		get_ports(): MixerStreamPort[];
		get_sysfs_path(): string;
		get_volume(): number;
		is_event_stream(): boolean;
		is_running(): boolean;
		is_virtual(): boolean;
		push_volume(): boolean;
		remove_monitor(): void;
		set_application_id(application_id: string): boolean;
		set_base_volume(base_volume: number): boolean;
		set_can_decibel(can_decibel: boolean): boolean;
		set_card_index(card_index: number): boolean;
		set_decibel(db: number): boolean;
		set_description(description: string): boolean;
		set_form_factor(form_factor: string): boolean;
		set_icon_name(name: string): boolean;
		set_is_event_stream(is_event_stream: boolean): boolean;
		set_is_muted(is_muted: boolean): boolean;
		set_is_virtual(is_event_stream: boolean): boolean;
		set_name(name: string): boolean;
		set_port(port: string): boolean;
		set_ports(ports: MixerStreamPort[]): boolean;
		set_sysfs_path(sysfs_path: string): boolean;
		set_volume(volume: number): boolean;
		connect(signal: "monitor-suspend", callback: (owner: this) => void): number;
		connect(signal: "monitor-update", callback: (owner: this, object: number) => void): number;

		connect(signal: "notify::application-id", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::can-decibel", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::card-index", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::channel-map", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::decibel", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::description", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::form-factor", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::icon-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::id", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::index", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::is-event-stream", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::is-muted", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::is-virtual", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pa-context", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::port", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::sysfs-path", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::volume", callback: (owner: this, ...args: any) => void): number;

	}

	type MixerStreamInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IMixerStream,
		"application_id" |
		"can_decibel" |
		"card_index" |
		"channel_map" |
		"decibel" |
		"description" |
		"form_factor" |
		"icon_name" |
		"id" |
		"index" |
		"is_event_stream" |
		"is_muted" |
		"is_virtual" |
		"name" |
		"pa_context" |
		"port" |
		"sysfs_path" |
		"volume">;

	export interface MixerStreamInitOptions extends MixerStreamInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerStream} instead.
	 */
	type MixerStreamMixin = IMixerStream & GObject.Object;

	interface MixerStream extends MixerStreamMixin {}

	class MixerStream {
		public constructor(options?: Partial<MixerStreamInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerUIDevice} instead.
	 */
	interface IMixerUIDevice {
		card: any;
		description: string;
		icon_name: string;
		origin: string;
		port_available: boolean;
		port_name: string;
		stream_id: number;
		type: number;
		get_active_profile(): string;
		get_best_profile(selected: string, current: string): string;
		get_card(): MixerCard;
		get_description(): string;
		get_gicon(): Gio.Icon;
		get_icon_name(): string;
		get_id(): number;
		get_matching_profile(profile: string): string;
		get_origin(): string;
		get_port(): string;
		get_profiles(): MixerCardProfile[];
		get_stream_id(): number;
		get_supported_profiles(): MixerCardProfile[];
		get_top_priority_profile(): string;
		get_user_preferred_profile(): string;
		has_ports(): boolean;
		invalidate_stream(): void;
		is_output(): boolean;
		/**
		 * Assigns value to
		 *  - device->priv->profiles (profiles to be added to combobox)
		 *  - device->priv->supported_profiles (all profiles of this port)
		 *  - device->priv->disable_profile_swapping (whether to show the combobox)
		 * 
		 * This method attempts to reduce the list of profiles visible to the user by figuring out
		 * from the context of that device (whether it's an input or an output) what profiles
		 * actually provide an alternative.
		 * 
		 * It does this by the following.
		 *  - It ignores off profiles.
		 *  - It takes the canonical name of the profile. That name is what you get when you
		 *    ignore the other direction.
		 *  - In the first iteration, it only adds the names of canonical profiles - i e
		 *    when the other side is turned off.
		 *  - Normally the first iteration covers all cases, but sometimes (e g bluetooth)
		 *    it doesn't, so add other profiles whose canonical name isn't already added
		 *    in a second iteration.
		 * @param in_profiles a list of GvcMixerCardProfile
		 */
		set_profiles(in_profiles: MixerCardProfile[]): void;
		set_user_preferred_profile(profile: string): void;
		should_profiles_be_hidden(): boolean;
		connect(signal: "notify::card", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::description", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::icon-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::origin", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::port-available", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::port-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::stream-id", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::type", callback: (owner: this, ...args: any) => void): number;

	}

	type MixerUIDeviceInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IMixerUIDevice,
		"card" |
		"description" |
		"icon_name" |
		"origin" |
		"port_available" |
		"port_name" |
		"stream_id" |
		"type">;

	export interface MixerUIDeviceInitOptions extends MixerUIDeviceInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerUIDevice} instead.
	 */
	type MixerUIDeviceMixin = IMixerUIDevice & GObject.Object;

	interface MixerUIDevice extends MixerUIDeviceMixin {}

	class MixerUIDevice {
		public constructor(options?: Partial<MixerUIDeviceInitOptions>);
	}

	export interface MixerCardPortInitOptions {}
	interface MixerCardPort {}
	class MixerCardPort {
		public constructor(options?: Partial<MixerCardPortInitOptions>);
		public port: string;
		public human_port: string;
		public icon_name: string;
		public priority: number;
		public available: number;
		public direction: number;
		public profiles: any[];
	}

	export interface MixerCardProfileInitOptions {}
	interface MixerCardProfile {}
	class MixerCardProfile {
		public constructor(options?: Partial<MixerCardProfileInitOptions>);
		public profile: string;
		public human_profile: string;
		public status: string;
		public priority: number;
		public n_sinks: number;
		public n_sources: number;
		public compare(b: MixerCardProfile): number;
	}

	export interface MixerStreamPortInitOptions {}
	interface MixerStreamPort {}
	class MixerStreamPort {
		public constructor(options?: Partial<MixerStreamPortInitOptions>);
		public port: string;
		public human_port: string;
		public priority: number;
		public available: boolean;
	}

	enum MixerControlState {
		CLOSED = 0,
		READY = 1,
		CONNECTING = 2,
		FAILED = 3
	}

	enum MixerUIDeviceDirection {
		IDEVICEINPUT = 0,
		IDEVICEOUTPUT = 1
	}

	enum HeadsetPortChoice {
		NONE = 0,
		HEADPHONES = 1,
		HEADSET = 2,
		MIC = 4
	}

	const MIXER_UI_DEVICE_INVALID: number;

}