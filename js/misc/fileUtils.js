// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const FunctionConstructor = Symbol();
const Symbols = {};
Symbols[FunctionConstructor] = 0..constructor.constructor;

function listDirAsync(file, callback) {
    let allFiles = [];
    file.enumerate_children_async(Gio.FILE_ATTRIBUTE_STANDARD_NAME,
                                  Gio.FileQueryInfoFlags.NONE,
                                  GLib.PRIORITY_LOW, null, function (obj, res) {
        let enumerator = obj.enumerate_children_finish(res);
        function onNextFileComplete(obj, res) {
            let files = obj.next_files_finish(res);
            if (files.length) {
                allFiles = allFiles.concat(files);
                enumerator.next_files_async(100, GLib.PRIORITY_LOW, null, onNextFileComplete);
            } else {
                enumerator.close(null);
                callback(allFiles);
            }
        }
        enumerator.next_files_async(100, GLib.PRIORITY_LOW, null, onNextFileComplete);
    });
}

function deleteGFile(file) {
    // Work around 'delete' being a keyword in JS.
    return file['delete'](null);
}

function changeModeGFile(file, octal) {
    if(file.query_exists(null)) {
        let info = file.query_info("unix::mode", Gio.FileQueryInfoFlags.NONE, null);
        info.set_attribute_uint32("unix::mode", parseInt(octal, 8));
        file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
    }
}

function recursivelyDeleteDir(dir) {
    let children = dir.enumerate_children('standard::name,standard::type',
                                          Gio.FileQueryInfoFlags.NONE, null);

    let info, child;
    while ((info = children.next_file(null)) != null) {
        let type = info.get_file_type();
        let child = dir.get_child(info.get_name());
        if (type == Gio.FileType.REGULAR)
            deleteGFile(child);
        else if (type == Gio.FileType.DIRECTORY)
            recursivelyDeleteDir(child);
    }

    deleteGFile(dir);
}

function getUserDesktopDir() {

    // Didn't find a function returning the user desktop dir, so parsing the user-dirs.dirs file to get it
    let userdirsFile = Gio.file_new_for_path(GLib.get_home_dir()+"/.config/user-dirs.dirs");
    let path;
    if (userdirsFile.query_exists(null)){
        try{
            let data = userdirsFile.load_contents(null);
            let dataDic = new Array();
            let lines = data[1].toString().split("\n");
            for (var i in lines){
                if (!lines[i] || lines[i][0]=="#") continue;
                let line = lines[i].split("=", 2);
                if (line.length==2){
                    dataDic[line[0]] = line[1];
                }
            }
            if (dataDic["XDG_DESKTOP_DIR"])
                path = dataDic["XDG_DESKTOP_DIR"].substring(1, dataDic["XDG_DESKTOP_DIR"].length-1).replace("$HOME", GLib.get_home_dir());
            else
                path = GLib.get_home_dir() + '/Desktop';
        }catch(e){
            path = GLib.get_home_dir() + '/Desktop';
        }
    }else path = GLib.get_home_dir() + '/Desktop';
    let file = Gio.file_new_for_path(path);
    if (file.query_exists(null)) return path;
    else return null;
}

function requireModule(path, dir) {
    // Check for the file extension
    if (path.substr(-3) !== '.js') {
        path += '.js';
    }
    // Check relative paths
    if (path[0] === '.' || path[0] !== '/') {
        path = path.replace(/\.\//g, '');
        if (dir) {
            path = `${dir}/${path}`;
        }
    }
    let file = Gio.File.new_for_path(path);
    let [success, JS] = file.load_contents(null);
    if (!success) {
        return null;
    }

    // module.exports as an object holding a module's namespaces is a node convention, and is intended
    // to help interop with other libraries.
    const exports = {};
    const module = {
        exports: exports
    };

    // Regex match the top level variables names, and append them to the module.exports object,
    // mimicking the native CJS importer.
    JS = JS.toString();
    let modules = []
        .concat(JS.match(/^(?:[^ \n(a-zA-Z0-9\/])*(function{1,}) ([a-zA-Z_$]*[^(])/gm))
        .concat(JS.match(/^(var{1,}) ([a-zA-Z_$]*)/gm))
        .concat(JS.match(/^^(const{1,}) ([a-zA-Z_$]*)/gm))
        .concat(JS.match(/^(let{1,}) ([a-zA-Z_$]*)/gm));
    for (var i = 0; i < modules.length; i++) {
        if (!modules[i]) {
            continue;
        }
        let module = modules[i].split(' ')[1];
        // Regex doesn't filter commented out variables, so checking each namespace for undefined.
        JS += `module.exports.${module} = typeof ${module} !== 'undefined' ? ${module} : null;\n`;
    }
    // Return the exports objecting containing all of our top level namespaces.
    JS += `return module.exports;`;
    try {
        // Create the function returning module.exports and return it to Extension so it can be called by the
        // appropriate manager.
        return Symbols[FunctionConstructor]('require', 'exports', 'module', JS).call(
            exports,
            function require(path) {
                return requireModule(path, dir);
            },
            exports,
            module
        );
    } catch(e) {
        // Since constructing functions obscures the path in stack traces, we will put the correct path back.
        e.stack = e.stack.replace(/([^@]*(?=\s)\sFunction)/g, path);
        global.logError(e.stack)
        return null;
    }
}