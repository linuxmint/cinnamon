const fs = require('fs');
const os = require('os');
const gulp = require('gulp');
const clear = require('clear');
const {exec} = require('child_process');

const getArgs = function() {
    const argv = require('yargs')
    .option('uuid', {
        alias: 'u'
    })
    .option('type', {
        alias: 't'
    })
    .argv;

    const UUID = argv.u;
    const TYPE = argv.t;

    if (!UUID) {
        throw new Error('Unable to get the UUID.');
    }

    if (!TYPE) {
        throw new Error('Unable to get the xlet type.');
    }

    return [UUID, TYPE];
}

gulp.task('install', (done) => {
    const [UUID, TYPE] = getArgs();
    const systemXletDir = `/usr/share/cinnamon/${TYPE}s/${UUID}/`;
    const localXletDir = `./files${systemXletDir}`;
    const systemDirExists = fs.existsSync(systemXletDir);
    const localDirExists = fs.existsSync(localXletDir);

    const {uid, gid} = fs.statSync(systemXletDir);
    const userInfo = os.userInfo();

    if (!systemDirExists) {
        throw new Error('Xlet does not exist in the system directory.');
    }

    if (!localDirExists) {
        throw new Error('Xlet does not exist in the local directory.');
    }

    if (uid !== userInfo.uid || gid !== userInfo.gid) {
        throw new Error(`Incorrect permission are set for the system directory. Please run 'gulp spawn-watch help'.`);
    }

    exec(`rm -rf ${systemXletDir} && ` +
        `cp -arf ${localXletDir} /usr/share/cinnamon/${TYPE}s`,
        function(err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            done();
        }
    );
});

const reload = function(done) {
    const [UUID, TYPE] = getArgs();
    exec(
        'dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call '
        + '/org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension '
        + `string:'${UUID}' string:'${TYPE.toUpperCase()}'`,
        function(err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            done();
        }
    );
};

gulp.task('reload', gulp.series('install', reload));

gulp.task('watch', (done) => {
    const [UUID, TYPE] = getArgs();
    const glob = `./files/usr/share/cinnamon/${TYPE}s/${UUID}/**/**/*.{js,json,py,css,po}`;
    console.log(`Watching glob pattern: ${glob}`)
    gulp.watch(glob)
    .on('change', gulp.parallel('reload'));
    done();
});

gulp.task('clear-terminal', (done) => {
    clear();
    done();
});

gulp.task('spawn-watch', gulp.series('clear-terminal', (done) => {
    let [, , , uuid, type] = process.argv;
    let spawnWatch = () => {
        let proc = require('child_process').spawn('gulp', ['watch', uuid, type], {stdio: 'inherit'});
        proc.on('close', function(code) {
            spawnWatch();
        });
    };
    spawnWatch();
    done();
}));

gulp.task('help', gulp.series('clear-terminal', (done) => {
    console.log(
        `Usage: gulp spawn-watch [flags]

        This file uses gulp to provide a watch task for xlet development.
        It will copy the xlet files to /usr/share/cinnamon and auto-reload
        the applet on code change.

        Install gulp globally.

        npm: 'npm install -g gulp@^4.0.0'
        yarn: 'yarn global add gulp@^4.0.0'

        You must give your user ownership of /usr/share/cinnamon.

        To do that, run: 'sudo chown -R $USER:$USER /usr/share/cinnamon'

        To use this script, run 'gulp spawn-watch --uuid="<xlet uuid>" --type="<xlet type>"'.
        Example: 'gulp spawn-watch --uuid="grouped-window-list@cinnamon.org" --type="applet"'

        Options:
            --uuid                 UUID of the xlet to watch.
            --type                 Type of the xlet
        `
    );
    process.exit(0);
    done();
}));

gulp.task('default', gulp.series('spawn-watch', (done) => done()));