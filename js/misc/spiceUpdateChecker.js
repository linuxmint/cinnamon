#!/usr/bin/cjs
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;

const URL_SPICES_HOME = 'http://cinnamon-spices.linuxmint.com';
let urls = {
    applets: URL_SPICES_HOME + '/json/applets.json',
    extensions: URL_SPICES_HOME + '/json/extensions.json',
    desklets: URL_SPICES_HOME + '/json/desklets.json',
    themes: URL_SPICES_HOME + '/json/themes.json'
};

const xletTypes = ['applets', 'desklets', 'extensions'];
const loop = GLib.MainLoop.new(null, false);

const readDirSync = (path) => {
    let [success, output] = GLib.spawn_sync(
        path,
        `bash -c ls -a ${path}`.split(' '),
        null,
        GLib.SpawnFlags.SEARCH_PATH,
        null
    );

    if (success) {
        return output
            .toString()
            .split('\n')
            .filter(uuid => uuid.length > 0);
    }
    return null;
}

const getXletMetaData = (path, uuids) => {
    let metaDataObjects = [];
    for (let i = 0; i < uuids.length; i++) {

        let fd = Gio.File.new_for_path(path + '/' + uuids[i] + '/metadata.json');

        if (fd.query_exists(null)) {
            let [success, json] = fd.load_contents(null);
            try {
                if (!success) {
                  throw new Error();
                }
                metaDataObjects.push(JSON.parse(json));
            } catch (e) {
                print(e);
                continue;
            }
        }
    }
    return metaDataObjects;
};

const getInstalledXlets = () => {
    let localCinnamonPath = GLib.get_home_dir() + '/.local/share/cinnamon/';
    let installed = {};

    for (let i = 0; i < xletTypes.length; i++) {
        let path = localCinnamonPath + xletTypes[i];
        let fd = Gio.File.new_for_path(path);

        if (fd.query_exists(null)) {
            installed[xletTypes[i]] = getXletMetaData(path, readDirSync(path));
        }
    }
    return installed;
};

const checkSpices = () => {
    let installed = getInstalledXlets();
    let uuid = null;
    let type = null;
    let metaData = null;

    for (let i = 0; i < ARGV.length; i++) {
        if (ARGV[i].indexOf('--uuid=') > -1) {
            uuid = ARGV[i].split('--uuid=')[1];
        }
    }

    for (let i = 0; i < xletTypes.length; i++) {
        let shouldBreak = false;
        for (let z = 0; z < installed[xletTypes[i]].length; z++) {
            if (installed[xletTypes[i]][z].uuid === uuid) {
                metaData = installed[xletTypes[i]][z];
                type = xletTypes[i];
                shouldBreak = true;
                break;
            }
        }
        if (shouldBreak) {
            break;
        }
    }

    let httpSession = new Soup.SessionAsync();
    httpSession.user_agent = 'UPDATE_CHECK/API';
    let request = Soup.Message.new('GET', urls[type]);

    Soup.Session.prototype.add_feature.call(httpSession, new Soup.ProxyResolverDefault());
    Soup.Session.prototype.add_feature.call(httpSession, new Soup.ContentDecoder());
    httpSession.queue_message(request, (session, message)=>{
        let response = JSON.parse(message.response_body.data);
        try {
            if (response.hasOwnProperty(uuid)
                && response[uuid]['last_edited'] > metaData['last-edited']) {
                print('true');
                loop.quit()
                return;
            } else {
                print('false');
                loop.quit();
                return;
            }
        } catch (e) {
            print('false');
            loop.quit();
            return;
        }
    });
    loop.run();
};

checkSpices();