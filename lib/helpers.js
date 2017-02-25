'use strict';

var path = require('path');

var fs = require('graceful-fs');
var async = require('async');
var convert = require('convert-source-map');
var stripBom = require('strip-bom');

var generate = require('./generate');

var urlRegex = /^(https?|webpack(-[^:]+)?):\/\//;

function unixStylePath (filePath) {
  return filePath.split(path.sep).join('/');
}

function parse(data) {
  try {
    return JSON.parse(stripBom(data));
  } catch (err) {}
}

function loadSourceMap(file, source, options, callback) {
  if (source.map) {
    return callback();
  }

  // look for source map comment referencing a source map file
  var mapComment = convert.mapFileCommentRegex.exec(source.content);

  var mapFile;
  if (mapComment) {
    mapFile = path.resolve(path.dirname(file.path), mapComment[1] || mapComment[2]);
    source.content = convert.removeMapFileComments(source.content);
    // if no comment try map file with same name as source file
  } else {
    mapFile = file.path + '.map';
  }

  // sources in external map are relative to map file
  source.path = path.dirname(mapFile);

  fs.readFile(mapFile, 'utf8', done);

  function done(err, data) {
    if (err) {
      // console.log(err);
      // if (options.debug) {
      //  console.log(PLUGIN_NAME + '-add: Can\'t read map file :' + mapFile);
      // }
      return callback();
    }
    source.map = parse(data);
    callback();
  }
}

// fix source paths and sourceContent for imported source map
function fixImportedSourceMap(file, source, options, callback) {
  if (!source.map) {
    return callback();
  }

  source.map.sourcesContent = source.map.sourcesContent || [];

  var loadSourceAsync = function (tuple, onLoaded) {
    var i = tuple[0];
    var absPath = tuple[1];

    fs.readFile(absPath, 'utf8', onRead);

    function onRead(err, data) {
      if (err) {
        // if (options.debug) {
        //  console.warn(PLUGIN_NAME + '-add: source file not found: ' + absPath);
        // }
        source.map.sourcesContent[i] = null;
        return onLoaded();
      }
      source.map.sourcesContent[i] = stripBom(data);
      onLoaded();
    }
  };

  var sourcesToLoadAsync = source.map.sources.reduce(function(result, sourcePath, i) {
    if (sourcePath.match(urlRegex)) {
      source.map.sourcesContent[i] = source.map.sourcesContent[i] || null;
      return result;
    }
    var absPath = path.resolve(source.path, sourcePath);
    source.map.sources[i] = unixStylePath(path.relative(file.base, absPath));
    if (!source.map.sourcesContent[i]) {
      var sourceContent = null;
      if (source.map.sourceRoot) {
        if (source.map.sourceRoot.match(urlRegex)) {
          source.map.sourcesContent[i] = null;
          return result;
        }
        absPath = path.resolve(source.path, source.map.sourceRoot, sourcePath);
      }
      if (absPath === file.path) {
        // if current file: use content
        sourceContent = source.content;
      } else {
        // else load content from file async
        // if (options.debug) {
        //  console.log(PLUGIN_NAME + '-add: No source content for "' + source + '". Loading from file.');
        // }
        result.push([i, absPath]);
        return result;
      }
      source.map.sourcesContent[i] = sourceContent;
    }
    return result;
  }, []);

  // remove source map comment from source
  file.contents = new Buffer(source.content, 'utf8');

  async.each(sourcesToLoadAsync, loadSourceAsync, callback);
}

function mapsLoaded(file, source, options, callback) {

  if (!source.map && options.identityMap) {
    var fileType = path.extname(file.path);
    var sourcePath = unixStylePath(file.relative);
    // var generator = new SourceMapGenerator({ file: sourcePath });
    if (fileType === '.js') {
      source.map = generate.js(sourcePath, source.content);
    } else if (fileType === '.css') {
      source.map = generate.css(sourcePath, source.content);
    }
  }

  if (!source.map) {
    source.map = {
      version: 3,
      names: [],
      mappings: '',
      sources: [unixStylePath(file.relative)],
      sourcesContent: [source.content]
    };
  }

  source.map.file = unixStylePath(file.relative);
  file.sourceMap = source.map;

  callback();
}

function loadInlineMaps(file, source) {
  // Try to read inline source map
  source.map = convert.fromSource(source.content);

  if (source.map) {
    source.map = source.map.toObject();
    // sources in map are relative to the source file
    source.path = path.dirname(file.path);
    source.content = convert.removeComments(source.content);
  }
}

function addSourceMaps(file, source, options, callback) {

  var tasks = [
    loadSourceMap,
    fixImportedSourceMap,
    mapsLoaded,
  ];

  async.applyEachSeries(tasks, file, source, options, done);

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
