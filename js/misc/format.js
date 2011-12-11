// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

/*
 * This function is intended to extend the String object and provide
 * an String.format API for string formatting.
 * It has to be set up using String.prototype.format = Format.format;
 * Usage:
 * "somestring %s %d".format('hello', 5);
 * It supports %s, %d, %x and %f, for %f it also support precisions like
 * "%.2f".format(1.526). All specifiers can be prefixed with a minimum
 * field width, e.g. "%5s".format("foo"). Unless the width is prefixed
 * with '0', the formatted string will be padded with spaces.
 */

function format() {
    let str = this;
    let i = 0;
    let args = arguments;

    return str.replace(/%([0-9]+)?(?:\.([0-9]+))?(.)/g, function (str, widthGroup, precisionGroup, genericGroup) {

                    if (precisionGroup != '' && genericGroup != 'f')
                        throw new Error("Precision can only be specified for 'f'");

                    let fillChar = (widthGroup[0] == '0') ? '0' : ' ';
                    let width = parseInt(widthGroup, 10) || 0;

                    function fillWidth(s, c, w) {
                        let fill = '';
                        for (let i = 0; i < w; i++)
                            fill += c;
                        return fill.substr(s.length) + s;
                    }

                    let s = '';
                    switch (genericGroup) {
                        case '%':
                            return '%';
                            break;
                        case 's':
                            s = args[i++].toString();
                            break;
                        case 'd':
                            s = parseInt(args[i++]).toString();
                            break;
                        case 'x':
                            s = parseInt(args[i++]).toString(16);
                            break;
                        case 'f':
                            if (precisionGroup == '')
                                s = parseFloat(args[i++]).toString();
                            else
                                s = parseFloat(args[i++]).toFixed(parseInt(precisionGroup));
                            break;
                        default:
                            throw new Error('Unsupported conversion character %' + genericGroup);
                    }
                    return fillWidth(s, fillChar, width);
                });
}
