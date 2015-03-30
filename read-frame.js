var fs = require('fs');
var assert = require('assert');
var hexer = require('hexer');

var readCoreFile = require('./read-core-file.js');

// Offset from frame pointer find JSFunction pointer
var FP_CONTEXT_OFFSET                    = -0x8
var FP_FUNC_OFFSET                       = -0x10 // [FP - 16] contains pointer to func blob (also known as "marker")

var FRAME_TYPE_ENTRY                     = 1
var FRAME_TYPE_ENTRY_CONSTRUCT           = 2
var FRAME_TYPE_EXIT                      = 3
var FRAME_TYPE_JAVA_SCRIPT               = 4
var FRAME_TYPE_OPTIMIZED                 = 5
var FRAME_TYPE_INTERNAL                  = 6
var FRAME_TYPE_CONSTRUCT                 = 7
var FRAME_TYPE_ARGUMENTS_ADAPTOR         = 8

var ENTRY_FRAME_FP_OFFSET                = -0x40
var ARGUMENTS_ADAPTOR_CONTEXT_VAL        = 4

// Offset from base of JSFunction to shared info pointer
var JS_FUNC_SHARED_INFO_OFFSET           = 0x28 // Func blob + 0x28 contains pointer to shared info
var JS_FUNC_CONTEXT_OFFSET               = 0x30

var CONTEXT_GLOBAL_OBJECT_INDEX          = 0x03

// Offset from based of SharedFunctionInfo to names and script
var SHARED_INFO_NAME_OFFSET              = 0x08
var SHARED_INFO_INFERRED_NAME_OFFSET     = 0x50
var SHARED_INFO_SCRIPT_OFFSET            = 0x40 
var SHARED_INFO_COMPILER_HINTS_OFFSET    = 0x8c
var SHARED_INFO_COMPILER_NATIVE_HINT     = 0x400
var SHARED_INFO_START_POSITION_AND_TYPE_OFFSET= 0x84
var SHARED_INFO_START_POSITION_SHIFT          = 0x02

// Offset from script base to name pointer
var SCRIPT_NAME_OFFSET                   = 0x10
var SCRIPT_LINE_OFFSET_OFFSET            = 0x18
var SCRIPT_LINE_ENDS_OFFSET              = 0x58

// Offset from base of basic contiguous ascii string object to ascii data
var STRING_LENGTH_OFFSET                 = 0x08
var SEQ_STRING_DATA_OFFSET               = 0x18
var CONS_STRING_FIRST_OFFSET             = 0x18
var CONS_STRING_SECOND_OFFSET            = 0x20
var MAX_CONS_STRING_DEPTH                = 5

var STRING_REPR_MASK                     = 0x07
var STRING_ENC_MASK                      = 0x04
var STRING_ENC_ASCII                     = 0x04
var STRING_LAYOUT_MASK                   = 0x03
var STRING_LAYOUT_SEQ                    = 0x00
var STRING_LAYOUT_CONS                   = 0x01
var STRING_LAYOUT_EXT                    = 0x02
var STRING_LAYOUT_SLICED                 = 0x03

// Offset from all heap objects to map ptr
var HEAP_OBJECT_MAP_OFFSET               = 0x00 
var HEAP_MAP_TYPE_OFFSET                 = 0x0c
var HEAP_MAP_TYPE_IS_NOT_STRING_MASK     = 0x80

var HEAP_OBJECT_FIXED_ARRAY_TYPE         = 0xa3
var HEAP_OBJECT_BUILTIN_TYPE             = 0xae
var HEAP_OBJECT_JS_FUNCTION_TYPE         = 0xb5

var FIXED_ARRAY_LENGTH_OFFSET            = 0x08
var FIXED_ARRAY_HEADER_SIZE              = 0x10


if (!process.argv[2]) {
    console.log('node index.js [core file]');
    process.exit(0);
}

var coreFile = fs.readFileSync(process.argv[2]);
var program = readCoreFile(coreFile);

main();

function main() {

    var frame = program.prStatus.prs.bp;
    var frameType = getFrameType(frame);
    console.log('frameType', frameType);

    for (var i = 0; i < 100 && frame != 0; i++) {
        // console.log('looping', {
        //     i: i,
        //     type: frameType
        // });

        if (frameType === FRAME_TYPE_JAVA_SCRIPT) {
            var funcPtr = userUInt64(stripLowBit(frame) + FP_FUNC_OFFSET);
            logFunction(funcPtr);
        }

        if (frameType === FRAME_TYPE_ENTRY) {
            console.log('entry?', frameType);
            frame = userUInt64(frame + ENTRY_FRAME_FP_OFFSET);
            frameType = FRAME_TYPE_EXIT;
        } else {
            frame = userUInt64(frame);
            frameType = getFrameType(frame);
        }
    }

    // assert(frameType === FRAME_TYPE_JAVA_SCRIPT);

    // var funcPtr = userUInt64(stripLowBit(frame) + FP_FUNC_OFFSET);
    // logFunction(funcPtr);
}

function logFunction(funcPtr) {
    funcPtr = stripLowBit(funcPtr);

    var sharedPtr = stripLowBit(getFuncSharedInfo(funcPtr));

    var namePtr = stripLowBit(userUInt64(sharedPtr + SHARED_INFO_NAME_OFFSET));
    logIfNotString(namePtr);
    if (isEmpty(namePtr)) {
        namePtr = stripLowBit(
            userUInt64(sharedPtr + SHARED_INFO_INFERRED_NAME_OFFSET)
        );
    }

    var shape = getStringShape(namePtr);

    var fileName = getFileNamePtrFromSharedInfoPointer(sharedPtr);
    logIfNotString(fileName);

    console.log('--- functionName: ' + printUserString(namePtr));
    // printUserString(namePtr);
    console.log('--- fileName: ' + printUserString(fileName));
}

function logIfNotString(stringPtr) {
    stringPtr = stripLowBit(stringPtr);
    var mapPtr = stripLowBit(userUInt64(stringPtr + HEAP_OBJECT_MAP_OFFSET));
    var typeField = userUInt8(mapPtr + HEAP_MAP_TYPE_OFFSET);

    if (typeField & HEAP_MAP_TYPE_IS_NOT_STRING_MASK) {
        console.log('pointer is not string', {
            stringPtr: stringPtr
        });
    }
}

function printUserString(stringAddr) {
    return printUserStringInternal(stringAddr, 0);
}

function printUtf16(addr, length) {
    addr = stripLowBit(addr);
    var str = '';
    for (var i = 0; i < 200 && i < length; i++) {
        var char = userUint16(addr);
        str += String.fromCharCode(char);
        addr += 2;
    }
    return str;
}

function printUserStringInternal(stringAddr, depth) {
    if (depth >= 3) {
        return '...';
    }

    // console.log('raw string\n' +
    //     hexer(program.resolveAddress(stringAddr, 120))
    // );

    var stringShape = getStringShape(stringAddr);
    var stringLength = getStringLength(stringAddr);

    if (stringLength === 0) {
        return 'empty';
    } else {
        if (stringShape === (STRING_ENC_ASCII|STRING_LAYOUT_SEQ)) {
            var offset = stringAddr + SEQ_STRING_DATA_OFFSET;
            var buf = program.resolveAddress(offset, stringLength);
            return String(buf);
        } else if (stringShape == STRING_LAYOUT_SEQ) {
            return printUtf16(stringAddr + SEQ_STRING_DATA_OFFSET, stringLength);
        } else if ((stringShape & STRING_LAYOUT_MASK) === STRING_LAYOUT_CONS) {
            return printConsString(stringAddr, depth + 1);
        } else {
            console.log('print unkown shape', stringShape);
        }
    }
}

function printConsString(stringPtr, depth) {
    stringPtr = stripLowBit(stringPtr);

    var first = userUInt64(stringPtr + CONS_STRING_FIRST_OFFSET);
    var second = userUInt64(stringPtr + CONS_STRING_SECOND_OFFSET);

    return printUserStringInternal(first, depth + 1) +
        printUserStringInternal(second, depth + 1);
}

function getStringLength(stringPtr) {
    stringPtr = stripLowBit(stringPtr);

    var lengthVal = userUInt64(stringPtr + STRING_LENGTH_OFFSET);

    var length = smiValue(lengthVal);
    return length;
}

function isEmpty(stringPtr) {
    return getStringLength(stringPtr) === 0;
}

function getFileNamePtrFromSharedInfoPointer(sharedPtr) {
    sharedPtr = stripLowBit(sharedPtr);

    var scriptPtr = getScriptFromSharedInfo(sharedPtr);
    var scriptnamePtr = userUInt64(scriptPtr + SCRIPT_NAME_OFFSET);
    scriptnamePtr = stripLowBit(scriptnamePtr);
    return scriptnamePtr;
}

function getScriptFromSharedInfo(sharedPtr) {
    var scriptPtr = userUInt64(sharedPtr + SHARED_INFO_SCRIPT_OFFSET);
    return stripLowBit(scriptPtr);
}

function getFuncSharedInfo(func) {
    func = stripLowBit(func);
    // console.log('getFuncSharedInfo', func.toString('16'));
    var sharedInfo = userUInt64(func + JS_FUNC_SHARED_INFO_OFFSET);
    // console.log('sharedInfo', sharedInfo.toString('16'));
    return stripLowBit(sharedInfo);
}

function getStringShape(stringPtr) {
    stringPtr = stripLowBit(stringPtr);
    var mapPtr = userUInt64(stringPtr + HEAP_OBJECT_MAP_OFFSET);
    mapPtr = stripLowBit(mapPtr);
    var typeField = userUInt8(mapPtr + HEAP_MAP_TYPE_OFFSET);

    return typeField & STRING_REPR_MASK;
}

function userUInt64(addr) {
    var bytes = program.resolveAddress(addr, 8);

    if (bytes === null) {
        return null;
    }

    var a = bytes.readUInt32LE(0);
    var b = bytes.readUInt32LE(4);

    return a + b * 0x100000000;
}

function userUInt8(addr) {
    var bytes = program.resolveAddress(addr, 1);

    if (bytes === null) {
        return null;
    }

    return bytes.readUInt8(0);
}

function userUint16(addr) {
    var bytes = program.resolveAddress(addr, 2);

    return bytes.readUInt16LE(0);
}

function getFrameType(fp) {
    fp = stripLowBit(fp);

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
    return addr - (addr % 2);
}

function isSmi(addr) {
    return (addr & 0x1) === 0x0
}

function smiValue(addr) {
    return addr / Math.pow(2, 32);
}
