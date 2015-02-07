const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;
const SearchProviderManager = imports.ui.searchProviderManager;

const MAX_SEARCH_RESULTS = 10;

var default_icon_app = Cinnamon.AppSystem.get_default().lookup_app("chromium-browser.desktop");
var current_pattern;

function dbus_push_results(results, pattern)
{
    var basename;
    if (pattern == current_pattern)
    {
        results = JSON.parse(results);
        for (var i in results)
        {
            if (!results[i].icon_filename)
            {
                results[i].icon_app = default_icon_app;
            }
        }
        send_results(results);
    }
}

function perform_search(pattern){
    current_pattern = pattern;
    Util.spawn_async(['python', SearchProviderManager.extensionMeta['chromium-history@cinnamon.org'].path + '/search_provider.py', pattern], Lang.bind(this, dbus_push_results, pattern));
}

function on_result_selected(result){
    Util.spawn(['xdg-open', result.url]);
}
