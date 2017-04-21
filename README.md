<p align="center">
  <a href="http://gulpjs.com">
    <img height="257" width="114" src="https://raw.githubusercontent.com/gulpjs/artwork/master/gulp-2x.png">
  </a>
</p>

# vinyl-sourcemap

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![AppVeyor Build Status][appveyor-image]][appveyor-url] [![Coveralls Status][coveralls-image]][coveralls-url] [![Gitter chat][gitter-image]][gitter-url]

Add/write sourcemaps to/from Vinyl files.

## Usage

```js
sourcemap.add(file, function(err, updatedFile) {

});

sourcemap.write(file, './maps', function(err, updatedFile, sourcemapFile) {

});
```

## API

### `sourcemap.add(file, callback)`

### `sourcemap.write(file, [outputPath,] callback)`

## License

MIT

[downloads-image]: http://img.shields.io/npm/dm/vinyl-sourcemap.svg
[npm-url]: https://npmjs.com/package/vinyl-sourcemap
[npm-image]: http://img.shields.io/npm/v/vinyl-sourcemap.svg

[travis-url]: https://travis-ci.org/gulpjs/vinyl-sourcemap
[travis-image]: http://img.shields.io/travis/gulpjs/vinyl-sourcemap.svg?label=travis-ci

[appveyor-url]: https://ci.appveyor.com/project/gulpjs/vinyl-sourcemap
[appveyor-image]: https://img.shields.io/appveyor/ci/gulpjs/vinyl-sourcemap.svg?label=appveyor

[coveralls-url]: https://coveralls.io/r/gulpjs/vinyl-sourcemap
[coveralls-image]: http://img.shields.io/coveralls/gulpjs/vinyl-sourcemap/master.svg

[gitter-url]: https://gitter.im/gulpjs/gulp
[gitter-image]: https://badges.gitter.im/gulpjs/gulp.png
