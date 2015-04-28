const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;

function perform_search(pattern){
    push_results(pattern);
}
 
function push_results(results){
    var default_icon_app = Cinnamon.AppSystem.get_default().lookup_app("gcalctool.desktop");
    var pattern = results
    var results_array = new Array();
    
    //First Regex tests for numbers and operators, second makes sure it does not end with an operator as that is not a valid operation
    if ((/^[0-9.+*/()-]+$/.test(pattern)) && !(/[.+*/(-]+$/.test(pattern))) {
        let solution = 0;
        try {
            solution = eval(pattern);
        }catch(err){}
        
        let awns = (Math.round(solution * 10000) / 10000).toString();
        if (!(awns == pattern)) {
            results_array.push({
                id: awns,
                label: _("Solution: " + awns),
                icon_app: default_icon_app
            });
            send_results(results_array);
        }
    }
}
 
function on_result_selected(result){}
