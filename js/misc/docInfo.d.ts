/**
* DOCINFO
*
* DocInfo is a JS layer on top of Cinnamon's DocSystem (which is written in C).
*
* The advantages of using DocInfo (rather than Gtk.RecentManager) are:
*
*  - Results are limited to 20 (with RecentManager you can get a huge number of results)
*  - Results are sorted by timestamp (they're not sorted by RecentManager)
*  - Sorting and clamping of the results is done in C and only the 20 most recent results are stored in memory
*  - The "changed" signal sent by DocSystem is delayed via idle_timeout, so your applet doesn't rebuild immediately when Gtk.RecentManager sends its signal (which could potentially reduce the speed at which apps are launched)
*  - DocInfo provides decoded URIs and the ability to quickly create the icon so your applet doesn't need to do that itself.
*/
export declare class DocInfo {
    readonly gicon: any;
    readonly name: string;
    readonly uri: string;
    readonly mimeType: string;
    readonly uriDecoded: string;
    constructor(recentInfo: imports.gi.Gtk.RecentInfo);
    createIcon(size: number): imports.gi.St.Icon;
}
export declare function getDocManager(): DocManager;
declare type DocManagerSignals = Signal<"changed", []>;
export interface DocManager extends DocManagerSignals {
}
/**
 * DocManager wraps the DocSystem, primarily to expose DocInfo objects.
 */
export declare class DocManager {
    protected _docSystem: imports.gi.Cinnamon.DocSystem;
    protected _infosByTimestamp: DocInfo[];
    constructor();
    protected _load(): void;
    protected _reload(): void;
}
export {};
