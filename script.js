const { insertCoin, onPlayerJoin, myPlayer } = Playroom;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const speedMeter = document.getElementById("speed-meter");

canvas.width = 400; 
canvas.height = 800;

let players = [];
let roadPoints = [];
const ROAD_WIDTH = 180;
const SEG_H = 90;
const MAX_SPEED = 14;
const FINISH_LINE_SEGMENT = 2000; // Race ends here

const inputs = { left: false, right: false };

function generateRoad() {
    for (let i = 0; i < 2500; i++) {
        const xOffset = Math.sin(i * 0.05) * 85;
        roadPoints.push({ x: 200 + xOffset, y: -i * SEG_H });
    }
}

function setupInputs() {
    const l = document.getElementById("leftBtn");
    const r = document.getElementById("rightBtn");
    const press = (key, val) => { inputs[key] = val; };

    l.addEventListener("touchstart", (e) => { e.preventDefault(); press('left', true); }, {passive: false});
    l.addEventListener("touchend", (e) => { e.preventDefault(); press('left', false); }, {passive: false});
    r.addEventListener("touchstart", (e) => { e.preventDefault(); press('right', true); }, {passive: false});
    r.addEventListener("touchend", (e) => { e.preventDefault(); press('right', false); }, {passive: false});
    
    // Mouse Support
    l.onmousedown = () => press('left', true); l.onmouseup = () => press('left', false);
    r.onmousedown = () => press('right', true); r.onmouseup = () => press('right', false);
}

async function start() {
    generateRoad();
    setupInputs();
    await insertCoin();

    document.getElementById("lobby-ui").style.display = "none";
    document.getElementById("controls").style.display = "flex";

    onPlayerJoin((state) => {
        const p = {
            state: state,
            x: 200, progress: 0, speed: MAX_SPEED,
            color: state.getProfile().color.hex,
            name: state.getProfile().name
        };
        players.push(p);
    });
    gameLoop();
}

function update() {
    const me = myPlayer();
    const myData = players.find(p => p.state.id === me.id);

    if (myData) {
        // Winner Check
        const globalWinner = players.find(p => p.state.getState("winner"));
        if (globalWinner) {
            document.getElementById("winner-ui").style.display = "flex";
            document.getElementById("winner-text").innerText = globalWinner.state.getState("winner") + " WINS!";
            myData.speed = 0;
        } else {
            // Check if I just crossed the line
            if (myData.progress >= Math.abs(roadPoints[FINISH_LINE_SEGMENT].y)) {
                me.setState("winner", myData.name);
            }
            
            // Movement Logic
            if (myData.speed < MAX_SPEED) myData.speed += 0.07;
            myData.progress += myData.speed;
            if (inputs.left) myData.x -= 8;
            if (inputs.right) myData.x += 8;

            // Bounds & Bumping
            const idx = Math.floor(myData.progress / SEG_H);
            const center = roadPoints[idx]?.x || 200;
            const limit = (ROAD_WIDTH / 2) - 7.5;
            if (myData.x < center - limit || myData.x > center + limit) {
                myData.speed = 4;
                myData.x = Math.max(center - limit, Math.min(center + limit, myData.x));
            }
        }
        speedMeter.innerText = `SPEED: ${Math.floor(myData.speed * 10)}`;
        me.setState("pos", { x: myData.x, progress: myData.progress, speed: myData.speed });
    }

    players.forEach(p => {
        const r = p.state.getState("pos");
        if (r) { p.x = r.x; p.progress = r.progress; p.speed = r.speed; }
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const myData = players.find(p => p?.state.id === myPlayer()?.id);
    const camY = myData ? myData.progress : 0;

    ctx.save();
    ctx.translate(0, camY + 600);

    // Draw Road
    ctx.beginPath();
    ctx.strokeStyle = "#333"; ctx.lineWidth = ROAD_WIDTH;
    roadPoints.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.stroke();

    // Finish Line
    const f = roadPoints[FINISH_LINE_SEGMENT];
    ctx.fillStyle = "white";
    ctx.fillRect(f.x - ROAD_WIDTH/2, f.y, ROAD_WIDTH, 40);
    ctx.fillStyle = "black";
    for(let i=0; i<ROAD_WIDTH; i+=20) {
        ctx.fillRect(f.x - ROAD_WIDTH/2 + (i%40==0?i:i), f.y + (i%40==0?0:20), 20, 20);
    }

    // Draw Cars
    players.forEach(p => {
        ctx.save();
        ctx.translate(p.x, -p.progress);
        ctx.fillStyle = p.color;
        ctx.fillRect(-7.5, -25, 15, 50); // Body
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(-5, -8, 10, 15); // Glass
        ctx.fillStyle = "white"; ctx.textAlign = "center";
        ctx.fillText(p.name, 0, -35);
        ctx.restore();
    });
    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
start();