// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

// Test cases for MessageTray markup parsing

const JsUnit = imports.jsUnit;
const Pango = imports.gi.Pango;

const Environment = imports.ui.environment;
Environment.init();

const MessageTray = imports.ui.messageTray;

// Assert that @input, assumed to be markup, gets "fixed" to @output,
// which is valid markup. If @output is null, @input is expected to
// convert to itself
function assertConverts(input, output) {
    if (!output)
        output = input;
    let fixed = MessageTray._fixMarkup(input, true);
    JsUnit.assertEquals(output, fixed);

    let parsed = false;
    try {
        Pango.parse_markup(fixed, -1, '');
        parsed = true;
    } catch (e) {}
    JsUnit.assertEquals(true, parsed);
}

// Assert that @input, assumed to be plain text, gets escaped to @output,
// which is valid markup.
function assertEscapes(input, output) {
    let fixed = MessageTray._fixMarkup(input, false);
    JsUnit.assertEquals(output, fixed);

    let parsed = false;
    try {
        Pango.parse_markup(fixed, -1, '');
        parsed = true;
    } catch (e) {}
    JsUnit.assertEquals(true, parsed);
}



// CORRECT MARKUP

assertConverts('foo');
assertEscapes('foo', 'foo');

assertConverts('<b>foo</b>');
assertEscapes('<b>foo</b>', '&lt;b&gt;foo&lt;/b&gt;');

assertConverts('something <i>foo</i>');
assertEscapes('something <i>foo</i>', 'something &lt;i&gt;foo&lt;/i&gt;');

assertConverts('<u>foo</u> something');
assertEscapes('<u>foo</u> something', '&lt;u&gt;foo&lt;/u&gt; something');

assertConverts('<b>bold</b> <i>italic <u>and underlined</u></i>');
assertEscapes('<b>bold</b> <i>italic <u>and underlined</u></i>', '&lt;b&gt;bold&lt;/b&gt; &lt;i&gt;italic &lt;u&gt;and underlined&lt;/u&gt;&lt;/i&gt;');

assertConverts('this &amp; that');
assertEscapes('this &amp; that', 'this &amp;amp; that');

assertConverts('this &lt; that');
assertEscapes('this &lt; that', 'this &amp;lt; that');

assertConverts('this &lt; that &gt; the other');
assertEscapes('this &lt; that &gt; the other', 'this &amp;lt; that &amp;gt; the other');

assertConverts('this &lt;<i>that</i>&gt;');
assertEscapes('this &lt;<i>that</i>&gt;', 'this &amp;lt;&lt;i&gt;that&lt;/i&gt;&amp;gt;');

assertConverts('<b>this</b> > <i>that</i>');
assertEscapes('<b>this</b> > <i>that</i>', '&lt;b&gt;this&lt;/b&gt; &gt; &lt;i&gt;that&lt;/i&gt;');



// PARTIALLY CORRECT MARKUP
// correct bits are kept, incorrect bits are escaped

// unrecognized entity
assertConverts('<b>smile</b> &#9786;!', '<b>smile</b> &amp;#9786;!');
assertEscapes('<b>smile</b> &#9786;!', '&lt;b&gt;smile&lt;/b&gt; &amp;#9786;!');

// stray '&'; this is really a bug, but it's easier to do it this way
assertConverts('<b>this</b> & <i>that</i>', '<b>this</b> &amp; <i>that</i>');
assertEscapes('<b>this</b> & <i>that</i>', '&lt;b&gt;this&lt;/b&gt; &amp; &lt;i&gt;that&lt;/i&gt;');

// likewise with stray '<'
assertConverts('this < that', 'this &lt; that');
assertEscapes('this < that', 'this &lt; that');

assertConverts('<b>this</b> < <i>that</i>', '<b>this</b> &lt; <i>that</i>');
assertEscapes('<b>this</b> < <i>that</i>', '&lt;b&gt;this&lt;/b&gt; &lt; &lt;i&gt;that&lt;/i&gt;');

assertConverts('this < that > the other', 'this &lt; that > the other');
assertEscapes('this < that > the other', 'this &lt; that &gt; the other');

assertConverts('this <<i>that</i>>', 'this &lt;<i>that</i>>');
assertEscapes('this <<i>that</i>>', 'this &lt;&lt;i&gt;that&lt;/i&gt;&gt;');

// unknown tags
assertConverts('<unknown>tag</unknown>', '&lt;unknown>tag&lt;/unknown>');
assertEscapes('<unknown>tag</unknown>', '&lt;unknown&gt;tag&lt;/unknown&gt;');

// make sure we check beyond the first letter
assertConverts('<bunknown>tag</bunknown>', '&lt;bunknown>tag&lt;/bunknown>');
assertEscapes('<bunknown>tag</bunknown>', '&lt;bunknown&gt;tag&lt;/bunknown&gt;');

// with mix of good and bad, we keep the good and escape the bad
assertConverts('<i>known</i> and <unknown>tag</unknown>', '<i>known</i> and &lt;unknown>tag&lt;/unknown>');
assertEscapes('<i>known</i> and <unknown>tag</unknown>', '&lt;i&gt;known&lt;/i&gt; and &lt;unknown&gt;tag&lt;/unknown&gt;');



// FULLY INCORRECT MARKUP
// (fall back to escaping the whole thing)

// tags not matched up
assertConverts('<b>in<i>com</i>plete', '&lt;b&gt;in&lt;i&gt;com&lt;/i&gt;plete');
assertEscapes('<b>in<i>com</i>plete', '&lt;b&gt;in&lt;i&gt;com&lt;/i&gt;plete');

assertConverts('in<i>com</i>plete</b>', 'in&lt;i&gt;com&lt;/i&gt;plete&lt;/b&gt;');
assertEscapes('in<i>com</i>plete</b>', 'in&lt;i&gt;com&lt;/i&gt;plete&lt;/b&gt;');

// we don't support attributes, and it's too complicated to try
// to escape both start and end tags, so we just treat it as bad
assertConverts('<b>good</b> and <b style=\'bad\'>bad</b>', '&lt;b&gt;good&lt;/b&gt; and &lt;b style=&apos;bad&apos;&gt;bad&lt;/b&gt;');
assertEscapes('<b>good</b> and <b style=\'bad\'>bad</b>', '&lt;b&gt;good&lt;/b&gt; and &lt;b style=&apos;bad&apos;&gt;bad&lt;/b&gt;');

// this is just syntactically invalid
assertConverts('<b>unrecognized</b stuff>', '&lt;b&gt;unrecognized&lt;/b stuff&gt;');
assertEscapes('<b>unrecognized</b stuff>', '&lt;b&gt;unrecognized&lt;/b stuff&gt;');

// mismatched tags
assertConverts('<b>mismatched</i>', '&lt;b&gt;mismatched&lt;/i&gt;');
assertEscapes('<b>mismatched</i>', '&lt;b&gt;mismatched&lt;/i&gt;');

assertConverts('<b>mismatched/unknown</bunknown>', '&lt;b&gt;mismatched/unknown&lt;/bunknown&gt;');
assertEscapes('<b>mismatched/unknown</bunknown>', '&lt;b&gt;mismatched/unknown&lt;/bunknown&gt;');
