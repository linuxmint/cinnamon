// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const UI = imports.testcommon.ui;

// This is an interactive test of the sizing behavior of StScrollView. It
// may be interesting in the future to split out the two classes at the
// top into utility classes for testing the sizing behavior of other
// containers and actors.

/****************************************************************************/

// FlowedBoxes: This is a simple actor that demonstrates an interesting
// height-for-width behavior. A set of boxes of different sizes are line-wrapped
// horizontally with the minimum horizontal size being determined by the
// largest box. It would be easy to extend this to allow doing vertical
// wrapping instead, if you wanted to see just how badly our width-for-height
// implementation is or work on fixing it.

const BOX_HEIGHT = 20;
const BOX_WIDTHS = [
    10, 40, 100, 20, 60, 30, 70, 10, 20, 200, 50, 70, 90, 20, 40
];

const SPACING = 10;

function FlowedBoxes() {
    this._init();
}

FlowedBoxes.prototype = {
    _init: function() {
	this.actor = new Shell.GenericContainer();
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

	for (let i = 0; i < BOX_WIDTHS.length; i++) {
	    let child = new St.Bin({ width: BOX_WIDTHS[i], height: BOX_HEIGHT,
	                             style: 'border: 1px solid #444444; background: #00aa44' })
	    this.actor.add_actor(child);
	}
    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        let children = this.actor.get_children();

	let maxMinWidth = 0;
	let totalNaturalWidth = 0;

	for (let i = 0; i < children.length; i++) {
	    let child = children[i];
	    let [minWidth, naturalWidth] = child.get_preferred_width(-1);
	    maxMinWidth = Math.max(maxMinWidth, minWidth);
	    if (i != 0)
		totalNaturalWidth += SPACING;
	    totalNaturalWidth += naturalWidth;
	}

	alloc.min_size = maxMinWidth;
	alloc.natural_size = totalNaturalWidth;
    },

    _layoutChildren: function(forWidth, callback) {
        let children = this.actor.get_children();

	let x = 0;
	let y = 0;
	for (let i = 0; i < children.length; i++) {
	    let child = children[i];
	    let [minWidth, naturalWidth] = child.get_preferred_width(-1);
	    let [minHeight, naturalHeight] = child.get_preferred_height(naturalWidth);

	    let x1 = x;
	    if (x != 0)
		x1 += SPACING;
	    let x2 = x1 + naturalWidth;

	    if (x2 > forWidth) {
		if (x > 0) {
	            x1 = 0;
		    y += BOX_HEIGHT + SPACING;
                }

                x2 = naturalWidth;
	    }

	    callback(child, x1, y, x2, y + naturalHeight);
	    x = x2;
	}

    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
	let height = 0;
	this._layoutChildren(forWidth,
           function(child, x1, y1, x2, y2) {
	       height = Math.max(height, y2);
	   });

	alloc.min_size = alloc.natural_size = height;
    },

    _allocate: function (actor, box, flags) {
	this._layoutChildren(box.x2 - box.x1,
           function(child, x1, y1, x2, y2) {
	       child.allocate(new Clutter.ActorBox({ x1: x1, y1: y1, x2: x2, y2: y2 }),
			      flags);
	   });
    }
};

/****************************************************************************/

// SizingIllustrator: this is a container that allows interactively exploring
// the sizing behavior of the child. Lines are drawn to indicate the minimum
// and natural size of the child, and a drag handle allows the user to resize
// the child interactively and see how that affects it.
//
// This is currently only written for the case where the child is height-for-width

function SizingIllustrator() {
    this._init();
}

SizingIllustrator.prototype = {
    _init: function() {
	this.actor = new Shell.GenericContainer();

        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

	this.minWidthLine = new St.Bin({ style: 'background: red' });
	this.actor.add_actor(this.minWidthLine);
	this.minHeightLine = new St.Bin({ style: 'background: red' });
	this.actor.add_actor(this.minHeightLine);

	this.naturalWidthLine = new St.Bin({ style: 'background: #4444ff' });
	this.actor.add_actor(this.naturalWidthLine);
	this.naturalHeightLine = new St.Bin({ style: 'background: #4444ff' });
	this.actor.add_actor(this.naturalHeightLine);

	this.currentWidthLine = new St.Bin({ style: 'background: #aaaaaa' });
	this.actor.add_actor(this.currentWidthLine);
	this.currentHeightLine = new St.Bin({ style: 'background: #aaaaaa' });
	this.actor.add_actor(this.currentHeightLine);

	this.handle = new St.Bin({ style: 'background: yellow; border: 1px solid black;',
				   reactive: true });
	this.handle.connect('button-press-event', Lang.bind(this, this._handlePressed));
	this.handle.connect('button-release-event', Lang.bind(this, this._handleReleased));
	this.handle.connect('motion-event', Lang.bind(this, this._handleMotion));
	this.actor.add_actor(this.handle);

	this._inDrag = false;

	this.width = 300;
	this.height = 300;
    },

    add: function(child) {
	this.child = child;
	this.actor.add_actor(this.child);
	this.child.lower_bottom();
    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        let children = this.actor.get_children();
	for (let i = 0; i < children.length; i++) {
	    let child = children[i];
	    let [minWidth, naturalWidth] = child.get_preferred_width(-1);
	    if (child == this.child) {
		this.minWidth = minWidth;
		this.naturalWidth = naturalWidth;
	    }
	}

	alloc.min_size = 0;
	alloc.natural_size = 400;
    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
        let children = this.actor.get_children();
	for (let i = 0; i < children.length; i++) {
	    let child = children[i];
	    if (child == this.child) {
		[this.minHeight, this.naturalHeight] = child.get_preferred_height(this.width);
	    } else {
		let [minWidth, naturalWidth] = child.get_preferred_width(-1);
		child.get_preferred_height(naturalWidth);
	    }
	}

	alloc.min_size = 0;
	alloc.natural_size = 400;
    },

    _allocate: function (actor, box, flags) {
	let allocWidth = box.x2 - box.x1;
	let allocHeight = box.y2 - box.y1;

	function alloc(child, x1, y1, x2, y2) {
	    child.allocate(new Clutter.ActorBox({ x1: x1, y1: y1, x2: x2, y2: y2 }),
	                   flags);
	}

	alloc(this.child, 0, 0, this.width, this.height);
	alloc(this.minWidthLine, this.minWidth, 0, this.minWidth + 1, allocHeight);
	alloc(this.naturalWidthLine, this.naturalWidth, 0, this.naturalWidth + 1, allocHeight);
	alloc(this.currentWidthLine, this.width, 0, this.width + 1, allocHeight);
	alloc(this.minHeightLine, 0, this.minHeight, allocWidth, this.minHeight + 1);
	alloc(this.naturalHeightLine, 0, this.naturalHeight, allocWidth, this.naturalHeight + 1);
	alloc(this.currentHeightLine, 0, this.height, allocWidth, this.height + 1);
	alloc(this.handle, this.width, this.height, this.width + 10, this.height + 10);
    },

    _handlePressed: function(handle, event) {
	if (event.get_button() == 1) {
	    this._inDrag = true;
	    let [handleX, handleY] = handle.get_transformed_position();
	    let [x, y] = event.get_coords();
	    this._dragX = x - handleX;
	    this._dragY = y - handleY;
	    Clutter.grab_pointer(handle);
	}
    },

    _handleReleased: function(handle, event) {
	if (event.get_button() == 1) {
	    this._inDrag = false;
	    Clutter.ungrab_pointer(handle);
	}
    },

    _handleMotion: function(handle, event) {
	if (this._inDrag) {
	    let [x, y] = event.get_coords();
	    let [actorX, actorY] = this.actor.get_transformed_position();
	    this.width = x - this._dragX - actorX;
	    this.height = y - this._dragY - actorY;
	    this.actor.queue_relayout();
	}
    }
};

/****************************************************************************/

UI.init();
let stage = Clutter.Stage.get_default();
stage.width = 600;
stage.height = 600;

let mainBox = new St.BoxLayout({ width: stage.width,
				 height: stage.height,
				 vertical: true,
			         style: 'padding: 10px;'
                                        + 'spacing: 5px;'
                                        + 'font: 16px sans-serif;'
                                        + 'background: black;'
                                        + 'color: white;' });
stage.add_actor(mainBox);

const DOCS = 'Red lines represent minimum size, blue lines natural size. Drag yellow handle to resize ScrollView. Click on options to change.';

let docsLabel = new St.Label({ text: DOCS });
docsLabel.clutter_text.line_wrap = true;
mainBox.add(docsLabel);

let bin = new St.Bin({ x_fill: true, y_fill: true, style: 'border: 2px solid #666666;' });
mainBox.add(bin, { x_fill: true, y_fill: true, expand: true });

let illustrator = new SizingIllustrator();
bin.add_actor(illustrator.actor);

let scrollView = new St.ScrollView();
illustrator.add(scrollView);

let box = new St.BoxLayout({ vertical: true });
scrollView.add_actor(box);

let flowedBoxes = new FlowedBoxes();
box.add(flowedBoxes.actor, { expand: false, x_fill: true, y_fill: true });

let policyBox = new St.BoxLayout({ vertical: false });
mainBox.add(policyBox);

policyBox.add(new St.Label({ text: 'Horizontal Policy: ' }));
let hpolicy = new St.Button({ label: 'AUTOMATIC', style: 'text-decoration: underline; color: #4444ff;' });
policyBox.add(hpolicy);

let spacer = new St.Bin();
policyBox.add(spacer, { expand: true });

policyBox.add(new St.Label({ text: 'Vertical Policy: '}));
let vpolicy = new St.Button({ label: 'AUTOMATIC', style: 'text-decoration: underline; color: #4444ff;' });
policyBox.add(vpolicy);

function togglePolicy(button) {
    switch(button.label) {
    case 'AUTOMATIC':
	button.label = 'ALWAYS';
	break;
    case 'ALWAYS':
	button.label = 'NEVER';
	break;
    case 'NEVER':
	button.label = 'AUTOMATIC';
	break;
    }
    scrollView.set_policy(Gtk.PolicyType[hpolicy.label], Gtk.PolicyType[vpolicy.label]);
}

hpolicy.connect('clicked', function() { togglePolicy(hpolicy); });
vpolicy.connect('clicked', function() { togglePolicy(vpolicy); });

let fadeBox = new St.BoxLayout({ vertical: false });
mainBox.add(fadeBox);

spacer = new St.Bin();
fadeBox.add(spacer, { expand: true });

fadeBox.add(new St.Label({ text: 'Padding: '}));
let paddingButton = new St.Button({ label: 'No', style: 'text-decoration: underline; color: #4444ff;padding-right:3px;' });
fadeBox.add(paddingButton);

fadeBox.add(new St.Label({ text: 'Borders: '}));
let borderButton = new St.Button({ label: 'No', style: 'text-decoration: underline; color: #4444ff;padding-right:3px;' });
fadeBox.add(borderButton);

fadeBox.add(new St.Label({ text: 'Vertical Fade: '}));
let vfade = new St.Button({ label: 'No', style: 'text-decoration: underline; color: #4444ff;' });
fadeBox.add(vfade);

function togglePadding(button) {
    switch(button.label) {
    case 'No':
	button.label = 'Yes';
	break;
    case 'Yes':
	button.label = 'No';
	break;
    }
    if (scrollView.style == null)
        scrollView.style = (button.label == 'Yes' ? 'padding: 10px;' : 'padding: 0;');
    else
        scrollView.style += (button.label == 'Yes' ? 'padding: 10px;' : 'padding: 0;');
}

paddingButton.connect('clicked', function() { togglePadding(paddingButton); });

function toggleBorders(button) {
    switch(button.label) {
    case 'No':
	button.label = 'Yes';
	break;
    case 'Yes':
	button.label = 'No';
	break;
    }
    if (scrollView.style == null)
        scrollView.style = (button.label == 'Yes' ? 'border: 2px solid red;' : 'border: 0;');
    else
        scrollView.style += (button.label == 'Yes' ? 'border: 2px solid red;' : 'border: 0;');
}

borderButton.connect('clicked', function() { toggleBorders(borderButton); });

function toggleFade(button) {
    switch(button.label) {
    case 'No':
	button.label = 'Yes';
	break;
    case 'Yes':
	button.label = 'No';
	break;
    }
    scrollView.set_style_class_name(button.label == 'Yes' ? 'vfade' : '');
}

vfade.connect('clicked', function() { toggleFade(vfade); });

stage.show();
Clutter.main();
stage.destroy();
