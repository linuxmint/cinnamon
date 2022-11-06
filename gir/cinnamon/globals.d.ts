declare function require(path: string): any;

/** Interface typing for the global variable.
 * Extendable, for example overloading in a d.ts file:
 * @example declare interface GlobalExtensions {
		trayReloading?: boolean;
	}
 */
declare interface Global extends imports.gi.Cinnamon.IGlobal{
    log: (...args: any[]) => void;
    logWarning:  (...args: any[]) => void;
    logError: (...args: any[]) => void;
    logTrace: (...args: any[]) => void;
    reparentActor: (...args: any[]) => void;

    /** Main Cinnamon settings */
    readonly settings: imports.gi.Gio.Settings;
    /** the directory, the cinnamon spices are placed, e.g. on Linux Mint 20.2 this is: $HOME/.local/share/cinnamon  */
    readonly userdatadir: string
}

declare const global: Global;

interface String {
    format(...args: string[]): string
}

declare interface  Meta {
    uuid: string;
    path: string;
    name: string;
    description: string;
    "max-instances": number;
    multiversion: boolean;
    author: string;
    "last-edited": number;
    error: any;
    "force-loaded": boolean
}

declare const __meta: Meta

declare const __dirname: string
declare const __filename: string

declare class GJSError extends Error {
    stack: any;
    fileName: string;
    lineNumber: number;
    columnNumber: number;
    domain: number;
    code: number;
    message: string;
    toString(): string;
    copy(): Error;
    free(): void;
    matches(domain: number, code: imports.gi.Gio.IOErrorEnum): boolean;
}

declare namespace imports.cairo {
    export class LinearGradient {
        constructor(margin: number, gradientOffset: number, width: number, height: number);
        addColorStopRGBA(number: number, red: number, green: number, blue: number, alpha: number): void;
    }
}

/** @deprecated Mainloop is simply a layer of convenience and backwards-compatibility over some GLib functions (such as `GLib.timeout_add()` which in GJS is mapped to `g_timeout_add_full()`). It's use is not generally recommended anymore */
declare namespace imports.mainloop {
    /**
     * Calls callback function after given seconds
     * @param seconds 
     * @param binding 
     */
    export function timeout_add_seconds(seconds: number, binding: () => any): void;
    export function timeout_add(milliseconds: number, binding: () => any, errorCallback?: () => null): number;
    export function source_remove(id: any): void;
}

declare namespace imports.gettext {
    function bindtextdomain(UUID: string, homeDir: string): void;

    function dgettext(UUID: string, text: string): string;
    function gettext(text: string): string;
}

interface Signal<T extends string, TT extends any[]> {
    emit(signal: T, ...args: TT): void;
    connect(signal: T, callback: (...args: TT) => void): number;
    disconnect(connection: number): void;
}

declare namespace imports {

    export const lang: Lang;
    interface Lang {
        bind<T, CTX>(ctx: CTX, func: T): T;
    }

    export const signals: Signals

    interface Signals {
        addSignalMethods(prototype: any): void
    }
}
