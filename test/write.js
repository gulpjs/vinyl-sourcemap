'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var File = require('vinyl');
var expect = require('expect');

var sourcemaps = require('..');

var sourceContent = fs
  .readFileSync(path.join(__dirname, 'assets/helloworld.js'))
  .toString();

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

function makeFile(contents) {
  var file = new File({
    cwd: __dirname,
    base: path.join(__dirname, 'assets'),
    path: path.join(__dirname, 'assets', 'helloworld.js'),
    contents: contents,
    sourceMap: makeSourceMap(),
  });
  return file;
}

function makeNestedFile(contents) {
  var file = new File({
    cwd: __dirname,
    base: path.join(__dirname, 'assets'),
    path: path.join(__dirname, 'assets', 'dir1', 'dir2', 'helloworld.js'),
    contents: contents,
    sourceMap: makeSourceMap(),
  });
  return file;
}

function base64JSON(object) {
  return (
    'data:application/json;charset=utf-8;base64,' +
    Buffer.from(JSON.stringify(object)).toString('base64')
  );
}

describe('write', function () {
  it('errors if file argument is undefined', function (done) {
    sourcemaps.write(undefined, function (err) {
      expect(
        err instanceof Error &&
          err.message === 'vinyl-sourcemap-write: Not a vinyl file'
      ).toBeTruthy();
      done();
    });
  });

  it('errors if file argument is null', function (done) {
    sourcemaps.write(null, function (err) {
      expect(
        err instanceof Error &&
          err.message === 'vinyl-sourcemap-write: Not a vinyl file'
      ).toBeTruthy();
      done();
    });
  });

  it('errors if file argument is a plain object', function (done) {
    sourcemaps.write({}, function (err) {
      expect(
        err instanceof Error &&
          err.message === 'vinyl-sourcemap-write: Not a vinyl file'
      ).toBeTruthy();
      done();
    });
  });

  it('calls back with the untouched file if file contents are null', function (done) {
    var file = makeFile(null);
    sourcemaps.write(file, function (err, outFile) {
      expect(err).toBeFalsy();
      expect(file).toBeTruthy();
      expect(outFile).toEqual(file);
      done(err);
    });
  });
});

describe('write (buffer contents)', function () {
  it('does not error if file argument is a Vinyl object with Buffer contents', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, function (err) {
      expect(err).toBeFalsy();
      done();
    });
  });

  it('accepts null destPath argument', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, null, function (err) {
      expect(err).toBeFalsy();
      done(err);
    });
  });

  it('accepts undefined destPath argument', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, undefined, function (err) {
      expect(err).toBeFalsy();
      done(err);
    });
  });

  it('accepts string destPath argument', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, 'something', function (err) {
      expect(err).toBeFalsy();
      done(err);
    });
  });

  it('juggles callback if no destPath argument', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, function (err) {
      expect(err).toBeFalsy();
      done(err);
    });
  });

  it('calls back with the untouched file if sourceMap property does not exist', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    delete file.sourceMap;
    sourcemaps.write(file, function (err, outFile) {
      expect(err).toBeFalsy();
      expect(file).toBeTruthy();
      expect(outFile).toEqual(file);
      done(err);
    });
  });

  it('appends an inline sourcemap when no destPath', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, function (err, outFile, sourceMapFile) {
      expect(outFile).toBeTruthy();
      expect(sourceMapFile).toBeFalsy();
      expect(File.isVinyl(outFile)).toEqual(true);
      expect(outFile).toEqual(file);
      expect(outFile.contents.toString()).toEqual(
        sourceContent +
          '//# sourceMappingURL=' +
          base64JSON(outFile.sourceMap) +
          '\n'
      );
      done(err);
    });
  });

  it('writes /*# */ comment if .css extension', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.path = file.path.replace('.js', '.css');
    sourcemaps.write(file, function (err, outFile) {
      expect(outFile.contents.toString()).toEqual(
        sourceContent +
          '/*# sourceMappingURL=' +
          base64JSON(outFile.sourceMap) +
          ' */\n'
      );
      done(err);
    });
  });

  it('write //# comment if any non-.css extension', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.path = file.path.replace('.js', '.txt');
    sourcemaps.write(file, function (err, outFile) {
      expect(outFile.contents.toString()).toEqual(
        sourceContent +
          '//# sourceMappingURL=' +
          base64JSON(outFile.sourceMap) +
          '\n'
      );
      done(err);
    });
  });

  it('uses \\r\\n depending on the existing style', function (done) {
    var customContents = sourceContent.replace(/\n/g, '\r\n');
    var file = makeFile(Buffer.from(customContents));
    sourcemaps.write(file, function (err, outFile) {
      expect(outFile.contents.toString()).toEqual(
        customContents +
          '//# sourceMappingURL=' +
          base64JSON(outFile.sourceMap) +
          '\r\n'
      );
      done(err);
    });
  });

  it('uses \\r depending on the existing style', function (done) {
    var customContents = sourceContent.replace(/\n/g, '\r');
    var file = makeFile(Buffer.from(customContents));
    sourcemaps.write(file, function (err, updatedFile) {
      expect(updatedFile.contents.toString()).toEqual(
        customContents +
          '//# sourceMappingURL=' +
          base64JSON(updatedFile.sourceMap) +
          '\r'
      );
      done(err);
    });
  });

  it('uses os.EOL if no EOL in contents', function (done) {
    var customContents = sourceContent.replace(/\n/g, '');
    var file = makeFile(Buffer.from(customContents));
    sourcemaps.write(file, function (err, outFile) {
      expect(outFile.contents.toString()).toEqual(
        customContents +
          '//# sourceMappingURL=' +
          base64JSON(outFile.sourceMap) +
          os.EOL
      );
      done(err);
    });
  });

  it('writes an external sourcemap when given a destPath', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, '../maps', function (err, outFile, sourceMapFile) {
      expect(File.isVinyl(outFile)).toEqual(true);
      expect(outFile).toEqual(file);
      expect(outFile.contents.toString()).toEqual(
        sourceContent + '//# sourceMappingURL=../maps/helloworld.js.map\n'
      );

      expect(File.isVinyl(sourceMapFile)).toEqual(true);
      expect(sourceMapFile.path).toEqual(
        path.join(__dirname, 'maps/helloworld.js.map')
      );
      expect(JSON.parse(sourceMapFile.contents)).toEqual(outFile.sourceMap);
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

  it('create shortest path to map in file comment', function (done) {
    var file = makeNestedFile(Buffer.from(sourceContent));
    sourcemaps.write(file, 'dir1/maps', function (err, outFile) {
      expect(outFile.contents.toString()).toEqual(
        sourceContent +
          '//# sourceMappingURL=../maps/dir1/dir2/helloworld.js.map\n'
      );
      done(err);
    });
  });

  // TODO: need to figure out this test
  it.skip('normalizes Windows paths to unix style', function (done) {
    var file = makeNestedFile();
    file.path = file.path.replace(/\//g, '\\\\');
    console.log(file.path);
    sourcemaps.write(file, '..\\\\maps', function (err, outFile) {
      expect(outFile.contents).toEqual(
        sourceContent + '//# sourceMappingURL=../maps/helloworld.js.map\n'
      );
      done(err);
    });
  });

  // TODO: need to figure out this test
  it.skip('properly handles remote paths', function (done) {
    var file = makeNestedFile();
    sourcemaps.write(file, 'http://example.com', function (err, outFile) {
      expect(outFile.contents).toEqual(
        sourceContent +
          '//# sourceMappingURL=http://example.com/dir1/dir2/helloworld.js.map\n'
      );
      done(err);
    });
  });
});

function suite(moduleName) {
  var stream = require(moduleName);

  describe('write (' + moduleName + ' contents)', function () {
    function concat(fn, timeout) {
      var items = [];
      return new stream.Writable({
        objectMode: true,
        write: function (chunk, enc, cb) {
          if (typeof enc === 'function') {
            cb = enc;
          }
          setTimeout(function () {
            items.push(chunk);
            cb();
          }, timeout || 1);
        },
        final: function (cb) {
          if (typeof fn === 'function') {
            fn(items.join(''));
          }

          cb();
        },
      });
    }

    it('does not error if file argument is a Vinyl object with Stream contents', function (done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, function (err) {
        expect(err).toBeFalsy();
        done();
      });
    });

    it('accepts null destPath argument', function (done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, null, function (err) {
        expect(err).toBeFalsy();
        done(err);
      });
    });

    it('accepts undefined destPath argument', function (done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, undefined, function (err) {
        expect(err).toBeFalsy();
        done(err);
      });
    });

    it('accepts string destPath argument', function (done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, 'something', function (err) {
        expect(err).toBeFalsy();
        done(err);
      });
    });

    it('juggles callback if no destPath argument', function (done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, function (err) {
        expect(err).toBeFalsy();
        done(err);
      });
    });

    it('calls back with the untouched file if sourceMap property does not exist', function (done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      delete file.sourceMap;
      sourcemaps.write(file, function (err, outFile) {
        expect(err).toBeFalsy();
        expect(file).toBeTruthy();
        expect(outFile).toEqual(file);
        done(err);
      });
    });

    it('appends an inline sourcemap when no destPath', function (done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, function (err, updatedFile, sourceMapFile) {
        expect(err).toBeFalsy();
        expect(updatedFile).toBeTruthy();
        expect(sourceMapFile).toBeFalsy();
        expect(File.isVinyl(updatedFile)).toEqual(true);
        expect(updatedFile).toEqual(file);

        function assert(contents) {
          expect(contents).toEqual(
            sourceContent +
              '//# sourceMappingURL=' +
              base64JSON(updatedFile.sourceMap) +
              '\n'
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });

    it('appends /*# */ comment if .css extension', function (done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      file.path = file.path.replace('.js', '.css');
      sourcemaps.write(file, function (err, updatedFile) {
        expect(err).toBeFalsy();

        function assert(contents) {
          expect(contents).toEqual(
            sourceContent +
              '/*# sourceMappingURL=' +
              base64JSON(updatedFile.sourceMap) +
              ' */\n'
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });

    it('appends //# comment if any non-.css extension', function (done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      file.path = file.path.replace('.js', '.txt');
      sourcemaps.write(file, function (err, updatedFile) {
        expect(err).toBeFalsy();

        function assert(contents) {
          expect(contents).toEqual(
            sourceContent +
              '//# sourceMappingURL=' +
              base64JSON(updatedFile.sourceMap) +
              '\n'
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });

    it('uses \\r\\n depending on the existing style', function (done) {
      var customContents = sourceContent.replace(/\n/g, '\r\n');
      var file = makeFile(stream.Readable.from(customContents));
      sourcemaps.write(file, function (err, updatedFile) {
        expect(err).toBeFalsy();

        function assert(contents) {
          expect(contents).toEqual(
            customContents +
              '//# sourceMappingURL=' +
              base64JSON(updatedFile.sourceMap) +
              '\r\n'
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });

    it('only uses the final newline for the existing style', function (done) {
      var customContents = sourceContent.replace(/\n/, '\r\n');
      var file = makeFile(stream.Readable.from(customContents));
      sourcemaps.write(file, function (err, updatedFile) {
        expect(err).toBeFalsy();

        function assert(contents) {
          expect(contents).toEqual(
            customContents +
              '//# sourceMappingURL=' +
              base64JSON(updatedFile.sourceMap) +
              '\n'
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });

    it('uses \\r depending on the existing style', function (done) {
      var customContents = sourceContent.replace(/\n/g, '\r');
      var file = makeFile(stream.Readable.from(customContents));
      sourcemaps.write(file, function (err, updatedFile) {
        expect(err).toBeFalsy();

        function assert(contents) {
          expect(contents).toEqual(
            customContents +
              '//# sourceMappingURL=' +
              base64JSON(updatedFile.sourceMap) +
              '\r'
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });

    it('uses os.EOL if no EOL in contents', function (done) {
      var customContents = sourceContent.replace(/\n/g, '');
      var file = makeFile(stream.Readable.from(customContents));
      sourcemaps.write(file, function (err, updatedFile) {
        expect(err).toBeFalsy();

        function assert(contents) {
          expect(contents).toEqual(
            customContents +
              '//# sourceMappingURL=' +
              base64JSON(updatedFile.sourceMap) +
              os.EOL
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });

    it('also works with stream chunks that are buffers', function (done) {
      var customContents = sourceContent.replace(/\n/g, '\r\n');
      // We use the array here so readable-stream doesn't iterate the entire buffer by byte
      var file = makeFile(stream.Readable.from([Buffer.from(customContents)]));
      sourcemaps.write(file, function (err, updatedFile) {
        expect(err).toBeFalsy();

        function assert(contents) {
          expect(contents).toEqual(
            customContents +
              '//# sourceMappingURL=' +
              base64JSON(updatedFile.sourceMap) +
              '\r\n'
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });

    it('detects CRLF across chunks', function (done) {
      // Assumes to be 3 chunks but the last is an empty string
      var contentChunks = sourceContent.split('\n');
      var file = makeFile(
        stream.Readable.from([
          contentChunks[0],
          '\r\n',
          contentChunks[1] + '\r',
          '\n',
        ])
      );
      sourcemaps.write(file, function (err, updatedFile) {
        expect(err).toBeFalsy();

        function assert(contents) {
          expect(contents).toEqual(
            contentChunks.join('\r\n') +
              '//# sourceMappingURL=' +
              base64JSON(updatedFile.sourceMap) +
              '\r\n'
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });

    it('detects CR across chunks without any LF', function (done) {
      // Assumes to be 3 chunks but the last is an empty string
      var contentChunks = sourceContent.split('\n');
      var file = makeFile(
        stream.Readable.from([contentChunks[0], '\r', contentChunks[1] + '\r'])
      );
      sourcemaps.write(file, function (err, updatedFile) {
        expect(err).toBeFalsy();

        function assert(contents) {
          expect(contents).toEqual(
            contentChunks.join('\r') +
              '//# sourceMappingURL=' +
              base64JSON(updatedFile.sourceMap) +
              '\r'
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });

    it('writes an external sourcemap when given a destPath', function (done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(
        file,
        '../maps',
        function (err, updatedFile, sourceMapFile) {
          expect(err).toBeFalsy();

          expect(File.isVinyl(updatedFile)).toEqual(true);
          expect(updatedFile).toEqual(file);

          expect(File.isVinyl(sourceMapFile)).toEqual(true);
          expect(sourceMapFile.path).toEqual(
            path.join(__dirname, 'maps/helloworld.js.map')
          );
          expect(JSON.parse(sourceMapFile.contents)).toEqual(
            updatedFile.sourceMap
          );
          expect(sourceMapFile.stat.isFile()).toEqual(true);
          expect(sourceMapFile.stat.isDirectory()).toEqual(false);
          expect(sourceMapFile.stat.isBlockDevice()).toEqual(false);
          expect(sourceMapFile.stat.isCharacterDevice()).toEqual(false);
          expect(sourceMapFile.stat.isSymbolicLink()).toEqual(false);
          expect(sourceMapFile.stat.isFIFO()).toEqual(false);
          expect(sourceMapFile.stat.isSocket()).toEqual(false);

          function assert(contents) {
            expect(contents).toEqual(
              sourceContent + '//# sourceMappingURL=../maps/helloworld.js.map\n'
            );
          }

          stream.pipeline([updatedFile.contents, concat(assert)], done);
        }
      );
    });

    it('create shortest path to map in file comment', function (done) {
      var file = makeNestedFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, 'dir1/maps', function (err, updatedFile) {
        expect(err).toBeFalsy();

        function assert(contents) {
          expect(contents).toEqual(
            sourceContent +
              '//# sourceMappingURL=../maps/dir1/dir2/helloworld.js.map\n'
          );
        }

        stream.pipeline([updatedFile.contents, concat(assert)], done);
      });
    });
  });
}

suite('stream');
suite('streamx');
suite('readable-stream');
