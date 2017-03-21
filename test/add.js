'use strict';

var fs = require('fs');
var File = require('vinyl');
var path = require('path');
var expect = require('expect');
var sourcemaps = require('..');
var stream = require('stream');

var sourceContent = fs.readFileSync(path.join(__dirname, 'assets/helloworld.js')).toString();
var sourceContentCSS = fs.readFileSync(path.join(__dirname, 'assets/test.css')).toString();

function makeFile() {
	return new File({
		cwd: __dirname,
		base: path.join(__dirname, 'assets'),
		path: path.join(__dirname, 'assets', 'helloworld.js'),
		contents: new Buffer(sourceContent)
	});
}

function makeFileCSS() {
	return new File({
		cwd: __dirname,
		base: path.join(__dirname, 'assets'),
		path: path.join(__dirname, 'assets', 'test.css'),
		contents: new Buffer(sourceContentCSS)
	});
}

function makeFileWithInlineSourceMap() {
	return new File({
		cwd: __dirname,
		base: path.join(__dirname, 'assets'),
		path: path.join(__dirname, 'assets', 'all.js'),
		contents: new Buffer('console.log("line 1.1"),console.log("line 1.2"),console.log("line 2.1"),console.log("line 2.2");\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxsLmpzIiwic291cmNlcyI6WyJ0ZXN0MS5qcyIsInRlc3QyLmpzIl0sIm5hbWVzIjpbImNvbnNvbGUiLCJsb2ciXSwibWFwcGluZ3MiOiJBQUFBQSxRQUFBQyxJQUFBLFlBQ0FELFFBQUFDLElBQUEsWUNEQUQsUUFBQUMsSUFBQSxZQUNBRCxRQUFBQyxJQUFBIiwic291cmNlc0NvbnRlbnQiOlsiY29uc29sZS5sb2coJ2xpbmUgMS4xJyk7XG5jb25zb2xlLmxvZygnbGluZSAxLjInKTtcbiIsImNvbnNvbGUubG9nKCdsaW5lIDIuMScpO1xuY29uc29sZS5sb2coJ2xpbmUgMi4yJyk7Il0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9')
	});
}

describe('add', function() {

	describe('ensures file argument', function() {

		it('is not undefined', function(done) {
			sourcemaps.add(undefined, function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Not a vinyl file').toExist();
				done();
			});
		});

		it('is not null', function(done) {
			sourcemaps.add(null, function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Not a vinyl file').toExist();
				done();
			});
		});

		it('is not a plain object', function(done) {
			sourcemaps.add({}, function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Not a vinyl file').toExist();
				done();
			});
		});

		// TODO: seems like a bad test
		it('is not a stream', function(done) {
			sourcemaps.add(new stream.Readable(), function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Not a vinyl file').toExist();
				done();
			});
		});

		it('is a vinyl object', function(done) {
			var file = makeFile();
			sourcemaps.add(file, function(err) {
				expect(err).toNotExist();
				done();
			});
		});
	});

	describe('ensures options argument', function() {


		it('is defaulted if undefined', function(done) {
			var file = makeFile();
			sourcemaps.add(file, undefined, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if null', function(done) {
			var file = makeFile();
			sourcemaps.add(file, null, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if empty string', function(done) {
			var file = makeFile();
			sourcemaps.add(file, '', function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if non-empty string', function(done) {
			var file = makeFile();
			sourcemaps.add(file, 'invalid', function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if boolean false', function(done) {
			var file = makeFile();
			sourcemaps.add(file, false, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if boolean true', function(done) {
			var file = makeFile();
			sourcemaps.add(file, true, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if array', function(done) {
			var file = makeFile();
			sourcemaps.add(file, [], function(err) {
				expect(err).toNotExist();
				done();
			});
		});
	});

	it('should add an empty sourceMap', function(done) {
		sourcemaps.add(makeFile(), function(err, data) {
			expect(File.isVinyl(data)).toExist();
			expect(data.sourceMap).toExist();
			expect(String(data.sourceMap.version)).toBe('3');
			expect(data.sourceMap.sources[0]).toBe('helloworld.js');
			expect(data.sourceMap.sourcesContent[0]).toBe(sourceContent);
			expect(data.sourceMap.names).toEqual([]);
			expect(data.sourceMap.mappings).toBe('');
			done(err);
		});
	});

	it('should add a valid source if wished', function(done) {
		sourcemaps.add(makeFile(), { identityMap: true }, function(err, data) {
			expect(data).toExist();
			expect(data).toExist();
			expect(data.sourceMap).toExist();
			expect(String(data.sourceMap.version)).toBe('3');
			expect(data.sourceMap.sources[0]).toBe('helloworld.js');
			expect(data.sourceMap.sourcesContent[0]).toBe(sourceContent);
			expect(data.sourceMap.names).toEqual(['helloWorld', 'console','log']);
			expect(data.sourceMap.mappings).toBe('AAAA,YAAY;;AAEZ,SAASA,UAAU,CAAC,EAAE;CACrBC,OAAO,CAACC,GAAG,CAAC,cAAc,CAAC;AAC5B');
			done(err);
		});
	});

	it('should add a valid source map for CSS if wished', function(done) {
		sourcemaps.add(makeFileCSS(), { identityMap: true }, function(err, data) {
			expect(data).toExist();
			expect(data instanceof File).toExist();
			expect(data.sourceMap).toExist();
			expect(String(data.sourceMap.version)).toBe('3');
			expect(data.sourceMap.sources[0]).toBe('test.css');
			expect(data.sourceMap.sourcesContent[0]).toBe(sourceContentCSS);
			expect(data.sourceMap.names).toEqual([]);
			expect(data.sourceMap.mappings).toBe('CAAC;EACC;EACA');
			done(err);
		});
	});

	it('should import an existing inline source map', function(done) {
		sourcemaps.add(makeFileWithInlineSourceMap(), { loadMaps: true }, function(err, data) {
			expect(data).toExist();
			expect(data instanceof File).toExist();
			expect(data.sourceMap).toExist();
			expect(String(data.sourceMap.version)).toBe('3');
			expect(data.sourceMap.sources).toEqual(['test1.js', 'test2.js']);
			expect(data.sourceMap.sourcesContent).toEqual(['console.log(\'line 1.1\');\nconsole.log(\'line 1.2\');\n', 'console.log(\'line 2.1\');\nconsole.log(\'line 2.2\');']);
			expect(data.sourceMap.mappings).toBe('AAAAA,QAAAC,IAAA,YACAD,QAAAC,IAAA,YCDAD,QAAAC,IAAA,YACAD,QAAAC,IAAA');
			done(err);
		});
	});

	it('should remove inline source', function(done) {
		sourcemaps.add(makeFileWithInlineSourceMap(), { loadMaps: true }, function(err, data) {
			expect(/sourceMappingURL/.test(data.contents.toString())).toNotExist();
			done(err);
		});
	});

	it('should load external source map file reference in comment with \/\/# syntax', function(done) {
		var file = makeFile();
		file.contents = new Buffer(sourceContent +  '\n//# sourceMappingURL=helloworld2.js.map');
		sourcemaps.add(file, { loadMaps: true }, function(err, data) {
			expect(data.sourceMap).toExist();
			expect(String(data.sourceMap.version)).toBe('3');
			expect(data.sourceMap.sources).toEqual(['helloworld2.js']);
			expect(data.sourceMap.sourcesContent).toEqual(['source content from source map']);
			expect(data.sourceMap.mappings).toBe('');
			done(err);
		});
	});

	it('should remove source map comment with the \/\/# syntax', function(done) {
		var file = makeFile();
		file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld2.js.map');
		sourcemaps.add(file, { loadMaps: true }, function(err, data) {
			expect(/sourceMappingURL/.test(data.contents.toString())).toNotExist();
			done(err);
		});
	});

	it('should load external source map if no source mapping comment', function (done) {
		var file = makeFile();
		file.path = file.path.replace('helloworld.js', 'helloworld2.js');
		sourcemaps.add(file, { loadMaps: true }, function(err, data) {
			expect(data.sourceMap).toExist();
			expect(String(data.sourceMap.version)).toBe('3');
			expect(data.sourceMap.sources).toEqual(['helloworld2.js']);
			expect(data.sourceMap.sourcesContent).toEqual(['source content from source map']);
			expect(data.sourceMap.mappings).toBe('');
			done(err);
		});
	});

	it('should load external source map and add sourceContent if missing', function(done) {
		var file = makeFile();
		file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld3.js.map');
		sourcemaps.add(file, { loadMaps: true }, function(err, data) {
			expect(data.sourceMap).toExist();
			expect(String(data.sourceMap.version)).toBe('3');
			expect(data.sourceMap.sources).toEqual(['helloworld.js', 'test1.js']);
			expect(data.sourceMap.sourcesContent).toEqual([file.contents.toString(), 'test1\n']);
			expect(data.sourceMap.mappings).toBe('');
			done(err);
		});
	});

	it('should not throw when source file for sourceContent not found', function(done) {
		var file = makeFile();
		file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld4.js.map');
		sourcemaps.add(file, { loadMaps: true }, function(err, data) {
			expect(data.sourceMap).toExist();
			expect(String(data.sourceMap.version)).toBe('3');
			expect(data.sourceMap.sources).toEqual(['helloworld.js', 'missingfile']);
			expect(data.sourceMap.sourcesContent).toEqual([file.contents.toString(), null]);
			expect(data.sourceMap.mappings).toBe('');
			done(err);
		});
	});

	it('should use unix style paths in sourcemap', function(done) {
		var file = makeFile();
		file.base = file.cwd;
		sourcemaps.add(file, function(err, data) {
			expect(data.sourceMap.file).toBe('assets/helloworld.js');
			expect(data.sourceMap.sources).toEqual(['assets/helloworld.js']);
			done(err);
		});
	});

	it('should use sourceRoot when resolving path to sources', function(done) {
		var file = makeFile();
		file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld5.js.map');
		sourcemaps.add(file, { loadMaps:true }, function(err, data) {
			expect(data.sourceMap).toExist([]);
			expect(String(data.sourceMap.version)).toBe('3');
			expect(data.sourceMap.sources).toEqual(['../helloworld.js', '../test1.js']);
			expect(data.sourceMap.sourcesContent).toEqual([file.contents.toString(), 'test1\n']);
			expect(data.sourceMap.mappings).toBe('');
			expect(data.sourceMap.sourceRoot).toBe('test');
			done(err);
		});
	});

	it('should not load source conent if the path is a url', function(done) {
		var file = makeFile();
		file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld6.js.map');
		sourcemaps.add(file, { loadMaps: true }, function(err, data) {
			expect(data.sourceMap).toExist();
			expect(String(data.sourceMap.version)).toBe('3');
			expect(data.sourceMap.sources).toEqual(['helloworld.js', 'http://example2.com/test1.js']);
			expect(data.sourceMap.sourcesContent).toEqual([null, null]);
			expect(data.sourceMap.mappings).toBe('');
			done(err);
		});
	});

	it.skip('should output an error message if debug option is set and sourceContent is missing', function (done) {
		var file = makeFile();
		file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld4.js.map');
		var hConsole = ''; // Removed
		sourcemaps.add(file, { loadMaps: true, debug: true }, function(err) {
			expect(hConsole.history.log[0]).toEqual('vinyl-sourcemap-add: No source content for "missingfile". Loading from file.');
			expect(hConsole.history.warn[0].indexOf('vinyl-sourcemap-add: source file not found: ') === 0).toExist();
			done(err);
		});
	});

	it('should pass through whe file already has a source map', function(done) {
		var sourceMap = {
			version: 3,
			names: [],
			mappings: '',
			sources: ['test.js'],
			sourcesContent: ['testContent'],
		};

		var file = makeFile();
		file.sourceMap = sourceMap;
		sourcemaps.add(file, { loadMaps:true }, function(err, data) {
			expect(data).toExist();
			expect(data instanceof File).toExist();
			expect(data.sourceMap).toBe(sourceMap);
			expect(data).toEqual(file);
			done(err);
		});
	});
});
