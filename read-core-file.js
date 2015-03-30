var ElfParser = require('elfy/lib/elfy/parser');
var assert = require('assert');
var hexer = require('hexer');
var Int64 = require('node-int64');

module.exports = readCoreFile;

function readCoreFile(coreFile) {
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

    var loadSections = programs.filter(function (p, index) {
        return p.type === 'load';
    });
    loadSections = loadSections.map(function (p, index) {
        p.index = index;
        return p;
    });
    assert(loadSections.length > 0);

    var elfNote = elf64Note(parser, note.data);
    // console.log('elfNote', elfNote);

    assert.equal(elfNote.type, 1);
    // console.log('len', elfNote.data.length);

    var prStatus = elfPrStatus(parser, elfNote.data);

    return {
        prStatus: prStatus,
        elf: elf,
        resolveAddress: resolveAddress
    };

    function resolveAddress(addr, size) {
        var largerIndex = loadSections.filter(function (p) {
            return p.vaddr > addr;
        });

        assert(largerIndex.length > 0,
            'pointer is above the virtual mem address');

        if (largerIndex[0].index === 0) {
            return null;
        }

        assert(largerIndex[0].index !== 0,
            'pointer is below the virtual mem address');

        var index = largerIndex[0].index - 1;

        var loadSection = loadSections[index];
        var offset = addr - loadSection.vaddr;

        // console.log('resolving addr', {
        //     addr: addr.toString('16'),
        //     index: index,
        //     delta: offset,
        //     vaddr: loadSection.vaddr.toString('16'),
        //     data: loadSection.data.length
        // });

        assert(offset < loadSection.data.length);

        var buffer = loadSection.data.slice(offset, offset + size);
        return buffer;
    }
}

function elf64Note(parser, buf) {
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

function elfPrStatus(parser, buf) {
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
        prs: elfPrStatusPrs(parser, buf.slice(112))
    }
}

function elfPrStatusPrs(parser, buf) {
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

