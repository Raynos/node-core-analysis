var elfy = require('elfy');
var ElfParser = require('elfy/lib/elfy/parser');
var assert = require('assert');
var fs = require('fs');
var hexer = require('hexer');
var Int64 = require('node-int64');

if (!process.argv[2]) {
    console.log('node index.js [core file]');
    process.exit(0);
}

var coreFile = fs.readFileSync(process.argv[2]);
var parser = new ElfParser();
var elf = parser.execute(coreFile);

// console.log('elf', elf);

var programs = elf.body.programs;
var notes = programs.filter(function (p) {
    return p.type === 'note';
});
assert.equal(notes.length, 1);
var note = notes[0];
// console.log('note', note);

var elfNote = elf64Note(note.data);
// console.log('elfNote', elfNote);

assert.equal(elfNote.type, 1);
// console.log('len', elfNote.data.length);

var prStatus = elfPrStatus(elfNote.data);
console.log('prStatus', prStatus);

function elf64Note(buf) {
    var namesz = null;
    var descsz = null;
    var type = null;

    namesz = parser.readUInt32(buf, 0);
    descsz = parser.readUInt32(buf, 4);
    type = parser.readUInt32(buf, 8);

    var pad = 4 - (namesz % 4);
    var offset = 12 + namesz + pad;

    return {
        namesz: namesz,
        descsz: descsz,
        type: type,
        name: buf.slice(12, 12 + namesz).toString(),
        data: buf.slice(offset, buf.length)
    };
}

function elfPrStatus(buf) {
    var sigInfo = {
        signo: parser.readUInt32(buf, 0),
        code: parser.readUInt32(buf, 4),
        errno: parser.readUInt32(buf, 8)
    };

    var rpbInt64 = new Int64(0x00007fffd16f0220)
    var rspInt64 = new Int64(0x00007fffd16f01f0);

    return {
        sigInfo: sigInfo,
        cursig: parser.readUInt32(buf, 12),
        sigpend: parser.readUInt64(buf, 16),
        sighold: parser.readUInt64(buf, 24),
        pid: parser.readUInt32(buf, 32),
        ppid: parser.readUInt32(buf, 36),
        pgrp: parser.readUInt32(buf, 40),
        sid:  parser.readUInt32(buf, 44),
        // utime; skip 32 bytes
        // stime; skip 32 bytes
        // cutime; skip 32 bytes
        // cstime; skip 32 bytes
        prs: elfPrStatusPrs(buf.slice(112))
    }
}

function elfPrStatusPrs(buf) {
    // 27 longs
    return {
        // long #5
        bp: parser.readUInt64(buf, 32),
        // long #17
        ip: parser.readUInt64(buf, 128),
        // long #20
        sp: parser.readUInt64(buf, 152)
    }
}

