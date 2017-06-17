'use strict';

var fs = require('fs');
var path = require('path');
var File = require('vinyl');
var expect = require('expect');
var miss = require('mississippi');

var sourcemaps = require('..');

var from = miss.from;

var sourceContent = fs.readFileSync(path.join(__dirname, 'assets/helloworld.js')).toString();

function makeSourceMap() {
  return {
    version: 3,
    file: 'helloworld.js',
    names: [],
    mappings: '',
    sources: ['helloworld.js'],
    sourcesContent: [sourceContent],
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
    contents: new Buffer(sourceContent),
  });
  file.sourceMap = makeSourceMap();
  return file;
}

function base64JSON(object) {
  return 'data:application/json;charset=utf-8;base64,' + new Buffer(JSON.stringify(object)).toString('base64');
}

describe('write', function() {

  it('errors if file argument is undefined', function(done) {
    sourcemaps.write(undefined, function(err) {
      expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
      done();
    });
  });

  it('errors if file argument is null', function(done) {
    sourcemaps.write(null, function(err) {
      expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
      done();
    });
  });

  it('errors if file argument is a plain object', function(done) {
    sourcemaps.write({}, function(err) {
      expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
      done();
    });
  });

  it('does not error if file argument is a Vinyl object with Buffer contents', function(done) {
    var file = makeFile();
    sourcemaps.write(file, function(err) {
      expect(err).toNotExist();
      done();
    });
  });

  it('errors if file argument is a Vinyl object with Stream contents', function(done) {
    var file = makeFile();
    file.contents = from([]);
    sourcemaps.write(file, function(err) {
      expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Streaming not supported').toExist();
      done();
    });
  });

  it('accepts null destPath argument', function(done) {
    var file = makeFile();
    sourcemaps.write(file, null, function(err) {
      expect(err).toNotExist();
      done(err);
    });
  });

  it('accepts undefined destPath argument', function(done) {
    var file = makeFile();
    sourcemaps.write(file, undefined, function(err) {
      expect(err).toNotExist();
      done(err);
    });
  });

  it('accepts string destPath argument', function(done) {
    var file = makeFile();
    sourcemaps.write(file, 'something', function(err) {
      expect(err).toNotExist();
      done(err);
    });
  });

  it('juggles callback if no destPath argument', function(done) {
    var file = makeFile();
    sourcemaps.write(file, function(err) {
      expect(err).toNotExist();
      done(err);
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

  it('calls back with the untouched file if file contents are null', function(done) {
    var file = makeFile();
    file.contents = null;
    sourcemaps.write(file, function(err, outFile) {
      expect(err).toNotExist();
      expect(file).toExist();
      expect(outFile).toEqual(file);
      done(err);
    });
  });

  it('writes an inline sourcemap when no destPath', function(done) {
    var file = makeFile();
    sourcemaps.write(file, function(err, updatedFile, sourceMapFile) {
      expect(updatedFile).toExist();
      expect(sourceMapFile).toNotExist();
      expect(File.isVinyl(updatedFile)).toEqual(true);
      expect(updatedFile).toEqual(file);
      expect(updatedFile.contents).toEqual(sourceContent + '//# sourceMappingURL=' + base64JSON(updatedFile.sourceMap) + '\n');
      done(err);
    });
  });

  it('writes /*# */ comment if .css extension', function(done) {
    var file = makeFile();
    file.path = file.path.replace('.js', '.css');
    sourcemaps.write(file, function(err, updatedFile) {
      expect(updatedFile.contents).toEqual(sourceContent + '/*# sourceMappingURL=' + base64JSON(updatedFile.sourceMap) + ' */\n');
      done(err);
    });
  });

  it('write \/\/# comment if any non-.css extension', function(done) {
    var file = makeFile();
    file.path = file.path.replace('.js', '.txt');
    sourcemaps.write(file, function(err, updatedFile) {
      expect(updatedFile.contents).toEqual(sourceContent + '//# sourceMappingURL=' + base64JSON(updatedFile.sourceMap) + '\n');
      done(err);
    });
  });

  it('uses \\n or \\r\\n depending on the existing style', function(done) {
    var file = makeFile();
    var customContents = sourceContent.replace(/\n/g, '\r\n');
    file.contents = new Buffer(customContents);
    sourcemaps.write(file, function(err, updatedFile) {
      expect(updatedFile.contents).toEqual(customContents + '//# sourceMappingURL=' + base64JSON(updatedFile.sourceMap) + '\r\n');
      done(err);
    });
  });

  it('writes an external sourcemap when given a destPath', function(done) {
    var file = makeFile();
    sourcemaps.write(file, '../maps', function(err, updatedFile, sourceMapFile) {
      expect(File.isVinyl(updatedFile)).toEqual(true);
      expect(updatedFile).toEqual(file);
      expect(updatedFile.contents).toEqual(sourceContent + '//# sourceMappingURL=../maps/helloworld.js.map\n');

      expect(File.isVinyl(sourceMapFile)).toEqual(true);
      expect(sourceMapFile.path).toEqual(path.join(__dirname, 'maps/helloworld.js.map'));
      expect(JSON.parse(sourceMapFile.contents)).toEqual(updatedFile.sourceMap);
      expect(sourceMapFile.stat.isFile()).toEqual(true);
      expect(sourceMapFile.stat.isDirectory()).toEqual(false);
      expect(sourceMapFile.stat.isBlockDevice()).toEqual(false);
      expect(sourceMapFile.stat.isCharacterDevice()).toEqual(false);
      expect(sourceMapFile.stat.isSymbolicLink()).toEqual(false);
      expect(sourceMapFile.stat.isFIFO()).toEqual(false);
      expect(sourceMapFile.stat.isSocket()).toEqual(false);

      done(err);
    });
  });

  it('create shortest path to map in file comment', function(done) {
    var file = makeNestedFile();
    sourcemaps.write(file, 'dir1/maps', function(err, updatedFile) {
      expect(updatedFile.contents).toEqual(sourceContent + '//# sourceMappingURL=../maps/dir1/dir2/helloworld.js.map\n');
      done(err);
    });
  });

  // TODO: need to figure out this test
  it.skip('normalizes Windows paths to unix style', function(done) {
    var file = makeNestedFile();
    file.path = file.path.replace(/\//g, '\\\\');
    console.log(file.path);
    sourcemaps.write(file, '..\\\\maps', function(err, updatedFile) {
      expect(updatedFile.contents).toEqual(sourceContent + '//# sourceMappingURL=../maps/helloworld.js.map\n');
      done(err);
    });
  });

  // TODO: need to figure out this test
  it.skip('properly handles remote paths', function(done) {
    var file = makeNestedFile();
    sourcemaps.write(file, 'http://example.com', function(err, updatedFile) {
      expect(updatedFile.contents).toEqual(sourceContent + '//# sourceMappingURL=http://example.com/dir1/dir2/helloworld.js.map\n');
      done(err);
    });
  });
});
