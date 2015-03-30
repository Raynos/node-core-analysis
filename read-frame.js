var fs = require('fs');
var assert = require('assert');

var readCoreFile = require('./read-core-file.js');

var FRAME_TYPE_ARGUMENTS_ADAPTOR = 8;
var FRAME_TYPE_JAVA_SCRIPT = 4;

var FP_CONTEXT_OFFSET = -0x8;
var FP_FUNC_OFFSET = -0x10;

var STRING_REPR_MASK = 0x07;

var ARGUMENTS_ADAPTOR_CONTEXT_VAL = 4;

var SCRIPT_NAME_OFFSET = 0x10;

var STRING_LENGTH_OFFSET = 0x08;

var SHARED_INFO_NAME_OFFSET = 0x08;
var SHARED_INFO_SCRIPT_OFFSET = 0x40;

var JS_FUNC_SHARED_INFO_OFFSET = 0x28;

var HEAP_OBJECT_MAP_OFFSET = 0x00;
var HEAP_MAP_TYPE_OFFSET = 0x0c;

if (!process.argv[2]) {
    console.log('node index.js [core file]');
    process.exit(0);
}

var coreFile = fs.readFileSync(process.argv[2]);

var program = readCoreFile(coreFile);

var frame = program.prStatus.prs.bp;
var frameType = getFrameType(frame);
assert(frameType === FRAME_TYPE_JAVA_SCRIPT);

var funcPtr = userUInt64(frame + FP_FUNC_OFFSET);
logFunction(funcPtr);

function logFunction(funcPtr) {
    var sharedPtr = getFuncSharedInfo(funcPtr);

    console.log('sharedPtr', sharedPtr.toString('16'));
    var namePtr = userUInt64(sharedPtr + SHARED_INFO_NAME_OFFSET);
    // TODO if namePtr is empty grab a different one

    var shape = getStringShape(namePtr);

    var fileName = getFileNamePtrFromSharedInfoPointer(sharedPtr);

    printUserString(fileName);
}

function printUserString(stringAddr) {
    printUserStringInternal(stringAddr, 0);
}

function printUserStringInternal(stringAddr, depth) {
    if (depth >= 3) {
        console.log('...');
        return;
    }

    var stringShape = getStringShape(stringAddr);
    var stringLength = getStringLength(stringAddr);

    if (stringLength === 0) {
        console.log('empty')
    } else {
        console.log('pring this shape', stringShape);
    }
}

function getStringLength(stringPtr) {
    var length = smiValue(userUInt64(stringPtr + STRING_LENGTH_OFFSET));
    return length;
}

function getFileNamePtrFromSharedInfoPointer(sharedPtr) {
    var scriptPtr = getScriptFromSharedInfo(sharedPtr);
    var scriptnamePtr = userUInt64(scriptPtr + SCRIPT_NAME_OFFSET);
    return scriptnamePtr;
}

function getScriptFromSharedInfo(sharedPtr) {
    return userUInt64(sharedPtr + SHARED_INFO_SCRIPT_OFFSET);
}

function getFuncSharedInfo(func) {
    console.log('getFuncSharedInfo', func.toString('16'));
    var sharedInfo = userUInt64(func + JS_FUNC_SHARED_INFO_OFFSET);
    console.log('sharedInfo', sharedInfo.toString('16'));
    return stripLowBit(sharedInfo);
}

function getStringShape(stringPtr) {
    var mapPtr = userUInt64(stringPtr + HEAP_OBJECT_MAP_OFFSET);
    var typeField = userUInt8(mapPtr + HEAP_MAP_TYPE_OFFSET);

    return type_field & STRING_REPR_MASK;
}

function userUInt64(addr) {
    var bytes = program.resolveAddress(addr, 8);

    var a = bytes.readUInt32LE(0);
    var b = bytes.readUInt32LE(4);

    return a + b * 0x100000000;
}

function userUInt8(addr) {
    var bytes = program.resolveAddress(addr, 1);

    return bytes.readUInt8(0);
}

function getFrameType(fp) {
    console.log('before', fp.toString('16'));
    fp = stripLowBit(fp);
    console.log('after', fp.toString('16'));

    var contextValue = userUInt64(fp + FP_CONTEXT_OFFSET);
    if (isSmi(contextValue) + smiValue(contextValue) === ARGUMENTS_ADAPTOR_CONTEXT_VAL) {
        return FRAME_TYPE_ARGUMENTS_ADAPTOR;
    }

    var funcPtr = userUInt64(fp + FP_FUNC_OFFSET);
    if (isSmi(funcPtr)) {
        return smiValue(funcPtr);
    }

    return FRAME_TYPE_JAVA_SCRIPT;
}

function stripLowBit(addr) {
    return addr & ~0x1
}

function isSmi(addr) {
    return (addr & 0x1) === 0x0
}

function smiValue(addr) {
    return addr >> 32;
}
