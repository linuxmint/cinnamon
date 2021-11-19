// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

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
var giImportNames = imports.gi.GIRepository.Repository
    .get_default()
    .get_loaded_namespaces();
var LoadedModules = [];
var FunctionConstructor = Symbol();
var Symbols = {};
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
                allFiles = [...allFiles, ...files];
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
            let lines = ByteArray.toString(data[1]).split("\n");
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
    let indexes = [];
    for (let i = 0; i < LoadedModules.length; i++) {
        if (LoadedModules[i] && LoadedModules[i].dir === LoadedModules[index].dir) {
            indexes.push(i);
        }
    }
    for (var i = 0; i < indexes.length; i++) {
        LoadedModules[indexes[i]].module = undefined;
        LoadedModules[indexes[i]].size = -1;
    }
}

function createExports({path, dir, meta, type, file, size, JS, returnIndex, reject}) {
    // Import data is stored in an array of objects and the module index is looked up by path.
    let importerData = {
        size,
        path,
        dir,
        module: null
    };
    // module.exports as an object holding a module's namespaces is a node convention, and is intended
    // to help interop with other libraries.
    const exports = {};
    const module = {
        exports: exports
    };

    // Storing by array index that other extension classes can look up.
    let moduleIndex = findModuleIndex(path);
    if (moduleIndex > -1) {
        // Module already exists, check if its been updated
        if (size === LoadedModules[moduleIndex].size
            && LoadedModules[moduleIndex].module != null) {
            // Return the cache
            return returnIndex ? moduleIndex : LoadedModules[moduleIndex].module;
        }
        // Module has been updated
        LoadedModules[moduleIndex] = importerData;
    } else {
        LoadedModules.push(importerData);
        moduleIndex = LoadedModules.length - 1;
    }

    JS = `'use strict';${JS};`;
    // Regex matches the top level variable names, and appends them to the module.exports object,
    // mimicking the native CJS importer.
    const exportsRegex = /^module\.exports(\.[a-zA-Z0-9_$]+)?\s*=/m;
    const varRegex = /^(?:'use strict';){0,}(const|var|let|function|class)\s+([a-zA-Z0-9_$]+)/gm;
    let match;

    if (!exportsRegex.test(JS)) {
        while ((match = varRegex.exec(JS)) != null) {
            if (match.index === varRegex.lastIndex) {
                varRegex.lastIndex++;
            }
            // Don't modularize native imports
            if (match[2]
                && importNames.indexOf(match[2].toLowerCase()) === -1
                && giImportNames.indexOf(match[2]) === -1) {
                JS += `exports.${match[2]} = typeof ${match[2]} !== 'undefined' ? ${match[2]} : null;`;
            }
        }
    }

    // send_results is overridden in SearchProviderManager, so we need to make sure the send_results
    // function on the exports object, what SearchProviderManager actually has access to outside the
    // module scope, is called.
    if (type === 'search_provider') {
        JS += 'var send_results = function() {exports.send_results.apply(this, arguments)};' +
            'var get_locale_string = function() {return exports.get_locale_string.apply(this, arguments)};';
    }

    // Return the exports object containing all of our top level namespaces, and include the sourceURL so
    // Spidermonkey includes the file names in stack traces.
    JS += `return module.exports;//# sourceURL=${path}`;

    try {
        // Create the function returning module.exports and return it to Extension so it can be called by the
        // appropriate manager.
        importerData.module = Symbols[FunctionConstructor](
            'require',
            'exports',
            'module',
            '__meta',
            '__dirname',
            '__filename',
            JS
        ).call(
            exports,
            function require(path) {
                return requireModule(path, dir, meta, type);
            },
            exports,
            module,
            meta,
            dir,
            file.get_basename()
        );

        return returnIndex ? moduleIndex : importerData.module;
    } catch (e) {
        if (reject) {
            reject(e);
            return;
        }
        throw e;
    }
}

function requireModule(path, dir, meta, type, async = false, returnIndex = false) {
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
    // Check the file extension
    if (path.substr(-3) !== '.js') {
        path += '.js';
    }
    // Check relative paths
    if (path[0] === '.' || path[0] !== '/') {
        path = path.replace(/\.\//g, '');
        if (dir) {
            path = dir + "/" + path;
        }
    }
    let success, JSbytes, JS;
    let file = Gio.File.new_for_commandline_arg(path);
    let fileLoadErrorMessage = '[requireModule] Unable to load file contents.';
    if (!file.query_exists(null)) {
        throw new Error("[requireModule] Path does not exist.\n" + path);
    }

    if (!async) {
        [success, JSbytes] = file.load_contents(null);
        if (!success) {
            throw new Error(fileLoadErrorMessage);
        }
        JS = ByteArray.toString(JSbytes);
        return createExports({path, dir, meta, type, file, size: JS.length, JS, returnIndex});
    }
    return new Promise(function(resolve, reject) {
        file.load_contents_async(null, function(object, result) {
            try {
                [success, JSbytes] = file.load_contents_finish(result);
                if (!success) {
                    throw new Error(fileLoadErrorMessage);
                }
                JS = ByteArray.toString(JSbytes);
                resolve(createExports({path, dir, meta, type, file, size: JS.length, JS, returnIndex, reject}));
            } catch (e) {
                reject(e);
            }
        });
    });
}
