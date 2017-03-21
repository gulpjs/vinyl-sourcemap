'use strict';

var File = require('vinyl');

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

	if (options.loadMaps) {
		helpers.loadInlineMaps(file, state);
	}

	helpers.addSourceMaps(file, state, options, callback);
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

	// TODO: don't mutate - needs test too
	// set defaults for options if unset
	if (options.includeContent === undefined) {
		options.includeContent = true;
	}
	if (options.addComment === undefined) {
		options.addComment = true;
	}

	var sourceMap = file.sourceMap;

	// fix paths if Windows style paths
	sourceMap.file = helpers.unixStylePath(file.relative);

	// TODO: Need a way to handle resolve this before passing in
	// This module shouldn't be taking function options because they are normalized higher
	if (options.mapSources && typeof options.mapSources === 'function') {
		sourceMap.sources = sourceMap.sources.map(function(filePath) {
			return options.mapSources(filePath);
		});
	}

	sourceMap.sources = sourceMap.sources.map(function(filePath) {
		return helpers.unixStylePath(filePath);
	});

	// A function option here would have already been resolved higher up
	// TODO: need a test for this being unset by not being defined
	sourceMap.sourceRoot = options.sourceRoot;

	// TODO: support null-ish with ==
	if (sourceMap.sourceRoot === null) {
		sourceMap.sourceRoot = undefined;
	}

	var state = {
		destPath: options.path,
		sourceMap: sourceMap,
		sourceMapFile: null,
	};

	helpers.writeSourceMaps(file, state, options, callback);
}

module.exports = {
	add: add,
	write: write,
};
