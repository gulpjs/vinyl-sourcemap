'use strict';

var path = require('path');
var fs = require('graceful-fs');
var stripBom = require('strip-bom');

var File = require('vinyl');
var detectNewline = require('detect-newline');
var async = require('async');

var helpers = require('./lib/helpers');

var PLUGIN_NAME = 'vinyl-sourcemap';

/**
 * Add a sourcemap to a vinyl file (async, with callback function)
 * @param file
 * @param options
 * @param cb
 */
module.exports.add = function add (file, options, callback) {

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
};

/**
 * Write the sourcemap (async, with callback function)
 * @param file
 * @param destPath
 * @param options
 * @param cb
 */
module.exports.write = function write (file, destPath, options, cb) {

	// Check arguments for optional destPath, options, or callback function
	if (cb === undefined && typeof destPath === 'function') {
		cb = destPath;
		destPath = undefined;
	}	else if (cb === undefined && typeof options === 'function') {
		cb = options;
		if (Object.prototype.toString.call(destPath) === '[object Object]') {
			options = destPath;
			destPath = undefined;
		} else if (typeof destPath === 'string') {
			options = {};
		} else {
			return cb(new Error(PLUGIN_NAME + '-write: Invalid arguments'));
		}
	} else if (Object.prototype.toString.call(options) !== '[object Object]') {
		return cb(new Error(PLUGIN_NAME + '-write: Invalid argument: options'));
	}

	options = options || {};

	// Throw an error if the file argument is not a vinyl file
	if (!File.isVinyl(file)) {
		return cb(new Error(PLUGIN_NAME + '-write: Not a vinyl file'));
	}

	// return array with file & optionally sourcemap file
	var arr = [];

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

	// Throw an error if the file doesn't have a sourcemap
	if (!file.sourceMap) {
		return cb(new Error(PLUGIN_NAME + '-write: No sourcemap found'));
	}

	// fix paths if Windows style paths
	sourceMap.file = helpers.unixStylePath(file.relative);

	if (options.mapSources && typeof options.mapSources === 'function') {
		sourceMap.sources = sourceMap.sources.map(function(filePath) {
			return options.mapSources(filePath);
		});
	}

	sourceMap.sources = sourceMap.sources.map(function(filePath) {
		return helpers.unixStylePath(filePath);
	});

	if (typeof options.sourceRoot === 'function') {
		sourceMap.sourceRoot = options.sourceRoot(file);
	} else {
		sourceMap.sourceRoot = options.sourceRoot;
	}
	if (sourceMap.sourceRoot === null) {
		sourceMap.sourceRoot = undefined;
	}

	var includeContent = function (callback) {
		sourceMap.sourcesContent = sourceMap.sourcesContent || [];

		var loadCounter = 0;
		var loadSourceAsync = function (source, onLoaded) {
			var i = source[0],
				sourcePath = source[1];
			fs.readFile(sourcePath, 'utf8', function (err, data) {
				if (err) {
					if (options.debug) {
						console.warn(PLUGIN_NAME + '-write: source file not found: ' + sourcePath);
					}
					return onLoaded();
				}
				sourceMap.sourcesContent[i] = stripBom(data);
				onLoaded();
			});
		};

		var sourcesToLoadAsync = file.sourceMap.sources.reduce(function(result, source, i) {
			if (!sourceMap.sourcesContent[i]) {
				var sourcePath = path.resolve(sourceMap.sourceRoot || file.base, sourceMap.sources[i]);
				if (options.debug) {
					console.log(PLUGIN_NAME + '-write: No source content for "' + sourceMap.sources[i] + '". Loading from file.');
				}
				result.push([i, sourcePath]);
			}
			return result;
		}, []);

		if (sourcesToLoadAsync.length) {
			// load missing source content
			sourcesToLoadAsync.forEach(function (source) {
				loadSourceAsync(source, function onLoaded () {
					if (++loadCounter === sourcesToLoadAsync.length) {
						callback();
					}
				});
			});
		} else {
			callback();
		}
	};

	var contentIncluded = function (callback) {

		var extension = file.relative.split('.').pop();
		var newline = detectNewline(file.contents.toString());
		var commentFormatter;

		switch (extension) {
			case 'css':
				commentFormatter = function(url) {
					return newline + '/*# sourceMappingURL=' + url + ' */' + newline;
				};
				break;
			case 'js':
				commentFormatter = function(url) {
					return newline + '//# sourceMappingURL=' + url + newline;
				};
				break;
			default:
				commentFormatter = function() {
					return '';
				};
		}

		var comment;
		if (destPath === undefined || destPath === null) {
			// encode source map into comment
			var base64Map = new Buffer(JSON.stringify(sourceMap)).toString('base64');
			comment = commentFormatter('data:application/json;charset=' + options.charset + ';base64,' + base64Map);
		} else {
			var mapFile = path.join(destPath, file.relative) + '.map';
			// custom map file name
			if (options.mapFile && typeof options.mapFile === 'function') {
				mapFile = options.mapFile(mapFile);
			}

			var sourceMapPath = path.join(file.base, mapFile);

			// if explicit destination path is set
			if (options.destPath) {
				var destSourceMapPath = path.join(file.cwd, options.destPath, mapFile);
				var destFilePath = path.join(file.cwd, options.destPath, file.relative);
				sourceMap.file = helpers.unixStylePath(path.relative(path.dirname(destSourceMapPath), destFilePath));
				if (sourceMap.sourceRoot === undefined) {
					sourceMap.sourceRoot = helpers.unixStylePath(path.relative(path.dirname(destSourceMapPath), file.base));
				} else if (sourceMap.sourceRoot === '' || (sourceMap.sourceRoot && sourceMap.sourceRoot[0] === '.')) {
					sourceMap.sourceRoot = helpers.unixStylePath(path.join(path.relative(path.dirname(destSourceMapPath), file.base), sourceMap.sourceRoot));
				}
			} else {
				// best effort, can be incorrect if options.destPath not set
				sourceMap.file = helpers.unixStylePath(path.relative(path.dirname(sourceMapPath), file.path));
				if (sourceMap.sourceRoot === '' || (sourceMap.sourceRoot && sourceMap.sourceRoot[0] === '.')) {
					sourceMap.sourceRoot = helpers.unixStylePath(path.join(path.relative(path.dirname(sourceMapPath), file.base), sourceMap.sourceRoot));
				}
			}

			// add new source map file to stream
			var sourceMapFile = new File({
				cwd: file.cwd,
				base: file.base,
				path: sourceMapPath,
				contents: new Buffer(JSON.stringify(sourceMap)),
				stat: {
					isFile: function () {
						return true;
					},
					isDirectory: function () {
						return false;
					},
					isBlockDevice: function () {
						return false;
					},
					isCharacterDevice: function () {
						return false;
					},
					isSymbolicLink: function () {
						return false;
					},
					isFIFO: function () {
						return false;
					},
					isSocket: function () {
						return false;
					}
				}
			});

			arr.push(sourceMapFile);

			var sourceMapPathRelative = path.relative(path.dirname(file.path), sourceMapPath);

			if (options.sourceMappingURLPrefix) {
				var prefix = '';
				if (typeof options.sourceMappingURLPrefix === 'function') {
					prefix = options.sourceMappingURLPrefix(file);
				} else {
					prefix = options.sourceMappingURLPrefix;
				}
				sourceMapPathRelative = prefix+path.join('/', sourceMapPathRelative);
			}
			comment = commentFormatter(helpers.unixStylePath(sourceMapPathRelative));

			if (options.sourceMappingURL && typeof options.sourceMappingURL === 'function') {
				comment = commentFormatter(options.sourceMappingURL(file));
			}
		}

		// append source map comment
		if (options.addComment) {
			file.contents = Buffer.concat([file.contents, new Buffer(comment)]);
		}

		arr.unshift(file);

		callback(null, arr);
	};

	var asyncTasks = [contentIncluded];
	if (options.includeContent) {
		asyncTasks.unshift(includeContent);
	} else {
		delete sourceMap.sourcesContent;
	}
	async.waterfall(asyncTasks, cb);

};
