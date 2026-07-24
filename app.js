const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

let configDecks = 3;      
let feedRate = 90;        
let rpm = 980;            
let amplitude = 6.0;      
let counterweight = 80;   
let angleDeg = 15;        

// Matriz Normada de Comercialización por Granulometría
const productMatrix = [
    { id: 'f_finos', name: '200-300 Mesh (Micronizados)', deck: '1-2', minRpm: 1500, maxRpm: 3000, minCw: 30, maxCw: 45, minAmp: 1.2, maxAmp: 2.0, minAng: 0, maxAng: 5, desc: 'Alta frecuencia y baja amplitud. Ultrasónico recomendado.', demand: 1500 },
    { id: 'f_arenados', name: '14-200 Arenados', deck: '3', minRpm: 1200, maxRpm: 1500, minCw: 50, maxCw: 60, minAmp: 2.5, maxAmp: 3.5, minAng: 12, maxAng: 18, desc: 'Ajuste dictado por el piso fino #200.', demand: 3000 },
    { id: 'f_06', name: '0.6 mm', deck: '2', minRpm: 1200, maxRpm: 1500, minCw: 50, maxCw: 60, minAmp: 2.5, maxAmp: 3.2, minAng: 10, maxAng: 15, desc: 'Lecho delgado (<15mm). Previene condensación y cegado.', demand: 2000 },
    { id: 'f_08', name: '0.8 mm', deck: '2', minRpm: 1200, maxRpm: 1500, minCw: 55, maxCw: 65, minAmp: 3.0, maxAmp: 3.8, minAng: 10, maxAng: 15, desc: 'Amplitud media para descalzar granos de 0.75mm.', demand: 2500 },
    { id: 'f_09', name: '0.9 mm', deck: '2', minRpm: 1200, maxRpm: 1500, minCw: 60, maxCw: 70, minAmp: 3.2, maxAmp: 4.0, minAng: 10, maxAng: 15, desc: 'Ideal mallas Ripple Wave para abrir área útil.', demand: 2200 },
    { id: 'f_1_2', name: '1 - 2 mm', deck: '2', minRpm: 1000, maxRpm: 1200, minCw: 70, maxCw: 80, minAmp: 4.0, maxAmp: 5.5, minAng: 12, maxAng: 18, desc: 'Energía media-alta para evitar saturar piso de 1mm.', demand: 4000 },
    { id: 'f_1_3', name: '1 - 3 mm', deck: '2', minRpm: 1000, maxRpm: 1200, minCw: 75, maxCw: 85, minAmp: 4.5, maxAmp: 6.0, minAng: 12, maxAng: 18, desc: 'Sustenta caudales de 40-60 t/h/m2.', demand: 4500 },
    { id: 'f_2_3', name: '2 - 3 mm', deck: '2', minRpm: 900, maxRpm: 1200, minCw: 80, maxCw: 90, minAmp: 5.0, maxAmp: 6.5, minAng: 15, maxAng: 20, desc: 'Impacto fuerte para desalojar granos angulares.', demand: 3800 },
    { id: 'f_2_4', name: '2 - 4 mm', deck: '2', minRpm: 900, maxRpm: 1000, minCw: 85, maxCw: 95, minAmp: 6.0, maxAmp: 7.5, minAng: 15, maxAng: 20, desc: 'Alta amplitud para el corte superior de 4mm.', demand: 3200 },
    { id: 'f_3_6', name: '3 - 6 mm (Gravas)', deck: '2', minRpm: 800, maxRpm: 1000, minCw: 90, maxCw: 100, minAmp: 7.0, maxAmp: 9.0, minAng: 15, maxAng: 22, desc: 'Máxima masa excéntrica para mover capas gruesas (>40mm).', demand: 2800 }
];

let particles = [];
let time = 0;
let simulationHistory = [];

function initDemandControls() {
    let container = document.getElementById('demand-controls-container');
    if(!container) return;
    let html = '';
    productMatrix.forEach(p => {
        html += `
        <div class="control-group" style="background: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <label for="slider_${p.id}" style="font-size:11px; margin-bottom:4px; display:block;">${p.name}</label>
            <div style="display: flex; gap: 8px; align-items: center;">
                <input type="range" id="slider_${p.id}" min="0" max="10000" value="${p.demand}" step="10" style="flex:1;" oninput="syncDemand('${p.id}', this.value, 'slider')">
                <input type="number" id="num_${p.id}" min="0" max="50000" value="${p.demand}" step="10" style="width: 90px; padding: 4px 6px; background: #1e222d; border: 1px solid #3b4267; color: #fff; border-radius: 4px; text-align: right; font-size: 12px;" oninput="syncDemand('${p.id}', this.value, 'num')">
                <span style="font-size: 11px; color: var(--text-muted); min-width: 18px;">tn</span>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function syncDemand(id, val, source) {
    let numericVal = parseInt(val);
    if (isNaN(numericVal)) numericVal = 0;
    
    let item = productMatrix.find(x => x.id === id);
    if(item) {
        item.demand = numericVal;
        if(source === 'slider') {
            let numInput = document.getElementById(`num_${id}`);
            if(numInput) numInput.value = numericVal;
        } else {
            let sliderInput = document.getElementById(`slider_${id}`);
            if(sliderInput) sliderInput.value = numericVal;
        }
    }
    updateCalculations();
}

function setDecks(decks) {
    configDecks = decks;
    document.getElementById('btn-2decks').classList.toggle('active', decks === 2);
    document.getElementById('btn-3decks').classList.toggle('active', decks === 3);
    updateCalculations();
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

function changeCounterweight(val) {
    counterweight = parseInt(val);
    document.getElementById('lbl-cw').innerText = counterweight + "%";
    updateCalculations();
}

function changeAngle(val) {
    angleDeg = parseInt(val);
    document.getElementById('lbl-angle').innerText = angleDeg + "°";
    updateCalculations();
}

function updateCalculations() {
    let basePower = configDecks === 3 ? 24.0 : 16.0; 
    let loadFactor = 0.4 + (feedRate / 150) * 0.6;
    let dynamicPower = (basePower * (rpm / 1000) * (counterweight / 80) * loadFactor).toFixed(1);
    document.getElementById('tel-power').innerText = dynamicPower;

    let computedSpeed = (0.2 + (angleDeg * 0.015) * (rpm / 1000) * (counterweight / 100)).toFixed(2);
    document.getElementById('tel-speed').innerText = computedSpeed + " m/s";

    let efficiencyVal = 95.0 - Math.abs(feedRate - 90) * 0.08;
    if (efficiencyVal < 70) efficiencyVal = 70;
    document.getElementById('tel-efficiency').innerText = efficiencyVal.toFixed(1) + "%";

    let alertBox = document.getElementById('fines-alert');
    if (rpm > 2200 && counterweight > 60) {
        alertBox.style.display = "block";
        alertBox.innerHTML = "⚠️ <strong>Alerta Dinámica:</strong> Exceso de contrapeso para alta frecuencia. Las partículas finas pueden 'volar' sin tocar las mallas de 200-300 Mesh.";
    } else {
        alertBox.style.display = "none";
    }

    let balanceHtml = `<tr><th>Granulometría</th><th>Pisos</th><th>RPM / CW</th><th>Demanda (tn)</th><th>Producción (tn)</th><th>Criterio Técnico / Ajuste</th></tr>`;
    let totalDemand = 0, totalProd = 0;

    productMatrix.forEach(p => {
        let prod = Math.round(p.demand * (feedRate / 90) * (efficiencyVal / 100));
        totalDemand += p.demand;
        totalProd += prod;
        balanceHtml += `<tr>
            <td><strong>${p.name}</strong></td>
            <td>Piso ${p.deck}</td>
            <td>${p.minRpm}-${p.maxRpm} RPM / ${p.minCw}-${p.maxCw}%</td>
            <td>${p.demand}</td>
            <td>${prod}</td>
            <td style="font-size:10px; color:var(--text-muted);">${p.desc}</td>
        </tr>`;
    });
    
    let tableElem = document.getElementById('demand-balance-table');
    if(tableElem) tableElem.innerHTML = balanceHtml;

    let globalPerf = ((totalProd / (totalDemand || 1)) * 100).toFixed(1);
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
        let speedMult = (rpm / 1000) * (amplitude / 5) * (counterweight / 80) * 0.5;
        
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
    
    simulationHistory.unshift({ time: timeStr, feed: feedRate, rpm: rpm, cw: counterweight, eff: eff });
    if(simulationHistory.length > 5) simulationHistory.pop();

    let historyHTML = `<tr><th>Hora</th><th>Feed (tn/h)</th><th>RPM</th><th>Contrapeso</th><th>Eficiencia</th></tr>`;
    simulationHistory.forEach(h => {
        historyHTML += `<tr><td>${h.time}</td><td>${h.feed}</td><td>${h.rpm}</td><td>${h.cw}%</td><td>${h.eff}</td></tr>`;
    });
    let histElem = document.getElementById('history-table');
    if(histElem) histElem.innerHTML = historyHTML;
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFillColor(11, 13, 20);
    doc.rect(0, 0, 210, 297, "F");
    
    doc.setTextColor(0, 173, 181);
    doc.setFontSize(16);
    doc.text("GRAVAFILT 3.0 - REPORTE GRANULOMETRICO Y CINEMATICO", 14, 20);
    
    doc.setTextColor(241, 245, 249);
    doc.setFontSize(10);
    doc.text(`Fecha y Hora: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Alimentacion: ${feedRate} tn/h | Frecuencia: ${rpm} RPM | Contrapeso: ${counterweight}%`, 14, 36);
    doc.text(`Amplitud: ${amplitude} mm | Inclinacion: ${angleDeg}°`, 14, 44);
    
    doc.setTextColor(0, 173, 181);
    doc.text("RESUMEN DE DEMANDA COMERCIAL Y AJUSTES DE ZARANDA", 14, 56);
    doc.setTextColor(241, 245, 249);
    
    let yPos = 64;
    productMatrix.forEach(p => {
        if(yPos > 270) { doc.addPage(); yPos = 20; }
        doc.text(`- ${p.name} (Demanda: ${p.demand} tn) | Ajuste: ${p.desc}`, 14, yPos);
        yPos += 7;
    });

    doc.save("Reporte_Granulometrico_Gravafilt.pdf");
}

function animate() {
    time += 0.15;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let freqRad = rpm * 0.05;
    let currentAmpFactor = amplitude * (counterweight / 80) * 1.5;
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

    for (let i = 0; i < configDecks; i++) {
        let yOffset = 130 + (i * 55);
        ctx.beginPath();
        ctx.strokeStyle = (i === 0) ? '#ff5722' : (i === 1) ? '#ffeb3b' : '#00e676';
        ctx.lineWidth = 3;
        ctx.moveTo(startX, yOffset);
        ctx.lineTo(endX, yOffset + rise);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Segoe UI';
        ctx.fillText(`Piso ${i+1}`, startX + 10, yOffset - 8);
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

window.addEventListener('DOMContentLoaded', () => {
    initDemandControls();
    initParticles();
    updateCalculations();
    animate();
});
