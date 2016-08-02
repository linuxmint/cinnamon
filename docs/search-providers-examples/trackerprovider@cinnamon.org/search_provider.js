const Lang = imports.lang;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;
const SearchProviderManager = imports.ui.searchProviderManager;

var current_pattern;

function dbus_push_results(results, pattern)
{
    var basename;
    var final_results = new Array();
    if (pattern == current_pattern)
    {
        try{
            results = JSON.parse(results);
            for (var i in results)
            {
                switch (results[i].type)
                {
                    case "music":
                        basename = results[i]["url"].split("/");
                        basename = decodeURIComponent(basename[basename.length - 1]);
                        results[i]["performer"] = decodeURIComponent(results[i]["performer"]).substring(11);
                        results[i]["musicAlbum"] = decodeURIComponent(results[i]["musicAlbum"]).substring(10);
                        results[i].label = (results[i]["performer"] ? results[i]["performer"] + " - " : "") + (results[i]["musicAlbum"] ? results[i]["musicAlbum"] + " - " : "") + (results[i]["trackNumber"] ? results[i]["trackNumber"] + " - " : "") + (results[i]["title"] ? results[i]["title"] : basename);
                        break;
                    
                    case "software":
                        var results_parts = results[i]["url"].split("/");
                        var app = Cinnamon.AppSystem.get_default().lookup_app(results_parts[results_parts.length - 1].split(".desktop")[0] + ".desktop");
                        if (!app)
                        {
                            continue;
                        }
                        results[i].label = app.get_name();
                        results[i].icon_app = app;
                        break;
                    
                    default:
                        results[i].label = (decodeURIComponent(results[i]["url"])).split("/").pop();
                        break;
                }
                final_results.push(results[i]);
            }
            send_results(results);
        }
        catch(e)
        {
            global.logError(e);
        }
    }
}

function perform_search(pattern)
{
    current_pattern = pattern;
    Util.spawn_async(['python', SearchProviderManager.extensionMeta['trackerprovider@cinnamon.org'].path + '/search_provider.py', pattern], Lang.bind(this, dbus_push_results, pattern));
}

function on_result_selected(result){
    Util.spawn(['xdg-open', result.url]);
}
