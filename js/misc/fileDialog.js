const Util = imports.misc.util;
const GLib = imports.gi.GLib;

function open(callback, params) {
	_launchDialog(0, callback, params);
}

function openFolder(callback, params) {
	_launchDialog(1, callback, params);
}

function save(callback, params) {
	_launchDialog(2, callback, params);
}

function _launchDialog(type, callback, params) {
	let args = ["cinnamon-file-dialog"];
	if (params.selectMultiple) type += 3; //add 3 to use the select-multiple version
	args.push(String(type));
	if (params.path) args.push("-p", params.path.replace(/~/, GLib.get_home_dir()));
	if (params.name) args.push("-n", params.name);
	if (params.directory) args.push("-d", params.directory.replace(/~/, GLib.get_home_dir()));
	if (params.filters) {
		let filterList = [];
		for (let i = 0; i < params.filters.length; i++) {
			filterList.push(params.filters[i].getString());
		}
		args.push("-f", filterList.join(","));
	}
	Util.spawn_async(args, callback);
}

function Filter(name) {
	this._init(name);
}

Filter.prototype = {
	_init: function(name) {
		this.name = name;
		this.rules = [];
	},

	addMimeType: function(mime) {
		this.rules.push("m="+mime);
	},

	addPattern: function(pattern) {
		this.rules.push("p="+pattern);
	},

	getString: function() {
		return this.name + ";" + this.rules.join(":");
	}
}