// ========================================
// QR GENERATOR PRO - SIMPLIFIED
// Search results + QR directly under search bar
// ========================================

// ========== GLOBAL STATE ==========
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
            theme: AppState.theme
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
    
    // Generate tab - Manual QR
    document.getElementById('qr-input')?.addEventListener('input', updateCharCount);
    document.getElementById('generate-btn')?.addEventListener('click', generateManualQR);
    
    // Generate tab - Database search
    document.getElementById('db-search')?.addEventListener('input', handleDatabaseSearch);
    
    // Manual QR result actions
    document.getElementById('download-png')?.addEventListener('click', () => downloadQR('manual'));
    document.getElementById('copy-qr')?.addEventListener('click', () => copyQR('manual'));
    document.getElementById('print-qr')?.addEventListener('click', () => printQR('manual'));
    
    // Database QR result actions
    document.getElementById('db-download-png')?.addEventListener('click', () => downloadQR('db'));
    document.getElementById('db-copy-qr')?.addEventListener('click', () => copyQR('db'));
    document.getElementById('db-print-qr')?.addEventListener('click', () => printQR('db'));
    
    document.getElementById('clear-history')?.addEventListener('click', clearHistory);
    
    // Scan tab
    document.getElementById('camera-select')?.addEventListener('change', switchCamera);
    document.getElementById('scan-upload')?.addEventListener('change', scanFromImage);
    document.getElementById('copy-scan')?.addEventListener('click', copyScanResult);
    document.getElementById('open-url')?.addEventListener('click', openScannedUrl);
    document.getElementById('generate-from-scan')?.addEventListener('click', generateFromScan);
    
    // Database tab
    setupDatabaseUpload();
    document.getElementById('load-db-url')?.addEventListener('click', loadDatabaseFromUrl);
    document.getElementById('export-db')?.addEventListener('click', exportDatabase);
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

// ========== MANUAL QR GENERATION ==========
function updateCharCount() {
    const input = document.getElementById('qr-input');
    const count = document.getElementById('char-count');
    if (input && count) {
        count.textContent = input.value.length;
        count.style.color = input.value.length > 2953 ? 'var(--danger)' : '';
    }
}

async function generateManualQR() {
    const inputEl = document.getElementById('qr-input');
    const input = inputEl?.value.trim();
    
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
        const fgColor = document.getElementById('fg-color')?.value || '#000000';
        const bgColor = document.getElementById('bg-color')?.value || '#ffffff';
        
        const qrDataUrl = await generateBasicQR(input, errorLevel, fgColor, bgColor);
        displayManualQRResult(qrDataUrl, input);
        addToHistory(input);
        
    } catch (error) {
        console.error('QR generation error:', error);
        showToast('Error generating QR code');
    }
}

function generateBasicQR(text, errorLevel, fgColor, bgColor) {
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
                    const dataUrl = canvas.toDataURL('image/png');
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

function displayManualQRResult(dataUrl, data) {
    const resultDiv = document.getElementById('qr-result');
    const qrDisplay = document.getElementById('qr-display');
    const preview = document.getElementById('qr-data-preview');
    
    if (qrDisplay) qrDisplay.innerHTML = `<img src="${dataUrl}" alt="QR Code">`;
    if (preview) preview.textContent = data.length > 50 ? data.substring(0, 50) + '...' : data;
    
    AppState.currentQR = { dataUrl, data };
    
    if (resultDiv) {
        resultDiv.classList.remove('hidden');
    }
}

// ========== DATABASE QR GENERATION ==========
function displayDbQRResult(dataUrl, data) {
    const resultDiv = document.getElementById('db-qr-result');
    const qrDisplay = document.getElementById('db-qr-display');
    const preview = document.getElementById('db-qr-data');
    
    if (qrDisplay) qrDisplay.innerHTML = `<img src="${dataUrl}" alt="QR Code">`;
    if (preview) preview.textContent = data.length > 50 ? data.substring(0, 50) + '...' : data;
    
    AppState.currentDbQR = { dataUrl, data };
    
    if (resultDiv) {
        resultDiv.classList.remove('hidden');
    }
}

// ========== QR ACTIONS ==========
function downloadQR(type) {
    const qrData = type === 'db' ? AppState.currentDbQR : AppState.currentQR;
    if (!qrData) return;
    
    const link = document.createElement('a');
    link.download = `qr-code-${Date.now()}.png`;
    link.href = qrData.dataUrl;
    link.click();
    
    showToast('Downloaded!');
}

async function copyQR(type) {
    const qrData = type === 'db' ? AppState.currentDbQR : AppState.currentQR;
    if (!qrData) return;
    
    try {
        const response = await fetch(qrData.dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        showToast('Copied to clipboard!');
    } catch (error) {
        try {
            await navigator.clipboard.writeText(qrData.data);
            showToast('Copied text to clipboard!');
        } catch (e) {
            showToast('Copy failed');
        }
    }
}

function printQR(type) {
    const qrData = type === 'db' ? AppState.currentDbQR : AppState.currentQR;
    if (!qrData) return;
    
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
            <img src="${qrData.dataUrl}" alt="QR Code" onload="setTimeout(() => window.print(), 100)">
            <p>${escapeHtml(qrData.data)}</p>
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
    
    if (!dropZone || !fileInput) {
        console.error('Database upload elements not found');
        return;
    }
    
    // Multiple event listeners for iOS compatibility
    fileInput.addEventListener('change', handleFileSelect);
    fileInput.addEventListener('input', handleFileSelect);
    
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
    
    console.log('Database upload setup complete');
}

function handleFileSelect(e) {
    console.log('File select triggered', e.type);
    const file = e.target?.files?.[0];
    
    if (file) {
        console.log('File selected:', file.name, file.size);
        handleDatabaseFile(file);
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

// ========================================
// DATABASE SEARCH - Results + QR under search bar
// ========================================

function handleDatabaseSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    const resultsDiv = document.getElementById('search-results');
    const qrResultDiv = document.getElementById('db-qr-result');
    
    if (!resultsDiv) return;
    
    // Hide QR result when searching again
    if (qrResultDiv) qrResultDiv.classList.add('hidden');
    
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
    ).slice(0, 15);
    
    if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(item => `
            <div class="search-item" data-id="${escapeHtml(item.id)}" data-label="${escapeHtml(item.label)}">
                <div class="search-item-label">${escapeHtml(item.label)}</div>
                <div class="search-item-id">ID: ${escapeHtml(item.id)}${item.displayText ? ' • ' + escapeHtml(item.displayText) : ''}</div>
            </div>
        `).join('');
        
        resultsDiv.classList.add('visible');
        
        // Click to generate QR
        resultsDiv.querySelectorAll('.search-item').forEach(item => {
            item.addEventListener('click', async () => {
                const id = item.dataset.id;
                const label = item.dataset.label;
                
                console.log('Selected from database:', { id, label });
                
                // Hide search results
                resultsDiv.classList.remove('visible');
                
                // Clear search input
                const searchInput = document.getElementById('db-search');
                if (searchInput) searchInput.value = '';
                
                try {
                    const errorLevel = document.getElementById('error-level')?.value || 'M';
                    const fgColor = document.getElementById('fg-color')?.value || '#000000';
                    const bgColor = document.getElementById('bg-color')?.value || '#ffffff';
                    
                    const qrDataUrl = await generateBasicQR(id, errorLevel, fgColor, bgColor);
                    
                    // Display QR right under the search bar
                    displayDbQRResult(qrDataUrl, `${label} (${id})`);
                    addToHistory(id);
                    
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
            
            // Event handlers
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
    
    // Update active database info and show/hide search
    if (AppState.activeDbId && AppState.databases[AppState.activeDbId]) {
        const activeDb = AppState.databases[AppState.activeDbId];
        
        const nameEl = document.getElementById('active-db-name');
        const infoEl = document.getElementById('active-db-info');
        
        if (nameEl) nameEl.textContent = activeDb.name;
        if (infoEl) infoEl.textContent = `${activeDb.rows} records`;
        
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

// ========== UI UPDATE ==========
function updateUI() {
    updateHistoryUI();
    updateScanHistoryUI();
    updateDatabaseUI();
}

// ========== UTILITIES ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

console.log('QR Generator Pro script loaded');
