'use strict';

var fs = require('fs');
var File = require('vinyl');
var path = require('path');
var expect = require('expect');
var convert = require('convert-source-map');
var streamx = require('streamx');
var stream = require('stream');

var sourcemaps = require('..');

var sourceContent = fs.readFileSync(
  path.join(__dirname, 'assets/helloworld.js'),
  'utf-8'
);

function makeSourcemap() {
  return {
    file: 'all.js',
    mappings:
      'AAAAA,QAAAC,IAAA,YACAD,QAAAC,IAAA,YCDAD,QAAAC,IAAA,YACAD,QAAAC,IAAA',
    names: ['console', 'log'],
    sourceRoot: path.join(__dirname, 'assets'),
    sources: ['test1.js', 'test2.js'],
    sourcesContent: [
      'console.log("line 1.1");\nconsole.log("line 1.2");\n',
      'console.log("line 2.1");\nconsole.log("line 2.2");',
    ],
    version: 3,
  };
}

function makeFile(contents) {
  return new File({
    cwd: __dirname,
    base: path.join(__dirname, 'assets'),
    path: path.join(__dirname, 'assets', 'helloworld.js'),
    contents: contents,
  });
}

describe('add', function () {
  it('errors if file argument is undefined', function (done) {
    sourcemaps.add(undefined, function (err) {
      expect(
        err instanceof Error &&
          err.message === 'vinyl-sourcemap-add: Not a vinyl file'
      ).toBeTruthy();
      done();
    });
  });

  it('errors if file argument is null', function (done) {
    sourcemaps.add(null, function (err) {
      expect(
        err instanceof Error &&
          err.message === 'vinyl-sourcemap-add: Not a vinyl file'
      ).toBeTruthy();
      done();
    });
  });

  it('errors if file argument is a plain object', function (done) {
    sourcemaps.add({}, function (err) {
      expect(
        err instanceof Error &&
          err.message === 'vinyl-sourcemap-add: Not a vinyl file'
      ).toBeTruthy();
      done();
    });
  });

  it('errors if file argument is a Vinyl object with contents from streamx.Readable', function (done) {
    var file = makeFile(streamx.Readable.from([]));
    sourcemaps.add(file, function (err) {
      expect(
        err instanceof Error &&
          err.message === 'vinyl-sourcemap-add: Streaming not supported'
      ).toBeTruthy();
      done();
    });
  });

  it('errors if file argument is a Vinyl object with contents from stream.Readable', function (done) {
    var file = makeFile(stream.Readable.from([]));
    sourcemaps.add(file, function (err) {
      expect(
        err instanceof Error &&
          err.message === 'vinyl-sourcemap-add: Streaming not supported'
      ).toBeTruthy();
      done();
    });
  });

  it('calls back with the untouched file if file contents are null', function (done) {
    var file = makeFile(null);
    sourcemaps.add(file, function (err, outFile) {
      expect(err).toBeFalsy();
      expect(file).toBeTruthy();
      expect(outFile).toEqual(file);
      done(err);
    });
  });
});

describe('add (buffer contents)', function () {
  function makeFileWithInlineSourceMap() {
    var inline = convert.fromObject(makeSourcemap()).toComment();
    return new File({
      cwd: __dirname,
      base: path.join(__dirname, 'assets'),
      path: path.join(__dirname, 'assets', 'all.js'),
      contents: Buffer.from(
        'console.log("line 1.1"),console.log("line 1.2"),console.log("line 2.1"),console.log("line 2.2");\n' +
          inline
      ),
    });
  }

  it('does not error if file argument is a Vinyl object with Buffer contents', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.add(file, function (err) {
      expect(err).toBeFalsy();
      done();
    });
  });

  it('calls back with the untouched file if file already has a sourcemap', function (done) {
    var sourceMap = {
      version: 3,
      names: [],
      mappings: '',
      sources: ['test.js'],
      sourcesContent: ['testContent'],
    };

    var file = makeFile(Buffer.from(sourceContent));
    file.sourceMap = sourceMap;
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile).toBeTruthy();
      expect(File.isVinyl(outFile)).toEqual(true);
      expect(outFile.sourceMap).toBe(sourceMap);
      expect(outFile).toBe(file);
      done(err);
    });
  });

  it('adds an empty sourceMap if none are found', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.version).toEqual(3);
      expect(outFile.sourceMap.sources[0]).toEqual('helloworld.js');
      expect(outFile.sourceMap.sourcesContent[0]).toEqual(sourceContent);
      expect(outFile.sourceMap.names).toEqual([]);
      expect(outFile.sourceMap.mappings).toEqual('');
      done(err);
    });
  });

  it('imports an existing inline sourcemap', function (done) {
    var file = makeFileWithInlineSourceMap();
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.version).toEqual(3);
      expect(outFile.sourceMap.sources).toEqual(['test1.js', 'test2.js']);
      expect(outFile.sourceMap.sourcesContent).toEqual([
        'console.log("line 1.1");\nconsole.log("line 1.2");\n',
        'console.log("line 2.1");\nconsole.log("line 2.2");',
      ]);
      expect(outFile.sourceMap.mappings).toEqual(
        'AAAAA,QAAAC,IAAA,YACAD,QAAAC,IAAA,YCDAD,QAAAC,IAAA,YACAD,QAAAC,IAAA'
      );
      done(err);
    });
  });

  it('removes an imported inline sourcemap', function (done) {
    var file = makeFileWithInlineSourceMap();
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.contents.toString()).not.toMatch(/sourceMappingURL/);
      done(err);
    });
  });

  it('loads external sourcemap file from //# comment', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '//# sourceMappingURL=helloworld2.js.map')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.version).toEqual(3);
      expect(outFile.sourceMap.sources).toEqual(['helloworld2.js']);
      expect(outFile.sourceMap.sourcesContent).toEqual([
        'source content from source map',
      ]);
      expect(outFile.sourceMap.mappings).toEqual('');
      done(err);
    });
  });

  it('removes an imported sourcemap file //# comment', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '//# sourceMappingURL=helloworld2.js.map')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.contents.toString()).not.toMatch(/sourceMappingURL/);
      done(err);
    });
  });

  it('loads external sourcemap file from //@ comment', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '//@ sourceMappingURL=helloworld2.js.map')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.version).toEqual(3);
      expect(outFile.sourceMap.sources).toEqual(['helloworld2.js']);
      expect(outFile.sourceMap.sourcesContent).toEqual([
        'source content from source map',
      ]);
      expect(outFile.sourceMap.mappings).toEqual('');
      done(err);
    });
  });

  it('removes an imported sourcemap file //@ comment', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '//@ sourceMappingURL=helloworld2.js.map')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.contents.toString()).not.toMatch(/sourceMappingURL/);
      done(err);
    });
  });

  it('loads external sourcemap file from /*# */ comment', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '/*# sourceMappingURL=helloworld2.js.map */')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.version).toEqual(3);
      expect(outFile.sourceMap.sources).toEqual(['helloworld2.js']);
      expect(outFile.sourceMap.sourcesContent).toEqual([
        'source content from source map',
      ]);
      expect(outFile.sourceMap.mappings).toEqual('');
      done(err);
    });
  });

  it('removes an imported sourcemap file /*# */ comment', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '/*# sourceMappingURL=helloworld2.js.map */')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.contents.toString()).not.toMatch(/sourceMappingURL/);
      done(err);
    });
  });

  it('loads external sourcemap file from /*@ */ comment', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '/*@ sourceMappingURL=helloworld2.js.map */')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.version).toEqual(3);
      expect(outFile.sourceMap.sources).toEqual(['helloworld2.js']);
      expect(outFile.sourceMap.sourcesContent).toEqual([
        'source content from source map',
      ]);
      expect(outFile.sourceMap.mappings).toEqual('');
      done(err);
    });
  });

  it('removes an imported sourcemap file /*@ */ comment', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '/*@ sourceMappingURL=helloworld2.js.map */')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.contents.toString()).not.toMatch(/sourceMappingURL/);
      done(err);
    });
  });

  it('loads external sourcemap by filename if no source mapping comment', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.path = file.path.replace('helloworld.js', 'helloworld2.js');
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.version).toEqual(3);
      expect(outFile.sourceMap.sources).toEqual(['helloworld2.js']);
      expect(outFile.sourceMap.sourcesContent).toEqual([
        'source content from source map',
      ]);
      expect(outFile.sourceMap.mappings).toEqual('');
      done(err);
    });
  });

  it('loads sourcesContent if missing', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '//# sourceMappingURL=helloworld3.js.map')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.sourcesContent).toEqual([
        content,
        "console.log('test1');\n",
      ]);
      done(err);
    });
  });

  it('does not error when source file for sourcesContent not found', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '//# sourceMappingURL=helloworld4.js.map')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(err).toBeFalsy();
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.sources).toEqual([
        'helloworld.js',
        'missingfile',
      ]);
      expect(outFile.sourceMap.sourcesContent).toEqual([content, null]);
      done(err);
    });
  });

  it('uses unix style paths in sourcemap', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.base = file.cwd;
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.file).toEqual('assets/helloworld.js');
      expect(outFile.sourceMap.sources).toEqual(['assets/helloworld.js']);
      done(err);
    });
  });

  it('normalizes Windows paths in sources to unix paths', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '//# sourceMappingURL=helloworld8.js.map')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.sources).toEqual([
        '../helloworld.js',
        '../test1.js',
      ]);
      done(err);
    });
  });

  it('sets file.relative as file property in sourcemap', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.stem = 'brandnew';
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.file).toEqual('brandnew.js');
      done(err);
    });
  });

  it('normalizes Windows paths in file.relative before using in sourcemap', function (done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.stem = 'assets\\\\brandnew';
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.file).toEqual('assets/brandnew.js');
      done(err);
    });
  });

  it('uses relative sourceRoot to resolve sources', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '//# sourceMappingURL=helloworld5.js.map')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.sourceRoot).toEqual('test');
      expect(outFile.sourceMap.sourcesContent).toEqual([
        content,
        "console.log('test1');\n",
      ]);
      done(err);
    });
  });

  it('uses absolute sourceRoot to resolve sources', function (done) {
    var map = convert.fromObject(makeSourcemap());
    delete map.sourcemap.sourcesContent;
    var inline = map.toComment();
    var content = sourceContent + '\n';
    var file = makeFile(Buffer.from(content + inline));
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.sourceRoot).toEqual(
        path.join(__dirname, 'assets')
      );
      expect(outFile.sourceMap.sourcesContent).toEqual([
        "console.log('test1');\n",
        "console.log('test2');\n",
      ]);
      done(err);
    });
  });

  it('does not load sourcesContent when sourceRoot is a url', function (done) {
    var content = sourceContent + '\n';
    var file = makeFile(
      Buffer.from(content + '//# sourceMappingURL=helloworld6.js.map')
    );
    sourcemaps.add(file, function (err, outFile) {
      expect(outFile.sourceMap).toBeTruthy();
      expect(outFile.sourceMap.sourceRoot).toEqual('http://example.com/');
      expect(outFile.sourceMap.sourcesContent).toEqual([null, null]);
      done(err);
    });
  });
});
