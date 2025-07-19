const bigs = [25, 50, 75, 100];
const smalls = [1,2,3,4,5,6,7,8,9,10,1,2,3,4,5,6,7,8,9,10];

function getBag(bigCount, smallCount) {
    const bigCopy = bigs.slice();
    const smallCopy = smalls.slice();
    const bag = [];
    for (let k = 0; k < bigCount; k++) {
        const idx = Math.floor(Math.random() * bigCopy.length);
        bag.push(bigCopy[idx]);
        bigCopy.splice(idx, 1);
    }
    for (let k = 0; k < smallCount; k++) {
        const idx = Math.floor(Math.random() * smallCopy.length);
        bag.push(smallCopy[idx]);
        smallCopy.splice(idx, 1);
    }
    return bag;
}

function generateDycks(numbers) {
    const ops = numbers - 1;
    const len = ops * 2;
    const dycks = [];
    function help(cur, score) {
        if (cur.length - 1 === len) {
            if (score === 0) dycks.push(cur);
            return;
        }
        if (score > 0) help(cur + "#", score - 1);
        if (score < len - cur.length) help(cur + "_", score + 1);
    }
    help("_", 0);
    return dycks;
}

function permutator(inputArr) {
    const results = [];
    function permute(arr, memo = []) {
        for (let i = 0; i < arr.length; i++) {
            const cur = arr.splice(i, 1);
            if (arr.length === 0) results.push(memo.concat(cur));
            permute(arr.slice(), memo.concat(cur));
            arr.splice(i, 0, cur[0]);
        }
    }
    permute(inputArr);
    return results;
}

function generateSequences(base, length) {
    if (length === 0) return [[]];
    const shorter = generateSequences(base, length - 1);
    const result = [];
    for (const seq of shorter) {
        for (let d = 0; d < base; d++) {
            result.push([...seq, d]);
        }
    }
    return result;
}

function combine(arr, m) {
    const result = [];
    function pick(start, chosen) {
        if (chosen.length === m) {
            result.push(chosen.slice());
            return;
        }
        for (let i = start; i < arr.length; i++) {
            chosen.push(arr[i]);
            pick(i + 1, chosen);
            chosen.pop();
        }
    }
    pick(0, []);
    return result;
}

const bag = getBag(2, 4);
const OP_PLUS = -1;
const OP_SUB  = -2;
const OP_MUL  = -3;
const OP_DIV  = -4;
const opCodes = [OP_PLUS, OP_SUB, OP_MUL, OP_DIV];
const solutions = new Map();
const N = bag.length;

for (let m = 1; m <= N; m++) {
    const dycks = generateDycks(m);
    const patterns = dycks.map(w => {
        const a = new Uint8Array(w.length);
        for (let i = 0; i < w.length; i++) a[i] = w[i] === "_" ? 0 : 1;
        return a;
    });
    const indexCombos = combine([...Array(N).keys()], m);
    const opSeqs = m > 1 ? generateSequences(4, m - 1) : [[]];

    for (const idxs of indexCombos) {
        const subset = idxs.map(i => bag[i]);
        const perms = permutator(subset);

        for (const perm of perms) {
            for (const ops of opSeqs) {
                for (const pattern of patterns) {
                    const plen = pattern.length;
                    const tokens = new Int32Array(plen);
                    let ni = 0;
                    let oi = 0;

                    for (let k = 0; k < plen; k++) {
                        if (pattern[k] === 0) {
                            tokens[k] = perm[ni++];
                        } else {
                            tokens[k] = opCodes[ops[oi++]];
                        }
                    }

                    const stack = new Int32Array(plen);
                    let sp = 0;
                    let valid = true;

                    for (let k = 0; k < plen; k++) {
                        const t = tokens[k];
                        if (t < 0) {
                            if (sp < 2) { valid = false; break; }
                            const b = stack[--sp];
                            const a = stack[--sp];
                            let res;
                            if (t === OP_DIV) {
                                if (b === 0 || a % b !== 0) { valid = false; break; }
                                res = a / b;
                            } else if (t === OP_PLUS) {
                                res = a + b;
                            } else if (t === OP_SUB) {
                                res = a - b;
                            } else {
                                res = a * b;
                            }
                            stack[sp++] = res;
                        } else {
                            stack[sp++] = t;
                        }
                    }

                    if (!valid || sp !== 1) continue;

                    const value = stack[0];
                    if (!Number.isInteger(value) || value < 101 || value > 999 || solutions.has(value)) continue;

                    const exprStack = [];
                    for (let k = 0; k < plen; k++) {
                        const t = tokens[k];
                        if (t < 0) {
                            const bstr = exprStack.pop();
                            const astr = exprStack.pop();
                            const sym = t === OP_PLUS ? "+" : t === OP_SUB ? "-" : t === OP_MUL ? "*" : "/";
                            exprStack.push(`(${astr} ${sym} ${bstr})`);
                        } else {
                            exprStack.push(t.toString());
                        }
                    }

                    solutions.set(value, `${exprStack[0]} = ${value}`);
                }
            }
        }
    }
}

console.log(bag)
keys = [...solutions.keys()]

index = Math.floor(Math.random() * keys.length)

key = keys[index]

console.log(solutions.get(key))

const missing = [];
for (let target = 101; target <= 999; target++) {
    if (!solutions.has(target)) {
        missing.push(target);
    }
}
console.log('Could not find solutions for:', missing);