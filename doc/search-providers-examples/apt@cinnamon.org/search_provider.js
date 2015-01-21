const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;
const SearchProviderManager = imports.ui.searchProviderManager;

var default_icon_app = Cinnamon.AppSystem.get_default().lookup_app("mintInstall.desktop");
var current_pattern;

function dbus_push_results(pattern, results)
{
    if (pattern == current_pattern)
    {
        for (var i in results)
        {
            results[i].icon_app = default_icon_app;
        }
        send_results(results);
    }
}

function perform_search(pattern)
{
    current_pattern = pattern;
    Util.spawn(['python', SearchProviderManager.extensionMeta['apt@cinnamon.org'].path + '/search_provider.py', pattern]);
}

function on_result_selected(result){
    Util.spawn(['xdg-open', 'apt://' + result.id]);
}
