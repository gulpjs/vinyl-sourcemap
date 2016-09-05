'use strict';

var path = require('path');
var through = require('through2');
var File = require('vinyl');
var acorn = require('acorn');
var SourceMapGenerator = require('source-map').SourceMapGenerator;

var PLUGIN_NAME = 'vinyl-sourcemaps';

function unixStylePath (filePath) {
	return filePath.split(path.sep).join('/');
}

function processFile (file, options) {

	if (!file || !File.isVinyl(file)) {
		throw new Error('Not a vinyl file');
	}

	var fileContent = file.contents.toString();
	var sourceMap;

	if (options.loadMaps) {
		var sourcePath = ''; //root path for the sources in the map

		// Try to read inline source map
		sourceMap = convert.fromSource(fileContent);
		if (sourceMap) {
			sourceMap = sourceMap.toObject();
			// sources in map are relative to the source file
			sourcePath = path.dirname(file.path);
			fileContent = convert.removeComments(fileContent);
		} else {
			// look for source map comment referencing a source map file
			var mapComment = convert.mapFileCommentRegex.exec(fileContent);

			var mapFile;
			if (mapComment) {
				mapFile = path.resolve(path.dirname(file.path), mapComment[1] || mapComment[2]);
				fileContent = convert.removeMapFileComments(fileContent);
				// if no comment try map file with same name as source file
			} else {
				mapFile = file.path + '.map';
			}

			// sources in external map are relative to map file
			sourcePath = path.dirname(mapFile);

			try {
				sourceMap = JSON.parse(stripBom(fs.readFileSync(mapFile, 'utf8')));
			} catch (e) {}
		}

		// fix source paths and sourceContent for imported source map
		if (sourceMap) {
			sourceMap.sourcesContent = sourceMap.sourcesContent || [];
			sourceMap.sources.forEach(function(source, i) {
				if (source.match(urlRegex)) {
					sourceMap.sourcesContent[i] = sourceMap.sourcesContent[i] || null;
					return;
				}
				var absPath = path.resolve(sourcePath, source);
				sourceMap.sources[i] = unixStylePath(path.relative(file.base, absPath));

				if (!sourceMap.sourcesContent[i]) {
					var sourceContent = null;
					if (sourceMap.sourceRoot) {
						if (sourceMap.sourceRoot.match(urlRegex)) {
							sourceMap.sourcesContent[i] = null;
							return;
						}
						absPath = path.resolve(sourcePath, sourceMap.sourceRoot, source);
					}

					// if current file: use content
					if (absPath === file.path) {
						sourceContent = fileContent;

						// else load content from file
					} else {
						try {
							if (options.debug) {
								console.log(PLUGIN_NAME + '-init: No source content for "' + source + '". Loading from file.');
							}
							sourceContent = stripBom(fs.readFileSync(absPath, 'utf8'));
						} catch (e) {
							if (options.debug) {
								console.warn(PLUGIN_NAME + '-init: source file not found: ' + absPath);
							}
						}
					}
					sourceMap.sourcesContent[i] = sourceContent;
				}
			});

			// remove source map comment from source
			file.contents = new Buffer(fileContent, 'utf8');
		}
	}

	if (!sourceMap && options.identityMap) {
		var fileType = path.extname(file.path);
		var source = unixStylePath(file.relative);
		var generator = new SourceMapGenerator({ file: source });
		if (fileType === '.js') {
			var tokenizer = acorn.tokenizer(fileContent, { locations: true });
			while (true) {
				var token = tokenizer.getToken();

				if (token.type.label === 'eof') {
					break;
				}
				var mapping = {
					original: token.loc.start,
					generated: token.loc.start,
					source: source,
				};
				if (token.type.label === 'name') {
					mapping.name = token.value;
				}
				generator.addMapping(mapping);
			}
			generator.setSourceContent(source, fileContent);
			sourceMap = generator.toJSON();
		} else if (fileType === '.css') {
			var ast = css.parse(fileContent, { silent: true });
			var registerTokens = function (ast) {
				if (ast.position) {
					generator.addMapping({
						original: ast.position.start,
						generated: ast.position.start,
						source: source,
					});
				}
				for (var key in ast) {
					if (key !== 'position') {
						if (Object.prototype.toString.call(ast[key]) === '[object Object]') {
							registerTokens(ast[key]);
						} else if (ast[key].constructor === Array) {
							for (var i = 0; i < ast[key].length; i++) {
								registerTokens(ast[key][i]);
							}
						}
					}
				}
			};
			registerTokens(ast);
			generator.setSourceContent(source, fileContent);
			sourceMap = generator.toJSON();
		}
	}

	if (!sourceMap) {
		sourceMap = {
			version: 3,
			names: [],
			mappings: '',
			sources: [unixStylePath(file.relative)],
			sourcesContent: [fileContent]
		};
	}

	sourceMap.file = unixStylePath(file.relative);
	file.sourceMap = sourceMap;

	return file;

}

module.exports.processFile = processFile;

module.exports.src = function src (options) {

	function sourceMapSrc (file, enc, cb) {

		if (!options) {
			options = {};
		}

		this.push(processFile(file, options));
		cb();

	}

	return through.obj(sourceMapSrc);

};
