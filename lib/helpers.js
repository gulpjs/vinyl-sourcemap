'use strict';

var path = require('path');

var fs = require('graceful-fs');
var File = require('vinyl');
var async = require('async');
var convert = require('convert-source-map');
var stripBom = require('strip-bom');
var detectNewline = require('detect-newline');

var generate = require('./generate');

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

  if (!state.map && options.identityMap) {
    var sourcePath = unixStylePath(file.relative);

    switch (file.extname) {
      case '.js':
        state.map = generate.js(sourcePath, state.content);
        break;
      case '.css':
        state.map = generate.css(sourcePath, state.content);
        break;
    }
  }

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

    var absPath = path.resolve(state.sourceMap.sourceRoot || file.base, sourcePath);
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

  var newline = detectNewline(file.contents.toString());
  var commentFormatter;

  // TODO: use formatter from convert-source-map
  switch (file.extname) {
    case '.css':
      commentFormatter = function(url) {
        return newline + '/*# sourceMappingURL=' + url + ' */' + newline;
      };
      break;
    case '.js':
      commentFormatter = function(url) {
        return newline + '//# sourceMappingURL=' + url + newline;
      };
      break;
    default:
      commentFormatter = function() {
        return '';
      };
  }

  var comment;
  // TODO: just test null-ish with ==
  if (state.destPath === undefined || state.destPath === null) {
    // encode source map into comment
    var base64Map = new Buffer(JSON.stringify(state.sourceMap)).toString('base64');
    comment = commentFormatter('data:application/json;charset=' + options.charset + ';base64,' + base64Map);
  } else {
    var mapFile = path.join(state.destPath, file.relative) + '.map';
    // custom map file name
    if (options.mapFile && typeof options.mapFile === 'function') {
      mapFile = options.mapFile(mapFile);
    }

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

    // add new source map file to stream
    var sourceMapFile = new File({
      cwd: file.cwd,
      base: file.base,
      path: sourceMapPath,
      contents: new Buffer(JSON.stringify(state.sourceMap)),
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

    state.sourceMapFile = sourceMapFile;

    var sourceMapPathRelative = path.relative(path.dirname(file.path), sourceMapPath);

    if (options.sourceMappingURLPrefix) {
      var prefix = '';
      if (typeof options.sourceMappingURLPrefix === 'function') {
        prefix = options.sourceMappingURLPrefix(file);
      } else {
        prefix = options.sourceMappingURLPrefix;
      }
      sourceMapPathRelative = prefix+path.join('/', sourceMapPathRelative);
    }
    comment = commentFormatter(unixStylePath(sourceMapPathRelative));

    if (options.sourceMappingURL && typeof options.sourceMappingURL === 'function') {
      comment = commentFormatter(options.sourceMappingURL(file));
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

    var result = [file];
    if (state.sourceMapFile) {
      result.push(state.sourceMapFile);
    }

    callback(null, result);
  }
}

module.exports = {
  loadInlineMaps: loadInlineMaps,
  addSourceMaps: addSourceMaps,
  writeSourceMaps: writeSourceMaps,
  unixStylePath: unixStylePath,
};
