'use strict';

var path = require('path');

var fs = require('graceful-fs');
var async = require('async');
var convert = require('convert-source-map');
var stripBom = require('strip-bom');

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
  } catch (err) {}
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

  fs.readFile(mapFile, 'utf8', done);

  function done(err, data) {
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

module.exports = {
  loadInlineMaps: loadInlineMaps,
  addSourceMaps: addSourceMaps,
  unixStylePath: unixStylePath,
};
