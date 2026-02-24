// ========================================
// QR GENERATOR PRO - MOBILE WEBSITE
// iOS File Upload Fixed + Database Search
// ========================================

// ========== GLOBAL STATE ==========
const AppState = {
    databases: {},
    activeDbId: null,
    history: [],
    scanHistory: [],
    theme: 'light',
    bulkQRCodes: [],
    currentQR: null,
    currentScan: null,
    selectedLabelTemplate: 'avery-5160',
    scanner: {
        stream: null,
        scanning: false,
        animationId: null
    }
};

// ========== CONSTANTS ==========
const LABEL_TEMPLATES = {
    'avery-5160': { name: 'Avery 5160', cols: 3, rows: 10, labelWidth: 66.68, labelHeight: 25.4, marginTop: 12.7, marginLeft: 6.35, gapX: 3.18, gapY: 0, total: 30 },
    'avery-5163': { name: 'Avery 5163', cols: 2, rows: 5, labelWidth: 101.6, labelHeight: 50.8, marginTop: 12.7, marginLeft: 6.35, gapX: 3.18, gapY: 0, total: 10 },
    'avery-5167': { name: 'Avery 5167', cols: 4, rows: 20, labelWidth: 50.8, labelHeight: 12.7, marginTop: 12.7, marginLeft: 6.35, gapX: 3.18, gapY: 0, total: 80 }
};

const QR_TEMPLATES = {
    'zone-blue': {
        name: 'Zone Label - Blue',
        canvasWidth: 350,
        canvasHeight: 400,
        bgColor: '#ffffff',
        borderRadius: 12,
        borderColor: '#2563eb',
        borderWidth: 3,
        qrSize: 250,
        qrX: 50,
        qrY: 50,
        qrFgColor: '#1e40af',
        textFields: [{ content: '{data}', x: 50, y: 12, fontSize: 28, fontWeight: 'bold', color: '#1e40af' }],
        symbols: [{ content: '↓', x: 50, y: 88, size: 40, color: '#2563eb' }]
    },
    'zone-gradient': {
        name: 'Zone Label - Gradient',
        canvasWidth: 400,
        canvasHeight: 400,
        gradient: { type: 'linear', angle: 135, colors: ['#667eea', '#764ba2'] },
        borderRadius: 20,
        qrSize: 250,
        qrX: 50,
        qrY: 55,
        qrFgColor: '#ffffff',
        qrBgColor: 'transparent',
        textFields: [{ content: '{data}', x: 50, y: 12, fontSize: 32, fontWeight: 'bold', color: '#ffffff', shadow: true }]
    },
    'simple-border': {
        name: 'Simple Border',
        canvasWidth: 320,
        canvasHeight: 360,
        bgColor: '#ffffff',
        borderRadius: 8,
        borderColor: '#000000',
        borderWidth: 2,
        qrSize: 250,
        qrX: 50,
        qrY: 45,
        textFields: [{ content: '{data}', x: 50, y: 90, fontSize: 14, color: '#000000' }]
    }
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('QR Generator Pro initializing...');
    loadState();
    setupEventListeners();
    updateUI();
    console.log('QR Generator Pro ready!');
});

// ========== STATE MANAGEMENT ==========
function loadState() {
    try {
        const saved = localStorage.getItem('qrGeneratorState');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(AppState, parsed);
        }
        applyTheme(AppState.theme);
    } catch (e) {
        console.error('Error loading state:', e);
    }
}

function saveState() {
    try {
        const toSave = {
            databases: AppState.databases,
            activeDbId: AppState.activeDbId,
            history: AppState.history,
            scanHistory: AppState.scanHistory,
            theme: AppState.theme,
            selectedLabelTemplate: AppState.selectedLabelTemplate
        };
        localStorage.setItem('qrGeneratorState', JSON.stringify(toSave));
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    
    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Generate tab
    document.getElementById('qr-input')?.addEventListener('input', updateCharCount);
    document.getElementById('generate-btn')?.addEventListener('click', generateQR);
    
    // QR result actions
    document.getElementById('download-png')?.addEventListener('click', downloadQR);
    document.getElementById('copy-qr')?.addEventListener('click', copyQR);
    document.getElementById('print-qr')?.addEventListener('click', printQR);
    document.getElementById('clear-history')?.addEventListener('click', clearHistory);
    
    // Batch tab
    document.getElementById('preview-batch')?.addEventListener('click', previewBatch);
    document.getElementById('generate-batch')?.addEventListener('click', generateBatch);
    document.getElementById('download-all-zip')?.addEventListener('click', downloadAllBatch);
    document.getElementById('download-pdf')?.addEventListener('click', downloadBatchPDF);
    document.getElementById('print-labels')?.addEventListener('click', printLabels);
    
    // Label template selection
    document.querySelectorAll('.label-btn').forEach(btn => {
        btn.addEventListener('click', () => selectLabelTemplate(btn.dataset.template));
    });
    
    // Scan tab
    document.getElementById('camera-select')?.addEventListener('change', switchCamera);
    document.getElementById('scan-upload')?.addEventListener('change', scanFromImage);
    document.getElementById('copy-scan')?.addEventListener('click', copyScanResult);
    document.getElementById('open-url')?.addEventListener('click', openScannedUrl);
    document.getElementById('generate-from-scan')?.addEventListener('click', generateFromScan);
    
    // Database tab - iOS FIXED
    setupDatabaseUpload();
    document.getElementById('db-search')?.addEventListener('input', handleDatabaseSearch);
    document.getElementById('scan-db-qr')?.addEventListener('click', scanDatabaseQR);
    document.getElementById('load-db-url')?.addEventListener('click', loadDatabaseFromUrl);
    document.getElementById('export-db')?.addEventListener('click', exportDatabase);
    document.getElementById('generate-db-qr')?.addEventListener('click', generateDatabaseQR);
}

// ========== TAB NAVIGATION ==========
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    if (tabName === 'scan') {
        initScanner();
    } else {
        stopScanner();
    }
}

// ========== THEME ==========
function toggleTheme() {
    AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
    applyTheme(AppState.theme);
    saveState();
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ========== QR GENERATION ==========
function updateCharCount() {
    const input = document.getElementById('qr-input');
    const count = document.getElementById('char-count');
    if (input && count) {
        count.textContent = input.value.length;
        count.style.color = input.value.length > 2953 ? 'var(--danger)' : '';
    }
}

async function generateQR() {
    const input = document.getElementById('qr-input')?.value.trim();
    if (!input) {
        showToast('Please enter text or URL');
        return;
    }
    
    if (input.length > 2953) {
        showToast('Text too long (max 2953 characters)');
        return;
    }
    
    try {
        const errorLevel = document.getElementById('error-level')?.value || 'M';
        const style = document.getElementById('qr-style')?.value || 'square';
        const fgColor = document.getElementById('fg-color')?.value || '#000000';
        const bgColor = document.getElementById('bg-color')?.value || '#ffffff';
        const templateId = document.getElementById('template-select')?.value || '';
        
        let qrDataUrl;
        
        if (templateId && QR_TEMPLATES[templateId]) {
            qrDataUrl = await generateTemplatedQR(input, templateId, errorLevel, style);
        } else {
            qrDataUrl = await generateBasicQR(input, errorLevel, fgColor, bgColor, style);
        }
        
        displayQRResult(qrDataUrl, input);
        addToHistory(input);
        
    } catch (error) {
        console.error('QR generation error:', error);
        showToast('Error generating QR code');
    }
}

function generateBasicQR(text, errorLevel, fgColor, bgColor, style) {
    return new Promise((resolve, reject) => {
        try {
            const container = document.createElement('div');
            container.style.display = 'none';
            document.body.appendChild(container);
            
            new QRCode(container, {
                text: text,
                width: 300,
                height: 300,
                colorDark: fgColor,
                colorLight: bgColor,
                correctLevel: QRCode.CorrectLevel[errorLevel]
            });
            
            const checkCanvas = () => {
                const canvas = container.querySelector('canvas');
                if (canvas && canvas.width > 0) {
                    let finalCanvas = canvas;
                    
                    if (style === 'dots' || style === 'rounded') {
                        finalCanvas = applyQRStyle(canvas, style, fgColor, bgColor);
                    }
                    
                    const dataUrl = finalCanvas.toDataURL('image/png');
                    document.body.removeChild(container);
                    resolve(dataUrl);
                } else {
                    requestAnimationFrame(checkCanvas);
                }
            };
            
            requestAnimationFrame(checkCanvas);
        } catch (error) {
            reject(error);
        }
    });
}

function applyQRStyle(sourceCanvas, style, fgColor, bgColor) {
    const size = sourceCanvas.width;
    const ctx = sourceCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    const newCanvas = document.createElement('canvas');
    newCanvas.width = size;
    newCanvas.height = size;
    const newCtx = newCanvas.getContext('2d');
    
    newCtx.fillStyle = bgColor;
    newCtx.fillRect(0, 0, size, size);
    
    let transitions = [];
    let lastWasDark = false;
    let transitionStart = 0;
    
    for (let x = 0; x < size; x++) {
        const idx = (Math.floor(size / 2) * size + x) * 4;
        const isDark = data[idx] < 128;
        
        if (isDark !== lastWasDark) {
            if (x > 0) {
                transitions.push(x - transitionStart);
                transitionStart = x;
            }
            lastWasDark = isDark;
        }
    }
    
    transitions.sort((a, b) => a - b);
    const moduleSize = transitions[0] || Math.floor(size / 25);
    const gridSize = Math.round(size / moduleSize);
    const actualCellSize = size / gridSize;
    
    const matrix = [];
    for (let row = 0; row < gridSize; row++) {
        matrix[row] = [];
        for (let col = 0; col < gridSize; col++) {
            const centerX = Math.floor(col * actualCellSize + actualCellSize / 2);
            const centerY = Math.floor(row * actualCellSize + actualCellSize / 2);
            
            if (centerX >= size || centerY >= size) {
                matrix[row][col] = false;
                continue;
            }
            
            const idx = (centerY * size + centerX) * 4;
            matrix[row][col] = data[idx] < 128;
        }
    }
    
    function isInFinderPattern(row, col) {
        const finderSize = 7;
        if (row < finderSize && col < finderSize) return true;
        if (row < finderSize && col >= gridSize - finderSize) return true;
        if (row >= gridSize - finderSize && col < finderSize) return true;
        return false;
    }
    
    newCtx.fillStyle = fgColor;
    
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (matrix[row][col]) {
                const x = col * actualCellSize;
                const y = row * actualCellSize;
                const isFinderArea = isInFinderPattern(row, col);
                
                if (style === 'dots' && !isFinderArea) {
                    const centerX = x + actualCellSize / 2;
                    const centerY = y + actualCellSize / 2;
                    const radius = actualCellSize * 0.45;
                    
                    newCtx.beginPath();
                    newCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                    newCtx.fill();
                } else if (style === 'rounded' && !isFinderArea) {
                    const padding = actualCellSize * 0.05;
                    const radius = actualCellSize * 0.2;
                    const rectSize = actualCellSize - (padding * 2);
                    
                    roundRect(newCtx, x + padding, y + padding, rectSize, rectSize, radius);
                    newCtx.fill();
                } else {
                    newCtx.fillRect(x, y, actualCellSize, actualCellSize);
                }
            }
        }
    }
    
    return newCanvas;
}

async function generateTemplatedQR(text, templateId, errorLevel, style) {
    const template = QR_TEMPLATES[templateId];
    if (!template) {
        return generateBasicQR(text, errorLevel, '#000000', '#ffffff', style);
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = template.canvasWidth;
    canvas.height = template.canvasHeight;
    const ctx = canvas.getContext('2d');
    
    if (template.gradient) {
        const gradient = template.gradient;
        let grd;
        
        if (gradient.type === 'linear') {
            const angle = (gradient.angle || 0) * Math.PI / 180;
            const x1 = canvas.width / 2 - Math.cos(angle) * canvas.width / 2;
            const y1 = canvas.height / 2 - Math.sin(angle) * canvas.height / 2;
            const x2 = canvas.width / 2 + Math.cos(angle) * canvas.width / 2;
            const y2 = canvas.height / 2 + Math.sin(angle) * canvas.height / 2;
            grd = ctx.createLinearGradient(x1, y1, x2, y2);
        } else {
            grd = ctx.createRadialGradient(
                canvas.width / 2, canvas.height / 2, 0,
                canvas.width / 2, canvas.height / 2, canvas.width / 2
            );
        }
        
        gradient.colors.forEach((color, idx) => {
            grd.addColorStop(idx / (gradient.colors.length - 1), color);
        });
        
        ctx.fillStyle = grd;
    } else {
        ctx.fillStyle = template.bgColor || '#ffffff';
    }
    
    if (template.borderRadius > 0) {
        roundRect(ctx, 0, 0, canvas.width, canvas.height, template.borderRadius);
        ctx.fill();
    } else {
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    if (template.borderWidth && template.borderColor) {
        ctx.strokeStyle = template.borderColor;
        ctx.lineWidth = template.borderWidth;
        
        if (template.borderRadius > 0) {
            roundRect(ctx, template.borderWidth / 2, template.borderWidth / 2,
                canvas.width - template.borderWidth, canvas.height - template.borderWidth,
                template.borderRadius);
            ctx.stroke();
        } else {
            ctx.strokeRect(template.borderWidth / 2, template.borderWidth / 2,
                canvas.width - template.borderWidth, canvas.height - template.borderWidth);
        }
    }
    
    const qrDataUrl = await generateBasicQR(
        text,
        errorLevel,
        template.qrFgColor || '#000000',
        template.qrBgColor || '#ffffff',
        style
    );
    
    const qrImg = await loadImage(qrDataUrl);
    const qrX = (template.qrX / 100) * canvas.width;
    const qrY = (template.qrY / 100) * canvas.height;
    const qrSize = template.qrSize;
    
    ctx.drawImage(qrImg, qrX - qrSize / 2, qrY - qrSize / 2, qrSize, qrSize);
    
    if (template.textFields) {
        template.textFields.forEach(field => {
            const x = (field.x / 100) * canvas.width;
            const y = (field.y / 100) * canvas.height;
            
            ctx.save();
            ctx.font = `${field.fontWeight || 'normal'} ${field.fontSize}px Arial, sans-serif`;
            ctx.fillStyle = field.color || '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            if (field.shadow) {
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }
            
            const displayText = field.content.replace('{data}', text);
            ctx.fillText(displayText, x, y);
            ctx.restore();
        });
    }
    
    if (template.symbols) {
        template.symbols.forEach(symbol => {
            const x = (symbol.x / 100) * canvas.width;
            const y = (symbol.y / 100) * canvas.height;
            
            ctx.save();
            ctx.font = `${symbol.size}px Arial, sans-serif`;
            ctx.fillStyle = symbol.color || '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(symbol.content, x, y);
            ctx.restore();
        });
    }
    
    return canvas.toDataURL('image/png');
}

function displayQRResult(dataUrl, data) {
    const resultDiv = document.getElementById('qr-result');
    const qrDisplay = document.getElementById('qr-display');
    const preview = document.getElementById('qr-data-preview');
    const distanceInfo = document.getElementById('scan-distance');
    
    if (qrDisplay) qrDisplay.innerHTML = `<img src="${dataUrl}" alt="QR Code">`;
    if (preview) preview.textContent = data.length > 50 ? data.substring(0, 50) + '...' : data;
    
    if (distanceInfo) {
        const qrSize = 50;
        const optimal = Math.round(qrSize * 2);
        const min = Math.round(qrSize * 0.5);
        const max = Math.round(qrSize * 4);
        
        distanceInfo.innerHTML = `
            <strong>📏 Scan Distance:</strong> ${optimal}cm optimal<br>
            <small>Min: ${min}cm | Max: ${max}cm (for ${qrSize}mm printed QR)</small>
        `;
    }
    
    AppState.currentQR = { dataUrl, data };
    if (resultDiv) {
        resultDiv.classList.remove('hidden');
        resultDiv.scrollIntoView({ behavior: 'smooth' });
    }
}

// ========== QR ACTIONS ==========
function downloadQR() {
    if (!AppState.currentQR) return;
    
    const link = document.createElement('a');
    link.download = `qr-code-${Date.now()}.png`;
    link.href = AppState.currentQR.dataUrl;
    link.click();
    
    showToast('Downloaded!');
}

async function copyQR() {
    if (!AppState.currentQR) return;
    
    try {
        const response = await fetch(AppState.currentQR.dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        showToast('Copied to clipboard!');
    } catch (error) {
        try {
            await navigator.clipboard.writeText(AppState.currentQR.data);
            showToast('Copied text to clipboard!');
        } catch (e) {
            showToast('Copy failed');
        }
    }
}

function printQR() {
    if (!AppState.currentQR) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print QR Code</title>
            <style>
                body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: Arial, sans-serif; }
                img { max-width: 80%; height: auto; }
                p { margin-top: 20px; font-size: 14px; color: #666; word-break: break-all; max-width: 80%; text-align: center; }
            </style>
        </head>
        <body>
            <img src="${AppState.currentQR.dataUrl}" alt="QR Code" onload="setTimeout(() => window.print(), 100)">
            <p>${AppState.currentQR.data}</p>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ========== HISTORY ==========
function addToHistory(data) {
    AppState.history = AppState.history.filter(item => item !== data);
    AppState.history.unshift(data);
    AppState.history = AppState.history.slice(0, 20);
    saveState();
    updateHistoryUI();
}

function clearHistory() {
    if (confirm('Clear all history?')) {
        AppState.history = [];
        saveState();
        updateHistoryUI();
        showToast('History cleared');
    }
}

function updateHistoryUI() {
    const container = document.getElementById('history-list');
    if (!container) return;
    
    if (AppState.history.length === 0) {
        container.innerHTML = '<p class="text-muted">No history yet</p>';
        return;
    }
    
    container.innerHTML = AppState.history.slice(0, 10).map(item => {
        const preview = item.length > 40 ? item.substring(0, 40) + '...' : item;
        return `<div class="history-item" data-value="${escapeHtml(item)}">${preview}</div>`;
    }).join('');
    
    container.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const input = document.getElementById('qr-input');
            if (input) {
                input.value = item.dataset.value;
                updateCharCount();
            }
        });
    });
}

// ========== BATCH GENERATION ==========
function parsePattern(pattern) {
    const items = [];
    const rangeRegex = /\{([^}]+)\}/g;
    
    let matches = [];
    let match;
    while ((match = rangeRegex.exec(pattern)) !== null) {
        matches.push({
            full: match[0],
            content: match[1],
            index: match.index
        });
    }
    
    if (matches.length === 0) {
        return [pattern];
    }
    
    const ranges = matches.map(m => parseRange(m.content));
    const combinations = cartesian(ranges);
    
    combinations.forEach(combo => {
        let result = pattern;
        const comboArray = Array.isArray(combo) ? combo : [combo];
        
        for (let i = matches.length - 1; i >= 0; i--) {
            const value = comboArray[i];
            const before = result.substring(0, matches[i].index);
            const after = result.substring(matches[i].index + matches[i].full.length);
            result = before + value + after;
        }
        
        items.push(result);
    });
    
    return items;
}

function parseRange(content) {
    if (/^\d+-\d+$/.test(content)) {
        const [start, end] = content.split('-').map(s => s.trim());
        const startNum = parseInt(start);
        const endNum = parseInt(end);
        const padLength = start.length;
        const values = [];
        
        for (let i = startNum; i <= endNum; i++) {
            values.push(i.toString().padStart(padLength, '0'));
        }
        return values;
    }
    
    if (/^[A-Za-z]-[A-Za-z]$/.test(content)) {
        const [start, end] = content.split('-');
        const startCode = start.charCodeAt(0);
        const endCode = end.charCodeAt(0);
        const values = [];
        
        for (let i = startCode; i <= endCode; i++) {
            values.push(String.fromCharCode(i));
        }
        return values;
    }
    
    if (content.includes('|')) {
        return content.split('|').map(s => s.trim());
    }
    
    return [content];
}

function cartesian(arrays) {
    if (arrays.length === 0) return [[]];
    if (arrays.length === 1) return arrays[0].map(item => [item]);
    
    return arrays.reduce((acc, curr) => {
        const result = [];
        acc.forEach(a => {
            curr.forEach(c => {
                result.push(Array.isArray(a) ? [...a, c] : [a, c]);
            });
        });
        return result;
    });
}

function previewBatch() {
    const pattern = document.getElementById('batch-pattern')?.value.trim();
    const manual = document.getElementById('batch-manual')?.value.trim();
    
    let items = [];
    
    if (pattern) {
        items = parsePattern(pattern);
    } else if (manual) {
        items = manual.split('\n').map(line => line.trim()).filter(line => line);
    }
    
    if (items.length === 0) {
        showToast('Please enter a pattern or items');
        return;
    }
    
    const previewDiv = document.getElementById('batch-preview');
    const previewList = document.getElementById('batch-preview-list');
    
    if (previewDiv && previewList) {
        let previewText = `Total: ${items.length} items\n\n`;
        previewText += items.slice(0, 15).join('\n');
        if (items.length > 15) {
            previewText += `\n... and ${items.length - 15} more`;
        }
        
        previewList.textContent = previewText;
        previewDiv.classList.remove('hidden');
    }
}

async function generateBatch() {
    const pattern = document.getElementById('batch-pattern')?.value.trim();
    const manual = document.getElementById('batch-manual')?.value.trim();
    
    let items = [];
    
    if (pattern) {
        items = parsePattern(pattern);
    } else if (manual) {
        items = manual.split('\n').map(line => line.trim()).filter(line => line);
    }
    
    if (items.length === 0) {
        showToast('Please enter a pattern or items');
        return;
    }
    
    if (items.length > 500 && !confirm(`Generate ${items.length} QR codes? This may take a while.`)) {
        return;
    }
    
    const errorLevel = document.getElementById('error-level')?.value || 'M';
    const style = document.getElementById('qr-style')?.value || 'square';
    const templateId = document.getElementById('batch-template')?.value || '';
    
    const progressDiv = document.getElementById('batch-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const resultsDiv = document.getElementById('batch-results');
    const grid = document.getElementById('batch-grid');
    
    if (progressDiv) progressDiv.classList.remove('hidden');
    if (resultsDiv) resultsDiv.classList.add('hidden');
    if (grid) grid.innerHTML = '';
    AppState.bulkQRCodes = [];
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const percent = ((i + 1) / items.length) * 100;
        
        if (progressFill) progressFill.style.width = percent + '%';
        if (progressText) progressText.textContent = `Generating ${i + 1} of ${items.length}...`;
        
        try {
            let qrUrl;
            
            if (templateId && QR_TEMPLATES[templateId]) {
                qrUrl = await generateTemplatedQR(item, templateId, errorLevel, style);
            } else {
                const fgColor = document.getElementById('fg-color')?.value || '#000000';
                const bgColor = document.getElementById('bg-color')?.value || '#ffffff';
                qrUrl = await generateBasicQR(item, errorLevel, fgColor, bgColor, style);
            }
            
            AppState.bulkQRCodes.push({ data: item, url: qrUrl });
            
            if (grid) {
                const itemEl = document.createElement('div');
                itemEl.className = 'batch-item';
                itemEl.innerHTML = `
                    <img src="${qrUrl}" alt="${escapeHtml(item)}">
                    <div class="batch-item-label">${item.length > 15 ? item.substring(0, 15) + '...' : item}</div>
                `;
                grid.appendChild(itemEl);
            }
            
        } catch (error) {
            console.error(`Error generating QR for "${item}":`, error);
        }
        
        if (i % 5 === 0) {
            await sleep(0);
        }
    }
    
    if (progressText) progressText.textContent = `✓ Generated ${items.length} QR codes!`;
    
    setTimeout(() => {
        if (progressDiv) progressDiv.classList.add('hidden');
        if (resultsDiv) resultsDiv.classList.remove('hidden');
    }, 1000);
}

function selectLabelTemplate(templateId) {
    AppState.selectedLabelTemplate = templateId;
    saveState();
    
    document.querySelectorAll('.label-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.template === templateId);
    });
    
    showToast(`Selected: ${LABEL_TEMPLATES[templateId]?.name || templateId}`);
}

function downloadAllBatch() {
    if (AppState.bulkQRCodes.length === 0) return;
    
    AppState.bulkQRCodes.forEach((qr, index) => {
        setTimeout(() => {
            const link = document.createElement('a');
            link.href = qr.url;
            link.download = `qr-${String(index + 1).padStart(4, '0')}-${qr.data.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)}.png`;
            link.click();
        }, index * 200);
    });
    
    showToast('Downloading all QR codes...');
}

async function downloadBatchPDF() {
    if (AppState.bulkQRCodes.length === 0) return;
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    
    const qrSize = 50;
    const cols = 3;
    const rows = 5;
    const gap = 10;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const totalWidth = cols * qrSize + (cols - 1) * gap;
    const marginX = (pageWidth - totalWidth) / 2;
    const marginY = 20;
    
    for (let i = 0; i < AppState.bulkQRCodes.length; i++) {
        if (i > 0 && i % (cols * rows) === 0) {
            pdf.addPage();
        }
        
        const pageIndex = i % (cols * rows);
        const row = Math.floor(pageIndex / cols);
        const col = pageIndex % cols;
        
        const x = marginX + col * (qrSize + gap);
        const y = marginY + row * (qrSize + gap + 8);
        
        pdf.addImage(AppState.bulkQRCodes[i].url, 'PNG', x, y, qrSize, qrSize);
        
        pdf.setFontSize(8);
        const label = AppState.bulkQRCodes[i].data.substring(0, 25);
        const textWidth = pdf.getTextWidth(label);
        pdf.text(label, x + (qrSize / 2) - (textWidth / 2), y + qrSize + 5);
    }
    
    pdf.save(`qr-batch-${Date.now()}.pdf`);
    showToast('PDF downloaded!');
}

async function printLabels() {
    if (AppState.bulkQRCodes.length === 0) {
        showToast('No QR codes to print');
        return;
    }
    
    const template = LABEL_TEMPLATES[AppState.selectedLabelTemplate];
    if (!template) {
        showToast('Please select a label template');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    
    let labelIndex = 0;
    
    for (let i = 0; i < AppState.bulkQRCodes.length; i++) {
        if (labelIndex >= template.total) {
            pdf.addPage();
            labelIndex = 0;
        }
        
        const row = Math.floor(labelIndex / template.cols);
        const col = labelIndex % template.cols;
        
        const x = template.marginLeft + col * (template.labelWidth + template.gapX);
        const y = template.marginTop + row * (template.labelHeight + template.gapY);
        
        const maxQRSize = Math.min(template.labelWidth, template.labelHeight) * 0.8;
        const qrX = x + template.labelWidth / 2 - maxQRSize / 2;
        const qrY = y + (template.labelHeight - maxQRSize) / 2;
        
        pdf.addImage(AppState.bulkQRCodes[i].url, 'PNG', qrX, qrY, maxQRSize, maxQRSize);
        
        labelIndex++;
    }
    
    pdf.save(`qr-labels-${template.name.replace(/\s+/g, '-')}-${Date.now()}.pdf`);
    showToast(`PDF with ${AppState.bulkQRCodes.length} labels ready!`);
}

// ========== SCANNER ==========
async function initScanner() {
    if (AppState.scanner.scanning) return;
    
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        const selector = document.getElementById('camera-select');
        if (selector) {
            selector.innerHTML = videoDevices.map((device, index) =>
                `<option value="${device.deviceId}">${device.label || `Camera ${index + 1}`}</option>`
            ).join('');
        }
        
        const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back'));
        const deviceId = backCamera ? backCamera.deviceId : (videoDevices[0]?.deviceId || null);
        
        if (deviceId) {
            await startCamera(deviceId);
        }
    } catch (error) {
        console.error('Scanner init error:', error);
        showToast('Could not access camera');
    }
}

async function startCamera(deviceId) {
    try {
        if (AppState.scanner.stream) {
            AppState.scanner.stream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                facingMode: deviceId ? undefined : { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        AppState.scanner.stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const video = document.getElementById('scanner-video');
        if (video) {
            video.srcObject = AppState.scanner.stream;
        }
        
        AppState.scanner.scanning = true;
        startScanning();
        
    } catch (error) {
        console.error('Start camera error:', error);
        showToast('Failed to start camera');
    }
}

function switchCamera(event) {
    startCamera(event.target.value);
}

function startScanning() {
    const video = document.getElementById('scanner-video');
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const scan = () => {
        if (!AppState.scanner.scanning || !video.videoWidth) {
            AppState.scanner.animationId = requestAnimationFrame(scan);
            return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
        });
        
        if (code) {
            handleScanResult(code.data);
        }
        
        AppState.scanner.animationId = requestAnimationFrame(scan);
    };
    
    scan();
}

function stopScanner() {
    AppState.scanner.scanning = false;
    
    if (AppState.scanner.animationId) {
        cancelAnimationFrame(AppState.scanner.animationId);
    }
    
    if (AppState.scanner.stream) {
        AppState.scanner.stream.getTracks().forEach(track => track.stop());
        AppState.scanner.stream = null;
    }
}

function handleScanResult(data) {
    displayScanResult(data);
    addToScanHistory(data);
    
    const overlay = document.querySelector('.scanner-overlay');
    if (overlay) {
        overlay.style.background = 'rgba(16, 185, 129, 0.3)';
        setTimeout(() => {
            overlay.style.background = 'transparent';
        }, 200);
    }
    
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
}

function displayScanResult(data) {
    const resultDiv = document.getElementById('scan-result');
    const scanData = document.getElementById('scan-data');
    
    if (scanData) scanData.textContent = data;
    if (resultDiv) {
        resultDiv.classList.remove('hidden');
        resultDiv.scrollIntoView({ behavior: 'smooth' });
    }
    
    AppState.currentScan = data;
}

async function scanFromImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
        const data = await scanImageFile(file);
        handleScanResult(data);
    } catch (error) {
        showToast('No QR code found in image');
    }
    
    event.target.value = '';
}

function scanImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                
                if (code) {
                    resolve(code.data);
                } else {
                    reject(new Error('No QR code found'));
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

function addToScanHistory(data) {
    AppState.scanHistory = AppState.scanHistory.filter(item => item !== data);
    AppState.scanHistory.unshift(data);
    AppState.scanHistory = AppState.scanHistory.slice(0, 20);
    saveState();
    updateScanHistoryUI();
}

function updateScanHistoryUI() {
    const container = document.getElementById('scan-history');
    if (!container) return;
    
    if (AppState.scanHistory.length === 0) {
        container.innerHTML = '<p class="text-muted">No scans yet</p>';
        return;
    }
    
    container.innerHTML = AppState.scanHistory.slice(0, 10).map(item => {
        const preview = item.length > 50 ? item.substring(0, 50) + '...' : item;
        return `<div class="history-item" data-value="${escapeHtml(item)}">${preview}</div>`;
    }).join('');
    
    container.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => displayScanResult(item.dataset.value));
    });
}

async function copyScanResult() {
    if (!AppState.currentScan) return;
    
    try {
        await navigator.clipboard.writeText(AppState.currentScan);
        showToast('Copied!');
    } catch (error) {
        showToast('Copy failed');
    }
}

function openScannedUrl() {
    if (!AppState.currentScan) return;
    
    try {
        new URL(AppState.currentScan);
        window.open(AppState.currentScan, '_blank');
    } catch {
        showToast('Not a valid URL');
    }
}

function generateFromScan() {
    if (!AppState.currentScan) return;
    
    const input = document.getElementById('qr-input');
    if (input) {
        input.value = AppState.currentScan;
        updateCharCount();
    }
    switchTab('generate');
}

// ========================================
// DATABASE - iOS FILE UPLOAD FIXED
// ========================================

function setupDatabaseUpload() {
    const dropZone = document.getElementById('db-drop-zone');
    const fileInput = document.getElementById('db-upload');
    const browseBtn = dropZone?.querySelector('.btn');
    
    if (!dropZone || !fileInput) {
        console.error('Database upload elements not found');
        return;
    }
    
    // iOS FIX: Create a visible, properly sized file input
    fileInput.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        z-index: 10;
    `;
    
    // Make drop zone position relative for absolute positioning of input
    dropZone.style.position = 'relative';
    
    // iOS FIX: Multiple event listeners for maximum compatibility
    fileInput.addEventListener('change', handleFileSelect);
    fileInput.addEventListener('input', handleFileSelect);
    
    // iOS FIX: Also handle click on the browse button specifically
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        });
    }
    
    // Drag and drop (won't work on iOS but good for desktop)
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        if (e.dataTransfer?.files?.[0]) {
            handleDatabaseFile(e.dataTransfer.files[0]);
        }
    });
    
    console.log('Database upload setup complete');
}

function handleFileSelect(e) {
    console.log('File select triggered', e.type);
    const file = e.target?.files?.[0];
    
    if (file) {
        console.log('File selected:', file.name, file.size);
        handleDatabaseFile(file);
        // Reset input so same file can be selected again
        e.target.value = '';
    }
}

async function handleDatabaseFile(file) {
    const statusDiv = document.getElementById('upload-status');
    
    if (statusDiv) {
        statusDiv.className = 'status';
        statusDiv.textContent = '📖 Reading file...';
        statusDiv.classList.remove('hidden');
    }
    
    try {
        const content = await readFile(file);
        const fileName = file.name.replace(/\.[^/.]+$/, '');
        const result = await parseDatabase(content, fileName);
        
        if (statusDiv) {
            statusDiv.className = 'status success';
            statusDiv.textContent = `✓ Loaded ${result.rows} records from ${fileName}`;
        }
        
        showToast(`Database loaded: ${result.rows} records`);
        updateDatabaseUI();
        
    } catch (error) {
        console.error('Database file error:', error);
        if (statusDiv) {
            statusDiv.className = 'status error';
            statusDiv.textContent = `❌ Error: ${error.message}`;
        }
        showToast('Error loading database');
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

async function parseDatabase(content, fileName) {
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
        throw new Error('File must have at least a header and one data row');
    }
    
    const delimiter = content.includes('\t') ? '\t' : ',';
    const data = [];
    
    // Skip header, parse data
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));
        
        if (parts.length >= 2 && parts[0] && parts[1]) {
            data.push({
                label: parts[0],
                id: parts[1],
                displayText: parts[2] || ''
            });
        }
    }
    
    if (data.length === 0) {
        throw new Error('No valid data found. Format: Label,ID,DisplayText');
    }
    
    const dbId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    AppState.databases[dbId] = {
        name: fileName,
        data: data,
        created: Date.now(),
        rows: data.length
    };
    
    AppState.activeDbId = dbId;
    saveState();
    
    return { rows: data.length };
}

async function loadDatabaseFromUrl() {
    const urlInput = document.getElementById('db-url');
    const url = urlInput?.value.trim();
    
    if (!url) {
        showToast('Please enter a URL');
        return;
    }
    
    const statusDiv = document.getElementById('upload-status');
    if (statusDiv) {
        statusDiv.className = 'status';
        statusDiv.textContent = '🌐 Loading from URL...';
        statusDiv.classList.remove('hidden');
    }
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            if (Array.isArray(data)) {
                const dbId = Date.now().toString(36) + Math.random().toString(36).substr(2);
                const fileName = url.split('/').pop().replace(/\.[^/.]+$/, '') || 'imported';
                
                AppState.databases[dbId] = {
                    name: fileName,
                    data: data.map(item => ({
                        label: item.label || item.name || item.title || '',
                        id: item.id || item.code || '',
                        displayText: item.displayText || item.description || ''
                    })),
                    created: Date.now(),
                    rows: data.length
                };
                
                AppState.activeDbId = dbId;
                saveState();
                
                if (statusDiv) {
                    statusDiv.className = 'status success';
                    statusDiv.textContent = `✓ Loaded ${data.length} records`;
                }
                updateDatabaseUI();
            } else {
                throw new Error('Invalid JSON format - expected array');
            }
        } else {
            // Try to parse as CSV/TSV
            const text = await response.text();
            const fileName = url.split('/').pop().replace(/\.[^/.]+$/, '') || 'imported';
            const result = await parseDatabase(text, fileName);
            
            if (statusDiv) {
                statusDiv.className = 'status success';
                statusDiv.textContent = `✓ Loaded ${result.rows} records`;
            }
            updateDatabaseUI();
        }
        
    } catch (error) {
        console.error('URL load error:', error);
        if (statusDiv) {
            statusDiv.className = 'status error';
            statusDiv.textContent = `❌ Error: ${error.message}`;
        }
    }
}

function scanDatabaseQR() {
    showToast('Switch to Scan tab and scan a QR with database URL');
    switchTab('scan');
}

// ========================================
// DATABASE SEARCH - MAIN FEATURE
// ========================================

function handleDatabaseSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    const resultsDiv = document.getElementById('search-results');
    
    if (!resultsDiv) return;
    
    // Hide results if no query or no active database
    if (!query || !AppState.activeDbId) {
        resultsDiv.classList.remove('visible');
        resultsDiv.innerHTML = '';
        return;
    }
    
    const db = AppState.databases[AppState.activeDbId];
    if (!db || !db.data) {
        resultsDiv.classList.remove('visible');
        return;
    }
    
    // Search through database
    const matches = db.data.filter(item =>
        item.label.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        (item.displayText && item.displayText.toLowerCase().includes(query))
    ).slice(0, 15); // Limit results
    
    if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(item => `
            <div class="search-item" data-id="${escapeHtml(item.id)}" data-label="${escapeHtml(item.label)}" data-display="${escapeHtml(item.displayText || '')}">
                <div class="search-item-label">${escapeHtml(item.label)}</div>
                <div class="search-item-id">ID: ${escapeHtml(item.id)}${item.displayText ? ' • ' + escapeHtml(item.displayText) : ''}</div>
            </div>
        `).join('');
        
        resultsDiv.classList.add('visible');
        
        // Add click handlers to search results
        resultsDiv.querySelectorAll('.search-item').forEach(item => {
            item.addEventListener('click', async () => {
                const id = item.dataset.id;
                const label = item.dataset.label;
                
                console.log('Selected from database:', { id, label });
                
                // Generate QR code for this item
                try {
                    const errorLevel = document.getElementById('error-level')?.value || 'M';
                    const style = document.getElementById('qr-style')?.value || 'square';
                    const fgColor = document.getElementById('fg-color')?.value || '#000000';
                    const bgColor = document.getElementById('bg-color')?.value || '#ffffff';
                    const templateId = document.getElementById('template-select')?.value || '';
                    
                    let qrDataUrl;
                    
                    if (templateId && QR_TEMPLATES[templateId]) {
                        qrDataUrl = await generateTemplatedQR(id, templateId, errorLevel, style);
                    } else {
                        qrDataUrl = await generateBasicQR(id, errorLevel, fgColor, bgColor, style);
                    }
                    
                    displayQRResult(qrDataUrl, id);
                    addToHistory(id);
                    
                    // Clear search
                    const searchInput = document.getElementById('db-search');
                    if (searchInput) searchInput.value = '';
                    resultsDiv.classList.remove('visible');
                    
                } catch (error) {
                    console.error('Error generating QR from database:', error);
                    showToast('Error generating QR code');
                }
            });
        });
    } else {
        resultsDiv.innerHTML = '<div class="search-item text-muted">No matches found</div>';
        resultsDiv.classList.add('visible');
    }
}

function updateDatabaseUI() {
    const dbList = document.getElementById('db-list');
    const activeCard = document.getElementById('active-db-card');
    const searchContainer = document.getElementById('db-search-container');
    
    const dbKeys = Object.keys(AppState.databases);
    
    // Update database list
    if (dbList) {
        if (dbKeys.length === 0) {
            dbList.innerHTML = '<p class="text-muted">No databases loaded</p>';
        } else {
            dbList.innerHTML = dbKeys.map(id => {
                const db = AppState.databases[id];
                const isActive = id === AppState.activeDbId;
                
                return `
                    <div class="db-item ${isActive ? 'active' : ''}" data-id="${id}">
                        <div class="db-item-info">
                            <div class="db-item-name">${escapeHtml(db.name)}</div>
                            <div class="db-item-meta">${db.rows} rows • ${new Date(db.created).toLocaleDateString()}</div>
                        </div>
                        <div class="db-item-actions">
                            ${!isActive ? `<button class="btn btn-small btn-secondary activate-db" data-id="${id}">Use</button>` : '<span style="color: var(--success);">✓ Active</span>'}
                            <button class="btn btn-small btn-danger delete-db" data-id="${id}">×</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Attach event handlers
            dbList.querySelectorAll('.activate-db').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    AppState.activeDbId = btn.dataset.id;
                    saveState();
                    updateDatabaseUI();
                    showToast('Database activated');
                });
            });
            
            dbList.querySelectorAll('.delete-db').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Delete this database?')) {
                        delete AppState.databases[btn.dataset.id];
                        if (AppState.activeDbId === btn.dataset.id) {
                            AppState.activeDbId = Object.keys(AppState.databases)[0] || null;
                        }
                        saveState();
                        updateDatabaseUI();
                        showToast('Database deleted');
                    }
                });
            });
        }
    }
    
    // Update active database info
    if (AppState.activeDbId && AppState.databases[AppState.activeDbId]) {
        const activeDb = AppState.databases[AppState.activeDbId];
        
        const nameEl = document.getElementById('active-db-name');
        const infoEl = document.getElementById('active-db-info');
        
        if (nameEl) nameEl.textContent = activeDb.name;
        if (infoEl) infoEl.textContent = `${activeDb.rows} records • Created ${new Date(activeDb.created).toLocaleDateString()}`;
        
        if (activeCard) activeCard.classList.remove('hidden');
        if (searchContainer) searchContainer.classList.remove('hidden');
    } else {
        if (activeCard) activeCard.classList.add('hidden');
        if (searchContainer) searchContainer.classList.add('hidden');
    }
}

function exportDatabase() {
    if (!AppState.activeDbId) return;
    
    const db = AppState.databases[AppState.activeDbId];
    const json = JSON.stringify(db.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${db.name}-export.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showToast('Database exported');
}

async function generateDatabaseQR() {
    if (!AppState.activeDbId) return;
    
    showToast('Host your JSON file online and share that URL as a QR code');
}

// ========== UI UPDATE ==========
function updateUI() {
    updateHistoryUI();
    updateScanHistoryUI();
    updateDatabaseUI();
    
    document.querySelectorAll('.label-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.template === AppState.selectedLabelTemplate);
    });
}

// ========== UTILITIES ==========
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, duration);
    }
}

// ========== CLEANUP ==========
window.addEventListener('beforeunload', () => {
    stopScanner();
});

// Log ready status
console.log('QR Generator Pro script loaded');
