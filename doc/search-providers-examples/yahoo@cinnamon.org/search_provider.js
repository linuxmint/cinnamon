const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Util = imports.misc.util;
 
function perform_search(pattern){
    push_results(pattern);
}
 
function push_results(results){
    var file = Gio.file_new_for_path('/usr/share/icons/Mint-X/apps/22/yahoo.png');
    var gicon = new Gio.FileIcon({ file: file });
    var myicon = new St.Icon({gicon: gicon, icon_size: 22, icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon'});
    var pattern = results.replace(" ", "+");
    var results_array = new Array();
    results_array.push({
        id: pattern,
        label: _("Search '" + results + "'"),
        icon: myicon
    });
    send_results(results_array);
}
 
function on_result_selected(result){
    Util.spawn(['xdg-open', get_locale_string("yahoo_url").replace("%s", result.id)]);
}
