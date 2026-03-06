const { insertCoin, onPlayerJoin, myPlayer } = Playroom;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const speedMeter = document.getElementById("speed-meter");
const distanceMeter = document.getElementById("distance-meter");

canvas.width = 400; 
canvas.height = 800;

let players = [];
let roadPoints = [];
let cityObjects = []; 

const ROAD_WIDTH = 180;
const SEG_H = 90;
const MAX_SPEED = 25; 
const ACCELERATION = 0.15; 
const FINISH_LINE_SEGMENT = 1500; 

const inputs = { left: false, right: false };

// --- 1. WORLD GENERATION (Road & Away-from-road Houses) ---
function generateWorld() {
    for (let i = 0; i <= 2000; i++) {
        const xOffset = Math.sin(i * 0.05) * 85;
        const roadX = 200 + xOffset;
        const roadY = -i * SEG_H;
        roadPoints.push({ x: roadX, y: roadY });

        // Generate City Objects only every 3 segments
        if (i % 3 === 0) {
            const side = Math.random() > 0.5 ? 1 : -1;
            // Placement Logic: Road Half (90) + Sidewalk (30) + House Width/2 (25) + Random Gap
            const safeDistance = (ROAD_WIDTH / 2) + 60; 
            const finalX = roadX + (side * (safeDistance + Math.random() * 50));
            
            const type = Math.random() > 0.4 ? "house" : "tree";
            cityObjects.push({
                x: finalX,
                y: roadY,
                type: type,
                width: type === "house" ? 50 + Math.random() * 30 : 25,
                height: type === "house" ? 80 + Math.random() * 120 : 50,
                color: type === "house" ? `hsl(${Math.random() * 360}, 20%, 35%)` : "#1e3d1a"
            });
        }
    }
}

// --- 2. INPUT LISTENERS ---
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

// --- 3. START GAME ---
async function start() {
    generateWorld();
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

// --- 4. PHYSICS & LOGIC ---
function update() {
    const me = myPlayer();
    const myData = players.find(p => p.state.id === me.id);

    // Winner Check
    const winnerName = Playroom.getState("winner");
    if (winnerName) {
        document.getElementById("winner-ui").style.display = "flex";
        document.getElementById("winner-text").innerText = winnerName + " WINS!";
        if (myData) myData.speed = 0; 
        return; 
    }

    if (myData) {
        const finishLineY = Math.abs(roadPoints[FINISH_LINE_SEGMENT].y);
        distanceMeter.innerText = `GOAL: ${Math.floor(Math.max(0, finishLineY - myData.progress) / 10)}m`;

        // Cross Finish Line
        if (myData.progress >= finishLineY) {
            Playroom.setState("winner", myData.name, true);
        }
        
        // Auto-Acceleration
        if (myData.speed < MAX_SPEED) myData.speed += ACCELERATION;
        myData.progress += myData.speed;

        // Steering
        if (inputs.left) myData.x -= 10;
        if (inputs.right) myData.x += 10;

        // Road Bounds Check
        const idx = Math.floor(myData.progress / SEG_H);
        const center = roadPoints[idx]?.x || 200;
        const limit = (ROAD_WIDTH / 2) - 7.5;

        if (myData.x < center - limit || myData.x > center + limit) {
            myData.speed = 5; // Penalty speed
            myData.x = Math.max(center - limit, Math.min(center + limit, myData.x));
        }

        speedMeter.innerText = `SPEED: ${Math.floor(myData.speed * 10)} km/h`;
        me.setState("pos", { x: myData.x, progress: myData.progress, speed: myData.speed });
    }

    // Sync Players
    players.forEach(p => {
        const r = p.state.getState("pos");
        if (r) { p.x = r.x; p.progress = r.progress; p.speed = r.speed; }
    });
}

// --- 5. DRAWING FUNCTIONS ---
function drawPixelHouse(obj) {
    ctx.fillStyle = obj.color;
    ctx.fillRect(obj.x - obj.width/2, obj.y - obj.height/2, obj.width, obj.height);
    // Yellow Windows
    ctx.fillStyle = "#ffe066";
    const winSize = 6;
    for(let h = 15; h < obj.height - 15; h += 25) {
        ctx.fillRect(obj.x - obj.width/4, obj.y - obj.height/2 + h, winSize, winSize);
        ctx.fillRect(obj.x + obj.width/4 - winSize, obj.y - obj.height/2 + h, winSize, winSize);
    }
}

function drawPixelTree(obj) {
    ctx.fillStyle = "#3e2723"; 
    ctx.fillRect(obj.x - 4, obj.y - 10, 8, 20);
    ctx.fillStyle = "#2e7d32"; 
    ctx.fillRect(obj.x - 15, obj.y - 35, 30, 30);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const myData = players.find(p => p?.state.id === myPlayer()?.id);
    const camY = myData ? myData.progress : 0;

    ctx.save();
    ctx.translate(0, camY + 600);

    // Draw City Objects (Houses/Trees)
    cityObjects.forEach(obj => {
        if (Math.abs(obj.y + camY) < 1000) {
            if (obj.type === "house") drawPixelHouse(obj);
            else drawPixelTree(obj);
        }
    });

    // Draw Sidewalks
    ctx.beginPath();
    ctx.strokeStyle = "#555"; ctx.lineWidth = ROAD_WIDTH + 40;
    roadPoints.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.stroke();

    // Draw Asphalt
    ctx.beginPath();
    ctx.strokeStyle = "#222"; ctx.lineWidth = ROAD_WIDTH;
    roadPoints.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.stroke();

    // Draw Finish Line
    const f = roadPoints[FINISH_LINE_SEGMENT];
    if (f) {
        ctx.fillStyle = "white"; ctx.fillRect(f.x - ROAD_WIDTH/2, f.y, ROAD_WIDTH, 60);
        ctx.fillStyle = "black";
        for(let i=0; i<ROAD_WIDTH; i+=20) {
            for(let j=0; j<60; j+=20) if((i+j)%40===0) ctx.fillRect(f.x-ROAD_WIDTH/2+i, f.y+j, 20, 20);
        }
    }

    // Lane Markings
    ctx.setLineDash([30, 30]); ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
    ctx.beginPath();
    roadPoints.forEach(pt => ctx.lineTo(pt.x - ROAD_WIDTH/2, pt.y)); ctx.stroke();
    ctx.beginPath();
    roadPoints.forEach(pt => ctx.lineTo(pt.x + ROAD_WIDTH/2, pt.y)); ctx.stroke();

    // Draw Cars
    players.forEach(p => {
        ctx.save();
        ctx.translate(p.x, -p.progress);
        ctx.fillStyle = p.color;
        ctx.fillRect(-7.5, -25, 15, 50);
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "bold 12px Arial";
        ctx.fillText(p.name, 0, -35);
        ctx.restore();
    });

    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
start();