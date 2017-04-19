'use strict';

var fs = require('fs');
var path = require('path');
var File = require('vinyl');
var expect = require('expect');
var sourcemaps = require('..');
var stream = require('stream');
var util = require('util');
var recordConsole = require('./consolerecorder.js');

var sourceContent = fs.readFileSync(path.join(__dirname, 'assets/helloworld.js')).toString();

function makeSourceMap() {
	return {
		version: 3,
		file: 'helloworld.js',
		names: [],
		mappings: '',
		sources: ['helloworld.js'],
		sourcesContent: [sourceContent]
	};
}

function makeFile() {
	var file = new File({
		cwd: __dirname,
		base: path.join(__dirname, 'assets'),
		path: path.join(__dirname, 'assets', 'helloworld.js'),
		contents: new Buffer(sourceContent),
		sourceMap: makeSourceMap(),
	});
	return file;
}

function makeNestedFile() {
	var file = new File({
		cwd: __dirname,
		base: path.join(__dirname, 'assets'),
		path: path.join(__dirname, 'assets', 'dir1', 'dir2', 'helloworld.js'),
		contents: new Buffer(sourceContent)
	});
	file.sourceMap = makeSourceMap();
	return file;
}

function base64JSON(object) {
	return 'data:application/json;charset=utf8;base64,' + new Buffer(JSON.stringify(object)).toString('base64');
}

describe('write', function() {

	describe('ensures file argument', function() {

		it('is not undefined', function(done) {
			sourcemaps.write(undefined, function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
				done();
			});
		});

		it('is not null', function(done) {
			sourcemaps.write(null, function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
				done();
			});
		});

		it('is not a plain object', function(done) {
			sourcemaps.write({}, function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
				done();
			});
		});

		// TODO: seems like a bad test
		it('is not a stream', function(done) {
			sourcemaps.write(new stream.Readable(), function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
				done();
			});
		});

		it('is a vinyl object', function(done) {
			var file = makeFile();
			sourcemaps.write(file, function(err) {
				expect(err).toNotExist();
				done();
			});
		});
	});

	describe.skip('ensures destPath argument', function() {

		it('is not mutated', function(done) {
			var defaultedOpts = {
				includeContent: true,
				addComment: true,
			};

			var opts = {};

			var file = makeFile();
			sourcemaps.write(file, opts, function(err) {
				expect(opts).toNotEqual(defaultedOpts);
				done(err);
			});
		});

		it('is defaulted if undefined', function(done) {
			var file = makeFile();
			sourcemaps.write(file, undefined, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if null', function(done) {
			var file = makeFile();
			sourcemaps.write(file, null, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if empty string', function(done) {
			var file = makeFile();
			sourcemaps.write(file, '', function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if non-empty string', function(done) {
			var file = makeFile();
			sourcemaps.write(file, 'invalid', function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if boolean false', function(done) {
			var file = makeFile();
			sourcemaps.write(file, false, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if boolean true', function(done) {
			var file = makeFile();
			sourcemaps.write(file, true, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if array', function(done) {
			var file = makeFile();
			sourcemaps.write(file, [], function(err) {
				expect(err).toNotExist();
				done();
			});
		});
	});

	it('calls back with the untouched file if sourceMap property does not exist', function(done) {
		var file = makeFile();
		delete file.sourceMap;
		sourcemaps.write(file, function(err, outFile) {
			expect(err).toNotExist();
			expect(file).toExist();
			expect(outFile).toEqual(file);
			done(err);
		});
	});

	it('should write an inline source map', function(done) {
		var file = makeFile();
		sourcemaps.write(file, function(err, updatedFile, sourceMapFile) {
			expect(updatedFile).toExist();
			expect(sourceMapFile).toNotExist();
			// TODO: Vinyl.isVinyl
			expect(updatedFile instanceof File).toExist();
			expect(updatedFile).toEqual(file);
			expect(String(updatedFile.contents)).toBe( sourceContent + '//# sourceMappingURL=' + base64JSON(updatedFile.sourceMap) + '\n');
			done(err);
		});
	});

	it('should use CSS comments if CSS file', function(done) {
		var file = makeFile();
		file.path = file.path.replace('.js', '.css');
		sourcemaps.write(file, function(err, updatedFile) {
			expect(String(updatedFile.contents)).toBe(sourceContent + '/*# sourceMappingURL=' + base64JSON(updatedFile.sourceMap) + ' */\n');
			done(err);
		});
	});

	it('should write no comment if not JS or CSS file', function(done) {
		var file = makeFile();
		file.path = file.path.replace('.js', '.txt');
		sourcemaps.write(file, function(err, updatedFile) {
			expect(String(updatedFile.contents)).toBe(sourceContent);
			done(err);
		});
	});

	it('should detect detect whether a file uses \\n or \\r\\n and follow the existing style', function(done) {
		var file = makeFile();
		file.contents = new Buffer(file.contents.toString().replace(/\n/g, '\r\n'));
		sourcemaps.write(file, function(err, updatedFile) {
			expect(String(updatedFile.contents)).toBe(sourceContent.replace(/\n/g, '\r\n') + '//# sourceMappingURL=' + base64JSON(updatedFile.sourceMap) + '\r\n');
			done(err);
		});
	});

	it.skip('should write external map files', function(done) {
		var file = makeFile();
		sourcemaps.write(file, '../maps', function(err, updatedFile, sourceMapFile) {
			expect(updatedFile instanceof File).toExist();
			expect(updatedFile).toEqual(file);
			expect(String(updatedFile.contents)).toBe(sourceContent + '//# sourceMappingURL=../maps/helloworld.js.map\n');
			expect(updatedFile.sourceMap.file).toBe('../dist/helloworld.js');
			expect(sourceMapFile instanceof File).toExist();
			expect(sourceMapFile.path).toBe(path.join(__dirname, 'maps/helloworld.js.map'));
			expect(JSON.parse(sourceMapFile.contents)).toEqual(updatedFile.sourceMap);
			expect(sourceMapFile.stat.isFile()).toExist();
			expect(sourceMapFile.stat.isDirectory()).toNotExist();
			expect(sourceMapFile.stat.isBlockDevice()).toNotExist();
			expect(sourceMapFile.stat.isCharacterDevice()).toNotExist();
			expect(sourceMapFile.stat.isSymbolicLink()).toNotExist();
			expect(sourceMapFile.stat.isFIFO()).toNotExist();
			expect(sourceMapFile.stat.isSocket()).toNotExist();
			done(err);
		});
	});

	it('should create shortest path to map in file comment', function(done) {
		var file = makeNestedFile();
		sourcemaps.write(file, 'dir1/maps', function(err, updatedFile) {
			expect(String(updatedFile.contents)).toBe(sourceContent + '//# sourceMappingURL=../maps/dir1/dir2/helloworld.js.map\n');
			done(err);
		});
	});

	it('should fetch missing sourceContent', function(done) {
		var file = makeFile();
		delete file.sourceMap.sourcesContent;
		sourcemaps.write(file, function(err, updatedFile) {
			expect(updatedFile.sourceMap.sourcesContent).toNotBe(undefined);
			expect(updatedFile.sourceMap.sourcesContent).toEqual([sourceContent]);
			done(err);
		});
	});

	it('should not throw when unable to fetch missing sourceContent', function(done) {
		var file = makeFile();
		file.sourceMap.sources[0] += '.invalid';
		delete file.sourceMap.sourcesContent;
		sourcemaps.write(file, function(err, updatedFile) {
			expect(updatedFile.sourceMap.sourcesContent).toNotBe(undefined);
			expect(updatedFile.sourceMap.sourcesContent).toEqual([]);
			done(err);
		});
	});
});
