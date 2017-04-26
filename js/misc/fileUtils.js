// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

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
