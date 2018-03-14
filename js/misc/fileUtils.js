// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
var getExtension = null;

var importNames = [
    'mainloop',
    'jsUnit',
    'format',
    'signals',
    'lang',
    'tweener',
    'overrides',
    'gettext',
    'coverage',
    'package',
    'cairo',
    'byteArray',
    'cairoNative'
];
var cinnamonImportNames = [
    'ui',
    'misc',
    'perf'
];
var LoadedModules = [];

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
                path = dataDic["XDG_DESKTOP_DIR"].substring(1, dataDic["XDG_DESKTOP_DIR"].length-1).replace(/\$HOME/, GLib.get_home_dir());
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

function findModuleIndex(path) {
    return LoadedModules.findIndex(function(cachedModule) {
        return cachedModule && cachedModule.path === path;
    });
}

function getModuleByIndex(index) {
    if (!LoadedModules[index]) {
        throw new Error('[getModuleByIndex] Module does not exist.');
    }
    return LoadedModules[index].module;
}

function unloadModule(index) {
    if (!LoadedModules[index]) {
        return;
    }
    for (let i = 0; i < LoadedModules.length; i++) {
        if (LoadedModules[i] && LoadedModules[i].dir === LoadedModules[index].dir) {
            LoadedModules[i].module = undefined;
            delete LoadedModules[i].module;
            LoadedModules.splice(LoadedModules.findIndex(module => module.dir === LoadedModules[i].dir), 1);
        }
    }
}

function getModuleFromImports(importerData, dir, fileName) {
    try {
        // Make sure the file is removed from the importer. This should propagate and finalize
        // the GjsModule object, so xlets can be fully reloaded.
        delete imports[fileName];
    } catch (e) {/* Not imported yet */}

    let oldSearchPath = imports.searchPath.slice();
    imports.searchPath = [dir];
    importerData.module = imports[fileName];
    imports.searchPath = oldSearchPath;

    return importerData;
}

function createExports({path, dir, fileName, meta, returnIndex, reject}) {
    // Import data is stored in an array of objects and the module index is looked up by path.
    let importerData = {
        path,
        dir,
        module: null
    };

    // Storing by array index that other extension classes can look up.
    let moduleIndex = findModuleIndex(path);
    if (moduleIndex > -1) {
        importerData = LoadedModules[moduleIndex];
    } else {
        LoadedModules.push(importerData);
        moduleIndex = LoadedModules.length - 1;
    }

    try {
        importerData = getModuleFromImports(importerData, dir, fileName);
    } catch (e) {
        if (reject) {
            reject(e);
            return;
        }
        throw e;
    }
    try {
        importerData.module.__meta = meta;
        importerData.module.__dirname = dir;
        importerData.module.__filename = fileName;
    } catch (e) {/* Directory import */}

    return returnIndex ? moduleIndex : importerData.module;
}

function requireModule(path, dir, meta, async = false, returnIndex = false) {
    if (!meta) {
        // If require is being called from within an xlet, we need to look backwards into the
        // stack, pick out the UUID, and then fetch the associated extension object.
        let callStack = new Error().stack.split('\n');
        let uuid = null;
        for (let i = 0; i < callStack.length; i++) {
            uuid = callStack[i].match(/(\w|-|\.|_)+@(\w|-|\.|_)+/g);
            if (uuid) {
                uuid = uuid[0];
                break;
            }
        }
        // fileUtils.js loads before the global object is created, so need to load it on first
        // invocation once.
        if (!getExtension) {
            getExtension = imports.ui.extension.getExtension;
        }
        let extension = getExtension(uuid);
        meta = extension.meta;
        dir = meta.path;
    }
    // Allow passing through native bindings, e.g. const Cinnamon = require('gi.Cinnamon');
    // Check if this is a GI import
    if (path.substr(0, 3) === 'gi.') {
        return imports.gi[path.substr(3, path.length)];
    }
    // Check if this is a Cinnamon import
    let importPrefix = path.split('.')[0];
    if (cinnamonImportNames.indexOf(importPrefix) > -1
        && path.substr(0, importPrefix.length + 1) === `${importPrefix}.`) {
        return imports[importPrefix][path.substr(importPrefix.length + 1, path.length)];
    }
    // Check if this is a top level import
    if (importNames.indexOf(path) > -1) {
        return imports[path];
    }

    let pathSections = path.split('/');
    let fileName = pathSections[pathSections.length - 1];

    // Check the file extension
    if (fileName.substr(-3) === '.js') {
        fileName = fileName.substr(0, fileName.length - 3);
    } else {
        path += '.js';
    }
    // Check relative paths
    if (fileName[0] === '.' || path[0] !== '/') {
        path = path.replace(/\.\//g, '');
        if (dir) {
            path = `${dir}/${path}`;
        }
    }

    if (!async) {
        return createExports({path, dir, fileName, meta, returnIndex});
    }
    return new Promise(function(resolve, reject) {
        try {
            resolve(createExports({path, dir, fileName, meta, returnIndex, reject}));
        } catch (e) {
            reject(e);
        }
    });
}