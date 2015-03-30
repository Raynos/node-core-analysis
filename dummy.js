console.log('pid:', process.pid);
while (true) {
    foo();
}

function foo() {
    eval('true');

    return bar() + bar();
}

function bar() {
    eval('true');

    return Math.random();
}
