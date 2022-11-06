/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.xlib {
	export interface DisplayInitOptions {}
	interface Display {}
	class Display {
		public constructor(options?: Partial<DisplayInitOptions>);
	}

	export interface ScreenInitOptions {}
	interface Screen {}
	class Screen {
		public constructor(options?: Partial<ScreenInitOptions>);
	}

	export interface VisualInitOptions {}
	interface Visual {}
	class Visual {
		public constructor(options?: Partial<VisualInitOptions>);
	}

	export interface XConfigureEventInitOptions {}
	interface XConfigureEvent {}
	class XConfigureEvent {
		public constructor(options?: Partial<XConfigureEventInitOptions>);
	}

	export interface XImageInitOptions {}
	interface XImage {}
	class XImage {
		public constructor(options?: Partial<XImageInitOptions>);
	}

	export interface XFontStructInitOptions {}
	interface XFontStruct {}
	class XFontStruct {
		public constructor(options?: Partial<XFontStructInitOptions>);
	}

	export interface XTrapezoidInitOptions {}
	interface XTrapezoid {}
	class XTrapezoid {
		public constructor(options?: Partial<XTrapezoidInitOptions>);
	}

	export interface XVisualInfoInitOptions {}
	interface XVisualInfo {}
	class XVisualInfo {
		public constructor(options?: Partial<XVisualInfoInitOptions>);
	}

	export interface XWindowAttributesInitOptions {}
	interface XWindowAttributes {}
	class XWindowAttributes {
		public constructor(options?: Partial<XWindowAttributesInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link XEvent} instead.
	 */
	interface IXEvent {

	}

	type XEventInitOptionsMixin  = {};
	export interface XEventInitOptions extends XEventInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link XEvent} instead.
	 */
	type XEventMixin = IXEvent;

	interface XEvent extends XEventMixin {}

	class XEvent {
		public constructor(options?: Partial<XEventInitOptions>);
	}


	type Atom = number;

	type Colormap = number;

	type Cursor = number;

	type Drawable = number;

	type GC = any;

	type KeyCode = number;

	type KeySym = number;

	type Picture = number;

	type Time = number;

	type VisualID = number;

	type Window = number;

	type XID = number;

	type Pixmap = number;

	function open_display(): void;

}