'use strict';

var path = require('path');

var fs = require('graceful-fs');
var File = require('vinyl');
var async = require('async');
var convert = require('convert-source-map');
var stripBom = require('strip-bom');
var detectNewline = require('detect-newline');

var urlRegex = /^(https?|webpack(-[^:]+)?):\/\//;

function isRemoteSource(source) {
  return source.match(urlRegex);
}

function unixStylePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function parse(data) {
  try {
    return JSON.parse(stripBom(data));
  } catch (err) {
    // TODO: should this log a debug?
  }
}

function loadSourceMap(file, state, options, callback) {
  if (state.map) {
    return callback();
  }

  // look for source map comment referencing a source map file
  var mapComment = convert.mapFileCommentRegex.exec(state.content);

  var mapFile;
  if (mapComment) {
    mapFile = path.resolve(path.dirname(file.path), mapComment[1] || mapComment[2]);
    state.content = convert.removeMapFileComments(state.content);
  } else {
    // if no comment try map file with same name as source file
    mapFile = file.path + '.map';
  }

  // sources in external map are relative to map file
  state.path = path.dirname(mapFile);

  fs.readFile(mapFile, 'utf8', onRead);

  function onRead(err, data) {
    if (err) {
      // console.log(err);
      // if (options.debug) {
      //  console.log(PLUGIN_NAME + '-add: Can\'t read map file :' + mapFile);
      // }
      return callback();
    }
    state.map = parse(data);
    callback();
  }
}

// fix source paths and sourceContent for imported source map
function fixImportedSourceMap(file, state, options, callback) {
  if (!state.map) {
    return callback();
  }

  state.map.sourcesContent = state.map.sourcesContent || [];

  // remove source map comment from source
  file.contents = new Buffer(state.content, 'utf8');

  async.eachOf(state.map.sources, normalizeSourcesAndContent, callback);

  function assignSourcesContent(sourceContent, idx) {
    state.map.sourcesContent[idx] = sourceContent;
  }

  function normalizeSourcesAndContent(sourcePath, idx, cb) {
    var sourceRoot = state.map.sourceRoot || '';
    var sourceContent = state.map.sourcesContent[idx] || null;

    if (isRemoteSource(sourcePath)) {
      assignSourcesContent(sourceContent, idx);
      return cb();
    }

    if (state.map.sourcesContent[idx]) {
      return cb();
    }

    if (sourceRoot && isRemoteSource(sourceRoot)) {
      assignSourcesContent(sourceContent, idx);
      return cb();
    }

    var basePath = path.resolve(file.base, sourceRoot);
    var absPath = path.resolve(state.path, sourceRoot, sourcePath);
    var relPath = path.relative(basePath, absPath);
    var unixRelPath = unixStylePath(relPath);

    state.map.sources[idx] = unixRelPath;

    if (absPath !== file.path) {
      // load content from file async
      // if (options.debug) {
      //  console.log(PLUGIN_NAME + '-add: No source content for "' + source + '". Loading from file.');
      // }
      return fs.readFile(absPath, 'utf8', onRead);
    }

    // if current file: use content
    assignSourcesContent(state.content, idx);
    cb();

    function onRead(err, data) {
      if (err) {
        // if (options.debug) {
        //  console.warn(PLUGIN_NAME + '-add: source file not found: ' + absPath);
        // }
        assignSourcesContent(null, idx);
        return cb();
      }
      assignSourcesContent(stripBom(data), idx);
      cb();
    }
  }
}

function mapsLoaded(file, state, options, callback) {

  if (!state.map) {
    state.map = {
      version: 3,
      names: [],
      mappings: '',
      sources: [unixStylePath(file.relative)],
      sourcesContent: [state.content]
    };
  }

  // TODO: add this
  // else if (preExistingComment !== null && typeof preExistingComment !== 'undefined') {
  //   sourceMap.preExistingComment = preExistingComment;
  // }

  state.map.file = unixStylePath(file.relative);
  file.sourceMap = state.map;

  callback();
}

function loadInlineMaps(file, state) {
  // Try to read inline source map
  state.map = convert.fromSource(state.content);

  if (state.map) {
    state.map = state.map.toObject();
    // sources in map are relative to the source file
    state.path = path.dirname(file.path);
    state.content = convert.removeComments(state.content);
  }
}

function addSourceMaps(file, state, options, callback) {

  var tasks = [
    loadSourceMap,
    fixImportedSourceMap,
    mapsLoaded,
  ];

  async.applyEachSeries(tasks, file, state, options, done);

  function done(err) {
    if (err) {
      return callback(err);
    }

    callback(null, file);
  }
}

/* Write Helpers */
function createSourceMapFile(opts) {
  return new File({
    cwd: opts.cwd,
    base: opts.base,
    path: opts.path,
    contents: new Buffer(JSON.stringify(opts.content)),
    stat: {
      isFile: function () {
        return true;
      },
      isDirectory: function () {
        return false;
      },
      isBlockDevice: function () {
        return false;
      },
      isCharacterDevice: function () {
        return false;
      },
      isSymbolicLink: function () {
        return false;
      },
      isFIFO: function () {
        return false;
      },
      isSocket: function () {
        return false;
      }
    }
  });
}

// TODO: any way to make this function not require file?
function commentFormatter(file, url) {
  // TODO: can this be built into convert-source-map?
  var newline = detectNewline(file.contents.toString());

  // TODO: Not sure I agree with this
  if (file.extname !== '.js' && file.extname !== '.css') {
    return '';
  }

  var opts = {
    multiline: (file.extname === '.css')
  };

  return newline + convert.generateMapFileComment(url, opts) + newline;
}

function includeContent(file, state, options, callback) {
  if (!options.includeContent) {
    delete state.sourceMap.sourcesContent;
    return callback();
  }

  state.sourceMap.sourcesContent = state.sourceMap.sourcesContent || [];

  function loadSources(sourcePath, idx, cb) {
    if (state.sourceMap.sourcesContent[idx]) {
      return cb();
    }

    var basePath = state.sourceMap.sourceRoot || file.base;
    var absPath = path.resolve(basePath, sourcePath);
    // if (options.debug) {
    //  console.log(PLUGIN_NAME + '-write: No source content for "' + sourceMap.sources[i] + '". Loading from file.');
    // }
    fs.readFile(absPath, 'utf8', onRead);

    function onRead(err, data) {
      if (err) {
        // if (options.debug) {
        //  console.warn(PLUGIN_NAME + '-write: source file not found: ' + sourcePath);
        // }
        return cb();
      }
      state.sourceMap.sourcesContent[idx] = stripBom(data);
      cb();
    }
  }

  async.eachOf(file.sourceMap.sources, loadSources, callback);
}

function contentIncluded(file, state, options, callback) {

  var comment;
  if (state.destPath == undefined) {
    // encode source map into comment
    var base64Map = convert.fromObject(state.sourceMap).toBase64();
    // TODO: use convert-source-map .toComment() when we upgrade and have charset support
    comment = commentFormatter(file, 'data:application/json;charset=utf8;base64,' + base64Map);
  } else {
    var mapFile = path.join(state.destPath, file.relative) + '.map';

    var sourceMapPath = path.join(file.base, mapFile);

    // if explicit destination path is set
    if (options.destPath) {
      var destSourceMapPath = path.join(file.cwd, options.destPath, mapFile);
      var destFilePath = path.join(file.cwd, options.destPath, file.relative);
      state.sourceMap.file = unixStylePath(path.relative(path.dirname(destSourceMapPath), destFilePath));
      if (state.sourceMap.sourceRoot === undefined) {
        state.sourceMap.sourceRoot = unixStylePath(path.relative(path.dirname(destSourceMapPath), file.base));
      } else if (state.sourceMap.sourceRoot === '' || (state.sourceMap.sourceRoot && state.sourceMap.sourceRoot[0] === '.')) {
        state.sourceMap.sourceRoot = unixStylePath(path.join(path.relative(path.dirname(destSourceMapPath), file.base), state.sourceMap.sourceRoot));
      }
    } else {
      // best effort, can be incorrect if options.destPath not set
      state.sourceMap.file = unixStylePath(path.relative(path.dirname(sourceMapPath), file.path));
      if (state.sourceMap.sourceRoot === '' || (state.sourceMap.sourceRoot && state.sourceMap.sourceRoot[0] === '.')) {
        state.sourceMap.sourceRoot = unixStylePath(path.join(path.relative(path.dirname(sourceMapPath), file.base), state.sourceMap.sourceRoot));
      }
    }

    // add new source map file to state
    state.sourceMapFile = createSourceMapFile({
      cwd: file.cwd,
      base: file.base,
      path: sourceMapPath,
      content: state.sourceMap,
    });

    var sourceMapPathRelative = path.relative(path.dirname(file.path), sourceMapPath);

    // A function option here would have already been resolved higher up
    if (options.sourceMappingURLPrefix) {
      var prefix = options.sourceMappingURLPrefix;
      sourceMapPathRelative = prefix + path.join('/', sourceMapPathRelative);
    }
    comment = commentFormatter(file, unixStylePath(sourceMapPathRelative));

    // A function option here would have already been resolved higher up
    // TODO: need a test for this as a string
    if (options.sourceMappingURL) {
      comment = commentFormatter(file, options.sourceMappingURL);
    }
  }

  // append source map comment
  if (options.addComment) {
    file.contents = Buffer.concat([file.contents, new Buffer(comment)]);
  }

  callback();
}

function writeSourceMaps(file, state, options, callback) {
  var tasks = [
    includeContent,
    contentIncluded
  ];

  async.applyEachSeries(tasks, file, state, options, done);

  function done(err) {
    if (err) {
      return callback(err);
    }

    callback(null, file, state.sourceMapFile);
  }
}

module.exports = {
  loadInlineMaps: loadInlineMaps,
  addSourceMaps: addSourceMaps,
  writeSourceMaps: writeSourceMaps,
  unixStylePath: unixStylePath,
};
