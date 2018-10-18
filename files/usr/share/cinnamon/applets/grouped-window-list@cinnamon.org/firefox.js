/* jshint moz:true */
let Gda;
const GLib = imports.gi.GLib;

const {tryFn} = require('./utils');

tryFn(function() {
    Gda = imports.gi.Gda;
});

function getFirefoxHistory(applet) {
    let history = [];

    if (!Gda) {
        return null;
    }

    let cfgPath = GLib.build_filenamev([GLib.get_home_dir(), '.mozilla', 'firefox']);

    let iniPath = GLib.build_filenamev([cfgPath, 'profiles.ini']);

    let profilePath;

    if (GLib.file_test(iniPath, GLib.FileTest.EXISTS)) {
        let iniFile = new GLib.KeyFile();
        let groups, nGroups;

        iniFile.load_from_file(iniPath, GLib.KeyFileFlags.NONE);

        [groups, nGroups] = iniFile.get_groups();

        for (let i = 0; i < nGroups; i++) {
            let isRelative, profileName, profileDir;

            let hadException = tryFn(
                function() {
                    isRelative = iniFile.get_integer(groups[i], 'IsRelative');
                    profileName = iniFile.get_string(groups[i], 'Name');
                    profileDir = iniFile.get_string(groups[i], 'Path');
                },
                function() {
                    return true;
                }
            );

            if (hadException === true) {
                continue;
            }

            if (profileName === 'default') {
                if (isRelative) {
                    profilePath = GLib.build_filenamev([cfgPath, profileDir]);
                } else {
                    profilePath = profileDir;
                }
            }
        }
    }

    if (!profilePath) {
        return history;
    }

    let filePath = GLib.build_filenamev([profilePath, 'places.sqlite']);

    if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
        return history;
    }

    var con, result;

    let hadException = tryFn(
        function() {
            con = Gda.Connection.open_from_string(
                'SQLite',
                'DB_DIR=' + profilePath + ';DB_NAME=places.sqlite',
                null,
                Gda.ConnectionOptions.READ_ONLY
            );
        },
        function() {
            return history;
        }
    );

    if (hadException != null) {
        return hadException;
    }

    hadException = tryFn(
        function() {
            if (applet.firefoxMenu === 1) {
                result = con.execute_select_command(
                    'SELECT title,url FROM moz_places WHERE title IS NOT NULL ORDER BY visit_count DESC'
                );
            } else if (applet.firefoxMenu === 2) {
                result = con.execute_select_command(
                    'SELECT title,url FROM moz_places WHERE title IS NOT NULL ORDER BY last_visit_date DESC'
                );
            } else {
                result = con.execute_select_command(
                    'SELECT moz_bookmarks.title,moz_places.url FROM (moz_bookmarks INNER JOIN moz_places ON moz_bookmarks.fk=moz_places.id) WHERE moz_bookmarks.parent IS NOT 1 AND moz_bookmarks.parent IS NOT 2 AND moz_bookmarks.title IS NOT NULL ORDER BY moz_bookmarks.lastModified DESC'
                );
            }
        },
        function() {
            con.close();
            return history;
        }
    );

    if (hadException != null) {
        return hadException;
    }

    let nRows = result.get_n_rows();
    let num = applet.appMenuNum;
    if (nRows > num) {
        nRows = num;
    }

    for (let row = 0; row < nRows; row++) {
        let title, uri;

        try {
            title = result.get_value_at(0, row);
            uri = result.get_value_at(1, row);
        } catch (e) {
            continue;
        }
        history.push({
            uri: uri,
            title: title
        });
    }

    con.close();
    return history;
}

module.exports = getFirefoxHistory;
