// ========================================
// QR GENERATOR PRO - MOBILE FIXED
// Database + iPhone Scanner
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
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge carefully
            AppState.databases = parsed.databases || {};
            AppState.activeDbId = parsed.activeDbId || null;
            AppState.history = parsed.history || [];
            AppState.scanHistory = parsed.scanHistory || [];
            AppState.theme = parsed.theme || 'light';
        }
        applyTheme(AppState.theme);
        console.log('State loaded:', {
            databases: Object.keys(AppState.databases).length,
            activeDbId: AppState.activeDbId
        });
    } catch (e) {
        console.error('Load state error:', e);
    }
}

function saveState() {
    try {
        const toSave = {
            databases: AppState.databases,
            activeDbId: AppState.activeDbId,
            history: AppState.history,
            scanHistory: AppState.scanHistory,
            theme: AppState.theme
        };
        localStorage.setItem('qrGeneratorState', JSON.stringify(toSave));
        console.log('State saved');
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
    document.getElementById('start-scanner-btn')?.addEventListener('click', startScannerManually);
    
    // Settings tab
    setupDatabaseUpload();
    document.getElementById('load-db-url')?.addEventListener('click', loadDatabaseFromUrl);
    document.getElementById('export-db')?.addEventListener('click', exportDatabase);
}

// ========== TABS ==========
function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tabName}-tab`));
    
    // Always refresh database tab when switching to it
    if (tabName === 'database') {
        // Re-load state to ensure we have latest data
        loadState();
        updateDatabaseTab();
    }
    
    if (tabName === 'scan') {
        // Don't auto-start, show button instead for iOS
        showScannerUI();
    } else {
        stopScanner();
    }
    
    if (tabName === 'settings') {
        updateSettingsUI();
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
    console.log('Updating database tab, activeDbId:', AppState.activeDbId);
    console.log('Databases:', Object.keys(AppState.databases));
    
    const hasDb = AppState.activeDbId && AppState.databases[AppState.activeDbId];
    
    const noDbMsg = document.getElementById('no-db-message');
    const searchSection = document.getElementById('db-search-section');
    
    if (noDbMsg) noDbMsg.classList.toggle('hidden', hasDb);
    if (searchSection) searchSection.classList.toggle('hidden', !hasDb);
    
    if (hasDb) {
        const db = AppState.databases[AppState.activeDbId];
        const infoText = document.getElementById('db-info-text');
        if (infoText) infoText.textContent = `${db.name} • ${db.rows} items`;
        console.log('Database loaded:', db.name, db.rows, 'items');
    } else {
        console.log('No active database');
    }
}

function handleDatabaseSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const resultsDiv = document.getElementById('search-results');
    const clearBtn = document.getElementById('clear-search');
    const qrResult = document.getElementById('db-qr-result');
    
    // Show/hide clear button
    if (clearBtn) clearBtn.classList.toggle('hidden', !query);
    
    // Hide QR when searching
    if (qrResult) qrResult.classList.add('hidden');
    
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
    document.getElementById('clear-search')?.classList.add('hidden');
    document.getElementById('db-qr-result')?.classList.add('hidden');
}

async function selectDatabaseItem(id, label) {
    // Clear search
    const searchInput = document.getElementById('db-search');
    if (searchInput) searchInput.value = '';
    const results = document.getElementById('search-results');
    if (results) results.innerHTML = '';
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

// ========================================
// SCANNER - iOS COMPATIBLE
// ========================================

function showScannerUI() {
    const video = document.getElementById('scanner-video');
    const startBtn = document.getElementById('start-scanner-btn');
    const statusEl = document.getElementById('scanner-status');
    
    // Check if already scanning
    if (AppState.scanner.scanning) {
        if (startBtn) startBtn.classList.add('hidden');
        return;
    }
    
    // Show start button on mobile (especially iOS)
    if (startBtn) startBtn.classList.remove('hidden');
    if (statusEl) statusEl.textContent = 'Tap button to start camera';
}

async function startScannerManually() {
    const startBtn = document.getElementById('start-scanner-btn');
    const statusEl = document.getElementById('scanner-status');
    
    if (startBtn) startBtn.classList.add('hidden');
    if (statusEl) statusEl.textContent = 'Starting camera...';
    
    await initScanner();
}

async function initScanner() {
    if (AppState.scanner.scanning) return;
    
    const statusEl = document.getElementById('scanner-status');
    
    try {
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera not supported on this browser');
        }
        
        // Request camera permission first (important for iOS)
        if (statusEl) statusEl.textContent = 'Requesting camera permission...';
        
        // Get available cameras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        console.log('Available cameras:', videoDevices.length);
        
        if (videoDevices.length === 0) {
            throw new Error('No camera found');
        }
        
        // Update camera selector
        const selector = document.getElementById('camera-select');
        if (selector) {
            selector.innerHTML = videoDevices.map((d, i) => 
                `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`
            ).join('');
        }
        
        // Try to find back camera (preferred for QR scanning)
        const backCamera = videoDevices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
        );
        
        const preferredDeviceId = backCamera?.deviceId || videoDevices[0]?.deviceId;
        
        await startCamera(preferredDeviceId);
        
        if (statusEl) statusEl.textContent = '';
        
    } catch (e) {
        console.error('Scanner init error:', e);
        if (statusEl) statusEl.textContent = `Error: ${e.message}`;
        showToast('Camera error: ' + e.message);
        
        // Show start button again
        const startBtn = document.getElementById('start-scanner-btn');
        if (startBtn) startBtn.classList.remove('hidden');
    }
}

async function startCamera(deviceId) {
    const video = document.getElementById('scanner-video');
    const statusEl = document.getElementById('scanner-status');
    
    if (!video) {
        console.error('Video element not found');
        return;
    }
    
    try {
        // Stop existing stream
        if (AppState.scanner.stream) {
            AppState.scanner.stream.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped track:', track.kind);
            });
            AppState.scanner.stream = null;
        }
        
        if (statusEl) statusEl.textContent = 'Accessing camera...';
        
        // iOS-friendly constraints
        const constraints = {
            video: {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                facingMode: deviceId ? undefined : 'environment'
            },
            audio: false
        };
        
        // Add deviceId if specified
        if (deviceId) {
            constraints.video.deviceId = { exact: deviceId };
        }
        
        console.log('Requesting camera with constraints:', constraints);
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log('Got stream:', stream.getVideoTracks().length, 'video tracks');
        
        AppState.scanner.stream = stream;
        
        // Set video source
        video.srcObject = stream;
        
        // Important for iOS - need to call play() explicitly
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
                resolve();
            };
            video.onerror = (e) => {
                console.error('Video error:', e);
                reject(new Error('Video failed to load'));
            };
            // Timeout
            setTimeout(() => reject(new Error('Video load timeout')), 10000);
        });
        
        // Play video
        await video.play();
        console.log('Video playing');
        
        if (statusEl) statusEl.textContent = '';
        
        // Hide start button
        const startBtn = document.getElementById('start-scanner-btn');
        if (startBtn) startBtn.classList.add('hidden');
        
        // Start scanning
        AppState.scanner.scanning = true;
        scanLoop();
        
    } catch (e) {
        console.error('Start camera error:', e);
        
        let errorMsg = e.message;
        if (e.name === 'NotAllowedError') {
            errorMsg = 'Camera permission denied. Please allow camera access.';
        } else if (e.name === 'NotFoundError') {
            errorMsg = 'No camera found';
        } else if (e.name === 'NotReadableError') {
            errorMsg = 'Camera is in use by another app';
        } else if (e.name === 'OverconstrainedError') {
            errorMsg = 'Camera constraints not satisfied';
        }
        
        if (statusEl) statusEl.textContent = errorMsg;
        showToast(errorMsg);
        
        // Show start button again
        const startBtn = document.getElementById('start-scanner-btn');
        if (startBtn) startBtn.classList.remove('hidden');
    }
}

function switchCamera(e) {
    const deviceId = e.target.value;
    if (deviceId) {
        startCamera(deviceId);
    }
}

function scanLoop() {
    const video = document.getElementById('scanner-video');
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    let lastScanTime = 0;
    const scanInterval = 200; // Scan every 200ms to reduce CPU usage
    
    const scan = (timestamp) => {
        if (!AppState.scanner.scanning) {
            console.log('Scanning stopped');
            return;
        }
        
        // Throttle scanning
        if (timestamp - lastScanTime < scanInterval) {
            AppState.scanner.animationId = requestAnimationFrame(scan);
            return;
        }
        lastScanTime = timestamp;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert'
                });
                
                if (code && code.data) {
                    console.log('QR Code found:', code.data);
                    handleScanResult(code.data);
                }
            } catch (e) {
                console.error('Scan error:', e);
            }
        }
        
        AppState.scanner.animationId = requestAnimationFrame(scan);
    };
    
    console.log('Starting scan loop');
    AppState.scanner.animationId = requestAnimationFrame(scan);
}

function stopScanner() {
    console.log('Stopping scanner');
    AppState.scanner.scanning = false;
    
    if (AppState.scanner.animationId) {
        cancelAnimationFrame(AppState.scanner.animationId);
        AppState.scanner.animationId = null;
    }
    
    if (AppState.scanner.stream) {
        AppState.scanner.stream.getTracks().forEach(track => {
            track.stop();
            console.log('Stopped track:', track.kind);
        });
        AppState.scanner.stream = null;
    }
    
    // Clear video
    const video = document.getElementById('scanner-video');
    if (video) {
        video.srcObject = null;
    }
}

function handleScanResult(data) {
    // Prevent duplicate scans
    if (AppState.currentScan === data) return;
    
    console.log('Scan result:', data);
    
    document.getElementById('scan-data').textContent = data;
    document.getElementById('scan-result').classList.remove('hidden');
    AppState.currentScan = data;
    
    // Add to history
    AppState.scanHistory = [data, ...AppState.scanHistory.filter(i => i !== data)].slice(0, 20);
    saveState();
    updateScanHistoryUI();
    
    // Visual feedback
    const overlay = document.querySelector('.scanner-overlay');
    if (overlay) {
        overlay.style.background = 'rgba(16, 185, 129, 0.4)';
        setTimeout(() => overlay.style.background = 'transparent', 300);
    }
    
    // Vibrate
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
    
    // Scroll to result
    document.getElementById('scan-result')?.scrollIntoView({ behavior: 'smooth' });
    
    // Reset current scan after delay to allow rescanning same code
    setTimeout(() => {
        AppState.currentScan = null;
    }, 2000);
}

async function scanFromImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    console.log('Scanning from image:', file.name);
    
    try {
        // Read file
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        
        // Create image
        const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = dataUrl;
        });
        
        // Draw to canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Scan
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code && code.data) {
            handleScanResult(code.data);
        } else {
            showToast('No QR code found in image');
        }
    } catch (err) {
        console.error('Image scan error:', err);
        showToast('Error reading image');
    }
    
    // Reset input
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

// ========================================
// SETTINGS - DATABASE UPLOAD (iOS FIXED)
// ========================================

function setupDatabaseUpload() {
    const dropZone = document.getElementById('db-drop-zone');
    const fileInput = document.getElementById('db-upload');
    
    if (!fileInput) {
        console.error('File input not found');
        return;
    }
    
    // iOS needs these event listeners
    fileInput.addEventListener('change', handleFileSelect);
    fileInput.addEventListener('input', handleFileSelect);
    
    // Click on drop zone should trigger file input
    if (dropZone) {
        dropZone.addEventListener('click', (e) => {
            // Don't trigger if clicking the input itself
            if (e.target !== fileInput) {
                fileInput.click();
            }
        });
        
        // Drag and drop for desktop
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
    }
    
    console.log('Database upload setup complete');
}

function handleFileSelect(e) {
    console.log('File select event:', e.type);
    const file = e.target?.files?.[0];
    if (file) {
        console.log('File selected:', file.name, file.size, 'bytes');
        handleDatabaseFile(file);
        // Reset input
        setTimeout(() => { e.target.value = ''; }, 100);
    }
}

async function handleDatabaseFile(file) {
    const status = document.getElementById('upload-status');
    if (status) {
        status.className = 'status';
        status.textContent = '📖 Reading file...';
        status.classList.remove('hidden');
    }
    
    try {
        const content = await file.text();
        const name = file.name.replace(/\.[^/.]+$/, '');
        console.log('Parsing database:', name, content.length, 'chars');
        
        const result = await parseDatabase(content, name);
        
        if (status) {
            status.className = 'status success';
            status.textContent = `✓ Loaded ${result.rows} items from ${name}`;
        }
        
        showToast(`Database loaded: ${result.rows} items`);
        updateSettingsUI();
        updateDatabaseTab();
        
    } catch (err) {
        console.error('Database error:', err);
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
        throw new Error('File needs header row + at least 1 data row');
    }
    
    // Detect delimiter
    const firstLine = lines[0];
    const delim = firstLine.includes('\t') ? '\t' : ',';
    console.log('Using delimiter:', delim === '\t' ? 'TAB' : 'COMMA');
    
    const data = [];
    
    // Parse data rows (skip header)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(delim).map(p => p.trim().replace(/^"|"$/g, ''));
        
        if (parts.length >= 2 && parts[0] && parts[1]) {
            data.push({
                label: parts[0],
                id: parts[1],
                displayText: parts[2] || ''
            });
        }
    }
    
    console.log('Parsed rows:', data.length);
    
    if (data.length === 0) {
        throw new Error('No valid data rows found. Format: Label,ID,Description');
    }
    
    // Save to state
    const dbId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    AppState.databases[dbId] = {
        name: name,
        data: data,
        created: Date.now(),
        rows: data.length
    };
    
    AppState.activeDbId = dbId;
    
    // Save immediately
    saveState();
    
    console.log('Database saved:', dbId, 'Active:', AppState.activeDbId);
    
    return { rows: data.length };
}

async function loadDatabaseFromUrl() {
    const urlInput = document.getElementById('db-url');
    const url = urlInput?.value.trim();
    
    if (!url) {
        showToast('Please enter a URL');
        return;
    }
    
    const status = document.getElementById('upload-status');
    if (status) {
        status.className = 'status';
        status.textContent = '🌐 Loading from URL...';
        status.classList.remove('hidden');
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const text = await response.text();
        const name = url.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'imported';
        
        // Try JSON first
        try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
                const dbId = Date.now().toString(36) + Math.random().toString(36).substr(2);
                
                AppState.databases[dbId] = {
                    name: name,
                    data: json.map(item => ({
                        label: item.label || item.name || item.title || '',
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
        } catch (jsonErr) {
            // Not JSON, try CSV
            console.log('Not JSON, trying CSV');
        }
        
        // Try CSV/TSV
        const result = await parseDatabase(text, name);
        
        if (status) {
            status.className = 'status success';
            status.textContent = `✓ Loaded ${result.rows} items`;
        }
        
        updateSettingsUI();
        updateDatabaseTab();
        
    } catch (err) {
        console.error('URL load error:', err);
        if (status) {
            status.className = 'status error';
            status.textContent = `❌ ${err.message}`;
        }
    }
}

function updateSettingsUI() {
    const list = document.getElementById('db-list');
    const activeCard = document.getElementById('active-db-card');
    const dbKeys = Object.keys(AppState.databases);
    
    console.log('Updating settings UI, databases:', dbKeys.length);
    
    if (!list) return;
    
    if (dbKeys.length === 0) {
        list.innerHTML = '<p class="text-muted">No databases loaded</p>';
        if (activeCard) activeCard.classList.add('hidden');
        return;
    }
    
    list.innerHTML = dbKeys.map(id => {
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
                        ? '<span style="color:var(--success)">✓ Active</span>' 
                        : `<button class="btn btn-small btn-secondary activate-db" data-id="${id}">Use</button>`
                    }
                    <button class="btn btn-small btn-danger delete-db" data-id="${id}">×</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners
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
            if (!confirm('Delete this database?')) return;
            
            delete AppState.databases[btn.dataset.id];
            
            if (AppState.activeDbId === btn.dataset.id) {
                const remaining = Object.keys(AppState.databases);
                AppState.activeDbId = remaining.length > 0 ? remaining[0] : null;
            }
            
            saveState();
            updateSettingsUI();
            updateDatabaseTab();
            showToast('Database deleted');
        });
    });
    
    // Update active database card
    if (AppState.activeDbId && AppState.databases[AppState.activeDbId]) {
        const db = AppState.databases[AppState.activeDbId];
        document.getElementById('active-db-name').textContent = db.name;
        document.getElementById('active-db-info').textContent = `${db.rows} items`;
        if (activeCard) activeCard.classList.remove('hidden');
    } else {
        if (activeCard) activeCard.classList.add('hidden');
    }
}

function exportDatabase() {
    if (!AppState.activeDbId || !AppState.databases[AppState.activeDbId]) {
        showToast('No database to export');
        return;
    }
    
    const db = AppState.databases[AppState.activeDbId];
    const json = JSON.stringify(db.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${db.name}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showToast('Database exported');
}

// ========== UI UPDATE ==========
function updateUI() {
    updateHistoryUI();
    updateScanHistoryUI();
    updateSettingsUI();
    updateDatabaseTab();
}

// ========== UTILITIES ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopScanner();
});

// Also stop scanner when page becomes hidden (iOS)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopScanner();
    }
});

console.log('QR Generator Pro loaded');
