// --- State Variables ---
let realMouseX = 0, realMouseY = 0;
let lagMouseX = 0, lagMouseY = 0;
let glitchIntensity = 0;
let mouseFrozen = false;
let inMaze = false;
let mazeGracePeriod = true;
let currentMazeLevel = 1;
let buttonMoves = 0;
let bsodTarget = 'final'; // 'maze' or 'final'
const fakeCursor = document.getElementById('fake-cursor');
const mouseBuffer = [];
const LAG_DELAY = 15;

// --- Mouse & Cursor Logic ---
document.addEventListener('mousemove', (e) => {
    realMouseX = e.clientX;
    realMouseY = e.clientY;
});

function updateCursor() {
    if (!mouseFrozen) {
        mouseBuffer.push({x: realMouseX, y: realMouseY});
        if (mouseBuffer.length > LAG_DELAY) {
            const pos = mouseBuffer.shift();
            lagMouseX = pos.x; lagMouseY = pos.y;
        } else {
            lagMouseX = realMouseX; lagMouseY = realMouseY;
        }
        let x = lagMouseX;
        let y = lagMouseY;
        if (glitchIntensity > 0) {
            x += (Math.random() - 0.5) * glitchIntensity;
            y += (Math.random() - 0.5) * glitchIntensity;
        }
        fakeCursor.style.transform = `translate(${x}px, ${y}px)`;
        if (inMaze) checkMazeCollision(x, y);
    }
    requestAnimationFrame(updateCursor);
}
requestAnimationFrame(updateCursor);

// --- Audio Engine ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();
function playBeep(freq = 440, type = 'sine', duration = 0.1, volume = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(); oscillator.stop(audioCtx.currentTime + duration);
}

// --- Maze Logic ---
const mazeLayouts = [
    [
        "S0011111111111111111",
        "10000001111111111111",
        "11111100000011111111",
        "11111111111000000111",
        "11111111111111100001",
        "11110000000000001101",
        "11110111111111111101",
        "11110111111111111101",
        "11110000001111111101",
        "11111111000000000001",
        "11111111111111111101",
        "1111111111111111110E"
    ],
    [
        "S0000000000000000001",
        "11111111111111111101",
        "11111111111111111101",
        "10000000000000000001",
        "10111111111111111111",
        "10111111111111111111",
        "10000000000000000001",
        "11111111111111111101",
        "11111111111111111101",
        "10000000000000000001",
        "10111111111111111111",
        "1000000000000000000E"
    ]
];

function loadMazeLevel(num) {
    currentMazeLevel = num;
    inMaze = true;
    mazeGracePeriod = true; // Start with grace period

    document.getElementById('maze-level-display').innerText = `Verification Step 1/4: Secure Path Entry (Level ${num}/2)`;
    const container = document.getElementById('maze-container');
    
    // Teleport cursor to START button center
    const mazeRect = container.getBoundingClientRect();
    const startX = mazeRect.left + 25; // center of 50px start
    const startY = mazeRect.top + 20; // center of 40px start
    
    realMouseX = lagMouseX = startX;
    realMouseY = lagMouseY = startY;
    mouseBuffer.length = 0; // Clear buffer to prevent "snapping" back
    
    // Clear previous cells
    document.querySelectorAll('.maze-cell').forEach(c => c.remove());
    
    const layout = mazeLayouts[num-1];
    layout.forEach((row, rIdx) => {
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
            const cell = document.createElement('div');
            cell.className = 'maze-cell';
            if (row[cIdx] === '1') cell.classList.add('wall');
            container.appendChild(cell);
        }
    });
    
    document.getElementById('maze-container').style.background = '#f0f0f0';
    document.getElementById('maze-msg').innerText = 'Starting in 5s... Stay in the path!';
    
    // 5 second grace period
    setTimeout(() => {
        if (inMaze) {
            mazeGracePeriod = false;
            document.getElementById('maze-msg').innerText = 'SECURITY ACTIVE: Do not touch walls!';
            document.getElementById('maze-container').style.borderColor = '#d13438';
        }
    }, 5000);
}

function checkMazeCollision(x, y) {
    if (mazeGracePeriod) return; // Ignore collisions during the 5s grace period

    const container = document.getElementById('maze-container');
    const rect = container.getBoundingClientRect();
    const endBtn = document.getElementById('maze-end');
    const endRect = endBtn.getBoundingClientRect();
    
    // 1. Check if cursor hits the visual END button FIRST
    // Using a small buffer to make it easier to trigger
    if (x >= endRect.left - 5 && x <= endRect.right + 5 && 
        y >= endRect.top - 5 && y <= endRect.bottom + 5) {
        inMaze = false;
        playBeep(1000, 'sine', 0.2, 0.1);
        if (currentMazeLevel < 2) {
            loadMazeLevel(currentMazeLevel + 1);
        } else {
            showSection('doors');
        }
        return; // Exit early if we won
    }

    // 2. Check if cursor is outside maze
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
    
    const relX = x - rect.left;
    const relY = y - rect.top;
    
    // 20 columns, 12 rows
    const col = Math.floor(relX / (rect.width / 20));
    const row = Math.floor(relY / (rect.height / 12));
    
    const layout = mazeLayouts[currentMazeLevel-1];
    if (layout[row]) {
        const cell = layout[row][col];
        if (cell === '1') {
            inMaze = false;
            playBeep(100, 'sawtooth', 0.5, 0.2);
            document.getElementById('maze-container').style.background = '#ffcccc';
            document.getElementById('maze-msg').innerText = "CRITICAL FAILURE: SYSTEM COMPROMISED";
            setTimeout(() => triggerBSOD('maze'), 800);
        }
    }
}

function failMaze() {
    inMaze = false;
    playBeep(100, 'sawtooth', 0.5, 0.2);
    document.getElementById('maze-container').style.background = '#ffcccc';
    document.getElementById('maze-msg').innerText = "ERROR: Integrity check failed. Restarting verification...";
    setTimeout(() => { loadMazeLevel(1); }, 1500);
}

// --- Core Flow Functions ---
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    document.getElementById(id + '-section').style.display = 'block';
}

function startScan() {
    showSection('progress');
    runRepair();
}

async function runRepair() {
    const fill = document.getElementById('fill');
    const status = document.getElementById('status');
    const msgs = [
        "Initializing repair sequence...",
        "Scanning kernel objects...",
        "Rebuilding registry hives...",
        "Mapping bad sectors...",
        "CRITICAL ERROR: Sector 0x82193 corrupted.",
        "Attempting automated recovery...",
        "Repairing system files (100%)...",
        "Verification required to finalize."
    ];
    for (let i = 0; i < msgs.length; i++) {
        status.innerText = msgs[i];
        fill.style.width = Math.round(((i + 1) / msgs.length) * 100) + '%';
        playBeep(600, 'sine', 0.05, 0.02);
        await new Promise(r => setTimeout(r, 1500));
    }
    showSection('maze'); loadMazeLevel(1);
}

// --- Doors Logic ---
function chooseDoor(num) {
    if (num === 7) { // Door 7 is the winner
        playBeep(800, 'sine', 0.1, 0.1);
        showSection('questions');
    } else {
        playBeep(150, 'sawtooth', 0.5, 0.2);
        triggerBSOD('maze');
    }
}

// --- Questions Logic ---
function submitQuestions() {
    const a1 = document.getElementById('q1').value.trim().toLowerCase();
    const a2 = document.getElementById('q2').value.trim().toLowerCase();
    
    if (a1 === "april" && a2 === "fools") {
        showFinal();
    } else {
        playBeep(150, 'sawtooth', 0.3, 0.1);
        alert("ERROR: Verification mismatch. Restarting security sequence.");
        showSection('maze');
        loadMazeLevel(1);
    }
}

// --- Global Functions ---
function tryCancel() { document.getElementById('error-popup').style.display = 'block'; }
function closePopup() { document.getElementById('error-popup').style.display = 'none'; }

function showRestartGif() {
    const overlay = document.getElementById('gif-overlay');
    overlay.style.display = 'flex';
    // Removed automatic reload to keep the final screen visible
}

function triggerBSOD(target = 'final') {
    bsodTarget = target;
    mouseFrozen = true; 
    fakeCursor.style.display = 'none';
    document.getElementById('bsod').style.display = 'block';
    let p = 0;
    const interval = setInterval(() => {
        p += Math.floor(Math.random() * 5) + 1;
        if (p > 100) p = 100;
        document.getElementById('bsod-percent').innerText = p + "% complete";
        if (p >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                if (bsodTarget === 'maze') {
                    document.getElementById('bsod').style.display = 'none';
                    fakeCursor.style.display = 'block';
                    mouseFrozen = false;
                    showSection('maze');
                    loadMazeLevel(1);
                } else {
                    showFinal();
                }
            }, 2000);
        }
    }, 300);
}

function showFinal() {
    mouseFrozen = false;
    document.body.style.cursor = 'auto';
    document.getElementById('bsod').style.display = 'none';
    document.getElementById('main-container').style.display = 'none';
    document.getElementById('final-screen').style.display = 'flex';
    nextStage('1');
}

function nextStage(id) {
    document.querySelectorAll('.reveal-stage').forEach(s => s.style.display = 'none');
    const next = document.getElementById('stage-' + id);
    if (next) {
        next.style.display = 'flex';
    }
    
    if (id === 'ultimate') {
        document.getElementById('af-text').style.display = 'block';
        const song = document.getElementById('prank-song');
        song.currentTime = 70; // 1:10
        song.play().catch(e => console.log("Audio play failed:", e));
    }
}

function checkDAA() {
    const a1 = document.getElementById('daa1').value.trim().toLowerCase();
    const a2 = document.getElementById('daa2').value.trim().toLowerCase();
    const a3 = document.getElementById('daa3').value.trim().toLowerCase();
    const a4 = document.getElementById('daa4').value.trim().toLowerCase();
    const a5 = document.getElementById('daa5').value.trim().toLowerCase();

    const isCorrect = (
        (a1.includes('n^2') || a1.includes('n2')) &&
        (a2.includes('divide') || a2.includes('conquer')) &&
        (a3.includes('greedy')) &&
        (a4 === 'yes' || a4 === 'y') &&
        (a5.includes('1'))
    );

    if (isCorrect) {
        playBeep(800, 'sine', 0.1, 0.1);
        nextStage('math');
    } else {
        playBeep(150, 'sawtooth', 0.3, 0.1);
        alert("ERROR: DAA verification failed. You need to study more! 😉");
    }
}

function checkMath() {
    const answer = document.getElementById('math-answer').value.trim();
    if (answer === "2416") {
        nextStage('ultimate');
    } else {
        playBeep(150, 'sawtooth', 0.3, 0.1);
        alert("ERROR: Security override failed. Recalculate and try again!");
    }
}

let stage1Clicks = 0;
function moveButton() {
    const btn = document.getElementById('moving-btn');
    stage1Clicks++;
    
    if (stage1Clicks === 1) {
        btn.innerText = "Click once more! 👆";
    } else if (stage1Clicks === 2) {
        btn.innerText = "Once more... 🔄";
    } else if (stage1Clicks === 3) {
        btn.innerText = "One last... ⏱️";
    } else if (stage1Clicks === 4) {
        btn.innerText = "One final final! 🏁";
    } else if (stage1Clicks >= 5) {
        nextStage('2');
    }
}

let stage2Clicks = 0;
function handleStage2Click() {
    const btn = document.getElementById('stage-2-btn');
    stage2Clicks++;
    
    if (stage2Clicks === 1) {
        btn.innerText = "Click once more! 👆";
    } else if (stage2Clicks === 2) {
        btn.innerText = "Once more... 🔄";
    } else if (stage2Clicks === 3) {
        btn.innerText = "One last... ⏱️";
    } else if (stage2Clicks === 4) {
        btn.innerText = "One final final! 🏁";
    } else if (stage2Clicks >= 5) {
        nextStage('3');
    }
}
