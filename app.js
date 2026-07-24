const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

let configDecks = 3;      
let feedRate = 90;        
let rpm = 980;            
let amplitude = 6.0;      
let angleDeg = 15;        
let matMesh1 = 'hardox';
let matMesh2 = 'acero_inoxidable';

let demGruesa = 3500;
let demMedia = 4200;
let demArena = 8500;

let particles = [];
let time = 0;
let simulationHistory = [];

function setDecks(decks) {
    configDecks = decks;
    document.getElementById('btn-2decks').classList.toggle('active', decks === 2);
    document.getElementById('btn-3decks').classList.toggle('active', decks === 3);
    updateMeshSpecs();
}

function changeFeedRate(val) {
    feedRate = parseInt(val);
    document.getElementById('lbl-feed').innerText = feedRate + " tn/h";
    adjustParticleCount();
    updateCalculations();
}

function changeFrequency(val) {
    rpm = parseInt(val);
    document.getElementById('lbl-freq').innerText = rpm + " RPM";
    updateCalculations();
}

function changeAmplitude(val) {
    amplitude = parseFloat(val);
    document.getElementById('lbl-amp').innerText = amplitude.toFixed(1) + " mm";
    updateCalculations();
}

function changeAngle(val) {
    angleDeg = parseInt(val);
    document.getElementById('lbl-angle').innerText = angleDeg + "°";
    updateCalculations();
}

function updateDemand() {
    demGruesa = parseInt(document.getElementById('dem-gruesa').value);
    demMedia = parseInt(document.getElementById('dem-media').value);
    demArena = parseInt(document.getElementById('dem-arena').value);

    document.getElementById('lbl-dem-g').innerText = demGruesa + " tn";
    document.getElementById('lbl-dem-m').innerText = demMedia + " tn";
    document.getElementById('lbl-dem-a').innerText = demArena + " tn";

    document.getElementById('d-val-g').innerText = demGruesa;
    document.getElementById('d-val-m').innerText = demMedia;
    document.getElementById('d-val-a').innerText = demArena;

    updateCalculations();
}

function updateMeshSpecs() {
    matMesh1 = document.getElementById('material-mesh-1').value;
    matMesh2 = document.getElementById('material-mesh-2').value;
    
    let tableHTML = `<tr><th>Piso</th><th>Abertura</th><th>Diámetro Hilo</th><th>Vida Útil</th><th>Costo / m²</th></tr>`;
    
    let cost1 = 240, cost2 = 180, cost3 = 310;
    if(matMesh1 === 'poliuretano') cost1 = 420;
    if(matMesh2 === 'poliuretano') cost3 = 550;
    if(matMesh2 === 'acero_alto_carbono') { cost2 = 120; cost3 = 190; }

    tableHTML += `<tr><td>Piso 1 (${matMesh1.toUpperCase()})</td><td>38.0 mm</td><td>8.0 mm</td><td>1,400 hrs</td><td>$${cost1} USD</td></tr>`;
    tableHTML += `<tr><td>Piso 2 (Medio)</td><td>19.0 mm</td><td>4.5 mm</td><td>900 hrs</td><td>$${cost2} USD</td></tr>`;
    if(configDecks === 3) {
        tableHTML += `<tr><td>Piso 3 (${matMesh2.toUpperCase()})</td><td>2.0 mm</td><td>1.2 mm</td><td>650 hrs</td><td>$${cost3} USD</td></tr>`;
    }
    document.getElementById('mesh-specs-table').innerHTML = tableHTML;
    
    let totalMeshCost = cost1 + cost2 + (configDecks === 3 ? cost3 : 0);
    document.getElementById('cb-cost').innerText = `$${totalMeshCost * 3} USD`;
}

function updateCalculations() {
    let basePower = configDecks === 3 ? 22.0 : 15.0; 
    let loadFactor = 0.35 + (feedRate / 150) * 0.65;
    let dynamicPower = (basePower * (rpm / 1000) * loadFactor).toFixed(1);
    document.getElementById('tel-power').innerText = dynamicPower;

    let computedSpeed = (0.2 + (angleDeg * 0.015) * (rpm / 1000) * (1 - (feedRate / 300))).toFixed(2);
    document.getElementById('tel-speed').innerText = computedSpeed + " m/s";

    let efficiencyVal = 100 - Math.abs(feedRate - 90) * 0.1 - Math.abs(angleDeg - 15) * 0.2;
    if (efficiencyVal < 65) efficiencyVal = 65;
    document.getElementById('tel-efficiency').innerText = efficiencyVal.toFixed(1) + "%";

    let finesAlert = document.getElementById('fines-alert');
    if (angleDeg > 19 || rpm > 1120) {
        finesAlert.style.display = "block";
    } else {
        finesAlert.style.display = "none";
    }

    let prodG = Math.round(demGruesa * (feedRate / 90) * (efficiencyVal / 100));
    let prodM = Math.round(demMedia * (feedRate / 90) * (efficiencyVal / 100));
    let prodA = Math.round(demArena * (feedRate / 90) * (efficiencyVal / 100));

    document.getElementById('p-val-g').innerText = prodG;
    document.getElementById('p-val-m').innerText = prodM;
    document.getElementById('p-val-a').innerText = prodA;

    let globalPerf = ((prodG + prodM + prodA) / (demGruesa + demMedia + demArena) * 100).toFixed(1);
    document.getElementById('tel-global').innerText = globalPerf + "%";
}

class Granule {
    constructor() { this.reset(); }
    reset() {
        this.x = 60 + Math.random() * 40;
        this.y = 80 + Math.random() * 30;
        this.size = Math.random() * 8 + 1.2; 
        this.vx = (Math.random() * 0.8 + 1.2) * (angleDeg / 15);
        this.vy = 0;
        this.deckLevel = 0; 
        this.color = this.getColor();
    }
    getColor() {
        if (this.size > 6.5) return '#ff5722'; 
        if (this.size > 4.5) return '#ffeb3b'; 
        if (this.size > 2.5) return '#00e676'; 
        return '#00b0ff';                     
    }
    update(shakeX, shakeY) {
        if (feedRate === 0) return; 
        let angleRad = angleDeg * Math.PI / 180;
        let massDragFactor = 1.0 - (feedRate / 250); 
        let speedMult = (rpm / 1000) * (amplitude / 5) * 0.6 * massDragFactor;
        
        this.x += this.vx * speedMult;
        let baselineY = 130 + (this.x - 80) * Math.sin(angleRad) * 0.8;
        let deckSpacing = 55;

        if (this.deckLevel === 0 && this.x > 140) {
            if (this.size > 5.5 && configDecks === 3) { this.deckLevel = 1; } 
            else { this.deckLevel = 2; }
        } else if (this.deckLevel === 1 && this.x > 450) { this.deckLevel = 4; } 
        else if (this.deckLevel === 2 && this.x > 550) { this.deckLevel = 4; }

        let targetY = baselineY + (this.deckLevel * deckSpacing);
        this.y += (targetY - this.y) * 0.1 + (shakeY * 0.2);

        if (this.x > 880 || this.y > 400) { this.reset(); }
    }
}

function adjustParticleCount() {
    let targetCount = Math.floor((feedRate / 150) * 140);
    while (particles.length < targetCount) {
        let p = new Granule();
        p.x = 60 + Math.random() * 750;
        particles.push(p);
    }
    while (particles.length > targetCount) { particles.pop(); }
}

function initParticles() {
    particles = [];
    adjustParticleCount();
}

function registerHistoryEntry() {
    let now = new Date();
    let timeStr = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0') + ":" + now.getSeconds().toString().padStart(2,'0');
    let eff = document.getElementById('tel-efficiency').innerText;
    
    simulationHistory.unshift({ time: timeStr, feed: feedRate, rpm: rpm, angle: angleDeg, eff: eff });
    if(simulationHistory.length > 5) simulationHistory.pop();

    let historyHTML = `<tr><th>Hora</th><th>Feed (tn/h)</th><th>RPM</th><th>Incli.</th><th>Eficiencia</th></tr>`;
    simulationHistory.forEach(h => {
        historyHTML += `<tr><td>${h.time}</td><td>${h.feed}</td><td>${h.rpm}</td><td>${h.angle}°</td><td>${h.eff}</td></tr>`;
    });
    document.getElementById('history-table').innerHTML = historyHTML;
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFillColor(11, 13, 20);
    doc.rect(0, 0, 210, 297, "F");
    
    doc.setTextColor(0, 173, 181);
    doc.setFontSize(18);
    doc.text("GRAVAFILT 3.0 - REPORTE DE INGENIERIA DE ZARANDA", 14, 20);
    
    doc.setTextColor(241, 245, 249);
    doc.setFontSize(11);
    doc.text(`Fecha y Hora: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Configuracion de Pisos: ${configDecks} Pisos`, 14, 38);
    doc.text(`Alimentacion Bruta: ${feedRate} tn/h`, 14, 46);
    doc.text(`Frecuencia de Vibracion: ${rpm} RPM`, 14, 54);
    doc.text(`Amplitud de Trazo: ${amplitude} mm`, 14, 62);
    doc.text(`Angulo de Inclinacion: ${angleDeg}°`, 14, 70);
    
    doc.setTextColor(0, 173, 181);
    doc.text("BALANCE DE DEMANDA Y PRODUCTIVIDAD", 14, 86);
    doc.setTextColor(241, 245, 249);
    doc.text(`Demanda Grava Gruesa: ${demGruesa} tn | Producido: ${document.getElementById('p-val-g').innerText} tn`, 14, 96);
    doc.text(`Demanda Grava Media: ${demMedia} tn | Producido: ${document.getElementById('p-val-m').innerText} tn`, 14, 104);
    doc.text(`Demanda Arena Tratada: ${demArena} tn | Producido: ${document.getElementById('p-val-a').innerText} tn`, 14, 112);

    doc.setTextColor(0, 173, 181);
    doc.text("METRICAS DE TELEMETRIA Y EFICIENCIA", 14, 128);
    doc.setTextColor(241, 245, 249);
    doc.text(`Potencia Consumida: ${document.getElementById('tel-power').innerText} kW`, 14, 138);
    doc.text(`Velocidad de Avance: ${document.getElementById('tel-speed').innerText} m/s`, 14, 146);
    doc.text(`Eficiencia de Separacion: ${document.getElementById('tel-efficiency').innerText}`, 14, 154);

    doc.save("Reporte_Gravafilt_Zaranda.pdf");
}

function animate() {
    time += 0.15;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let freqRad = rpm * 0.05;
    let currentAmpFactor = amplitude * 1.5;
    let shakeX = Math.cos(time * freqRad) * currentAmpFactor;
    let shakeY = Math.sin(time * freqRad) * currentAmpFactor;

    let angleRad = angleDeg * Math.PI / 180;

    ctx.save();
    ctx.translate(shakeX * 0.3, shakeY * 0.3);

    let startX = 80;
    let endX = 840;
    let deckLength = endX - startX;
    let rise = deckLength * Math.sin(angleRad) * 0.8;

    ctx.strokeStyle = '#3b4267';
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 90, 800, configDecks === 3 ? 210 : 150);

    let decksCount = configDecks;
    for (let i = 0; i < decksCount; i++) {
        let yOffset = 130 + (i * 55);
        
        ctx.beginPath();
        ctx.strokeStyle = (i === 0) ? '#ff5722' : (i === 1) ? '#ffeb3b' : '#00e676';
        ctx.lineWidth = 3;
        ctx.moveTo(startX, yOffset);
        ctx.lineTo(endX, yOffset + rise);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Segoe UI';
        ctx.fillText(`Piso ${i+1} (${i===0?matMesh1.toUpperCase():i===1?'Acero Alto Carbono':matMesh2.toUpperCase()})`, startX + 10, yOffset - 8);
    }

    ctx.restore();

    particles.forEach(p => {
        p.update(shakeX, shakeY);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    });

    requestAnimationFrame(animate);
}

initParticles();
updateMeshSpecs();
animate();
