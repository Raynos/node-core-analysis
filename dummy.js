console.log('pid:', process.pid);
while (true) {
    foo();
}

function foo() {
    return bar() + bar();
}

function bar() {
    return Math.random();
}
