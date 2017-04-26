// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

/*
 * Test cases for the Format module
 */

const JsUnit = imports.jsUnit;
const assertEquals = JsUnit.assertEquals;
const assertRaises = JsUnit.assertRaises;

// We can't depend on environment.js to set up the String.prototype.format,
// because the tests  run in one JS context, and the imports run in the GJS
// "load context" which has its own copy of the String class
const Format = imports.format;
String.prototype.format = Format.format;

// Test common usage and %% handling
assertEquals("foo", "%s".format('foo'));
assertEquals("%s", "%%s".format('foo'));
assertEquals("%%s", "%%%%s".format('foo'));
assertEquals("foo 5", "%s %d".format('foo', 5));
assertEquals("8", "%d".format(8));
assertEquals("f", "%x".format(15));
assertEquals("2.58 6.96", "%f %.2f".format(2.58, 6.958));

// Test field width
assertEquals("007  foo", "%03d %4s".format(7, 'foo'));
assertEquals(" 2.58 06.96", "%5f %05.2f".format(2.58, 6.958));
assertEquals("cafe", "%2x".format(0xcafe));
assertEquals("foo", "%0s".format('foo'));

// Precision is only allowed for %f
assertRaises(function() { "%.2d".format(5.21) });

// Wrong conversion character ' '
assertRaises( function() { "%s is 50% done".format('foo') });
