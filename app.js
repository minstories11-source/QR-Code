// ========================================
// QR GENERATOR PRO - WITH JSON IMPORT
// Share databases between users
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
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing...');
    await loadState();
    setupEventListeners();
    updateUI();
    updateStorageInfo();
    console.log('Ready!');
});

// ========== STATE ==========
async function loadState() {
    try {
        if (!isLocalStorageAvailable()) {
            console.warn('localStorage not available');
            return;
        }
        
        const saved = localStorage.getItem('qrGeneratorPro');
        
        if (saved) {
            const parsed = JSON.parse(saved);
            AppState.databases = parsed.databases || {};
            AppState.activeDbId = parsed.activeDbId || null;
            AppState.history = parsed.history || [];
            AppState.scanHistory = parsed.scanHistory || [];
            AppState.theme = parsed.theme || 'light';
            
            console.log('Loaded:', Object.keys(AppState.databases).length, 'databases');
        }
        
        applyTheme(AppState.theme);
        
    } catch (e) {
        console.error('Load error:', e);
    }
}

function saveState() {
    try {
        if (!isLocalStorageAvailable()) return;
        
        const data = {
            databases: AppState.databases,
            activeDbId: AppState.activeDbId,
            history: AppState.history,
            scanHistory: AppState.scanHistory,
            theme: AppState.theme
        };
        
        localStorage.setItem('qrGeneratorPro', JSON.stringify(data));
        updateStorageInfo();
        
    } catch (e) {
        console.error('Save error:', e);
        
        if (e.name === 'QuotaExceededError') {
            showToast('Storage full! Try deleting old databases.');
        }
    }
}

function isLocalStorageAvailable() {
    try {
        localStorage.setItem('_test', '1');
        localStorage.removeItem('_test');
        return true;
    } catch { return false; }
}

function updateStorageInfo() {
    const el = document.getElementById('storage-info');
    if (!el) return;
    
    try {
        const data = localStorage.getItem('qrGeneratorPro') || '';
        const bytes = new Blob([data]).size;
        const kb = (bytes / 1024).toFixed(1);
        const mb = (bytes / (1024 * 1024)).toFixed(2);
        
        const dbCount = Object.keys(AppState.databases).length;
        let totalRows = 0;
        Object.values(AppState.databases).forEach(db => {
            totalRows += db.rows || 0;
        });
        
        el.innerHTML = `
            <strong>${dbCount}</strong> database${dbCount !== 1 ? 's' : ''} • 
            <strong>${totalRows}</strong> total entries<br>
            Storage used: <strong>${bytes > 1024 * 1024 ? mb + ' MB' : kb + ' KB'}</strong>
        `;
    } catch {
        el.textContent = 'Unable to calculate';
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
    document.getElementById('start-scanner-btn')?.addEventListener('click', requestCameraPermission);
    
    // Settings tab
    setupDatabaseUpload();
    document.getElementById('load-db-url')?.addEventListener('click', loadDatabaseFromUrl);
    document.getElementById('export-db')?.addEventListener('click', exportAsJSON);
    document.getElementById('export-csv')?.addEventListener('click', exportAsCSV);
    document.getElementById('clear-all-data')?.addEventListener('click', clearAllData);
}

// ========== TABS ==========
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tabName}-tab`));
    
    if (tabName === 'database') updateDatabaseTab();
    else if (tabName === 'scan') showScannerUI();
    else if (tabName === 'settings') updateSettingsUI();
    
    if (tabName !== 'scan') stopScanner();
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
        container.style.cssText = 'position:absolute;left:-9999px;';
        document.body.appendChild(container);
        
        try {
            new QRCode(container, {
                text, width: 300, height: 300,
                colorDark: fgColor, colorLight: bgColor,
                correctLevel: QRCode.CorrectLevel[errorLevel]
            });
            
            let attempts = 0;
            const check = () => {
                const canvas = container.querySelector('canvas');
                if (canvas?.width > 0) {
                    document.body.removeChild(container);
                    resolve(canvas.toDataURL('image/png'));
                } else if (++attempts < 50) {
                    setTimeout(check, 50);
                } else {
                    document.body.removeChild(container);
                    reject(new Error('Timeout'));
                }
            };
            setTimeout(check, 50);
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
    
    const a = document.createElement('a');
    a.download = `qr-${Date.now()}.png`;
    a.href = qr.dataUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Downloaded!');
}

async function copyQR(type) {
    const qr = type === 'db' ? AppState.currentDbQR : AppState.currentQR;
    if (!qr) return;
    
    try {
        if (navigator.clipboard?.write) {
            const blob = await (await fetch(qr.dataUrl)).blob();
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast('Image copied!');
            return;
        }
    } catch {}
    
    try {
        await navigator.clipboard.writeText(qr.data);
        showToast('Text copied!');
    } catch {
        showToast('Copy failed');
    }
}

function printQR(type) {
    const qr = type === 'db' ? AppState.currentDbQR : AppState.currentQR;
    if (!qr) return;
    
    const w = window.open('', '_blank');
    if (!w) return showToast('Allow popups');
    
    w.document.write(`<!DOCTYPE html><html><head><title>Print</title>
        <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:Arial}img{max-width:80%}p{margin-top:20px;color:#666;word-break:break-all;text-align:center;max-width:80%}</style>
        </head><body><img src="${qr.dataUrl}" onload="setTimeout(()=>window.print(),500)"><p>${escapeHtml(qr.data)}</p></body></html>`);
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
    const hasDb = !!(AppState.activeDbId && AppState.databases[AppState.activeDbId]);
    
    const noDbMsg = document.getElementById('no-db-message');
    const searchSection = document.getElementById('db-search-section');
    
    if (noDbMsg) noDbMsg.style.display = hasDb ? 'none' : 'block';
    if (searchSection) searchSection.style.display = hasDb ? 'block' : 'none';
    
    if (hasDb) {
        const db = AppState.databases[AppState.activeDbId];
        const info = document.getElementById('db-info-text');
        if (info) info.textContent = `${db.name} • ${db.rows} items`;
    }
}

function handleDatabaseSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const resultsDiv = document.getElementById('search-results');
    const clearBtn = document.getElementById('clear-search');
    const qrResult = document.getElementById('db-qr-result');
    
    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
    if (qrResult) qrResult.style.display = 'none';
    
    if (!query || !AppState.activeDbId) {
        if (resultsDiv) resultsDiv.innerHTML = '';
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
    
    const results = document.getElementById('search-results');
    if (results) results.innerHTML = '';
    
    document.getElementById('clear-search').style.display = 'none';
    document.getElementById('db-qr-result').style.display = 'none';
}

async function selectDatabaseItem(id, label) {
    clearSearch();
    
    try {
        const qrDataUrl = await generateBasicQR(id, 'M', '#000000', '#ffffff');
        
        document.getElementById('db-qr-display').innerHTML = `<img src="${qrDataUrl}" alt="QR">`;
        document.getElementById('db-qr-label').textContent = label;
        document.getElementById('db-qr-id').textContent = `ID: ${id}`;
        document.getElementById('db-qr-result').style.display = 'block';
        
        AppState.currentDbQR = { dataUrl: qrDataUrl, data: id, label };
        addToHistory(id);
        
        document.getElementById('db-qr-result').scrollIntoView({ behavior: 'smooth' });
        
    } catch (e) {
        console.error(e);
        showToast('Error generating QR');
    }
}

// ========== SCANNER ==========
function showScannerUI() {
    const startBtn = document.getElementById('start-scanner-btn');
    const statusEl = document.getElementById('scanner-status');
    
    if (AppState.scanner.scanning) {
        if (startBtn) startBtn.style.display = 'none';
        return;
    }
    
    if (startBtn) startBtn.style.display = 'block';
    if (statusEl) statusEl.textContent = 'Tap to start camera';
}

async function requestCameraPermission() {
    const startBtn = document.getElementById('start-scanner-btn');
    const statusEl = document.getElementById('scanner-status');
    
    if (startBtn) startBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = 'Requesting camera...';
    
    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Camera not supported');
        }
        
        const testStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        testStream.getTracks().forEach(t => t.stop());
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        const selector = document.getElementById('camera-select');
        if (selector) {
            selector.innerHTML = videoDevices.map((d, i) => 
                `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`
            ).join('');
        }
        
        const backCam = videoDevices.find(d => /back|rear|environment/i.test(d.label));
        await startScanner(backCam?.deviceId || videoDevices[0]?.deviceId);
        
    } catch (e) {
        console.error(e);
        let msg = e.message;
        if (e.name === 'NotAllowedError') msg = 'Camera permission denied';
        if (statusEl) statusEl.textContent = msg;
        if (startBtn) startBtn.style.display = 'block';
        showToast(msg);
    }
}

async function startScanner(deviceId) {
    const statusEl = document.getElementById('scanner-status');
    
    try {
        if (AppState.scanner.stream) {
            AppState.scanner.stream.getTracks().forEach(t => t.stop());
        }
        
        const constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
        if (deviceId) constraints.video.deviceId = { exact: deviceId };
        else constraints.video.facingMode = { ideal: 'environment' };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        AppState.scanner.stream = stream;
        
        const video = document.getElementById('scanner-video');
        video.srcObject = stream;
        video.setAttribute('playsinline', '');
        video.muted = true;
        
        await new Promise((res, rej) => {
            video.onloadedmetadata = res;
            video.onerror = rej;
            setTimeout(() => rej(new Error('Timeout')), 10000);
        });
        
        await video.play();
        
        if (statusEl) statusEl.textContent = '';
        document.getElementById('start-scanner-btn').style.display = 'none';
        
        AppState.scanner.scanning = true;
        startScanLoop();
        
    } catch (e) {
        throw e;
    }
}

function switchCamera(e) {
    if (e.target.value) startScanner(e.target.value);
}

function startScanLoop() {
    const video = document.getElementById('scanner-video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let lastScan = 0;
    
    function scan() {
        if (!AppState.scanner.scanning) return;
        
        const now = Date.now();
        if (now - lastScan >= 250 && video.readyState >= 2 && video.videoWidth) {
            lastScan = now;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
                if (code?.data) handleScanResult(code.data);
            } catch {}
        }
        
        AppState.scanner.animationId = requestAnimationFrame(scan);
    }
    scan();
}

function stopScanner() {
    AppState.scanner.scanning = false;
    if (AppState.scanner.animationId) cancelAnimationFrame(AppState.scanner.animationId);
    if (AppState.scanner.stream) {
        AppState.scanner.stream.getTracks().forEach(t => t.stop());
        AppState.scanner.stream = null;
    }
    const video = document.getElementById('scanner-video');
    if (video) video.srcObject = null;
}

let lastScanned = '', lastScanTime = 0;

function handleScanResult(data) {
    if (data === lastScanned && Date.now() - lastScanTime < 2000) return;
    lastScanned = data;
    lastScanTime = Date.now();
    
    document.getElementById('scan-data').textContent = data;
    document.getElementById('scan-result').style.display = 'block';
    AppState.currentScan = data;
    
    AppState.scanHistory = [data, ...AppState.scanHistory.filter(i => i !== data)].slice(0, 20);
    saveState();
    updateScanHistoryUI();
    
    const overlay = document.querySelector('.scanner-overlay');
    if (overlay) {
        overlay.style.background = 'rgba(16,185,129,0.5)';
        setTimeout(() => overlay.style.background = 'transparent', 300);
    }
    
    navigator.vibrate?.([100]);
    document.getElementById('scan-result')?.scrollIntoView({ behavior: 'smooth' });
}

async function scanFromImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
        const dataUrl = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(file);
        });
        
        const img = await new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = dataUrl;
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code?.data) handleScanResult(code.data);
        else showToast('No QR found');
        
    } catch { showToast('Error reading image'); }
    
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
            document.getElementById('scan-result').style.display = 'block';
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

// ========================================
// DATABASE IMPORT/EXPORT - JSON + CSV
// ========================================

function setupDatabaseUpload() {
    const dropZone = document.getElementById('db-drop-zone');
    const fileInput = document.getElementById('db-upload');
    
    if (!fileInput) return;
    
    ['change', 'input'].forEach(evt => {
        fileInput.addEventListener(evt, handleFileSelect);
    });
    
    if (dropZone) {
        dropZone.addEventListener('click', e => {
            if (e.target !== fileInput) fileInput.click();
        });
        
        dropZone.addEventListener('touchend', e => {
            e.preventDefault();
            fileInput.click();
        });
        
        dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer?.files?.[0]) processFile(e.dataTransfer.files[0]);
        });
    }
}

function handleFileSelect(e) {
    const file = e.target?.files?.[0];
    if (file) {
        processFile(file);
        setTimeout(() => e.target.value = '', 100);
    }
}

async function processFile(file) {
    const status = document.getElementById('upload-status');
    const fileName = file.name.toLowerCase();
    
    if (status) {
        status.className = 'status';
        status.textContent = '📖 Reading file...';
        status.style.display = 'block';
    }
    
    try {
        const text = await file.text();
        const name = file.name.replace(/\.[^/.]+$/, '');
        
        let result;
        
        // Detect file type
        if (fileName.endsWith('.json')) {
            result = await importJSON(text, name);
        } else {
            result = await parseCSV(text, name);
        }
        
        if (status) {
            status.className = 'status success';
            status.textContent = `✓ Imported ${result.rows} items from "${result.name}"`;
        }
        
        showToast(`Imported ${result.rows} items`);
        updateSettingsUI();
        updateDatabaseTab();
        
    } catch (err) {
        console.error('Import error:', err);
        if (status) {
            status.className = 'status error';
            status.textContent = `❌ ${err.message}`;
        }
        showToast('Error: ' + err.message);
    }
}

// ========== JSON IMPORT ==========
async function importJSON(text, defaultName) {
    let json;
    
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error('Invalid JSON file');
    }
    
    let data = [];
    let name = defaultName;
    
    // Handle different JSON formats
    
    // Format 1: Direct array of items
    // [{"label": "...", "id": "..."}, ...]
    if (Array.isArray(json)) {
        data = json.map(item => normalizeItem(item));
    }
    
    // Format 2: Object with data array (our export format)
    // {"name": "...", "data": [...], "rows": ...}
    else if (json.data && Array.isArray(json.data)) {
        name = json.name || defaultName;
        data = json.data.map(item => normalizeItem(item));
    }
    
    // Format 3: Object with items array
    // {"items": [...]}
    else if (json.items && Array.isArray(json.items)) {
        data = json.items.map(item => normalizeItem(item));
    }
    
    // Format 4: Object with entries array
    // {"entries": [...]}
    else if (json.entries && Array.isArray(json.entries)) {
        data = json.entries.map(item => normalizeItem(item));
    }
    
    else {
        throw new Error('Unrecognized JSON format. Expected array or object with data/items/entries array.');
    }
    
    // Filter out invalid entries
    data = data.filter(item => item.label && item.id);
    
    if (data.length === 0) {
        throw new Error('No valid entries found. Each item needs "label" and "id" fields.');
    }
    
    // Save to state
    const dbId = generateId();
    
    AppState.databases[dbId] = {
        name: name,
        data: data,
        created: Date.now(),
        rows: data.length
    };
    
    AppState.activeDbId = dbId;
    saveState();
    
    console.log('JSON imported:', name, data.length, 'items');
    
    return { rows: data.length, name: name };
}

function normalizeItem(item) {
    return {
        label: item.label || item.name || item.title || item.Label || item.Name || '',
        id: item.id || item.code || item.ID || item.Code || item.Id || '',
        displayText: item.displayText || item.description || item.desc || item.DisplayText || item.Description || ''
    };
}

// ========== CSV IMPORT ==========
async function parseCSV(content, name) {
    const lines = content.split('\n').filter(l => l.trim());
    
    if (lines.length < 2) {
        throw new Error('File needs header row + at least 1 data row');
    }
    
    const delim = content.includes('\t') ? '\t' : ',';
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i], delim);
        
        if (parts.length >= 2 && parts[0] && parts[1]) {
            data.push({
                label: parts[0],
                id: parts[1],
                displayText: parts[2] || ''
            });
        }
    }
    
    if (data.length === 0) {
        throw new Error('No valid data. Format: Label,ID,Description');
    }
    
    const dbId = generateId();
    
    AppState.databases[dbId] = {
        name: name,
        data: data,
        created: Date.now(),
        rows: data.length
    };
    
    AppState.activeDbId = dbId;
    saveState();
    
    return { rows: data.length, name: name };
}

function parseCSVLine(line, delim) {
    // Handle quoted fields
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
            parts.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }
    
    parts.push(current.trim().replace(/^"|"$/g, ''));
    
    return parts;
}

// ========== EXPORT FUNCTIONS ==========
function exportAsJSON() {
    if (!AppState.activeDbId) return showToast('No database selected');
    
    const db = AppState.databases[AppState.activeDbId];
    
    // Export full database object (can be re-imported)
    const exportData = {
        name: db.name,
        exported: new Date().toISOString(),
        rows: db.data.length,
        data: db.data
    };
    
    const json = JSON.stringify(exportData, null, 2);
    downloadFile(json, `${db.name}.json`, 'application/json');
    
    showToast('JSON exported - can be shared & imported');
}

function exportAsCSV() {
    if (!AppState.activeDbId) return showToast('No database selected');
    
    const db = AppState.databases[AppState.activeDbId];
    
    // Create CSV with header
    let csv = 'Label,ID,Description\n';
    
    db.data.forEach(item => {
        const label = escapeCSV(item.label);
        const id = escapeCSV(item.id);
        const desc = escapeCSV(item.displayText || '');
        csv += `${label},${id},${desc}\n`;
    });
    
    downloadFile(csv, `${db.name}.csv`, 'text/csv');
    
    showToast('CSV exported');
}

function escapeCSV(str) {
    if (!str) return '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
}

// ========== LOAD FROM URL ==========
async function loadDatabaseFromUrl() {
    const url = document.getElementById('db-url')?.value.trim();
    if (!url) return showToast('Enter a URL');
    
    const status = document.getElementById('upload-status');
    if (status) {
        status.className = 'status';
        status.textContent = '🌐 Loading...';
        status.style.display = 'block';
    }
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const text = await res.text();
        const name = url.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'imported';
        
        let result;
        
        // Try JSON first
        try {
            result = await importJSON(text, name);
        } catch {
            // Try CSV
            result = await parseCSV(text, name);
        }
        
        if (status) {
            status.className = 'status success';
            status.textContent = `✓ Loaded ${result.rows} items`;
        }
        
        updateSettingsUI();
        updateDatabaseTab();
        
    } catch (err) {
        console.error(err);
        if (status) {
            status.className = 'status error';
            status.textContent = `❌ ${err.message}`;
        }
    }
}

// ========== SETTINGS UI ==========
function updateSettingsUI() {
    const list = document.getElementById('db-list');
    const activeCard = document.getElementById('active-db-card');
    const keys = Object.keys(AppState.databases);
    
    if (!list) return;
    
    if (keys.length === 0) {
        list.innerHTML = '<p class="text-muted">No databases loaded</p>';
        if (activeCard) activeCard.style.display = 'none';
        return;
    }
    
    list.innerHTML = keys.map(id => {
        const db = AppState.databases[id];
        const isActive = id === AppState.activeDbId;
        const date = new Date(db.created).toLocaleDateString();
        
        return `
            <div class="db-item ${isActive ? 'active' : ''}" data-id="${id}">
                <div class="db-item-info">
                    <div class="db-item-name">${escapeHtml(db.name)}</div>
                    <div class="db-item-meta">${db.rows} items • ${date}</div>
                </div>
                <div class="db-item-actions">
                    ${isActive 
                        ? '<span style="color:var(--success)">✓ Active</span>' 
                        : `<button class="btn btn-small btn-secondary activate-db" data-id="${id}">Use</button>`}
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
            updateDatabaseTab();
            showToast('Activated');
        });
    });
    
    list.querySelectorAll('.delete-db').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const db = AppState.databases[btn.dataset.id];
            if (!confirm(`Delete "${db.name}"?`)) return;
            
            delete AppState.databases[btn.dataset.id];
            if (AppState.activeDbId === btn.dataset.id) {
                AppState.activeDbId = Object.keys(AppState.databases)[0] || null;
            }
            saveState();
            updateSettingsUI();
            updateDatabaseTab();
            showToast('Deleted');
        });
    });
    
    if (AppState.activeDbId && AppState.databases[AppState.activeDbId]) {
        const db = AppState.databases[AppState.activeDbId];
        document.getElementById('active-db-name').textContent = db.name;
        document.getElementById('active-db-info').textContent = `${db.rows} items • Created ${new Date(db.created).toLocaleDateString()}`;
        if (activeCard) activeCard.style.display = 'block';
    } else {
        if (activeCard) activeCard.style.display = 'none';
    }
    
    updateStorageInfo();
}

function clearAllData() {
    if (!confirm('Delete ALL data including databases, history, and settings?')) return;
    if (!confirm('Are you sure? This cannot be undone.')) return;
    
    localStorage.removeItem('qrGeneratorPro');
    
    AppState.databases = {};
    AppState.activeDbId = null;
    AppState.history = [];
    AppState.scanHistory = [];
    
    updateUI();
    showToast('All data cleared');
}

// ========== UI ==========
function updateUI() {
    updateHistoryUI();
    updateScanHistoryUI();
    updateSettingsUI();
    updateDatabaseTab();
    updateStorageInfo();
}

// ========== UTILS ==========
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', duration);
}

// Cleanup
window.addEventListener('beforeunload', stopScanner);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopScanner(); });

console.log('App loaded');
