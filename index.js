'use strict';

var File = require('vinyl');

var helpers = require('./lib/helpers');

var PLUGIN_NAME = 'vinyl-sourcemap';

/**
 * Add a sourcemap to a vinyl file (async, with callback function)
 * @param file
 * @param options
 * @param callback
 */
function add(file, options, callback) {

	// check if options are passed or a callback as second argument
	// if there are 3 arguments, the options param should be an object
	if (typeof options === 'function') {
		callback = options;
		options = {};
	} else if (!options || typeof options !== 'object') {
		return callback(new Error(PLUGIN_NAME + '-add: Invalid argument: options'));
	}

	// Throw an error if the file argument is not a vinyl file
	if (!File.isVinyl(file)) {
		return callback(new Error(PLUGIN_NAME + '-add: Not a vinyl file'));
	}

	// Return the file if already has sourcemaps
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

/**
 * Write the sourcemap (async, with callback function)
 * @param file
 * @param destPath
 * @param options
 * @param callback
 */
function write(file, destPath, options, callback) {

	// Check arguments for optional destPath, options, or callback function
	if (callback === undefined && typeof destPath === 'function') {
		callback = destPath;
		destPath = undefined;
	}	else if (callback === undefined && typeof options === 'function') {
		callback = options;
		if (Object.prototype.toString.call(destPath) === '[object Object]') {
			options = destPath;
			destPath = undefined;
		} else if (typeof destPath === 'string') {
			options = {};
		} else {
			return callback(new Error(PLUGIN_NAME + '-write: Invalid arguments'));
		}
	} else if (Object.prototype.toString.call(options) !== '[object Object]') {
		return callback(new Error(PLUGIN_NAME + '-write: Invalid argument: options'));
	}

	options = options || {};

	// Throw an error if the file argument is not a vinyl file
	if (!File.isVinyl(file)) {
		return callback(new Error(PLUGIN_NAME + '-write: Not a vinyl file'));
	}

	// Throw an error if the file doesn't have a sourcemap
	if (!file.sourceMap) {
		return callback(new Error(PLUGIN_NAME + '-write: No sourcemap found'));
	}

	// TODO: don't mutate - needs test too
	// set defaults for options if unset
	if (options.includeContent === undefined) {
		options.includeContent = true;
	}
	if (options.addComment === undefined) {
		options.addComment = true;
	}
	if (options.charset === undefined) {
		options.charset = 'utf8';
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
		destPath: destPath,
		sourceMap: sourceMap,
		sourceMapFile: null,
	};

	helpers.writeSourceMaps(file, state, options, callback);
}

module.exports = {
	add: add,
	write: write,
};
