/**
 * AegisQR - Universal Data Viewer & Downloader
 * Dynamically identifies decrypted data types and renders tailored, beautiful interactive
 * interfaces for images, audio, documents, vCards, Wi-Fi credentials, code, and arbitrary binary files.
 */

(function (window) {
    'use strict';

    function formatBytes(bytes, decimals = 1) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename || 'downloaded-file';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 500);
    }

    const DataViewer = {
        /**
         * Render decrypted result into the target container element
         * @param {HTMLElement} container
         * @param {Object} decryptedResult
         * @param {Object} decryptedResult.metadata
         * @param {Uint8Array} decryptedResult.data
         * @param {Function} decryptedResult.asText
         * @param {Function} decryptedResult.asBlob
         * @param {Function} decryptedResult.asDataUrl
         */
        render(container, decryptedResult) {
            container.innerHTML = '';
            const meta = decryptedResult.metadata || {};
            const type = meta.type || 'file';
            const filename = meta.name || 'unnamed-file';
            const mime = meta.mime || 'application/octet-stream';
            const sizeStr = formatBytes(decryptedResult.data.length);

            // Shell card
            const card = document.createElement('div');
            card.className = 'data-view-card glass-panel';

            // Card Header
            const header = document.createElement('div');
            header.className = 'data-view-header';
            header.innerHTML = `
                <div class="data-badge-group">
                    <span class="badge badge-success">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                        Decrypted & Verified
                    </span>
                    <span class="badge badge-neutral">${escapeHtml(type.toUpperCase())}</span>
                    <span class="badge badge-dim">${sizeStr}</span>
                </div>
                ${meta.note ? `<div class="data-note-text"><strong>Note:</strong> ${escapeHtml(meta.note)}</div>` : ''}
            `;
            card.appendChild(header);

            // Card Body (Type Specific)
            const body = document.createElement('div');
            body.className = 'data-view-body';

            if (type === 'image' || mime.startsWith('image/')) {
                this.renderImageView(body, decryptedResult, filename);
            } else if (type === 'audio' || mime.startsWith('audio/')) {
                this.renderAudioView(body, decryptedResult, filename);
            } else if (type === 'url') {
                this.renderUrlView(body, decryptedResult);
            } else if (type === 'vcard') {
                this.renderVCardView(body, decryptedResult);
            } else if (type === 'wifi') {
                this.renderWifiView(body, decryptedResult);
            } else if (type === 'json' || type === 'code') {
                this.renderCodeView(body, decryptedResult, filename, meta);
            } else if (type === 'text') {
                this.renderTextView(body, decryptedResult);
            } else {
                // Universal / Generic File
                this.renderGenericFileView(body, decryptedResult, filename, mime, sizeStr);
            }

            card.appendChild(body);
            container.appendChild(card);
        },

        renderImageView(body, result, filename) {
            const dataUrl = result.asDataUrl();
            body.innerHTML = `
                <div class="media-preview-container image-preview-box">
                    <img src="${dataUrl}" alt="${escapeHtml(filename)}" class="preview-image" id="lightboxImg">
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btnDownloadImage">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                        Download Image (${escapeHtml(filename)})
                    </button>
                    <button class="btn btn-secondary" id="btnCopyImage">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        Copy Image
                    </button>
                </div>
            `;

            body.querySelector('#btnDownloadImage').addEventListener('click', () => {
                triggerDownload(result.asBlob(), filename);
            });

            body.querySelector('#btnCopyImage').addEventListener('click', async () => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ [result.metadata.mime || 'image/png']: result.asBlob() })
                    ]);
                    window.AegisApp.showToast('Image copied to clipboard!', 'success');
                } catch (e) {
                    window.AegisApp.showToast('Could not copy image directly. Please use download.', 'warning');
                }
            });
        },

        renderAudioView(body, result, filename) {
            const dataUrl = result.asDataUrl();
            body.innerHTML = `
                <div class="audio-player-card">
                    <div class="audio-info">
                        <svg class="icon audio-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                        <div>
                            <h4>${escapeHtml(filename)}</h4>
                            <p class="text-muted">${escapeHtml(result.metadata.mime || 'Audio File')}</p>
                        </div>
                    </div>
                    <audio controls src="${dataUrl}" class="custom-audio-elem" style="width: 100%; margin: 16px 0;"></audio>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btnDownloadAudio">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                        Download Audio (${escapeHtml(filename)})
                    </button>
                </div>
            `;

            body.querySelector('#btnDownloadAudio').addEventListener('click', () => {
                triggerDownload(result.asBlob(), filename);
            });
        },

        renderUrlView(body, result) {
            const url = result.asText().trim();
            body.innerHTML = `
                <div class="url-card">
                    <div class="url-preview-chip">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
                        <span class="url-text">${escapeHtml(url)}</span>
                    </div>
                </div>
                <div class="view-actions">
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                        Open Link in New Tab
                    </a>
                    <button class="btn btn-secondary" id="btnCopyUrl">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        Copy URL
                    </button>
                </div>
            `;

            body.querySelector('#btnCopyUrl').addEventListener('click', () => {
                navigator.clipboard.writeText(url);
                window.AegisApp.showToast('URL copied to clipboard!', 'success');
            });
        },

        renderVCardView(body, result) {
            const vcardText = result.asText();
            // Simple vcard parser
            const fnMatch = vcardText.match(/FN:(.+)/i);
            const telMatch = vcardText.match(/TEL.*:(.+)/i);
            const emailMatch = vcardText.match(/EMAIL.*:(.+)/i);
            const orgMatch = vcardText.match(/ORG:(.+)/i);

            const name = fnMatch ? fnMatch[1].trim() : 'Contact';
            const tel = telMatch ? telMatch[1].trim() : '';
            const email = emailMatch ? emailMatch[1].trim() : '';
            const org = orgMatch ? orgMatch[1].trim() : '';

            body.innerHTML = `
                <div class="contact-card">
                    <div class="contact-avatar">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                    <div class="contact-info">
                        <h3>${escapeHtml(name)}</h3>
                        ${org ? `<p class="contact-org">${escapeHtml(org)}</p>` : ''}
                        ${tel ? `<p><a href="tel:${escapeHtml(tel)}" class="contact-link">📞 ${escapeHtml(tel)}</a></p>` : ''}
                        ${email ? `<p><a href="mailto:${escapeHtml(email)}" class="contact-link">✉️ ${escapeHtml(email)}</a></p>` : ''}
                    </div>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btnDownloadVcf">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        Download Contact (.vcf)
                    </button>
                    <button class="btn btn-secondary" id="btnCopyVcf">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        Copy Raw vCard
                    </button>
                </div>
            `;

            body.querySelector('#btnDownloadVcf').addEventListener('click', () => {
                triggerDownload(new Blob([vcardText], { type: 'text/vcard' }), `${name.replace(/\s+/g, '_')}.vcf`);
            });

            body.querySelector('#btnCopyVcf').addEventListener('click', () => {
                navigator.clipboard.writeText(vcardText);
                window.AegisApp.showToast('vCard copied to clipboard!', 'success');
            });
        },

        renderWifiView(body, result) {
            const wifiText = result.asText();
            // Format: WIFI:S:<SSID>;T:<WPA|WEP|nopass>;P:<password>;H:<true|false>;;
            const ssidMatch = wifiText.match(/S:([^;]+)/);
            const typeMatch = wifiText.match(/T:([^;]+)/);
            const passMatch = wifiText.match(/P:([^;]+)/);

            const ssid = ssidMatch ? ssidMatch[1] : 'Unknown Network';
            const secType = typeMatch ? typeMatch[1] : 'WPA/WPA2';
            const pass = passMatch ? passMatch[1] : '';

            body.innerHTML = `
                <div class="wifi-card">
                    <div class="wifi-header">
                        <svg class="icon wifi-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4zm0 3.5c3.5 0 6.69 1.4 9 3.68L12 19.78 3 11.18c2.31-2.28 5.5-3.68 9-3.68z"/></svg>
                        <div>
                            <h3>${escapeHtml(ssid)}</h3>
                            <span class="badge badge-accent">${escapeHtml(secType)}</span>
                        </div>
                    </div>
                    <div class="wifi-pass-row">
                        <label>Password:</label>
                        <div class="pass-field-wrap">
                            <input type="password" id="wifiPassInput" value="${escapeHtml(pass)}" readonly class="pass-input">
                            <button class="btn btn-sm btn-ghost" id="btnTogglePass">Show</button>
                        </div>
                    </div>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btnCopyWifiPass">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        Copy Password
                    </button>
                </div>
            `;

            const passInput = body.querySelector('#wifiPassInput');
            const toggleBtn = body.querySelector('#btnTogglePass');
            toggleBtn.addEventListener('click', () => {
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    toggleBtn.textContent = 'Hide';
                } else {
                    passInput.type = 'password';
                    toggleBtn.textContent = 'Show';
                }
            });

            body.querySelector('#btnCopyWifiPass').addEventListener('click', () => {
                navigator.clipboard.writeText(pass);
                window.AegisApp.showToast('Wi-Fi password copied!', 'success');
            });
        },

        renderCodeView(body, result, filename, meta) {
            const code = result.asText();
            const lineCount = code.split('\n').length;
            body.innerHTML = `
                <div class="code-viewer-container">
                    <div class="code-viewer-toolbar">
                        <span>${escapeHtml(filename || 'code-snippet.txt')} • ${lineCount} lines</span>
                        <button class="btn btn-sm btn-ghost" id="btnCopyCode">Copy Code</button>
                    </div>
                    <pre class="code-block"><code>${escapeHtml(code)}</code></pre>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btnDownloadCode">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        Download File (${escapeHtml(filename || 'code.txt')})
                    </button>
                </div>
            `;

            body.querySelector('#btnCopyCode').addEventListener('click', () => {
                navigator.clipboard.writeText(code);
                window.AegisApp.showToast('Code copied to clipboard!', 'success');
            });

            body.querySelector('#btnDownloadCode').addEventListener('click', () => {
                triggerDownload(result.asBlob(), filename || 'code.txt');
            });
        },

        renderTextView(body, result) {
            const text = result.asText();
            const charCount = text.length;
            const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

            body.innerHTML = `
                <div class="text-viewer-box">
                    <div class="text-viewer-meta">${wordCount} words • ${charCount} characters</div>
                    <div class="text-content-display">${escapeHtml(text)}</div>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btnCopyText">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        Copy Full Text
                    </button>
                    <button class="btn btn-secondary" id="btnDownloadText">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        Download as .txt
                    </button>
                </div>
            `;

            body.querySelector('#btnCopyText').addEventListener('click', () => {
                navigator.clipboard.writeText(text);
                window.AegisApp.showToast('Text copied to clipboard!', 'success');
            });

            body.querySelector('#btnDownloadText').addEventListener('click', () => {
                triggerDownload(result.asBlob(), 'decrypted-note.txt');
            });
        },

        renderGenericFileView(body, result, filename, mime, sizeStr) {
            body.innerHTML = `
                <div class="generic-file-card">
                    <div class="file-icon-large">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                    </div>
                    <div class="file-card-details">
                        <h3 class="file-name">${escapeHtml(filename)}</h3>
                        <p class="file-meta">
                            <span>MIME: ${escapeHtml(mime)}</span> • 
                            <span>Size: ${sizeStr}</span>
                        </p>
                    </div>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary btn-lg" id="btnDownloadGeneric">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                        Download File (${escapeHtml(filename)})
                    </button>
                </div>
            `;

            body.querySelector('#btnDownloadGeneric').addEventListener('click', () => {
                triggerDownload(result.asBlob(), filename);
            });
        }
    };

    window.AegisDataViewer = DataViewer;
})(window);
