const midi = require('midi');
const input = new midi.Input();
const H = Math.pow(2, 1/12);

input.getPortCount();
input.getPortName(0);
try {input.openPort(0);}
catch(err) {console.error('Could not find MIDI device');}

input.ignoreTypes(true, true, true);
console.log('\x1b[31m%s\x1b[0m', 'KeyboardSharp Ready!');

let noteMode = 'generic';
let mods = [];
input.on('message', (deltaTime, message) => {
    const [cmd, id, val] = message;
    switch(cmd) {
        case 144:
            // key pressed
            if(noteMode === 'generic') {
                let note = 440 * Math.pow(H, toSteps(id));
                playFreq(Math.floor(note));
                if(mods.includes('major')) {
                    playFreq(Math.floor(note * 5/4));
                    playFreq(Math.floor(note * 3/2));
                } else if(mods.includes('minor')) {
                    playFreq(Math.floor(note * 6/5));
                    playFreq(Math.floor(note * 3/2));
                }
            } else specialNote(id);
            break;
        case 176:
            // button pressed
            input.emit('button', id - 50, val === 127? 'pressed' : 'released');
            break;
        
    }
    
});
input.on('note', (half) => {
    let note = 440 * Math.pow(H, half);
    playFreq(Math.floor(note));
});
input.on('button', (button, state) => {
    if(button === 1) {
        if(state === 'pressed') mods.push('major');
        else mods.splice(mods.indexOf('major'), 1);
    } else if(button === 2) {
        if(state === 'pressed') mods.push('minor');
        else mods.splice(mods.indexOf('minor'), 1);
    } else if(button === 3 && state === 'pressed') {
        noteMode = noteMode === 'generic' ? 'filled' : 'generic';
    }
});

const cp = require('child_process');

function playFreq(freq) {
    const player = 'afplay';
    const base = 'C#.wav';
    const out = `notes/${freq}.wav`;

    let scale = 554 / freq;
    let createFile = cp.spawn('ffmpeg', ['-y', '-i', base, '-af', `asetrate=${48000/*44100*/ / scale}`, out]);
    
    createFile.on('exit', () => {
        let playSound = cp.spawn(player, [out,'-r', scale, '-v', scale]);
        playSound.on('exit', () => {
            cp.spawn('rm', [out]);
        });
    });
}

function toSteps(raw) {
    return raw - 69;
}

let past = {};
function specialNote(key) {
    // find k, the shifted note position
    let abs = key - 69;
    let k = mod(abs, 12);
    if(k > 7) k++;
    if(k > 2) k++;
    k += 14 * Math.floor(abs / 12);

    // check for BC or EF combos
    //  B  C  E  F
    if([2, 4, 8, 10].includes(mod(k, 14))) {
        let neg = [2, 8].includes(mod(k, 14)) ? 1 : -1;
        let other = past[k + 2 * neg];
        if(other) {
            // other note was pressed within time
            clearTimeout(other);
            delete past[k + 2 * neg];
            input.emit('note', k + neg);
        } else {
            // store note, wait for other press
            let wait = setTimeout(() => {
                delete past[k];
                input.emit('note', k);
            }, 10);
            past[k] = wait;
        }
    } else {
        input.emit('note', k);
    }
}

const mod = (x, n) => (x % n + n) % n;