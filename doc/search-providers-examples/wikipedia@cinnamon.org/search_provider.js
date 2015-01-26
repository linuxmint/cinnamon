const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Util = imports.misc.util;
const Lang = imports.lang;
const Soup = imports.gi.Soup;

const _httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

var results_cache = {};
var last_search;

var wikipedia_icon_file = Gio.file_new_for_path('/usr/share/icons/Mint-X/apps/22/wikipedia.png');
var wikipedia_gicon = new Gio.FileIcon({ file: wikipedia_icon_file });
 
function perform_search(pattern){
    try{
    if (results_cache[pattern])
    {
        last_search = '';
        push_results(results_cache[pattern]);
    }else{
        last_search = pattern;
        let message = Soup.Message.new('GET', get_locale_string("wikipedia_url").replace("%s", pattern));
        _httpSession.queue_message(message, Lang.bind(this, function (session, message, p) {
          try{
          if (p != last_search) return;
          if( message.status_code == 200) {
            var results = JSON.parse(message.response_body.data.toString());
            let result_titles = results[1];
            let result_descriptions = results[2];
            let result_urls = results[3];
            results_cache[p] = new Array();
            for (var i = 0; i < result_urls.length; i++)
            {
                results_cache[p].push({
                    id: result_urls[i],
                    url: result_urls[i],
                    label: result_titles[i],
                    description: result_descriptions[i]
                });
            }
            push_results(results_cache[p]);
          } else {
            global.logWarning("Error retrieving address " + url + ". Status: " + message.status_code + ": " + message.reason_phrase);
          }
          }catch(e){global.logError(e);}
        }, pattern));
    }
    }catch(e){global.logError(e);}
}
 
function push_results(results){
    for (var i in results)
    {
        results[i].icon = new St.Icon({gicon: wikipedia_gicon, icon_size: 22, icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon'});
    }
    send_results(results);
}
 
function on_result_selected(result){
    Util.spawn(['xdg-open', result.url]);
}
