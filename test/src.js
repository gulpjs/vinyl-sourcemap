'use strict';

var test = require('tape');
var File = require('vinyl');
var sourcemaps = require('..');
var path = require('path');
var fs = require('fs');
var vfs = require('vinyl-fs');

var filePath = path.join(__dirname, 'assets/helloworld.js');
var sourceContent = fs.readFileSync(filePath).toString();

test('src: should add an empty source map', function (t) {
	var source = vfs.src(filePath);
	source.pipe(sourcemaps.src())
		.on('data', function (data) {
			t.ok(data, 'should pass something through');
			t.ok(data instanceof File, 'should pass a vinyl file through');
			t.ok(data.sourceMap, 'should add a source map object');
			t.equal(data.sourceMap.sources[0], 'helloworld.js', 'should add file to sources');
			t.equal(String(data.sourceMap.version), '3', 'should have version 3');
			t.equal(data.sourceMap.sourcesContent[0], sourceContent, 'should add file content to sourcesContent');
			t.deepEqual(data.sourceMap.names, [], 'should add empty names');
			t.equal(data.sourceMap.mappings, '', 'should add empty mappings');
			t.end();
		})
		.on('error', function () {
			t.fail('emitted error');
			t.end();
		});
});

test('src: should add a valid source map if wished', function(t) {
	var source = vfs.src(filePath);
	source.pipe(sourcemaps.src({ identityMap: true }))
		.on('data', function(data) {
			t.ok(data, 'should pass something through');
			t.ok(data instanceof File, 'should pass a vinyl file through');
			t.ok(data.sourceMap, 'should add a source map object');
			t.equal(String(data.sourceMap.version), '3', 'should have version 3');
			t.equal(data.sourceMap.sources[0], 'helloworld.js', 'should add file to sources');
			t.equal(data.sourceMap.sourcesContent[0], sourceContent, 'should add file content to sourcesContent');
			t.deepEqual(data.sourceMap.names, ['helloWorld', 'console', 'log'], 'should add correct names');
			t.equal(data.sourceMap.mappings, 'AAAA,YAAY;;AAEZ,SAASA,UAAU,CAAC,EAAE;CACrBC,OAAO,CAACC,GAAG,CAAC,cAAc,CAAC;AAC5B', 'should add correct mappings');
			t.end();
		})
		.on('error', function() {
			t.fail('emitted error');
			t.end();
		});
});
