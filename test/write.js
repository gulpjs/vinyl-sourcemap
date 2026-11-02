"use strict";

var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var assert = require("node:assert");
var { describe, it } = require("node:test");

var File = require("vinyl");

var sourcemaps = require("..");

var sourceContent = fs
  .readFileSync(path.join(__dirname, "assets/helloworld.js"))
  .toString();

function makeSourceMap() {
  return {
    version: 3,
    file: "helloworld.js",
    names: [],
    mappings: "",
    sources: ["helloworld.js"],
    sourcesContent: [sourceContent],
  };
}

function makeFile(contents) {
  var file = new File({
    cwd: __dirname,
    base: path.join(__dirname, "assets"),
    path: path.join(__dirname, "assets", "helloworld.js"),
    contents: contents,
    sourceMap: makeSourceMap(),
  });
  return file;
}

function makeNestedFile(contents) {
  var file = new File({
    cwd: __dirname,
    base: path.join(__dirname, "assets"),
    path: path.join(__dirname, "assets", "dir1", "dir2", "helloworld.js"),
    contents: contents,
    sourceMap: makeSourceMap(),
  });
  return file;
}

function base64JSON(object) {
  return (
    "data:application/json;charset=utf-8;base64," +
    Buffer.from(JSON.stringify(object)).toString("base64")
  );
}

describe("write", function () {
  it("errors if file argument is undefined", function (t, done) {
    sourcemaps.write(undefined, function (err) {
      assert.ok(err instanceof Error);
      assert.strictEqual(
        err.message,
        "vinyl-sourcemap-write: Not a vinyl file",
      );
      done();
    });
  });

  it("errors if file argument is null", function (t, done) {
    sourcemaps.write(null, function (err) {
      assert.ok(err instanceof Error);
      assert.strictEqual(
        err.message,
        "vinyl-sourcemap-write: Not a vinyl file",
      );
      done();
    });
  });

  it("errors if file argument is a plain object", function (t, done) {
    sourcemaps.write({}, function (err) {
      assert.ok(err instanceof Error);
      assert.strictEqual(
        err.message,
        "vinyl-sourcemap-write: Not a vinyl file",
      );
      done();
    });
  });

  it("calls back with the untouched file if file contents are null", function (t, done) {
    var file = makeFile(null);
    sourcemaps.write(file, function (err, outFile) {
      assert.ifError(err);
      assert.strictEqual(outFile, file);
      done(err);
    });
  });
});

describe("write (buffer contents)", function () {
  it("does not error if file argument is a Vinyl object with Buffer contents", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, function (err) {
      assert.ifError(err);
      done();
    });
  });

  it("accepts null destPath argument", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, null, function (err) {
      assert.ifError(err);
      done(err);
    });
  });

  it("accepts undefined destPath argument", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, undefined, function (err) {
      assert.ifError(err);
      done(err);
    });
  });

  it("accepts string destPath argument", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, "something", function (err) {
      assert.ifError(err);
      done(err);
    });
  });

  it("juggles callback if no destPath argument", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, function (err) {
      assert.ifError(err);
      done(err);
    });
  });

  it("calls back with the untouched file if sourceMap property does not exist", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    delete file.sourceMap;
    sourcemaps.write(file, function (err, outFile) {
      assert.ifError(err);
      assert.strictEqual(outFile, file);
      done(err);
    });
  });

  it("appends an inline sourcemap when no destPath", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, function (err, outFile, sourceMapFile) {
      assert.ok(outFile);
      assert.strictEqual(sourceMapFile, undefined);
      assert.strictEqual(File.isVinyl(outFile), true);
      assert.strictEqual(outFile, file);
      assert.strictEqual(
        outFile.contents.toString(),
        sourceContent +
          "//# sourceMappingURL=" +
          base64JSON(outFile.sourceMap) +
          "\n",
      );
      done(err);
    });
  });

  it("writes /*# */ comment if .css extension", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.path = file.path.replace(".js", ".css");
    sourcemaps.write(file, function (err, outFile) {
      assert.strictEqual(
        outFile.contents.toString(),
        sourceContent +
          "/*# sourceMappingURL=" +
          base64JSON(outFile.sourceMap) +
          " */\n",
      );
      done(err);
    });
  });

  it("write //# comment if any non-.css extension", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    file.path = file.path.replace(".js", ".txt");
    sourcemaps.write(file, function (err, outFile) {
      assert.strictEqual(
        outFile.contents.toString(),
        sourceContent +
          "//# sourceMappingURL=" +
          base64JSON(outFile.sourceMap) +
          "\n",
      );
      done(err);
    });
  });

  it("uses \\r\\n depending on the existing style", function (t, done) {
    var customContents = sourceContent.replace(/\n/g, "\r\n");
    var file = makeFile(Buffer.from(customContents));
    sourcemaps.write(file, function (err, outFile) {
      assert.strictEqual(
        outFile.contents.toString(),
        customContents +
          "//# sourceMappingURL=" +
          base64JSON(outFile.sourceMap) +
          "\r\n",
      );
      done(err);
    });
  });

  it("uses \\r depending on the existing style", function (t, done) {
    var customContents = sourceContent.replace(/\n/g, "\r");
    var file = makeFile(Buffer.from(customContents));
    sourcemaps.write(file, function (err, updatedFile) {
      assert.strictEqual(
        updatedFile.contents.toString(),
        customContents +
          "//# sourceMappingURL=" +
          base64JSON(updatedFile.sourceMap) +
          "\r",
      );
      done(err);
    });
  });

  it("uses os.EOL if no EOL in contents", function (t, done) {
    var customContents = sourceContent.replace(/\n/g, "");
    var file = makeFile(Buffer.from(customContents));
    sourcemaps.write(file, function (err, outFile) {
      assert.strictEqual(
        outFile.contents.toString(),
        customContents +
          "//# sourceMappingURL=" +
          base64JSON(outFile.sourceMap) +
          os.EOL,
      );
      done(err);
    });
  });

  it("writes an external sourcemap when given a destPath", function (t, done) {
    var file = makeFile(Buffer.from(sourceContent));
    sourcemaps.write(file, "../maps", function (err, outFile, sourceMapFile) {
      assert.strictEqual(File.isVinyl(outFile), true);
      assert.strictEqual(outFile, file);
      assert.strictEqual(
        outFile.contents.toString(),
        sourceContent + "//# sourceMappingURL=../maps/helloworld.js.map\n",
      );

      assert.strictEqual(File.isVinyl(sourceMapFile), true);
      assert.strictEqual(
        sourceMapFile.path,
        path.join(__dirname, "maps/helloworld.js.map"),
      );
      assert.deepStrictEqual(
        JSON.parse(sourceMapFile.contents),
        outFile.sourceMap,
      );
      assert.strictEqual(sourceMapFile.stat.isFile(), true);
      assert.strictEqual(sourceMapFile.stat.isDirectory(), false);
      assert.strictEqual(sourceMapFile.stat.isBlockDevice(), false);
      assert.strictEqual(sourceMapFile.stat.isCharacterDevice(), false);
      assert.strictEqual(sourceMapFile.stat.isSymbolicLink(), false);
      assert.strictEqual(sourceMapFile.stat.isFIFO(), false);
      assert.strictEqual(sourceMapFile.stat.isSocket(), false);

      done(err);
    });
  });

  it("create shortest path to map in file comment", function (t, done) {
    var file = makeNestedFile(Buffer.from(sourceContent));
    sourcemaps.write(file, "dir1/maps", function (err, outFile) {
      assert.strictEqual(
        outFile.contents.toString(),
        sourceContent +
          "//# sourceMappingURL=../maps/dir1/dir2/helloworld.js.map\n",
      );
      done(err);
    });
  });

  // TODO: need to figure out this test
  it.skip("normalizes Windows paths to unix style", function (t, done) {
    var file = makeNestedFile();
    file.path = file.path.replace(/\//g, "\\\\");
    console.log(file.path);
    sourcemaps.write(file, "..\\\\maps", function (err, outFile) {
      assert.strictEqual(
        outFile.contents,
        sourceContent + "//# sourceMappingURL=../maps/helloworld.js.map\n",
      );
      done(err);
    });
  });

  // TODO: need to figure out this test
  it.skip("properly handles remote paths", function (t, done) {
    var file = makeNestedFile();
    sourcemaps.write(file, "http://example.com", function (err, outFile) {
      assert.strictEqual(
        outFile.contents,
        sourceContent +
          "//# sourceMappingURL=http://example.com/dir1/dir2/helloworld.js.map\n",
      );
      done(err);
    });
  });
});

function suite(moduleName) {
  var stream = require(moduleName);

  describe("write (" + moduleName + " contents)", function () {
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

    it("does not error if file argument is a Vinyl object with Stream contents", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, function (err) {
        assert.ifError(err);
        done();
      });
    });

    it("accepts null destPath argument", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, null, function (err) {
        assert.ifError(err);
        done(err);
      });
    });

    it("accepts undefined destPath argument", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, undefined, function (err) {
        assert.ifError(err);
        done(err);
      });
    });

    it("accepts string destPath argument", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, "something", function (err) {
        assert.ifError(err);
        done(err);
      });
    });

    it("juggles callback if no destPath argument", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, function (err) {
        assert.ifError(err);
        done(err);
      });
    });

    it("calls back with the untouched file if sourceMap property does not exist", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      delete file.sourceMap;
      sourcemaps.write(file, function (err, outFile) {
        assert.ifError(err);
        assert.strictEqual(outFile, file);
        done(err);
      });
    });

    it("appends an inline sourcemap when no destPath", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, function (err, updatedFile, sourceMapFile) {
        assert.ifError(err);
        assert.ok(updatedFile);
        assert.strictEqual(sourceMapFile, undefined);
        assert.strictEqual(File.isVinyl(updatedFile), true);
        assert.strictEqual(updatedFile, file);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            sourceContent +
              "//# sourceMappingURL=" +
              base64JSON(updatedFile.sourceMap) +
              "\n",
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });

    it("appends /*# */ comment if .css extension", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      file.path = file.path.replace(".js", ".css");
      sourcemaps.write(file, function (err, updatedFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            sourceContent +
              "/*# sourceMappingURL=" +
              base64JSON(updatedFile.sourceMap) +
              " */\n",
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });

    it("appends //# comment if any non-.css extension", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      file.path = file.path.replace(".js", ".txt");
      sourcemaps.write(file, function (err, updatedFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            sourceContent +
              "//# sourceMappingURL=" +
              base64JSON(updatedFile.sourceMap) +
              "\n",
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });

    it("uses \\r\\n depending on the existing style", function (t, done) {
      var customContents = sourceContent.replace(/\n/g, "\r\n");
      var file = makeFile(stream.Readable.from(customContents));
      sourcemaps.write(file, function (err, updatedFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            customContents +
              "//# sourceMappingURL=" +
              base64JSON(updatedFile.sourceMap) +
              "\r\n",
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });

    it("only uses the final newline for the existing style", function (t, done) {
      var customContents = sourceContent.replace(/\n/, "\r\n");
      var file = makeFile(stream.Readable.from(customContents));
      sourcemaps.write(file, function (err, updatedFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            customContents +
              "//# sourceMappingURL=" +
              base64JSON(updatedFile.sourceMap) +
              "\n",
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });

    it("uses \\r depending on the existing style", function (t, done) {
      var customContents = sourceContent.replace(/\n/g, "\r");
      var file = makeFile(stream.Readable.from(customContents));
      sourcemaps.write(file, function (err, updatedFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            customContents +
              "//# sourceMappingURL=" +
              base64JSON(updatedFile.sourceMap) +
              "\r",
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });

    it("uses os.EOL if no EOL in contents", function (t, done) {
      var customContents = sourceContent.replace(/\n/g, "");
      var file = makeFile(stream.Readable.from(customContents));
      sourcemaps.write(file, function (err, updatedFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            customContents +
              "//# sourceMappingURL=" +
              base64JSON(updatedFile.sourceMap) +
              os.EOL,
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });

    it("also works with stream chunks that are buffers", function (t, done) {
      var customContents = sourceContent.replace(/\n/g, "\r\n");
      // We use the array here so readable-stream doesn't iterate the entire buffer by byte
      var file = makeFile(stream.Readable.from([Buffer.from(customContents)]));
      sourcemaps.write(file, function (err, updatedFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            customContents +
              "//# sourceMappingURL=" +
              base64JSON(updatedFile.sourceMap) +
              "\r\n",
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });

    it("detects CRLF across chunks", function (t, done) {
      // Assumes to be 3 chunks but the last is an empty string
      var contentChunks = sourceContent.split("\n");
      var file = makeFile(
        stream.Readable.from([
          contentChunks[0],
          "\r\n",
          contentChunks[1] + "\r",
          "\n",
        ]),
      );
      sourcemaps.write(file, function (err, updatedFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            contentChunks.join("\r\n") +
              "//# sourceMappingURL=" +
              base64JSON(updatedFile.sourceMap) +
              "\r\n",
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });

    it("detects CR across chunks without any LF", function (t, done) {
      // Assumes to be 3 chunks but the last is an empty string
      var contentChunks = sourceContent.split("\n");
      var file = makeFile(
        stream.Readable.from([contentChunks[0], "\r", contentChunks[1] + "\r"]),
      );
      sourcemaps.write(file, function (err, updatedFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            contentChunks.join("\r") +
              "//# sourceMappingURL=" +
              base64JSON(updatedFile.sourceMap) +
              "\r",
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });

    it("writes an external sourcemap when given a destPath", function (t, done) {
      var file = makeFile(stream.Readable.from(sourceContent));
      sourcemaps.write(
        file,
        "../maps",
        function (err, updatedFile, sourceMapFile) {
          assert.ifError(err);

          assert.strictEqual(File.isVinyl(updatedFile), true);
          assert.strictEqual(updatedFile, file);

          assert.strictEqual(File.isVinyl(sourceMapFile), true);
          assert.strictEqual(
            sourceMapFile.path,
            path.join(__dirname, "maps/helloworld.js.map"),
          );
          assert.deepStrictEqual(
            JSON.parse(sourceMapFile.contents),
            updatedFile.sourceMap,
          );
          assert.strictEqual(sourceMapFile.stat.isFile(), true);
          assert.strictEqual(sourceMapFile.stat.isDirectory(), false);
          assert.strictEqual(sourceMapFile.stat.isBlockDevice(), false);
          assert.strictEqual(sourceMapFile.stat.isCharacterDevice(), false);
          assert.strictEqual(sourceMapFile.stat.isSymbolicLink(), false);
          assert.strictEqual(sourceMapFile.stat.isFIFO(), false);
          assert.strictEqual(sourceMapFile.stat.isSocket(), false);

          function assertion(contents) {
            assert.strictEqual(
              contents,
              sourceContent +
                "//# sourceMappingURL=../maps/helloworld.js.map\n",
            );
          }

          stream.pipeline([updatedFile.contents, concat(assertion)], done);
        },
      );
    });

    it("create shortest path to map in file comment", function (t, done) {
      var file = makeNestedFile(stream.Readable.from(sourceContent));
      sourcemaps.write(file, "dir1/maps", function (err, updatedFile) {
        assert.ifError(err);

        function assertion(contents) {
          assert.strictEqual(
            contents,
            sourceContent +
              "//# sourceMappingURL=../maps/dir1/dir2/helloworld.js.map\n",
          );
        }

        stream.pipeline([updatedFile.contents, concat(assertion)], done);
      });
    });
  });
}

suite("stream");
suite("streamx");
suite("readable-stream");
