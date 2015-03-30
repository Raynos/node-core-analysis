# core analysis coed.

This is a proof of concept of reading %rbp and %rsp from a node core file.

All this program outputs is the stack frame pointer.

Given the core file and the stack frame pointer we should be able to re-implement
the mdb jsstack helper in pure javascript.

