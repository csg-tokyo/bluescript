"use strict";
exports.__esModule = true;
var babelParser = require("@babel/parser");
console.log('Hello');
function translate(src) {
    var ast = babelParser.parse(src);
}
