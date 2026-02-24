// ========================================
// QR GENERATOR PRO - SAFARI FIXED
// Database + Scanner for iOS Safari
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
    console.log('Ready!');
});

// ========== STATE - SAFARI FIXED ==========
async function loadState() {
    try {
        // Check if localStorage is available
        if (!isLocalStorageAvailable()) {
            console.warn('localStorage not available, using memory only');
            return;
        }
        
        const saved = localStorage.getItem('qrGeneratorPro');
        console.log('Raw saved data:', saved ? saved.substring(0, 100) + '...' : 'null');
        
        if (saved) {
            const parsed = JSON.parse(saved);
            console.log('Parsed state:', {
                dbCount: Object.keys(parsed.databases || {}).length,
                activeDbId: parsed.activeDbId
            });
            
            AppState.databases = parsed.databases || {};
            AppState.activeDbId = parsed.activeDbId || null;
            AppState.history = parsed.history || [];
            AppState.scanHistory = parsed.scanHistory || [];
            AppState.theme = parsed.theme || 'light';
        }
        
        applyTheme(AppState.theme);
        
    } catch (e) {
        console.error('Load state error:', e);
    }
}

function saveState() {
    try {
        if (!isLocalStorageAvailable()) {
            console.warn('Cannot save - localStorage not available');
            return;
        }
        
        const data = {
            databases: AppState.databases,
            activeDbId: AppState.activeDbId,
            history: AppState.history,
            scanHistory: AppState.scanHistory,
            theme: AppState.theme
        };
        
        const json = JSON.stringify(data);
        localStorage.setItem('qrGeneratorPro', json);
        console.log('State saved, size:', json.length, 'bytes');
        
    } catch (e) {
        console.error('Save state error:', e);
        
        // If quota exceeded, try clearing old data
        if (e.name === 'QuotaExceededError') {
            console.log('Storage quota exceeded, clearing history...');
            AppState.history = AppState.history.slice(0, 5);
            AppState.scanHistory = AppState.scanHistory.slice(0, 5);
            try {
                localStorage.setItem('qrGeneratorPro', JSON.stringify({
                    databases: AppState.databases,
                    activeDbId: AppState.activeDbId,
                    history: AppState.history,
                    scanHistory: AppState.scanHistory,
                    theme: AppState.theme
                }));
            } catch (e2) {
                console.error('Still cannot save:', e2);
            }
        }
    }
}

function isLocalStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
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
    document.getElementById('export-db')?.addEventListener('click', exportDatabase);
}

// ========== TABS ==========
function switchTab(tabName) {
    console.log('Switching to:', tabName);
    
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tabName}-tab`));
    
    if (tabName === 'database') {
        updateDatabaseTab();
    } else if (tabName === 'scan') {
        showScannerUI();
    } else if (tabName === 'settings') {
        updateSettingsUI();
    }
    
    // Stop scanner when leaving scan tab
    if (tabName !== 'scan') {
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

async function generateManualQR() {
    const input = document.getElementById('qr-input')?.value.trim();
    if (!input) return showToast('Please enter text or URL');
    if (input.length > 2953) return showToast('Text too long');
    
    try {
        showToast('Generating...');
        
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
        console.error('QR generation error:', e);
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
                text: text,
                width: 300,
                height: 300,
                colorDark: fgColor,
                colorLight: bgColor,
                correctLevel: QRCode.CorrectLevel[errorLevel]
            });
            
            let attempts = 0;
            const maxAttempts = 50;
            
            const check = () => {
                attempts++;
                const canvas = container.querySelector('canvas');
                
                if (canvas && canvas.width > 0) {
                    const url = canvas.toDataURL('image/png');
                    document.body.removeChild(container);
                    resolve(url);
                } else if (attempts < maxAttempts) {
                    setTimeout(check, 50);
                } else {
                    document.body.removeChild(container);
                    reject(new Error('QR generation timeout'));
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
    
    // Safari-friendly download
    const link = document.createElement('a');
    link.download = `qr-${Date.now()}.png`;
    link.href = qr.dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Downloaded!');
}

async function copyQR(type) {
    const qr = type === 'db' ? AppState.currentDbQR : AppState.currentQR;
    if (!qr) return;
    
    try {
        // Try clipboard API first
        if (navigator.clipboard && navigator.clipboard.write) {
            const blob = await (await fetch(qr.dataUrl)).blob();
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast('Image copied!');
            return;
        }
    } catch (e) {
        console.log('Clipboard image copy failed:', e);
    }
    
    // Fallback: copy text
    try {
        await navigator.clipboard.writeText(qr.data);
        showToast('Text copied!');
    } catch (e) {
        // Final fallback
        const textarea = document.createElement('textarea');
        textarea.value = qr.data;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied!');
    }
}

function printQR(type) {
    const qr = type === 'db' ? AppState.currentDbQR : AppState.currentQR;
    if (!qr) return;
    
    const w = window.open('', '_blank');
    if (!w) {
        showToast('Please allow popups');
        return;
    }
    
    w.document.write(`
        <!DOCTYPE html>
        <html>
        <head><title>Print QR</title>
        <style>
            body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; font-family:Arial,sans-serif; }
            img { max-width:80%; max-height:60vh; }
            p { margin-top:20px; color:#666; word-break:break-all; text-align:center; max-width:80%; }
        </style>
        </head>
        <body>
        <img src="${qr.dataUrl}" onload="setTimeout(function(){window.print();},500)">
        <p>${escapeHtml(qr.data)}</p>
        </body>
        </html>
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
    console.log('updateDatabaseTab called');
    console.log('activeDbId:', AppState.activeDbId);
    console.log('databases:', Object.keys(AppState.databases));
    
    const hasDb = !!(AppState.activeDbId && AppState.databases[AppState.activeDbId]);
    console.log('hasDb:', hasDb);
    
    const noDbMsg = document.getElementById('no-db-message');
    const searchSection = document.getElementById('db-search-section');
    
    if (noDbMsg) {
        noDbMsg.style.display = hasDb ? 'none' : 'block';
    }
    
    if (searchSection) {
        searchSection.style.display = hasDb ? 'block' : 'none';
    }
    
    if (hasDb) {
        const db = AppState.databases[AppState.activeDbId];
        const infoText = document.getElementById('db-info-text');
        if (infoText) {
            infoText.textContent = `${db.name} • ${db.rows} items`;
        }
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
    
    const clearBtn = document.getElementById('clear-search');
    if (clearBtn) clearBtn.style.display = 'none';
    
    const qrResult = document.getElementById('db-qr-result');
    if (qrResult) qrResult.style.display = 'none';
}

async function selectDatabaseItem(id, label) {
    clearSearch();
    
    try {
        showToast('Generating QR...');
        
        const qrDataUrl = await generateBasicQR(id, 'M', '#000000', '#ffffff');
        
        const display = document.getElementById('db-qr-display');
        const labelEl = document.getElementById('db-qr-label');
        const idEl = document.getElementById('db-qr-id');
        const result = document.getElementById('db-qr-result');
        
        if (display) display.innerHTML = `<img src="${qrDataUrl}" alt="QR">`;
        if (labelEl) labelEl.textContent = label;
        if (idEl) idEl.textContent = `ID: ${id}`;
        if (result) result.style.display = 'block';
        
        AppState.currentDbQR = { dataUrl: qrDataUrl, data: id, label };
        addToHistory(id);
        
        result?.scrollIntoView({ behavior: 'smooth' });
        
    } catch (e) {
        console.error('Error:', e);
        showToast('Error generating QR');
    }
}

// ========================================
// SCANNER - SAFARI/iOS COMPATIBLE
// ========================================

function showScannerUI() {
    const startBtn = document.getElementById('start-scanner-btn');
    const statusEl = document.getElementById('scanner-status');
    
    if (AppState.scanner.scanning) {
        if (startBtn) startBtn.style.display = 'none';
        if (statusEl) statusEl.textContent = 'Camera active';
        return;
    }
    
    if (startBtn) startBtn.style.display = 'block';
    if (statusEl) statusEl.textContent = 'Tap button to start camera';
}

async function requestCameraPermission() {
    const startBtn = document.getElementById('start-scanner-btn');
    const statusEl = document.getElementById('scanner-status');
    
    if (startBtn) startBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = 'Requesting camera access...';
    
    try {
        // Check support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera not supported in this browser. Try Chrome or Safari.');
        }
        
        // First request permission with simple constraints
        console.log('Requesting camera permission...');
        
        const testStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' },
            audio: false 
        });
        
        // Got permission, stop test stream
        testStream.getTracks().forEach(t => t.stop());
        console.log('Permission granted');
        
        // Now enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        console.log('Found cameras:', videoDevices.length);
        
        if (videoDevices.length === 0) {
            throw new Error('No camera found');
        }
        
        // Update selector
        const selector = document.getElementById('camera-select');
        if (selector) {
            selector.innerHTML = videoDevices.map((d, i) => {
                const label = d.label || `Camera ${i + 1}`;
                return `<option value="${d.deviceId}">${label}</option>`;
            }).join('');
        }
        
        // Find back camera
        const backCamera = videoDevices.find(d => {
            const label = d.label.toLowerCase();
            return label.includes('back') || label.includes('rear') || label.includes('environment');
        });
        
        // Start with preferred camera
        await startScanner(backCamera?.deviceId || videoDevices[0]?.deviceId);
        
    } catch (e) {
        console.error('Camera error:', e);
        
        let msg = e.message || 'Camera error';
        
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            msg = 'Camera permission denied. Please allow camera access in your browser settings.';
        } else if (e.name === 'NotFoundError') {
            msg = 'No camera found on this device.';
        } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
            msg = 'Camera is busy. Close other apps using the camera.';
        } else if (e.name === 'OverconstrainedError') {
            msg = 'Camera not compatible. Trying alternative...';
            // Try again with simpler constraints
            try {
                await startScannerSimple();
                return;
            } catch (e2) {
                msg = 'Camera not compatible with this browser.';
            }
        }
        
        if (statusEl) statusEl.textContent = msg;
        if (startBtn) startBtn.style.display = 'block';
        showToast(msg);
    }
}

async function startScannerSimple() {
    // Fallback with minimal constraints
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    await setupVideoStream(stream);
}

async function startScanner(deviceId) {
    const statusEl = document.getElementById('scanner-status');
    
    try {
        if (statusEl) statusEl.textContent = 'Starting camera...';
        
        // Stop existing stream
        if (AppState.scanner.stream) {
            AppState.scanner.stream.getTracks().forEach(t => t.stop());
            AppState.scanner.stream = null;
        }
        
        // Safari-friendly constraints
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        
        if (deviceId) {
            constraints.video.deviceId = { exact: deviceId };
        } else {
            constraints.video.facingMode = { ideal: 'environment' };
        }
        
        console.log('Starting camera with:', JSON.stringify(constraints));
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        await setupVideoStream(stream);
        
    } catch (e) {
        console.error('startScanner error:', e);
        throw e;
    }
}

async function setupVideoStream(stream) {
    const video = document.getElementById('scanner-video');
    const statusEl = document.getElementById('scanner-status');
    const startBtn = document.getElementById('start-scanner-btn');
    
    if (!video) throw new Error('Video element not found');
    
    AppState.scanner.stream = stream;
    
    // Safari needs these attributes
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.muted = true;
    
    video.srcObject = stream;
    
    // Wait for video to be ready
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video timeout')), 10000);
        
        video.onloadedmetadata = () => {
            clearTimeout(timeout);
            console.log('Video ready:', video.videoWidth, 'x', video.videoHeight);
            resolve();
        };
        
        video.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Video error'));
        };
    });
    
    // Play video (required for Safari)
    try {
        await video.play();
        console.log('Video playing');
    } catch (e) {
        console.error('Video play error:', e);
        throw new Error('Could not start video. Please try again.');
    }
    
    if (statusEl) statusEl.textContent = '';
    if (startBtn) startBtn.style.display = 'none';
    
    // Start scanning
    AppState.scanner.scanning = true;
    startScanLoop();
}

function switchCamera(e) {
    if (e.target.value) {
        startScanner(e.target.value);
    }
}

function startScanLoop() {
    const video = document.getElementById('scanner-video');
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    let lastScan = 0;
    
    function scan() {
        if (!AppState.scanner.scanning) return;
        
        const now = Date.now();
        
        // Scan every 250ms
        if (now - lastScan >= 250 && video.readyState >= 2 && video.videoWidth > 0) {
            lastScan = now;
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert'
                });
                
                if (code?.data) {
                    handleScanResult(code.data);
                }
            } catch (e) {
                // Ignore scan errors
            }
        }
        
        AppState.scanner.animationId = requestAnimationFrame(scan);
    }
    
    console.log('Scan loop started');
    scan();
}

function stopScanner() {
    AppState.scanner.scanning = false;
    
    if (AppState.scanner.animationId) {
        cancelAnimationFrame(AppState.scanner.animationId);
        AppState.scanner.animationId = null;
    }
    
    if (AppState.scanner.stream) {
        AppState.scanner.stream.getTracks().forEach(t => {
            t.stop();
            console.log('Track stopped');
        });
        AppState.scanner.stream = null;
    }
    
    const video = document.getElementById('scanner-video');
    if (video) video.srcObject = null;
}

let lastScannedData = '';
let lastScanTime = 0;

function handleScanResult(data) {
    const now = Date.now();
    
    // Prevent duplicate scans within 2 seconds
    if (data === lastScannedData && now - lastScanTime < 2000) {
        return;
    }
    
    lastScannedData = data;
    lastScanTime = now;
    
    console.log('Scanned:', data);
    
    // Update UI
    const scanDataEl = document.getElementById('scan-data');
    const scanResult = document.getElementById('scan-result');
    
    if (scanDataEl) scanDataEl.textContent = data;
    if (scanResult) scanResult.style.display = 'block';
    
    AppState.currentScan = data;
    
    // Save to history
    AppState.scanHistory = [data, ...AppState.scanHistory.filter(i => i !== data)].slice(0, 20);
    saveState();
    updateScanHistoryUI();
    
    // Visual feedback
    const overlay = document.querySelector('.scanner-overlay');
    if (overlay) {
        overlay.style.background = 'rgba(16, 185, 129, 0.5)';
        setTimeout(() => { overlay.style.background = 'transparent'; }, 300);
    }
    
    // Vibrate
    if (navigator.vibrate) {
        navigator.vibrate([100]);
    }
    
    // Scroll to result
    scanResult?.scrollIntoView({ behavior: 'smooth' });
}

async function scanFromImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
        showToast('Scanning image...');
        
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        
        const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = dataUrl;
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code?.data) {
            handleScanResult(code.data);
        } else {
            showToast('No QR code found in image');
        }
        
    } catch (err) {
        console.error('Image scan error:', err);
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
        const textarea = document.createElement('textarea');
        textarea.value = AppState.currentScan;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied!');
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
// SETTINGS - DATABASE UPLOAD (SAFARI FIXED)
// ========================================

function setupDatabaseUpload() {
    const dropZone = document.getElementById('db-drop-zone');
    const fileInput = document.getElementById('db-upload');
    
    if (!fileInput) return;
    
    // Multiple listeners for Safari compatibility
    ['change', 'input'].forEach(event => {
        fileInput.addEventListener(event, handleFileSelect);
    });
    
    if (dropZone) {
        // Make entire zone clickable
        dropZone.addEventListener('click', (e) => {
            if (e.target !== fileInput) {
                fileInput.click();
            }
        });
        
        // Touch support
        dropZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            fileInput.click();
        });
        
        // Drag and drop
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
                processFile(e.dataTransfer.files[0]);
            }
        });
    }
}

function handleFileSelect(e) {
    const file = e.target?.files?.[0];
    if (file) {
        processFile(file);
        setTimeout(() => { e.target.value = ''; }, 100);
    }
}

async function processFile(file) {
    console.log('Processing file:', file.name);
    
    const status = document.getElementById('upload-status');
    if (status) {
        status.className = 'status';
        status.textContent = '📖 Reading file...';
        status.style.display = 'block';
    }
    
    try {
        const text = await file.text();
        const name = file.name.replace(/\.[^/.]+$/, '');
        
        console.log('File content length:', text.length);
        
        const result = await parseDatabase(text, name);
        
        if (status) {
            status.className = 'status success';
            status.textContent = `✓ Loaded ${result.rows} items from ${name}`;
        }
        
        showToast(`Loaded ${result.rows} items`);
        updateSettingsUI();
        updateDatabaseTab();
        
    } catch (err) {
        console.error('File processing error:', err);
        if (status) {
            status.className = 'status error';
            status.textContent = `❌ ${err.message}`;
        }
        showToast('Error: ' + err.message);
    }
}

async function parseDatabase(content, name) {
    const lines = content.split('\n').filter(l => l.trim());
    
    if (lines.length < 2) {
        throw new Error('File needs at least a header and one data row');
    }
    
    const delim = content.includes('\t') ? '\t' : ',';
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delim).map(p => p.trim().replace(/^"|"$/g, ''));
        
        if (parts.length >= 2 && parts[0] && parts[1]) {
            data.push({
                label: parts[0],
                id: parts[1],
                displayText: parts[2] || ''
            });
        }
    }
    
    if (data.length === 0) {
        throw new Error('No valid data found. Format: Label,ID,Description');
    }
    
    const dbId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    AppState.databases[dbId] = {
        name: name,
        data: data,
        created: Date.now(),
        rows: data.length
    };
    
    AppState.activeDbId = dbId;
    saveState();
    
    console.log('Database saved:', dbId, data.length, 'rows');
    
    return { rows: data.length };
}

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
        
        // Try JSON
        try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
                const dbId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                
                AppState.databases[dbId] = {
                    name: name,
                    data: json.map(item => ({
                        label: item.label || item.name || '',
                        id: item.id || item.code || '',
                        displayText: item.displayText || item.description || ''
                    })),
                    created: Date.now(),
                    rows: json.length
                };
                
                AppState.activeDbId = dbId;
                saveState();
                
                if (status) {
                    status.className = 'status success';
                    status.textContent = `✓ Loaded ${json.length} items`;
                }
                
                updateSettingsUI();
                updateDatabaseTab();
                return;
            }
        } catch {}
        
        // Try CSV
        const result = await parseDatabase(text, name);
        
        if (status) {
            status.className = 'status success';
            status.textContent = `✓ Loaded ${result.rows} items`;
        }
        
        updateSettingsUI();
        updateDatabaseTab();
        
    } catch (err) {
        console.error('URL error:', err);
        if (status) {
            status.className = 'status error';
            status.textContent = `❌ ${err.message}`;
        }
    }
}

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
        return `
            <div class="db-item ${isActive ? 'active' : ''}" data-id="${id}">
                <div class="db-item-info">
                    <div class="db-item-name">${escapeHtml(db.name)}</div>
                    <div class="db-item-meta">${db.rows} items</div>
                </div>
                <div class="db-item-actions">
                    ${isActive 
                        ? '<span style="color:var(--success)">✓</span>' 
                        : `<button class="btn btn-small btn-secondary activate-db" data-id="${id}">Use</button>`}
                    <button class="btn btn-small btn-danger delete-db" data-id="${id}">×</button>
                </div>
            </div>
        `;
    }).join('');
    
    list.querySelectorAll('.activate-db').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            AppState.activeDbId = btn.dataset.id;
            saveState();
            updateSettingsUI();
            updateDatabaseTab();
            showToast('Database activated');
        });
    });
    
    list.querySelectorAll('.delete-db').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm('Delete?')) return;
            
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
        document.getElementById('active-db-info').textContent = `${db.rows} items`;
        if (activeCard) activeCard.style.display = 'block';
    } else {
        if (activeCard) activeCard.style.display = 'none';
    }
}

function exportDatabase() {
    if (!AppState.activeDbId) return;
    
    const db = AppState.databases[AppState.activeDbId];
    const blob = new Blob([JSON.stringify(db.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${db.name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Exported');
}

// ========== UI ==========
function updateUI() {
    updateHistoryUI();
    updateScanHistoryUI();
    updateSettingsUI();
    updateDatabaseTab();
}

// ========== UTILS ==========
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = msg;
    toast.style.display = 'block';
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

// Cleanup
window.addEventListener('beforeunload', stopScanner);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopScanner();
});

console.log('App loaded');
