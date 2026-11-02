"use strict";

var fs = require("node:fs");
var path = require("node:path");
var assert = require("node:assert");
var { describe, it } = require("node:test");

var File = require("vinyl");

var convert = require("convert-source-map");

var sourcemaps = require("..");

var sourceContent = fs.readFileSync(
  path.join(__dirname, "assets/helloworld.js"),
  "utf-8",
);

function makeSourcemap() {
  return {
    file: "all.js",
    mappings:
      "AAAAA,QAAAC,IAAA,YACAD,QAAAC,IAAA,YCDAD,QAAAC,IAAA,YACAD,QAAAC,IAAA",
    names: ["console", "log"],
    sourceRoot: path.join(__dirname, "assets"),
    sources: ["test1.js", "test2.js"],
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
    base: path.join(__dirname, "assets"),
    path: path.join(__dirname, "assets", "helloworld.js"),
    contents: contents,
  });
}

describe("add", function () {
  it("errors if file argument is undefined", function (t, done) {
    sourcemaps.add(undefined, function (err) {
      assert.ok(err instanceof Error);
      assert.strictEqual(err.message, "vinyl-sourcemap-add: Not a vinyl file");
      done();
    });
  });

  it("errors if file argument is null", function (t, done) {
    sourcemaps.add(null, function (err) {
      assert.ok(err instanceof Error);
      assert.strictEqual(err.message, "vinyl-sourcemap-add: Not a vinyl file");
      done();
    });
  });

  it("errors if file argument is a plain object", function (t, done) {
    sourcemaps.add({}, function (err) {
      assert.ok(err instanceof Error);
      assert.strictEqual(err.message, "vinyl-sourcemap-add: Not a vinyl file");
      done();
    });
  });

  it("calls back with the untouched file if file contents are null", function (t, done) {
    var file = makeFile(null);
    sourcemaps.add(file, function (err, outFile) {
      assert.ifError(err);
      assert.ok(file);
      assert.strictEqual(outFile, file);
      done(err);
    });
  });
});

describe("add (buffer contents)", function () {
  function makeFileWithInlineSourceMap() {
    var inline = convert.fromObject(makeSourcemap()).toComment();
    return new File({
      cwd: __dirname,
      base: path.join(__dirname, "assets"),
      path: path.join(__dirname, "assets", "all.js"),
      contents: Buffer.from(
        'console.log("line 1.1"),console.log("line 1.2"),console.log("line 2.1"),console.log("line 2.2");\n' +
          inline,
      ),
    });
  }

  it("does not error if file argument is a Vinyl object with Buffer contents", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.add(file, function (err) {
      assert.ifError(err);
      done();
    });
  });

  it("calls back with the untouched file if file already has a sourcemap", function (t, done) {
    var sourceMap = {
      version: 3,
      names: [],
      mappings: "",
      sources: ["test.js"],
      sourcesContent: ["testContent"],
    };

    var file = makeFile(Buffer.from(sourceContent));
    file.sourceMap = sourceMap;
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile);
      assert.strictEqual(File.isVinyl(outFile), true);
      assert.strictEqual(outFile.sourceMap, sourceMap);
      assert.strictEqual(outFile, file);
      done(err);
    });
  });

  it("adds an empty sourceMap if none are found", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(outFile.sourceMap.version, 3);
      assert.strictEqual(outFile.sourceMap.sources[0], "helloworld.js");
      assert.strictEqual(outFile.sourceMap.sourcesContent[0], sourceContent);
      assert.deepStrictEqual(outFile.sourceMap.names, []);
      assert.strictEqual(outFile.sourceMap.mappings, "");
      done(err);
    });
  });

  it("imports an existing inline sourcemap", function (t, done) {
    var file = makeFileWithInlineSourceMap();
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(outFile.sourceMap.version, 3);
      assert.deepStrictEqual(outFile.sourceMap.sources, [
        "test1.js",
        "test2.js",
      ]);
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
        'console.log("line 1.1");\nconsole.log("line 1.2");\n',
        'console.log("line 2.1");\nconsole.log("line 2.2");',
      ]);
      assert.strictEqual(
        outFile.sourceMap.mappings,
        "AAAAA,QAAAC,IAAA,YACAD,QAAAC,IAAA,YCDAD,QAAAC,IAAA,YACAD,QAAAC,IAAA",
      );
      done(err);
    });
  });

  it("removes an imported inline sourcemap", function (t, done) {
    var file = makeFileWithInlineSourceMap();
    sourcemaps.add(file, function (err, outFile) {
      assert.doesNotMatch(outFile.contents.toString(), /sourceMappingURL/);
      done(err);
    });
  });

  it("loads external sourcemap file from //# comment", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "//# sourceMappingURL=helloworld2.js.map"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(outFile.sourceMap.version, 3);
      assert.deepStrictEqual(outFile.sourceMap.sources, ["helloworld2.js"]);
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
        "source content from source map",
      ]);
      assert.strictEqual(outFile.sourceMap.mappings, "");
      done(err);
    });
  });

  it("removes an imported sourcemap file //# comment", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "//# sourceMappingURL=helloworld2.js.map"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.doesNotMatch(outFile.contents.toString(), /sourceMappingURL/);
      done(err);
    });
  });

  it("loads external sourcemap file from //@ comment", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "//@ sourceMappingURL=helloworld2.js.map"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(outFile.sourceMap.version, 3);
      assert.deepStrictEqual(outFile.sourceMap.sources, ["helloworld2.js"]);
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
        "source content from source map",
      ]);
      assert.strictEqual(outFile.sourceMap.mappings, "");
      done(err);
    });
  });

  it("removes an imported sourcemap file //@ comment", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "//@ sourceMappingURL=helloworld2.js.map"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.doesNotMatch(outFile.contents.toString(), /sourceMappingURL/);
      done(err);
    });
  });

  it("loads external sourcemap file from /*# */ comment", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "/*# sourceMappingURL=helloworld2.js.map */"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(outFile.sourceMap.version, 3);
      assert.deepStrictEqual(outFile.sourceMap.sources, ["helloworld2.js"]);
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
        "source content from source map",
      ]);
      assert.strictEqual(outFile.sourceMap.mappings, "");
      done(err);
    });
  });

  it("removes an imported sourcemap file /*# */ comment", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "/*# sourceMappingURL=helloworld2.js.map */"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.doesNotMatch(outFile.contents.toString(), /sourceMappingURL/);
      done(err);
    });
  });

  it("loads external sourcemap file from /*@ */ comment", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "/*@ sourceMappingURL=helloworld2.js.map */"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(outFile.sourceMap.version, 3);
      assert.deepStrictEqual(outFile.sourceMap.sources, ["helloworld2.js"]);
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
        "source content from source map",
      ]);
      assert.strictEqual(outFile.sourceMap.mappings, "");
      done(err);
    });
  });

  it("removes an imported sourcemap file /*@ */ comment", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "/*@ sourceMappingURL=helloworld2.js.map */"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.doesNotMatch(outFile.contents.toString(), /sourceMappingURL/);
      done(err);
    });
  });

  it("loads external sourcemap by filename if no source mapping comment", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.path = file.path.replace("helloworld.js", "helloworld2.js");
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(outFile.sourceMap.version, 3);
      assert.deepStrictEqual(outFile.sourceMap.sources, ["helloworld2.js"]);
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
        "source content from source map",
      ]);
      assert.strictEqual(outFile.sourceMap.mappings, "");
      done(err);
    });
  });

  it("loads sourcesContent if missing", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "//# sourceMappingURL=helloworld3.js.map"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
        content,
        'console.log("test1");\n',
      ]);
      done(err);
    });
  });

  it("does not error when source file for sourcesContent not found", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "//# sourceMappingURL=helloworld4.js.map"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.ifError(err);
      assert.ok(outFile.sourceMap);
      assert.deepStrictEqual(outFile.sourceMap.sources, [
        "helloworld.js",
        "missingfile",
      ]);
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [content, null]);
      done(err);
    });
  });

  it("uses unix style paths in sourcemap", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.base = file.cwd;
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(outFile.sourceMap.file, "assets/helloworld.js");
      assert.deepStrictEqual(outFile.sourceMap.sources, [
        "assets/helloworld.js",
      ]);
      done(err);
    });
  });

  it("normalizes Windows paths in sources to unix paths", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "//# sourceMappingURL=helloworld8.js.map"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.deepStrictEqual(outFile.sourceMap.sources, [
        "../helloworld.js",
        "../test1.js",
      ]);
      done(err);
    });
  });

  it("sets file.relative as file property in sourcemap", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.stem = "brandnew";
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.deepStrictEqual(outFile.sourceMap.file, "brandnew.js");
      done(err);
    });
  });

  it("normalizes Windows paths in file.relative before using in sourcemap", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.stem = "assets\\\\brandnew";
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.deepStrictEqual(outFile.sourceMap.file, "assets/brandnew.js");
      done(err);
    });
  });

  it("uses relative sourceRoot to resolve sources", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "//# sourceMappingURL=helloworld5.js.map"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(outFile.sourceMap.sourceRoot, "test");
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
        content,
        'console.log("test1");\n',
      ]);
      done(err);
    });
  });

  it("uses absolute sourceRoot to resolve sources", function (t, done) {
    var map = convert.fromObject(makeSourcemap());
    delete map.sourcemap.sourcesContent;
    var inline = map.toComment();
    var content = sourceContent + "\n";
    var file = makeFile(Buffer.from(content + inline));
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(
        outFile.sourceMap.sourceRoot,
        path.join(__dirname, "assets"),
      );
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
        'console.log("test1");\n',
        'console.log("test2");\n',
      ]);
      done(err);
    });
  });

  it("does not load sourcesContent when sourceRoot is a url", function (t, done) {
    var content = sourceContent + "\n";
    var file = makeFile(
      Buffer.from(content + "//# sourceMappingURL=helloworld6.js.map"),
    );
    sourcemaps.add(file, function (err, outFile) {
      assert.ok(outFile.sourceMap);
      assert.strictEqual(outFile.sourceMap.sourceRoot, "http://example.com/");
      assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [null, null]);
      done(err);
    });
  });
});

function suite(moduleName) {
  var stream = require(moduleName);

  describe("add (" + moduleName + " contents)", function () {
    function concat(fn, timeout) {
      var items = [];
      return new stream.Writable({
        objectMode: true,
        write: function (chunk, enc, cb) {
          if (typeof enc === "function") {
            cb = enc;
          }
          setTimeout(function () {
            items.push(chunk);
            cb();
          }, timeout || 1);
        },
        final: function (cb) {
          if (typeof fn === "function") {
            fn(items.join(""));
          }

          cb();
        },
      });
    }

    function makeFileWithInlineSourceMap() {
      var inline = convert.fromObject(makeSourcemap()).toComment();
      return new File({
        cwd: __dirname,
        base: path.join(__dirname, "assets"),
        path: path.join(__dirname, "assets", "all.js"),
        contents: stream.Readable.from(
          'console.log("line 1.1"),console.log("line 1.2"),console.log("line 2.1"),console.log("line 2.2");\n' +
            inline,
        ),
      });
    }

    it("does not error if file argument is a Vinyl object with Stream contents", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.add(file, function (err) {
        assert.ifError(err);
        done();
      });
    });

    it("surfaces an error from the stream", function (t, done) {
      var file = makeFile(
        new stream.Readable({
          read: function (cb) {
            var err = new Error("boom");
            if (typeof cb === "function") {
              cb(err);
            } else {
              this.destroy(err);
            }
          },
        }),
      );
      sourcemaps.add(file, function (err) {
        assert.ok(err);
        assert.strictEqual(err.message, "boom");
        done();
      });
    });

    it("keeps the contents as a stream after processing sourceMaps", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile);
        assert.strictEqual(File.isVinyl(outFile), true);
        assert.strictEqual(file.isStream(), true);
        done(err);
      });
    });

    it("calls back with the untouched file if file already has a sourcemap", function (t, done) {
      var sourceMap = {
        version: 3,
        names: [],
        mappings: "",
        sources: ["test.js"],
        sourcesContent: ["testContent"],
      };

      var file = makeFile(stream.Readable.from(sourceContent));
      file.sourceMap = sourceMap;
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile);
        assert.strictEqual(File.isVinyl(outFile), true);
        assert.strictEqual(outFile.sourceMap, sourceMap);
        assert.strictEqual(outFile, file);
        done(err);
      });
    });

    it("adds an empty sourceMap if none are found", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.version, 3);
        assert.strictEqual(outFile.sourceMap.sources[0], "helloworld.js");
        assert.strictEqual(outFile.sourceMap.sourcesContent[0], sourceContent);
        assert.deepStrictEqual(outFile.sourceMap.names, []);
        assert.strictEqual(outFile.sourceMap.mappings, "");
        done(err);
      });
    });

    it("imports an existing inline sourcemap", function (t, done) {
      var file = makeFileWithInlineSourceMap();
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.version, 3);
        assert.deepStrictEqual(outFile.sourceMap.sources, [
          "test1.js",
          "test2.js",
        ]);
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
          'console.log("line 1.1");\nconsole.log("line 1.2");\n',
          'console.log("line 2.1");\nconsole.log("line 2.2");',
        ]);
        assert.strictEqual(
          outFile.sourceMap.mappings,
          "AAAAA,QAAAC,IAAA,YACAD,QAAAC,IAAA,YCDAD,QAAAC,IAAA,YACAD,QAAAC,IAAA",
        );
        done(err);
      });
    });

    it("removes an imported inline sourcemap", function (t, done) {
      var file = makeFileWithInlineSourceMap();
      sourcemaps.add(file, function (err, outFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.doesNotMatch(contents, /sourceMappingURL/);
        }

        stream.pipeline([outFile.contents, concat(assertion)], done);
      });
    });

    it("loads external sourcemap file from //# comment", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "//# sourceMappingURL=helloworld2.js.map",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.version, 3);
        assert.deepStrictEqual(outFile.sourceMap.sources, ["helloworld2.js"]);
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
          "source content from source map",
        ]);
        assert.strictEqual(outFile.sourceMap.mappings, "");
        done(err);
      });
    });

    it("removes an imported sourcemap file //# comment", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "//# sourceMappingURL=helloworld2.js.map",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.doesNotMatch(contents, /sourceMappingURL/);
        }

        stream.pipeline([outFile.contents, concat(assertion)], done);
      });
    });

    it("loads external sourcemap file from //@ comment", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "//@ sourceMappingURL=helloworld2.js.map",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.version, 3);
        assert.deepStrictEqual(outFile.sourceMap.sources, ["helloworld2.js"]);
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
          "source content from source map",
        ]);
        assert.strictEqual(outFile.sourceMap.mappings, "");
        done(err);
      });
    });

    it("removes an imported sourcemap file //@ comment", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "//@ sourceMappingURL=helloworld2.js.map",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.doesNotMatch(contents, /sourceMappingURL/);
        }

        stream.pipeline([outFile.contents, concat(assertion)], done);
      });
    });

    it("loads external sourcemap file from /*# */ comment", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "/*# sourceMappingURL=helloworld2.js.map */",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.version, 3);
        assert.deepStrictEqual(outFile.sourceMap.sources, ["helloworld2.js"]);
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
          "source content from source map",
        ]);
        assert.strictEqual(outFile.sourceMap.mappings, "");
        done(err);
      });
    });

    it("removes an imported sourcemap file /*# */ comment", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "/*# sourceMappingURL=helloworld2.js.map */",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.doesNotMatch(contents, /sourceMappingURL/);
        }

        stream.pipeline([outFile.contents, concat(assertion)], done);
      });
    });

    it("loads external sourcemap file from /*@ */ comment", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "/*@ sourceMappingURL=helloworld2.js.map */",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.version, 3);
        assert.deepStrictEqual(outFile.sourceMap.sources, ["helloworld2.js"]);
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
          "source content from source map",
        ]);
        assert.strictEqual(outFile.sourceMap.mappings, "");
        done(err);
      });
    });

    it("removes an imported sourcemap file /*@ */ comment", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "/*@ sourceMappingURL=helloworld2.js.map */",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.doesNotMatch(contents, /sourceMappingURL/);
        }

        stream.pipeline([outFile.contents, concat(assertion)], done);
      });
    });

    it("loads external sourcemap by filename if no source mapping comment", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      file.path = file.path.replace("helloworld.js", "helloworld2.js");
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.version, 3);
        assert.deepStrictEqual(outFile.sourceMap.sources, ["helloworld2.js"]);
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
          "source content from source map",
        ]);
        assert.strictEqual(outFile.sourceMap.mappings, "");
        done(err);
      });
    });

    it("loads sourcesContent if missing", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "//# sourceMappingURL=helloworld3.js.map",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
          content,
          'console.log("test1");\n',
        ]);
        done(err);
      });
    });

    it("does not error when source file for sourcesContent not found", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "//# sourceMappingURL=helloworld4.js.map",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.deepStrictEqual(outFile.sourceMap.sources, [
          "helloworld.js",
          "missingfile",
        ]);
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
          content,
          null,
        ]);
        done(err);
      });
    });

    it("uses unix style paths in sourcemap", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      file.base = file.cwd;
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.file, "assets/helloworld.js");
        assert.deepStrictEqual(outFile.sourceMap.sources, [
          "assets/helloworld.js",
        ]);
        done(err);
      });
    });

    it("normalizes Windows paths in sources to unix paths", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "//# sourceMappingURL=helloworld8.js.map",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.deepStrictEqual(outFile.sourceMap.sources, [
          "../helloworld.js",
          "../test1.js",
        ]);
        done(err);
      });
    });

    it("sets file.relative as file property in sourcemap", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      file.stem = "brandnew";
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.file, "brandnew.js");
        done(err);
      });
    });

    it("normalizes Windows paths in file.relative before using in sourcemap", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      file.stem = "assets\\\\brandnew";
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.file, "assets/brandnew.js");
        done(err);
      });
    });

    it("uses relative sourceRoot to resolve sources", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "//# sourceMappingURL=helloworld5.js.map",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.sourceRoot, "test");
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
          content,
          'console.log("test1");\n',
        ]);
        done(err);
      });
    });

    it("uses absolute sourceRoot to resolve sources", function (t, done) {
      var map = convert.fromObject(makeSourcemap());
      delete map.sourcemap.sourcesContent;
      var inline = map.toComment();
      var content = sourceContent + "\n";
      var file = makeFile(stream.Readable.from(content + inline));
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(
          outFile.sourceMap.sourceRoot,
          path.join(__dirname, "assets"),
        );
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [
          'console.log("test1");\n',
          'console.log("test2");\n',
        ]);
        done(err);
      });
    });

    it("does not load sourcesContent when sourceRoot is a url", function (t, done) {
      var content = sourceContent + "\n";
      var file = makeFile(
        stream.Readable.from(
          content + "//# sourceMappingURL=helloworld6.js.map",
        ),
      );
      sourcemaps.add(file, function (err, outFile) {
        assert.ok(outFile.sourceMap);
        assert.strictEqual(outFile.sourceMap.sourceRoot, "http://example.com/");
        assert.deepStrictEqual(outFile.sourceMap.sourcesContent, [null, null]);
        done(err);
      });
    });
  });
}

suite("stream");
suite("streamx");
suite("readable-stream");
