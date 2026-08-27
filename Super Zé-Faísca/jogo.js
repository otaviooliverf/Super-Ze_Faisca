const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.5;
let score = 0;
let currentPhase = 1;
let gameActive = true;
let phaseCleared = false;
let globalTimer = 0;
let cameraX = 0;
const WORLD_WIDTH = 2400;

const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };

// CARREGAMENTO DE IMAGENS EXTERNAS (Cenários de Fundo Baseados nas Simulações)
const bgImages = {
    fase1: new Image(),
    fase2: new Image(),
    fase3: new Image(),
    fase4: new Image()
};
// URLs estáveis utilizando imagens temáticas do Unsplash (Rua escura, Cidade Cyberpunk, Universidade, Escritório Tech)
bgImages.fase1.src = "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&q=80"; 
bgImages.fase2.src = "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80";
bgImages.fase3.src = "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80";
bgImages.fase4.src = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80";

// Imagens dos sprites dos Inimigos/Objetivos
const sprites = {
    dog: new Image(),
    uno: new Image()
};
sprites.dog.src = "https://i.imgur.com/Y79YzST.png"; // Sprite de cachorro (fallback automático se falhar)
sprites.uno.src = "https://i.imgur.com/6Xw67kM.png"; // Uno com escada adaptado

// Frames locais do Zé. O fundo cinza e removido no carregamento para que
// apenas o personagem seja desenhado sobre qualquer cenário.
const zeFaiscaSourceFiles = ["Ze parado.jfif", "Ze1 (1).jfif", "Ze1 (2).jfif"];
const zeFaiscaFrames = [];
const zeFaiscaCrop = { x: 480, y: 20, width: 470, height: 730 };

function buildZeFaiscaFrame(image) {
    const frame = document.createElement('canvas');
    frame.width = zeFaiscaCrop.width;
    frame.height = zeFaiscaCrop.height;

    const frameCtx = frame.getContext('2d');
    frameCtx.drawImage(
        image,
        zeFaiscaCrop.x,
        zeFaiscaCrop.y,
        zeFaiscaCrop.width,
        zeFaiscaCrop.height,
        0,
        0,
        frame.width,
        frame.height
    );

    const pixels = frameCtx.getImageData(0, 0, frame.width, frame.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
        const red = pixels.data[i];
        const green = pixels.data[i + 1];
        const blue = pixels.data[i + 2];
        const colorSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
        const brightness = (red + green + blue) / 3;

        // Fundo original: tons neutros de cinza. Mantem os contornos escuros.
        if (colorSpread < 18 && brightness > 65 && brightness < 195) {
            pixels.data[i + 3] = 0;
        }
    }

    frameCtx.putImageData(pixels, 0, 0);
    return frame;
}

zeFaiscaSourceFiles.forEach((sourceFile, index) => {
    const image = new Image();
    image.addEventListener('load', () => {
        zeFaiscaFrames[index] = buildZeFaiscaFrame(image);
    });
    image.src = encodeURI(sourceFile);
});

const player = {
    x: 100, y: 300, width: 36, height: 56,
    vx: 0, vy: 0, speed: 5, jumpForce: 12.5,
    grounded: false, facing: 'right', crouching: false,
    walkCycle: 0, isWalking: false,
    epis: { bota: false, oculos: false, luvas: false, capacete: false, escada: false }
};

let platforms = [];
let items = [];
let enemies = [];
let targetGoal = {};

// Links dos ícones do inventário (Imagens reais de itens)
const itemIconsUrls = {
    "Botas": "https://cdn-icons-png.flaticon.com/512/844/844362.png",
    "Óculos": "https://cdn-icons-png.flaticon.com/512/1253/1253756.png",
    "Luvas": "https://cdn-icons-png.flaticon.com/512/824/824361.png",
    "Capacete": "https://cdn-icons-png.flaticon.com/512/1085/1085751.png",
    "Escada": "https://cdn-icons-png.flaticon.com/512/3038/3038108.png",
    "Tomada": "https://cdn-icons-png.flaticon.com/512/934/934424.png",
    "Lâmpada": "https://cdn-icons-png.flaticon.com/512/2987/2987996.png",
    "Interruptor": "https://cdn-icons-png.flaticon.com/512/1835/1835744.png",
    "Fios": "https://cdn-icons-png.flaticon.com/512/3067/3067566.png",
    "QDC": "https://cdn-icons-png.flaticon.com/512/1162/1162444.png",
    "Livro": "https://cdn-icons-png.flaticon.com/512/2232/2232688.png",
    "Dinheiro": "https://cdn-icons-png.flaticon.com/512/2489/2489756.png",
    "Diploma": "https://cdn-icons-png.flaticon.com/512/3135/3135810.png",
    "Notebook": "https://cdn-icons-png.flaticon.com/512/428/428001.png",
    "Filho": "https://cdn-icons-png.flaticon.com/512/4140/4140043.png",
    "Planta": "https://cdn-icons-png.flaticon.com/512/3222/3222687.png"
};

function updateHUDInventory(phaseItems) {
    for (let i = 0; i < 5; i++) {
        const slot = document.getElementById(`slot${i}`);
        slot.innerHTML = "";
        slot.className = "inv-item";
        if (phaseItems[i]) {
            let img = document.createElement('img');
            img.src = itemIconsUrls[phaseItems[i].type];
            slot.appendChild(img);
            if (phaseItems[i].collected) slot.classList.add('collected');
        }
    }
}

function initPhase(phase) {
    currentPhase = phase;
    phaseCleared = false;
    cameraX = 0;
    player.x = 100; player.y = 200; player.vx = 0; player.vy = 0;
    
    if (phase === 1) {
        document.getElementById("phaseTitle").innerText = "FASE 1: O ELETRICISTA (EPIs)";
        document.getElementById("gameAlert").innerText = "Busque os EPIs essenciais na obra!";
        platforms = [
            { x: 0, y: 380, width: 2400, height: 40 },
            { x: 300, y: 280, width: 200, height: 16 },
            { x: 650, y: 200, width: 180, height: 16 },
            { x: 1000, y: 290, width: 250, height: 16 },
            { x: 1400, y: 220, width: 200, height: 16 },
            { x: 1800, y: 270, width: 300, height: 16 }
        ];
        items = [
            { x: 350, y: 240, type: 'Botas', collected: false },
            { x: 700, y: 160, type: 'Óculos', collected: false },
            { x: 1100, y: 250, type: 'Luvas', collected: false },
            { x: 1500, y: 180, type: 'Capacete', collected: false },
            { x: 1950, y: 230, type: 'Escada', collected: false }
        ];
        enemies = [
            { x: 500, y: 340, width: 45, height: 40, type: 'cachorro', speed: -2.5, minX: 250, maxX: 600 },
            { x: 900, y: 355, width: 30, height: 25, type: 'pedra', speed: 0 },
            { x: 1300, y: 80, width: 50, height: 35, type: 'nuvem', speed: 2, minX: 1100, maxX: 1600 }
        ];
        targetGoal = { x: 2300, y: 140, width: 40, height: 240, type: 'poste' };

    } else if (phase === 2) {
        document.getElementById("phaseTitle").innerText = "FASE 2: MATERIAIS NO UNO";
        document.getElementById("gameAlert").innerText = "Carregue o Uno de Firma!";
        platforms = [
            { x: 0, y: 380, width: 2400, height: 40 },
            { x: 250, y: 270, width: 220, height: 16 },
            { x: 600, y: 190, width: 200, height: 16 },
            { x: 950, y: 280, width: 220, height: 16 }
        ];
        items = [
            { x: 300, y: 230, type: 'Tomada', collected: false },
            { x: 680, y: 150, type: 'Lâmpada', collected: false },
            { x: 1050, y: 240, type: 'Interruptor', collected: false },
            { x: 1450, y: 170, type: 'Fios', collected: false },
            { x: 1850, y: 250, type: 'QDC', collected: false }
        ];
        enemies = [
            { x: 800, y: 340, width: 45, height: 40, type: 'cachorro', speed: -3, minX: 600, maxX: 1100 },
            { x: 1200, y: 90, width: 50, height: 35, type: 'nuvem', speed: 1.5, minX: 1000, maxX: 1400 }
        ];
        targetGoal = { x: 2240, y: 320, width: 100, height: 60, type: 'uno' };

    } else if (phase === 3) {
        document.getElementById("phaseTitle").innerText = "FASE 3: INVESTIMENTO NA FACULDADE";
        document.getElementById("gameAlert").innerText = "Colete conhecimento e ignore as distrações!";
        platforms = [
            { x: 0, y: 380, width: 2400, height: 40 },
            { x: 200, y: 290, width: 200, height: 16 },
            { x: 550, y: 220, width: 250, height: 16 }
        ];
        items = [
            { x: 250, y: 250, type: 'Livro', collected: false },
            { x: 650, y: 180, type: 'Dinheiro', collected: false },
            { x: 1000, y: 250, type: 'Livro', collected: false },
            { x: 1450, y: 160, type: 'Dinheiro', collected: false },
            { x: 1900, y: 240, type: 'Diploma', collected: false }
        ];
        enemies = [
            { x: 450, y: 335, width: 35, height: 45, type: 'festa', speed: -2, minX: 300, maxX: 600 },
            { x: 850, y: 335, width: 30, height: 45, type: 'bebida', speed: 2, minX: 700, maxX: 1000 }
        ];
        targetGoal = { x: 2260, y: 280, width: 80, height: 100, type: 'formatura' };

    } else if (phase === 4) {
        document.getElementById("phaseTitle").innerText = "FASE 4: ENGENHEIRO DE SUCESSO";
        document.getElementById("gameAlert").innerText = "Entregue a planta ao cliente final!";
        platforms = [
            { x: 0, y: 380, width: 2400, height: 40 },
            { x: 300, y: 270, width: 300, height: 16 },
            { x: 800, y: 200, width: 250, height: 16 }
        ];
        items = [
            { x: 450, y: 230, type: 'Notebook', collected: false },
            { x: 900, y: 160, type: 'Filho', collected: false },
            { x: 1400, y: 240, type: 'Planta', collected: false }
        ];
        enemies = [
            { x: 1000, y: 340, width: 45, height: 40, type: 'cachorro', speed: -2, minX: 800, maxX: 1200 },
            { x: 1500, y: 70, width: 50, height: 35, type: 'nuvem', speed: 3, minX: 1300, maxX: 1700 }
        ];
        targetGoal = { x: 2280, y: 300, width: 45, height: 80, type: 'cliente' };
    }

    updateHUDInventory(items);
}

window.addEventListener('keydown', e => { if (e.key in keys) keys[e.key] = true; });
window.addEventListener('keyup', e => { if (e.key in keys) keys[e.key] = false; });

function updateLogic() {
    if (!gameActive) return;
    globalTimer++;

    player.isWalking = false;
    if (keys.ArrowRight) { player.vx = player.speed; player.facing = 'right'; player.isWalking = true; }
    else if (keys.ArrowLeft) { player.vx = -player.speed; player.facing = 'left'; player.isWalking = true; }
    else { player.vx = 0; }

    if (keys.ArrowUp && player.grounded) { player.vy = -player.jumpForce; player.grounded = false; }

    player.vy += GRAVITY;
    player.x += player.vx; player.y += player.vy;

    if (player.x < 0) player.x = 0;
    if (player.x > WORLD_WIDTH - player.width) player.x = WORLD_WIDTH - player.width;

    cameraX = player.x - canvas.width / 2;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > WORLD_WIDTH - canvas.width) cameraX = WORLD_WIDTH - canvas.width;

    player.grounded = false;
    platforms.forEach(p => {
        if (player.x < p.x + p.width && player.x + player.width > p.x &&
            player.y + player.height > p.y && player.y + player.height - player.vy <= p.y + 12) {
            player.y = p.y - player.height; player.vy = 0; player.grounded = true;
        }
    });

    items.forEach(item => {
        if (!item.collected && player.x < item.x + 30 && player.x + player.width > item.x &&
            player.y < item.y + 30 && player.y + player.height > item.y) {
            item.collected = true; score += 100;
            document.getElementById("gameAlert").innerText = `Coletado: ${item.type}!`;
            if (currentPhase === 1) player.epis[item.type.toLowerCase()] = true;
            updateHUDInventory(items);
        }
    });

    enemies.forEach(en => {
        en.x += en.speed;
        if (en.x < en.minX || en.x > en.maxX) en.speed *= -1;
        if (player.x < en.x + en.width && player.x + player.width > en.x &&
            player.y < en.y + en.height && player.y + player.height > en.y) {
            score = Math.max(0, score - 50);
            document.getElementById("gameAlert").innerText = "💥 Cuidado com os obstáculos! Volte ao início da seção.";
            player.x = Math.max(100, player.x - 300); player.y = 200;
        }
    });

    let isAllDone = items.every(i => i.collected);
    if (isAllDone && player.x < targetGoal.x + targetGoal.width && player.x + player.width > targetGoal.x &&
        player.y < targetGoal.y + targetGoal.height && player.y + player.height > targetGoal.y) {
        if (!phaseCleared) {
            phaseCleared = true; gameActive = false;
            advanceNextPhase();
        }
    }
    document.getElementById("scoreVal").innerText = score;
}

function advanceNextPhase() {
    score += 500;
    let nex = currentPhase + 1;
    if (nex <= 4) {
        document.getElementById("gameAlert").innerText = "🚀 EXCELENTE TRABALHO! Transicionando de fase...";
        setTimeout(() => { gameActive = true; initPhase(nex); }, 2000);
    } else {
        document.getElementById("gameAlert").innerText = "🏆 SAGA CONCLUÍDA! VOCÊ SE TORNOU O ENGENHEIRO CHEFE!";
    }
}

// RENDERIZADOR COM ESTÉTICA DA SIMULAÇÃO (Efeitos de Luz e Imagens Avançadas)
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-cameraX, 0);

    // 1. Renderizar a Imagem de Fundo de Alta Definição correspondente à fase
    let activeBg = bgImages[`fase${currentPhase}`];
    if (activeBg.complete) {
        // Cria um efeito de repetição/paralaxe suave repetindo a imagem ao longo do mundo de 2400px
        for (let bx = 0; bx < WORLD_WIDTH; bx += canvas.width) {
            ctx.drawImage(activeBg, bx, 0, canvas.width, canvas.height);
        }
        // Aplica um filtro escuro futurista por cima da imagem para dar o tom da simulação
        ctx.fillStyle = "rgba(10, 18, 32, 0.75)";
        ctx.fillRect(0, 0, WORLD_WIDTH, canvas.height);
    }

    // 2. Plataformas com Degradê Neon
    platforms.forEach(p => {
        let grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
        grad.addColorStop(0, '#1f3a52');
        grad.addColorStop(1, '#0d1b2a');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, p.y, p.width, p.height);
        
        // Linha de Luz Neon na superfície da plataforma
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.width, p.y); ctx.stroke();
    });

    // 3. Renderização Avançada dos Itens do Cenário (Flutuantes e Iluminados)
    items.forEach(item => {
        if (!item.collected) {
            let pulse = Math.sin(globalTimer * 0.1) * 5;
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#00ffcc";
            
            // Desenha um círculo de energia ao redor do item
            ctx.fillStyle = "rgba(0, 255, 204, 0.2)";
            ctx.beginPath();
            ctx.arc(item.x + 15, item.y + 15 + pulse, 20, 0, Math.PI * 2);
            ctx.fill();

            // Renderiza o próprio ícone dentro do canvas real do jogo
            let imgIcon = new Image();
            imgIcon.src = itemIconsUrls[item.type];
            if(imgIcon.complete) {
                ctx.drawImage(imgIcon, item.x, item.y + pulse, 30, 30);
            } else {
                ctx.fillStyle = "#00ffcc";
                ctx.fillRect(item.x, item.y + pulse, 25, 25);
            }
            ctx.restore();
        }
    });

    // 4. Inimigos Atualizados
    enemies.forEach(en => {
        if (en.type === 'cachorro') {
            ctx.fillStyle = "#ff5533"; // Cachorros representados como ameaças avermelhadas
            ctx.shadowBlur = 10; ctx.shadowColor = "#ff3300";
            ctx.fillRect(en.x, en.y, en.width, en.height);
            ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif";
            ctx.fillText("🐕 Fera", en.x, en.y - 5);
        } else if (en.type === 'nuvem') {
            ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
            ctx.beginPath(); ctx.arc(en.x+20, en.y+15, 18, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#00ffff"; ctx.font = "12px sans-serif";
            ctx.fillText("⚡ Faísca", en.x, en.y - 5);
        } else {
            ctx.fillStyle = "#ff0055";
            ctx.fillRect(en.x, en.y, en.width, en.height);
            ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif";
            ctx.fillText("⚠️ Distração", en.x, en.y - 5);
        }
        ctx.shadowBlur = 0; // limpa sombra
    });

    // 5. Alvos Finais Dinâmicos (Poste de Luz Elétrica / Uno de Firma / Painel)
    let ready = items.every(i => i.collected);
    ctx.save();
    if (ready) { ctx.shadowBlur = 20; ctx.shadowColor = "#00ffcc"; }
    
    if (currentPhase === 1) {
        ctx.fillStyle = "#334455"; ctx.fillRect(targetGoal.x, targetGoal.y, targetGoal.width, targetGoal.height);
        ctx.fillStyle = ready ? "#00ffcc" : "#ff3355";
        ctx.fillRect(targetGoal.x - 5, targetGoal.y + 20, 50, 30); // Transformador de Energia
    } else if (currentPhase === 2) {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(targetGoal.x, targetGoal.y + 15, targetGoal.width, 45); // Corpo do Uno
        ctx.fillStyle = "#333"; ctx.fillRect(targetGoal.x + 10, targetGoal.y, 60, 15); // Escada em cima
    } else {
        ctx.fillStyle = "#00ffcc"; ctx.fillRect(targetGoal.x, targetGoal.y, targetGoal.width, targetGoal.height);
    }
    ctx.restore();

    ctx.restore();

    // 6. O Protagonista: Zé Faísca
    let pX = player.x - cameraX;
    let pY = player.y;
    let cenX = pX + player.width / 2;

    ctx.save();
    const animationFrame = player.isWalking
        ? 1 + Math.floor(globalTimer / 9) % 2
        : 0;
    const zeFaiscaFrame = zeFaiscaFrames[animationFrame];

    if (zeFaiscaFrame) {
        const spriteWidth = 58;
        const spriteHeight = 88;

        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(0, 153, 255, 0.5)";
        ctx.translate(cenX, 0);
        if (player.facing === 'left') ctx.scale(-1, 1);

        // Mantem os pes alinhados com a hitbox usada pela fisica.
        ctx.drawImage(zeFaiscaFrame, -spriteWidth / 2, pY + player.height - spriteHeight, spriteWidth, spriteHeight);
    } else {
        // Fallback caso a imagem local ainda nao tenha carregado.
        ctx.fillStyle = currentPhase === 4 ? "#1c2833" : "#0055ff";
        ctx.fillRect(pX, pY + 16, player.width, player.height - 16);
        ctx.fillStyle = "#ffdbac";
        ctx.beginPath(); ctx.arc(cenX, pY + 8, 9, 0, Math.PI * 2); ctx.fill();
    }
    
    ctx.restore();
    
    // Tela Final de Vitória Absoluta
    if (!gameActive && currentPhase === 4 && ready) {
        ctx.fillStyle = "rgba(5, 12, 22, 0.95)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#00ffcc"; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("A JORNADA DE ZÉ FAÍSCA CONCLUÍDA!", canvas.width / 2, 180);
        ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif";
        ctx.fillText(`De Eletricista de campo a Engenheiro Senior de Sucesso! Pontuação final: ${score}`, canvas.width / 2, 230);
    }
}

function mainLoop() {
    updateLogic();
    draw();
    requestAnimationFrame(mainLoop);
}

// Inicializa a primeira fase do jogo
initPhase(1);
mainLoop();
