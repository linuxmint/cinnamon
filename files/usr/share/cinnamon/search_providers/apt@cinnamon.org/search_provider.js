const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;

const MAX_SEARCH_RESULTS = 10;

var results_cache = {};
var search_results = {};
var last_search_pid;
var default_icon_app = Cinnamon.AppSystem.get_default().lookup_app("mintInstall.desktop");

function perform_search(pattern){
    global.log("perform_search:" + pattern);
    if (results_cache[pattern])
    {
        push_results(results_cache[pattern]);
    }else{
        try{
            let [res, pid, in_fd, out_fd, err_fd] = GLib.spawn_async_with_pipes(null, ["apt-cache", "search", pattern], null, GLib.SpawnFlags.SEARCH_PATH, null);
            out_reader = new Gio.DataInputStream({base_stream: new Gio.UnixInputStream({fd: out_fd})});
            
            last_search_pid = pid;
            search_results = new Array();
            
            Mainloop.timeout_add(100, Lang.bind(this, function(stream, pid){
                if (pid != last_search_pid){
                    return false;
                }
                let [output, size] = stream.read_line(null);
                if (size > 0){
                    search_results.push(output.toString());
                    if (search_results.length >= MAX_SEARCH_RESULTS){
                        results_cache[pattern] = search_results;
                        push_results(search_results);
                        return false;
                    }
                    return true;
                }else{
                    results_cache[pattern] = search_results;
                    push_results(search_results);
                    return false;
                }
            }, out_reader, pid));
        }catch(e){global.log(e);}
    }
}

function push_results(results){
    var results_array = new Array();
    results.forEach(function(item, index){
        var i = item.indexOf(" - ");
        if (i != -1)
        {
            results_array.push({
                id: item.substring(0, i),
                label: _("Install package : ") + item.substring(0, i),
                icon_app: default_icon_app
            });
        }
    });
    send_results(results_array);
}

function on_result_selected(result){
    Util.spawn(['xdg-open', 'apt://' + result.id]);
}
