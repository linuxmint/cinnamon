const Cinnamon = imports.gi.Cinnamon;

function perform_search(pattern){
    /* Test for numbers and operators and make sure it does not end with
       an operator, as that is not a valid operation */
    if (/^[0-9.+*/()-]+[0-9\)]$/.test(pattern)) {
        let solution = 0;
        try {
            solution = eval(pattern);
        }catch(err){}
        
        let awns = (Math.round(solution * 10000) / 10000).toString();
        if (awns != pattern) {
            let default_icon_app = Cinnamon.AppSystem.get_default().lookup_app("galculator.desktop");
            let result = {
                id: awns,
                label: _("Solution: %s").format(awns),
                icon_app: default_icon_app
            };
            send_results([result]);
        }
    }
}
 
function on_result_selected(result){}
