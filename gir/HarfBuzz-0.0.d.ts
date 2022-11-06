/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.HarfBuzz {
	export interface aat_layout_feature_selector_info_tInitOptions {}
	/**
	 * Structure representing a setting for an #hb_aat_layout_feature_type_t.
	 */
	interface aat_layout_feature_selector_info_t {}
	class aat_layout_feature_selector_info_t {
		public constructor(options?: Partial<aat_layout_feature_selector_info_tInitOptions>);
		/**
		 * The selector's name identifier
		 */
		public name_id: ot_name_id_t;
		/**
		 * The value to turn the selector on
		 */
		public enable: aat_layout_feature_selector_t;
		/**
		 * The value to turn the selector off
		 */
		public disable: aat_layout_feature_selector_t;
		public readonly reserved: number;
	}

	export interface blob_tInitOptions {}
	/**
	 * Data type for blobs. A blob wraps a chunk of binary
	 * data and facilitates its lifecycle management between
	 * a client program and HarfBuzz.
	 */
	interface blob_t {}
	class blob_t {
		public constructor(options?: Partial<blob_tInitOptions>);
	}

	export interface buffer_tInitOptions {}
	/**
	 * The main structure holding the input text and its properties before shaping,
	 * and output glyphs and their information after shaping.
	 */
	interface buffer_t {}
	class buffer_t {
		public constructor(options?: Partial<buffer_tInitOptions>);
	}

	export interface face_tInitOptions {}
	/**
	 * Data type for holding font faces.
	 */
	interface face_t {}
	class face_t {
		public constructor(options?: Partial<face_tInitOptions>);
	}

	export interface feature_tInitOptions {}
	/**
	 * The #hb_feature_t is the structure that holds information about requested
	 * feature application. The feature will be applied with the given value to all
	 * glyphs which are in clusters between #start (inclusive) and #end (exclusive).
	 * Setting start to #HB_FEATURE_GLOBAL_START and end to #HB_FEATURE_GLOBAL_END
	 * specifies that the feature always applies to the entire buffer.
	 */
	interface feature_t {}
	class feature_t {
		public constructor(options?: Partial<feature_tInitOptions>);
		/**
		 * The #hb_tag_t tag of the feature
		 */
		public tag: tag_t;
		/**
		 * The value of the feature. 0 disables the feature, non-zero (usually
		 * 1) enables the feature.  For features implemented as lookup type 3 (like
		 * 'salt') the #value is a one based index into the alternates.
		 */
		public value: number;
		/**
		 * the cluster to start applying this feature setting (inclusive).
		 */
		public start: number;
		/**
		 * the cluster to end applying this feature setting (exclusive).
		 */
		public end: number;
		/**
		 * Converts a #hb_feature_t into a %NULL-terminated string in the format
		 * understood by {@link Hb.feature_from_string}. The client in responsible for
		 * allocating big enough size for #buf, 128 bytes is more than enough.
		 * @returns output string
		 * 
		 * the allocated size of #buf
		 */
		public _string(): [ string[], number ];
	}

	export interface font_extents_tInitOptions {}
	/**
	 * Font-wide extent values, measured in font units.
	 * 
	 * Note that typically #ascender is positive and #descender
	 * negative, in coordinate systems that grow up.
	 */
	interface font_extents_t {}
	class font_extents_t {
		public constructor(options?: Partial<font_extents_tInitOptions>);
		/**
		 * The height of typographic ascenders.
		 */
		public ascender: position_t;
		/**
		 * The depth of typographic descenders.
		 */
		public descender: position_t;
		/**
		 * The suggested line-spacing gap.
		 */
		public line_gap: position_t;
		public readonly reserved9: position_t;
		public readonly reserved8: position_t;
		public readonly reserved7: position_t;
		public readonly reserved6: position_t;
		public readonly reserved5: position_t;
		public readonly reserved4: position_t;
		public readonly reserved3: position_t;
		public readonly reserved2: position_t;
		public readonly reserved1: position_t;
	}

	export interface font_funcs_tInitOptions {}
	/**
	 * Data type containing a set of virtual methods used for
	 * working on #hb_font_t font objects.
	 * 
	 * HarfBuzz provides a lightweight default function for each of
	 * the methods in #hb_font_funcs_t. Client programs can implement
	 * their own replacements for the individual font functions, as
	 * needed, and replace the default by calling the setter for a
	 * method.
	 */
	interface font_funcs_t {}
	class font_funcs_t {
		public constructor(options?: Partial<font_funcs_tInitOptions>);
	}

	export interface font_tInitOptions {}
	/**
	 * Data type for holding fonts.
	 */
	interface font_t {}
	class font_t {
		public constructor(options?: Partial<font_tInitOptions>);
	}

	export interface glyph_extents_tInitOptions {}
	/**
	 * Glyph extent values, measured in font units.
	 * 
	 * Note that #height is negative, in coordinate systems that grow up.
	 */
	interface glyph_extents_t {}
	class glyph_extents_t {
		public constructor(options?: Partial<glyph_extents_tInitOptions>);
		/**
		 * Distance from the x-origin to the left extremum of the glyph.
		 */
		public x_bearing: position_t;
		/**
		 * Distance from the top extremum of the glyph to the y-origin.
		 */
		public y_bearing: position_t;
		/**
		 * Distance from the left extremum of the glyph to the right extremum.
		 */
		public width: position_t;
		/**
		 * Distance from the top extremum of the glyph to the bottom extremum.
		 */
		public height: position_t;
	}

	export interface glyph_info_tInitOptions {}
	/**
	 * The #hb_glyph_info_t is the structure that holds information about the
	 * glyphs and their relation to input text.
	 */
	interface glyph_info_t {}
	class glyph_info_t {
		public constructor(options?: Partial<glyph_info_tInitOptions>);
		/**
		 * either a Unicode code point (before shaping) or a glyph index
		 *             (after shaping).
		 */
		public codepoint: codepoint_t;
		public readonly mask: mask_t;
		/**
		 * the index of the character in the original text that corresponds
		 *           to this #hb_glyph_info_t, or whatever the client passes to
		 *           {@link Hb.buffer_add}. More than one #hb_glyph_info_t can have the same
		 *           #cluster value, if they resulted from the same character (e.g. one
		 *           to many glyph substitution), and when more than one character gets
		 *           merged in the same glyph (e.g. many to one glyph substitution) the
		 *           #hb_glyph_info_t will have the smallest cluster value of them.
		 *           By default some characters are merged into the same cluster
		 *           (e.g. combining marks have the same cluster as their bases)
		 *           even if they are separate glyphs, hb_buffer_set_cluster_level()
		 *           allow selecting more fine-grained cluster handling.
		 */
		public cluster: number;
		public readonly var1: var_int_t;
		public readonly var2: var_int_t;
	}

	export interface glyph_position_tInitOptions {}
	/**
	 * The #hb_glyph_position_t is the structure that holds the positions of the
	 * glyph in both horizontal and vertical directions. All positions in
	 * #hb_glyph_position_t are relative to the current point.
	 */
	interface glyph_position_t {}
	class glyph_position_t {
		public constructor(options?: Partial<glyph_position_tInitOptions>);
		/**
		 * how much the line advances after drawing this glyph when setting
		 *             text in horizontal direction.
		 */
		public x_advance: position_t;
		/**
		 * how much the line advances after drawing this glyph when setting
		 *             text in vertical direction.
		 */
		public y_advance: position_t;
		/**
		 * how much the glyph moves on the X-axis before drawing it, this
		 *            should not affect how much the line advances.
		 */
		public x_offset: position_t;
		/**
		 * how much the glyph moves on the Y-axis before drawing it, this
		 *            should not affect how much the line advances.
		 */
		public y_offset: position_t;
		public readonly var: var_int_t;
	}

	export interface language_tInitOptions {}
	/**
	 * Data type for languages. Each #hb_language_t corresponds to a BCP 47
	 * language tag.
	 */
	interface language_t {}
	class language_t {
		public constructor(options?: Partial<language_tInitOptions>);
		/**
		 * Converts an #hb_language_t to a string.
		 * @returns 
		 * A %NULL-terminated string representing the #language. Must not be freed by
		 * the caller.
		 */
		public _string(): string;
	}

	export interface map_tInitOptions {}
	/**
	 * Data type for holding integer-to-integer hash maps.
	 */
	interface map_t {}
	class map_t {
		public constructor(options?: Partial<map_tInitOptions>);
	}

	export interface ot_color_layer_tInitOptions {}
	/**
	 * Pairs of glyph and color index.
	 */
	interface ot_color_layer_t {}
	class ot_color_layer_t {
		public constructor(options?: Partial<ot_color_layer_tInitOptions>);
		/**
		 * the glyph ID of the layer
		 */
		public glyph: codepoint_t;
		/**
		 * the palette color index of the layer
		 */
		public color_index: number;
	}

	export interface ot_math_glyph_part_tInitOptions {}
	/**
	 * Data type to hold information for a "part" component of a math-variant glyph.
	 * Large variants for stretchable math glyphs (such as parentheses) can be constructed
	 * on the fly from parts.
	 */
	interface ot_math_glyph_part_t {}
	class ot_math_glyph_part_t {
		public constructor(options?: Partial<ot_math_glyph_part_tInitOptions>);
		/**
		 * The glyph index of the variant part
		 */
		public glyph: codepoint_t;
		/**
		 * The length of the connector on the starting side of the variant part
		 */
		public start_connector_length: position_t;
		/**
		 * The length of the connector on the ending side of the variant part
		 */
		public end_connector_length: position_t;
		/**
		 * The total advance of the part
		 */
		public full_advance: position_t;
		/**
		 * #hb_ot_math_glyph_part_flags_t flags for the part
		 */
		public flags: ot_math_glyph_part_flags_t;
	}

	export interface ot_math_glyph_variant_tInitOptions {}
	/**
	 * Data type to hold math-variant information for a glyph.
	 */
	interface ot_math_glyph_variant_t {}
	class ot_math_glyph_variant_t {
		public constructor(options?: Partial<ot_math_glyph_variant_tInitOptions>);
		/**
		 * The glyph index of the variant
		 */
		public glyph: codepoint_t;
		/**
		 * The advance width of the variant
		 */
		public advance: position_t;
	}

	export interface ot_name_entry_tInitOptions {}
	/**
	 * Structure representing a name ID in a particular language.
	 */
	interface ot_name_entry_t {}
	class ot_name_entry_t {
		public constructor(options?: Partial<ot_name_entry_tInitOptions>);
		/**
		 * name ID
		 */
		public name_id: ot_name_id_t;
		public readonly var: var_int_t;
		/**
		 * language
		 */
		public language: language_t;
	}

	export interface ot_var_axis_info_tInitOptions {}
	/**
	 * Data type for holding variation-axis values.
	 * 
	 * The minimum, default, and maximum values are in un-normalized, user scales.
	 * 
	 * <note>Note: at present, the only flag defined for #flags is
	 * #HB_OT_VAR_AXIS_FLAG_HIDDEN.</note>
	 */
	interface ot_var_axis_info_t {}
	class ot_var_axis_info_t {
		public constructor(options?: Partial<ot_var_axis_info_tInitOptions>);
		/**
		 * Index of the axis in the variation-axis array
		 */
		public axis_index: number;
		/**
		 * The #hb_tag_t tag identifying the design variation of the axis
		 */
		public tag: tag_t;
		/**
		 * The `name` table Name ID that provides display names for the axis
		 */
		public name_id: ot_name_id_t;
		/**
		 * The #hb_ot_var_axis_flags_t flags for the axis
		 */
		public flags: ot_var_axis_flags_t;
		/**
		 * The mininum value on the variation axis that the font covers
		 */
		public min_value: number;
		/**
		 * The position on the variation axis corresponding to the font's defaults
		 */
		public default_value: number;
		/**
		 * The maximum value on the variation axis that the font covers
		 */
		public max_value: number;
		public readonly reserved: number;
	}

	export interface ot_var_axis_tInitOptions {}
	/**
	 * Use #hb_ot_var_axis_info_t instead.
	 */
	interface ot_var_axis_t {}
	class ot_var_axis_t {
		public constructor(options?: Partial<ot_var_axis_tInitOptions>);
		/**
		 * axis tag
		 */
		public tag: tag_t;
		/**
		 * axis name identifier
		 */
		public name_id: ot_name_id_t;
		/**
		 * minimum value of the axis
		 */
		public min_value: number;
		/**
		 * default value of the axis
		 */
		public default_value: number;
		/**
		 * maximum value of the axis
		 */
		public max_value: number;
	}

	export interface segment_properties_tInitOptions {}
	/**
	 * The structure that holds various text properties of an #hb_buffer_t. Can be
	 * set and retrieved using {@link Hb.buffer_set_segment_properties} and
	 * hb_buffer_get_segment_properties(), respectively.
	 */
	interface segment_properties_t {}
	class segment_properties_t {
		public constructor(options?: Partial<segment_properties_tInitOptions>);
		/**
		 * the #hb_direction_t of the buffer, see {@link Hb.buffer_set_direction}.
		 */
		public direction: direction_t;
		/**
		 * the #hb_script_t of the buffer, see {@link Hb.buffer_set_script}.
		 */
		public script: script_t;
		/**
		 * the #hb_language_t of the buffer, see {@link Hb.buffer_set_language}.
		 */
		public language: language_t;
		public readonly reserved1: any;
		public readonly reserved2: any;
	}

	export interface set_tInitOptions {}
	/**
	 * Data type for holding a set of integers. #hb_set_t's are
	 * used to gather and contain glyph IDs, Unicode code
	 * points, and various other collections of discrete
	 * values.
	 */
	interface set_t {}
	class set_t {
		public constructor(options?: Partial<set_tInitOptions>);
	}

	export interface shape_plan_tInitOptions {}
	/**
	 * Data type for holding a shaping plan.
	 * 
	 * Shape plans contain information about how HarfBuzz will shape a
	 * particular text segment, based on the segment's properties and the
	 * capabilities in the font face in use.
	 * 
	 * Shape plans can be queried about how shaping will perform, given a set
	 * of specific input parameters (script, language, direction, features,
	 * etc.).
	 */
	interface shape_plan_t {}
	class shape_plan_t {
		public constructor(options?: Partial<shape_plan_tInitOptions>);
	}

	export interface unicode_funcs_tInitOptions {}
	/**
	 * Data type containing a set of virtual methods used for
	 * accessing various Unicode character properties.
	 * 
	 * HarfBuzz provides a default function for each of the
	 * methods in #hb_unicode_funcs_t. Client programs can implement
	 * their own replacements for the individual Unicode functions, as
	 * needed, and replace the default by calling the setter for a
	 * method.
	 */
	interface unicode_funcs_t {}
	class unicode_funcs_t {
		public constructor(options?: Partial<unicode_funcs_tInitOptions>);
	}

	export interface user_data_key_tInitOptions {}
	/**
	 * Data structure for holding user-data keys.
	 */
	interface user_data_key_t {}
	class user_data_key_t {
		public constructor(options?: Partial<user_data_key_tInitOptions>);
		public readonly unused: string;
	}

	export interface variation_tInitOptions {}
	/**
	 * Data type for holding variation data. Registered OpenType
	 * variation-axis tags are listed in
	 * [OpenType Axis Tag Registry](https://docs.microsoft.com/en-us/typography/opentype/spec/dvaraxisreg).
	 */
	interface variation_t {}
	class variation_t {
		public constructor(options?: Partial<variation_tInitOptions>);
		/**
		 * The #hb_tag_t tag of the variation-axis name
		 */
		public tag: tag_t;
		/**
		 * The value of the variation axis
		 */
		public value: number;
		/**
		 * Converts an #hb_variation_t into a %NULL-terminated string in the format
		 * understood by {@link Hb.variation_from_string}. The client in responsible for
		 * allocating big enough size for #buf, 128 bytes is more than enough.
		 * @returns output string
		 * 
		 * the allocated size of #buf
		 */
		public _string(): [ string[], number ];
	}

	/**
	 * The selectors defined for specifying AAT feature settings.
	 */
	enum aat_layout_feature_selector_t {
		/**
		 * Initial, unset feature selector
		 */
		INVALID = 65535,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ALL_TYPOGRAPHIC
		 */
		ALL_TYPE_FEATURES_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ALL_TYPOGRAPHIC
		 */
		ALL_TYPE_FEATURES_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		REQUIRED_LIGATURES_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		REQUIRED_LIGATURES_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		COMMON_LIGATURES_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		COMMON_LIGATURES_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		RARE_LIGATURES_ON = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		RARE_LIGATURES_OFF = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		LOGOS_ON = 6,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		LOGOS_OFF = 7,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		REBUS_PICTURES_ON = 8,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		REBUS_PICTURES_OFF = 9,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		DIPHTHONG_LIGATURES_ON = 10,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		DIPHTHONG_LIGATURES_OFF = 11,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		SQUARED_LIGATURES_ON = 12,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		SQUARED_LIGATURES_OFF = 13,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		ABBREV_SQUARED_LIGATURES_ON = 14,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		ABBREV_SQUARED_LIGATURES_OFF = 15,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		SYMBOL_LIGATURES_ON = 16,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		SYMBOL_LIGATURES_OFF = 17,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		CONTEXTUAL_LIGATURES_ON = 18,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		CONTEXTUAL_LIGATURES_OFF = 19,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		HISTORICAL_LIGATURES_ON = 20,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		HISTORICAL_LIGATURES_OFF = 21,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		UNCONNECTED = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		PARTIALLY_CONNECTED = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LIGATURES
		 */
		CURSIVE = 2,
		/**
		 * Deprecated
		 */
		UPPER_AND_LOWER_CASE = 0,
		/**
		 * Deprecated
		 */
		ALL_CAPS = 1,
		/**
		 * Deprecated
		 */
		ALL_LOWER_CASE = 2,
		/**
		 * Deprecated
		 */
		SMALL_CAPS = 3,
		/**
		 * Deprecated
		 */
		INITIAL_CAPS = 4,
		/**
		 * Deprecated
		 */
		INITIAL_CAPS_AND_SMALL_CAPS = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_VERTICAL_SUBSTITUTION
		 */
		SUBSTITUTE_VERTICAL_FORMS_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_VERTICAL_SUBSTITUTION
		 */
		SUBSTITUTE_VERTICAL_FORMS_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LINGUISTIC_REARRANGEMENT
		 */
		LINGUISTIC_REARRANGEMENT_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LINGUISTIC_REARRANGEMENT
		 */
		LINGUISTIC_REARRANGEMENT_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_NUMBER_SPACING
		 */
		MONOSPACED_NUMBERS = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_NUMBER_SPACING
		 */
		PROPORTIONAL_NUMBERS = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_NUMBER_SPACING
		 */
		THIRD_WIDTH_NUMBERS = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_NUMBER_SPACING
		 */
		QUARTER_WIDTH_NUMBERS = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_SMART_SWASH_TYPE
		 */
		WORD_INITIAL_SWASHES_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_SMART_SWASH_TYPE
		 */
		WORD_INITIAL_SWASHES_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_SMART_SWASH_TYPE
		 */
		WORD_FINAL_SWASHES_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_SMART_SWASH_TYPE
		 */
		WORD_FINAL_SWASHES_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_SMART_SWASH_TYPE
		 */
		LINE_INITIAL_SWASHES_ON = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_SMART_SWASH_TYPE
		 */
		LINE_INITIAL_SWASHES_OFF = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_SMART_SWASH_TYPE
		 */
		LINE_FINAL_SWASHES_ON = 6,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_SMART_SWASH_TYPE
		 */
		LINE_FINAL_SWASHES_OFF = 7,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_SMART_SWASH_TYPE
		 */
		NON_FINAL_SWASHES_ON = 8,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_SMART_SWASH_TYPE
		 */
		NON_FINAL_SWASHES_OFF = 9,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_DIACRITICS_TYPE
		 */
		SHOW_DIACRITICS = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_DIACRITICS_TYPE
		 */
		HIDE_DIACRITICS = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_DIACRITICS_TYPE
		 */
		DECOMPOSE_DIACRITICS = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_VERTICAL_POSITION
		 */
		NORMAL_POSITION = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_VERTICAL_POSITION
		 */
		SUPERIORS = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_VERTICAL_POSITION
		 */
		INFERIORS = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_VERTICAL_POSITION
		 */
		ORDINALS = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_VERTICAL_POSITION
		 */
		SCIENTIFIC_INFERIORS = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_FRACTIONS
		 */
		NO_FRACTIONS = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_FRACTIONS
		 */
		VERTICAL_FRACTIONS = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_FRACTIONS
		 */
		DIAGONAL_FRACTIONS = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_OVERLAPPING_CHARACTERS_TYPE
		 */
		PREVENT_OVERLAP_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_OVERLAPPING_CHARACTERS_TYPE
		 */
		PREVENT_OVERLAP_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		HYPHENS_TO_EM_DASH_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		HYPHENS_TO_EM_DASH_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		HYPHEN_TO_EN_DASH_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		HYPHEN_TO_EN_DASH_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		SLASHED_ZERO_ON = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		SLASHED_ZERO_OFF = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		FORM_INTERROBANG_ON = 6,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		FORM_INTERROBANG_OFF = 7,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		SMART_QUOTES_ON = 8,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		SMART_QUOTES_OFF = 9,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		PERIODS_TO_ELLIPSIS_ON = 10,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TYPOGRAPHIC_EXTRAS
		 */
		PERIODS_TO_ELLIPSIS_OFF = 11,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		HYPHEN_TO_MINUS_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		HYPHEN_TO_MINUS_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		ASTERISK_TO_MULTIPLY_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		ASTERISK_TO_MULTIPLY_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		SLASH_TO_DIVIDE_ON = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		SLASH_TO_DIVIDE_OFF = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		INEQUALITY_LIGATURES_ON = 6,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		INEQUALITY_LIGATURES_OFF = 7,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		EXPONENTS_ON = 8,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		EXPONENTS_OFF = 9,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		MATHEMATICAL_GREEK_ON = 10,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_MATHEMATICAL_EXTRAS
		 */
		MATHEMATICAL_GREEK_OFF = 11,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ORNAMENT_SETS_TYPE
		 */
		NO_ORNAMENTS = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ORNAMENT_SETS_TYPE
		 */
		DINGBATS = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ORNAMENT_SETS_TYPE
		 */
		PI_CHARACTERS = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ORNAMENT_SETS_TYPE
		 */
		FLEURONS = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ORNAMENT_SETS_TYPE
		 */
		DECORATIVE_BORDERS = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ORNAMENT_SETS_TYPE
		 */
		INTERNATIONAL_SYMBOLS = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ORNAMENT_SETS_TYPE
		 */
		MATH_SYMBOLS = 6,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_ALTERNATIVES
		 */
		NO_ALTERNATES = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_DESIGN_COMPLEXITY_TYPE
		 */
		DESIGN_LEVEL1 = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_DESIGN_COMPLEXITY_TYPE
		 */
		DESIGN_LEVEL2 = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_DESIGN_COMPLEXITY_TYPE
		 */
		DESIGN_LEVEL3 = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_DESIGN_COMPLEXITY_TYPE
		 */
		DESIGN_LEVEL4 = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_DESIGN_COMPLEXITY_TYPE
		 */
		DESIGN_LEVEL5 = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLE_OPTIONS
		 */
		NO_STYLE_OPTIONS = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLE_OPTIONS
		 */
		DISPLAY_TEXT = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLE_OPTIONS
		 */
		ENGRAVED_TEXT = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLE_OPTIONS
		 */
		ILLUMINATED_CAPS = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLE_OPTIONS
		 */
		TITLING_CAPS = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLE_OPTIONS
		 */
		TALL_CAPS = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		TRADITIONAL_CHARACTERS = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		SIMPLIFIED_CHARACTERS = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		JIS1978_CHARACTERS = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		JIS1983_CHARACTERS = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		JIS1990_CHARACTERS = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		TRADITIONAL_ALT_ONE = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		TRADITIONAL_ALT_TWO = 6,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		TRADITIONAL_ALT_THREE = 7,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		TRADITIONAL_ALT_FOUR = 8,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		TRADITIONAL_ALT_FIVE = 9,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		EXPERT_CHARACTERS = 10,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		JIS2004_CHARACTERS = 11,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		HOJO_CHARACTERS = 12,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		NLCCHARACTERS = 13,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CHARACTER_SHAPE
		 */
		TRADITIONAL_NAMES_CHARACTERS = 14,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_NUMBER_CASE
		 */
		LOWER_CASE_NUMBERS = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_NUMBER_CASE
		 */
		UPPER_CASE_NUMBERS = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TEXT_SPACING
		 */
		PROPORTIONAL_TEXT = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TEXT_SPACING
		 */
		MONOSPACED_TEXT = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TEXT_SPACING
		 */
		HALF_WIDTH_TEXT = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TEXT_SPACING
		 */
		THIRD_WIDTH_TEXT = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TEXT_SPACING
		 */
		QUARTER_WIDTH_TEXT = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TEXT_SPACING
		 */
		ALT_PROPORTIONAL_TEXT = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TEXT_SPACING
		 */
		ALT_HALF_WIDTH_TEXT = 6,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TRANSLITERATION
		 */
		NO_TRANSLITERATION = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TRANSLITERATION
		 */
		HANJA_TO_HANGUL = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TRANSLITERATION
		 */
		HIRAGANA_TO_KATAKANA = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TRANSLITERATION
		 */
		KATAKANA_TO_HIRAGANA = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TRANSLITERATION
		 */
		KANA_TO_ROMANIZATION = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TRANSLITERATION
		 */
		ROMANIZATION_TO_HIRAGANA = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TRANSLITERATION
		 */
		ROMANIZATION_TO_KATAKANA = 6,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TRANSLITERATION
		 */
		HANJA_TO_HANGUL_ALT_ONE = 7,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TRANSLITERATION
		 */
		HANJA_TO_HANGUL_ALT_TWO = 8,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_TRANSLITERATION
		 */
		HANJA_TO_HANGUL_ALT_THREE = 9,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		NO_ANNOTATION = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		BOX_ANNOTATION = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		ROUNDED_BOX_ANNOTATION = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		CIRCLE_ANNOTATION = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		INVERTED_CIRCLE_ANNOTATION = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		PARENTHESIS_ANNOTATION = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		PERIOD_ANNOTATION = 6,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		ROMAN_NUMERAL_ANNOTATION = 7,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		DIAMOND_ANNOTATION = 8,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		INVERTED_BOX_ANNOTATION = 9,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ANNOTATION_TYPE
		 */
		INVERTED_ROUNDED_BOX_ANNOTATION = 10,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_KANA_SPACING_TYPE
		 */
		FULL_WIDTH_KANA = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_KANA_SPACING_TYPE
		 */
		PROPORTIONAL_KANA = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_IDEOGRAPHIC_SPACING_TYPE
		 */
		FULL_WIDTH_IDEOGRAPHS = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_IDEOGRAPHIC_SPACING_TYPE
		 */
		PROPORTIONAL_IDEOGRAPHS = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_IDEOGRAPHIC_SPACING_TYPE
		 */
		HALF_WIDTH_IDEOGRAPHS = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_UNICODE_DECOMPOSITION_TYPE
		 */
		CANONICAL_COMPOSITION_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_UNICODE_DECOMPOSITION_TYPE
		 */
		CANONICAL_COMPOSITION_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_UNICODE_DECOMPOSITION_TYPE
		 */
		COMPATIBILITY_COMPOSITION_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_UNICODE_DECOMPOSITION_TYPE
		 */
		COMPATIBILITY_COMPOSITION_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_UNICODE_DECOMPOSITION_TYPE
		 */
		TRANSCODING_COMPOSITION_ON = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_UNICODE_DECOMPOSITION_TYPE
		 */
		TRANSCODING_COMPOSITION_OFF = 5,
		/**
		 * Deprecated; use #HB_AAT_LAYOUT_FEATURE_SELECTOR_RUBY_KANA_OFF instead
		 */
		NO_RUBY_KANA = 0,
		/**
		 * Deprecated; use #HB_AAT_LAYOUT_FEATURE_SELECTOR_RUBY_KANA_ON instead
		 */
		RUBY_KANA = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_RUBY_KANA
		 */
		RUBY_KANA_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_RUBY_KANA
		 */
		RUBY_KANA_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_SYMBOL_ALTERNATIVES_TYPE
		 */
		NO_CJK_SYMBOL_ALTERNATIVES = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_SYMBOL_ALTERNATIVES_TYPE
		 */
		CJK_SYMBOL_ALT_ONE = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_SYMBOL_ALTERNATIVES_TYPE
		 */
		CJK_SYMBOL_ALT_TWO = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_SYMBOL_ALTERNATIVES_TYPE
		 */
		CJK_SYMBOL_ALT_THREE = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_SYMBOL_ALTERNATIVES_TYPE
		 */
		CJK_SYMBOL_ALT_FOUR = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_SYMBOL_ALTERNATIVES_TYPE
		 */
		CJK_SYMBOL_ALT_FIVE = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_IDEOGRAPHIC_ALTERNATIVES_TYPE
		 */
		NO_IDEOGRAPHIC_ALTERNATIVES = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_IDEOGRAPHIC_ALTERNATIVES_TYPE
		 */
		IDEOGRAPHIC_ALT_ONE = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_IDEOGRAPHIC_ALTERNATIVES_TYPE
		 */
		IDEOGRAPHIC_ALT_TWO = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_IDEOGRAPHIC_ALTERNATIVES_TYPE
		 */
		IDEOGRAPHIC_ALT_THREE = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_IDEOGRAPHIC_ALTERNATIVES_TYPE
		 */
		IDEOGRAPHIC_ALT_FOUR = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_IDEOGRAPHIC_ALTERNATIVES_TYPE
		 */
		IDEOGRAPHIC_ALT_FIVE = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_VERTICAL_ROMAN_PLACEMENT_TYPE
		 */
		CJK_VERTICAL_ROMAN_CENTERED = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_VERTICAL_ROMAN_PLACEMENT_TYPE
		 */
		CJK_VERTICAL_ROMAN_HBASELINE = 1,
		/**
		 * Deprecated; use #HB_AAT_LAYOUT_FEATURE_SELECTOR_CJK_ITALIC_ROMAN_OFF instead
		 */
		NO_CJK_ITALIC_ROMAN = 0,
		/**
		 * Deprecated; use #HB_AAT_LAYOUT_FEATURE_SELECTOR_CJK_ITALIC_ROMAN_ON instead
		 */
		CJK_ITALIC_ROMAN = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ITALIC_CJK_ROMAN
		 */
		CJK_ITALIC_ROMAN_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ITALIC_CJK_ROMAN
		 */
		CJK_ITALIC_ROMAN_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CASE_SENSITIVE_LAYOUT
		 */
		CASE_SENSITIVE_LAYOUT_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CASE_SENSITIVE_LAYOUT
		 */
		CASE_SENSITIVE_LAYOUT_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CASE_SENSITIVE_LAYOUT
		 */
		CASE_SENSITIVE_SPACING_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CASE_SENSITIVE_LAYOUT
		 */
		CASE_SENSITIVE_SPACING_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ALTERNATE_KANA
		 */
		ALTERNATE_HORIZ_KANA_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ALTERNATE_KANA
		 */
		ALTERNATE_HORIZ_KANA_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ALTERNATE_KANA
		 */
		ALTERNATE_VERT_KANA_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_ALTERNATE_KANA
		 */
		ALTERNATE_VERT_KANA_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		NO_STYLISTIC_ALTERNATES = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_ONE_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_ONE_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_TWO_ON = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_TWO_OFF = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_THREE_ON = 6,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_THREE_OFF = 7,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_FOUR_ON = 8,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_FOUR_OFF = 9,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_FIVE_ON = 10,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_FIVE_OFF = 11,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_SIX_ON = 12,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_SIX_OFF = 13,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_SEVEN_ON = 14,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_SEVEN_OFF = 15,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_EIGHT_ON = 16,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_EIGHT_OFF = 17,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_NINE_ON = 18,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_NINE_OFF = 19,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_TEN_ON = 20,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_TEN_OFF = 21,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_ELEVEN_ON = 22,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_ELEVEN_OFF = 23,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_TWELVE_ON = 24,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_TWELVE_OFF = 25,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_THIRTEEN_ON = 26,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_THIRTEEN_OFF = 27,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_FOURTEEN_ON = 28,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_FOURTEEN_OFF = 29,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_FIFTEEN_ON = 30,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_FIFTEEN_OFF = 31,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_SIXTEEN_ON = 32,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_SIXTEEN_OFF = 33,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_SEVENTEEN_ON = 34,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_SEVENTEEN_OFF = 35,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_EIGHTEEN_ON = 36,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_EIGHTEEN_OFF = 37,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_NINETEEN_ON = 38,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_NINETEEN_OFF = 39,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_TWENTY_ON = 40,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_STYLISTIC_ALTERNATIVES
		 */
		STYLISTIC_ALT_TWENTY_OFF = 41,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CONTEXTUAL_ALTERNATIVES
		 */
		CONTEXTUAL_ALTERNATES_ON = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CONTEXTUAL_ALTERNATIVES
		 */
		CONTEXTUAL_ALTERNATES_OFF = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CONTEXTUAL_ALTERNATIVES
		 */
		SWASH_ALTERNATES_ON = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CONTEXTUAL_ALTERNATIVES
		 */
		SWASH_ALTERNATES_OFF = 3,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CONTEXTUAL_ALTERNATIVES
		 */
		CONTEXTUAL_SWASH_ALTERNATES_ON = 4,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CONTEXTUAL_ALTERNATIVES
		 */
		CONTEXTUAL_SWASH_ALTERNATES_OFF = 5,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LOWER_CASE
		 */
		DEFAULT_LOWER_CASE = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LOWER_CASE
		 */
		LOWER_CASE_SMALL_CAPS = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_LOWER_CASE
		 */
		LOWER_CASE_PETITE_CAPS = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_UPPER_CASE
		 */
		DEFAULT_UPPER_CASE = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_UPPER_CASE
		 */
		UPPER_CASE_SMALL_CAPS = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_UPPER_CASE
		 */
		UPPER_CASE_PETITE_CAPS = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_ROMAN_SPACING_TYPE
		 */
		HALF_WIDTH_CJK_ROMAN = 0,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_ROMAN_SPACING_TYPE
		 */
		PROPORTIONAL_CJK_ROMAN = 1,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_ROMAN_SPACING_TYPE
		 */
		DEFAULT_CJK_ROMAN = 2,
		/**
		 * for #HB_AAT_LAYOUT_FEATURE_TYPE_CJK_ROMAN_SPACING_TYPE
		 */
		FULL_WIDTH_CJK_ROMAN = 3
	}

	/**
	 * The possible feature types defined for AAT shaping, from Apple [Font Feature Registry](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html).
	 */
	enum aat_layout_feature_type_t {
		/**
		 * Initial, unset feature type
		 */
		INVALID = 65535,
		/**
		 * [All Typographic Features](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type0)
		 */
		ALL_TYPOGRAPHIC = 0,
		/**
		 * [Ligatures](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type1)
		 */
		LIGATURES = 1,
		/**
		 * [Cursive Connection](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type2)
		 */
		CURISVE_CONNECTION = 2,
		/**
		 * [Letter Case](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type3)
		 */
		LETTER_CASE = 3,
		/**
		 * [Vertical Substitution](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type4)
		 */
		VERTICAL_SUBSTITUTION = 4,
		/**
		 * [Linguistic Rearrangement](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type5)
		 */
		LINGUISTIC_REARRANGEMENT = 5,
		/**
		 * [Number Spacing](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type6)
		 */
		NUMBER_SPACING = 6,
		/**
		 * [Smart Swash](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type8)
		 */
		SMART_SWASH_TYPE = 8,
		/**
		 * [Diacritics](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type9)
		 */
		DIACRITICS_TYPE = 9,
		/**
		 * [Vertical Position](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type10)
		 */
		VERTICAL_POSITION = 10,
		/**
		 * [Fractions](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type11)
		 */
		FRACTIONS = 11,
		/**
		 * [Overlapping Characters](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type13)
		 */
		OVERLAPPING_CHARACTERS_TYPE = 13,
		/**
		 * [Typographic Extras](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type14)
		 */
		TYPOGRAPHIC_EXTRAS = 14,
		/**
		 * [Mathematical Extras](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type15)
		 */
		MATHEMATICAL_EXTRAS = 15,
		/**
		 * [Ornament Sets](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type16)
		 */
		ORNAMENT_SETS_TYPE = 16,
		/**
		 * [Character Alternatives](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type17)
		 */
		CHARACTER_ALTERNATIVES = 17,
		/**
		 * [Design Complexity](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type18)
		 */
		DESIGN_COMPLEXITY_TYPE = 18,
		/**
		 * [Style Options](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type19)
		 */
		STYLE_OPTIONS = 19,
		/**
		 * [Character Shape](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type20)
		 */
		CHARACTER_SHAPE = 20,
		/**
		 * [Number Case](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type21)
		 */
		NUMBER_CASE = 21,
		/**
		 * [Text Spacing](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type22)
		 */
		TEXT_SPACING = 22,
		/**
		 * [Transliteration](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type23)
		 */
		TRANSLITERATION = 23,
		/**
		 * [Annotation](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type24)
		 */
		ANNOTATION_TYPE = 24,
		/**
		 * [Kana Spacing](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type25)
		 */
		KANA_SPACING_TYPE = 25,
		/**
		 * [Ideographic Spacing](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type26)
		 */
		IDEOGRAPHIC_SPACING_TYPE = 26,
		/**
		 * [Unicode Decomposition](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type27)
		 */
		UNICODE_DECOMPOSITION_TYPE = 27,
		/**
		 * [Ruby Kana](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type28)
		 */
		RUBY_KANA = 28,
		/**
		 * [CJK Symbol Alternatives](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type29)
		 */
		CJK_SYMBOL_ALTERNATIVES_TYPE = 29,
		/**
		 * [Ideographic Alternatives](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type30)
		 */
		IDEOGRAPHIC_ALTERNATIVES_TYPE = 30,
		/**
		 * [CJK Vertical Roman Placement](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type31)
		 */
		CJK_VERTICAL_ROMAN_PLACEMENT_TYPE = 31,
		/**
		 * [Italic CJK Roman](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type32)
		 */
		ITALIC_CJK_ROMAN = 32,
		/**
		 * [Case Sensitive Layout](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type33)
		 */
		CASE_SENSITIVE_LAYOUT = 33,
		/**
		 * [Alternate Kana](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type34)
		 */
		ALTERNATE_KANA = 34,
		/**
		 * [Stylistic Alternatives](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type35)
		 */
		STYLISTIC_ALTERNATIVES = 35,
		/**
		 * [Contextual Alternatives](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type36)
		 */
		CONTEXTUAL_ALTERNATIVES = 36,
		/**
		 * [Lower Case](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type37)
		 */
		LOWER_CASE = 37,
		/**
		 * [Upper Case](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type38)
		 */
		UPPER_CASE = 38,
		/**
		 * [Language Tag](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type39)
		 */
		LANGUAGE_TAG_TYPE = 39,
		/**
		 * [CJK Roman Spacing](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM09/AppendixF.html#Type103)
		 */
		CJK_ROMAN_SPACING_TYPE = 103
	}

	/**
	 * Data type for holding HarfBuzz's clustering behavior options. The cluster level
	 * dictates one aspect of how HarfBuzz will treat non-base characters
	 * during shaping.
	 * 
	 * In #HB_BUFFER_CLUSTER_LEVEL_MONOTONE_GRAPHEMES, non-base
	 * characters are merged into the cluster of the base character that precedes them.
	 * 
	 * In #HB_BUFFER_CLUSTER_LEVEL_MONOTONE_CHARACTERS, non-base characters are initially
	 * assigned their own cluster values, which are not merged into preceding base
	 * clusters. This allows HarfBuzz to perform additional operations like reorder
	 * sequences of adjacent marks.
	 * 
	 * #HB_BUFFER_CLUSTER_LEVEL_MONOTONE_GRAPHEMES is the default, because it maintains
	 * backward compatibility with older versions of HarfBuzz. New client programs that
	 * do not need to maintain such backward compatibility are recommended to use
	 * #HB_BUFFER_CLUSTER_LEVEL_MONOTONE_CHARACTERS instead of the default.
	 */
	enum buffer_cluster_level_t {
		/**
		 * Return cluster values grouped by graphemes into
		 *   monotone order.
		 */
		MONOTONE_GRAPHEMES = 0,
		/**
		 * Return cluster values grouped into monotone order.
		 */
		MONOTONE_CHARACTERS = 1,
		/**
		 * Don't group cluster values.
		 */
		CHARACTERS = 2,
		/**
		 * Default cluster level,
		 *   equal to #HB_BUFFER_CLUSTER_LEVEL_MONOTONE_GRAPHEMES.
		 */
		DEFAULT = 0
	}

	/**
	 * The type of #hb_buffer_t contents.
	 */
	enum buffer_content_type_t {
		/**
		 * Initial value for new buffer.
		 */
		INVALID = 0,
		/**
		 * The buffer contains input characters (before shaping).
		 */
		UNICODE = 1,
		/**
		 * The buffer contains output glyphs (after shaping).
		 */
		GLYPHS = 2
	}

	/**
	 * The buffer serialization and de-serialization format used in
	 * {@link Hb.buffer_serialize_glyphs} and hb_buffer_deserialize_glyphs().
	 */
	enum buffer_serialize_format_t {
		/**
		 * a human-readable, plain text format.
		 */
		TEXT = 1413830740,
		/**
		 * a machine-readable JSON format.
		 */
		JSON = 1246973774,
		/**
		 * invalid format.
		 */
		INVALID = 0
	}

	/**
	 * The direction of a text segment or buffer.
	 * 
	 * A segment can also be tested for horizontal or vertical
	 * orientation (irrespective of specific direction) with
	 * {@link HB.DIRECTION_IS_HORIZONTAL} or HB_DIRECTION_IS_VERTICAL().
	 */
	enum direction_t {
		/**
		 * Initial, unset direction.
		 */
		INVALID = 0,
		/**
		 * Text is set horizontally from left to right.
		 */
		LTR = 4,
		/**
		 * Text is set horizontally from right to left.
		 */
		RTL = 5,
		/**
		 * Text is set vertically from top to bottom.
		 */
		TTB = 6,
		/**
		 * Text is set vertically from bottom to top.
		 */
		BTT = 7
	}

	/**
	 * Data type holding the memory modes available to
	 * client programs.
	 * 
	 * Regarding these various memory-modes:
	 * 
	 * - In no case shall the HarfBuzz client modify memory
	 *   that is passed to HarfBuzz in a blob.  If there is
	 *   any such possibility, #HB_MEMORY_MODE_DUPLICATE should be used
	 *   such that HarfBuzz makes a copy immediately,
	 * 
	 * - Use #HB_MEMORY_MODE_READONLY otherwise, unless you really really
	 *   really know what you are doing,
	 * 
	 * - #HB_MEMORY_MODE_WRITABLE is appropriate if you really made a
	 *   copy of data solely for the purpose of passing to
	 *   HarfBuzz and doing that just once (no reuse!),
	 * 
	 * - If the font is mmap()ed, it's okay to use
	 *   #HB_MEMORY_READONLY_MAY_MAKE_WRITABLE, however, using that mode
	 *   correctly is very tricky.  Use #HB_MEMORY_MODE_READONLY instead.
	 */
	enum memory_mode_t {
		/**
		 * HarfBuzz immediately makes a copy of the data.
		 */
		DUPLICATE = 0,
		/**
		 * HarfBuzz client will never modify the data,
		 *     and HarfBuzz will never modify the data.
		 */
		READONLY = 1,
		/**
		 * HarfBuzz client made a copy of the data solely
		 *     for HarfBuzz, so HarfBuzz may modify the data.
		 */
		WRITABLE = 2,
		/**
		 * See above
		 */
		READONLY_MAY_MAKE_WRITABLE = 3
	}

	/**
	 * Baseline tags from [Baseline Tags](https://docs.microsoft.com/en-us/typography/opentype/spec/baselinetags) registry.
	 */
	enum ot_layout_baseline_tag_t {
		/**
		 * The baseline used by alphabetic scripts such as Latin, Cyrillic and Greek.
		 * In vertical writing mode, the alphabetic baseline for characters rotated 90 degrees clockwise.
		 * (This would not apply to alphabetic characters that remain upright in vertical writing mode, since these
		 * characters are not rotated.)
		 */
		ROMAN = 1919905134,
		/**
		 * The hanging baseline. In horizontal direction, this is the horizontal
		 * line from which syllables seem, to hang in Tibetan and other similar scripts. In vertical writing mode,
		 * for Tibetan (or some other similar script) characters rotated 90 degrees clockwise.
		 */
		HANGING = 1751215719,
		/**
		 * Ideographic character face bottom or left edge,
		 * if the direction is horizontal or vertical, respectively.
		 */
		IDEO_FACE_BOTTOM_OR_LEFT = 1768121954,
		/**
		 * Ideographic character face top or right edge,
		 * if the direction is horizontal or vertical, respectively.
		 */
		IDEO_FACE_TOP_OR_RIGHT = 1768121972,
		/**
		 * Ideographic em-box bottom or left edge,
		 * if the direction is horizontal or vertical, respectively.
		 */
		IDEO_EMBOX_BOTTOM_OR_LEFT = 1768187247,
		/**
		 * Ideographic em-box top or right edge baseline,
		 * if the direction is horizontal or vertical, respectively.
		 */
		IDEO_EMBOX_TOP_OR_RIGHT = 1768191088,
		/**
		 * The baseline about which mathematical characters are centered.
		 * In vertical writing mode when mathematical characters rotated 90 degrees clockwise, are centered.
		 */
		MATH = 1835103336
	}

	/**
	 * The GDEF classes defined for glyphs.
	 */
	enum ot_layout_glyph_class_t {
		/**
		 * Glyphs not matching the other classifications
		 */
		UNCLASSIFIED = 0,
		/**
		 * Spacing, single characters, capable of accepting marks
		 */
		BASE_GLYPH = 1,
		/**
		 * Glyphs that represent ligation of multiple characters
		 */
		LIGATURE = 2,
		/**
		 * Non-spacing, combining glyphs that represent marks
		 */
		MARK = 3,
		/**
		 * Spacing glyphs that represent part of a single character
		 */
		COMPONENT = 4
	}

	/**
	 * The 'MATH' table constants, refer to
	 * [OpenType documentation](https://docs.microsoft.com/en-us/typography/opentype/spec/math#mathconstants-table)
	 * For more explanations.
	 */
	enum ot_math_constant_t {
		/**
		 * scriptPercentScaleDown
		 */
		SCRIPT_PERCENT_SCALE_DOWN = 0,
		/**
		 * scriptScriptPercentScaleDown
		 */
		SCRIPT_SCRIPT_PERCENT_SCALE_DOWN = 1,
		/**
		 * delimitedSubFormulaMinHeight
		 */
		DELIMITED_SUB_FORMULA_MIN_HEIGHT = 2,
		/**
		 * displayOperatorMinHeight
		 */
		DISPLAY_OPERATOR_MIN_HEIGHT = 3,
		/**
		 * mathLeading
		 */
		MATH_LEADING = 4,
		/**
		 * axisHeight
		 */
		AXIS_HEIGHT = 5,
		/**
		 * accentBaseHeight
		 */
		ACCENT_BASE_HEIGHT = 6,
		/**
		 * flattenedAccentBaseHeight
		 */
		FLATTENED_ACCENT_BASE_HEIGHT = 7,
		/**
		 * subscriptShiftDown
		 */
		SUBSCRIPT_SHIFT_DOWN = 8,
		/**
		 * subscriptTopMax
		 */
		SUBSCRIPT_TOP_MAX = 9,
		/**
		 * subscriptBaselineDropMin
		 */
		SUBSCRIPT_BASELINE_DROP_MIN = 10,
		/**
		 * superscriptShiftUp
		 */
		SUPERSCRIPT_SHIFT_UP = 11,
		/**
		 * superscriptShiftUpCramped
		 */
		SUPERSCRIPT_SHIFT_UP_CRAMPED = 12,
		/**
		 * superscriptBottomMin
		 */
		SUPERSCRIPT_BOTTOM_MIN = 13,
		/**
		 * superscriptBaselineDropMax
		 */
		SUPERSCRIPT_BASELINE_DROP_MAX = 14,
		/**
		 * subSuperscriptGapMin
		 */
		SUB_SUPERSCRIPT_GAP_MIN = 15,
		/**
		 * superscriptBottomMaxWithSubscript
		 */
		SUPERSCRIPT_BOTTOM_MAX_WITH_SUBSCRIPT = 16,
		/**
		 * spaceAfterScript
		 */
		SPACE_AFTER_SCRIPT = 17,
		/**
		 * upperLimitGapMin
		 */
		UPPER_LIMIT_GAP_MIN = 18,
		/**
		 * upperLimitBaselineRiseMin
		 */
		UPPER_LIMIT_BASELINE_RISE_MIN = 19,
		/**
		 * lowerLimitGapMin
		 */
		LOWER_LIMIT_GAP_MIN = 20,
		/**
		 * lowerLimitBaselineDropMin
		 */
		LOWER_LIMIT_BASELINE_DROP_MIN = 21,
		/**
		 * stackTopShiftUp
		 */
		STACK_TOP_SHIFT_UP = 22,
		/**
		 * stackTopDisplayStyleShiftUp
		 */
		STACK_TOP_DISPLAY_STYLE_SHIFT_UP = 23,
		/**
		 * stackBottomShiftDown
		 */
		STACK_BOTTOM_SHIFT_DOWN = 24,
		/**
		 * stackBottomDisplayStyleShiftDown
		 */
		STACK_BOTTOM_DISPLAY_STYLE_SHIFT_DOWN = 25,
		/**
		 * stackGapMin
		 */
		STACK_GAP_MIN = 26,
		/**
		 * stackDisplayStyleGapMin
		 */
		STACK_DISPLAY_STYLE_GAP_MIN = 27,
		/**
		 * stretchStackTopShiftUp
		 */
		STRETCH_STACK_TOP_SHIFT_UP = 28,
		/**
		 * stretchStackBottomShiftDown
		 */
		STRETCH_STACK_BOTTOM_SHIFT_DOWN = 29,
		/**
		 * stretchStackGapAboveMin
		 */
		STRETCH_STACK_GAP_ABOVE_MIN = 30,
		/**
		 * stretchStackGapBelowMin
		 */
		STRETCH_STACK_GAP_BELOW_MIN = 31,
		/**
		 * fractionNumeratorShiftUp
		 */
		FRACTION_NUMERATOR_SHIFT_UP = 32,
		/**
		 * fractionNumeratorDisplayStyleShiftUp
		 */
		FRACTION_NUMERATOR_DISPLAY_STYLE_SHIFT_UP = 33,
		/**
		 * fractionDenominatorShiftDown
		 */
		FRACTION_DENOMINATOR_SHIFT_DOWN = 34,
		/**
		 * fractionDenominatorDisplayStyleShiftDown
		 */
		FRACTION_DENOMINATOR_DISPLAY_STYLE_SHIFT_DOWN = 35,
		/**
		 * fractionNumeratorGapMin
		 */
		FRACTION_NUMERATOR_GAP_MIN = 36,
		/**
		 * fractionNumDisplayStyleGapMin
		 */
		FRACTION_NUM_DISPLAY_STYLE_GAP_MIN = 37,
		/**
		 * fractionRuleThickness
		 */
		FRACTION_RULE_THICKNESS = 38,
		/**
		 * fractionDenominatorGapMin
		 */
		FRACTION_DENOMINATOR_GAP_MIN = 39,
		/**
		 * fractionDenomDisplayStyleGapMin
		 */
		FRACTION_DENOM_DISPLAY_STYLE_GAP_MIN = 40,
		/**
		 * skewedFractionHorizontalGap
		 */
		SKEWED_FRACTION_HORIZONTAL_GAP = 41,
		/**
		 * skewedFractionVerticalGap
		 */
		SKEWED_FRACTION_VERTICAL_GAP = 42,
		/**
		 * overbarVerticalGap
		 */
		OVERBAR_VERTICAL_GAP = 43,
		/**
		 * overbarRuleThickness
		 */
		OVERBAR_RULE_THICKNESS = 44,
		/**
		 * overbarExtraAscender
		 */
		OVERBAR_EXTRA_ASCENDER = 45,
		/**
		 * underbarVerticalGap
		 */
		UNDERBAR_VERTICAL_GAP = 46,
		/**
		 * underbarRuleThickness
		 */
		UNDERBAR_RULE_THICKNESS = 47,
		/**
		 * underbarExtraDescender
		 */
		UNDERBAR_EXTRA_DESCENDER = 48,
		/**
		 * radicalVerticalGap
		 */
		RADICAL_VERTICAL_GAP = 49,
		/**
		 * radicalDisplayStyleVerticalGap
		 */
		RADICAL_DISPLAY_STYLE_VERTICAL_GAP = 50,
		/**
		 * radicalRuleThickness
		 */
		RADICAL_RULE_THICKNESS = 51,
		/**
		 * radicalExtraAscender
		 */
		RADICAL_EXTRA_ASCENDER = 52,
		/**
		 * radicalKernBeforeDegree
		 */
		RADICAL_KERN_BEFORE_DEGREE = 53,
		/**
		 * radicalKernAfterDegree
		 */
		RADICAL_KERN_AFTER_DEGREE = 54,
		/**
		 * radicalDegreeBottomRaisePercent
		 */
		RADICAL_DEGREE_BOTTOM_RAISE_PERCENT = 55
	}

	/**
	 * The math kerning-table types defined for the four corners
	 * of a glyph.
	 */
	enum ot_math_kern_t {
		/**
		 * The top right corner of the glyph.
		 */
		TOP_RIGHT = 0,
		/**
		 * The top left corner of the glyph.
		 */
		TOP_LEFT = 1,
		/**
		 * The bottom right corner of the glyph.
		 */
		BOTTOM_RIGHT = 2,
		/**
		 * The bottom left corner of the glyph.
		 */
		BOTTOM_LEFT = 3
	}

	/**
	 * Known metadata tags from https://docs.microsoft.com/en-us/typography/opentype/spec/meta
	 */
	enum ot_meta_tag_t {
		/**
		 * Design languages. Text, using only
		 * Basic Latin (ASCII) characters. Indicates languages and/or scripts
		 * for the user audiences that the font was primarily designed for.
		 */
		DESIGN_LANGUAGES = 1684827751,
		/**
		 * Supported languages. Text, using
		 * only Basic Latin (ASCII) characters. Indicates languages and/or scripts
		 * that the font is declared to be capable of supporting.
		 */
		SUPPORTED_LANGUAGES = 1936485991
	}

	/**
	 * Metric tags corresponding to [MVAR Value
	 * Tags](https://docs.microsoft.com/en-us/typography/opentype/spec/mvar#value-tags)
	 */
	enum ot_metrics_tag_t {
		/**
		 * horizontal ascender.
		 */
		HORIZONTAL_ASCENDER = 1751216995,
		/**
		 * horizontal descender.
		 */
		HORIZONTAL_DESCENDER = 1751413603,
		/**
		 * horizontal line gap.
		 */
		HORIZONTAL_LINE_GAP = 1751934832,
		/**
		 * horizontal clipping ascent.
		 */
		HORIZONTAL_CLIPPING_ASCENT = 1751346273,
		/**
		 * horizontal clipping descent.
		 */
		HORIZONTAL_CLIPPING_DESCENT = 1751346276,
		/**
		 * vertical ascender.
		 */
		VERTICAL_ASCENDER = 1986098019,
		/**
		 * vertical descender.
		 */
		VERTICAL_DESCENDER = 1986294627,
		/**
		 * vertical line gap.
		 */
		VERTICAL_LINE_GAP = 1986815856,
		/**
		 * horizontal caret rise.
		 */
		HORIZONTAL_CARET_RISE = 1751347827,
		/**
		 * horizontal caret run.
		 */
		HORIZONTAL_CARET_RUN = 1751347822,
		/**
		 * horizontal caret offset.
		 */
		HORIZONTAL_CARET_OFFSET = 1751347046,
		/**
		 * vertical caret rise.
		 */
		VERTICAL_CARET_RISE = 1986228851,
		/**
		 * vertical caret run.
		 */
		VERTICAL_CARET_RUN = 1986228846,
		/**
		 * vertical caret offset.
		 */
		VERTICAL_CARET_OFFSET = 1986228070,
		/**
		 * x height.
		 */
		X_HEIGHT = 2020108148,
		/**
		 * cap height.
		 */
		CAP_HEIGHT = 1668311156,
		/**
		 * subscript em x size.
		 */
		SUBSCRIPT_EM_X_SIZE = 1935833203,
		/**
		 * subscript em y size.
		 */
		SUBSCRIPT_EM_Y_SIZE = 1935833459,
		/**
		 * subscript em x offset.
		 */
		SUBSCRIPT_EM_X_OFFSET = 1935833199,
		/**
		 * subscript em y offset.
		 */
		SUBSCRIPT_EM_Y_OFFSET = 1935833455,
		/**
		 * superscript em x size.
		 */
		SUPERSCRIPT_EM_X_SIZE = 1936750707,
		/**
		 * superscript em y size.
		 */
		SUPERSCRIPT_EM_Y_SIZE = 1936750963,
		/**
		 * superscript em x offset.
		 */
		SUPERSCRIPT_EM_X_OFFSET = 1936750703,
		/**
		 * superscript em y offset.
		 */
		SUPERSCRIPT_EM_Y_OFFSET = 1936750959,
		/**
		 * strikeout size.
		 */
		STRIKEOUT_SIZE = 1937011315,
		/**
		 * strikeout offset.
		 */
		STRIKEOUT_OFFSET = 1937011311,
		/**
		 * underline size.
		 */
		UNDERLINE_SIZE = 1970168947,
		/**
		 * underline offset.
		 */
		UNDERLINE_OFFSET = 1970168943
	}

	/**
	 * Data type for scripts. Each #hb_script_t's value is an #hb_tag_t corresponding
	 * to the four-letter values defined by [ISO 15924](https://unicode.org/iso15924/).
	 * 
	 * See also the Script (sc) property of the Unicode Character Database.
	 */
	enum script_t {
		/**
		 * `Zyyy`
		 */
		COMMON = 1517910393,
		/**
		 * `Zinh`
		 */
		INHERITED = 1516858984,
		/**
		 * `Zzzz`
		 */
		UNKNOWN = 1517976186,
		/**
		 * `Arab`
		 */
		ARABIC = 1098015074,
		/**
		 * `Armn`
		 */
		ARMENIAN = 1098018158,
		/**
		 * `Beng`
		 */
		BENGALI = 1113943655,
		/**
		 * `Cyrl`
		 */
		CYRILLIC = 1132032620,
		/**
		 * `Deva`
		 */
		DEVANAGARI = 1147500129,
		/**
		 * `Geor`
		 */
		GEORGIAN = 1197830002,
		/**
		 * `Grek`
		 */
		GREEK = 1198679403,
		/**
		 * `Gujr`
		 */
		GUJARATI = 1198877298,
		/**
		 * `Guru`
		 */
		GURMUKHI = 1198879349,
		/**
		 * `Hang`
		 */
		HANGUL = 1214344807,
		/**
		 * `Hani`
		 */
		HAN = 1214344809,
		/**
		 * `Hebr`
		 */
		HEBREW = 1214603890,
		/**
		 * `Hira`
		 */
		HIRAGANA = 1214870113,
		/**
		 * `Knda`
		 */
		KANNADA = 1265525857,
		/**
		 * `Kana`
		 */
		KATAKANA = 1264676449,
		/**
		 * `Laoo`
		 */
		LAO = 1281453935,
		/**
		 * `Latn`
		 */
		LATIN = 1281455214,
		/**
		 * `Mlym`
		 */
		MALAYALAM = 1298954605,
		/**
		 * `Orya`
		 */
		ORIYA = 1332902241,
		/**
		 * `Taml`
		 */
		TAMIL = 1415671148,
		/**
		 * `Telu`
		 */
		TELUGU = 1415933045,
		/**
		 * `Thai`
		 */
		THAI = 1416126825,
		/**
		 * `Tibt`
		 */
		TIBETAN = 1416192628,
		/**
		 * `Bopo`
		 */
		BOPOMOFO = 1114599535,
		/**
		 * `Brai`
		 */
		BRAILLE = 1114792297,
		/**
		 * `Cans`
		 */
		CANADIAN_SYLLABICS = 1130458739,
		/**
		 * `Cher`
		 */
		CHEROKEE = 1130915186,
		/**
		 * `Ethi`
		 */
		ETHIOPIC = 1165256809,
		/**
		 * `Khmr`
		 */
		KHMER = 1265134962,
		/**
		 * `Mong`
		 */
		MONGOLIAN = 1299148391,
		/**
		 * `Mymr`
		 */
		MYANMAR = 1299803506,
		/**
		 * `Ogam`
		 */
		OGHAM = 1332175213,
		/**
		 * `Runr`
		 */
		RUNIC = 1383427698,
		/**
		 * `Sinh`
		 */
		SINHALA = 1399418472,
		/**
		 * `Syrc`
		 */
		SYRIAC = 1400468067,
		/**
		 * `Thaa`
		 */
		THAANA = 1416126817,
		/**
		 * `Yiii`
		 */
		YI = 1500080489,
		/**
		 * `Dsrt`
		 */
		DESERET = 1148416628,
		/**
		 * `Goth`
		 */
		GOTHIC = 1198486632,
		/**
		 * `Ital`
		 */
		OLD_ITALIC = 1232363884,
		/**
		 * `Buhd`
		 */
		BUHID = 1114990692,
		/**
		 * `Hano`
		 */
		HANUNOO = 1214344815,
		/**
		 * `Tglg`
		 */
		TAGALOG = 1416064103,
		/**
		 * `Tagb`
		 */
		TAGBANWA = 1415669602,
		/**
		 * `Cprt`
		 */
		CYPRIOT = 1131442804,
		/**
		 * `Limb`
		 */
		LIMBU = 1281977698,
		/**
		 * `Linb`
		 */
		LINEAR_B = 1281977954,
		/**
		 * `Osma`
		 */
		OSMANYA = 1332964705,
		/**
		 * `Shaw`
		 */
		SHAVIAN = 1399349623,
		/**
		 * `Tale`
		 */
		TAI_LE = 1415670885,
		/**
		 * `Ugar`
		 */
		UGARITIC = 1432838514,
		/**
		 * `Bugi`
		 */
		BUGINESE = 1114990441,
		/**
		 * `Copt`
		 */
		COPTIC = 1131376756,
		/**
		 * `Glag`
		 */
		GLAGOLITIC = 1198285159,
		/**
		 * `Khar`
		 */
		KHAROSHTHI = 1265131890,
		/**
		 * `Talu`
		 */
		NEW_TAI_LUE = 1415670901,
		/**
		 * `Xpeo`
		 */
		OLD_PERSIAN = 1483761007,
		/**
		 * `Sylo`
		 */
		SYLOTI_NAGRI = 1400466543,
		/**
		 * `Tfng`
		 */
		TIFINAGH = 1415999079,
		/**
		 * `Bali`
		 */
		BALINESE = 1113681001,
		/**
		 * `Xsux`
		 */
		CUNEIFORM = 1483961720,
		/**
		 * `Nkoo`
		 */
		NKO = 1315663727,
		/**
		 * `Phag`
		 */
		PHAGS_PA = 1349017959,
		/**
		 * `Phnx`
		 */
		PHOENICIAN = 1349021304,
		/**
		 * `Cari`
		 */
		CARIAN = 1130459753,
		/**
		 * `Cham`
		 */
		CHAM = 1130914157,
		/**
		 * `Kali`
		 */
		KAYAH_LI = 1264675945,
		/**
		 * `Lepc`
		 */
		LEPCHA = 1281716323,
		/**
		 * `Lyci`
		 */
		LYCIAN = 1283023721,
		/**
		 * `Lydi`
		 */
		LYDIAN = 1283023977,
		/**
		 * `Olck`
		 */
		OL_CHIKI = 1332503403,
		/**
		 * `Rjng`
		 */
		REJANG = 1382706791,
		/**
		 * `Saur`
		 */
		SAURASHTRA = 1398895986,
		/**
		 * `Sund`
		 */
		SUNDANESE = 1400204900,
		/**
		 * `Vaii`
		 */
		VAI = 1449224553,
		/**
		 * `Avst`
		 */
		AVESTAN = 1098281844,
		/**
		 * `Bamu`
		 */
		BAMUM = 1113681269,
		/**
		 * `Egyp`
		 */
		EGYPTIAN_HIEROGLYPHS = 1164409200,
		/**
		 * `Armi`
		 */
		IMPERIAL_ARAMAIC = 1098018153,
		/**
		 * `Phli`
		 */
		INSCRIPTIONAL_PAHLAVI = 1349020777,
		/**
		 * `Prti`
		 */
		INSCRIPTIONAL_PARTHIAN = 1349678185,
		/**
		 * `Java`
		 */
		JAVANESE = 1247901281,
		/**
		 * `Kthi`
		 */
		KAITHI = 1265920105,
		/**
		 * `Lisu`
		 */
		LISU = 1281979253,
		/**
		 * `Mtei`
		 */
		MEETEI_MAYEK = 1299473769,
		/**
		 * `Sarb`
		 */
		OLD_SOUTH_ARABIAN = 1398895202,
		/**
		 * `Orkh`
		 */
		OLD_TURKIC = 1332898664,
		/**
		 * `Samr`
		 */
		SAMARITAN = 1398893938,
		/**
		 * `Lana`
		 */
		TAI_THAM = 1281453665,
		/**
		 * `Tavt`
		 */
		TAI_VIET = 1415673460,
		/**
		 * `Batk`
		 */
		BATAK = 1113683051,
		/**
		 * `Brah`
		 */
		BRAHMI = 1114792296,
		/**
		 * `Mand`
		 */
		MANDAIC = 1298230884,
		/**
		 * `Cakm`
		 */
		CHAKMA = 1130457965,
		/**
		 * `Merc`
		 */
		MEROITIC_CURSIVE = 1298494051,
		/**
		 * `Mero`
		 */
		MEROITIC_HIEROGLYPHS = 1298494063,
		/**
		 * `Plrd`
		 */
		MIAO = 1349284452,
		/**
		 * `Shrd`
		 */
		SHARADA = 1399353956,
		/**
		 * `Sora`
		 */
		SORA_SOMPENG = 1399812705,
		/**
		 * `Takr`
		 */
		TAKRI = 1415670642,
		/**
		 * `Bass`, Since: 0.9.30
		 */
		BASSA_VAH = 1113682803,
		/**
		 * `Aghb`, Since: 0.9.30
		 */
		CAUCASIAN_ALBANIAN = 1097295970,
		/**
		 * `Dupl`, Since: 0.9.30
		 */
		DUPLOYAN = 1148547180,
		/**
		 * `Elba`, Since: 0.9.30
		 */
		ELBASAN = 1164730977,
		/**
		 * `Gran`, Since: 0.9.30
		 */
		GRANTHA = 1198678382,
		/**
		 * `Khoj`, Since: 0.9.30
		 */
		KHOJKI = 1265135466,
		/**
		 * `Sind`, Since: 0.9.30
		 */
		KHUDAWADI = 1399418468,
		/**
		 * `Lina`, Since: 0.9.30
		 */
		LINEAR_A = 1281977953,
		/**
		 * `Mahj`, Since: 0.9.30
		 */
		MAHAJANI = 1298229354,
		/**
		 * `Mani`, Since: 0.9.30
		 */
		MANICHAEAN = 1298230889,
		/**
		 * `Mend`, Since: 0.9.30
		 */
		MENDE_KIKAKUI = 1298493028,
		/**
		 * `Modi`, Since: 0.9.30
		 */
		MODI = 1299145833,
		/**
		 * `Mroo`, Since: 0.9.30
		 */
		MRO = 1299345263,
		/**
		 * `Nbat`, Since: 0.9.30
		 */
		NABATAEAN = 1315070324,
		/**
		 * `Narb`, Since: 0.9.30
		 */
		OLD_NORTH_ARABIAN = 1315009122,
		/**
		 * `Perm`, Since: 0.9.30
		 */
		OLD_PERMIC = 1348825709,
		/**
		 * `Hmng`, Since: 0.9.30
		 */
		PAHAWH_HMONG = 1215131239,
		/**
		 * `Palm`, Since: 0.9.30
		 */
		PALMYRENE = 1348562029,
		/**
		 * `Pauc`, Since: 0.9.30
		 */
		PAU_CIN_HAU = 1348564323,
		/**
		 * `Phlp`, Since: 0.9.30
		 */
		PSALTER_PAHLAVI = 1349020784,
		/**
		 * `Sidd`, Since: 0.9.30
		 */
		SIDDHAM = 1399415908,
		/**
		 * `Tirh`, Since: 0.9.30
		 */
		TIRHUTA = 1416196712,
		/**
		 * `Wara`, Since: 0.9.30
		 */
		WARANG_CITI = 1466004065,
		/**
		 * `Ahom`, Since: 0.9.30
		 */
		AHOM = 1097363309,
		/**
		 * `Hluw`, Since: 0.9.30
		 */
		ANATOLIAN_HIEROGLYPHS = 1215067511,
		/**
		 * `Hatr`, Since: 0.9.30
		 */
		HATRAN = 1214346354,
		/**
		 * `Mult`, Since: 0.9.30
		 */
		MULTANI = 1299541108,
		/**
		 * `Hung`, Since: 0.9.30
		 */
		OLD_HUNGARIAN = 1215655527,
		/**
		 * `Sgnw`, Since: 0.9.30
		 */
		SIGNWRITING = 1399287415,
		/**
		 * `Adlm`, Since: 1.3.0
		 */
		ADLAM = 1097100397,
		/**
		 * `Bhks`, Since: 1.3.0
		 */
		BHAIKSUKI = 1114139507,
		/**
		 * `Marc`, Since: 1.3.0
		 */
		MARCHEN = 1298231907,
		/**
		 * `Osge`, Since: 1.3.0
		 */
		OSAGE = 1332963173,
		/**
		 * `Tang`, Since: 1.3.0
		 */
		TANGUT = 1415671399,
		/**
		 * `Newa`, Since: 1.3.0
		 */
		NEWA = 1315272545,
		/**
		 * `Gonm`, Since: 1.6.0
		 */
		MASARAM_GONDI = 1198485101,
		/**
		 * `Nshu`, Since: 1.6.0
		 */
		NUSHU = 1316186229,
		/**
		 * `Soyo`, Since: 1.6.0
		 */
		SOYOMBO = 1399814511,
		/**
		 * `Zanb`, Since: 1.6.0
		 */
		ZANABAZAR_SQUARE = 1516334690,
		/**
		 * `Dogr`, Since: 1.8.0
		 */
		DOGRA = 1148151666,
		/**
		 * `Gong`, Since: 1.8.0
		 */
		GUNJALA_GONDI = 1198485095,
		/**
		 * `Rohg`, Since: 1.8.0
		 */
		HANIFI_ROHINGYA = 1383032935,
		/**
		 * `Maka`, Since: 1.8.0
		 */
		MAKASAR = 1298230113,
		/**
		 * `Medf`, Since: 1.8.0
		 */
		MEDEFAIDRIN = 1298490470,
		/**
		 * `Sogo`, Since: 1.8.0
		 */
		OLD_SOGDIAN = 1399809903,
		/**
		 * `Sogd`, Since: 1.8.0
		 */
		SOGDIAN = 1399809892,
		/**
		 * `Elym`, Since: 2.4.0
		 */
		ELYMAIC = 1164736877,
		/**
		 * `Nand`, Since: 2.4.0
		 */
		NANDINAGARI = 1315008100,
		/**
		 * `Hmnp`, Since: 2.4.0
		 */
		NYIAKENG_PUACHUE_HMONG = 1215131248,
		/**
		 * `Wcho`, Since: 2.4.0
		 */
		WANCHO = 1466132591,
		/**
		 * `Chrs`, Since: 2.6.7
		 */
		CHORASMIAN = 1130918515,
		/**
		 * `Diak`, Since: 2.6.7
		 */
		DIVES_AKURU = 1147756907,
		/**
		 * `Kits`, Since: 2.6.7
		 */
		KHITAN_SMALL_SCRIPT = 1265202291,
		/**
		 * `Yezi`, Since: 2.6.7
		 */
		YEZIDI = 1499822697,
		/**
		 * `Cpmn`, Since: 3.0.0
		 */
		CYPRO_MINOAN = 1131441518,
		/**
		 * `Ougr`, Since: 3.0.0
		 */
		OLD_UYGHUR = 1333094258,
		/**
		 * `Tnsa`, Since: 3.0.0
		 */
		TANGSA = 1416524641,
		/**
		 * `Toto`, Since: 3.0.0
		 */
		TOTO = 1416590447,
		/**
		 * `Vith`, Since: 3.0.0
		 */
		VITHKUQI = 1449751656,
		/**
		 * No script set
		 */
		INVALID = 0
	}

	/**
	 * Defined by [OpenType Design-Variation Axis Tag Registry](https://docs.microsoft.com/en-us/typography/opentype/spec/dvaraxisreg).
	 */
	enum style_tag_t {
		/**
		 * Used to vary between non-italic and italic.
		 * A value of 0 can be interpreted as "Roman" (non-italic); a value of 1 can
		 * be interpreted as (fully) italic.
		 */
		ITALIC = 1769234796,
		/**
		 * Used to vary design to suit different text sizes.
		 * Non-zero. Values can be interpreted as text size, in points.
		 */
		OPTICAL_SIZE = 1869640570,
		/**
		 * Used to vary between upright and slanted text. Values
		 * must be greater than -90 and less than +90. Values can be interpreted as
		 * the angle, in counter-clockwise degrees, of oblique slant from whatever the
		 * designer considers to be upright for that font design.
		 */
		SLANT_ANGLE = 1936486004,
		/**
		 * same as #HB_STYLE_TAG_SLANT_ANGLE expression as ratio.
		 */
		SLANT_RATIO = 1399615092,
		/**
		 * Used to vary width of text from narrower to wider.
		 * Non-zero. Values can be interpreted as a percentage of whatever the font
		 * designer considers “normal width” for that font design.
		 */
		WIDTH = 2003072104,
		/**
		 * Used to vary stroke thicknesses or other design details
		 * to give variation from lighter to blacker. Values can be interpreted in direct
		 * comparison to values for usWeightClass in the OS/2 table,
		 * or the CSS font-weight property.
		 */
		WEIGHT = 2003265652
	}

	/**
	 * Data type for the Canonical_Combining_Class (ccc) property
	 * from the Unicode Character Database.
	 * 
	 * <note>Note: newer versions of Unicode may add new values.
	 * Client programs should be ready to handle any value in the 0..254 range
	 * being returned from {@link Hb.unicode_combining_class}.</note>
	 */
	enum unicode_combining_class_t {
		/**
		 * Spacing and enclosing marks; also many vowel and consonant signs, even if nonspacing
		 */
		NOT_REORDERED = 0,
		/**
		 * Marks which overlay a base letter or symbol
		 */
		OVERLAY = 1,
		/**
		 * Diacritic nukta marks in Brahmi-derived scripts
		 */
		NUKTA = 7,
		/**
		 * Hiragana/Katakana voicing marks
		 */
		KANA_VOICING = 8,
		/**
		 * Viramas
		 */
		VIRAMA = 9,
		/**
		 * [Hebrew]
		 */
		CCC10 = 10,
		/**
		 * [Hebrew]
		 */
		CCC11 = 11,
		/**
		 * [Hebrew]
		 */
		CCC12 = 12,
		/**
		 * [Hebrew]
		 */
		CCC13 = 13,
		/**
		 * [Hebrew]
		 */
		CCC14 = 14,
		/**
		 * [Hebrew]
		 */
		CCC15 = 15,
		/**
		 * [Hebrew]
		 */
		CCC16 = 16,
		/**
		 * [Hebrew]
		 */
		CCC17 = 17,
		/**
		 * [Hebrew]
		 */
		CCC18 = 18,
		/**
		 * [Hebrew]
		 */
		CCC19 = 19,
		/**
		 * [Hebrew]
		 */
		CCC20 = 20,
		/**
		 * [Hebrew]
		 */
		CCC21 = 21,
		/**
		 * [Hebrew]
		 */
		CCC22 = 22,
		/**
		 * [Hebrew]
		 */
		CCC23 = 23,
		/**
		 * [Hebrew]
		 */
		CCC24 = 24,
		/**
		 * [Hebrew]
		 */
		CCC25 = 25,
		/**
		 * [Hebrew]
		 */
		CCC26 = 26,
		/**
		 * [Arabic]
		 */
		CCC27 = 27,
		/**
		 * [Arabic]
		 */
		CCC28 = 28,
		/**
		 * [Arabic]
		 */
		CCC29 = 29,
		/**
		 * [Arabic]
		 */
		CCC30 = 30,
		/**
		 * [Arabic]
		 */
		CCC31 = 31,
		/**
		 * [Arabic]
		 */
		CCC32 = 32,
		/**
		 * [Arabic]
		 */
		CCC33 = 33,
		/**
		 * [Arabic]
		 */
		CCC34 = 34,
		/**
		 * [Arabic]
		 */
		CCC35 = 35,
		/**
		 * [Syriac]
		 */
		CCC36 = 36,
		/**
		 * [Telugu]
		 */
		CCC84 = 84,
		/**
		 * [Telugu]
		 */
		CCC91 = 91,
		/**
		 * [Thai]
		 */
		CCC103 = 103,
		/**
		 * [Thai]
		 */
		CCC107 = 107,
		/**
		 * [Lao]
		 */
		CCC118 = 118,
		/**
		 * [Lao]
		 */
		CCC122 = 122,
		/**
		 * [Tibetan]
		 */
		CCC129 = 129,
		/**
		 * [Tibetan]
		 */
		CCC130 = 130,
		/**
		 * [Tibetan]
		 */
		CCC133 = 132,
		/**
		 * Marks attached at the bottom left
		 */
		ATTACHED_BELOW_LEFT = 200,
		/**
		 * Marks attached directly below
		 */
		ATTACHED_BELOW = 202,
		/**
		 * Marks attached directly above
		 */
		ATTACHED_ABOVE = 214,
		/**
		 * Marks attached at the top right
		 */
		ATTACHED_ABOVE_RIGHT = 216,
		/**
		 * Distinct marks at the bottom left
		 */
		BELOW_LEFT = 218,
		/**
		 * Distinct marks directly below
		 */
		BELOW = 220,
		/**
		 * Distinct marks at the bottom right
		 */
		BELOW_RIGHT = 222,
		/**
		 * Distinct marks to the left
		 */
		LEFT = 224,
		/**
		 * Distinct marks to the right
		 */
		RIGHT = 226,
		/**
		 * Distinct marks at the top left
		 */
		ABOVE_LEFT = 228,
		/**
		 * Distinct marks directly above
		 */
		ABOVE = 230,
		/**
		 * Distinct marks at the top right
		 */
		ABOVE_RIGHT = 232,
		/**
		 * Distinct marks subtending two bases
		 */
		DOUBLE_BELOW = 233,
		/**
		 * Distinct marks extending above two bases
		 */
		DOUBLE_ABOVE = 234,
		/**
		 * Greek iota subscript only
		 */
		IOTA_SUBSCRIPT = 240,
		/**
		 * Invalid combining class
		 */
		INVALID = 255
	}

	/**
	 * Data type for the "General_Category" (gc) property from
	 * the Unicode Character Database.
	 */
	enum unicode_general_category_t {
		/**
		 * [Cc]
		 */
		CONTROL = 0,
		/**
		 * [Cf]
		 */
		FORMAT = 1,
		/**
		 * [Cn]
		 */
		UNASSIGNED = 2,
		/**
		 * [Co]
		 */
		PRIVATE_USE = 3,
		/**
		 * [Cs]
		 */
		SURROGATE = 4,
		/**
		 * [Ll]
		 */
		LOWERCASE_LETTER = 5,
		/**
		 * [Lm]
		 */
		MODIFIER_LETTER = 6,
		/**
		 * [Lo]
		 */
		OTHER_LETTER = 7,
		/**
		 * [Lt]
		 */
		TITLECASE_LETTER = 8,
		/**
		 * [Lu]
		 */
		UPPERCASE_LETTER = 9,
		/**
		 * [Mc]
		 */
		SPACING_MARK = 10,
		/**
		 * [Me]
		 */
		ENCLOSING_MARK = 11,
		/**
		 * [Mn]
		 */
		NON_SPACING_MARK = 12,
		/**
		 * [Nd]
		 */
		DECIMAL_NUMBER = 13,
		/**
		 * [Nl]
		 */
		LETTER_NUMBER = 14,
		/**
		 * [No]
		 */
		OTHER_NUMBER = 15,
		/**
		 * [Pc]
		 */
		CONNECT_PUNCTUATION = 16,
		/**
		 * [Pd]
		 */
		DASH_PUNCTUATION = 17,
		/**
		 * [Pe]
		 */
		CLOSE_PUNCTUATION = 18,
		/**
		 * [Pf]
		 */
		FINAL_PUNCTUATION = 19,
		/**
		 * [Pi]
		 */
		INITIAL_PUNCTUATION = 20,
		/**
		 * [Po]
		 */
		OTHER_PUNCTUATION = 21,
		/**
		 * [Ps]
		 */
		OPEN_PUNCTUATION = 22,
		/**
		 * [Sc]
		 */
		CURRENCY_SYMBOL = 23,
		/**
		 * [Sk]
		 */
		MODIFIER_SYMBOL = 24,
		/**
		 * [Sm]
		 */
		MATH_SYMBOL = 25,
		/**
		 * [So]
		 */
		OTHER_SYMBOL = 26,
		/**
		 * [Zl]
		 */
		LINE_SEPARATOR = 27,
		/**
		 * [Zp]
		 */
		PARAGRAPH_SEPARATOR = 28,
		/**
		 * [Zs]
		 */
		SPACE_SEPARATOR = 29
	}

	/**
	 * Flags from comparing two #hb_buffer_t's.
	 * 
	 * Buffer with different #hb_buffer_content_type_t cannot be meaningfully
	 * compared in any further detail.
	 * 
	 * For buffers with differing length, the per-glyph comparison is not
	 * attempted, though we do still scan reference buffer for dotted circle and
	 * `.notdef` glyphs.
	 * 
	 * If the buffers have the same length, we compare them glyph-by-glyph and
	 * report which aspect(s) of the glyph info/position are different.
	 */
	enum buffer_diff_flags_t {
		/**
		 * equal buffers.
		 */
		EQUAL = 0,
		/**
		 * buffers with different
		 *     #hb_buffer_content_type_t.
		 */
		CONTENT_TYPE_MISMATCH = 1,
		/**
		 * buffers with differing length.
		 */
		LENGTH_MISMATCH = 2,
		/**
		 * `.notdef` glyph is present in the
		 *     reference buffer.
		 */
		NOTDEF_PRESENT = 4,
		/**
		 * dotted circle glyph is present
		 *     in the reference buffer.
		 */
		DOTTED_CIRCLE_PRESENT = 8,
		/**
		 * difference in #hb_glyph_info_t.codepoint
		 */
		CODEPOINT_MISMATCH = 16,
		/**
		 * difference in #hb_glyph_info_t.cluster
		 */
		CLUSTER_MISMATCH = 32,
		/**
		 * difference in #hb_glyph_flags_t.
		 */
		GLYPH_FLAGS_MISMATCH = 64,
		/**
		 * difference in #hb_glyph_position_t.
		 */
		POSITION_MISMATCH = 128
	}

	/**
	 * Flags for #hb_buffer_t.
	 */
	enum buffer_flags_t {
		/**
		 * the default buffer flag.
		 */
		DEFAULT = 0,
		/**
		 * flag indicating that special handling of the beginning
		 *                      of text paragraph can be applied to this buffer. Should usually
		 *                      be set, unless you are passing to the buffer only part
		 *                      of the text without the full context.
		 */
		BOT = 1,
		/**
		 * flag indicating that special handling of the end of text
		 *                      paragraph can be applied to this buffer, similar to
		 *                      #HB_BUFFER_FLAG_BOT.
		 */
		EOT = 2,
		/**
		 * flag indication that character with Default_Ignorable
		 *                      Unicode property should use the corresponding glyph
		 *                      from the font, instead of hiding them (done by
		 *                      replacing them with the space glyph and zeroing the
		 *                      advance width.)  This flag takes precedence over
		 *                      #HB_BUFFER_FLAG_REMOVE_DEFAULT_IGNORABLES.
		 */
		PRESERVE_DEFAULT_IGNORABLES = 4,
		/**
		 * flag indication that character with Default_Ignorable
		 *                      Unicode property should be removed from glyph string
		 *                      instead of hiding them (done by replacing them with the
		 *                      space glyph and zeroing the advance width.)
		 *                      #HB_BUFFER_FLAG_PRESERVE_DEFAULT_IGNORABLES takes
		 *                      precedence over this flag. Since: 1.8.0
		 */
		REMOVE_DEFAULT_IGNORABLES = 8,
		/**
		 * flag indicating that a dotted circle should
		 *                      not be inserted in the rendering of incorrect
		 *                      character sequences (such at <0905 093E>). Since: 2.4
		 */
		DO_NOT_INSERT_DOTTED_CIRCLE = 16
	}

	/**
	 * Flags that control what glyph information are serialized in {@link Hb.buffer_serialize_glyphs}.
	 */
	enum buffer_serialize_flags_t {
		/**
		 * serialize glyph names, clusters and positions.
		 */
		DEFAULT = 0,
		/**
		 * do not serialize glyph cluster.
		 */
		NO_CLUSTERS = 1,
		/**
		 * do not serialize glyph position information.
		 */
		NO_POSITIONS = 2,
		/**
		 * do no serialize glyph name.
		 */
		NO_GLYPH_NAMES = 4,
		/**
		 * serialize glyph extents.
		 */
		GLYPH_EXTENTS = 8,
		/**
		 * serialize glyph flags. Since: 1.5.0
		 */
		GLYPH_FLAGS = 16,
		/**
		 * do not serialize glyph advances,
		 *  glyph offsets will reflect absolute glyph positions. Since: 1.8.0
		 */
		NO_ADVANCES = 32
	}

	/**
	 * Flags for #hb_glyph_info_t.
	 */
	enum glyph_flags_t {
		/**
		 * Indicates that if input text is broken at the
		 * 				   beginning of the cluster this glyph is part of,
		 * 				   then both sides need to be re-shaped, as the
		 * 				   result might be different.  On the flip side,
		 * 				   it means that when this flag is not present,
		 * 				   then it's safe to break the glyph-run at the
		 * 				   beginning of this cluster, and the two sides
		 * 				   represent the exact same result one would get
		 * 				   if breaking input text at the beginning of
		 * 				   this cluster and shaping the two sides
		 * 				   separately.  This can be used to optimize
		 * 				   paragraph layout, by avoiding re-shaping
		 * 				   of each line after line-breaking, or limiting
		 * 				   the reshaping to a small piece around the
		 * 				   breaking point only.
		 */
		UNSAFE_TO_BREAK = 1,
		/**
		 * All the currently defined flags.
		 */
		DEFINED = 1
	}

	/**
	 * Flags that describe the properties of color palette.
	 */
	enum ot_color_palette_flags_t {
		/**
		 * Default indicating that there is nothing special
		 *   to note about a color palette.
		 */
		DEFAULT = 0,
		/**
		 * Flag indicating that the color
		 *   palette is appropriate to use when displaying the font on a light background such as white.
		 */
		USABLE_WITH_LIGHT_BACKGROUND = 1,
		/**
		 * Flag indicating that the color
		 *   palette is appropriate to use when displaying the font on a dark background such as black.
		 */
		USABLE_WITH_DARK_BACKGROUND = 2
	}

	/**
	 * Flags for math glyph parts.
	 */
	enum ot_math_glyph_part_flags_t {
		/**
		 * This is an extender glyph part that
		 * can be repeated to reach the desired length.
		 */
		EXTENDER = 1
	}

	/**
	 * Flags for #hb_ot_var_axis_info_t.
	 */
	enum ot_var_axis_flags_t {
		/**
		 * The axis should not be exposed directly in user interfaces.
		 */
		HIDDEN = 1
	}

	/**
	 * A callback method for #hb_buffer_t. The method gets called with the
	 * #hb_buffer_t it was set on, the #hb_font_t the buffer is shaped with and a
	 * message describing what step of the shaping process will be performed.
	 * Returning %false from this method will skip this shaping step and move to
	 * the next one.
	 */
	interface buffer_message_func_t {
		/**
		 * A callback method for #hb_buffer_t. The method gets called with the
		 * #hb_buffer_t it was set on, the #hb_font_t the buffer is shaped with and a
		 * message describing what step of the shaping process will be performed.
		 * Returning %false from this method will skip this shaping step and move to
		 * the next one.
		 * @param buffer An #hb_buffer_t to work upon
		 * @param font The #hb_font_t the #buffer is shaped with
		 * @param message %NULL-terminated message passed to the function
		 * @returns %true to perform the shaping step, %false to skip it.
		 */
		(buffer: buffer_t, font: font_t, message: string): bool_t;
	}

	/**
	 * A virtual method for destroy user-data callbacks.
	 */
	interface destroy_func_t {
		/**
		 * A virtual method for destroy user-data callbacks.
		 */
		(): void;
	}

	/**
	 * This method should retrieve the extents for a font.
	 */
	interface font_get_font_extents_func_t {
		/**
		 * This method should retrieve the extents for a font.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @returns 
		 * 
		 * The font extents retrieved
		 */
		(font: font_t, font_data: any | null): [ bool_t, font_extents_t ];
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the advance for a specified glyph. The
	 * method must return an #hb_position_t.
	 */
	interface font_get_glyph_advance_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the advance for a specified glyph. The
		 * method must return an #hb_position_t.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param glyph The glyph ID to query
		 * @returns The advance of #glyph within #font
		 */
		(font: font_t, font_data: any | null, glyph: codepoint_t): position_t;
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the advances for a sequence of glyphs.
	 */
	interface font_get_glyph_advances_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the advances for a sequence of glyphs.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param count The number of glyph IDs in the sequence queried
		 * @param first_glyph The first glyph ID to query
		 * @param glyph_stride The stride between successive glyph IDs
		 * @param advance_stride The stride between successive advances
		 * @returns The first advance retrieved
		 */
		(font: font_t, font_data: any | null, count: number, first_glyph: codepoint_t, glyph_stride: number, advance_stride: number): position_t;
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the (X,Y) coordinates (in font units) for a
	 * specified contour point in a glyph. Each coordinate must be returned as
	 * an #hb_position_t output parameter.
	 */
	interface font_get_glyph_contour_point_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the (X,Y) coordinates (in font units) for a
		 * specified contour point in a glyph. Each coordinate must be returned as
		 * an #hb_position_t output parameter.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param glyph The glyph ID to query
		 * @param point_index The contour-point index to query
		 * @returns %true if data found, %false otherwise
		 * 
		 * The X value retrieved for the contour point
		 * 
		 * The Y value retrieved for the contour point
		 */
		(font: font_t, font_data: any | null, glyph: codepoint_t, point_index: number): [ bool_t, position_t, position_t ];
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the extents for a specified glyph. Extents must be
	 * returned in an #hb_glyph_extents output parameter.
	 */
	interface font_get_glyph_extents_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the extents for a specified glyph. Extents must be
		 * returned in an #hb_glyph_extents output parameter.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param glyph The glyph ID to query
		 * @returns %true if data found, %false otherwise
		 * 
		 * The #hb_glyph_extents_t retrieved
		 */
		(font: font_t, font_data: any | null, glyph: codepoint_t): [ bool_t, glyph_extents_t ];
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the glyph ID that corresponds to a glyph-name
	 * string.
	 */
	interface font_get_glyph_from_name_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the glyph ID that corresponds to a glyph-name
		 * string.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param name The name string to query
		 * @param len The length of the name queried
		 * @returns %true if data found, %false otherwise
		 * 
		 * The glyph ID retrieved
		 */
		(font: font_t, font_data: any | null, name: string[], len: number): [ bool_t, codepoint_t ];
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the glyph ID for a specified Unicode code point
	 * font, with an optional variation selector.
	 */
	interface font_get_glyph_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the glyph ID for a specified Unicode code point
		 * font, with an optional variation selector.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param unicode The Unicode code point to query
		 * @param variation_selector The  variation-selector code point to query
		 * @returns %true if data found, %false otherwise
		 * 
		 * The glyph ID retrieved
		 */
		(font: font_t, font_data: any | null, unicode: codepoint_t, variation_selector: codepoint_t): [ bool_t, codepoint_t ];
	}

	/**
	 * This method should retrieve the kerning-adjustment value for a glyph-pair in
	 * the specified font, for horizontal text segments.
	 */
	interface font_get_glyph_kerning_func_t {
		/**
		 * This method should retrieve the kerning-adjustment value for a glyph-pair in
		 * the specified font, for horizontal text segments.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param first_glyph The glyph ID of the first glyph in the glyph pair
		 * @param second_glyph The glyph ID of the second glyph in the glyph pair
		 * @returns 
		 */
		(font: font_t, font_data: any | null, first_glyph: codepoint_t, second_glyph: codepoint_t): position_t;
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the glyph name that corresponds to a
	 * glyph ID. The name should be returned in a string output parameter.
	 */
	interface font_get_glyph_name_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the glyph name that corresponds to a
		 * glyph ID. The name should be returned in a string output parameter.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param glyph The glyph ID to query
		 * @returns %true if data found, %false otherwise
		 * 
		 * Name string retrieved for the glyph ID
		 * 
		 * Length of the glyph-name string retrieved
		 */
		(font: font_t, font_data: any | null, glyph: codepoint_t): [ bool_t, string[], number ];
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the (X,Y) coordinates (in font units) of the
	 * origin for a glyph. Each coordinate must be returned in an #hb_position_t
	 * output parameter.
	 */
	interface font_get_glyph_origin_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the (X,Y) coordinates (in font units) of the
		 * origin for a glyph. Each coordinate must be returned in an #hb_position_t
		 * output parameter.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param glyph The glyph ID to query
		 * @returns %true if data found, %false otherwise
		 * 
		 * The X coordinate of the origin
		 * 
		 * The Y coordinate of the origin
		 */
		(font: font_t, font_data: any | null, glyph: codepoint_t): [ bool_t, position_t, position_t ];
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the nominal glyph ID for a specified Unicode code
	 * point. Glyph IDs must be returned in a #hb_codepoint_t output parameter.
	 */
	interface font_get_nominal_glyph_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the nominal glyph ID for a specified Unicode code
		 * point. Glyph IDs must be returned in a #hb_codepoint_t output parameter.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param unicode The Unicode code point to query
		 * @returns %true if data found, %false otherwise
		 * 
		 * The glyph ID retrieved
		 */
		(font: font_t, font_data: any | null, unicode: codepoint_t): [ bool_t, codepoint_t ];
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the nominal glyph IDs for a sequence of
	 * Unicode code points. Glyph IDs must be returned in a #hb_codepoint_t
	 * output parameter.
	 */
	interface font_get_nominal_glyphs_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the nominal glyph IDs for a sequence of
		 * Unicode code points. Glyph IDs must be returned in a #hb_codepoint_t
		 * output parameter.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param count number of code points to query
		 * @param first_unicode The first Unicode code point to query
		 * @param unicode_stride The stride between successive code points
		 * @param glyph_stride The stride between successive glyph IDs
		 * @returns the number of code points processed
		 * 
		 * The first glyph ID retrieved
		 */
		(font: font_t, font_data: any | null, count: number, first_unicode: codepoint_t, unicode_stride: number, glyph_stride: number): [ number, codepoint_t ];
	}

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the glyph ID for a specified Unicode code point
	 * followed by a specified Variation Selector code point. Glyph IDs must be
	 * returned in a #hb_codepoint_t output parameter.
	 */
	interface font_get_variation_glyph_func_t {
		/**
		 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
		 * 
		 * This method should retrieve the glyph ID for a specified Unicode code point
		 * followed by a specified Variation Selector code point. Glyph IDs must be
		 * returned in a #hb_codepoint_t output parameter.
		 * @param font #hb_font_t to work upon
		 * @param font_data #font user data pointer
		 * @param unicode The Unicode code point to query
		 * @param variation_selector The  variation-selector code point to query
		 * @returns %true if data found, %false otherwise
		 * 
		 * The glyph ID retrieved
		 */
		(font: font_t, font_data: any | null, unicode: codepoint_t, variation_selector: codepoint_t): [ bool_t, codepoint_t ];
	}

	/**
	 * Callback function for {@link Hb.face_create_for_tables}.
	 */
	interface reference_table_func_t {
		/**
		 * Callback function for {@link Hb.face_create_for_tables}.
		 * @param face an #hb_face_t to reference table for
		 * @param tag the tag of the table to reference
		 * @returns A pointer to the #tag table within #face
		 */
		(face: face_t, tag: tag_t): blob_t;
	}

	/**
	 * A virtual method for the #hb_unicode_funcs_t structure.
	 * 
	 * This method should retrieve the Canonical Combining Class (ccc)
	 * property for a specified Unicode code point.
	 */
	interface unicode_combining_class_func_t {
		/**
		 * A virtual method for the #hb_unicode_funcs_t structure.
		 * 
		 * This method should retrieve the Canonical Combining Class (ccc)
		 * property for a specified Unicode code point.
		 * @param ufuncs A Unicode-functions structure
		 * @param unicode The code point to query
		 * @returns The #hb_unicode_combining_class_t of #unicode
		 */
		(ufuncs: unicode_funcs_t, unicode: codepoint_t): unicode_combining_class_t;
	}

	/**
	 * A virtual method for the #hb_unicode_funcs_t structure.
	 * 
	 * This method should compose a sequence of two input Unicode code
	 * points by canonical equivalence, returning the composed code
	 * point in a #hb_codepoint_t output parameter (if successful).
	 * The method must return an #hb_bool_t indicating the success
	 * of the composition.
	 */
	interface unicode_compose_func_t {
		/**
		 * A virtual method for the #hb_unicode_funcs_t structure.
		 * 
		 * This method should compose a sequence of two input Unicode code
		 * points by canonical equivalence, returning the composed code
		 * point in a #hb_codepoint_t output parameter (if successful).
		 * The method must return an #hb_bool_t indicating the success
		 * of the composition.
		 * @param ufuncs A Unicode-functions structure
		 * @param a The first code point to compose
		 * @param b The second code point to compose
		 * @returns %true is #a,#b composed, %false otherwise
		 * 
		 * The composed code point
		 */
		(ufuncs: unicode_funcs_t, a: codepoint_t, b: codepoint_t): [ bool_t, codepoint_t ];
	}

	/**
	 * Fully decompose #u to its Unicode compatibility decomposition. The codepoints of the decomposition will be written to #decomposed.
	 * The complete length of the decomposition will be returned.
	 * 
	 * If #u has no compatibility decomposition, zero should be returned.
	 * 
	 * The Unicode standard guarantees that a buffer of length #HB_UNICODE_MAX_DECOMPOSITION_LEN codepoints will always be sufficient for any
	 * compatibility decomposition plus an terminating value of 0.  Consequently, #decompose must be allocated by the caller to be at least this length.  Implementations
	 * of this function type must ensure that they do not write past the provided array.
	 */
	interface unicode_decompose_compatibility_func_t {
		/**
		 * Fully decompose #u to its Unicode compatibility decomposition. The codepoints of the decomposition will be written to #decomposed.
		 * The complete length of the decomposition will be returned.
		 * 
		 * If #u has no compatibility decomposition, zero should be returned.
		 * 
		 * The Unicode standard guarantees that a buffer of length #HB_UNICODE_MAX_DECOMPOSITION_LEN codepoints will always be sufficient for any
		 * compatibility decomposition plus an terminating value of 0.  Consequently, #decompose must be allocated by the caller to be at least this length.  Implementations
		 * of this function type must ensure that they do not write past the provided array.
		 * @param ufuncs a Unicode function structure
		 * @param u codepoint to decompose
		 * @param decomposed address of codepoint array (of length #HB_UNICODE_MAX_DECOMPOSITION_LEN) to write decomposition into
		 * @returns number of codepoints in the full compatibility decomposition of #u, or 0 if no decomposition available.
		 */
		(ufuncs: unicode_funcs_t, u: codepoint_t, decomposed: codepoint_t): number;
	}

	/**
	 * A virtual method for the #hb_unicode_funcs_t structure.
	 * 
	 * This method should decompose an input Unicode code point,
	 * returning the two decomposed code points in #hb_codepoint_t
	 * output parameters (if successful). The method must return an
	 * #hb_bool_t indicating the success of the composition.
	 */
	interface unicode_decompose_func_t {
		/**
		 * A virtual method for the #hb_unicode_funcs_t structure.
		 * 
		 * This method should decompose an input Unicode code point,
		 * returning the two decomposed code points in #hb_codepoint_t
		 * output parameters (if successful). The method must return an
		 * #hb_bool_t indicating the success of the composition.
		 * @param ufuncs A Unicode-functions structure
		 * @param ab The code point to decompose
		 * @returns %true if #ab decomposed, %false otherwise
		 * 
		 * The first decomposed code point
		 * 
		 * The second decomposed code point
		 */
		(ufuncs: unicode_funcs_t, ab: codepoint_t): [ bool_t, codepoint_t, codepoint_t ];
	}

	/**
	 * A virtual method for the #hb_unicode_funcs_t structure.
	 */
	interface unicode_eastasian_width_func_t {
		/**
		 * A virtual method for the #hb_unicode_funcs_t structure.
		 * @param ufuncs A Unicode-functions structure
		 * @param unicode The code point to query
		 * @returns 
		 */
		(ufuncs: unicode_funcs_t, unicode: codepoint_t): number;
	}

	/**
	 * A virtual method for the #hb_unicode_funcs_t structure.
	 * 
	 * This method should retrieve the General Category property for
	 * a specified Unicode code point.
	 */
	interface unicode_general_category_func_t {
		/**
		 * A virtual method for the #hb_unicode_funcs_t structure.
		 * 
		 * This method should retrieve the General Category property for
		 * a specified Unicode code point.
		 * @param ufuncs A Unicode-functions structure
		 * @param unicode The code point to query
		 * @returns The #hb_unicode_general_category_t of #unicode
		 */
		(ufuncs: unicode_funcs_t, unicode: codepoint_t): unicode_general_category_t;
	}

	/**
	 * A virtual method for the #hb_unicode_funcs_t structure.
	 * 
	 * This method should retrieve the Bi-Directional Mirroring Glyph
	 * code point for a specified Unicode code point.
	 * 
	 * <note>Note: If a code point does not have a specified
	 * Bi-Directional Mirroring Glyph defined, the method should
	 * return the original code point.</note>
	 */
	interface unicode_mirroring_func_t {
		/**
		 * A virtual method for the #hb_unicode_funcs_t structure.
		 * 
		 * This method should retrieve the Bi-Directional Mirroring Glyph
		 * code point for a specified Unicode code point.
		 * 
		 * <note>Note: If a code point does not have a specified
		 * Bi-Directional Mirroring Glyph defined, the method should
		 * return the original code point.</note>
		 * @param ufuncs A Unicode-functions structure
		 * @param unicode The code point to query
		 * @returns The #hb_codepoint_t of the Mirroring Glyph for #unicode
		 */
		(ufuncs: unicode_funcs_t, unicode: codepoint_t): codepoint_t;
	}

	/**
	 * A virtual method for the #hb_unicode_funcs_t structure.
	 * 
	 * This method should retrieve the Script property for a
	 * specified Unicode code point.
	 */
	interface unicode_script_func_t {
		/**
		 * A virtual method for the #hb_unicode_funcs_t structure.
		 * 
		 * This method should retrieve the Script property for a
		 * specified Unicode code point.
		 * @param ufuncs A Unicode-functions structure
		 * @param unicode The code point to query
		 * @returns The #hb_script_t of #unicode
		 */
		(ufuncs: unicode_funcs_t, unicode: codepoint_t): script_t;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link var_int_t} instead.
	 */
	interface Ivar_int_t {
		u32: number;
		i32: number;
		u16: number[];
		i16: number[];
		u8: number[];
		i8: number[];

		connect(signal: "notify::u32", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::i32", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::u16", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::i16", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::u8", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::i8", callback: (owner: this, ...args: any) => void): number;

	}

	type var_int_tInitOptionsMixin = Pick<Ivar_int_t,
		"u32" |
		"i32" |
		"u16" |
		"i16" |
		"u8" |
		"i8">;

	export interface var_int_tInitOptions extends var_int_tInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link var_int_t} instead.
	 */
	type var_int_tMixin = Ivar_int_t;

	interface var_int_t extends var_int_tMixin {}

	class var_int_t {
		public constructor(options?: Partial<var_int_tInitOptions>);
	}


	/**
	 * Data type for booleans.
	 */
	type bool_t = number;

	/**
	 * Data type for holding Unicode codepoints. Also
	 * used to hold glyph IDs.
	 */
	type codepoint_t = number;

	/**
	 * Data type for holding color values. Colors are eight bits per
	 * channel RGB plus alpha transparency.
	 */
	type color_t = number;

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the extents for a font, for horizontal-direction
	 * text segments. Extents must be returned in an #hb_glyph_extents output
	 * parameter.
	 */
	type font_get_font_h_extents_func_t = font_get_font_extents_func_t;

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the extents for a font, for vertical-direction
	 * text segments. Extents must be returned in an #hb_glyph_extents output
	 * parameter.
	 */
	type font_get_font_v_extents_func_t = font_get_font_extents_func_t;

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the advance for a specified glyph, in
	 * horizontal-direction text segments. Advances must be returned in
	 * an #hb_position_t output parameter.
	 */
	type font_get_glyph_h_advance_func_t = font_get_glyph_advance_func_t;

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the advances for a sequence of glyphs, in
	 * horizontal-direction text segments.
	 */
	type font_get_glyph_h_advances_func_t = font_get_glyph_advances_func_t;

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the kerning-adjustment value for a glyph-pair in
	 * the specified font, for horizontal text segments.
	 */
	type font_get_glyph_h_kerning_func_t = font_get_glyph_kerning_func_t;

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the (X,Y) coordinates (in font units) of the
	 * origin for a glyph, for horizontal-direction text segments. Each
	 * coordinate must be returned in an #hb_position_t output parameter.
	 */
	type font_get_glyph_h_origin_func_t = font_get_glyph_origin_func_t;

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the advance for a specified glyph, in
	 * vertical-direction text segments. Advances must be returned in
	 * an #hb_position_t output parameter.
	 */
	type font_get_glyph_v_advance_func_t = font_get_glyph_advance_func_t;

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the advances for a sequence of glyphs, in
	 * vertical-direction text segments.
	 */
	type font_get_glyph_v_advances_func_t = font_get_glyph_advances_func_t;

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the kerning-adjustment value for a glyph-pair in
	 * the specified font, for vertical text segments.
	 */
	type font_get_glyph_v_kerning_func_t = font_get_glyph_kerning_func_t;

	/**
	 * A virtual method for the #hb_font_funcs_t of an #hb_font_t object.
	 * 
	 * This method should retrieve the (X,Y) coordinates (in font units) of the
	 * origin for a glyph, for vertical-direction text segments. Each coordinate
	 * must be returned in an #hb_position_t output parameter.
	 */
	type font_get_glyph_v_origin_func_t = font_get_glyph_origin_func_t;

	/**
	 * Data type for bitmasks.
	 */
	type mask_t = number;

	/**
	 * An integral type representing an OpenType 'name' table name identifier.
	 * There are predefined name IDs, as well as name IDs return from other
	 * API.  These can be used to fetch name strings from a font face.
	 */
	type ot_name_id_t = number;

	/**
	 * Data type for holding a single coordinate value.
	 * Contour points and other multi-dimensional data are
	 * stored as tuples of #hb_position_t's.
	 */
	type position_t = number;

	/**
	 * Data type for tag identifiers. Tags are four
	 * byte integers, each byte representing a character.
	 * 
	 * Tags are used to identify tables, design-variation axes,
	 * scripts, languages, font features, and baselines with
	 * human-readable names.
	 */
	type tag_t = number;

	/**
	 * Fetches the name identifier of the specified feature type in the face's `name` table.
	 * @param face #hb_face_t to work upon
	 * @param feature_type The #hb_aat_layout_feature_type_t of the requested feature type
	 * @returns Name identifier of the requested feature type
	 */
	function aat_layout_feature_type_get_name_id(face: face_t, feature_type: aat_layout_feature_type_t): ot_name_id_t;

	/**
	 * Fetches a list of the selectors available for the specified feature in the given face.
	 * 
	 * If upon return, #default_index is set to #HB_AAT_LAYOUT_NO_SELECTOR_INDEX, then
	 * the feature type is non-exclusive.  Otherwise, #default_index is the index of
	 * the selector that is selected by default.
	 * @param face #hb_face_t to work upon
	 * @param feature_type The #hb_aat_layout_feature_type_t of the requested feature type
	 * @param start_offset offset of the first feature type to retrieve
	 * @returns Number of all available feature selectors
	 * 
	 * Input = the maximum number of selectors to return;
	 *                  Output = the actual number of selectors returned (may be zero)
	 * 
	 * 
	 *             A buffer pointer. The selectors available for the feature type queries.
	 * 
	 * The index of the feature's default selector, if any
	 */
	function aat_layout_feature_type_get_selector_infos(face: face_t, feature_type: aat_layout_feature_type_t, start_offset: number): [ number, number | null, aat_layout_feature_selector_info_t[] | null, number | null ];

	/**
	 * Fetches a list of the AAT feature types included in the specified face.
	 * @param face #hb_face_t to work upon
	 * @param start_offset offset of the first feature type to retrieve
	 * @returns Number of all available feature types.
	 * 
	 * Input = the maximum number of feature types to return;
	 *                 Output = the actual number of feature types returned (may be zero)
	 * 
	 * Array of feature types found
	 */
	function aat_layout_get_feature_types(face: face_t, start_offset: number): [ number, number | null, aat_layout_feature_type_t[] ];

	/**
	 * Tests whether the specified face includes any positioning information
	 * in the `kerx` table.
	 * 
	 * <note>Note: does not examine the `GPOS` table.</note>
	 * @param face #hb_face_t to work upon
	 * @returns %true if data found, %false otherwise
	 */
	function aat_layout_has_positioning(face: face_t): bool_t;

	/**
	 * Tests whether the specified face includes any substitutions in the
	 * `morx` or `mort` tables.
	 * 
	 * <note>Note: does not examine the `GSUB` table.</note>
	 * @param face #hb_face_t to work upon
	 * @returns %true if data found, %false otherwise
	 */
	function aat_layout_has_substitution(face: face_t): bool_t;

	/**
	 * Tests whether the specified face includes any tracking information
	 * in the `trak` table.
	 * @param face #hb_face_t to work upon
	 * @returns %true if data found, %false otherwise
	 */
	function aat_layout_has_tracking(face: face_t): bool_t;

	/**
	 * Makes a writable copy of #blob.
	 * @param blob A blob.
	 * @returns The new blob, or nullptr if allocation failed
	 */
	function blob_copy_writable_or_fail(blob: blob_t): blob_t;

	/**
	 * Creates a new "blob" object wrapping #data.  The #mode parameter is used
	 * to negotiate ownership and lifecycle of #data.
	 * @param data Pointer to blob data.
	 * @param length Length of #data in bytes.
	 * @param mode Memory mode for #data.
	 * @param destroy Callback to call when #data is not needed anymore.
	 * @returns New blob, or the empty blob if something failed or if #length is
	 * zero.  Destroy with {@link Hb.blob_destroy}.
	 */
	function blob_create(data: string, length: number, mode: memory_mode_t, destroy: destroy_func_t | null): blob_t;

	/**
	 * Creates a new blob containing the data from the
	 * specified binary font file.
	 * @param file_name A font filename
	 * @returns An #hb_blob_t pointer with the content of the file,
	 * or {@link Hb.blob_get_empty} if failed.
	 */
	function blob_create_from_file(file_name: string): blob_t;

	/**
	 * Creates a new blob containing the data from the
	 * specified binary font file.
	 * @param file_name A font filename
	 * @returns An #hb_blob_t pointer with the content of the file,
	 * or %NULL if failed.
	 */
	function blob_create_from_file_or_fail(file_name: string): blob_t;

	/**
	 * Creates a new "blob" object wrapping #data.  The #mode parameter is used
	 * to negotiate ownership and lifecycle of #data.
	 * 
	 * Note that this function returns a freshly-allocated empty blob even if #length
	 * is zero. This is in contrast to {@link Hb.blob_create}, which returns the singleton
	 * empty blob (as returned by hb_blob_get_empty()) if #length is zero.
	 * @param data Pointer to blob data.
	 * @param length Length of #data in bytes.
	 * @param mode Memory mode for #data.
	 * @param destroy Callback to call when #data is not needed anymore.
	 * @returns New blob, or %NULL if failed.  Destroy with {@link Hb.blob_destroy}.
	 */
	function blob_create_or_fail(data: string, length: number, mode: memory_mode_t, destroy: destroy_func_t | null): blob_t;

	/**
	 * Returns a blob that represents a range of bytes in #parent.  The new
	 * blob is always created with #HB_MEMORY_MODE_READONLY, meaning that it
	 * will never modify data in the parent blob.  The parent data is not
	 * expected to be modified, and will result in undefined behavior if it
	 * is.
	 * 
	 * Makes #parent immutable.
	 * @param parent Parent blob.
	 * @param offset Start offset of sub-blob within #parent, in bytes.
	 * @param length Length of sub-blob.
	 * @returns New blob, or the empty blob if something failed or if
	 * #length is zero or #offset is beyond the end of #parent's data.  Destroy
	 * with {@link Hb.blob_destroy}.
	 */
	function blob_create_sub_blob(parent: blob_t, offset: number, length: number): blob_t;

	/**
	 * Decreases the reference count on #blob, and if it reaches zero, destroys
	 * #blob, freeing all memory, possibly calling the destroy-callback the blob
	 * was created for if it has not been called already.
	 * 
	 * See TODO:link object types for more information.
	 * @param blob a blob.
	 */
	function blob_destroy(blob: blob_t): void;

	/**
	 * Fetches the data from a blob.
	 * @param blob a blob.
	 * @returns the byte data of #blob.
	 * 
	 * The length in bytes of the data retrieved
	 */
	function blob_get_data(blob: blob_t): [ string[], number ];

	/**
	 * Tries to make blob data writable (possibly copying it) and
	 * return pointer to data.
	 * 
	 * Fails if blob has been made immutable, or if memory allocation
	 * fails.
	 * @param blob a blob.
	 * @returns Writable blob data,
	 * or %NULL if failed.
	 * 
	 * output length of the writable data.
	 */
	function blob_get_data_writable(blob: blob_t): [ string[], number ];

	/**
	 * Returns the singleton empty blob.
	 * 
	 * See TODO:link object types for more information.
	 * @returns The empty blob.
	 */
	function blob_get_empty(): blob_t;

	/**
	 * Fetches the length of a blob's data.
	 * @param blob a blob.
	 * @returns the length of #blob data in bytes.
	 */
	function blob_get_length(blob: blob_t): number;

	/**
	 * Fetches the user data associated with the specified key,
	 * attached to the specified font-functions structure.
	 * @param blob a blob
	 * @param key The user-data key to query
	 * @returns A pointer to the user data
	 */
	function blob_get_user_data(blob: blob_t, key: user_data_key_t): any | null;

	/**
	 * Tests whether a blob is immutable.
	 * @param blob a blob.
	 * @returns %true if #blob is immutable, %false otherwise
	 */
	function blob_is_immutable(blob: blob_t): bool_t;

	/**
	 * Makes a blob immutable.
	 * @param blob a blob
	 */
	function blob_make_immutable(blob: blob_t): void;

	/**
	 * Increases the reference count on #blob.
	 * 
	 * See TODO:link object types for more information.
	 * @param blob a blob.
	 * @returns #blob.
	 */
	function blob_reference(blob: blob_t): blob_t;

	/**
	 * Attaches a user-data key/data pair to the specified blob.
	 * @param blob An #hb_blob_t
	 * @param key The user-data key to set
	 * @param data A pointer to the user data to set
	 * @param destroy A callback to call when #data is not needed anymore
	 * @param replace Whether to replace an existing data with the same key
	 * @returns %true if success, %false otherwise
	 */
	function blob_set_user_data(blob: blob_t, key: user_data_key_t, data: any | null, destroy: destroy_func_t | null, replace: bool_t): bool_t;

	/**
	 * Appends a character with the Unicode value of #codepoint to #buffer, and
	 * gives it the initial cluster value of #cluster. Clusters can be any thing
	 * the client wants, they are usually used to refer to the index of the
	 * character in the input text stream and are output in
	 * #hb_glyph_info_t.cluster field.
	 * 
	 * This function does not check the validity of #codepoint, it is up to the
	 * caller to ensure it is a valid Unicode code point.
	 * @param buffer An #hb_buffer_t
	 * @param codepoint A Unicode code point.
	 * @param cluster The cluster value of #codepoint.
	 */
	function buffer_add(buffer: buffer_t, codepoint: codepoint_t, cluster: number): void;

	/**
	 * Appends characters from #text array to #buffer. The #item_offset is the
	 * position of the first character from #text that will be appended, and
	 * #item_length is the number of character. When shaping part of a larger text
	 * (e.g. a run of text from a paragraph), instead of passing just the substring
	 * corresponding to the run, it is preferable to pass the whole
	 * paragraph and specify the run start and length as #item_offset and
	 * #item_length, respectively, to give HarfBuzz the full context to be able,
	 * for example, to do cross-run Arabic shaping or properly handle combining
	 * marks at stat of run.
	 * 
	 * This function does not check the validity of #text, it is up to the caller
	 * to ensure it contains a valid Unicode code points.
	 * @param buffer a #hb_buffer_t to append characters to.
	 * @param text an array of Unicode code points to append.
	 * @param text_length the length of the #text, or -1 if it is %NULL terminated.
	 * @param item_offset the offset of the first code point to add to the #buffer.
	 * @param item_length the number of code points to add to the #buffer, or -1 for the
	 *               end of #text (assuming it is %NULL terminated).
	 */
	function buffer_add_codepoints(buffer: buffer_t, text: codepoint_t[], text_length: number, item_offset: number, item_length: number): void;

	/**
	 * Similar to {@link Hb.buffer_add_codepoints}, but allows only access to first 256
	 * Unicode code points that can fit in 8-bit strings.
	 * 
	 * <note>Has nothing to do with non-Unicode Latin-1 encoding.</note>
	 * @param buffer An #hb_buffer_t
	 * @param text an array of UTF-8
	 *               characters to append
	 * @param text_length the length of the #text, or -1 if it is %NULL terminated
	 * @param item_offset the offset of the first character to add to the #buffer
	 * @param item_length the number of characters to add to the #buffer, or -1 for the
	 *               end of #text (assuming it is %NULL terminated)
	 */
	function buffer_add_latin1(buffer: buffer_t, text: number[], text_length: number, item_offset: number, item_length: number): void;

	/**
	 * See {@link Hb.buffer_add_codepoints}.
	 * 
	 * Replaces invalid UTF-16 characters with the #buffer replacement code point,
	 * see hb_buffer_set_replacement_codepoint().
	 * @param buffer An #hb_buffer_t
	 * @param text An array of UTF-16 characters to append
	 * @param text_length The length of the #text, or -1 if it is %NULL terminated
	 * @param item_offset The offset of the first character to add to the #buffer
	 * @param item_length The number of characters to add to the #buffer, or -1 for the
	 *               end of #text (assuming it is %NULL terminated)
	 */
	function buffer_add_utf16(buffer: buffer_t, text: number[], text_length: number, item_offset: number, item_length: number): void;

	/**
	 * See {@link Hb.buffer_add_codepoints}.
	 * 
	 * Replaces invalid UTF-32 characters with the #buffer replacement code point,
	 * see hb_buffer_set_replacement_codepoint().
	 * @param buffer An #hb_buffer_t
	 * @param text An array of UTF-32 characters to append
	 * @param text_length The length of the #text, or -1 if it is %NULL terminated
	 * @param item_offset The offset of the first character to add to the #buffer
	 * @param item_length The number of characters to add to the #buffer, or -1 for the
	 *               end of #text (assuming it is %NULL terminated)
	 */
	function buffer_add_utf32(buffer: buffer_t, text: number[], text_length: number, item_offset: number, item_length: number): void;

	/**
	 * See {@link Hb.buffer_add_codepoints}.
	 * 
	 * Replaces invalid UTF-8 characters with the #buffer replacement code point,
	 * see hb_buffer_set_replacement_codepoint().
	 * @param buffer An #hb_buffer_t
	 * @param text An array of UTF-8
	 *               characters to append.
	 * @param text_length The length of the #text, or -1 if it is %NULL terminated.
	 * @param item_offset The offset of the first character to add to the #buffer.
	 * @param item_length The number of characters to add to the #buffer, or -1 for the
	 *               end of #text (assuming it is %NULL terminated).
	 */
	function buffer_add_utf8(buffer: buffer_t, text: number[], text_length: number, item_offset: number, item_length: number): void;

	/**
	 * Check if allocating memory for the buffer succeeded.
	 * @param buffer An #hb_buffer_t
	 * @returns %true if #buffer memory allocation succeeded, %false otherwise.
	 */
	function buffer_allocation_successful(buffer: buffer_t): bool_t;

	/**
	 * Append (part of) contents of another buffer to this buffer.
	 * @param buffer An #hb_buffer_t
	 * @param source source #hb_buffer_t
	 * @param start start index into source buffer to copy.  Use 0 to copy from start of buffer.
	 * @param end end index into source buffer to copy.  Use #HB_FEATURE_GLOBAL_END to copy to end of buffer.
	 */
	function buffer_append(buffer: buffer_t, source: buffer_t, start: number, end: number): void;

	/**
	 * Similar to {@link Hb.buffer_reset}, but does not clear the Unicode functions and
	 * the replacement code point.
	 * @param buffer An #hb_buffer_t
	 */
	function buffer_clear_contents(buffer: buffer_t): void;

	/**
	 * Creates a new #hb_buffer_t with all properties to defaults.
	 * @returns 
	 * A newly allocated #hb_buffer_t with a reference count of 1. The initial
	 * reference count should be released with {@link Hb.buffer_destroy} when you are done
	 * using the #hb_buffer_t. This function never returns %NULL. If memory cannot
	 * be allocated, a special #hb_buffer_t object will be returned on which
	 * hb_buffer_allocation_successful() returns %false.
	 */
	function buffer_create(): buffer_t;

	/**
	 * Deserializes glyphs #buffer from textual representation in the format
	 * produced by {@link Hb.buffer_serialize_glyphs}.
	 * @param buffer an #hb_buffer_t buffer.
	 * @param buf string to deserialize
	 * @param buf_len the size of #buf, or -1 if it is %NULL-terminated
	 * @param font font for getting glyph IDs
	 * @param format the #hb_buffer_serialize_format_t of the input #buf
	 * @returns %true if #buf is not fully consumed, %false otherwise.
	 * 
	 * output pointer to the character after last
	 *                               consumed one.
	 */
	function buffer_deserialize_glyphs(buffer: buffer_t, buf: string[], buf_len: number, font: font_t | null, format: buffer_serialize_format_t): [ bool_t, string | null ];

	/**
	 * Deserializes Unicode #buffer from textual representation in the format
	 * produced by {@link Hb.buffer_serialize_unicode}.
	 * @param buffer an #hb_buffer_t buffer.
	 * @param buf string to deserialize
	 * @param buf_len the size of #buf, or -1 if it is %NULL-terminated
	 * @param format the #hb_buffer_serialize_format_t of the input #buf
	 * @returns %true if #buf is not fully consumed, %false otherwise.
	 * 
	 * output pointer to the character after last
	 *                               consumed one.
	 */
	function buffer_deserialize_unicode(buffer: buffer_t, buf: string[], buf_len: number, format: buffer_serialize_format_t): [ bool_t, string | null ];

	/**
	 * Deallocate the #buffer.
	 * Decreases the reference count on #buffer by one. If the result is zero, then
	 * #buffer and all associated resources are freed. See {@link Hb.buffer_reference}.
	 * @param buffer An #hb_buffer_t
	 */
	function buffer_destroy(buffer: buffer_t): void;

	/**
	 * If dottedcircle_glyph is (hb_codepoint_t) -1 then #HB_BUFFER_DIFF_FLAG_DOTTED_CIRCLE_PRESENT
	 * and #HB_BUFFER_DIFF_FLAG_NOTDEF_PRESENT are never returned.  This should be used by most
	 * callers if just comparing two buffers is needed.
	 * @param buffer a buffer.
	 * @param reference other buffer to compare to.
	 * @param dottedcircle_glyph glyph id of U+25CC DOTTED CIRCLE, or (hb_codepont_t) -1.
	 * @param position_fuzz allowed absolute difference in position values.
	 * @returns 
	 */
	function buffer_diff(buffer: buffer_t, reference: buffer_t, dottedcircle_glyph: codepoint_t, position_fuzz: number): buffer_diff_flags_t;

	/**
	 * Fetches the cluster level of a buffer. The #hb_buffer_cluster_level_t
	 * dictates one aspect of how HarfBuzz will treat non-base characters
	 * during shaping.
	 * @param buffer An #hb_buffer_t
	 * @returns The cluster level of #buffer
	 */
	function buffer_get_cluster_level(buffer: buffer_t): buffer_cluster_level_t;

	/**
	 * Fetches the type of #buffer contents. Buffers are either empty, contain
	 * characters (before shaping), or contain glyphs (the result of shaping).
	 * @param buffer An #hb_buffer_t
	 * @returns The type of #buffer contents
	 */
	function buffer_get_content_type(buffer: buffer_t): buffer_content_type_t;

	/**
	 * See {@link Hb.buffer_set_direction}
	 * @param buffer An #hb_buffer_t
	 * @returns The direction of the #buffer.
	 */
	function buffer_get_direction(buffer: buffer_t): direction_t;

	/**
	 * Fetches an empty #hb_buffer_t.
	 * @returns The empty buffer
	 */
	function buffer_get_empty(): buffer_t;

	/**
	 * Fetches the #hb_buffer_flags_t of #buffer.
	 * @param buffer An #hb_buffer_t
	 * @returns The #buffer flags
	 */
	function buffer_get_flags(buffer: buffer_t): buffer_flags_t;

	/**
	 * Returns #buffer glyph information array.  Returned pointer
	 * is valid as long as #buffer contents are not modified.
	 * @param buffer An #hb_buffer_t
	 * @returns 
	 * The #buffer glyph information array.
	 * The value valid as long as buffer has not been modified.
	 * 
	 * The output-array length.
	 */
	function buffer_get_glyph_infos(buffer: buffer_t): [ glyph_info_t[], number ];

	/**
	 * Returns #buffer glyph position array.  Returned pointer
	 * is valid as long as #buffer contents are not modified.
	 * 
	 * If buffer did not have positions before, the positions will be
	 * initialized to zeros, unless this function is called from
	 * within a buffer message callback (see {@link Hb.buffer_set_message_func}),
	 * in which case %NULL is returned.
	 * @param buffer An #hb_buffer_t
	 * @returns 
	 * The #buffer glyph position array.
	 * The value valid as long as buffer has not been modified.
	 * 
	 * The output length
	 */
	function buffer_get_glyph_positions(buffer: buffer_t): [ glyph_position_t[], number ];

	/**
	 * See {@link Hb.buffer_set_invisible_glyph}.
	 * @param buffer An #hb_buffer_t
	 * @returns The #buffer invisible #hb_codepoint_t
	 */
	function buffer_get_invisible_glyph(buffer: buffer_t): codepoint_t;

	/**
	 * See {@link Hb.buffer_set_language}.
	 * @param buffer An #hb_buffer_t
	 * @returns 
	 * The #hb_language_t of the buffer. Must not be freed by the caller.
	 */
	function buffer_get_language(buffer: buffer_t): language_t;

	/**
	 * Returns the number of items in the buffer.
	 * @param buffer An #hb_buffer_t
	 * @returns The #buffer length.
	 * The value valid as long as buffer has not been modified.
	 */
	function buffer_get_length(buffer: buffer_t): number;

	/**
	 * Fetches the #hb_codepoint_t that replaces invalid entries for a given encoding
	 * when adding text to #buffer.
	 * @param buffer An #hb_buffer_t
	 * @returns The #buffer replacement #hb_codepoint_t
	 */
	function buffer_get_replacement_codepoint(buffer: buffer_t): codepoint_t;

	/**
	 * Fetches the script of #buffer.
	 * @param buffer An #hb_buffer_t
	 * @returns The #hb_script_t of the #buffer
	 */
	function buffer_get_script(buffer: buffer_t): script_t;

	/**
	 * Sets #props to the #hb_segment_properties_t of #buffer.
	 * @param buffer An #hb_buffer_t
	 * @returns The output #hb_segment_properties_t
	 */
	function buffer_get_segment_properties(buffer: buffer_t): segment_properties_t;

	/**
	 * Fetches the Unicode-functions structure of a buffer.
	 * @param buffer An #hb_buffer_t
	 * @returns The Unicode-functions structure
	 */
	function buffer_get_unicode_funcs(buffer: buffer_t): unicode_funcs_t;

	/**
	 * Fetches the user data associated with the specified key,
	 * attached to the specified buffer.
	 * @param buffer An #hb_buffer_t
	 * @param key The user-data key to query
	 * @returns A pointer to the user data
	 */
	function buffer_get_user_data(buffer: buffer_t, key: user_data_key_t): any | null;

	/**
	 * Sets unset buffer segment properties based on buffer Unicode
	 * contents.  If buffer is not empty, it must have content type
	 * #HB_BUFFER_CONTENT_TYPE_UNICODE.
	 * 
	 * If buffer script is not set (ie. is #HB_SCRIPT_INVALID), it
	 * will be set to the Unicode script of the first character in
	 * the buffer that has a script other than #HB_SCRIPT_COMMON,
	 * #HB_SCRIPT_INHERITED, and #HB_SCRIPT_UNKNOWN.
	 * 
	 * Next, if buffer direction is not set (ie. is #HB_DIRECTION_INVALID),
	 * it will be set to the natural horizontal direction of the
	 * buffer script as returned by {@link Hb.script_get_horizontal_direction}.
	 * If hb_script_get_horizontal_direction() returns #HB_DIRECTION_INVALID,
	 * then #HB_DIRECTION_LTR is used.
	 * 
	 * Finally, if buffer language is not set (ie. is #HB_LANGUAGE_INVALID),
	 * it will be set to the process's default language as returned by
	 * hb_language_get_default().  This may change in the future by
	 * taking buffer script into consideration when choosing a language.
	 * Note that hb_language_get_default() is NOT threadsafe the first time
	 * it is called.  See documentation for that function for details.
	 * @param buffer An #hb_buffer_t
	 */
	function buffer_guess_segment_properties(buffer: buffer_t): void;

	/**
	 * Returns whether #buffer has glyph position data.
	 * A buffer gains position data when {@link Hb.buffer_get_glyph_positions} is called on it,
	 * and cleared of position data when hb_buffer_clear_contents() is called.
	 * @param buffer an #hb_buffer_t.
	 * @returns %true if the #buffer has position array, %false otherwise.
	 */
	function buffer_has_positions(buffer: buffer_t): bool_t;

	/**
	 * Reorders a glyph buffer to have canonical in-cluster glyph order / position.
	 * The resulting clusters should behave identical to pre-reordering clusters.
	 * 
	 * <note>This has nothing to do with Unicode normalization.</note>
	 * @param buffer An #hb_buffer_t
	 */
	function buffer_normalize_glyphs(buffer: buffer_t): void;

	/**
	 * Pre allocates memory for #buffer to fit at least #size number of items.
	 * @param buffer An #hb_buffer_t
	 * @param size Number of items to pre allocate.
	 * @returns %true if #buffer memory allocation succeeded, %false otherwise
	 */
	function buffer_pre_allocate(buffer: buffer_t, size: number): bool_t;

	/**
	 * Increases the reference count on #buffer by one. This prevents #buffer from
	 * being destroyed until a matching call to {@link Hb.buffer_destroy} is made.
	 * @param buffer An #hb_buffer_t
	 * @returns 
	 * The referenced #hb_buffer_t.
	 */
	function buffer_reference(buffer: buffer_t): buffer_t;

	/**
	 * Resets the buffer to its initial status, as if it was just newly created
	 * with {@link Hb.buffer_create}.
	 * @param buffer An #hb_buffer_t
	 */
	function buffer_reset(buffer: buffer_t): void;

	/**
	 * Reverses buffer contents.
	 * @param buffer An #hb_buffer_t
	 */
	function buffer_reverse(buffer: buffer_t): void;

	/**
	 * Reverses buffer clusters.  That is, the buffer contents are
	 * reversed, then each cluster (consecutive items having the
	 * same cluster number) are reversed again.
	 * @param buffer An #hb_buffer_t
	 */
	function buffer_reverse_clusters(buffer: buffer_t): void;

	/**
	 * Reverses buffer contents between #start and #end.
	 * @param buffer An #hb_buffer_t
	 * @param start start index
	 * @param end end index
	 */
	function buffer_reverse_range(buffer: buffer_t, start: number, end: number): void;

	/**
	 * Serializes #buffer into a textual representation of its content, whether
	 * Unicode codepoints or glyph identifiers and positioning information. This is
	 * useful for showing the contents of the buffer, for example during debugging.
	 * See the documentation of {@link Hb.buffer_serialize_unicode} and
	 * hb_buffer_serialize_glyphs() for a description of the output format.
	 * @param buffer an #hb_buffer_t buffer.
	 * @param start the first item in #buffer to serialize.
	 * @param end the last item in #buffer to serialize.
	 * @param font the #hb_font_t used to shape this buffer, needed to
	 *        read glyph names and extents. If %NULL, and empty font will be used.
	 * @param format the #hb_buffer_serialize_format_t to use for formatting the output.
	 * @param flags the #hb_buffer_serialize_flags_t that control what glyph properties
	 *         to serialize.
	 * @returns The number of serialized items.
	 * 
	 * output string to
	 *       write serialized buffer into.
	 * 
	 * the size of #buf.
	 * 
	 * if not %NULL, will be set to the number of byes written into #buf.
	 */
	function buffer_serialize(buffer: buffer_t, start: number, end: number, font: font_t | null, format: buffer_serialize_format_t, flags: buffer_serialize_flags_t): [ number, number[], number, number | null ];

	/**
	 * Parses a string into an #hb_buffer_serialize_format_t. Does not check if
	 * #str is a valid buffer serialization format, use
	 * {@link Hb.buffer_serialize_list_formats} to get the list of supported formats.
	 * @param str a string to parse
	 * @param len length of #str, or -1 if string is %NULL terminated
	 * @returns The parsed #hb_buffer_serialize_format_t.
	 */
	function buffer_serialize_format_from_string(str: number[], len: number): buffer_serialize_format_t;

	/**
	 * Converts #format to the string corresponding it, or %NULL if it is not a valid
	 * #hb_buffer_serialize_format_t.
	 * @param format an #hb_buffer_serialize_format_t to convert.
	 * @returns 
	 * A %NULL terminated string corresponding to #format. Should not be freed.
	 */
	function buffer_serialize_format_to_string(format: buffer_serialize_format_t): string;

	/**
	 * Serializes #buffer into a textual representation of its glyph content,
	 * useful for showing the contents of the buffer, for example during debugging.
	 * There are currently two supported serialization formats:
	 * 
	 * ## text
	 * A human-readable, plain text format.
	 * The serialized glyphs will look something like:
	 * 
	 * ```
	 * [uni0651=0#518,0+0|uni0628=0+1897]
	 * ```
	 * 
	 * - The serialized glyphs are delimited with `[` and `]`.
	 * - Glyphs are separated with `|`
	 * - Each glyph starts with glyph name, or glyph index if
	 *   #HB_BUFFER_SERIALIZE_FLAG_NO_GLYPH_NAMES flag is set. Then,
	 *   - If #HB_BUFFER_SERIALIZE_FLAG_NO_CLUSTERS is not set, `=` then #hb_glyph_info_t.cluster.
	 *   - If #HB_BUFFER_SERIALIZE_FLAG_NO_POSITIONS is not set, the #hb_glyph_position_t in the format:
	 *     - If both #hb_glyph_position_t.x_offset and #hb_glyph_position_t.y_offset are not 0, `#x_offset,y_offset`. Then,
	 *     - `+x_advance`, then `,y_advance` if #hb_glyph_position_t.y_advance is not 0. Then,
	 *   - If #HB_BUFFER_SERIALIZE_FLAG_GLYPH_EXTENTS is set, the #hb_glyph_extents_t in the format `<x_bearing,y_bearing,width,height>`
	 * 
	 * ## json
	 * A machine-readable, structured format.
	 * The serialized glyphs will look something like:
	 * 
	 * ```
	 * [{"g":"uni0651","cl":0,"dx":518,"dy":0,"ax":0,"ay":0},
	 * {"g":"uni0628","cl":0,"dx":0,"dy":0,"ax":1897,"ay":0}]
	 * ```
	 * 
	 * Each glyph is a JSON object, with the following properties:
	 * - `g`: the glyph name or glyph index if
	 *   #HB_BUFFER_SERIALIZE_FLAG_NO_GLYPH_NAMES flag is set.
	 * - `cl`: #hb_glyph_info_t.cluster if
	 *   #HB_BUFFER_SERIALIZE_FLAG_NO_CLUSTERS is not set.
	 * - `dx`,`dy`,`ax`,`ay`: #hb_glyph_position_t.x_offset, #hb_glyph_position_t.y_offset,
	 *    #hb_glyph_position_t.x_advance and #hb_glyph_position_t.y_advance
	 *    respectively, if #HB_BUFFER_SERIALIZE_FLAG_NO_POSITIONS is not set.
	 * - `xb`,`yb`,`w`,`h`: #hb_glyph_extents_t.x_bearing, #hb_glyph_extents_t.y_bearing,
	 *    #hb_glyph_extents_t.width and #hb_glyph_extents_t.height respectively if
	 *    #HB_BUFFER_SERIALIZE_FLAG_GLYPH_EXTENTS is set.
	 * @param buffer an #hb_buffer_t buffer.
	 * @param start the first item in #buffer to serialize.
	 * @param end the last item in #buffer to serialize.
	 * @param font the #hb_font_t used to shape this buffer, needed to
	 *        read glyph names and extents. If %NULL, and empty font will be used.
	 * @param format the #hb_buffer_serialize_format_t to use for formatting the output.
	 * @param flags the #hb_buffer_serialize_flags_t that control what glyph properties
	 *         to serialize.
	 * @returns The number of serialized items.
	 * 
	 * output string to
	 *       write serialized buffer into.
	 * 
	 * the size of #buf.
	 * 
	 * if not %NULL, will be set to the number of byes written into #buf.
	 */
	function buffer_serialize_glyphs(buffer: buffer_t, start: number, end: number, font: font_t | null, format: buffer_serialize_format_t, flags: buffer_serialize_flags_t): [ number, number[], number, number | null ];

	/**
	 * Returns a list of supported buffer serialization formats.
	 * @returns 
	 * A string array of buffer serialization formats. Should not be freed.
	 */
	function buffer_serialize_list_formats(): string[];

	/**
	 * Serializes #buffer into a textual representation of its content,
	 * when the buffer contains Unicode codepoints (i.e., before shaping). This is
	 * useful for showing the contents of the buffer, for example during debugging.
	 * There are currently two supported serialization formats:
	 * 
	 * ## text
	 * A human-readable, plain text format.
	 * The serialized codepoints will look something like:
	 * 
	 * ```
	 *  <U+0651=0|U+0628=1>
	 * ```
	 * 
	 * - Glyphs are separated with `|`
	 * - Unicode codepoints are expressed as zero-padded four (or more)
	 *   digit hexadecimal numbers preceded by `U+`
	 * - If #HB_BUFFER_SERIALIZE_FLAG_NO_CLUSTERS is not set, the cluster
	 *   will be indicated with a `=` then #hb_glyph_info_t.cluster.
	 * 
	 * ## json
	 * A machine-readable, structured format.
	 * The serialized codepoints will be a list of objects with the following
	 * properties:
	 * - `u`: the Unicode codepoint as a decimal integer
	 * - `cl`: #hb_glyph_info_t.cluster if
	 *   #HB_BUFFER_SERIALIZE_FLAG_NO_CLUSTERS is not set.
	 * 
	 * For example:
	 * 
	 * ```
	 * [{u:1617,cl:0},{u:1576,cl:1}]
	 * ```
	 * @param buffer an #hb_buffer_t buffer.
	 * @param start the first item in #buffer to serialize.
	 * @param end the last item in #buffer to serialize.
	 * @param format the #hb_buffer_serialize_format_t to use for formatting the output.
	 * @param flags the #hb_buffer_serialize_flags_t that control what glyph properties
	 *         to serialize.
	 * @returns The number of serialized items.
	 * 
	 * output string to
	 *       write serialized buffer into.
	 * 
	 * the size of #buf.
	 * 
	 * if not %NULL, will be set to the number of byes written into #buf.
	 */
	function buffer_serialize_unicode(buffer: buffer_t, start: number, end: number, format: buffer_serialize_format_t, flags: buffer_serialize_flags_t): [ number, number[], number, number | null ];

	/**
	 * Sets the cluster level of a buffer. The #hb_buffer_cluster_level_t
	 * dictates one aspect of how HarfBuzz will treat non-base characters
	 * during shaping.
	 * @param buffer An #hb_buffer_t
	 * @param cluster_level The cluster level to set on the buffer
	 */
	function buffer_set_cluster_level(buffer: buffer_t, cluster_level: buffer_cluster_level_t): void;

	/**
	 * Sets the type of #buffer contents. Buffers are either empty, contain
	 * characters (before shaping), or contain glyphs (the result of shaping).
	 * @param buffer An #hb_buffer_t
	 * @param content_type The type of buffer contents to set
	 */
	function buffer_set_content_type(buffer: buffer_t, content_type: buffer_content_type_t): void;

	/**
	 * Set the text flow direction of the buffer. No shaping can happen without
	 * setting #buffer direction, and it controls the visual direction for the
	 * output glyphs; for RTL direction the glyphs will be reversed. Many layout
	 * features depend on the proper setting of the direction, for example,
	 * reversing RTL text before shaping, then shaping with LTR direction is not
	 * the same as keeping the text in logical order and shaping with RTL
	 * direction.
	 * @param buffer An #hb_buffer_t
	 * @param direction the #hb_direction_t of the #buffer
	 */
	function buffer_set_direction(buffer: buffer_t, direction: direction_t): void;

	/**
	 * Sets #buffer flags to #flags. See #hb_buffer_flags_t.
	 * @param buffer An #hb_buffer_t
	 * @param flags The buffer flags to set
	 */
	function buffer_set_flags(buffer: buffer_t, flags: buffer_flags_t): void;

	/**
	 * Sets the #hb_codepoint_t that replaces invisible characters in
	 * the shaping result.  If set to zero (default), the glyph for the
	 * U+0020 SPACE character is used.  Otherwise, this value is used
	 * verbatim.
	 * @param buffer An #hb_buffer_t
	 * @param invisible the invisible #hb_codepoint_t
	 */
	function buffer_set_invisible_glyph(buffer: buffer_t, invisible: codepoint_t): void;

	/**
	 * Sets the language of #buffer to #language.
	 * 
	 * Languages are crucial for selecting which OpenType feature to apply to the
	 * buffer which can result in applying language-specific behaviour. Languages
	 * are orthogonal to the scripts, and though they are related, they are
	 * different concepts and should not be confused with each other.
	 * 
	 * Use {@link Hb.language_from_string} to convert from BCP 47 language tags to
	 * #hb_language_t.
	 * @param buffer An #hb_buffer_t
	 * @param language An hb_language_t to set
	 */
	function buffer_set_language(buffer: buffer_t, language: language_t): void;

	/**
	 * Similar to {@link Hb.buffer_pre_allocate}, but clears any new items added at the
	 * end.
	 * @param buffer An #hb_buffer_t
	 * @param length The new length of #buffer
	 * @returns %true if #buffer memory allocation succeeded, %false otherwise.
	 */
	function buffer_set_length(buffer: buffer_t, length: number): bool_t;

	/**
	 * Sets the implementation function for #hb_buffer_message_func_t.
	 * @param buffer An #hb_buffer_t
	 * @param func Callback function
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function buffer_set_message_func(buffer: buffer_t, func: buffer_message_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the #hb_codepoint_t that replaces invalid entries for a given encoding
	 * when adding text to #buffer.
	 * 
	 * Default is #HB_BUFFER_REPLACEMENT_CODEPOINT_DEFAULT.
	 * @param buffer An #hb_buffer_t
	 * @param replacement the replacement #hb_codepoint_t
	 */
	function buffer_set_replacement_codepoint(buffer: buffer_t, replacement: codepoint_t): void;

	/**
	 * Sets the script of #buffer to #script.
	 * 
	 * Script is crucial for choosing the proper shaping behaviour for scripts that
	 * require it (e.g. Arabic) and the which OpenType features defined in the font
	 * to be applied.
	 * 
	 * You can pass one of the predefined #hb_script_t values, or use
	 * {@link Hb.script_from_string} or hb_script_from_iso15924_tag() to get the
	 * corresponding script from an ISO 15924 script tag.
	 * @param buffer An #hb_buffer_t
	 * @param script An #hb_script_t to set.
	 */
	function buffer_set_script(buffer: buffer_t, script: script_t): void;

	/**
	 * Sets the segment properties of the buffer, a shortcut for calling
	 * {@link Hb.buffer_set_direction}, hb_buffer_set_script() and
	 * hb_buffer_set_language() individually.
	 * @param buffer An #hb_buffer_t
	 * @param props An #hb_segment_properties_t to use
	 */
	function buffer_set_segment_properties(buffer: buffer_t, props: segment_properties_t): void;

	/**
	 * Sets the Unicode-functions structure of a buffer to
	 * #unicode_funcs.
	 * @param buffer An #hb_buffer_t
	 * @param unicode_funcs The Unicode-functions structure
	 */
	function buffer_set_unicode_funcs(buffer: buffer_t, unicode_funcs: unicode_funcs_t): void;

	/**
	 * Attaches a user-data key/data pair to the specified buffer.
	 * @param buffer An #hb_buffer_t
	 * @param key The user-data key
	 * @param data A pointer to the user data
	 * @param destroy A callback to call when #data is not needed anymore
	 * @param replace Whether to replace an existing data with the same key
	 * @returns %true if success, %false otherwise
	 */
	function buffer_set_user_data(buffer: buffer_t, key: user_data_key_t, data: any | null, destroy: destroy_func_t | null, replace: bool_t): bool_t;

	/**
	 * Fetches the alpha channel of the given #color.
	 * @param color an #hb_color_t we are interested in its channels.
	 * @returns Alpha channel value
	 */
	function color_get_alpha(color: color_t): number;

	/**
	 * Fetches the blue channel of the given #color.
	 * @param color an #hb_color_t we are interested in its channels.
	 * @returns Blue channel value
	 */
	function color_get_blue(color: color_t): number;

	/**
	 * Fetches the green channel of the given #color.
	 * @param color an #hb_color_t we are interested in its channels.
	 * @returns Green channel value
	 */
	function color_get_green(color: color_t): number;

	/**
	 * Fetches the red channel of the given #color.
	 * @param color an #hb_color_t we are interested in its channels.
	 * @returns Red channel value
	 */
	function color_get_red(color: color_t): number;

	/**
	 * Converts a string to an #hb_direction_t.
	 * 
	 * Matching is loose and applies only to the first letter. For
	 * examples, "LTR" and "left-to-right" will both return #HB_DIRECTION_LTR.
	 * 
	 * Unmatched strings will return #HB_DIRECTION_INVALID.
	 * @param str String to convert
	 * @param len Length of #str, or -1 if it is %NULL-terminated
	 * @returns The #hb_direction_t matching #str
	 */
	function direction_from_string(str: number[], len: number): direction_t;

	/**
	 * Converts an #hb_direction_t to a string.
	 * @param direction The #hb_direction_t to convert
	 * @returns The string corresponding to #direction
	 */
	function direction_to_string(direction: direction_t): string;

	/**
	 * Add table for #tag with data provided by #blob to the face.  #face must
	 * be created using {@link Hb.face_builder_create}.
	 * @param face A face object created with {@link Hb.face_builder_create}
	 * @param tag The #hb_tag_t of the table to add
	 * @param blob The blob containing the table data to add
	 * @returns 
	 */
	function face_builder_add_table(face: face_t, tag: tag_t, blob: blob_t): bool_t;

	/**
	 * Creates a #hb_face_t that can be used with {@link Hb.face_builder_add_table}.
	 * After tables are added to the face, it can be compiled to a binary
	 * font file by calling hb_face_reference_blob().
	 * @returns New face.
	 */
	function face_builder_create(): face_t;

	/**
	 * Collects all of the Unicode characters covered by #face and adds
	 * them to the #hb_set_t set #out.
	 * @param face A face object
	 * @param out The set to add Unicode characters to
	 */
	function face_collect_unicodes(face: face_t, out: set_t): void;

	/**
	 * Collects all Unicode "Variation Selector" characters covered by #face and adds
	 * them to the #hb_set_t set #out.
	 * @param face A face object
	 * @param out The set to add Variation Selector characters to
	 */
	function face_collect_variation_selectors(face: face_t, out: set_t): void;

	/**
	 * Collects all Unicode characters for #variation_selector covered by #face and adds
	 * them to the #hb_set_t set #out.
	 * @param face A face object
	 * @param variation_selector The Variation Selector to query
	 * @param out The set to add Unicode characters to
	 */
	function face_collect_variation_unicodes(face: face_t, variation_selector: codepoint_t, out: set_t): void;

	/**
	 * Fetches the number of faces in a blob.
	 * @param blob a blob.
	 * @returns Number of faces in #blob
	 */
	function face_count(blob: blob_t): number;

	/**
	 * Constructs a new face object from the specified blob and
	 * a face index into that blob. This is used for blobs of
	 * file formats such as Dfont and TTC that can contain more
	 * than one face.
	 * @param blob #hb_blob_t to work upon
	 * @param index The index of the face within #blob
	 * @returns The new face object
	 */
	function face_create(blob: blob_t, index: number): face_t;

	/**
	 * Variant of {@link Hb.face_create}, built for those cases where it is more
	 * convenient to provide data for individual tables instead of the whole font
	 * data. With the caveat that hb_face_get_table_tags() does not currently work
	 * with faces created this way.
	 * 
	 * Creates a new face object from the specified #user_data and #reference_table_func,
	 * with the #destroy callback.
	 * @param reference_table_func Table-referencing function
	 * @param destroy A callback to call when #data is not needed anymore
	 * @returns The new face object
	 */
	function face_create_for_tables(reference_table_func: reference_table_func_t, destroy: destroy_func_t | null): face_t;

	/**
	 * Decreases the reference count on a face object. When the
	 * reference count reaches zero, the face is destroyed,
	 * freeing all memory.
	 * @param face A face object
	 */
	function face_destroy(face: face_t): void;

	/**
	 * Fetches the singleton empty face object.
	 * @returns The empty face object
	 */
	function face_get_empty(): face_t;

	/**
	 * Fetches the glyph-count value of the specified face object.
	 * @param face A face object
	 * @returns The glyph-count value of #face
	 */
	function face_get_glyph_count(face: face_t): number;

	/**
	 * Fetches the face-index corresponding to the given face.
	 * 
	 * <note>Note: face indices within a collection are zero-based.</note>
	 * @param face A face object
	 * @returns The index of #face.
	 */
	function face_get_index(face: face_t): number;

	/**
	 * Fetches a list of all table tags for a face, if possible. The list returned will
	 * begin at the offset provided
	 * @param face A face object
	 * @param start_offset The index of first table tag to retrieve
	 * @returns Total number of tables, or zero if it is not possible to list
	 * 
	 * Input = the maximum number of table tags to return;
	 *                Output = the actual number of table tags returned (may be zero)
	 * 
	 * The array of table tags found
	 */
	function face_get_table_tags(face: face_t, start_offset: number): [ number, number, tag_t[] ];

	/**
	 * Fetches the units-per-em (upem) value of the specified face object.
	 * @param face A face object
	 * @returns The upem value of #face
	 */
	function face_get_upem(face: face_t): number;

	/**
	 * Fetches the user data associated with the specified key,
	 * attached to the specified face object.
	 * @param face A face object
	 * @param key The user-data key to query
	 * @returns A pointer to the user data
	 */
	function face_get_user_data(face: face_t, key: user_data_key_t): any | null;

	/**
	 * Tests whether the given face object is immutable.
	 * @param face A face object
	 * @returns %true is #face is immutable, %false otherwise
	 */
	function face_is_immutable(face: face_t): bool_t;

	/**
	 * Makes the given face object immutable.
	 * @param face A face object
	 */
	function face_make_immutable(face: face_t): void;

	/**
	 * Increases the reference count on a face object.
	 * @param face A face object
	 * @returns The #face object
	 */
	function face_reference(face: face_t): face_t;

	/**
	 * Fetches a pointer to the binary blob that contains the
	 * specified face. Returns an empty blob if referencing face data is not
	 * possible.
	 * @param face A face object
	 * @returns A pointer to the blob for #face
	 */
	function face_reference_blob(face: face_t): blob_t;

	/**
	 * Fetches a reference to the specified table within
	 * the specified face.
	 * @param face A face object
	 * @param tag The #hb_tag_t of the table to query
	 * @returns A pointer to the #tag table within #face
	 */
	function face_reference_table(face: face_t, tag: tag_t): blob_t;

	/**
	 * Sets the glyph count for a face object to the specified value.
	 * @param face A face object
	 * @param glyph_count The glyph-count value to assign
	 */
	function face_set_glyph_count(face: face_t, glyph_count: number): void;

	/**
	 * Assigns the specified face-index to #face. Fails if the
	 * face is immutable.
	 * 
	 * <note>Note: face indices within a collection are zero-based.</note>
	 * @param face A face object
	 * @param index The index to assign
	 */
	function face_set_index(face: face_t, index: number): void;

	/**
	 * Sets the units-per-em (upem) for a face object to the specified value.
	 * @param face A face object
	 * @param upem The units-per-em value to assign
	 */
	function face_set_upem(face: face_t, upem: number): void;

	/**
	 * Attaches a user-data key/data pair to the given face object.
	 * @param face A face object
	 * @param key The user-data key to set
	 * @param data A pointer to the user data
	 * @param destroy A callback to call when #data is not needed anymore
	 * @param replace Whether to replace an existing data with the same key
	 * @returns %true if success, %false otherwise
	 */
	function face_set_user_data(face: face_t, key: user_data_key_t, data: any | null, destroy: destroy_func_t | null, replace: bool_t): bool_t;

	/**
	 * Parses a string into a #hb_feature_t.
	 * 
	 * The format for specifying feature strings follows. All valid CSS
	 * font-feature-settings values other than 'normal' and the global values are
	 * also accepted, though not documented below. CSS string escapes are not
	 * supported.
	 * 
	 * The range indices refer to the positions between Unicode characters. The
	 * position before the first character is always 0.
	 * 
	 * The format is Python-esque.  Here is how it all works:
	 * 
	 * <informaltable pgwide='1' align='left' frame='none'>
	 * <tgroup cols='5'>
	 * <thead>
	 * <row><entry>Syntax</entry>    <entry>Value</entry> <entry>Start</entry> <entry>End</entry></row>
	 * </thead>
	 * <tbody>
	 * <row><entry>Setting value:</entry></row>
	 * <row><entry>kern</entry>      <entry>1</entry>     <entry>0</entry>      <entry>∞</entry>   <entry>Turn feature on</entry></row>
	 * <row><entry>+kern</entry>     <entry>1</entry>     <entry>0</entry>      <entry>∞</entry>   <entry>Turn feature on</entry></row>
	 * <row><entry>-kern</entry>     <entry>0</entry>     <entry>0</entry>      <entry>∞</entry>   <entry>Turn feature off</entry></row>
	 * <row><entry>kern=0</entry>    <entry>0</entry>     <entry>0</entry>      <entry>∞</entry>   <entry>Turn feature off</entry></row>
	 * <row><entry>kern=1</entry>    <entry>1</entry>     <entry>0</entry>      <entry>∞</entry>   <entry>Turn feature on</entry></row>
	 * <row><entry>aalt=2</entry>    <entry>2</entry>     <entry>0</entry>      <entry>∞</entry>   <entry>Choose 2nd alternate</entry></row>
	 * <row><entry>Setting index:</entry></row>
	 * <row><entry>kern[]</entry>    <entry>1</entry>     <entry>0</entry>      <entry>∞</entry>   <entry>Turn feature on</entry></row>
	 * <row><entry>kern[:]</entry>   <entry>1</entry>     <entry>0</entry>      <entry>∞</entry>   <entry>Turn feature on</entry></row>
	 * <row><entry>kern[5:]</entry>  <entry>1</entry>     <entry>5</entry>      <entry>∞</entry>   <entry>Turn feature on, partial</entry></row>
	 * <row><entry>kern[:5]</entry>  <entry>1</entry>     <entry>0</entry>      <entry>5</entry>   <entry>Turn feature on, partial</entry></row>
	 * <row><entry>kern[3:5]</entry> <entry>1</entry>     <entry>3</entry>      <entry>5</entry>   <entry>Turn feature on, range</entry></row>
	 * <row><entry>kern[3]</entry>   <entry>1</entry>     <entry>3</entry>      <entry>3+1</entry> <entry>Turn feature on, single char</entry></row>
	 * <row><entry>Mixing it all:</entry></row>
	 * <row><entry>aalt[3:5]=2</entry> <entry>2</entry>   <entry>3</entry>      <entry>5</entry>   <entry>Turn 2nd alternate on for range</entry></row>
	 * </tbody>
	 * </tgroup>
	 * </informaltable>
	 * @param str a string to parse
	 * @param len length of #str, or -1 if string is %NULL terminated
	 * @returns %true if #str is successfully parsed, %false otherwise
	 * 
	 * the #hb_feature_t to initialize with the parsed values
	 */
	function feature_from_string(str: number[], len: number): [ bool_t, feature_t ];

	/**
	 * Converts a #hb_feature_t into a %NULL-terminated string in the format
	 * understood by {@link Hb.feature_from_string}. The client in responsible for
	 * allocating big enough size for #buf, 128 bytes is more than enough.
	 * @param feature an #hb_feature_t to convert
	 * @returns output string
	 * 
	 * the allocated size of #buf
	 */
	function feature_to_string(feature: feature_t): [ string[], number ];

	/**
	 * Adds the origin coordinates to an (X,Y) point coordinate, in
	 * the specified glyph ID in the specified font.
	 * 
	 * Calls the appropriate direction-specific variant (horizontal
	 * or vertical) depending on the value of #direction.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @param direction The direction of the text segment
	 */
	function font_add_glyph_origin_for_direction(font: font_t, glyph: codepoint_t, direction: direction_t): void;

	/**
	 * Constructs a new font object from the specified face.
	 * @param face a face.
	 * @returns The new font object
	 */
	function font_create(face: face_t): font_t;

	/**
	 * Constructs a sub-font font object from the specified #parent font,
	 * replicating the parent's properties.
	 * @param parent The parent font object
	 * @returns The new sub-font font object
	 */
	function font_create_sub_font(parent: font_t): font_t;

	/**
	 * Decreases the reference count on the given font object. When the
	 * reference count reaches zero, the font is destroyed,
	 * freeing all memory.
	 * @param font #hb_font_t to work upon
	 */
	function font_destroy(font: font_t): void;

	/**
	 * Creates a new #hb_font_funcs_t structure of font functions.
	 * @returns The font-functions structure
	 */
	function font_funcs_create(): font_funcs_t;

	/**
	 * Decreases the reference count on a font-functions structure. When
	 * the reference count reaches zero, the font-functions structure is
	 * destroyed, freeing all memory.
	 * @param ffuncs The font-functions structure
	 */
	function font_funcs_destroy(ffuncs: font_funcs_t): void;

	/**
	 * Fetches an empty font-functions structure.
	 * @returns The font-functions structure
	 */
	function font_funcs_get_empty(): font_funcs_t;

	/**
	 * Fetches the user data associated with the specified key,
	 * attached to the specified font-functions structure.
	 * @param ffuncs The font-functions structure
	 * @param key The user-data key to query
	 * @returns A pointer to the user data
	 */
	function font_funcs_get_user_data(ffuncs: font_funcs_t, key: user_data_key_t): any | null;

	/**
	 * Tests whether a font-functions structure is immutable.
	 * @param ffuncs The font-functions structure
	 * @returns %true if #ffuncs is immutable, %false otherwise
	 */
	function font_funcs_is_immutable(ffuncs: font_funcs_t): bool_t;

	/**
	 * Makes a font-functions structure immutable.
	 * @param ffuncs The font-functions structure
	 */
	function font_funcs_make_immutable(ffuncs: font_funcs_t): void;

	/**
	 * Increases the reference count on a font-functions structure.
	 * @param ffuncs The font-functions structure
	 * @returns The font-functions structure
	 */
	function font_funcs_reference(ffuncs: font_funcs_t): font_funcs_t;

	/**
	 * Sets the implementation function for #hb_font_get_font_h_extents_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_font_h_extents_func(ffuncs: font_funcs_t, func: font_get_font_h_extents_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_font_v_extents_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_font_v_extents_func(ffuncs: font_funcs_t, func: font_get_font_v_extents_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_contour_point_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_contour_point_func(ffuncs: font_funcs_t, func: font_get_glyph_contour_point_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_extents_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_extents_func(ffuncs: font_funcs_t, func: font_get_glyph_extents_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_from_name_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_from_name_func(ffuncs: font_funcs_t, func: font_get_glyph_from_name_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Deprecated.  Use {@link Hb.font_funcs_set_nominal_glyph_func} and
	 * hb_font_funcs_set_variation_glyph_func() instead.
	 * @param ffuncs The font-functions structure
	 * @param func callback function
	 * @param destroy function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_func(ffuncs: font_funcs_t, func: font_get_glyph_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_h_advance_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_h_advance_func(ffuncs: font_funcs_t, func: font_get_glyph_h_advance_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_h_advances_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_h_advances_func(ffuncs: font_funcs_t, func: font_get_glyph_h_advances_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_h_kerning_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_h_kerning_func(ffuncs: font_funcs_t, func: font_get_glyph_h_kerning_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_h_origin_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_h_origin_func(ffuncs: font_funcs_t, func: font_get_glyph_h_origin_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_name_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_name_func(ffuncs: font_funcs_t, func: font_get_glyph_name_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_v_advance_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_v_advance_func(ffuncs: font_funcs_t, func: font_get_glyph_v_advance_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_v_advances_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_v_advances_func(ffuncs: font_funcs_t, func: font_get_glyph_v_advances_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_v_kerning_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_v_kerning_func(ffuncs: font_funcs_t, func: font_get_glyph_v_kerning_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_glyph_v_origin_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_glyph_v_origin_func(ffuncs: font_funcs_t, func: font_get_glyph_v_origin_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_nominal_glyph_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_nominal_glyph_func(ffuncs: font_funcs_t, func: font_get_nominal_glyph_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_font_get_nominal_glyphs_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_nominal_glyphs_func(ffuncs: font_funcs_t, func: font_get_nominal_glyphs_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Attaches a user-data key/data pair to the specified font-functions structure.
	 * @param ffuncs The font-functions structure
	 * @param key The user-data key to set
	 * @param data A pointer to the user data set
	 * @param destroy A callback to call when #data is not needed anymore
	 * @param replace Whether to replace an existing data with the same key
	 * @returns %true if success, %false otherwise
	 */
	function font_funcs_set_user_data(ffuncs: font_funcs_t, key: user_data_key_t, data: any | null, destroy: destroy_func_t | null, replace: bool_t): bool_t;

	/**
	 * Sets the implementation function for #hb_font_get_variation_glyph_func_t.
	 * @param ffuncs A font-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function font_funcs_set_variation_glyph_func(ffuncs: font_funcs_t, func: font_get_variation_glyph_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Fetches the empty font object.
	 * @returns The empty font object
	 */
	function font_get_empty(): font_t;

	/**
	 * Fetches the extents for a font in a text segment of the
	 * specified direction.
	 * 
	 * Calls the appropriate direction-specific variant (horizontal
	 * or vertical) depending on the value of #direction.
	 * @param font #hb_font_t to work upon
	 * @param direction The direction of the text segment
	 * @returns The #hb_font_extents_t retrieved
	 */
	function font_get_extents_for_direction(font: font_t, direction: direction_t): font_extents_t;

	/**
	 * Fetches the face associated with the specified font object.
	 * @param font #hb_font_t to work upon
	 * @returns The #hb_face_t value
	 */
	function font_get_face(font: font_t): face_t;

	/**
	 * Fetches the glyph ID for a Unicode code point in the specified
	 * font, with an optional variation selector.
	 * 
	 * If #variation_selector is 0, calls {@link Hb.font_get_nominal_glyph};
	 * otherwise calls hb_font_get_variation_glyph().
	 * @param font #hb_font_t to work upon
	 * @param unicode The Unicode code point to query
	 * @param variation_selector A variation-selector code point
	 * @returns %true if data found, %false otherwise
	 * 
	 * The glyph ID retrieved
	 */
	function font_get_glyph(font: font_t, unicode: codepoint_t, variation_selector: codepoint_t): [ bool_t, codepoint_t ];

	/**
	 * Fetches the advance for a glyph ID from the specified font,
	 * in a text segment of the specified direction.
	 * 
	 * Calls the appropriate direction-specific variant (horizontal
	 * or vertical) depending on the value of #direction.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @param direction The direction of the text segment
	 * @returns The horizontal advance retrieved
	 * 
	 * The vertical advance retrieved
	 */
	function font_get_glyph_advance_for_direction(font: font_t, glyph: codepoint_t, direction: direction_t): [ x: position_t, y: position_t ];

	/**
	 * Fetches the advances for a sequence of glyph IDs in the specified
	 * font, in a text segment of the specified direction.
	 * 
	 * Calls the appropriate direction-specific variant (horizontal
	 * or vertical) depending on the value of #direction.
	 * @param font #hb_font_t to work upon
	 * @param direction The direction of the text segment
	 * @param count The number of glyph IDs in the sequence queried
	 * @param first_glyph The first glyph ID to query
	 * @param glyph_stride The stride between successive glyph IDs
	 * @returns The first advance retrieved
	 * 
	 * The stride between successive advances
	 */
	function font_get_glyph_advances_for_direction(font: font_t, direction: direction_t, count: number, first_glyph: codepoint_t, glyph_stride: number): [ first_advance: position_t, advance_stride: number ];

	/**
	 * Fetches the (x,y) coordinates of a specified contour-point index
	 * in the specified glyph, within the specified font.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @param point_index The contour-point index to query
	 * @returns %true if data found, %false otherwise
	 * 
	 * The X value retrieved for the contour point
	 * 
	 * The Y value retrieved for the contour point
	 */
	function font_get_glyph_contour_point(font: font_t, glyph: codepoint_t, point_index: number): [ bool_t, position_t, position_t ];

	/**
	 * Fetches the (X,Y) coordinates of a specified contour-point index
	 * in the specified glyph ID in the specified font, with respect
	 * to the origin in a text segment in the specified direction.
	 * 
	 * Calls the appropriate direction-specific variant (horizontal
	 * or vertical) depending on the value of #direction.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @param point_index The contour-point index to query
	 * @param direction The direction of the text segment
	 * @returns %true if data found, %false otherwise
	 * 
	 * The X value retrieved for the contour point
	 * 
	 * The Y value retrieved for the contour point
	 */
	function font_get_glyph_contour_point_for_origin(font: font_t, glyph: codepoint_t, point_index: number, direction: direction_t): [ bool_t, position_t, position_t ];

	/**
	 * Fetches the #hb_glyph_extents_t data for a glyph ID
	 * in the specified font.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @returns %true if data found, %false otherwise
	 * 
	 * The #hb_glyph_extents_t retrieved
	 */
	function font_get_glyph_extents(font: font_t, glyph: codepoint_t): [ bool_t, glyph_extents_t ];

	/**
	 * Fetches the #hb_glyph_extents_t data for a glyph ID
	 * in the specified font, with respect to the origin in
	 * a text segment in the specified direction.
	 * 
	 * Calls the appropriate direction-specific variant (horizontal
	 * or vertical) depending on the value of #direction.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @param direction The direction of the text segment
	 * @returns %true if data found, %false otherwise
	 * 
	 * The #hb_glyph_extents_t retrieved
	 */
	function font_get_glyph_extents_for_origin(font: font_t, glyph: codepoint_t, direction: direction_t): [ bool_t, glyph_extents_t ];

	/**
	 * Fetches the glyph ID that corresponds to a name string in the specified #font.
	 * 
	 * <note>Note: #len == -1 means the name string is null-terminated.</note>
	 * @param font #hb_font_t to work upon
	 * @param name The name string to query
	 * @param len The length of the name queried
	 * @returns %true if data found, %false otherwise
	 * 
	 * The glyph ID retrieved
	 */
	function font_get_glyph_from_name(font: font_t, name: string[], len: number): [ bool_t, codepoint_t ];

	/**
	 * Fetches the advance for a glyph ID in the specified font,
	 * for horizontal text segments.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @returns The advance of #glyph within #font
	 */
	function font_get_glyph_h_advance(font: font_t, glyph: codepoint_t): position_t;

	/**
	 * Fetches the advances for a sequence of glyph IDs in the specified
	 * font, for horizontal text segments.
	 * @param font #hb_font_t to work upon
	 * @param count The number of glyph IDs in the sequence queried
	 * @param first_glyph The first glyph ID to query
	 * @param glyph_stride The stride between successive glyph IDs
	 * @param advance_stride The stride between successive advances
	 * @returns The first advance retrieved
	 */
	function font_get_glyph_h_advances(font: font_t, count: number, first_glyph: codepoint_t, glyph_stride: number, advance_stride: number): position_t;

	/**
	 * Fetches the kerning-adjustment value for a glyph-pair in
	 * the specified font, for horizontal text segments.
	 * 
	 * <note>It handles legacy kerning only (as returned by the corresponding
	 * #hb_font_funcs_t function).</note>
	 * @param font #hb_font_t to work upon
	 * @param left_glyph The glyph ID of the left glyph in the glyph pair
	 * @param right_glyph The glyph ID of the right glyph in the glyph pair
	 * @returns The kerning adjustment value
	 */
	function font_get_glyph_h_kerning(font: font_t, left_glyph: codepoint_t, right_glyph: codepoint_t): position_t;

	/**
	 * Fetches the (X,Y) coordinates of the origin for a glyph ID
	 * in the specified font, for horizontal text segments.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @returns %true if data found, %false otherwise
	 * 
	 * The X coordinate of the origin
	 * 
	 * The Y coordinate of the origin
	 */
	function font_get_glyph_h_origin(font: font_t, glyph: codepoint_t): [ bool_t, position_t, position_t ];

	/**
	 * Fetches the kerning-adjustment value for a glyph-pair in the specified font.
	 * 
	 * Calls the appropriate direction-specific variant (horizontal
	 * or vertical) depending on the value of #direction.
	 * @param font #hb_font_t to work upon
	 * @param first_glyph The glyph ID of the first glyph in the glyph pair to query
	 * @param second_glyph The glyph ID of the second glyph in the glyph pair to query
	 * @param direction The direction of the text segment
	 * @returns The horizontal kerning-adjustment value retrieved
	 * 
	 * The vertical kerning-adjustment value retrieved
	 */
	function font_get_glyph_kerning_for_direction(font: font_t, first_glyph: codepoint_t, second_glyph: codepoint_t, direction: direction_t): [ x: position_t, y: position_t ];

	/**
	 * Fetches the glyph-name string for a glyph ID in the specified #font.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @returns %true if data found, %false otherwise
	 * 
	 * Name string retrieved for the glyph ID
	 * 
	 * Length of the glyph-name string retrieved
	 */
	function font_get_glyph_name(font: font_t, glyph: codepoint_t): [ bool_t, string[], number ];

	/**
	 * Fetches the (X,Y) coordinates of the origin for a glyph in
	 * the specified font.
	 * 
	 * Calls the appropriate direction-specific variant (horizontal
	 * or vertical) depending on the value of #direction.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @param direction The direction of the text segment
	 * @returns The X coordinate retrieved for the origin
	 * 
	 * The Y coordinate retrieved for the origin
	 */
	function font_get_glyph_origin_for_direction(font: font_t, glyph: codepoint_t, direction: direction_t): [ x: position_t, y: position_t ];

	/**
	 * Fetches the advance for a glyph ID in the specified font,
	 * for vertical text segments.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @returns The advance of #glyph within #font
	 */
	function font_get_glyph_v_advance(font: font_t, glyph: codepoint_t): position_t;

	/**
	 * Fetches the advances for a sequence of glyph IDs in the specified
	 * font, for vertical text segments.
	 * @param font #hb_font_t to work upon
	 * @param count The number of glyph IDs in the sequence queried
	 * @param first_glyph The first glyph ID to query
	 * @param glyph_stride The stride between successive glyph IDs
	 * @returns The first advance retrieved
	 * 
	 * The stride between successive advances
	 */
	function font_get_glyph_v_advances(font: font_t, count: number, first_glyph: codepoint_t, glyph_stride: number): [ first_advance: position_t, advance_stride: number ];

	/**
	 * Fetches the kerning-adjustment value for a glyph-pair in
	 * the specified font, for vertical text segments.
	 * 
	 * <note>It handles legacy kerning only (as returned by the corresponding
	 * #hb_font_funcs_t function).</note>
	 * @param font #hb_font_t to work upon
	 * @param top_glyph The glyph ID of the top glyph in the glyph pair
	 * @param bottom_glyph The glyph ID of the bottom glyph in the glyph pair
	 * @returns The kerning adjustment value
	 */
	function font_get_glyph_v_kerning(font: font_t, top_glyph: codepoint_t, bottom_glyph: codepoint_t): position_t;

	/**
	 * Fetches the (X,Y) coordinates of the origin for a glyph ID
	 * in the specified font, for vertical text segments.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @returns %true if data found, %false otherwise
	 * 
	 * The X coordinate of the origin
	 * 
	 * The Y coordinate of the origin
	 */
	function font_get_glyph_v_origin(font: font_t, glyph: codepoint_t): [ bool_t, position_t, position_t ];

	/**
	 * Fetches the extents for a specified font, for horizontal
	 * text segments.
	 * @param font #hb_font_t to work upon
	 * @returns %true if data found, %false otherwise
	 * 
	 * The font extents retrieved
	 */
	function font_get_h_extents(font: font_t): [ bool_t, font_extents_t ];

	/**
	 * Fetches the nominal glyph ID for a Unicode code point in the
	 * specified font.
	 * 
	 * This version of the function should not be used to fetch glyph IDs
	 * for code points modified by variation selectors. For variation-selector
	 * support, user {@link Hb.font_get_variation_glyph} or use hb_font_get_glyph().
	 * @param font #hb_font_t to work upon
	 * @param unicode The Unicode code point to query
	 * @returns %true if data found, %false otherwise
	 * 
	 * The glyph ID retrieved
	 */
	function font_get_nominal_glyph(font: font_t, unicode: codepoint_t): [ bool_t, codepoint_t ];

	/**
	 * Fetches the nominal glyph IDs for a sequence of Unicode code points. Glyph
	 * IDs must be returned in a #hb_codepoint_t output parameter.
	 * @param font #hb_font_t to work upon
	 * @param count number of code points to query
	 * @param first_unicode The first Unicode code point to query
	 * @param unicode_stride The stride between successive code points
	 * @param glyph_stride The stride between successive glyph IDs
	 * @returns the number of code points processed
	 * 
	 * The first glyph ID retrieved
	 */
	function font_get_nominal_glyphs(font: font_t, count: number, first_unicode: codepoint_t, unicode_stride: number, glyph_stride: number): [ number, codepoint_t ];

	/**
	 * Fetches the parent font of #font.
	 * @param font #hb_font_t to work upon
	 * @returns The parent font object
	 */
	function font_get_parent(font: font_t): font_t;

	/**
	 * Fetches the horizontal and vertical points-per-em (ppem) of a font.
	 * @param font #hb_font_t to work upon
	 * @returns Horizontal ppem value
	 * 
	 * Vertical ppem value
	 */
	function font_get_ppem(font: font_t): [ x_ppem: number, y_ppem: number ];

	/**
	 * Fetches the "point size" of a font. Used in CoreText to
	 * implement optical sizing.
	 * @param font #hb_font_t to work upon
	 * @returns Point size.  A value of zero means "not set."
	 */
	function font_get_ptem(font: font_t): number;

	/**
	 * Fetches the horizontal and vertical scale of a font.
	 * @param font #hb_font_t to work upon
	 * @returns Horizontal scale value
	 * 
	 * Vertical scale value
	 */
	function font_get_scale(font: font_t): [ x_scale: number, y_scale: number ];

	/**
	 * Fetches the user-data object associated with the specified key,
	 * attached to the specified font object.
	 * @param font #hb_font_t to work upon
	 * @param key The user-data key to query
	 * @returns Pointer to the user data
	 */
	function font_get_user_data(font: font_t, key: user_data_key_t): any | null;

	/**
	 * Fetches the extents for a specified font, for vertical
	 * text segments.
	 * @param font #hb_font_t to work upon
	 * @returns %true if data found, %false otherwise
	 * 
	 * The font extents retrieved
	 */
	function font_get_v_extents(font: font_t): [ bool_t, font_extents_t ];

	/**
	 * Fetches the list of normalized variation coordinates currently
	 * set on a font.
	 * 
	 * Return value is valid as long as variation coordinates of the font
	 * are not modified.
	 * @param font #hb_font_t to work upon
	 * @param length Number of coordinates retrieved
	 * @returns 
	 */
	function font_get_var_coords_normalized(font: font_t, length: number): number;

	/**
	 * Fetches the glyph ID for a Unicode code point when followed by
	 * by the specified variation-selector code point, in the specified
	 * font.
	 * @param font #hb_font_t to work upon
	 * @param unicode The Unicode code point to query
	 * @param variation_selector The  variation-selector code point to query
	 * @returns %true if data found, %false otherwise
	 * 
	 * The glyph ID retrieved
	 */
	function font_get_variation_glyph(font: font_t, unicode: codepoint_t, variation_selector: codepoint_t): [ bool_t, codepoint_t ];

	/**
	 * Fetches the glyph ID from #font that matches the specified string.
	 * Strings of the format `gidDDD` or `uniUUUU` are parsed automatically.
	 * 
	 * <note>Note: #len == -1 means the string is null-terminated.</note>
	 * @param font #hb_font_t to work upon
	 * @param s string to query
	 * @param len The length of the string #s
	 * @returns %true if data found, %false otherwise
	 * 
	 * The glyph ID corresponding to the string requested
	 */
	function font_glyph_from_string(font: font_t, s: number[], len: number): [ bool_t, codepoint_t ];

	/**
	 * Fetches the name of the specified glyph ID in #font and returns
	 * it in string #s.
	 * 
	 * If the glyph ID has no name in #font, a string of the form `gidDDD` is
	 * generated, with `DDD` being the glyph ID.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @returns The string containing the glyph name
	 * 
	 * Length of string #s
	 */
	function font_glyph_to_string(font: font_t, glyph: codepoint_t): [ string[], number ];

	/**
	 * Tests whether a font object is immutable.
	 * @param font #hb_font_t to work upon
	 * @returns %true if #font is immutable, %false otherwise
	 */
	function font_is_immutable(font: font_t): bool_t;

	/**
	 * Makes #font immutable.
	 * @param font #hb_font_t to work upon
	 */
	function font_make_immutable(font: font_t): void;

	/**
	 * Increases the reference count on the given font object.
	 * @param font #hb_font_t to work upon
	 * @returns The #font object
	 */
	function font_reference(font: font_t): font_t;

	/**
	 * Sets #face as the font-face value of #font.
	 * @param font #hb_font_t to work upon
	 * @param face The #hb_face_t to assign
	 */
	function font_set_face(font: font_t, face: face_t): void;

	/**
	 * Replaces the font-functions structure attached to a font, updating
	 * the font's user-data with #font-data and the #destroy callback.
	 * @param font #hb_font_t to work upon
	 * @param klass The font-functions structure.
	 * @param font_data Data to attach to #font
	 * @param destroy The function to call when #font_data is not needed anymore
	 */
	function font_set_funcs(font: font_t, klass: font_funcs_t, font_data: any | null, destroy: destroy_func_t | null): void;

	/**
	 * Replaces the user data attached to a font, updating the font's
	 * #destroy callback.
	 * @param font #hb_font_t to work upon
	 * @param font_data Data to attach to #font
	 * @param destroy The function to call when #font_data is not needed anymore
	 */
	function font_set_funcs_data(font: font_t, font_data: any | null, destroy: destroy_func_t | null): void;

	/**
	 * Sets the parent font of #font.
	 * @param font #hb_font_t to work upon
	 * @param parent The parent font object to assign
	 */
	function font_set_parent(font: font_t, parent: font_t): void;

	/**
	 * Sets the horizontal and vertical pixels-per-em (ppem) of a font.
	 * @param font #hb_font_t to work upon
	 * @param x_ppem Horizontal ppem value to assign
	 * @param y_ppem Vertical ppem value to assign
	 */
	function font_set_ppem(font: font_t, x_ppem: number, y_ppem: number): void;

	/**
	 * Sets the "point size" of a font. Set to zero to unset.
	 * Used in CoreText to implement optical sizing.
	 * 
	 * <note>Note: There are 72 points in an inch.</note>
	 * @param font #hb_font_t to work upon
	 * @param ptem font size in points.
	 */
	function font_set_ptem(font: font_t, ptem: number): void;

	/**
	 * Sets the horizontal and vertical scale of a font.
	 * @param font #hb_font_t to work upon
	 * @param x_scale Horizontal scale value to assign
	 * @param y_scale Vertical scale value to assign
	 */
	function font_set_scale(font: font_t, x_scale: number, y_scale: number): void;

	/**
	 * Attaches a user-data key/data pair to the specified font object.
	 * @param font #hb_font_t to work upon
	 * @param key The user-data key
	 * @param data A pointer to the user data
	 * @param destroy A callback to call when #data is not needed anymore
	 * @param replace Whether to replace an existing data with the same key
	 * @returns %true if success, %false otherwise
	 */
	function font_set_user_data(font: font_t, key: user_data_key_t, data: any | null, destroy: destroy_func_t | null, replace: bool_t): bool_t;

	/**
	 * Applies a list of variation coordinates (in design-space units)
	 * to a font.
	 * @param font #hb_font_t to work upon
	 * @param coords Array of variation coordinates to apply
	 * @param coords_length Number of coordinates to apply
	 */
	function font_set_var_coords_design(font: font_t, coords: number[], coords_length: number): void;

	/**
	 * Applies a list of variation coordinates (in normalized units)
	 * to a font.
	 * 
	 * <note>Note: Coordinates should be normalized to 2.14.</note>
	 * @param font #hb_font_t to work upon
	 * @param coords Array of variation coordinates to apply
	 * @param coords_length Number of coordinates to apply
	 */
	function font_set_var_coords_normalized(font: font_t, coords: number[], coords_length: number): void;

	/**
	 * Sets design coords of a font from a named instance index.
	 * @param font a font.
	 * @param instance_index named instance index.
	 */
	function font_set_var_named_instance(font: font_t, instance_index: number): void;

	/**
	 * Applies a list of font-variation settings to a font.
	 * @param font #hb_font_t to work upon
	 * @param variations Array of variation settings to apply
	 * @param variations_length Number of variations to apply
	 */
	function font_set_variations(font: font_t, variations: variation_t[], variations_length: number): void;

	/**
	 * Subtracts the origin coordinates from an (X,Y) point coordinate,
	 * in the specified glyph ID in the specified font.
	 * 
	 * Calls the appropriate direction-specific variant (horizontal
	 * or vertical) depending on the value of #direction.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph ID to query
	 * @param direction The direction of the text segment
	 */
	function font_subtract_glyph_origin_for_direction(font: font_t, glyph: codepoint_t, direction: direction_t): void;

	/**
	 * Creates an #hb_face_t face object from the specified FT_Face.
	 * 
	 * This variant of the function does not provide any life-cycle management.
	 * 
	 * Most client programs should use {@link Hb.ft_face_create_referenced}
	 * (or, perhaps, hb_ft_face_create_cached()) instead.
	 * 
	 * If you know you have valid reasons not to use hb_ft_face_create_referenced(),
	 * then it is the client program's responsibility to destroy #ft_face
	 * after the #hb_face_t face object has been destroyed.
	 * @param ft_face FT_Face to work upon
	 * @param destroy A callback to call when the face object is not needed anymore
	 * @returns the new #hb_face_t face object
	 */
	function ft_face_create(ft_face: any, destroy: destroy_func_t | null): face_t;

	/**
	 * Creates an #hb_face_t face object from the specified FT_Face.
	 * 
	 * This variant of the function caches the newly created #hb_face_t
	 * face object, using the #generic pointer of #ft_face. Subsequent function
	 * calls that are passed the same #ft_face parameter will have the same
	 * #hb_face_t returned to them, and that #hb_face_t will be correctly
	 * reference counted.
	 * 
	 * However, client programs are still responsible for destroying
	 * #ft_face after the last #hb_face_t face object has been destroyed.
	 * @param ft_face FT_Face to work upon
	 * @returns the new #hb_face_t face object
	 */
	function ft_face_create_cached(ft_face: any): face_t;

	/**
	 * Creates an #hb_face_t face object from the specified FT_Face.
	 * 
	 * This is the preferred variant of the hb_ft_face_create*
	 * function family, because it calls {@link FT.Reference_Face} on #ft_face,
	 * ensuring that #ft_face remains alive as long as the resulting
	 * #hb_face_t face object remains alive. Also calls FT_Done_Face()
	 * when the #hb_face_t face object is destroyed.
	 * 
	 * Use this version unless you know you have good reasons not to.
	 * @param ft_face FT_Face to work upon
	 * @returns the new #hb_face_t face object
	 */
	function ft_face_create_referenced(ft_face: any): face_t;

	/**
	 * Refreshes the state of #font when the underlying FT_Face has changed.
	 * This function should be called after changing the size or
	 * variation-axis settings on the FT_Face.
	 * @param font #hb_font_t to work upon
	 */
	function ft_font_changed(font: font_t): void;

	/**
	 * Creates an #hb_font_t font object from the specified FT_Face.
	 * 
	 * <note>Note: You must set the face size on #ft_face before calling
	 * {@link Hb.ft_font_create} on it. HarfBuzz assumes size is always set and will
	 * access `size` member of FT_Face unconditionally.</note>
	 * 
	 * This variant of the function does not provide any life-cycle management.
	 * 
	 * Most client programs should use hb_ft_font_create_referenced()
	 * instead.
	 * 
	 * If you know you have valid reasons not to use hb_ft_font_create_referenced(),
	 * then it is the client program's responsibility to destroy #ft_face
	 * after the #hb_font_t font object has been destroyed.
	 * 
	 * HarfBuzz will use the #destroy callback on the #hb_font_t font object
	 * if it is supplied when you use this function. However, even if #destroy
	 * is provided, it is the client program's responsibility to destroy #ft_face,
	 * and it is the client program's responsibility to ensure that #ft_face is
	 * destroyed only after the #hb_font_t font object has been destroyed.
	 * @param ft_face FT_Face to work upon
	 * @param destroy A callback to call when the font object is not needed anymore
	 * @returns the new #hb_font_t font object
	 */
	function ft_font_create(ft_face: any, destroy: destroy_func_t | null): font_t;

	/**
	 * Creates an #hb_font_t font object from the specified FT_Face.
	 * 
	 * <note>Note: You must set the face size on #ft_face before calling
	 * {@link Hb.ft_font_create_referenced} on it. HarfBuzz assumes size is always set
	 * and will access `size` member of FT_Face unconditionally.</note>
	 * 
	 * This is the preferred variant of the hb_ft_font_create*
	 * function family, because it calls FT_Reference_Face() on #ft_face,
	 * ensuring that #ft_face remains alive as long as the resulting
	 * #hb_font_t font object remains alive.
	 * 
	 * Use this version unless you know you have good reasons not to.
	 * @param ft_face FT_Face to work upon
	 * @returns the new #hb_font_t font object
	 */
	function ft_font_create_referenced(ft_face: any): font_t;

	/**
	 * Fetches the FT_Face associated with the specified #hb_font_t
	 * font object.
	 * @param font #hb_font_t to work upon
	 * @returns the FT_Face found or %NULL
	 */
	function ft_font_get_face(font: font_t): any | null;

	/**
	 * Fetches the FT_Load_Glyph load flags of the specified #hb_font_t.
	 * 
	 * For more information, see
	 * https://www.freetype.org/freetype2/docs/reference/ft2-base_interface.html#ft_load_xxx
	 * @param font #hb_font_t to work upon
	 * @returns FT_Load_Glyph flags found
	 */
	function ft_font_get_load_flags(font: font_t): number;

	/**
	 * Gets the FT_Face associated with #font, This face will be kept around until
	 * you call {@link Hb.ft_font_unlock_face}.
	 * @param font #hb_font_t to work upon
	 * @returns the FT_Face associated with #font or %NULL
	 */
	function ft_font_lock_face(font: font_t): any | null;

	/**
	 * Configures the font-functions structure of the specified
	 * #hb_font_t font object to use FreeType font functions.
	 * 
	 * In particular, you can use this function to configure an
	 * existing #hb_face_t face object for use with FreeType font
	 * functions even if that #hb_face_t face object was initially
	 * created with {@link Hb.face_create}, and therefore was not
	 * initially configured to use FreeType font functions.
	 * 
	 * An #hb_face_t face object created with hb_ft_face_create()
	 * is preconfigured for FreeType font functions and does not
	 * require this function to be used.
	 * 
	 * <note>Note: Internally, this function creates an FT_Face.
	 * </note>
	 * @param font #hb_font_t to work upon
	 */
	function ft_font_set_funcs(font: font_t): void;

	/**
	 * Sets the FT_Load_Glyph load flags for the specified #hb_font_t.
	 * 
	 * For more information, see
	 * https://www.freetype.org/freetype2/docs/reference/ft2-base_interface.html#ft_load_xxx
	 * @param font #hb_font_t to work upon
	 * @param load_flags The FreeType load flags to set
	 */
	function ft_font_set_load_flags(font: font_t, load_flags: number): void;

	/**
	 * Releases an FT_Face previously obtained with {@link Hb.ft_font_lock_face}.
	 * @param font #hb_font_t to work upon
	 */
	function ft_font_unlock_face(font: font_t): void;

	/**
	 * Creates an #hb_blob_t blob from the specified
	 * GBytes data structure.
	 * @param gbytes the GBytes structure to work upon
	 * @returns the new #hb_blob_t blob object
	 */
	function glib_blob_create(gbytes: GLib.Bytes): blob_t;

	/**
	 * Fetches a Unicode-functions structure that is populated
	 * with the appropriate GLib function for each method.
	 * @returns a pointer to the #hb_unicode_funcs_t Unicode-functions structure
	 */
	function glib_get_unicode_funcs(): unicode_funcs_t;

	/**
	 * Fetches the GUnicodeScript identifier that corresponds to the
	 * specified #hb_script_t script.
	 * @param script The #hb_script_t to query
	 * @returns the GUnicodeScript identifier found
	 */
	function glib_script_from_script(script: script_t): GLib.UnicodeScript;

	/**
	 * Fetches the #hb_script_t script that corresponds to the
	 * specified GUnicodeScript identifier.
	 * @param script The GUnicodeScript identifier to query
	 * @returns the #hb_script_t script found
	 */
	function glib_script_to_script(script: GLib.UnicodeScript): script_t;

	/**
	 * Returns glyph flags encoded within a #hb_glyph_info_t.
	 * @param info a #hb_glyph_info_t
	 * @returns The #hb_glyph_flags_t encoded within #info
	 */
	function glyph_info_get_glyph_flags(info: glyph_info_t): glyph_flags_t;

	/**
	 * Fetches the Graphite2 gr_face corresponding to the specified
	 * #hb_face_t face object.
	 * @param face #hb_face_t to query
	 * @returns the gr_face found
	 */
	function graphite2_face_get_gr_face(face: face_t): any;

	/**
	 * Always returns %NULL. Use {@link Hb.graphite2_face_get_gr_face} instead.
	 * @param font An #hb_font_t
	 * @returns Graphite2 font associated with #font.
	 */
	function graphite2_font_get_gr_font(font: font_t): any | null;

	/**
	 * Converts #str representing a BCP 47 language tag to the corresponding
	 * #hb_language_t.
	 * @param str a string representing
	 *       a BCP 47 language tag
	 * @param len length of the #str, or -1 if it is %NULL-terminated.
	 * @returns 
	 * The #hb_language_t corresponding to the BCP 47 language tag.
	 */
	function language_from_string(str: number[], len: number): language_t;

	/**
	 * Fetch the default language from current locale.
	 * 
	 * <note>Note that the first time this function is called, it calls
	 * "setlocale (LC_CTYPE, nullptr)" to fetch current locale.  The underlying
	 * setlocale function is, in many implementations, NOT threadsafe.  To avoid
	 * problems, call this function once before multiple threads can call it.
	 * This function is only used from {@link Hb.buffer_guess_segment_properties} by
	 * HarfBuzz itself.</note>
	 * @returns The default language of the locale as
	 * an #hb_language_t
	 */
	function language_get_default(): language_t;

	/**
	 * Converts an #hb_language_t to a string.
	 * @param language The #hb_language_t to convert
	 * @returns 
	 * A %NULL-terminated string representing the #language. Must not be freed by
	 * the caller.
	 */
	function language_to_string(language: language_t): string;

	/**
	 * Tests whether memory allocation for a set was successful.
	 * @param map A map
	 * @returns %true if allocation succeeded, %false otherwise
	 */
	function map_allocation_successful(map: map_t): bool_t;

	/**
	 * Clears out the contents of #map.
	 * @param map A map
	 */
	function map_clear(map: map_t): void;

	/**
	 * Creates a new, initially empty map.
	 * @returns The new #hb_map_t
	 */
	function map_create(): map_t;

	/**
	 * Removes #key and its stored value from #map.
	 * @param map A map
	 * @param key The key to delete
	 */
	function map_del(map: map_t, key: codepoint_t): void;

	/**
	 * Decreases the reference count on a map. When
	 * the reference count reaches zero, the map is
	 * destroyed, freeing all memory.
	 * @param map A map
	 */
	function map_destroy(map: map_t): void;

	/**
	 * Fetches the value stored for #key in #map.
	 * @param map A map
	 * @param key The key to query
	 * @returns 
	 */
	function map_get(map: map_t, key: codepoint_t): codepoint_t;

	/**
	 * Fetches the singleton empty #hb_map_t.
	 * @returns The empty #hb_map_t
	 */
	function map_get_empty(): map_t;

	/**
	 * Returns the number of key-value pairs in the map.
	 * @param map A map
	 * @returns The population of #map
	 */
	function map_get_population(map: map_t): number;

	/**
	 * Fetches the user data associated with the specified key,
	 * attached to the specified map.
	 * @param map A map
	 * @param key The user-data key to query
	 * @returns A pointer to the user data
	 */
	function map_get_user_data(map: map_t, key: user_data_key_t): any | null;

	/**
	 * Tests whether #key is an element of #map.
	 * @param map A map
	 * @param key The key to query
	 * @returns %true if #key is found in #map, %false otherwise
	 */
	function map_has(map: map_t, key: codepoint_t): bool_t;

	/**
	 * Tests whether #map is empty (contains no elements).
	 * @param map A map
	 * @returns %true if #map is empty
	 */
	function map_is_empty(map: map_t): bool_t;

	/**
	 * Increases the reference count on a map.
	 * @param map A map
	 * @returns The map
	 */
	function map_reference(map: map_t): map_t;

	/**
	 * Stores #key:#value in the map.
	 * @param map A map
	 * @param key The key to store in the map
	 * @param value The value to store for #key
	 */
	function map_set(map: map_t, key: codepoint_t, value: codepoint_t): void;

	/**
	 * Attaches a user-data key/data pair to the specified map.
	 * @param map A map
	 * @param key The user-data key to set
	 * @param data A pointer to the user data to set
	 * @param destroy A callback to call when #data is not needed anymore
	 * @param replace Whether to replace an existing data with the same key
	 * @returns %true if success, %false otherwise
	 */
	function map_set_user_data(map: map_t, key: user_data_key_t, data: any | null, destroy: destroy_func_t | null, replace: bool_t): bool_t;

	/**
	 * Fetches a list of all color layers for the specified glyph index in the specified
	 * face. The list returned will begin at the offset provided.
	 * @param face #hb_face_t to work upon
	 * @param glyph The glyph index to query
	 * @param start_offset offset of the first layer to retrieve
	 * @returns Total number of layers available for the glyph index queried
	 * 
	 * Input = the maximum number of layers to return;
	 *         Output = the actual number of layers returned (may be zero)
	 * 
	 * The array of layers found
	 */
	function ot_color_glyph_get_layers(face: face_t, glyph: codepoint_t, start_offset: number): [ number, number | null, ot_color_layer_t[] | null ];

	/**
	 * Fetches the PNG image for a glyph. This function takes a font object, not a face object,
	 * as input. To get an optimally sized PNG blob, the UPEM value must be set on the #font
	 * object. If UPEM is unset, the blob returned will be the largest PNG available.
	 * @param font #hb_font_t to work upon
	 * @param glyph a glyph index
	 * @returns An #hb_blob_t containing the PNG image for the glyph, if available
	 */
	function ot_color_glyph_reference_png(font: font_t, glyph: codepoint_t): blob_t;

	/**
	 * Fetches the SVG document for a glyph. The blob may be either plain text or gzip-encoded.
	 * @param face #hb_face_t to work upon
	 * @param glyph a svg glyph index
	 * @returns An #hb_blob_t containing the SVG document of the glyph, if available
	 */
	function ot_color_glyph_reference_svg(face: face_t, glyph: codepoint_t): blob_t;

	/**
	 * Tests whether a face includes any `COLR` color layers.
	 * @param face #hb_face_t to work upon
	 * @returns %true if data found, %false otherwise
	 */
	function ot_color_has_layers(face: face_t): bool_t;

	/**
	 * Tests whether a face includes a `CPAL` color-palette table.
	 * @param face #hb_face_t to work upon
	 * @returns %true if data found, %false otherwise
	 */
	function ot_color_has_palettes(face: face_t): bool_t;

	/**
	 * Tests whether a face has PNG glyph images (either in `CBDT` or `sbix` tables).
	 * @param face #hb_face_t to work upon
	 * @returns %true if data found, %false otherwise
	 */
	function ot_color_has_png(face: face_t): bool_t;

	/**
	 * Tests whether a face includes any `SVG` glyph images.
	 * @param face #hb_face_t to work upon.
	 * @returns %true if data found, %false otherwise.
	 */
	function ot_color_has_svg(face: face_t): bool_t;

	/**
	 * Fetches the `name` table Name ID that provides display names for
	 * the specificed color in a face's `CPAL` color palette.
	 * 
	 * Display names can be generic (e.g., "Background") or specific
	 * (e.g., "Eye color").
	 * @param face #hb_face_t to work upon
	 * @param color_index The index of the color
	 * @returns the Name ID found for the color.
	 */
	function ot_color_palette_color_get_name_id(face: face_t, color_index: number): ot_name_id_t;

	/**
	 * Fetches a list of the colors in a color palette.
	 * 
	 * After calling this function, #colors will be filled with the palette
	 * colors. If #colors is NULL, the function will just return the number
	 * of total colors without storing any actual colors; this can be used
	 * for allocating a buffer of suitable size before calling
	 * {@link Hb.ot_color_palette_get_colors} a second time.
	 * @param face #hb_face_t to work upon
	 * @param palette_index the index of the color palette to query
	 * @param start_offset offset of the first color to retrieve
	 * @returns the total number of colors in the palette
	 * 
	 * Input = the maximum number of colors to return;
	 *               Output = the actual number of colors returned (may be zero)
	 * 
	 * The array of #hb_color_t records found
	 */
	function ot_color_palette_get_colors(face: face_t, palette_index: number, start_offset: number): [ number, number | null, color_t[] | null ];

	/**
	 * Fetches the number of color palettes in a face.
	 * @param face #hb_face_t to work upon
	 * @returns the number of palettes found
	 */
	function ot_color_palette_get_count(face: face_t): number;

	/**
	 * Fetches the flags defined for a color palette.
	 * @param face #hb_face_t to work upon
	 * @param palette_index The index of the color palette
	 * @returns the #hb_ot_color_palette_flags_t of the requested color palette
	 */
	function ot_color_palette_get_flags(face: face_t, palette_index: number): ot_color_palette_flags_t;

	/**
	 * Fetches the `name` table Name ID that provides display names for
	 * a `CPAL` color palette.
	 * 
	 * Palette display names can be generic (e.g., "Default") or provide
	 * specific, themed names (e.g., "Spring", "Summer", "Fall", and "Winter").
	 * @param face #hb_face_t to work upon
	 * @param palette_index The index of the color palette
	 * @returns the Named ID found for the palette.
	 * If the requested palette has no name the result is #HB_OT_NAME_ID_INVALID.
	 */
	function ot_color_palette_get_name_id(face: face_t, palette_index: number): ot_name_id_t;

	/**
	 * Sets the font functions to use when working with #font.
	 * @param font #hb_font_t to work upon
	 */
	function ot_font_set_funcs(font: font_t): void;

	/**
	 * Fetches a list of all feature indexes in the specified face's GSUB table
	 * or GPOS table, underneath the specified scripts, languages, and features.
	 * If no list of scripts is provided, all scripts will be queried. If no list
	 * of languages is provided, all languages will be queried. If no list of
	 * features is provided, all features will be queried.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param scripts The array of scripts to collect features for
	 * @param languages The array of languages to collect features for
	 * @param features The array of features to collect
	 * @returns The array of feature indexes found for the query
	 */
	function ot_layout_collect_features(face: face_t, table_tag: tag_t, scripts: tag_t, languages: tag_t, features: tag_t): set_t;

	/**
	 * Fetches a list of all feature-lookup indexes in the specified face's GSUB
	 * table or GPOS table, underneath the specified scripts, languages, and
	 * features. If no list of scripts is provided, all scripts will be queried.
	 * If no list of languages is provided, all languages will be queried. If no
	 * list of features is provided, all features will be queried.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param scripts The array of scripts to collect lookups for
	 * @param languages The array of languages to collect lookups for
	 * @param features The array of features to collect lookups for
	 * @returns The array of lookup indexes found for the query
	 */
	function ot_layout_collect_lookups(face: face_t, table_tag: tag_t, scripts: tag_t, languages: tag_t, features: tag_t): set_t;

	/**
	 * Fetches a list of the characters defined as having a variant under the specified
	 * "Character Variant" ("cvXX") feature tag.
	 * @param face #hb_face_t to work upon
	 * @param table_tag table tag to query, "GSUB" or "GPOS".
	 * @param feature_index index of feature to query.
	 * @param start_offset offset of the first character to retrieve
	 * @returns Number of total sample characters in the cvXX feature.
	 * 
	 * Input = the maximum number of characters to return;
	 *              Output = the actual number of characters returned (may be zero)
	 * 
	 * A buffer pointer.
	 *              The Unicode codepoints of the characters for which this feature provides
	 *               glyph variants.
	 */
	function ot_layout_feature_get_characters(face: face_t, table_tag: tag_t, feature_index: number, start_offset: number): [ number, number | null, codepoint_t[] ];

	/**
	 * Fetches a list of all lookups enumerated for the specified feature, in
	 * the specified face's GSUB table or GPOS table. The list returned will
	 * begin at the offset provided.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param feature_index The index of the requested feature
	 * @param start_offset offset of the first lookup to retrieve
	 * @returns Total number of lookups.
	 * 
	 * Input = the maximum number of lookups to return;
	 *                Output = the actual number of lookups returned (may be zero)
	 * 
	 * The array of lookup indexes found for the query
	 */
	function ot_layout_feature_get_lookups(face: face_t, table_tag: tag_t, feature_index: number, start_offset: number): [ number, number | null, number[] ];

	/**
	 * Fetches name indices from feature parameters for "Stylistic Set" ('ssXX') or
	 * "Character Variant" ('cvXX') features.
	 * @param face #hb_face_t to work upon
	 * @param table_tag table tag to query, "GSUB" or "GPOS".
	 * @param feature_index index of feature to query.
	 * @returns %true if data found, %false otherwise
	 * 
	 * The ‘name’ table name ID that specifies a string
	 *            for a user-interface label for this feature. (May be NULL.)
	 * 
	 * The ‘name’ table name ID that specifies a string
	 *              that an application can use for tooltip text for this
	 *              feature. (May be NULL.)
	 * 
	 * The ‘name’ table name ID that specifies sample text
	 *             that illustrates the effect of this feature. (May be NULL.)
	 * 
	 * Number of named parameters. (May be zero.)
	 * 
	 * The first ‘name’ table name ID used to specify
	 *                  strings for user-interface labels for the feature
	 *                  parameters. (Must be zero if numParameters is zero.)
	 */
	function ot_layout_feature_get_name_ids(face: face_t, table_tag: tag_t, feature_index: number): [ bool_t, ot_name_id_t | null, ot_name_id_t | null, ot_name_id_t | null, number | null, ot_name_id_t | null ];

	/**
	 * Fetches a list of all lookups enumerated for the specified feature, in
	 * the specified face's GSUB table or GPOS table, enabled at the specified
	 * variations index. The list returned will begin at the offset provided.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param feature_index The index of the feature to query
	 * @param variations_index The index of the feature variation to query
	 * @param start_offset offset of the first lookup to retrieve
	 * @returns Total number of lookups.
	 * 
	 * Input = the maximum number of lookups to return;
	 *                Output = the actual number of lookups returned (may be zero)
	 * 
	 * The array of lookups found for the query
	 */
	function ot_layout_feature_with_variations_get_lookups(face: face_t, table_tag: tag_t, feature_index: number, variations_index: number, start_offset: number): [ number, number | null, number[] ];

	/**
	 * Fetches a list of all attachment points for the specified glyph in the GDEF
	 * table of the face. The list returned will begin at the offset provided.
	 * 
	 * Useful if the client program wishes to cache the list.
	 * @param face The #hb_face_t to work on
	 * @param glyph The #hb_codepoint_t code point to query
	 * @param start_offset offset of the first attachment point to retrieve
	 * @returns Total number of attachment points for #glyph.
	 * 
	 * Input = the maximum number of attachment points to return;
	 *               Output = the actual number of attachment points returned (may be zero)
	 * 
	 * The array of attachment points found for the query
	 */
	function ot_layout_get_attach_points(face: face_t, glyph: codepoint_t, start_offset: number): [ number, number | null, number[] ];

	/**
	 * Fetches a baseline value from the face.
	 * @param font a font
	 * @param baseline_tag a baseline tag
	 * @param direction text direction.
	 * @param script_tag script tag.
	 * @param language_tag language tag, currently unused.
	 * @returns %true if found baseline value in the font.
	 * 
	 * baseline value if found.
	 */
	function ot_layout_get_baseline(font: font_t, baseline_tag: ot_layout_baseline_tag_t, direction: direction_t, script_tag: tag_t, language_tag: tag_t): [ bool_t, position_t ];

	/**
	 * Fetches the GDEF class of the requested glyph in the specified face.
	 * @param face The #hb_face_t to work on
	 * @param glyph The #hb_codepoint_t code point to query
	 * @returns The #hb_ot_layout_glyph_class_t glyph class of the given code
	 * point in the GDEF table of the face.
	 */
	function ot_layout_get_glyph_class(face: face_t, glyph: codepoint_t): ot_layout_glyph_class_t;

	/**
	 * Retrieves the set of all glyphs from the face that belong to the requested
	 * glyph class in the face's GDEF table.
	 * @param face The #hb_face_t to work on
	 * @param klass The #hb_ot_layout_glyph_class_t GDEF class to retrieve
	 * @returns The #hb_set_t set of all glyphs belonging to the requested
	 *          class.
	 */
	function ot_layout_get_glyphs_in_class(face: face_t, klass: ot_layout_glyph_class_t): set_t;

	/**
	 * Fetches a list of the caret positions defined for a ligature glyph in the GDEF
	 * table of the font. The list returned will begin at the offset provided.
	 * @param font The #hb_font_t to work on
	 * @param direction The #hb_direction_t text direction to use
	 * @param glyph The #hb_codepoint_t code point to query
	 * @param start_offset offset of the first caret position to retrieve
	 * @returns Total number of ligature caret positions for #glyph.
	 * 
	 * Input = the maximum number of caret positions to return;
	 *               Output = the actual number of caret positions returned (may be zero)
	 * 
	 * The array of caret positions found for the query
	 */
	function ot_layout_get_ligature_carets(font: font_t, direction: direction_t, glyph: codepoint_t, start_offset: number): [ number, number | null, position_t[] ];

	/**
	 * Fetches optical-size feature data (i.e., the `size` feature from GPOS). Note that
	 * the subfamily_id and the subfamily name string (accessible via the subfamily_name_id)
	 * as used here are defined as pertaining only to fonts within a font family that differ
	 * specifically in their respective size ranges; other ways to differentiate fonts within
	 * a subfamily are not covered by the `size` feature.
	 * 
	 * For more information on this distinction, see the [`size` feature documentation](
	 * https://docs.microsoft.com/en-us/typography/opentype/spec/features_pt#tag-size).
	 * @param face #hb_face_t to work upon
	 * @returns %true if data found, %false otherwise
	 * 
	 * The design size of the face
	 * 
	 * The identifier of the face within the font subfamily
	 * 
	 * The ‘name’ table name ID of the face within the font subfamily
	 * 
	 * The minimum size of the recommended size range for the face
	 * 
	 * The maximum size of the recommended size range for the face
	 */
	function ot_layout_get_size_params(face: face_t): [ bool_t, number, number, ot_name_id_t, number, number ];

	/**
	 * Tests whether a face has any glyph classes defined in its GDEF table.
	 * @param face #hb_face_t to work upon
	 * @returns %true if data found, %false otherwise
	 */
	function ot_layout_has_glyph_classes(face: face_t): bool_t;

	/**
	 * Tests whether the specified face includes any GPOS positioning.
	 * @param face #hb_face_t to work upon
	 * @returns %true if the face has GPOS data, %false otherwise
	 */
	function ot_layout_has_positioning(face: face_t): bool_t;

	/**
	 * Tests whether the specified face includes any GSUB substitutions.
	 * @param face #hb_face_t to work upon
	 * @returns %true if data found, %false otherwise
	 */
	function ot_layout_has_substitution(face: face_t): bool_t;

	/**
	 * Fetches the index of a given feature tag in the specified face's GSUB table
	 * or GPOS table, underneath the specified script and language.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_index The index of the requested script tag
	 * @param language_index The index of the requested language tag
	 * @param feature_tag #hb_tag_t of the feature tag requested
	 * @returns %true if the feature is found, %false otherwise
	 * 
	 * The index of the requested feature
	 */
	function ot_layout_language_find_feature(face: face_t, table_tag: tag_t, script_index: number, language_index: number, feature_tag: tag_t): [ bool_t, number ];

	/**
	 * Fetches a list of all features in the specified face's GSUB table
	 * or GPOS table, underneath the specified script and language. The list
	 * returned will begin at the offset provided.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_index The index of the requested script tag
	 * @param language_index The index of the requested language tag
	 * @param start_offset offset of the first feature tag to retrieve
	 * @returns Total number of features.
	 * 
	 * Input = the maximum number of feature tags to return;
	 *                 Output: the actual number of feature tags returned (may be zero)
	 * 
	 * The array of feature indexes found for the query
	 */
	function ot_layout_language_get_feature_indexes(face: face_t, table_tag: tag_t, script_index: number, language_index: number, start_offset: number): [ number, number | null, number[] ];

	/**
	 * Fetches a list of all features in the specified face's GSUB table
	 * or GPOS table, underneath the specified script and language. The list
	 * returned will begin at the offset provided.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_index The index of the requested script tag
	 * @param language_index The index of the requested language tag
	 * @param start_offset offset of the first feature tag to retrieve
	 * @returns Total number of feature tags.
	 * 
	 * Input = the maximum number of feature tags to return;
	 *                 Output = the actual number of feature tags returned (may be zero)
	 * 
	 * The array of #hb_tag_t feature tags found for the query
	 */
	function ot_layout_language_get_feature_tags(face: face_t, table_tag: tag_t, script_index: number, language_index: number, start_offset: number): [ number, number | null, tag_t[] ];

	/**
	 * Fetches the tag of a requested feature index in the given face's GSUB or GPOS table,
	 * underneath the specified script and language.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_index The index of the requested script tag
	 * @param language_index The index of the requested language tag
	 * @returns %true if the feature is found, %false otherwise
	 * 
	 * The index of the requested feature
	 * 
	 * The #hb_tag_t of the requested feature
	 */
	function ot_layout_language_get_required_feature(face: face_t, table_tag: tag_t, script_index: number, language_index: number): [ bool_t, number, tag_t ];

	/**
	 * Fetches the index of a requested feature in the given face's GSUB or GPOS table,
	 * underneath the specified script and language.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_index The index of the requested script tag
	 * @param language_index The index of the requested language tag
	 * @returns %true if the feature is found, %false otherwise
	 * 
	 * The index of the requested feature
	 */
	function ot_layout_language_get_required_feature_index(face: face_t, table_tag: tag_t, script_index: number, language_index: number): [ bool_t, number ];

	/**
	 * Fetches a list of all glyphs affected by the specified lookup in the
	 * specified face's GSUB table or GPOS table.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param lookup_index The index of the feature lookup to query
	 * @returns Array of glyphs preceding the substitution range
	 * 
	 * Array of input glyphs that would be substituted by the lookup
	 * 
	 * Array of glyphs following the substitution range
	 * 
	 * Array of glyphs that would be the substituted output of the lookup
	 */
	function ot_layout_lookup_collect_glyphs(face: face_t, table_tag: tag_t, lookup_index: number): [ glyphs_before: set_t, glyphs_input: set_t, glyphs_after: set_t, glyphs_output: set_t ];

	/**
	 * Fetches alternates of a glyph from a given GSUB lookup index.
	 * @param face a face.
	 * @param lookup_index index of the feature lookup to query.
	 * @param glyph a glyph id.
	 * @param start_offset starting offset.
	 * @returns Total number of alternates found in the specific lookup index for the given glyph id.
	 * 
	 * Input = the maximum number of alternate glyphs to return;
	 *                   Output = the actual number of alternate glyphs returned (may be zero).
	 * 
	 * A glyphs buffer.
	 *                    Alternate glyphs associated with the glyph id.
	 */
	function ot_layout_lookup_get_glyph_alternates(face: face_t, lookup_index: number, glyph: codepoint_t, start_offset: number): [ number, number | null, codepoint_t[] ];

	/**
	 * Compute the transitive closure of glyphs needed for a
	 * specified lookup.
	 * @param face #hb_face_t to work upon
	 * @param lookup_index index of the feature lookup to query
	 * @returns Array of glyphs comprising the transitive closure of the lookup
	 */
	function ot_layout_lookup_substitute_closure(face: face_t, lookup_index: number): set_t;

	/**
	 * Tests whether a specified lookup in the specified face would
	 * trigger a substitution on the given glyph sequence.
	 * @param face #hb_face_t to work upon
	 * @param lookup_index The index of the lookup to query
	 * @param glyphs The sequence of glyphs to query for substitution
	 * @param glyphs_length The length of the glyph sequence
	 * @param zero_context #hb_bool_t indicating whether pre-/post-context are disallowed
	 * in substitutions
	 * @returns %true if a substitution would be triggered, %false otherwise
	 */
	function ot_layout_lookup_would_substitute(face: face_t, lookup_index: number, glyphs: codepoint_t, glyphs_length: number, zero_context: bool_t): bool_t;

	/**
	 * Compute the transitive closure of glyphs needed for all of the
	 * provided lookups.
	 * @param face #hb_face_t to work upon
	 * @param lookups The set of lookups to query
	 * @returns Array of glyphs comprising the transitive closure of the lookups
	 */
	function ot_layout_lookups_substitute_closure(face: face_t, lookups: set_t): set_t;

	/**
	 * Fetches the index of a given language tag in the specified face's GSUB table
	 * or GPOS table, underneath the specified script tag.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_index The index of the requested script tag
	 * @param language_tag The #hb_tag_t of the requested language
	 * @param language_index The index of the requested language
	 * @returns %true if the language tag is found, %false otherwise
	 */
	function ot_layout_script_find_language(face: face_t, table_tag: tag_t, script_index: number, language_tag: tag_t, language_index: number): bool_t;

	/**
	 * Fetches a list of language tags in the given face's GSUB or GPOS table, underneath
	 * the specified script index. The list returned will begin at the offset provided.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_index The index of the requested script tag
	 * @param start_offset offset of the first language tag to retrieve
	 * @returns Total number of language tags.
	 * 
	 * Input = the maximum number of language tags to return;
	 *                  Output = the actual number of language tags returned (may be zero)
	 * 
	 * Array of language tags found in the table
	 */
	function ot_layout_script_get_language_tags(face: face_t, table_tag: tag_t, script_index: number, start_offset: number): [ number, number | null, tag_t[] ];

	/**
	 * Fetches the index of a given language tag in the specified face's GSUB table
	 * or GPOS table, underneath the specified script index.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_index The index of the requested script tag
	 * @param language_count The number of languages in the specified script
	 * @param language_tags The array of language tags
	 * @returns %true if the language tag is found, %false otherwise
	 * 
	 * The index of the requested language
	 */
	function ot_layout_script_select_language(face: face_t, table_tag: tag_t, script_index: number, language_count: number, language_tags: tag_t): [ bool_t, number ];

	/**
	 * Deprecated since 2.0.0
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_tags Array of #hb_tag_t script tags
	 * @returns 
	 * 
	 * The index of the requested script tag
	 * 
	 * #hb_tag_t of the script tag requested
	 */
	function ot_layout_table_choose_script(face: face_t, table_tag: tag_t, script_tags: tag_t): [ bool_t, number, tag_t ];

	/**
	 * Fetches a list of feature variations in the specified face's GSUB table
	 * or GPOS table, at the specified variation coordinates.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param coords The variation coordinates to query
	 * @param num_coords The number of variation coordinates
	 * @returns %true if feature variations were found, %false otherwise.
	 * 
	 * The array of feature variations found for the query
	 */
	function ot_layout_table_find_feature_variations(face: face_t, table_tag: tag_t, coords: number, num_coords: number): [ bool_t, number ];

	/**
	 * Fetches the index if a given script tag in the specified face's GSUB table
	 * or GPOS table.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_tag #hb_tag_t of the script tag requested
	 * @returns %true if the script is found, %false otherwise
	 * 
	 * The index of the requested script tag
	 */
	function ot_layout_table_find_script(face: face_t, table_tag: tag_t, script_tag: tag_t): [ bool_t, number ];

	/**
	 * Fetches a list of all feature tags in the given face's GSUB or GPOS table.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param start_offset offset of the first feature tag to retrieve
	 * @returns Total number of feature tags.
	 * 
	 * Input = the maximum number of feature tags to return;
	 *                 Output = the actual number of feature tags returned (may be zero)
	 * 
	 * Array of feature tags found in the table
	 */
	function ot_layout_table_get_feature_tags(face: face_t, table_tag: tag_t, start_offset: number): [ number, number | null, tag_t[] ];

	/**
	 * Fetches the total number of lookups enumerated in the specified
	 * face's GSUB table or GPOS table.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @returns Total number of lookups.
	 */
	function ot_layout_table_get_lookup_count(face: face_t, table_tag: tag_t): number;

	/**
	 * Fetches a list of all scripts enumerated in the specified face's GSUB table
	 * or GPOS table. The list returned will begin at the offset provided.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param start_offset offset of the first script tag to retrieve
	 * @returns Total number of script tags.
	 * 
	 * Input = the maximum number of script tags to return;
	 *                Output = the actual number of script tags returned (may be zero)
	 * 
	 * The array of #hb_tag_t script tags found for the query
	 */
	function ot_layout_table_get_script_tags(face: face_t, table_tag: tag_t, start_offset: number): [ number, number | null, tag_t[] ];

	/**
	 * Selects an OpenType script for #table_tag from the #script_tags array.
	 * 
	 * If the table does not have any of the requested scripts, then `DFLT`,
	 * `dflt`, and `latn` tags are tried in that order. If the table still does not
	 * have any of these scripts, #script_index and #chosen_script are set to
	 * #HB_OT_LAYOUT_NO_SCRIPT_INDEX.
	 * @param face #hb_face_t to work upon
	 * @param table_tag #HB_OT_TAG_GSUB or #HB_OT_TAG_GPOS
	 * @param script_count Number of script tags in the array
	 * @param script_tags Array of #hb_tag_t script tags
	 * @returns %true if one of the requested scripts is selected, %false if a fallback
	 * script is selected or if no scripts are selected.
	 * 
	 * The index of the requested script
	 * 
	 * #hb_tag_t of the requested script
	 */
	function ot_layout_table_select_script(face: face_t, table_tag: tag_t, script_count: number, script_tags: tag_t): [ bool_t, number | null, tag_t | null ];

	/**
	 * Fetches the specified math constant. For most constants, the value returned
	 * is an #hb_position_t.
	 * 
	 * However, if the requested constant is #HB_OT_MATH_CONSTANT_SCRIPT_PERCENT_SCALE_DOWN,
	 * #HB_OT_MATH_CONSTANT_SCRIPT_SCRIPT_PERCENT_SCALE_DOWN or
	 * #HB_OT_MATH_CONSTANT_SCRIPT_PERCENT_SCALE_DOWN, then the return value is
	 * an integer between 0 and 100 representing that percentage.
	 * @param font #hb_font_t to work upon
	 * @param constant #hb_ot_math_constant_t the constant to retrieve
	 * @returns the requested constant or zero
	 */
	function ot_math_get_constant(font: font_t, constant: ot_math_constant_t): position_t;

	/**
	 * Fetches the GlyphAssembly for the specified font, glyph index, and direction.
	 * Returned are a list of #hb_ot_math_glyph_part_t glyph parts that can be
	 * used to draw the glyph and an italics-correction value (if one is defined
	 * in the font).
	 * 
	 * <note>The #direction parameter is only used to select between horizontal
	 * or vertical directions for the construction. Even though all #hb_direction_t
	 * values are accepted, only the result of #HB_DIRECTION_IS_HORIZONTAL is
	 * considered.</note>
	 * @param font #hb_font_t to work upon
	 * @param glyph The index of the glyph to stretch
	 * @param direction direction of the stretching (horizontal or vertical)
	 * @param start_offset offset of the first glyph part to retrieve
	 * @returns the total number of parts in the glyph assembly
	 * 
	 * Input = maximum number of glyph parts to return;
	 *               Output = actual number of parts returned
	 * 
	 * the glyph parts returned
	 * 
	 * italics correction of the glyph assembly
	 */
	function ot_math_get_glyph_assembly(font: font_t, glyph: codepoint_t, direction: direction_t, start_offset: number): [ number, number, ot_math_glyph_part_t[], position_t ];

	/**
	 * Fetches an italics-correction value (if one exists) for the specified
	 * glyph index.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph index from which to retrieve the value
	 * @returns the italics correction of the glyph or zero
	 */
	function ot_math_get_glyph_italics_correction(font: font_t, glyph: codepoint_t): position_t;

	/**
	 * Fetches the math kerning (cut-ins) value for the specified font, glyph index, and
	 * #kern.
	 * 
	 * If the MathKern table is found, the function examines it to find a height
	 * value that is greater or equal to #correction_height. If such a height
	 * value is found, corresponding kerning value from the table is returned. If
	 * no such height value is found, the last kerning value is returned.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph index from which to retrieve the value
	 * @param kern The #hb_ot_math_kern_t from which to retrieve the value
	 * @param correction_height the correction height to use to determine the kerning.
	 * @returns requested kerning value or zero
	 */
	function ot_math_get_glyph_kerning(font: font_t, glyph: codepoint_t, kern: ot_math_kern_t, correction_height: position_t): position_t;

	/**
	 * Fetches a top-accent-attachment value (if one exists) for the specified
	 * glyph index.
	 * 
	 * For any glyph that does not have a top-accent-attachment value - that is,
	 * a glyph not covered by the `MathTopAccentAttachment` table (or, when
	 * #font has no `MathTopAccentAttachment` table or no `MATH` table, any
	 * glyph) - the function synthesizes a value, returning the position at
	 * one-half the glyph's advance width.
	 * @param font #hb_font_t to work upon
	 * @param glyph The glyph index from which to retrieve the value
	 * @returns the top accent attachment of the glyph or 0.5 * the advance
	 *               width of #glyph
	 */
	function ot_math_get_glyph_top_accent_attachment(font: font_t, glyph: codepoint_t): position_t;

	/**
	 * Fetches the MathGlyphConstruction for the specified font, glyph index, and
	 * direction. The corresponding list of size variants is returned as a list of
	 * #hb_ot_math_glyph_variant_t structs.
	 * 
	 * <note>The #direction parameter is only used to select between horizontal
	 * or vertical directions for the construction. Even though all #hb_direction_t
	 * values are accepted, only the result of #HB_DIRECTION_IS_HORIZONTAL is
	 * considered.</note>
	 * @param font #hb_font_t to work upon
	 * @param glyph The index of the glyph to stretch
	 * @param direction The direction of the stretching (horizontal or vertical)
	 * @param start_offset offset of the first variant to retrieve
	 * @returns the total number of size variants available or zero
	 * 
	 * Input = the maximum number of variants to return;
	 *                           Output = the actual number of variants returned
	 * 
	 * array of variants returned
	 */
	function ot_math_get_glyph_variants(font: font_t, glyph: codepoint_t, direction: direction_t, start_offset: number): [ number, number, ot_math_glyph_variant_t[] ];

	/**
	 * Fetches the MathVariants table for the specified font and returns the
	 * minimum overlap of connecting glyphs that are required to draw a glyph
	 * assembly in the specified direction.
	 * 
	 * <note>The #direction parameter is only used to select between horizontal
	 * or vertical directions for the construction. Even though all #hb_direction_t
	 * values are accepted, only the result of #HB_DIRECTION_IS_HORIZONTAL is
	 * considered.</note>
	 * @param font #hb_font_t to work upon
	 * @param direction direction of the stretching (horizontal or vertical)
	 * @returns requested minimum connector overlap or zero
	 */
	function ot_math_get_min_connector_overlap(font: font_t, direction: direction_t): position_t;

	/**
	 * Tests whether a face has a `MATH` table.
	 * @param face #hb_face_t to test
	 * @returns %true if the table is found, %false otherwise
	 */
	function ot_math_has_data(face: face_t): bool_t;

	/**
	 * Tests whether the given glyph index is an extended shape in the face.
	 * @param face #hb_face_t to work upon
	 * @param glyph The glyph index to test
	 * @returns %true if the glyph is an extended shape, %false otherwise
	 */
	function ot_math_is_glyph_extended_shape(face: face_t, glyph: codepoint_t): bool_t;

	/**
	 * Fetches all available feature types.
	 * @param face a face object
	 * @param start_offset iteration's start offset
	 * @returns Number of all available feature types.
	 * 
	 * buffer size as input, filled size as output
	 * 
	 * entries tags buffer
	 */
	function ot_meta_get_entry_tags(face: face_t, start_offset: number): [ number, number | null, ot_meta_tag_t[] ];

	/**
	 * It fetches metadata entry of a given tag from a font.
	 * @param face a #hb_face_t object.
	 * @param meta_tag tag of metadata you like to have.
	 * @returns A blob containing the blob.
	 */
	function ot_meta_reference_entry(face: face_t, meta_tag: ot_meta_tag_t): blob_t;

	/**
	 * Fetches metrics value corresponding to #metrics_tag from #font.
	 * @param font an #hb_font_t object.
	 * @param metrics_tag tag of metrics value you like to fetch.
	 * @returns Whether found the requested metrics in the font.
	 * 
	 * result of metrics value from the font.
	 */
	function ot_metrics_get_position(font: font_t, metrics_tag: ot_metrics_tag_t): [ bool_t, position_t | null ];

	/**
	 * Fetches metrics value corresponding to #metrics_tag from #font with the
	 * current font variation settings applied.
	 * @param font an #hb_font_t object.
	 * @param metrics_tag tag of metrics value you like to fetch.
	 * @returns The requested metric value.
	 */
	function ot_metrics_get_variation(font: font_t, metrics_tag: ot_metrics_tag_t): number;

	/**
	 * Fetches horizontal metrics value corresponding to #metrics_tag from #font
	 * with the current font variation settings applied.
	 * @param font an #hb_font_t object.
	 * @param metrics_tag tag of metrics value you like to fetch.
	 * @returns The requested metric value.
	 */
	function ot_metrics_get_x_variation(font: font_t, metrics_tag: ot_metrics_tag_t): position_t;

	/**
	 * Fetches vertical metrics value corresponding to #metrics_tag from #font with
	 * the current font variation settings applied.
	 * @param font an #hb_font_t object.
	 * @param metrics_tag tag of metrics value you like to fetch.
	 * @returns The requested metric value.
	 */
	function ot_metrics_get_y_variation(font: font_t, metrics_tag: ot_metrics_tag_t): position_t;

	/**
	 * Fetches a font name from the OpenType 'name' table.
	 * If #language is #HB_LANGUAGE_INVALID, English ("en") is assumed.
	 * Returns string in UTF-16 encoding. A NUL terminator is always written
	 * for convenience, and isn't included in the output #text_size.
	 * @param face font face.
	 * @param name_id OpenType name identifier to fetch.
	 * @param language language to fetch the name for.
	 * @returns full length of the requested string, or 0 if not found.
	 * 
	 * input size of #text buffer, and output size of
	 *                                   text written to buffer.
	 * 
	 * buffer to write fetched name into.
	 */
	function ot_name_get_utf16(face: face_t, name_id: ot_name_id_t, language: language_t): [ number, number | null, number[] ];

	/**
	 * Fetches a font name from the OpenType 'name' table.
	 * If #language is #HB_LANGUAGE_INVALID, English ("en") is assumed.
	 * Returns string in UTF-32 encoding. A NUL terminator is always written
	 * for convenience, and isn't included in the output #text_size.
	 * @param face font face.
	 * @param name_id OpenType name identifier to fetch.
	 * @param language language to fetch the name for.
	 * @returns full length of the requested string, or 0 if not found.
	 * 
	 * input size of #text buffer, and output size of
	 *                                   text written to buffer.
	 * 
	 * buffer to write fetched name into.
	 */
	function ot_name_get_utf32(face: face_t, name_id: ot_name_id_t, language: language_t): [ number, number | null, number[] ];

	/**
	 * Fetches a font name from the OpenType 'name' table.
	 * If #language is #HB_LANGUAGE_INVALID, English ("en") is assumed.
	 * Returns string in UTF-8 encoding. A NUL terminator is always written
	 * for convenience, and isn't included in the output #text_size.
	 * @param face font face.
	 * @param name_id OpenType name identifier to fetch.
	 * @param language language to fetch the name for.
	 * @returns full length of the requested string, or 0 if not found.
	 * 
	 * input size of #text buffer, and output size of
	 *                                   text written to buffer.
	 * 
	 * buffer to write fetched name into.
	 */
	function ot_name_get_utf8(face: face_t, name_id: ot_name_id_t, language: language_t): [ number, number | null, string[] ];

	/**
	 * Enumerates all available name IDs and language combinations. Returned
	 * array is owned by the #face and should not be modified.  It can be
	 * used as long as #face is alive.
	 * @param face font face.
	 * @returns Array of available name entries.
	 * 
	 * number of returned entries.
	 */
	function ot_name_list_names(face: face_t): [ ot_name_entry_t[], number | null ];

	/**
	 * Computes the transitive closure of glyphs needed for a specified
	 * input buffer under the given font and feature list. The closure is
	 * computed as a set, not as a list.
	 * @param font #hb_font_t to work upon
	 * @param buffer The input buffer to compute from
	 * @param features The features enabled on the buffer
	 * @param num_features The number of features enabled on the buffer
	 * @returns The #hb_set_t set of glyphs comprising the transitive closure of the query
	 */
	function ot_shape_glyphs_closure(font: font_t, buffer: buffer_t, features: feature_t[], num_features: number): set_t;

	/**
	 * Computes the complete set of GSUB or GPOS lookups that are applicable
	 * under a given #shape_plan.
	 * @param shape_plan #hb_shape_plan_t to query
	 * @param table_tag GSUB or GPOS
	 * @returns The #hb_set_t set of lookups returned
	 */
	function ot_shape_plan_collect_lookups(shape_plan: shape_plan_t, table_tag: tag_t): set_t;

	function ot_tag_from_language(language: language_t): tag_t;

	/**
	 * Converts a language tag to an #hb_language_t.
	 * @param tag an language tag
	 * @returns 
	 * The #hb_language_t corresponding to #tag.
	 */
	function ot_tag_to_language(tag: tag_t): language_t | null;

	/**
	 * Converts a script tag to an #hb_script_t.
	 * @param tag a script tag
	 * @returns The #hb_script_t corresponding to #tag.
	 */
	function ot_tag_to_script(tag: tag_t): script_t;

	function ot_tags_from_script(script: script_t, script_tag_1: tag_t, script_tag_2: tag_t): void;

	/**
	 * Converts an #hb_script_t and an #hb_language_t to script and language tags.
	 * @param script an #hb_script_t to convert.
	 * @param language an #hb_language_t to convert.
	 * @returns array of size at least #script_count to store the
	 * script tag results
	 * 
	 * array of size at least #language_count to store
	 * the language tag results
	 */
	function ot_tags_from_script_and_language(script: script_t, language: language_t): [ script_tags: tag_t | null, language_tags: tag_t | null ];

	/**
	 * Converts a script tag and a language tag to an #hb_script_t and an
	 * #hb_language_t.
	 * @param script_tag a script tag
	 * @param language_tag a language tag
	 * @returns the #hb_script_t corresponding to #script_tag.
	 * 
	 * the #hb_language_t corresponding to #script_tag and
	 * #language_tag.
	 */
	function ot_tags_to_script_and_language(script_tag: tag_t, language_tag: tag_t): [ script: script_t | null, language: language_t | null ];

	/**
	 * Fetches the variation-axis information corresponding to the specified axis tag
	 * in the specified face.
	 * @param face #hb_face_t to work upon
	 * @param axis_tag The #hb_tag_t of the variation axis to query
	 * @param axis_index The index of the variation axis
	 * @returns 
	 * 
	 * The #hb_ot_var_axis_info_t of the axis tag queried
	 */
	function ot_var_find_axis(face: face_t, axis_tag: tag_t, axis_index: number): [ bool_t, ot_var_axis_t ];

	/**
	 * Fetches the variation-axis information corresponding to the specified axis tag
	 * in the specified face.
	 * @param face #hb_face_t to work upon
	 * @param axis_tag The #hb_tag_t of the variation axis to query
	 * @returns %true if data found, %false otherwise
	 * 
	 * The #hb_ot_var_axis_info_t of the axis tag queried
	 */
	function ot_var_find_axis_info(face: face_t, axis_tag: tag_t): [ bool_t, ot_var_axis_info_t ];

	/**
	 * Fetches a list of all variation axes in the specified face. The list returned will begin
	 * at the offset provided.
	 * @param face #hb_face_t to work upon
	 * @param start_offset offset of the first lookup to retrieve
	 * @returns 
	 * 
	 * Input = the maximum number of variation axes to return;
	 *                Output = the actual number of variation axes returned (may be zero)
	 * 
	 * The array of variation axes found
	 */
	function ot_var_get_axes(face: face_t, start_offset: number): [ number, number | null, ot_var_axis_t[] ];

	/**
	 * Fetches the number of OpenType variation axes included in the face.
	 * @param face The #hb_face_t to work on
	 * @returns the number of variation axes defined
	 */
	function ot_var_get_axis_count(face: face_t): number;

	/**
	 * Fetches a list of all variation axes in the specified face. The list returned will begin
	 * at the offset provided.
	 * @param face #hb_face_t to work upon
	 * @param start_offset offset of the first lookup to retrieve
	 * @returns the number of variation axes in the face
	 * 
	 * Input = the maximum number of variation axes to return;
	 *                Output = the actual number of variation axes returned (may be zero)
	 * 
	 * The array of variation axes found
	 */
	function ot_var_get_axis_infos(face: face_t, start_offset: number): [ number, number | null, ot_var_axis_info_t[] ];

	/**
	 * Fetches the number of named instances included in the face.
	 * @param face The #hb_face_t to work on
	 * @returns the number of named instances defined
	 */
	function ot_var_get_named_instance_count(face: face_t): number;

	/**
	 * Tests whether a face includes any OpenType variation data in the `fvar` table.
	 * @param face The #hb_face_t to work on
	 * @returns %true if data found, %false otherwise
	 */
	function ot_var_has_data(face: face_t): bool_t;

	/**
	 * Fetches the design-space coordinates corresponding to the given
	 * named instance in the face.
	 * @param face The #hb_face_t to work on
	 * @param instance_index The index of the named instance to query
	 * @returns the number of variation axes in the face
	 * 
	 * Input = the maximum number of coordinates to return;
	 *                 Output = the actual number of coordinates returned (may be zero)
	 * 
	 * The array of coordinates found for the query
	 */
	function ot_var_named_instance_get_design_coords(face: face_t, instance_index: number): [ number, number | null, number[] ];

	/**
	 * Fetches the `name` table Name ID that provides display names for
	 * the "PostScript name" defined for the given named instance in the face.
	 * @param face The #hb_face_t to work on
	 * @param instance_index The index of the named instance to query
	 * @returns the Name ID found for the PostScript name
	 */
	function ot_var_named_instance_get_postscript_name_id(face: face_t, instance_index: number): ot_name_id_t;

	/**
	 * Fetches the `name` table Name ID that provides display names for
	 * the "Subfamily name" defined for the given named instance in the face.
	 * @param face The #hb_face_t to work on
	 * @param instance_index The index of the named instance to query
	 * @returns the Name ID found for the Subfamily name
	 */
	function ot_var_named_instance_get_subfamily_name_id(face: face_t, instance_index: number): ot_name_id_t;

	/**
	 * Normalizes the given design-space coordinates. The minimum and maximum
	 * values for the axis are mapped to the interval [-1,1], with the default
	 * axis value mapped to 0.
	 * 
	 * Any additional scaling defined in the face's `avar` table is also
	 * applied, as described at https://docs.microsoft.com/en-us/typography/opentype/spec/avar
	 * @param face The #hb_face_t to work on
	 * @param coords_length The length of the coordinate array
	 * @param design_coords The design-space coordinates to normalize
	 * @returns The normalized coordinates
	 */
	function ot_var_normalize_coords(face: face_t, coords_length: number, design_coords: number): number;

	/**
	 * Normalizes all of the coordinates in the given list of variation axes.
	 * @param face The #hb_face_t to work on
	 * @param variations The array of variations to normalize
	 * @param variations_length The number of variations to normalize
	 * @returns The array of normalized coordinates
	 * 
	 * The length of the coordinate array
	 */
	function ot_var_normalize_variations(face: face_t, variations: variation_t, variations_length: number): [ number[], number ];

	/**
	 * Converts an ISO 15924 script tag to a corresponding #hb_script_t.
	 * @param tag an #hb_tag_t representing an ISO 15924 tag.
	 * @returns An #hb_script_t corresponding to the ISO 15924 tag.
	 */
	function script_from_iso15924_tag(tag: tag_t): script_t;

	/**
	 * Converts a string #str representing an ISO 15924 script tag to a
	 * corresponding #hb_script_t. Shorthand for {@link Hb.tag_from_string} then
	 * hb_script_from_iso15924_tag().
	 * @param str a string representing an
	 *       ISO 15924 tag.
	 * @param len length of the #str, or -1 if it is %NULL-terminated.
	 * @returns An #hb_script_t corresponding to the ISO 15924 tag.
	 */
	function script_from_string(str: number[], len: number): script_t;

	/**
	 * Fetches the #hb_direction_t of a script when it is
	 * set horizontally. All right-to-left scripts will return
	 * #HB_DIRECTION_RTL. All left-to-right scripts will return
	 * #HB_DIRECTION_LTR.  Scripts that can be written either
	 * horizontally or vertically will return #HB_DIRECTION_INVALID.
	 * Unknown scripts will return #HB_DIRECTION_LTR.
	 * @param script The #hb_script_t to query
	 * @returns The horizontal #hb_direction_t of #script
	 */
	function script_get_horizontal_direction(script: script_t): direction_t;

	/**
	 * Converts an #hb_script_t to a corresponding ISO 15924 script tag.
	 * @param script an #hb_script_t to convert.
	 * @returns An #hb_tag_t representing an ISO 15924 script tag.
	 */
	function script_to_iso15924_tag(script: script_t): tag_t;

	/**
	 * Checks the equality of two #hb_segment_properties_t's.
	 * @param a first #hb_segment_properties_t to compare.
	 * @param b second #hb_segment_properties_t to compare.
	 * @returns %true if all properties of #a equal those of #b, %false otherwise.
	 */
	function segment_properties_equal(a: segment_properties_t, b: segment_properties_t): bool_t;

	/**
	 * Creates a hash representing #p.
	 * @param p #hb_segment_properties_t to hash.
	 * @returns A hash of #p.
	 */
	function segment_properties_hash(p: segment_properties_t): number;

	/**
	 * Adds #codepoint to #set.
	 * @param set A set
	 * @param codepoint The element to add to #set
	 */
	function set_add(set: set_t, codepoint: codepoint_t): void;

	/**
	 * Adds all of the elements from #first to #last
	 * (inclusive) to #set.
	 * @param set A set
	 * @param first The first element to add to #set
	 * @param last The final element to add to #set
	 */
	function set_add_range(set: set_t, first: codepoint_t, last: codepoint_t): void;

	/**
	 * Tests whether memory allocation for a set was successful.
	 * @param set A set
	 * @returns %true if allocation succeeded, %false otherwise
	 */
	function set_allocation_successful(set: set_t): bool_t;

	/**
	 * Clears out the contents of a set.
	 * @param set A set
	 */
	function set_clear(set: set_t): void;

	/**
	 * Allocate a copy of #set.
	 * @param set A set
	 * @returns Newly-allocated set.
	 */
	function set_copy(set: set_t): set_t;

	/**
	 * Creates a new, initially empty set.
	 * @returns The new #hb_set_t
	 */
	function set_create(): set_t;

	/**
	 * Removes #codepoint from #set.
	 * @param set A set
	 * @param codepoint Removes #codepoint from #set
	 */
	function set_del(set: set_t, codepoint: codepoint_t): void;

	/**
	 * Removes all of the elements from #first to #last
	 * (inclusive) from #set.
	 * 
	 * If #last is #HB_SET_VALUE_INVALID, then all values
	 * greater than or equal to #first are removed.
	 * @param set A set
	 * @param first The first element to remove from #set
	 * @param last The final element to remove from #set
	 */
	function set_del_range(set: set_t, first: codepoint_t, last: codepoint_t): void;

	/**
	 * Decreases the reference count on a set. When
	 * the reference count reaches zero, the set is
	 * destroyed, freeing all memory.
	 * @param set A set
	 */
	function set_destroy(set: set_t): void;

	/**
	 * Fetches the singleton empty #hb_set_t.
	 * @returns The empty #hb_set_t
	 */
	function set_get_empty(): set_t;

	/**
	 * Finds the largest element in the set.
	 * @param set A set
	 * @returns maximum of #set, or #HB_SET_VALUE_INVALID if #set is empty.
	 */
	function set_get_max(set: set_t): codepoint_t;

	/**
	 * Finds the smallest element in the set.
	 * @param set A set
	 * @returns minimum of #set, or #HB_SET_VALUE_INVALID if #set is empty.
	 */
	function set_get_min(set: set_t): codepoint_t;

	/**
	 * Returns the number of elements in the set.
	 * @param set A set
	 * @returns The population of #set
	 */
	function set_get_population(set: set_t): number;

	/**
	 * Fetches the user data associated with the specified key,
	 * attached to the specified set.
	 * @param set A set
	 * @param key The user-data key to query
	 * @returns A pointer to the user data
	 */
	function set_get_user_data(set: set_t, key: user_data_key_t): any | null;

	/**
	 * Tests whether #codepoint belongs to #set.
	 * @param set A set
	 * @param codepoint The element to query
	 * @returns %true if #codepoint is in #set, %false otherwise
	 */
	function set_has(set: set_t, codepoint: codepoint_t): bool_t;

	/**
	 * Makes #set the intersection of #set and #other.
	 * @param set A set
	 * @param other Another set
	 */
	function set_intersect(set: set_t, other: set_t): void;

	/**
	 * Inverts the contents of #set.
	 * @param set A set
	 */
	function set_invert(set: set_t): void;

	/**
	 * Tests whether a set is empty (contains no elements).
	 * @param set a set.
	 * @returns %true if #set is empty
	 */
	function set_is_empty(set: set_t): bool_t;

	/**
	 * Tests whether #set and #other are equal (contain the same
	 * elements).
	 * @param set A set
	 * @param other Another set
	 * @returns %true if the two sets are equal, %false otherwise.
	 */
	function set_is_equal(set: set_t, other: set_t): bool_t;

	/**
	 * Tests whether #set is a subset of #larger_set.
	 * @param set A set
	 * @param larger_set Another set
	 * @returns %true if the #set is a subset of (or equal to) #larger_set, %false otherwise.
	 */
	function set_is_subset(set: set_t, larger_set: set_t): bool_t;

	/**
	 * Fetches the next element in #set that is greater than current value of #codepoint.
	 * 
	 * Set #codepoint to #HB_SET_VALUE_INVALID to get started.
	 * @param set A set
	 * @returns %true if there was a next value, %false otherwise
	 */
	function set_next(set: set_t): bool_t;

	/**
	 * Fetches the next consecutive range of elements in #set that
	 * are greater than current value of #last.
	 * 
	 * Set #last to #HB_SET_VALUE_INVALID to get started.
	 * @param set A set
	 * @returns %true if there was a next range, %false otherwise
	 * 
	 * The first code point in the range
	 */
	function set_next_range(set: set_t): [ bool_t, codepoint_t ];

	/**
	 * Fetches the previous element in #set that is lower than current value of #codepoint.
	 * 
	 * Set #codepoint to #HB_SET_VALUE_INVALID to get started.
	 * @param set A set
	 * @returns %true if there was a previous value, %false otherwise
	 */
	function set_previous(set: set_t): bool_t;

	/**
	 * Fetches the previous consecutive range of elements in #set that
	 * are greater than current value of #last.
	 * 
	 * Set #first to #HB_SET_VALUE_INVALID to get started.
	 * @param set A set
	 * @returns %true if there was a previous range, %false otherwise
	 * 
	 * The last code point in the range
	 */
	function set_previous_range(set: set_t): [ bool_t, codepoint_t ];

	/**
	 * Increases the reference count on a set.
	 * @param set A set
	 * @returns The set
	 */
	function set_reference(set: set_t): set_t;

	/**
	 * Makes the contents of #set equal to the contents of #other.
	 * @param set A set
	 * @param other Another set
	 */
	function set_set(set: set_t, other: set_t): void;

	/**
	 * Attaches a user-data key/data pair to the specified set.
	 * @param set A set
	 * @param key The user-data key to set
	 * @param data A pointer to the user data to set
	 * @param destroy A callback to call when #data is not needed anymore
	 * @param replace Whether to replace an existing data with the same key
	 * @returns %true if success, %false otherwise
	 */
	function set_set_user_data(set: set_t, key: user_data_key_t, data: any | null, destroy: destroy_func_t | null, replace: bool_t): bool_t;

	/**
	 * Subtracts the contents of #other from #set.
	 * @param set A set
	 * @param other Another set
	 */
	function set_subtract(set: set_t, other: set_t): void;

	/**
	 * Makes #set the symmetric difference of #set
	 * and #other.
	 * @param set A set
	 * @param other Another set
	 */
	function set_symmetric_difference(set: set_t, other: set_t): void;

	/**
	 * Makes #set the union of #set and #other.
	 * @param set A set
	 * @param other Another set
	 */
	function set_union(set: set_t, other: set_t): void;

	/**
	 * Shapes #buffer using #font turning its Unicode characters content to
	 * positioned glyphs. If #features is not %NULL, it will be used to control the
	 * features applied during shaping. If two #features have the same tag but
	 * overlapping ranges the value of the feature with the higher index takes
	 * precedence.
	 * @param font an #hb_font_t to use for shaping
	 * @param buffer an #hb_buffer_t to shape
	 * @param features an array of user
	 *    specified #hb_feature_t or %NULL
	 * @param num_features the length of #features array
	 */
	function shape(font: font_t, buffer: buffer_t, features: feature_t[] | null, num_features: number): void;

	/**
	 * See {@link Hb.shape} for details. If #shaper_list is not %NULL, the specified
	 * shapers will be used in the given order, otherwise the default shapers list
	 * will be used.
	 * @param font an #hb_font_t to use for shaping
	 * @param buffer an #hb_buffer_t to shape
	 * @param features an array of user
	 *    specified #hb_feature_t or %NULL
	 * @param num_features the length of #features array
	 * @param shaper_list a %NULL-terminated
	 *    array of shapers to use or %NULL
	 * @returns false if all shapers failed, true otherwise
	 */
	function shape_full(font: font_t, buffer: buffer_t, features: feature_t[] | null, num_features: number, shaper_list: string[] | null): bool_t;

	/**
	 * Retrieves the list of shapers supported by HarfBuzz.
	 * @returns an array of
	 *    constant strings
	 */
	function shape_list_shapers(): string[];

	/**
	 * Constructs a shaping plan for a combination of #face, #user_features, #props,
	 * and #shaper_list.
	 * @param face #hb_face_t to use
	 * @param props The #hb_segment_properties_t of the segment
	 * @param user_features The list of user-selected features
	 * @param num_user_features The number of user-selected features
	 * @param shaper_list List of shapers to try
	 * @returns The shaping plan
	 */
	function shape_plan_create(face: face_t, props: segment_properties_t, user_features: feature_t[], num_user_features: number, shaper_list: string[]): shape_plan_t;

	/**
	 * The variable-font version of #hb_shape_plan_create.
	 * Constructs a shaping plan for a combination of #face, #user_features, #props,
	 * and #shaper_list, plus the variation-space coordinates #coords.
	 * @param face #hb_face_t to use
	 * @param props The #hb_segment_properties_t of the segment
	 * @param user_features The list of user-selected features
	 * @param num_user_features The number of user-selected features
	 * @param coords The list of variation-space coordinates
	 * @param num_coords The number of variation-space coordinates
	 * @param shaper_list List of shapers to try
	 * @returns The shaping plan
	 */
	function shape_plan_create2(face: face_t, props: segment_properties_t, user_features: feature_t[], num_user_features: number, coords: number[], num_coords: number, shaper_list: string[]): shape_plan_t;

	/**
	 * Creates a cached shaping plan suitable for reuse, for a combination
	 * of #face, #user_features, #props, and #shaper_list.
	 * @param face #hb_face_t to use
	 * @param props The #hb_segment_properties_t of the segment
	 * @param user_features The list of user-selected features
	 * @param num_user_features The number of user-selected features
	 * @param shaper_list List of shapers to try
	 * @returns The shaping plan
	 */
	function shape_plan_create_cached(face: face_t, props: segment_properties_t, user_features: feature_t[], num_user_features: number, shaper_list: string[]): shape_plan_t;

	/**
	 * The variable-font version of #hb_shape_plan_create_cached.
	 * Creates a cached shaping plan suitable for reuse, for a combination
	 * of #face, #user_features, #props, and #shaper_list, plus the
	 * variation-space coordinates #coords.
	 * @param face #hb_face_t to use
	 * @param props The #hb_segment_properties_t of the segment
	 * @param user_features The list of user-selected features
	 * @param num_user_features The number of user-selected features
	 * @param coords The list of variation-space coordinates
	 * @param num_coords The number of variation-space coordinates
	 * @param shaper_list List of shapers to try
	 * @returns The shaping plan
	 */
	function shape_plan_create_cached2(face: face_t, props: segment_properties_t, user_features: feature_t[], num_user_features: number, coords: number[], num_coords: number, shaper_list: string[]): shape_plan_t;

	/**
	 * Decreases the reference count on the given shaping plan. When the
	 * reference count reaches zero, the shaping plan is destroyed,
	 * freeing all memory.
	 * @param shape_plan A shaping plan
	 */
	function shape_plan_destroy(shape_plan: shape_plan_t): void;

	/**
	 * Executes the given shaping plan on the specified buffer, using
	 * the given #font and #features.
	 * @param shape_plan A shaping plan
	 * @param font The #hb_font_t to use
	 * @param buffer The #hb_buffer_t to work upon
	 * @param features Features to enable
	 * @param num_features The number of features to enable
	 * @returns %true if success, %false otherwise.
	 */
	function shape_plan_execute(shape_plan: shape_plan_t, font: font_t, buffer: buffer_t, features: feature_t[], num_features: number): bool_t;

	/**
	 * Fetches the singleton empty shaping plan.
	 * @returns The empty shaping plan
	 */
	function shape_plan_get_empty(): shape_plan_t;

	/**
	 * Fetches the shaper from a given shaping plan.
	 * @param shape_plan A shaping plan
	 * @returns The shaper
	 */
	function shape_plan_get_shaper(shape_plan: shape_plan_t): string;

	/**
	 * Fetches the user data associated with the specified key,
	 * attached to the specified shaping plan.
	 * @param shape_plan A shaping plan
	 * @param key The user-data key to query
	 * @returns A pointer to the user data
	 */
	function shape_plan_get_user_data(shape_plan: shape_plan_t, key: user_data_key_t): any | null;

	/**
	 * Increases the reference count on the given shaping plan.
	 * @param shape_plan A shaping plan
	 * @returns #shape_plan
	 */
	function shape_plan_reference(shape_plan: shape_plan_t): shape_plan_t;

	/**
	 * Attaches a user-data key/data pair to the given shaping plan.
	 * @param shape_plan A shaping plan
	 * @param key The user-data key to set
	 * @param data A pointer to the user data
	 * @param destroy A callback to call when #data is not needed anymore
	 * @param replace Whether to replace an existing data with the same key
	 * @returns %true if success, %false otherwise.
	 */
	function shape_plan_set_user_data(shape_plan: shape_plan_t, key: user_data_key_t, data: any | null, destroy: destroy_func_t | null, replace: bool_t): bool_t;

	/**
	 * Searches variation axes of a #hb_font_t object for a specific axis first,
	 * if not set, then tries to get default style values from different
	 * tables of the font.
	 * @param font a #hb_font_t object.
	 * @param style_tag a style tag.
	 * @returns Corresponding axis or default value to a style tag.
	 */
	function style_get_value(font: font_t, style_tag: style_tag_t): number;

	/**
	 * Converts a string into an #hb_tag_t. Valid tags
	 * are four characters. Shorter input strings will be
	 * padded with spaces. Longer input strings will be
	 * truncated.
	 * @param str String to convert
	 * @param len Length of #str, or -1 if it is %NULL-terminated
	 * @returns The #hb_tag_t corresponding to #str
	 */
	function tag_from_string(str: number[], len: number): tag_t;

	/**
	 * Converts an #hb_tag_t to a string and returns it in #buf.
	 * Strings will be four characters long.
	 * @param tag #hb_tag_t to convert
	 * @returns Converted string
	 */
	function tag_to_string(tag: tag_t): number[];

	/**
	 * Retrieves the Canonical Combining Class (ccc) property
	 * of code point #unicode.
	 * @param ufuncs The Unicode-functions structure
	 * @param unicode The code point to query
	 * @returns The #hb_unicode_combining_class_t of #unicode
	 */
	function unicode_combining_class(ufuncs: unicode_funcs_t, unicode: codepoint_t): unicode_combining_class_t;

	/**
	 * Fetches the composition of a sequence of two Unicode
	 * code points.
	 * 
	 * Calls the composition function of the specified
	 * Unicode-functions structure #ufuncs.
	 * @param ufuncs The Unicode-functions structure
	 * @param a The first Unicode code point to compose
	 * @param b The second Unicode code point to compose
	 * @returns %true if #a and #b composed, %false otherwise
	 * 
	 * The composition of #a, #b
	 */
	function unicode_compose(ufuncs: unicode_funcs_t, a: codepoint_t, b: codepoint_t): [ bool_t, codepoint_t ];

	/**
	 * Fetches the decomposition of a Unicode code point.
	 * 
	 * Calls the decomposition function of the specified
	 * Unicode-functions structure #ufuncs.
	 * @param ufuncs The Unicode-functions structure
	 * @param ab Unicode code point to decompose
	 * @returns %true if #ab was decomposed, %false otherwise
	 * 
	 * The first code point of the decomposition of #ab
	 * 
	 * The second code point of the decomposition of #ab
	 */
	function unicode_decompose(ufuncs: unicode_funcs_t, ab: codepoint_t): [ bool_t, codepoint_t, codepoint_t ];

	/**
	 * Fetches the compatibility decomposition of a Unicode
	 * code point. Deprecated.
	 * @param ufuncs The Unicode-functions structure
	 * @param u Code point to decompose
	 * @returns length of #decomposed.
	 * 
	 * Compatibility decomposition of #u
	 */
	function unicode_decompose_compatibility(ufuncs: unicode_funcs_t, u: codepoint_t): [ number, codepoint_t ];

	/**
	 * Don't use. Not used by HarfBuzz.
	 * @param ufuncs a Unicode-function structure
	 * @param unicode The code point to query
	 * @returns 
	 */
	function unicode_eastasian_width(ufuncs: unicode_funcs_t, unicode: codepoint_t): number;

	/**
	 * Creates a new #hb_unicode_funcs_t structure of Unicode functions.
	 * @param parent Parent Unicode-functions structure
	 * @returns The Unicode-functions structure
	 */
	function unicode_funcs_create(parent: unicode_funcs_t | null): unicode_funcs_t;

	/**
	 * Decreases the reference count on a Unicode-functions structure. When
	 * the reference count reaches zero, the Unicode-functions structure is
	 * destroyed, freeing all memory.
	 * @param ufuncs The Unicode-functions structure
	 */
	function unicode_funcs_destroy(ufuncs: unicode_funcs_t): void;

	/**
	 * Fetches a pointer to the default Unicode-functions structure that is used
	 * when no functions are explicitly set on #hb_buffer_t.
	 * @returns a pointer to the #hb_unicode_funcs_t Unicode-functions structure
	 */
	function unicode_funcs_get_default(): unicode_funcs_t;

	/**
	 * Fetches the singleton empty Unicode-functions structure.
	 * @returns The empty Unicode-functions structure
	 */
	function unicode_funcs_get_empty(): unicode_funcs_t;

	/**
	 * Fetches the parent of the Unicode-functions structure
	 * #ufuncs.
	 * @param ufuncs The Unicode-functions structure
	 * @returns The parent Unicode-functions structure
	 */
	function unicode_funcs_get_parent(ufuncs: unicode_funcs_t): unicode_funcs_t;

	/**
	 * Fetches the user-data associated with the specified key,
	 * attached to the specified Unicode-functions structure.
	 * @param ufuncs The Unicode-functions structure
	 * @param key The user-data key to query
	 * @returns A pointer to the user data
	 */
	function unicode_funcs_get_user_data(ufuncs: unicode_funcs_t, key: user_data_key_t): any | null;

	/**
	 * Tests whether the specified Unicode-functions structure
	 * is immutable.
	 * @param ufuncs The Unicode-functions structure
	 * @returns %true if #ufuncs is immutable, %false otherwise
	 */
	function unicode_funcs_is_immutable(ufuncs: unicode_funcs_t): bool_t;

	/**
	 * Makes the specified Unicode-functions structure
	 * immutable.
	 * @param ufuncs The Unicode-functions structure
	 */
	function unicode_funcs_make_immutable(ufuncs: unicode_funcs_t): void;

	/**
	 * Increases the reference count on a Unicode-functions structure.
	 * @param ufuncs The Unicode-functions structure
	 * @returns The Unicode-functions structure
	 */
	function unicode_funcs_reference(ufuncs: unicode_funcs_t): unicode_funcs_t;

	/**
	 * Sets the implementation function for #hb_unicode_combining_class_func_t.
	 * @param ufuncs A Unicode-functions structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function unicode_funcs_set_combining_class_func(ufuncs: unicode_funcs_t, func: unicode_combining_class_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_unicode_compose_func_t.
	 * @param ufuncs A Unicode-functions structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function unicode_funcs_set_compose_func(ufuncs: unicode_funcs_t, func: unicode_compose_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_unicode_decompose_compatibility_func_t.
	 * @param ufuncs A Unicode-functions structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function unicode_funcs_set_decompose_compatibility_func(ufuncs: unicode_funcs_t, func: unicode_decompose_compatibility_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_unicode_decompose_func_t.
	 * @param ufuncs A Unicode-functions structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function unicode_funcs_set_decompose_func(ufuncs: unicode_funcs_t, func: unicode_decompose_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_unicode_eastasian_width_func_t.
	 * @param ufuncs a Unicode-function structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function unicode_funcs_set_eastasian_width_func(ufuncs: unicode_funcs_t, func: unicode_eastasian_width_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_unicode_general_category_func_t.
	 * @param ufuncs A Unicode-functions structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function unicode_funcs_set_general_category_func(ufuncs: unicode_funcs_t, func: unicode_general_category_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_unicode_mirroring_func_t.
	 * @param ufuncs A Unicode-functions structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function unicode_funcs_set_mirroring_func(ufuncs: unicode_funcs_t, func: unicode_mirroring_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Sets the implementation function for #hb_unicode_script_func_t.
	 * @param ufuncs A Unicode-functions structure
	 * @param func The callback function to assign
	 * @param destroy The function to call when #user_data is not needed anymore
	 */
	function unicode_funcs_set_script_func(ufuncs: unicode_funcs_t, func: unicode_script_func_t, destroy: destroy_func_t | null): void;

	/**
	 * Attaches a user-data key/data pair to the specified Unicode-functions structure.
	 * @param ufuncs The Unicode-functions structure
	 * @param key The user-data key
	 * @param data A pointer to the user data
	 * @param destroy A callback to call when #data is not needed anymore
	 * @param replace Whether to replace an existing data with the same key
	 * @returns %true if success, %false otherwise
	 */
	function unicode_funcs_set_user_data(ufuncs: unicode_funcs_t, key: user_data_key_t, data: any | null, destroy: destroy_func_t | null, replace: bool_t): bool_t;

	/**
	 * Retrieves the General Category (gc) property
	 * of code point #unicode.
	 * @param ufuncs The Unicode-functions structure
	 * @param unicode The code point to query
	 * @returns The #hb_unicode_general_category_t of #unicode
	 */
	function unicode_general_category(ufuncs: unicode_funcs_t, unicode: codepoint_t): unicode_general_category_t;

	/**
	 * Retrieves the Bi-directional Mirroring Glyph code
	 * point defined for code point #unicode.
	 * @param ufuncs The Unicode-functions structure
	 * @param unicode The code point to query
	 * @returns The #hb_codepoint_t of the Mirroring Glyph for #unicode
	 */
	function unicode_mirroring(ufuncs: unicode_funcs_t, unicode: codepoint_t): codepoint_t;

	/**
	 * Retrieves the #hb_script_t script to which code
	 * point #unicode belongs.
	 * @param ufuncs The Unicode-functions structure
	 * @param unicode The code point to query
	 * @returns The #hb_script_t of #unicode
	 */
	function unicode_script(ufuncs: unicode_funcs_t, unicode: codepoint_t): script_t;

	/**
	 * Parses a string into a #hb_variation_t.
	 * 
	 * The format for specifying variation settings follows. All valid CSS
	 * font-variation-settings values other than 'normal' and 'inherited' are also
	 * accepted, though, not documented below.
	 * 
	 * The format is a tag, optionally followed by an equals sign, followed by a
	 * number. For example `wght=500`, or `slnt=-7.5`.
	 * @param str a string to parse
	 * @param len length of #str, or -1 if string is %NULL terminated
	 * @returns %true if #str is successfully parsed, %false otherwise
	 * 
	 * the #hb_variation_t to initialize with the parsed values
	 */
	function variation_from_string(str: number[], len: number): [ bool_t, variation_t ];

	/**
	 * Converts an #hb_variation_t into a %NULL-terminated string in the format
	 * understood by {@link Hb.variation_from_string}. The client in responsible for
	 * allocating big enough size for #buf, 128 bytes is more than enough.
	 * @param variation an #hb_variation_t to convert
	 * @returns output string
	 * 
	 * the allocated size of #buf
	 */
	function variation_to_string(variation: variation_t): [ string[], number ];

	/**
	 * Used when getting or setting AAT feature selectors. Indicates that
	 * there is no selector index corresponding to the selector of interest.
	 * @returns Used when getting or setting AAT feature selectors. Indicates that
	 * there is no selector index corresponding to the selector of interest.
	 */
	const AAT_LAYOUT_NO_SELECTOR_INDEX: number;

	/**
	 * The default code point for replacing invalid characters in a given encoding.
	 * Set to U+FFFD REPLACEMENT CHARACTER.
	 * @returns The default code point for replacing invalid characters in a given encoding.
	 * Set to U+FFFD REPLACEMENT CHARACTER.
	 */
	const BUFFER_REPLACEMENT_CODEPOINT_DEFAULT: number;

	/**
	 * Special setting for #hb_feature_t.start to apply the feature from the start
	 * of the buffer.
	 * @returns Special setting for #hb_feature_t.start to apply the feature from the start
	 * of the buffer.
	 */
	const FEATURE_GLOBAL_START: number;

	/**
	 * An unset #hb_language_t.
	 * @returns An unset #hb_language_t.
	 */
	const LANGUAGE_INVALID: language_t;

	/**
	 * Unset #hb_map_t value.
	 * @returns Unset #hb_map_t value.
	 */
	const MAP_VALUE_INVALID: codepoint_t;

	/**
	 * Special value for language index indicating default or unsupported language.
	 * @returns Special value for language index indicating default or unsupported language.
	 */
	const OT_LAYOUT_DEFAULT_LANGUAGE_INDEX: number;

	/**
	 * Special value for feature index indicating unsupported feature.
	 * @returns Special value for feature index indicating unsupported feature.
	 */
	const OT_LAYOUT_NO_FEATURE_INDEX: number;

	/**
	 * Special value for script index indicating unsupported script.
	 * @returns Special value for script index indicating unsupported script.
	 */
	const OT_LAYOUT_NO_SCRIPT_INDEX: number;

	/**
	 * Special value for variations index indicating unsupported variation.
	 * @returns Special value for variations index indicating unsupported variation.
	 */
	const OT_LAYOUT_NO_VARIATIONS_INDEX: number;

	/**
	 * Maximum number of OpenType tags that can correspond to a give #hb_language_t.
	 * @returns Maximum number of OpenType tags that can correspond to a give #hb_language_t.
	 */
	const OT_MAX_TAGS_PER_LANGUAGE: number;

	/**
	 * Maximum number of OpenType tags that can correspond to a give #hb_script_t.
	 * @returns Maximum number of OpenType tags that can correspond to a give #hb_script_t.
	 */
	const OT_MAX_TAGS_PER_SCRIPT: number;

	/**
	 * Do not use.
	 * @returns Do not use.
	 */
	const OT_VAR_NO_AXIS_INDEX: number;

	/**
	 * Unset #hb_set_t value.
	 * @returns Unset #hb_set_t value.
	 */
	const SET_VALUE_INVALID: codepoint_t;

	/**
	 * Maximum valid Unicode code point.
	 * @returns Maximum valid Unicode code point.
	 */
	const UNICODE_MAX: number;

	/**
	 * See Unicode 6.1 for details on the maximum decomposition length.
	 * @returns See Unicode 6.1 for details on the maximum decomposition length.
	 */
	const UNICODE_MAX_DECOMPOSITION_LEN: number;

	const VERSION_MAJOR: number;

	const VERSION_MICRO: number;

	const VERSION_MINOR: number;

	const VERSION_STRING: string;

}