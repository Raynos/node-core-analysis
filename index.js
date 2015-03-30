var fs = require('fs');
var assert = require('assert');
var hexer = require('hexer');

var readCoreFile = require('./read-core-file.js');

if (!process.argv[2]) {
    console.log('node index.js [core file]');
    process.exit(0);
}

var coreFile = fs.readFileSync(process.argv[2]);

var program = readCoreFile(coreFile);
console.log('prStatus', program.prStatus);
// console.log('frame pointer', program.prStatus.prs.bp.toString('16'))

// var buffer = program.resolveAddress(
//     program.prStatus.prs.bp, 8
// );
