/**
 * AegisQR - Master Application Coordinator
 * Handles user interactions, state persistence, tab management, real-time generation,
 * camera controls, multi-frame streams, history vault, and toasts.
 */

(function (window) {
    'use strict';

    class App {
        constructor() {
            this.activeTab = 'generate';
            this.activeDataType = 'file';
            this.qrGenerator = window.AegisQRGenerator.create();
            this.streamPlayer = window.AegisAnimatedStream.createPlayer();
            this.cameraScanner = window.AegisCameraScanner.create();
            this.chunkCollector = window.AegisChunkCollector.create();

            // Generator State
            this.currentPayload = null; // Uint8Array or string
            this.currentPayloadMeta = {};
            this.lastEncryptedResult = null;
            this.isGenerating = false;

            // Scanner State
            this.isScanningCamera = false;
            this.pendingEncryptedToken = null; // used if password required

            // History
            this.historyKey = 'aegisqr_history_v1';
            this.history = this.loadHistory();

            // Theme
            this.theme = localStorage.getItem('aegisqr_theme') || 'dark';
        }

        init() {
            this.applyTheme(this.theme);
            this.bindNavigation();
            this.bindDataTypeSelectors();
            this.bindGeneratorControls();
            this.bindScannerControls();
            this.bindExportControls();
            this.bindAnimatedStreamEvents();
            this.bindClipboardAndDrop();
            this.renderHistory();

            // Check if page loaded with a vault payload in hash
            this.checkUrlForVaultPayload();

            // Window hash change listener
            window.addEventListener('hashchange', () => this.checkUrlForVaultPayload());
        }

        // ==========================================
        // THEME MANAGEMENT
        // ==========================================
        applyTheme(theme) {
            this.theme = theme;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('aegisqr_theme', theme);

            const themeBtn = document.getElementById('btnThemeToggle');
            if (themeBtn) {
                themeBtn.setAttribute('title', theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme');
            }
        }

        toggleTheme() {
            this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
            // Re-render QR with updated palette if in monochrome
            this.triggerGenerate();
        }

        // ==========================================
        // NAVIGATION & TABS
        // ==========================================
        bindNavigation() {
            const navButtons = document.querySelectorAll('.nav-tab-btn');
            navButtons.forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const tab = btn.getAttribute('data-tab');
                    this.switchTab(tab);
                });
            });

            const themeBtn = document.getElementById('btnThemeToggle');
            if (themeBtn) {
                themeBtn.addEventListener('click', () => this.toggleTheme());
            }
        }

        switchTab(tabName) {
            this.activeTab = tabName;

            // Update tab buttons
            document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
                btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
            });

            // Update tab panels
            document.querySelectorAll('.tab-panel').forEach((panel) => {
                panel.classList.toggle('active', panel.id === `tab-${tabName}`);
            });

            // Stop camera if leaving scan tab
            if (tabName !== 'scan' && this.isScanningCamera) {
                this.stopCameraScan();
            }

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // ==========================================
        // DATA TYPE SELECTORS
        // ==========================================
        bindDataTypeSelectors() {
            const typeBtns = document.querySelectorAll('.type-pill');
            typeBtns.forEach((btn) => {
                btn.addEventListener('click', () => {
                    typeBtns.forEach((b) => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.activeDataType = btn.getAttribute('data-type');
                    this.updateInputFieldsForType();
                });
            });

            // Bind file input change
            const fileInput = document.getElementById('genericFileInput');
            if (fileInput) {
                fileInput.addEventListener('change', (e) => this.handleFileSelection(e.target.files[0]));
            }

            // Drag and drop for generator file input
            const fileDropZone = document.getElementById('genFileDropZone');
            if (fileDropZone) {
                fileDropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    fileDropZone.classList.add('dragover');
                });
                fileDropZone.addEventListener('dragleave', () => fileDropZone.classList.remove('dragover'));
                fileDropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    fileDropZone.classList.remove('dragover');
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        this.handleFileSelection(e.dataTransfer.files[0]);
                    }
                });
            }

            // Auto-trigger on text inputs with debounce
            let debounceTimer = null;
            const inputContainer = document.getElementById('dataInputFields');
            if (inputContainer) {
                inputContainer.addEventListener('input', () => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => this.triggerGenerate(), 350);
                });
            }
        }

        updateInputFieldsForType() {
            const groups = document.querySelectorAll('.input-type-group');
            groups.forEach((g) => {
                g.classList.toggle('active', g.id === `group-${this.activeDataType}`);
            });
            this.triggerGenerate();
        }

        async handleFileSelection(file) {
            if (!file) return;

            const fileInfoElem = document.getElementById('selectedFileInfo');
            const fileNameElem = document.getElementById('selectedFileName');
            const fileSizeElem = document.getElementById('selectedFileSize');

            if (fileInfoElem) fileInfoElem.style.display = 'flex';
            if (fileNameElem) fileNameElem.textContent = file.name;
            if (fileSizeElem) fileSizeElem.textContent = `${Math.round(file.size / 1024 * 10) / 10} KB (${file.type || 'binary'})`;

            const reader = new FileReader();
            reader.onload = (e) => {
                this.currentPayload = new Uint8Array(e.target.result);
                this.currentPayloadMeta = {
                    name: file.name,
                    mime: file.type || 'application/octet-stream',
                    type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
                    size: file.size
                };
                this.triggerGenerate();
            };
            reader.readAsArrayBuffer(file);
        }

        // ==========================================
        // GENERATOR & ENCRYPTION
        // ==========================================
        bindGeneratorControls() {
            const btnGenerate = document.getElementById('btnTriggerGenerate');
            if (btnGenerate) {
                btnGenerate.addEventListener('click', () => this.triggerGenerate());
            }

            // Passphrase toggle
            const chkPassword = document.getElementById('chkEnablePassword');
            const passWrap = document.getElementById('passwordInputWrapper');
            if (chkPassword && passWrap) {
                chkPassword.addEventListener('change', () => {
                    passWrap.style.display = chkPassword.checked ? 'block' : 'none';
                    this.triggerGenerate();
                });
            }

            // Styling controls
            const themeSelect = document.getElementById('qrThemeSelect');
            const dotSelect = document.getElementById('qrDotStyleSelect');
            const logoSelect = document.getElementById('qrLogoSelect');
            const eccSelect = document.getElementById('qrEccSelect');
            const modeSelect = document.getElementById('qrFormatMode');

            [themeSelect, dotSelect, logoSelect, eccSelect, modeSelect].forEach((el) => {
                if (el) el.addEventListener('change', () => this.triggerGenerate());
            });
        }

        extractCurrentInput() {
            const type = this.activeDataType;
            let data = null;
            let meta = { type, name: '', mime: 'text/plain', note: '' };

            const noteElem = document.getElementById('inputNote');
            if (noteElem) meta.note = noteElem.value.trim();

            if (type === 'file') {
                if (!this.currentPayload) return null;
                data = this.currentPayload;
                meta = { ...meta, ...this.currentPayloadMeta };
            } else if (type === 'text') {
                const val = document.getElementById('inputTextContent')?.value || '';
                if (!val.trim()) return null;
                data = val;
                meta.mime = 'text/plain';
                meta.name = 'note.txt';
            } else if (type === 'url') {
                let val = document.getElementById('inputUrlContent')?.value || '';
                if (!val.trim()) return null;
                if (!/^https?:\/\//i.test(val)) val = 'https://' + val;
                data = val;
                meta.mime = 'text/uri-list';
                meta.name = 'link.url';
            } else if (type === 'vcard') {
                const fn = document.getElementById('vcardName')?.value || '';
                const tel = document.getElementById('vcardPhone')?.value || '';
                const email = document.getElementById('vcardEmail')?.value || '';
                const org = document.getElementById('vcardOrg')?.value || '';

                if (!fn.trim() && !tel.trim()) return null;

                data = `BEGIN:VCARD\nVERSION:3.0\nFN:${fn}\nTEL:${tel}\nEMAIL:${email}\nORG:${org}\nEND:VCARD`;
                meta.mime = 'text/vcard';
                meta.name = `${fn || 'contact'}.vcf`;
            } else if (type === 'wifi') {
                const ssid = document.getElementById('wifiSsid')?.value || '';
                const pass = document.getElementById('wifiPass')?.value || '';
                const sec = document.getElementById('wifiSecurity')?.value || 'WPA';

                if (!ssid.trim()) return null;

                data = `WIFI:S:${ssid};T:${sec};P:${pass};;`;
                meta.mime = 'text/plain';
                meta.name = 'wifi.txt';
            } else if (type === 'code') {
                const code = document.getElementById('inputCodeContent')?.value || '';
                const lang = document.getElementById('codeLangSelect')?.value || 'txt';
                if (!code.trim()) return null;

                data = code;
                meta.mime = 'text/plain';
                meta.name = `snippet.${lang}`;
            }

            return { data, meta };
        }

        async triggerGenerate() {
            const inputInfo = this.extractCurrentInput();
            const qrPreviewBox = document.getElementById('qrCodeContainer');
            const emptyState = document.getElementById('qrEmptyState');
            const streamControls = document.getElementById('animatedStreamControls');
            const statsBadge = document.getElementById('payloadStatsBadge');

            if (!inputInfo || !inputInfo.data) {
                if (qrPreviewBox) qrPreviewBox.innerHTML = '';
                if (emptyState) emptyState.style.display = 'flex';
                if (streamControls) streamControls.style.display = 'none';
                if (statsBadge) statsBadge.textContent = 'Waiting for input...';
                return;
            }

            if (emptyState) emptyState.style.display = 'none';

            try {
                // Get password if enabled
                const chkPassword = document.getElementById('chkEnablePassword');
                const passwordInput = document.getElementById('generatorPassword');
                const password = (chkPassword && chkPassword.checked && passwordInput) ? passwordInput.value : '';

                // Encrypt payload
                const encrypted = await window.AegisCipher.encrypt({
                    data: inputInfo.data,
                    type: inputInfo.meta.type,
                    name: inputInfo.meta.name,
                    mime: inputInfo.meta.mime,
                    note: inputInfo.meta.note,
                    password: password,
                    compress: true
                });

                this.lastEncryptedResult = encrypted;

                // Format Mode: Direct URL or Raw AQR1
                const formatMode = document.getElementById('qrFormatMode')?.value || 'direct-url';
                const finalQrPayload = formatMode === 'direct-url' ? encrypted.directUrl : encrypted.rawCipherQr;

                // Update Stats Badge
                if (statsBadge) {
                    const originalKb = Math.round(encrypted.stats.originalSize / 1024 * 10) / 10;
                    const envKb = Math.round(encrypted.stats.envelopeSize / 1024 * 10) / 10;
                    statsBadge.innerHTML = `
                        <span>Payload: ${originalKb} KB</span> •
                        <span>Encrypted: ${envKb} KB</span>
                        ${encrypted.stats.isCompressed ? ` • <span class="badge-accent">-${encrypted.stats.savings}% Comp</span>` : ''}
                        ${encrypted.stats.hasPassword ? ` • <span class="badge-warning">PIN Protected</span>` : ''}
                    `;
                }

                // Check size for Animated Multi-Frame Stream
                // If finalQrPayload > 1200 characters, we activate multi-frame stream for 100% scan reliability!
                const isLargePayload = finalQrPayload.length > 1200;

                if (isLargePayload) {
                    if (streamControls) streamControls.style.display = 'flex';
                    this.setupAnimatedStream(finalQrPayload);
                } else {
                    if (streamControls) streamControls.style.display = 'none';
                    this.streamPlayer.stop();
                    this.renderSingleQr(finalQrPayload);
                }

                // Add to history
                this.addHistoryItem({
                    id: Date.now(),
                    date: new Date().toLocaleTimeString(),
                    type: inputInfo.meta.type,
                    name: inputInfo.meta.name || inputInfo.meta.type.toUpperCase(),
                    size: encrypted.stats.originalSize,
                    token: encrypted.envelopeBase64,
                    directUrl: encrypted.directUrl,
                    isProtected: Boolean(password)
                });
            } catch (err) {
                console.error('Generation error:', err);
                this.showToast(`Generation failed: ${err.message}`, 'error');
            }
        }

        renderSingleQr(payloadString) {
            const container = document.getElementById('qrCodeContainer');
            if (!container) return;

            const theme = document.getElementById('qrThemeSelect')?.value || 'obsidian-cyan';
            const dotStyle = document.getElementById('qrDotStyleSelect')?.value || 'rounded';
            const logo = document.getElementById('qrLogoSelect')?.value || 'shield';
            const ecc = document.getElementById('qrEccSelect')?.value || 'M';

            this.qrGenerator.render(container, payloadString, {
                theme,
                dotStyle,
                logo,
                ecc,
                useGradient: true,
                width: 320,
                height: 320
            });
        }

        setupAnimatedStream(payloadString) {
            const frames = this.streamPlayer.prepare(payloadString, 700);
            const container = document.getElementById('qrCodeContainer');
            const frameIndicator = document.getElementById('streamFrameIndicator');
            const progressFill = document.getElementById('streamProgressFill');

            this.streamPlayer.onFrame((frame, index, total) => {
                if (frameIndicator) {
                    frameIndicator.textContent = `Frame ${index + 1} of ${total}`;
                }
                if (progressFill) {
                    progressFill.style.width = `${Math.round(((index + 1) / total) * 100)}%`;
                }

                // Render current frame QR
                this.renderSingleQr(frame.frameString);
            });

            this.streamPlayer.play(4); // 4 frames per second
        }

        bindAnimatedStreamEvents() {
            const btnPlay = document.getElementById('btnStreamPlay');
            const btnPrev = document.getElementById('btnStreamPrev');
            const btnNext = document.getElementById('btnStreamNext');
            const fpsSlider = document.getElementById('streamFpsSlider');
            const fpsLabel = document.getElementById('streamFpsLabel');

            if (btnPlay) {
                btnPlay.addEventListener('click', () => {
                    if (this.streamPlayer.isPlaying) {
                        this.streamPlayer.pause();
                        btnPlay.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg> Resume';
                    } else {
                        this.streamPlayer.play();
                        btnPlay.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause';
                    }
                });
            }

            if (btnPrev) btnPrev.addEventListener('click', () => this.streamPlayer.prev());
            if (btnNext) btnNext.addEventListener('click', () => this.streamPlayer.next());

            if (fpsSlider) {
                fpsSlider.addEventListener('input', (e) => {
                    const fps = parseInt(e.target.value, 10);
                    if (fpsLabel) fpsLabel.textContent = `${fps} FPS`;
                    this.streamPlayer.setFps(fps);
                });
            }
        }

        // ==========================================
        // EXPORT CONTROLS
        // ==========================================
        bindExportControls() {
            const btnPng1x = document.getElementById('btnExportPng1x');
            const btnPng2x = document.getElementById('btnExportPng2x');
            const btnPng4x = document.getElementById('btnExportPng4x');
            const btnSvg = document.getElementById('btnExportSvg');
            const btnPrint = document.getElementById('btnExportPrint');
            const btnCopy = document.getElementById('btnCopyQrImage');
            const btnShare = document.getElementById('btnShareNative');

            if (btnPng1x) {
                btnPng1x.addEventListener('click', () => {
                    const canvas = this.qrGenerator.getCanvas();
                    window.AegisExporter.downloadPng(canvas, 'aegis-qr-1x.png', 1);
                    this.showToast('Downloaded 1x PNG', 'success');
                });
            }

            if (btnPng2x) {
                btnPng2x.addEventListener('click', () => {
                    const canvas = this.qrGenerator.getCanvas();
                    window.AegisExporter.downloadPng(canvas, 'aegis-qr-2x.png', 2);
                    this.showToast('Downloaded 2x HD PNG', 'success');
                });
            }

            if (btnPng4x) {
                btnPng4x.addEventListener('click', () => {
                    const canvas = this.qrGenerator.getCanvas();
                    window.AegisExporter.downloadPng(canvas, 'aegis-qr-4x-ultra.png', 4);
                    this.showToast('Downloaded 4x Ultra Print PNG', 'success');
                });
            }

            if (btnSvg) {
                btnSvg.addEventListener('click', () => {
                    const container = document.getElementById('qrCodeContainer');
                    window.AegisExporter.downloadSvg(container, 'aegis-qr.svg');
                    this.showToast('Downloaded SVG', 'success');
                });
            }

            if (btnPrint) {
                btnPrint.addEventListener('click', () => {
                    const canvas = this.qrGenerator.getCanvas();
                    if (!canvas) return;
                    window.AegisExporter.printCard({
                        canvas,
                        title: this.currentPayloadMeta.name || 'AegisQR Secure Vault',
                        note: document.getElementById('inputNote')?.value || '',
                        metadata: this.currentPayloadMeta
                    });
                });
            }

            if (btnCopy) {
                btnCopy.addEventListener('click', async () => {
                    const canvas = this.qrGenerator.getCanvas();
                    try {
                        await window.AegisExporter.copyImageToClipboard(canvas);
                        this.showToast('QR Code copied to clipboard as PNG!', 'success');
                    } catch (e) {
                        this.showToast('Failed to copy to clipboard.', 'warning');
                    }
                });
            }

            if (btnShare) {
                btnShare.addEventListener('click', async () => {
                    const canvas = this.qrGenerator.getCanvas();
                    const directUrl = this.lastEncryptedResult ? this.lastEncryptedResult.directUrl : '';
                    try {
                        await window.AegisExporter.shareNative({
                            canvas,
                            title: 'AegisQR Secure Transfer',
                            text: 'Open this encrypted QR payload with AegisQR.',
                            url: directUrl
                        });
                    } catch (e) {
                        // User cancelled or unsupported
                    }
                });
            }
        }

        // ==========================================
        // SCANNER CONTROLS
        // ==========================================
        bindScannerControls() {
            const btnStartCam = document.getElementById('btnStartCamera');
            const btnStopCam = document.getElementById('btnStopCamera');
            const btnSwitchCam = document.getElementById('btnSwitchCamera');
            const btnTorch = document.getElementById('btnToggleTorch');

            const videoElem = document.getElementById('scannerVideo');
            const overlayElem = document.getElementById('scannerOverlay');

            this.cameraScanner.init({
                videoElement: videoElem,
                overlayElement: overlayElem,
                onScan: (qrData) => this.handleScannedString(qrData),
                onError: (err) => {
                    this.showToast(`Camera error: ${err.message}`, 'error');
                    this.stopCameraScan();
                }
            });

            // Set up chunk collector for multi-part animated QR reception
            this.chunkCollector.onProgress((status) => {
                const streamHud = document.getElementById('scannerStreamHud');
                const progressFill = document.getElementById('scannerStreamFill');
                const textElem = document.getElementById('scannerStreamText');

                if (streamHud) streamHud.style.display = 'block';
                if (progressFill) progressFill.style.width = `${status.percent}%`;
                if (textElem) {
                    textElem.textContent = `Receiving stream: ${status.received} of ${status.total} frames (${status.percent}%)`;
                }
            });

            this.chunkCollector.onComplete((assembledString) => {
                const streamHud = document.getElementById('scannerStreamHud');
                if (streamHud) streamHud.style.display = 'none';

                window.AegisFeedback.playScanSuccess();
                this.handleScannedString(assembledString);
            });

            if (btnStartCam) {
                btnStartCam.addEventListener('click', () => this.startCameraScan());
            }

            if (btnStopCam) {
                btnStopCam.addEventListener('click', () => this.stopCameraScan());
            }

            if (btnSwitchCam) {
                btnSwitchCam.addEventListener('click', async () => {
                    const mode = await this.cameraScanner.switchCamera();
                    this.showToast(`Switched to ${mode} camera`, 'info');
                });
            }

            if (btnTorch) {
                btnTorch.addEventListener('click', async () => {
                    const on = await this.cameraScanner.toggleTorch();
                    btnTorch.classList.toggle('active', on);
                });
            }

            // Image file upload scanner
            const scanFileInput = document.getElementById('scanFileInput');
            if (scanFileInput) {
                scanFileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            const res = await window.AegisFileScanner.scanFile(file);
                            this.handleScannedString(res);
                        } catch (err) {
                            this.showToast(err.message, 'error');
                        }
                    }
                });
            }

            // Password modal submit
            const btnSubmitPass = document.getElementById('btnSubmitPasswordPrompt');
            if (btnSubmitPass) {
                btnSubmitPass.addEventListener('click', () => {
                    const passInput = document.getElementById('promptPasswordInput');
                    const pass = passInput ? passInput.value : '';
                    this.closePasswordModal();
                    if (this.pendingEncryptedToken) {
                        this.decryptAndDisplay(this.pendingEncryptedToken, pass);
                    }
                });
            }

            const btnCancelPass = document.getElementById('btnCancelPasswordPrompt');
            if (btnCancelPass) {
                btnCancelPass.addEventListener('click', () => this.closePasswordModal());
            }
        }

        async startCameraScan() {
            try {
                await this.cameraScanner.start();
                this.isScanningCamera = true;

                document.getElementById('scannerIdleState').style.display = 'none';
                document.getElementById('scannerActiveState').style.display = 'block';

                const torchBtn = document.getElementById('btnToggleTorch');
                if (torchBtn) {
                    torchBtn.style.display = this.cameraScanner.hasTorch ? 'inline-flex' : 'none';
                }
            } catch (e) {
                this.showToast('Could not access camera. Please allow camera permissions.', 'error');
            }
        }

        stopCameraScan() {
            this.cameraScanner.stop();
            this.isScanningCamera = false;

            const idle = document.getElementById('scannerIdleState');
            const active = document.getElementById('scannerActiveState');
            if (idle) idle.style.display = 'flex';
            if (active) active.style.display = 'none';
        }

        bindClipboardAndDrop() {
            // Drop zone on scan tab
            const scanDropZone = document.getElementById('scanDropZone');
            if (scanDropZone) {
                scanDropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    scanDropZone.classList.add('dragover');
                });
                scanDropZone.addEventListener('dragleave', () => scanDropZone.classList.remove('dragover'));
                scanDropZone.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    scanDropZone.classList.remove('dragover');
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        try {
                            const res = await window.AegisFileScanner.scanFile(e.dataTransfer.files[0]);
                            this.handleScannedString(res);
                        } catch (err) {
                            this.showToast(err.message, 'error');
                        }
                    }
                });
            }

            // Global clipboard paste listener on scan tab
            window.addEventListener('paste', async (e) => {
                if (this.activeTab !== 'scan') return;

                const file = window.AegisFileScanner.extractImageFromClipboard(e);
                if (file) {
                    this.showToast('Scanning pasted image...', 'info');
                    try {
                        const res = await window.AegisFileScanner.scanFile(file);
                        this.handleScannedString(res);
                    } catch (err) {
                        this.showToast(err.message, 'error');
                    }
                }
            });
        }

        // ==========================================
        // SCAN DECODE & DECRYPT
        // ==========================================
        handleScannedString(scannedString) {
            // First check if it is part of a chunked stream
            if (window.AegisAnimatedStream && window.AegisAnimatedStream.isChunkString(scannedString)) {
                this.chunkCollector.feed(scannedString);
                return;
            }

            window.AegisFeedback.playScanSuccess();
            this.decryptAndDisplay(scannedString);
        }

        async decryptAndDisplay(rawTokenOrUrl, password = '') {
            const resultsContainer = document.getElementById('scanResultOutput');
            const emptyScanState = document.getElementById('scanEmptyResult');

            try {
                // Check if password protected and no password provided yet
                const isProtected = window.AegisCipher.isPasswordProtected(rawTokenOrUrl);
                if (isProtected && !password) {
                    this.pendingEncryptedToken = rawTokenOrUrl;
                    this.openPasswordModal();
                    return;
                }

                const decrypted = await window.AegisCipher.decrypt(rawTokenOrUrl, password);

                if (emptyScanState) emptyScanState.style.display = 'none';
                if (resultsContainer) {
                    resultsContainer.style.display = 'block';
                    window.AegisDataViewer.render(resultsContainer, decrypted);
                }

                // Add to history
                this.addHistoryItem({
                    id: Date.now(),
                    date: new Date().toLocaleTimeString(),
                    type: decrypted.metadata.type || 'decrypted',
                    name: decrypted.metadata.name || 'Decrypted Payload',
                    size: decrypted.data.length,
                    isDecrypted: true
                });

                this.showToast('Decrypted and verified successfully!', 'success');
                // Scroll result into view
                resultsContainer?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (err) {
                console.error('Decryption failed:', err);
                if (err.message === 'PASSWORD_REQUIRED_OR_INVALID') {
                    this.showToast('Incorrect password. Please try again.', 'error');
                    this.pendingEncryptedToken = rawTokenOrUrl;
                    this.openPasswordModal(true);
                } else {
                    this.showToast(err.message, 'error');
                }
            }
        }

        openPasswordModal(isRetry = false) {
            const modal = document.getElementById('passwordPromptModal');
            const input = document.getElementById('promptPasswordInput');
            const errorMsg = document.getElementById('promptPasswordError');

            if (modal) modal.style.display = 'flex';
            if (input) {
                input.value = '';
                input.focus();
            }
            if (errorMsg) {
                errorMsg.style.display = isRetry ? 'block' : 'none';
            }
        }

        closePasswordModal() {
            const modal = document.getElementById('passwordPromptModal');
            if (modal) modal.style.display = 'none';
        }

        checkUrlForVaultPayload() {
            const token = window.AegisCipher.getVaultTokenFromUrl();
            if (token) {
                this.switchTab('scan');
                this.decryptAndDisplay(token);
            }
        }

        // ==========================================
        // HISTORY MANAGEMENT
        // ==========================================
        loadHistory() {
            try {
                const stored = localStorage.getItem(this.historyKey);
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                return [];
            }
        }

        saveHistory() {
            try {
                localStorage.setItem(this.historyKey, JSON.stringify(this.history.slice(0, 30)));
            } catch (e) {}
        }

        addHistoryItem(item) {
            this.history.unshift(item);
            this.saveHistory();
            this.renderHistory();
        }

        renderHistory() {
            const container = document.getElementById('historyListContainer');
            const emptyHistory = document.getElementById('historyEmptyState');
            if (!container) return;

            if (this.history.length === 0) {
                if (emptyHistory) emptyHistory.style.display = 'block';
                container.innerHTML = '';
                return;
            }

            if (emptyHistory) emptyHistory.style.display = 'none';
            container.innerHTML = '';

            this.history.slice(0, 15).forEach((item) => {
                const el = document.createElement('div');
                el.className = 'history-item-card glass-panel';
                el.innerHTML = `
                    <div class="history-item-info">
                        <span class="badge ${item.isDecrypted ? 'badge-success' : 'badge-neutral'}">${item.type.toUpperCase()}</span>
                        <h4>${item.name}</h4>
                        <p class="text-muted">${item.date} • ${Math.round(item.size / 1024 * 10) / 10} KB</p>
                    </div>
                    <div class="history-item-actions">
                        ${item.token ? `<button class="btn btn-sm btn-secondary btn-reload-history" data-token="${item.token}">Re-open</button>` : ''}
                    </div>
                `;

                const reloadBtn = el.querySelector('.btn-reload-history');
                if (reloadBtn) {
                    reloadBtn.addEventListener('click', () => {
                        this.switchTab('scan');
                        this.decryptAndDisplay(item.token);
                    });
                }

                container.appendChild(el);
            });
        }

        // ==========================================
        // TOAST NOTIFICATIONS
        // ==========================================
        showToast(message, type = 'info') {
            const toastContainer = document.getElementById('toastContainer');
            if (!toastContainer) return;

            const toast = document.createElement('div');
            toast.className = `toast toast-${type} animate-slide-in`;
            toast.textContent = message;

            toastContainer.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 400);
            }, 3200);
        }
    }

    // Initialize application on DOM ready
    window.addEventListener('DOMContentLoaded', () => {
        window.AegisApp = new App();
        window.AegisApp.init();
    });
})(window);
