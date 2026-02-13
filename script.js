const CONFIG = {
    PULL_STRENGTH: 5,   // How much rope moves per correct answer
    PENALTY_STRENGTH: 3,// How much rope moves back per wrong answer
    WIN_ZONE_WIDTH: 16.66, // % width of win zone
    MAX_NUMBER: 9,
    MIN_NUMBER: 1
};

const gameState = {
    status: 'start', // start, countdown, playing, end
    ropePosition: 50, // 0 to 100, 50 is center
    p1: {
        currentProblem: {},
        status: 'idle'
    },
    p2: {
        currentProblem: {},
        status: 'idle'
    }
};

const screens = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-container'),
    winner: document.getElementById('winner-overlay'),
    countdown: document.getElementById('countdown-overlay')
};

const countdownText = document.getElementById('countdown-text');
const ropeSystem = document.getElementById('rope-system');
const p1Char = document.getElementById('p1-char');
const p2Char = document.getElementById('p2-char');
const winnerText = document.getElementById('winner-text');

// Audio Context Setup
let audioCtx;
let isMuted = false;
let bgmOscillators = [];
let nextNoteTime = 0;
let musicTimer = null;
let currentNoteIndex = 0;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// 8-bit Circus Theme Melody (Entry of the Gladiators style)
// Note frequencies (Hz) and duration (beats)
const melody = [
    { f: 261.63, d: 0.2 }, { f: 0, d: 0.1 }, { f: 293.66, d: 0.2 }, { f: 0, d: 0.1 }, // C4, D4
    { f: 329.63, d: 0.2 }, { f: 0, d: 0.1 }, { f: 349.23, d: 0.2 }, { f: 0, d: 0.1 }, // E4, F4
    { f: 392.00, d: 0.4 }, { f: 0, d: 0.1 }, { f: 392.00, d: 0.4 }, { f: 0, d: 0.1 }, // G4, G4
    { f: 440.00, d: 0.2 }, { f: 0, d: 0.1 }, { f: 392.00, d: 0.2 }, { f: 0, d: 0.1 }, // A4, G4
    { f: 349.23, d: 0.2 }, { f: 0, d: 0.1 }, { f: 329.63, d: 0.2 }, { f: 0, d: 0.1 }, // F4, E4
    { f: 293.66, d: 0.4 }, { f: 0, d: 0.1 }, // D4
];

function playCircusTheme() {
    if (isMuted || !audioCtx) return;

    // Simple sequencer logic
    function scheduleNote() {
        if (isMuted || gameState.status !== 'playing') return;

        const note = melody[currentNoteIndex % melody.length];
        const t = audioCtx.currentTime;

        if (note.f > 0) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'square'; // 8-bit sound
            osc.frequency.setValueAtTime(note.f, t);

            gain.gain.setValueAtTime(0.05, t); // Low volume background
            gain.gain.exponentialRampToValueAtTime(0.01, t + note.d - 0.05);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(t);
            osc.stop(t + note.d);

            // Keep track to stop if needed
            // (Simpler here: we just let them play out since they are short)
        }

        currentNoteIndex++;

        // Calculate next note time
        // We use setTimeout for simplicity in this loop, though strictly 
        // AudioContext scheduling is more precise. customized for "circus" loose feel.
        musicTimer = setTimeout(scheduleNote, note.d * 1000);
    }

    scheduleNote();
}

function stopMusic() {
    if (musicTimer) clearTimeout(musicTimer);
    // Oscillators stop themselves
}

function toggleMusic() {
    isMuted = !isMuted;
    const btn = document.getElementById('audio-btn');
    const onIcon = document.getElementById('icon-sound-on');
    const offIcon = document.getElementById('icon-sound-off');

    if (isMuted) {
        onIcon.classList.add('hidden');
        offIcon.classList.remove('hidden');
        stopMusic();
    } else {
        onIcon.classList.remove('hidden');
        offIcon.classList.add('hidden');
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        if (gameState.status === 'playing') playCircusTheme();
    }
}

function speak(text) {
    if ('speechSynthesis' in window && !isMuted) {
        // iOS requires canceling previous speech sometimes
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.2;
        utterance.pitch = 1.2;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

function playCheer() {
    if (isMuted || !audioCtx) return; // Respect mute
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const t = audioCtx.currentTime;
    // Simple "Ding"
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.frequency.setValueAtTime(523.25, t); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.5, t + 0.1); // C6

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    osc.start(t);
    osc.stop(t + 0.5);
}

function playVictorySound() {
    if (isMuted || !audioCtx) return; // Respect mute
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const t = audioCtx.currentTime;

    // Fanfare: Ta-da-da-DAAA!
    // Notes: C4, E4, G4, C5 (C Major Arpeggio)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const times = [0, 0.15, 0.3, 0.6];
    const durations = [0.15, 0.15, 0.3, 1.5];

    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle'; // Brass-like
        osc.frequency.setValueAtTime(freq, t + times[i]);

        gain.gain.setValueAtTime(0, t + times[i]);
        gain.gain.linearRampToValueAtTime(0.5, t + times[i] + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + times[i] + durations[i]);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t + times[i]);
        osc.stop(t + times[i] + durations[i]);
    });
}


// Fireworks System
const canvas = document.getElementById('fireworks');
const ctx = canvas ? canvas.getContext('2d') : null;
let fireworks = [];
let particles = [];
let animationId;

function resizeCanvas() {
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Firework {
    constructor(x, y, targetX, targetY, color) {
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.color = color;
        this.speed = 2;
        this.angle = Math.atan2(targetY - y, targetX - x);
        this.velocity = {
            x: Math.cos(this.angle) * this.speed,
            y: Math.sin(this.angle) * this.speed
        };
        this.distanceTraveled = 0;
        this.distanceToTarget = Math.sqrt(Math.pow(targetX - x, 2) + Math.pow(targetY - y, 2));
    }

    update(index) {
        this.x += this.velocity.x * 5; // Speed up launch
        this.y += this.velocity.y * 5;

        const distance = Math.sqrt(Math.pow(this.x - this.targetX, 2) + Math.pow(this.y - this.targetY, 2));
        if (distance < 10) {
            // Explode
            createParticles(this.targetX, this.targetY, this.color);
            fireworks.splice(index, 1);
        }
    }

    draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.velocity = {
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 8
        };
        this.alpha = 1;
        this.friction = 0.95;
        this.gravity = 0.2;
    }

    update(index) {
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.velocity.y += this.gravity;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.015;

        if (this.alpha <= 0) {
            particles.splice(index, 1);
        }
    }

    draw() {
        if (!ctx) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 50; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function loopFireworks() {
    if (!ctx) return;
    animationId = requestAnimationFrame(loopFireworks);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    // Spawn random fireworks
    if (Math.random() < 0.05) {
        const x = Math.random() * canvas.width;
        const targetY = Math.random() * (canvas.height / 2);
        const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        fireworks.push(new Firework(x, canvas.height, x, targetY, color));
    }

    fireworks.forEach((fw, i) => fw.update(i));
    fireworks.forEach(fw => fw.draw());

    particles.forEach((p, i) => p.update(i));
    particles.forEach(p => p.draw());
}

function startFireworks() {
    cancelAnimationFrame(animationId);
    loopFireworks();
}

function stopFireworks() {
    cancelAnimationFrame(animationId);
    fireworks = [];
    particles = [];
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

document.getElementById('start-btn').addEventListener('click', () => {
    unlockAudio(); // Force unlock for iOS
    startCountdown();
});

// Audio Toggle Listener
const audioBtn = document.getElementById('audio-btn');
if (audioBtn) {
    audioBtn.addEventListener('click', toggleMusic);
}

const restartBtn = document.getElementById('restart-btn');
if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        resetGame();
    });
}

function startCountdown() {
    gameState.status = 'countdown';
    screens.start.classList.add('hidden');
    screens.game.classList.remove('hidden');
    screens.countdown.classList.remove('hidden');

    let count = 3;

    function updateCount() {
        if (count > 0) {
            countdownText.textContent = count;
            countdownText.classList.remove('scale-100');
            void countdownText.offsetWidth; // Trigger reflow
            countdownText.classList.add('scale-150');

            speak(count.toString());

            setTimeout(() => {
                count--;
                updateCount();
            }, 1000);
        } else {
            countdownText.textContent = "FIGHT!";
            speak("Fight!");

            setTimeout(() => {
                screens.countdown.classList.add('hidden');
                startGame();
            }, 1000);
        }
    }

    updateCount();
}

function startGame() {
    // Unlock Audio Context on user interaction
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    stopFireworks(); // Reset FX

    // Reset visual card state
    const card = document.getElementById('winner-card');
    if (card) {
        card.classList.remove('scale-100');
        card.classList.add('scale-0');
    }

    gameState.status = 'playing';
    gameState.ropePosition = 50;
    gameState.p1.status = 'idle';
    gameState.p2.status = 'idle';

    screens.start.classList.add('hidden');
    screens.winner.classList.add('hidden');
    screens.game.classList.remove('hidden');

    // Start Background Music
    if (!isMuted) {
        // audioCtx.resume() is already handled in click event, but good safety check
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        currentNoteIndex = 0; // Reset melody
        playCircusTheme();
    }

    generateProblem('p1');
    generateProblem('p2');
    updateVisuals();
}

function resetGame() {
    // screens.game.classList.add('hidden'); // Optional: Hide game to show start screen?
    // For now, instant restart
    screens.winner.classList.add('hidden');
    startCountdown(); // Go back to countdown
}

function generateProblem(player) {
    const a = Math.floor(Math.random() * (CONFIG.MAX_NUMBER - CONFIG.MIN_NUMBER + 1)) + CONFIG.MIN_NUMBER;
    const b = Math.floor(Math.random() * (CONFIG.MAX_NUMBER - CONFIG.MIN_NUMBER + 1)) + CONFIG.MIN_NUMBER;
    const answer = a + b;

    // Generate distractors
    let options = [answer];
    while (options.length < 3) {
        let distractor = answer + (Math.floor(Math.random() * 5) - 2); // +/- 2 range
        if (distractor > 0 && !options.includes(distractor)) {
            options.push(distractor);
        }
    }

    // Shuffle options
    options = options.sort(() => Math.random() - 0.5);

    gameState[player].currentProblem = { a, b, answer, options };
    renderProblem(player);
}

function renderProblem(player) {
    const pData = gameState[player];
    const problemEl = document.getElementById(`${player}-problem`);
    const optionsEl = document.getElementById(`${player}-options`);

    problemEl.textContent = `${pData.currentProblem.a} + ${pData.currentProblem.b}`;

    optionsEl.innerHTML = '';
    pData.currentProblem.options.forEach(opt => {
        const btn = document.createElement('button');
        const isP1 = player === 'p1';
        // Updated Button Styles for Theme
        const colorClasses = isP1
            ? 'bg-blue-100 border-blue-400 text-blue-900 hover:bg-blue-200'
            : 'bg-red-100 border-red-400 text-red-900 hover:bg-red-200';

        // Use standard classes, sizing will be handled by container grid
        btn.className = `${colorClasses} border-b-4 rounded-xl text-3xl md:text-4xl lg:text-5xl font-bold active:translate-y-1 active:border-b-0 shadow-md transition-all duration-100 w-full h-full flex items-center justify-center`;

        btn.textContent = opt;
        btn.onclick = () => handleAnswer(player, opt, btn);
        optionsEl.appendChild(btn);
    });
}

function handleAnswer(player, answer, btnElement) {
    if (gameState.status !== 'playing') return;

    const isCorrect = answer === gameState[player].currentProblem.answer;

    if (isCorrect) {
        // Correct!
        playCheer(); // Sound Effect

        // Move rope based on who answered
        if (player === 'p1') {
            gameState.ropePosition -= CONFIG.PULL_STRENGTH;
            triggerPullAnimation('p1');
            triggerLightning('p1');
        } else {
            gameState.ropePosition += CONFIG.PULL_STRENGTH;
            triggerPullAnimation('p2');
            triggerLightning('p2');
        }

        // Visual feedback
        btnElement.classList.replace('bg-blue-100', 'bg-green-500');
        btnElement.classList.replace('bg-red-100', 'bg-green-500');
        btnElement.classList.add('text-white', 'border-green-700');

        // Screen Shake for Impact
        screens.game.classList.add('shake');
        setTimeout(() => screens.game.classList.remove('shake'), 400);

    } else {
        // Wrong!
        // Penalty: Rope slips back
        if (player === 'p1') {
            gameState.ropePosition += CONFIG.PENALTY_STRENGTH;
        } else {
            gameState.ropePosition -= CONFIG.PENALTY_STRENGTH;
        }

        // Visual feedback
        btnElement.classList.replace('bg-blue-100', 'bg-red-500');
        btnElement.classList.replace('bg-red-100', 'bg-red-500');
        btnElement.classList.add('text-white', 'border-red-700', 'shake');

        // Haptic (if supported)
        if (navigator.vibrate) navigator.vibrate(200);
    }

    checkWinCondition();

    if (isCorrect) {
        setTimeout(() => generateProblem(player), 200);
    } else {
        setTimeout(() => generateProblem(player), 400);
    }

    updateVisuals();
}

function triggerPullAnimation(player) {
    // Add pulling class to character
    const char = player === 'p1' ? p1Char : p2Char;
    // Remove heave-ho temporarily
    char.classList.remove('animate-heave-ho');

    // Simple Pull Animation
    // Since mirroring is handled by parent, we just rotate back for both!
    char.style.transform = 'rotate(-25deg) translateX(-5px)';

    setTimeout(() => {
        char.style.transform = ''; // Reset to empty (heave-ho handles the rest)
        char.classList.add('animate-heave-ho');
    }, 300);
}

function triggerLightning(player) {
    const lightning = document.getElementById(`${player}-lightning`);
    if (lightning) {
        lightning.classList.remove('hidden');
        lightning.classList.add('flash-effect');
        setTimeout(() => {
            lightning.classList.remove('flash-effect');
            lightning.classList.add('hidden');
        }, 300);
    }
}

function checkWinCondition() {
    // Win Zone is 16.66% width on each side.
    if (gameState.ropePosition <= CONFIG.WIN_ZONE_WIDTH) {
        endGame('p1');
    } else if (gameState.ropePosition >= (100 - CONFIG.WIN_ZONE_WIDTH)) {
        endGame('p2');
    }
}

function endGame(winner) {
    gameState.status = 'end';
    stopMusic(); // Stop Background Music

    // Final Visual Update to show 100%
    if (winner === 'p1') gameState.ropePosition = CONFIG.WIN_ZONE_WIDTH;
    if (winner === 'p2') gameState.ropePosition = 100 - CONFIG.WIN_ZONE_WIDTH;
    updateVisuals();

    setTimeout(() => {
        // Text Update
        const winTextEl = document.getElementById('winner-text');
        winTextEl.textContent = winner === 'p1' ? 'BLUE WINS!' : 'RED WINS!';
        winTextEl.className = `text-5xl md:text-7xl font-bold mb-2 mt-4 drop-shadow-md ${winner === 'p1' ? 'text-blue-500' : 'text-red-500'}`;

        // Show Overlay
        screens.winner.classList.remove('hidden');

        // Animate Card Entrance
        setTimeout(() => {
            const card = document.getElementById('winner-card');
            if (card) {
                card.classList.remove('scale-0');
                card.classList.add('scale-100');
            }
        }, 50);

        // Play FX
        if (typeof playVictorySound === 'function') playVictorySound();
        if (typeof startFireworks === 'function') startFireworks();

    }, 500); // Slight delay to see the rope enter the zone
}

function updateVisuals() {
    // POWER Calculation for UI
    // Center is 50. Win is <= 16.66 for P1, >= 83.34 for P2.
    // Distance needed = 50 - 16.66 = 33.34

    const distToWin = 33.34;

    // P1 Power: How far left from center?
    let p1Diff = 50 - gameState.ropePosition;
    let p1Power = Math.floor((Math.max(0, p1Diff) / distToWin) * 100);
    p1Power = Math.min(100, Math.max(0, p1Power)); // Clamp 0-100

    // P2 Power: How far right from center?
    let p2Diff = gameState.ropePosition - 50;
    let p2Power = Math.floor((Math.max(0, p2Diff) / distToWin) * 100);
    p2Power = Math.min(100, Math.max(0, p2Power)); // Clamp 0-100

    // Only update if elements exist
    const p1Bar = document.getElementById('p1-power-bar');
    const p2Bar = document.getElementById('p2-power-bar');

    if (p1Bar) p1Bar.style.width = `${p1Power}%`;
    if (p2Bar) p2Bar.style.width = `${p2Power}%`;

    // Update Rope Position
    const translatePct = gameState.ropePosition - 50;
    ropeSystem.style.transform = `translateX(${translatePct}%)`;

    // Losing Face Logic
    if (gameState.ropePosition > 70) {
        // P1 losing bad
        p1Char.classList.add('shake');
        p2Char.classList.remove('shake');
    } else if (gameState.ropePosition < 30) {
        // P2 losing bad
        p2Char.classList.add('shake');
        p1Char.classList.remove('shake');
    } else {
        p1Char.classList.remove('shake');
        p2Char.classList.remove('shake');
    }
}
