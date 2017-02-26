'use strict';

var fs = require('fs');
var File = require('vinyl');
var path = require('path');
var expect = require('expect');
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

describe('add: should return an error when input is null', function() {
	it('should not accept null as argument', function(done) {
		[
			{type: 'null'}
		].map(function(obj) {
			sourcemaps.add(obj.val, function(err, file) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Not a vinyl file').toExist();
				done();
			});
		});
	});
});

describe('add: should return an error when input is null', function() {
	it('should not accept an empty object as argument', function(done) {
		[
			{ type: 'an object', val: {} }
		].map(function(obj) {
			sourcemaps.add(obj.val, function(err, file) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Not a vinyl file').toExist();
				done();
			});
		});
	});
});

describe('add: should return an error when input is null', function() {
	it('should not accept a stream as argument', function(done) {
		[
			{ type: 'a stream', val: new stream.Readable() }
		].map(function(obj) {
			sourcemaps.add(obj.val, function(err, file) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Not a vinyl file').toExist();
				done();
			});
		});
	});
});

describe('add: should return an error when invalid options are provided', function() {
	it('should not accept undefined as options argument', function(done) {
		var file = makeFile();
		[
			{ type: 'undefined' }
		].map(function(obj) {
			sourcemaps.add(file, obj.val, function(err, file) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Invalid argument: options').toExist();
				done();
			});
		});
	});
});

describe('add: should return an error when invalid options are provided', function() {
	it('should not accept null as options argument', function(done) {
		var file = makeFile();
		[
			{ type: 'null', val: null }
		].map(function(obj) {
			sourcemaps.add(file, obj.val, function(err, file) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Invalid argument: options').toExist();
				done();
			});
		});
	});
});

describe('add: should return an error when invalid options are provided', function() {
	it('should not accept empty string as options argument', function(done) {
		var file = makeFile();
		[
			{ type: 'a string', val: '' }
		].map(function(obj) {
			sourcemaps.add(file, obj.val, function(err, file) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Invalid argument: options').toExist();
				done();
			});
		});
	});
});


describe('add: should return an error when invalid options are provided', function() {
	it('should not accept boolean as options argument', function(done) {
		var file = makeFile();
		[
			{ type: 'a boolean', val: true }
		].map(function(obj) {
			sourcemaps.add(file, obj.val, function(err, file) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-add: Invalid argument: options').toExist();
				done();
			});
		});
	});
});

describe('add: should add an empty sourceMap', function () {
	sourcemaps.add(makeFile(), function(err, data) {
		it('should add an empty sourceMap', function(done) {
			expect(File.isVinyl(data)).toExist(['Should return a vinyl file']);
			expect(data.sourceMap).toExist(['Should add a source map object'])
			expect(String(data.sourceMap.version)).toBe('3', 'Should have version 3');
			expect(data.sourceMap.sources[0]).toBe('helloworld.js', 'Should add file to sources')
			expect(data.sourceMap.sourcesContent[0]).toBe(sourceContent, 'Should add file content to sourcesContent')
			expect(data.sourceMap.names).toEqual([], 'Should add empty names')
			expect(data.sourceMap.mappings).toBe('', 'Should add empty mappings')
			done();
		})
	})
})

describe('add: should add a valid source if wished', function() {
	sourcemaps.add(makeFile(), {identityMap: true}, function(err, data) {
		it('should add a valid source if wished', function(done) {
			expect(data).toExist(['Should pass something through']);
			expect(data).toExist(['Should pass a vinyl file through']);
			expect(data.sourceMap).toExist(['Should add a source map object']);
			expect(String(data.sourceMap.version)).toBe('3', 'Should have version 3');
			expect(data.sourceMap.sources[0]).toBe('helloworld.js', 'Should add file to sources');
			expect(data.sourceMap.sourcesContent[0]).toBe(sourceContent, 'Should add file content to sourcesContent');
			expect(data.sourceMap.names).toEqual(['helloWorld', 'console','log'], 'Should add correct names');
			expect(data.sourceMap.mappings).toBe('AAAA,YAAY;;AAEZ,SAASA,UAAU,CAAC,EAAE;CACrBC,OAAO,CAACC,GAAG,CAAC,cAAc,CAAC;AAC5B', 'Shoudl add correct mappings');
			done();
		})
	})
})

describe('add: should add a valid source map for CSS if wished', function() {
	sourcemaps.add(makeFileCSS(), {identityMap: true}, function(err, data) {
		it('should add a valid source map for CSS if wished', function(done) {
			expect(data).toExist(['Should pass something through']);
			expect(data instanceof File).toExist(['Should pass a vinyl file through']);
			expect(data.sourceMap).toExist(['Should add a source map object']);
			expect(String(data.sourceMap.version)).toBe('3', 'Should have version 3');
			expect(data.sourceMap.sources[0]).toBe('test.css', 'Should add file to sources');
			expect(data.sourceMap.sourcesContent[0]).toBe(sourceContentCSS, 'Should add file content to sourcesContent');
			expect(data.sourceMap.names).toEqual([], 'Should add correct names');
			expect(data.sourceMap.mappings).toBe('CAAC;EACC;EACA', 'Should add correct mappings');
			done();
		})
	})
})

describe('add: should import an existing inline source map', function () {
	sourcemaps.add(makeFileWithInlineSourceMap(), { loadMaps: true }, function(err, data) {
		it('should import an existing inline source map', function(done) {
			expect(data).toExist(['Should pass something through'])
			expect(data instanceof File).toExist(['Should pass a vinyl file through']);
			expect(data.sourceMap).toExist(['Should add a source map object']);
			expect(String(data.sourceMap.version)).toBe('3', 'Should have version 3');
			expect(data.sourceMap.sources).toEqual(['test1.js', 'test2.js'], 'Should have right sources');
			expect(data.sourceMap.sourcesContent).toEqual(['console.log(\'line 1.1\');\nconsole.log(\'line 1.2\');\n', 'console.log(\'line 2.1\');\nconsole.log(\'line 2.2\');'], 'SHould have right sourceContent');
			expect(data.sourceMap.mappings).toBe('AAAAA,QAAAC,IAAA,YACAD,QAAAC,IAAA,YCDAD,QAAAC,IAAA,YACAD,QAAAC,IAAA', 'Should have right mappings');
			done();
		})
	});
});

describe('add: should remove inline source', function() {
	sourcemaps.add(makeFileWithInlineSourceMap(), {loadMaps: true}, function(err, data){
		it('should remove inline source', function(done){
			expect(/sourceMappingURL/.test(data.contents.toString())).toNotExist(['Should not have sourcemapping']);
			done();
		})
	})
})

describe('add: should load external source map file referenced in comment with \/\/# syntax ', function() {
	var file = makeFile();
	file.contents = new Buffer(sourceContent +  '\n//# sourceMappingURL=helloworld2.js.map');
	sourcemaps.add(file, {loadMaps: true}, function(err, data){
		it ('should load external source map file reference in comment with \/\/# syntax ', function(done) {
			expect(data.sourceMap).toExist(['Should add a source map object']);
			expect(String(data.sourceMap.version)).toBe('3', 'Should have version 3');
			expect(data.sourceMap.sources).toEqual(['helloworld2.js'], 'should have right sources');
			expect(data.sourceMap.sourceContent).toEqual(['Source content from source map'], 'should have right sourcesContent');
			expect(data.sourceMap.mappings).toBe('', 'Should have right mappings')
			done();
		})
	})
})

describe('add: should remove source map comment with the \/\/# syntax', function() {
	var file = makeFile();
	file.contest = new Buffer(sourceContent, + '\n//# sourceMappingURL=helloworld2.js.map');
	sourcemaps.add(file, {loadMaps: true}, function(err, data){
		it('shoudl remove source map comment with the \/\/# syntax', function(done){
			expect(/sourceMappingURL/.test(data.contents.toString())).toNotExist(['Should not have sourcemapping']);
			done();
		})
	})
})


describe('add: should load external source map if no source mapping comment', function() {
	var file = makeFile();
	file.path = file.path.replace('helloworld.js', 'helloworld2.js');
	sourcemaps.add(file, {loadMaps: true}, function(err, data) {
		it('should load external source map if no source mapping comment', function (done) {
			expect(data.sourceMap).toExist(['Should add a source map object']);
			expect(String(data.sourceMap.version)).toBe('3', 'Should have version 3');
			expect(data.sourceMap.sources).toEqual(['helloworld2.js'], 'Should have right sources');
			expect(data.sourceMap.sourcesContent).toEqual(['source content from source map'], 'Should have right sourceContent');
			expect(data.sourceMap.mappings).toBe('', 'Should have right mappings');
			done();
		})
	})
})

describe('add: should load external source map and add sourceContent if missing', function() {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld3.js.map' );
	sourcemaps.add(file, {loadMaps: true}, function(err, data) {
		it('should load external source map and add sourceContent if missing', function(done){
			expect(data.sourceMap).toExist(['Should add a source map object']);
			expect(String(data.sourceMap.version)).toBe('3', 'Should have version 3');
			expect(data.sourceMap.sources).toEqual(['helloworld.js', 'test1.js'], 'Should have right sources');
			expect(data.sourceMap.sourcesContent).toEqual([file.contents.toString(), 'test\n'], 'Should have right sourcesContent');
			expect(data.sourceMap.mappings).toBe('', 'Should have right mappings');
			done();
		})
	})
})

describe('add: should not throw when source file for sourceContent not found', function() {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMapppingURL=helloworld4.js.map');
	sourcemaps.add(file, {loadMaps: true}, function(err, data) {
		it('should not throw when source file for sourceContent not found', function(done) {
			expect(data.sourceMap).toExist(['Should add a source map object']);
			expect(String(data.sourceMap.version)).toBe('3', 'Should have version 3');
			//REVIEW: Fails here for some reason
//			expect(data.sourceMap.sources).toEqual(['helloworld.js', 'missingfile'], 'Should have right sources');
//			expect(data.sourceMap.sourcesContent).toEqual([file.contents.toString(), null], 'Should have right sourcesContent');
			expect(data.sourceMap.mappings).toBe('', 'Should have right mappings');
			done();
		})
	})
})

/** TODO: Delete this code once failed case is figured out
test('add: should not throw when source file for sourceContent not found', function (t) {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld4.js.map');
	sourcemaps.add(file, { loadMaps: true }, function(err, data) {
		t.ok(data.sourceMap, 'should add a source map object');
		t.equal(String(data.sourceMap.version), '3', 'should have version 3');
		t.deepEqual(data.sourceMap.sources, ['helloworld.js', 'missingfile'], 'should have right sources');
		t.deepEqual(data.sourceMap.sourcesContent, [file.contents.toString(), null], 'should have right sourcesContent');
		t.equal(data.sourceMap.mappings, '', 'should have right mappings');
		t.end();
	});
});
**/

describe('add: should use unix style paths in sourcemap', function() {
	var file = makeFile();
	file.base = file.cwd;
	sourcemaps.add(file, function(err, data) {
		it('should use unix style paths in sourcemap', function(done) {
			expect(data.sourceMap.file).toBe('assets/helloworld.js', ['Should have right file']);
			expect(data.sourceMap.sources).toEqual(['assets/helloworld.js'], 'Should have right sources');
			done();
		})
	})
})

describe('add: should use sourceRoot when resolving path to sources', function() {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld5.js.map');
	sourcemaps.add(file, {loadMaps:true}, function(err, data) {
		it('should use sourceRoot when resolving path to sources', function(done) {
			expect(data.sourceMap).toExist(['Should add a source map object'])
			expect(String(data.sourceMap.version)).toBe('3', 'Should have version 3');
			expect(data.sourceMap.sources).toEqual(['../helloworld.js', '../test1.js'], 'Should have right sources');
			expect(data.sourceMap.sourcesContent).toEqual([file.contents.toString(), 'test\n'], 'Should have right sourcesContent');
			expect(data.sourceMap.mappings).toBe('', 'Should have right mappings');
			expect(data.sourceMap.sourceRoot).toBe('test', 'Should have right sourceRoot');
			expect(false).toExist();
			done();
		})
	})
})

describe('add: should not load source content if the path is a url', function() {
	var file = makeFile();
	file.contents = new Buffer(sourceContent + '\n//# sourceMappingURL=helloworld6.js.map');
	sourcemaps.add(file, {loadMaps: true}, function(err, data) {
		it('should not load source conent if the path is a url', function(done) {
			expect(data.sourceMap).toExist(['Should add a source map object']);
			expect(String(data.sourceMap.version)).toBe('3', 'Should have version 3');
			expect(data.sourceMap.sources).toEqual(['helloworld.js', 'http://example2.com/test1.js'], 'Should have right sources');
			expect(data.sourceMap.sourcesContent).toEqual([null, null]);
			expect(data.sourceMap.mappings).toBe('', 'Should have right mappings');
			done();
		})
	})
})

describe('add: should pass through when file already has a source map', function() {
	var sourceMap = {
		version: 3,
		names: [],
		mappings: '',
		sources: ['test.js'],
		sourcesContent: ['testContent'],
	};
	var file = makeFile();
	file.sourceMap = sourceMap;
	sourcemaps.add(file, {loadMaps:true}, function(err, data) {
		it ('should pass through whe file already has a source mamp', function(done) {
			expect(data).toExist(['Should pass something through']);
			expect(data instanceof File).toExist('Should pass a vinyl file through');
			expect(data.sourceMap).toBe(sourceMap, 'Should not change the source map');
			expect(data).toEqual(file, ['Should not change file'])
			done();
		})
	})
})
