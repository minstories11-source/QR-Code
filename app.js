// ========================================
// QR GENERATOR PRO - CLEAN & SIMPLE
// Separate Database Search Tab
// ========================================

const AppState = {
    databases: {},
    activeDbId: null,
    history: [],
    scanHistory: [],
    theme: 'light',
    currentQR: null,
    currentDbQR: null,
    currentScan: null,
    scanner: {
        stream: null,
        scanning: false,
        animationId: null
    }
};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupEventListeners();
    updateUI();
    console.log('QR Generator Pro ready!');
});

// ========== STATE ==========
function loadState() {
    try {
        const saved = localStorage.getItem('qrGeneratorState');
        if (saved) Object.assign(AppState, JSON.parse(saved));
        applyTheme(AppState.theme);
    } catch (e) {
        console.error('Load state error:', e);
    }
}

function saveState() {
    try {
        localStorage.setItem('qrGeneratorState', JSON.stringify({
            databases: AppState.databases,
            activeDbId: AppState.activeDbId,
            history: AppState.history,
            scanHistory: AppState.scanHistory,
            theme: AppState.theme
        }));
    } catch (e) {
        console.error('Save state error:', e);
    }
}

// ========== EVENTS ==========
function setupEventListeners() {
    // Theme
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Generate tab
    document.getElementById('qr-input')?.addEventListener('input', updateCharCount);
    document.getElementById('generate-btn')?.addEventListener('click', generateManualQR);
    document.getElementById('download-png')?.addEventListener('click', () => downloadQR('manual'));
    document.getElementById('copy-qr')?.addEventListener('click', () => copyQR('manual'));
    document.getElementById('print-qr')?.addEventListener('click', () => printQR('manual'));
    document.getElementById('clear-history')?.addEventListener('click', clearHistory);
    
    // Database tab
    document.getElementById('db-search')?.addEventListener('input', handleDatabaseSearch);
    document.getElementById('clear-search')?.addEventListener('click', clearSearch);
    document.getElementById('db-download-png')?.addEventListener('click', () => downloadQR('db'));
    document.getElementById('db-copy-qr')?.addEventListener('click', () => copyQR('db'));
    document.getElementById('db-print-qr')?.addEventListener('click', () => printQR('db'));
    document.getElementById('go-to-settings')?.addEventListener('click', () => switchTab('settings'));
    
    // Scan tab
    document.getElementById('camera-select')?.addEventListener('change', switchCamera);
    document.getElementById('scan-upload')?.addEventListener('change', scanFromImage);
    document.getElementById('copy-scan')?.addEventListener('click', copyScanResult);
    document.getElementById('open-url')?.addEventListener('click', openScannedUrl);
    document.getElementById('generate-from-scan')?.addEventListener('click', generateFromScan);
    
    // Settings tab
    setupDatabaseUpload();
    document.getElementById('load-db-url')?.addEventListener('click', loadDatabaseFromUrl);
    document.getElementById('export-db')?.addEventListener('click', exportDatabase);
}

// ========== TABS ==========
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tabName}-tab`));
    
    if (tabName === 'scan') initScanner();
    else stopScanner();
    
    if (tabName === 'database') updateDatabaseTab();
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

async function generateManualQR() {
    const input = document.getElementById('qr-input')?.value.trim();
    if (!input) return showToast('Please enter text or URL');
    if (input.length > 2953) return showToast('Text too long');
    
    try {
        const qrDataUrl = await generateBasicQR(
            input,
            document.getElementById('error-level')?.value || 'M',
            document.getElementById('fg-color')?.value || '#000000',
            '#ffffff'
        );
        
        document.getElementById('qr-display').innerHTML = `<img src="${qrDataUrl}" alt="QR">`;
        document.getElementById('qr-data-preview').textContent = input.length > 50 ? input.substring(0, 50) + '...' : input;
        document.getElementById('qr-result').classList.remove('hidden');
        
        AppState.currentQR = { dataUrl: qrDataUrl, data: input };
        addToHistory(input);
    } catch (e) {
        console.error(e);
        showToast('Error generating QR');
    }
}

function generateBasicQR(text, errorLevel, fgColor, bgColor) {
    return new Promise((resolve, reject) => {
        const container = document.createElement('div');
        container.style.display = 'none';
        document.body.appendChild(container);
        
        try {
            new QRCode(container, {
                text,
                width: 300,
                height: 300,
                colorDark: fgColor,
                colorLight: bgColor,
                correctLevel: QRCode.CorrectLevel[errorLevel]
            });
            
            const check = () => {
                const canvas = container.querySelector('canvas');
                if (canvas?.width > 0) {
                    const url = canvas.toDataURL('image/png');
                    document.body.removeChild(container);
                    resolve(url);
                } else {
                    requestAnimationFrame(check);
                }
            };
            requestAnimationFrame(check);
        } catch (e) {
            document.body.removeChild(container);
            reject(e);
        }
    });
}

// ========== QR ACTIONS ==========
function downloadQR(type) {
    const qr = type === 'db' ? AppState.currentDbQR : AppState.currentQR;
    if (!qr) return;
    
    const link = document.createElement('a');
    link.download = `qr-${Date.now()}.png`;
    link.href = qr.dataUrl;
    link.click();
    showToast('Downloaded!');
}

async function copyQR(type) {
    const qr = type === 'db' ? AppState.currentDbQR : AppState.currentQR;
    if (!qr) return;
    
    try {
        const blob = await (await fetch(qr.dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('Copied!');
    } catch {
        try {
            await navigator.clipboard.writeText(qr.data);
            showToast('Copied text!');
        } catch {
            showToast('Copy failed');
        }
    }
}

function printQR(type) {
    const qr = type === 'db' ? AppState.currentDbQR : AppState.currentQR;
    if (!qr) return;
    
    const w = window.open('', '_blank');
    w.document.write(`
        <!DOCTYPE html><html><head><title>Print QR</title>
        <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:Arial}img{max-width:80%}p{margin-top:20px;color:#666;word-break:break-all;text-align:center;max-width:80%}</style>
        </head><body>
        <img src="${qr.dataUrl}" onload="setTimeout(()=>window.print(),100)">
        <p>${escapeHtml(qr.data)}</p>
        </body></html>
    `);
    w.document.close();
}

// ========== HISTORY ==========
function addToHistory(data) {
    AppState.history = [data, ...AppState.history.filter(i => i !== data)].slice(0, 20);
    saveState();
    updateHistoryUI();
}

function clearHistory() {
    if (!confirm('Clear history?')) return;
    AppState.history = [];
    saveState();
    updateHistoryUI();
    showToast('Cleared');
}

function updateHistoryUI() {
    const list = document.getElementById('history-list');
    if (!list) return;
    
    if (!AppState.history.length) {
        list.innerHTML = '<p class="text-muted">No history yet</p>';
        return;
    }
    
    list.innerHTML = AppState.history.slice(0, 10).map(item => 
        `<div class="history-item" data-value="${escapeHtml(item)}">${item.length > 40 ? item.substring(0, 40) + '...' : item}</div>`
    ).join('');
    
    list.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById('qr-input').value = el.dataset.value;
            updateCharCount();
        });
    });
}

// ========== DATABASE TAB ==========
function updateDatabaseTab() {
    const hasDb = AppState.activeDbId && AppState.databases[AppState.activeDbId];
    
    document.getElementById('no-db-message')?.classList.toggle('hidden', hasDb);
    document.getElementById('db-search-section')?.classList.toggle('hidden', !hasDb);
    
    if (hasDb) {
        const db = AppState.databases[AppState.activeDbId];
        document.getElementById('db-info-text').textContent = `${db.name} • ${db.rows} items`;
    }
}

function handleDatabaseSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const resultsDiv = document.getElementById('search-results');
    const clearBtn = document.getElementById('clear-search');
    const qrResult = document.getElementById('db-qr-result');
    
    // Show/hide clear button
    clearBtn?.classList.toggle('hidden', !query);
    
    // Hide QR when searching
    qrResult?.classList.add('hidden');
    
    if (!query || !AppState.activeDbId) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    const db = AppState.databases[AppState.activeDbId];
    if (!db?.data) return;
    
    const matches = db.data.filter(item =>
        item.label.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        (item.displayText?.toLowerCase().includes(query))
    ).slice(0, 20);
    
    if (!matches.length) {
        resultsDiv.innerHTML = '<div class="no-results">No matches found</div>';
        return;
    }
    
    resultsDiv.innerHTML = matches.map(item => `
        <div class="search-item" data-id="${escapeHtml(item.id)}" data-label="${escapeHtml(item.label)}">
            <div class="search-item-label">${escapeHtml(item.label)}</div>
            <div class="search-item-id">ID: ${escapeHtml(item.id)}${item.displayText ? ' • ' + escapeHtml(item.displayText) : ''}</div>
        </div>
    `).join('');
    
    resultsDiv.querySelectorAll('.search-item').forEach(el => {
        el.addEventListener('click', () => selectDatabaseItem(el.dataset.id, el.dataset.label));
    });
}

function clearSearch() {
    const input = document.getElementById('db-search');
    if (input) input.value = '';
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('clear-search')?.classList.add('hidden');
    document.getElementById('db-qr-result')?.classList.add('hidden');
}

async function selectDatabaseItem(id, label) {
    // Clear search
    document.getElementById('db-search').value = '';
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('clear-search')?.classList.add('hidden');
    
    try {
        const qrDataUrl = await generateBasicQR(id, 'M', '#000000', '#ffffff');
        
        document.getElementById('db-qr-display').innerHTML = `<img src="${qrDataUrl}" alt="QR">`;
        document.getElementById('db-qr-label').textContent = label;
        document.getElementById('db-qr-id').textContent = `ID: ${id}`;
        document.getElementById('db-qr-result').classList.remove('hidden');
        
        AppState.currentDbQR = { dataUrl: qrDataUrl, data: id, label };
        addToHistory(id);
        
        // Scroll to QR
        document.getElementById('db-qr-result').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
        console.error(e);
        showToast('Error generating QR');
    }
}

// ========== SCANNER ==========
async function initScanner() {
    if (AppState.scanner.scanning) return;
    
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videos = devices.filter(d => d.kind === 'videoinput');
        
        const sel = document.getElementById('camera-select');
        if (sel) {
            sel.innerHTML = videos.map((d, i) => 
                `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`
            ).join('');
        }
        
        const back = videos.find(d => d.label.toLowerCase().includes('back'));
        await startCamera(back?.deviceId || videos[0]?.deviceId);
    } catch (e) {
        console.error(e);
        showToast('Camera error');
    }
}

async function startCamera(deviceId) {
    try {
        if (AppState.scanner.stream) {
            AppState.scanner.stream.getTracks().forEach(t => t.stop());
        }
        
        AppState.scanner.stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: deviceId ? { exact: deviceId } : undefined, facingMode: 'environment' }
        });
        
        const video = document.getElementById('scanner-video');
        if (video) video.srcObject = AppState.scanner.stream;
        
        AppState.scanner.scanning = true;
        scanLoop();
    } catch (e) {
        console.error(e);
        showToast('Camera failed');
    }
}

function switchCamera(e) {
    startCamera(e.target.value);
}

function scanLoop() {
    const video = document.getElementById('scanner-video');
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const scan = () => {
        if (!AppState.scanner.scanning) return;
        
        if (video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            
            if (code) {
                handleScanResult(code.data);
            }
        }
        
        AppState.scanner.animationId = requestAnimationFrame(scan);
    };
    scan();
}

function stopScanner() {
    AppState.scanner.scanning = false;
    if (AppState.scanner.animationId) cancelAnimationFrame(AppState.scanner.animationId);
    if (AppState.scanner.stream) {
        AppState.scanner.stream.getTracks().forEach(t => t.stop());
        AppState.scanner.stream = null;
    }
}

function handleScanResult(data) {
    document.getElementById('scan-data').textContent = data;
    document.getElementById('scan-result').classList.remove('hidden');
    AppState.currentScan = data;
    
    AppState.scanHistory = [data, ...AppState.scanHistory.filter(i => i !== data)].slice(0, 20);
    saveState();
    updateScanHistoryUI();
    
    // Flash
    const overlay = document.querySelector('.scanner-overlay');
    if (overlay) {
        overlay.style.background = 'rgba(16, 185, 129, 0.3)';
        setTimeout(() => overlay.style.background = 'transparent', 200);
    }
    
    navigator.vibrate?.(100);
}

async function scanFromImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
        const url = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = e => res(e.target.result);
            r.onerror = rej;
            r.readAsDataURL(file);
        });
        
        const img = await new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = url;
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) handleScanResult(code.data);
        else showToast('No QR found');
    } catch {
        showToast('Error reading image');
    }
    
    e.target.value = '';
}

function updateScanHistoryUI() {
    const list = document.getElementById('scan-history');
    if (!list) return;
    
    if (!AppState.scanHistory.length) {
        list.innerHTML = '<p class="text-muted">No scans yet</p>';
        return;
    }
    
    list.innerHTML = AppState.scanHistory.slice(0, 10).map(item =>
        `<div class="history-item" data-value="${escapeHtml(item)}">${item.length > 50 ? item.substring(0, 50) + '...' : item}</div>`
    ).join('');
    
    list.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById('scan-data').textContent = el.dataset.value;
            document.getElementById('scan-result').classList.remove('hidden');
            AppState.currentScan = el.dataset.value;
        });
    });
}

async function copyScanResult() {
    if (!AppState.currentScan) return;
    try {
        await navigator.clipboard.writeText(AppState.currentScan);
        showToast('Copied!');
    } catch {
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
    document.getElementById('qr-input').value = AppState.currentScan;
    updateCharCount();
    switchTab('generate');
}

// ========== SETTINGS - DATABASE UPLOAD ==========
function setupDatabaseUpload() {
    const input = document.getElementById('db-upload');
    if (!input) return;
    
    input.addEventListener('change', handleFileSelect);
    input.addEventListener('input', handleFileSelect);
}

function handleFileSelect(e) {
    const file = e.target?.files?.[0];
    if (file) {
        handleDatabaseFile(file);
        e.target.value = '';
    }
}

async function handleDatabaseFile(file) {
    const status = document.getElementById('upload-status');
    status.className = 'status';
    status.textContent = '📖 Reading...';
    status.classList.remove('hidden');
    
    try {
        const content = await file.text();
        const name = file.name.replace(/\.[^/.]+$/, '');
        const result = await parseDatabase(content, name);
        
        status.className = 'status success';
        status.textContent = `✓ Loaded ${result.rows} items from ${name}`;
        showToast(`Database loaded: ${result.rows} items`);
        updateSettingsUI();
    } catch (e) {
        console.error(e);
        status.className = 'status error';
        status.textContent = `❌ ${e.message}`;
    }
}

async function parseDatabase(content, name) {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('Need header + data rows');
    
    const delim = content.includes('\t') ? '\t' : ',';
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delim).map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 2 && parts[0] && parts[1]) {
            data.push({ label: parts[0], id: parts[1], displayText: parts[2] || '' });
        }
    }
    
    if (!data.length) throw new Error('No valid data found');
    
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    AppState.databases[id] = { name, data, created: Date.now(), rows: data.length };
    AppState.activeDbId = id;
    saveState();
    
    return { rows: data.length };
}

async function loadDatabaseFromUrl() {
    const url = document.getElementById('db-url')?.value.trim();
    if (!url) return showToast('Enter a URL');
    
    const status = document.getElementById('upload-status');
    status.className = 'status';
    status.textContent = '🌐 Loading...';
    status.classList.remove('hidden');
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const text = await res.text();
        const name = url.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'imported';
        
        // Try JSON first
        try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
                const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
                AppState.databases[id] = {
                    name,
                    data: json.map(i => ({ label: i.label || i.name || '', id: i.id || i.code || '', displayText: i.displayText || '' })),
                    created: Date.now(),
                    rows: json.length
                };
                AppState.activeDbId = id;
                saveState();
                
                status.className = 'status success';
                status.textContent = `✓ Loaded ${json.length} items`;
                updateSettingsUI();
                return;
            }
        } catch {}
        
        // Try CSV
        const result = await parseDatabase(text, name);
        status.className = 'status success';
        status.textContent = `✓ Loaded ${result.rows} items`;
        updateSettingsUI();
    } catch (e) {
        console.error(e);
        status.className = 'status error';
        status.textContent = `❌ ${e.message}`;
    }
}

function updateSettingsUI() {
    const list = document.getElementById('db-list');
    const activeCard = document.getElementById('active-db-card');
    const keys = Object.keys(AppState.databases);
    
    if (!keys.length) {
        list.innerHTML = '<p class="text-muted">No databases loaded</p>';
        activeCard?.classList.add('hidden');
        return;
    }
    
    list.innerHTML = keys.map(id => {
        const db = AppState.databases[id];
        const active = id === AppState.activeDbId;
        return `
            <div class="db-item ${active ? 'active' : ''}" data-id="${id}">
                <div class="db-item-info">
                    <div class="db-item-name">${escapeHtml(db.name)}</div>
                    <div class="db-item-meta">${db.rows} items</div>
                </div>
                <div class="db-item-actions">
                    ${active ? '<span style="color:var(--success)">✓</span>' : `<button class="btn btn-small btn-secondary activate-db" data-id="${id}">Use</button>`}
                    <button class="btn btn-small btn-danger delete-db" data-id="${id}">×</button>
                </div>
            </div>
        `;
    }).join('');
    
    list.querySelectorAll('.activate-db').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            AppState.activeDbId = btn.dataset.id;
            saveState();
            updateSettingsUI();
            showToast('Database activated');
        });
    });
    
    list.querySelectorAll('.delete-db').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (!confirm('Delete this database?')) return;
            delete AppState.databases[btn.dataset.id];
            if (AppState.activeDbId === btn.dataset.id) {
                AppState.activeDbId = Object.keys(AppState.databases)[0] || null;
            }
            saveState();
            updateSettingsUI();
            showToast('Deleted');
        });
    });
    
    if (AppState.activeDbId && AppState.databases[AppState.activeDbId]) {
        const db = AppState.databases[AppState.activeDbId];
        document.getElementById('active-db-name').textContent = db.name;
        document.getElementById('active-db-info').textContent = `${db.rows} items`;
        activeCard?.classList.remove('hidden');
    } else {
        activeCard?.classList.add('hidden');
    }
}

function exportDatabase() {
    if (!AppState.activeDbId) return;
    const db = AppState.databases[AppState.activeDbId];
    const blob = new Blob([JSON.stringify(db.data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${db.name}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Exported');
}

// ========== UI UPDATE ==========
function updateUI() {
    updateHistoryUI();
    updateScanHistoryUI();
    updateSettingsUI();
    updateDatabaseTab();
}

// ========== UTILS ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(msg, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

window.addEventListener('beforeunload', stopScanner);
