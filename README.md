# core analysis coed.

This is a proof of concept of reading %rbp and %rsp from a node core file.

All this program outputs is the stack frame pointer.

Given the core file and the stack frame pointer we should be able to re-implement
the mdb jsstack helper in pure javascript.

## Example output

```
$ node read-frame.js core 
frameType 4
--- functionName: empty
--- fileName: empty
--- functionName: empty
--- fileName: empty
--- functionName: empty
--- fileName: empty
--- functionName: bar
--- fileName: /home/raynos/projects/node-core-analysis/dummy.js
--- functionName: foo
--- fileName: /home/raynos/projects/node-core-analysis/dummy.js
--- functionName: empty
--- fileName: /home/raynos/projects/node-core-analysis/dummy.js
--- functionName: odule_compile
--- fileName: module.js
--- functionName: .......js
--- fileName: module.js
--- functionName: Module.load
--- fileName: module.js
--- functionName: Module._load
--- fileName: module.js
--- functionName: odulerunMain�
--- fileName: module.js
--- functionName: startup
print unkown shape 6
--- fileName: undefined
--- functionName: empty
print unkown shape 6
--- fileName: undefined
entry? 1
```
