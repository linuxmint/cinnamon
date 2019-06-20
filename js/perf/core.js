// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const {get_monotonic_time} = imports.gi.GLib;

/**
 * benchmarkPrototype:
 * @object (object): JS class.
 * @threshold (number): The minimum latency of interest.
 *
 * This uses a proxy to intercept and time function invocations within a given @object.
 */
function benchmarkPrototype(object, threshold = 3) {
    let keys = Object.getOwnPropertyNames(object.prototype);
    let times = [];
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let fn = object.prototype[key];
        if (typeof fn !== 'function') {
            continue;
        }
        object.prototype[key] = new Proxy(fn, {
            apply(target, thisA, args) {
                let now = get_monotonic_time();
                let val = target.apply(thisA, args);
                let time = get_monotonic_time() - now;
                if (time >= threshold) {
                    times.push(time);
                    let total = 0;
                    for (let z = 0; z < times.length; z++) total += times[z];

                    let max = (Math.max(...times) / 1000).toFixed(2);
                    let avg = ((total / times.length) / 1000).toFixed(2);
                    time = (time / 1000).toFixed(2);

                    let output = `${thisA.constructor.name}.${key}: ${time}ms `
                        + `(MAX: ${max}ms AVG: ${avg}ms)`;
                    global.log(output)
                }
                return val;
            }
        });
    }
}
