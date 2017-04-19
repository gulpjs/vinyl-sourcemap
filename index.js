'use strict';

var File = require('vinyl');
var defaults = require('object.defaults');
var normalizePath = require('normalize-path');

var helpers = require('./lib/helpers');

var PLUGIN_NAME = 'vinyl-sourcemap';

function isObject(value) {
	return value && typeof value === 'object' && !Array.isArray(value);
}

function add(file, options, callback) {

	// Check if options or a callback are passed as second argument
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}

	// Default options if not an object
	if (!isObject(options)) {
		options = {};
	}

	// Bail early an error if the file argument is not a Vinyl file
	if (!File.isVinyl(file)) {
		return callback(new Error(PLUGIN_NAME + '-add: Not a vinyl file'));
	}

	// Bail early successfully if file already has sourcemap
	if (file.sourceMap) {
		return callback(null, file);
	}

	var state = {
		path: '', //root path for the sources in the map
		map: null,
		content: file.contents.toString(),
		preExistingComment: null
	};

	helpers.addSourceMaps(file, state, callback);
}

function write(file, options, callback) {

	// Check if options or a callback are passed as second argument
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}

	// Default options if not an object
	if (!isObject(options)) {
		options = {};
	}

	// Bail early with an error if the file argument is not a Vinyl file
	if (!File.isVinyl(file)) {
		return callback(new Error(PLUGIN_NAME + '-write: Not a vinyl file'));
	}

	// Bail early with an error if file has streaming contents
	// TODO: needs test
	if (file.isStream()) {
		return callback(new Error(PLUGIN_NAME + '-write: Streaming not supported'));
	}

	// Bail early successfully if file is null or doesn't have sourcemap
	// TODO: needs test (at least for null contents?)
	if (file.isNull() || !file.sourceMap) {
		return callback(null, file);
	}

	// Set defaults for options if unset
	var opts = defaults({}, options, {
		includeContent: true,
	});

	var sourceMap = file.sourceMap;

	// fix paths if Windows style paths
	// TODO: should we be normalizing at all?
	// An end-user can use @gulp-sourcemaps/map-file if they need normalization
	sourceMap.file = normalizePath(file.relative);

	// TODO: should we be normalizing at all?
	// An end-user can use @gulp-sourcemaps/map-sources if they need normalization
	sourceMap.sources = sourceMap.sources.map(function(filePath) {
		return normalizePath(filePath);
	});

	// A function option here would have already been resolved higher up
	// TODO: need a test for this being unset by not being defined
	sourceMap.sourceRoot = options.sourceRoot;

	// TODO: support null-ish with ==
	if (sourceMap.sourceRoot === null) {
		sourceMap.sourceRoot = undefined;
	}

	var state = {
		destPath: opts.path,
		sourceMap: sourceMap,
		sourceMapFile: null,
	};

	helpers.writeSourceMaps(file, state, opts, callback);
}

module.exports = {
	add: add,
	write: write,
};
