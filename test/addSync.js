'use strict';

var fs = require('fs');
var File = require('vinyl');
var path = require('path');
var test = require('tape');
var sourcemaps = require('..');
var stream = require('stream');
var util = require('util');
var recordConsole = require('./consolerecorder.js');

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

test('addSync: should throw an error when no valid vinyl file is provided', function (t) {
	[
		{ type: 'null', val: null },
		{ type: 'an object', val: {} },
		{ type: 'a stream', val: new stream.Readable() }
	].map(function (obj) {
		try {
			sourcemaps.addSync(obj.val);
		} catch (err) {
			t.ok(err instanceof Error && err.message === 'vinyl-sourcemap-addSync: Not a vinyl file', util.format('should not accept %s as first argument', obj.type));
		}
	});
	t.end();
});

test('addSync: should return an error when invalid options are provided', function (t) {
	var file = makeFile();
	[
		{ type: 'undefined' },
		{ type: 'null', val: null },
		{ type: 'a string', val: '' },
		{ type: 'a boolean', val: true }
	].map(function(obj) {
		try {
			sourcemaps.addSync(file, obj.val);
		} catch (err) {
			t.ok(err instanceof Error && err.message === 'vinyl-sourcemap-add: Invalid argument: options', util.format('should not accept %s as options argument', obj.type));
		}
	});
	t.end();
});

test('addSync: should add an empty sourcemap', function (t) {
	var data = sourcemaps.addSync(makeFile());
	t.ok(File.isVinyl(data), 'should return a vinyl file');
	t.ok(data.sourceMap, 'should add a source map object');
	t.equal(String(data.sourceMap.version), '3', 'should have version 3');
	t.equal(data.sourceMap.sources[0], 'helloworld.js', 'should add file to sources');
	t.equal(data.sourceMap.sourcesContent[0], sourceContent, 'should add file content to sourcesContent');
	t.deepEqual(data.sourceMap.names, [], 'should add empty names');
	t.equal(data.sourceMap.mappings, '', 'should add empty mappings');
	t.end();
});

test('addSync: should add a valid sourcemap if wished', function (t) {
	var data = sourcemaps.addSync(makeFile(), { identityMap: true });
	t.ok(data, 'should pass something through');
	t.ok(data instanceof File, 'should pass a vinyl file through');
	t.ok(data.sourceMap, 'should add a source map object');
	t.equal(String(data.sourceMap.version), '3', 'should have version 3');
	t.equal(data.sourceMap.sources[0], 'helloworld.js', 'should add file to sources');
	t.equal(data.sourceMap.sourcesContent[0], sourceContent, 'should add file content to sourcesContent');
	t.deepEqual(data.sourceMap.names, ['helloWorld', 'console', 'log'], 'should add correct names');
	t.equal(data.sourceMap.mappings, 'AAAA,YAAY;;AAEZ,SAASA,UAAU,CAAC,EAAE;CACrBC,OAAO,CAACC,GAAG,CAAC,cAAc,CAAC;AAC5B', 'should add correct mappings');
	t.end();
});

test('addSync: should add a valid source map for CSS if wished', function (t) {
	var data = sourcemaps.addSync(makeFileCSS(), { identityMap: true });
	t.ok(data, 'should pass something through');
	t.ok(data instanceof File, 'should pass a vinyl file through');
	t.ok(data.sourceMap, 'should add a source map object');
	t.equal(String(data.sourceMap.version), '3', 'should have version 3');
	t.equal(data.sourceMap.sources[0], 'test.css', 'should add file to sources');
	t.equal(data.sourceMap.sourcesContent[0], sourceContentCSS, 'should add file content to sourcesContent');
	t.deepEqual(data.sourceMap.names, [], 'should add correct names');
	t.equal(data.sourceMap.mappings, 'CAAC;EACC;EACA', 'should add correct mappings');
	t.end();
});

test('addSync: should import an existing inline source map', function (t) {
	var data = sourcemaps.addSync(makeFileWithInlineSourceMap(), { loadMaps: true });
	t.ok(data, 'should pass something through');
	t.ok(data instanceof File, 'should pass a vinyl file through');
	t.ok(data.sourceMap, 'should add a source map object');
	t.equal(String(data.sourceMap.version), '3', 'should have version 3');
	console.log('data.sourceMap.sources', data.sourceMap.sources);
	t.deepEqual(data.sourceMap.sources, ['test1.js', 'test2.js'], 'should have right sources');
	t.deepEqual(data.sourceMap.sourcesContent, ['console.log(\'line 1.1\');\nconsole.log(\'line 1.2\');\n', 'console.log(\'line 2.1\');\nconsole.log(\'line 2.2\');'], 'should have right sourcesContent');
	t.equal(data.sourceMap.mappings, 'AAAAA,QAAAC,IAAA,YACAD,QAAAC,IAAA,YCDAD,QAAAC,IAAA,YACAD,QAAAC,IAAA', 'should have right mappings');
	t.end();
});

test('addSync: should remove inline sourcemap', function (t) {
	var data = sourcemaps.addSync(makeFileWithInlineSourceMap(), { loadMaps: true });
	t.notOk(/sourceMappingURL/.test(data.contents.toString()), 'should not have sourcemapping');
	t.end();
});

test('addSync: should load external source map file referenced in comment with the \/\/# syntax', function (t) {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld2.js.map');
	var data = sourcemaps.addSync(file, { loadMaps: true });
	t.ok(data.sourceMap, 'should add a source map object');
	t.equal(String(data.sourceMap.version), '3', 'should have version 3');
	t.deepEqual(data.sourceMap.sources, ['helloworld2.js'], 'should have right sources');
	t.deepEqual(data.sourceMap.sourcesContent, ['source content from source map'], 'should have right sourcesContent');
	t.equal(data.sourceMap.mappings, '', 'should have right mappings');
	t.end();
});

test('addSync: should remove source map comment with the \/\/# syntax', function (t) {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld2.js.map');
	var data = sourcemaps.addSync(file, { loadMaps: true });
	t.notOk(/sourceMappingURL/.test(data.contents.toString()), 'should not have sourcemapping');
	t.end();
});

test('addSync: should load external source map if no source mapping comment', function (t) {
	var file = makeFile();
	file.path = file.path.replace('helloworld.js', 'helloworld2.js');
	var data = sourcemaps.addSync(file, { loadMaps: true });
	t.ok(data.sourceMap, 'should add a source map object');
	t.equal(String(data.sourceMap.version), '3', 'should have version 3');
	t.deepEqual(data.sourceMap.sources, ['helloworld2.js'], 'should have right sources');
	t.deepEqual(data.sourceMap.sourcesContent, ['source content from source map'], 'should have right sourcesContent');
	t.equal(data.sourceMap.mappings, '', 'should have right mappings');
	t.end();
});

test('addSync: should load external source map and add sourceContent if missing', function (t) {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld3.js.map');
	var data = sourcemaps.addSync(file, { loadMaps: true });
	t.ok(data.sourceMap, 'should add a source map object');
	t.equal(String(data.sourceMap.version), '3', 'should have version 3');
	t.deepEqual(data.sourceMap.sources, ['helloworld.js', 'test1.js'], 'should have right sources');
	t.deepEqual(data.sourceMap.sourcesContent, [file.contents.toString(), 'test1\n'], 'should have right sourcesContent');
	t.equal(data.sourceMap.mappings, '', 'should have right mappings');
	t.end();
});

test('addSync: should not throw when source file for sourceContent not found', function (t) {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld4.js.map');
	var data = sourcemaps.addSync(file, { loadMaps: true });
	t.ok(data.sourceMap, 'should add a source map object');
	t.equal(String(data.sourceMap.version), '3', 'should have version 3');
	t.deepEqual(data.sourceMap.sources, ['helloworld.js', 'missingfile'], 'should have right sources');
	t.deepEqual(data.sourceMap.sourcesContent, [file.contents.toString(), null], 'should have right sourcesContent');
	t.equal(data.sourceMap.mappings, '', 'should have right mappings');
	t.end();
});

test('addSync: should use unix style paths in sourcemap', function (t) {
	var file = makeFile();
	file.base = file.cwd;
	var data = sourcemaps.addSync(file);
	t.equal(data.sourceMap.file, 'assets/helloworld.js', 'should have right file');
	t.deepEqual(data.sourceMap.sources, ['assets/helloworld.js'], 'should have right sources');
	t.end();
});

test('addSync: should use sourceRoot when resolving path to sources', function (t) {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld5.js.map');
	var data = sourcemaps.addSync(file, { loadMaps: true });
	t.ok(data.sourceMap, 'should add a source map object');
	t.equal(String(data.sourceMap.version), '3', 'should have version 3');
	t.deepEqual(data.sourceMap.sources, ['../helloworld.js', '../test1.js'], 'should have right sources');
	t.deepEqual(data.sourceMap.sourcesContent, [file.contents.toString(), 'test1\n'], 'should have right sourcesContent');
	t.equal(data.sourceMap.mappings, '', 'should have right mappings');
	t.equal(data.sourceMap.sourceRoot, 'test', 'should have right sourceRoot');
	t.end();
});

test('addSync: should not load source content if the path is a url', function (t) {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld6.js.map');
	var data = sourcemaps.addSync(file, { loadMaps: true });
	t.ok(data.sourceMap, 'should add a source map object');
	t.equal(String(data.sourceMap.version), '3', 'should have version 3');
	t.deepEqual(data.sourceMap.sources, ['helloworld.js', 'http://example2.com/test1.js'], 'should have right sources');
	t.deepEqual(data.sourceMap.sourcesContent, [null, null]);
	t.equal(data.sourceMap.mappings, '', 'should have right mappings');
	t.end();
});

test('addSync: should output an error message if debug option is set and sourceContent is missing', function (t) {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld4.js.map');
	var hConsole = recordConsole();
	var data = sourcemaps.addSync(file, { loadMaps: true, debug: true });
	hConsole.restore();
	t.equal(hConsole.history.log[0], 'vinyl-sourcemap-addSync: No source content for "missingfile". Loading from file.', 'should log missing source content');
	t.ok(hConsole.history.warn[0].indexOf('vinyl-sourcemap-addSync: source file not found: ') === 0, 'should warn about missing file');
	t.end();
});

test('addSync: should pass through when file already has a source map', function (t) {
	var sourceMap = {
		version: 3,
		names: [],
		mappings: '',
		sources: ['test.js'],
		sourcesContent: ['testContent'],
	};
	var file = makeFile();
	file.sourceMap = sourceMap;
	var data = sourcemaps.addSync(file, { loadMaps: true });
	t.ok(data, 'should pass something through');
	t.ok(data instanceof File, 'should pass a vinyl file through');
	t.equal(data.sourceMap, sourceMap, 'should not change the source map');
	t.deepEqual(data, file, 'should not change file');
	t.end();
});
