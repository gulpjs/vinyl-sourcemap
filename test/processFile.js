'use strict';

var test = require('tape');
var sourcemaps = require('..');

test('processFile: should throw an error when no valid vinyl file is provided', function (t) {
	try {
		sourcemaps.processFile(null);
	} catch (err) {
		t.ok(err instanceof Error, 'should not accept null as first argument');
		t.end();
	}
});
