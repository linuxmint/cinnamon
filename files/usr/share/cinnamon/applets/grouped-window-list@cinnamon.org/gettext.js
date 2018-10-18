const Gettext = imports.gettext;
function t(str) {
    var resultConf = Gettext.dgettext('IcingTaskManager@json', str);
    if (resultConf != str) {
        return resultConf;
    }
    return Gettext.gettext(str);
}

module.exports = t;
