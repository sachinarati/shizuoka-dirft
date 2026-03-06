const { insertCoin, onPlayerJoin, myPlayer } = Playroom;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const speedMeter = document.getElementById("speed-meter");
const distanceMeter = document.getElementById("distance-meter"); // NEW

canvas.width = 400; 
canvas.height = 800;

let players = [];
let roadPoints = [];
const ROAD_WIDTH = 180;
const SEG_H = 90;
const MAX_SPEED = 25; 
const ACCELERATION = 0.15; 
const FINISH_LINE_SEGMENT = 1500; 

const inputs = { left: false, right: false };

function generateRoad() {
    for (let i = 0; i <= 2000; i++) {
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
    
    window.onkeydown = (e) => { if(e.key === "ArrowLeft") inputs.left = true; if(e.key === "ArrowRight") inputs.right = true; };
    window.onkeyup = (e) => { if(e.key === "ArrowLeft") inputs.left = false; if(e.key === "ArrowRight") inputs.right = false; };
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
            x: 200, progress: 0, speed: 5,
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

    const winnerName = Playroom.getState("winner");
    if (winnerName) {
        document.getElementById("winner-ui").style.display = "flex";
        document.getElementById("winner-text").innerText = winnerName + " WINS!";
        if (myData) myData.speed = 0; 
        return; 
    }

    if (myData) {
        const finishLineY = Math.abs(roadPoints[FINISH_LINE_SEGMENT].y);
        
        // --- DISTANCE LEFT CALCULATION ---
        let distLeft = Math.max(0, finishLineY - myData.progress);
        distanceMeter.innerText = `GOAL: ${Math.floor(distLeft / 10)}m`;

        if (myData.progress >= finishLineY) {
            Playroom.setState("winner", myData.name, true);
        }
        
        if (myData.speed < MAX_SPEED) myData.speed += ACCELERATION;
        myData.progress += myData.speed;

        if (inputs.left) myData.x -= 10;
        if (inputs.right) myData.x += 10;

        const idx = Math.floor(myData.progress / SEG_H);
        const center = roadPoints[idx]?.x || 200;
        const limit = (ROAD_WIDTH / 2) - 7.5;

        if (myData.x < center - limit || myData.x > center + limit) {
            myData.speed = 5; 
            myData.x = Math.max(center - limit, Math.min(center + limit, myData.x));
        }

        speedMeter.innerText = `SPEED: ${Math.floor(myData.speed * 10)} km/h`;
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

    // Road Asphalt
    ctx.beginPath();
    ctx.strokeStyle = "#333"; ctx.lineWidth = ROAD_WIDTH;
    roadPoints.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.stroke();

    // Finish Line
    const f = roadPoints[FINISH_LINE_SEGMENT];
    if (f) {
        ctx.fillStyle = "white";
        ctx.fillRect(f.x - ROAD_WIDTH/2, f.y, ROAD_WIDTH, 60);
        ctx.fillStyle = "black";
        for(let i=0; i<ROAD_WIDTH; i+=20) {
            for(let j=0; j<60; j+=20) {
                if((i+j) % 40 === 0) ctx.fillRect(f.x - ROAD_WIDTH/2 + i, f.y + j, 20, 20);
            }
        }
    }

    // Lane Markings
    ctx.setLineDash([30, 30]);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
    ctx.beginPath();
    roadPoints.forEach(pt => ctx.lineTo(pt.x - ROAD_WIDTH/2, pt.y));
    ctx.stroke();
    ctx.beginPath();
    roadPoints.forEach(pt => ctx.lineTo(pt.x + ROAD_WIDTH/2, pt.y));
    ctx.stroke();

    // Draw All Cars
    players.forEach(p => {
        ctx.save();
        ctx.translate(p.x, -p.progress);
        
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(-6.5, -23, 15, 50);

        // Body (15px wide)
        ctx.fillStyle = p.color;
        ctx.fillRect(-7.5, -25, 15, 50);

        // Windshield
        ctx.fillStyle = "#333";
        ctx.fillRect(-5.5, -12, 11, 12);

        // Name
        ctx.fillStyle = "white"; ctx.textAlign = "center";
        ctx.font = "bold 12px Arial";
        ctx.fillText(p.name, 0, -35);
        ctx.restore();
    });
    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
start();