/**
 * AegisQR - Exporter & Share Engine
 * Handles exporting generated QR codes into multiple formats:
 * - High-DPI PNG (1x, 2x, 4x print resolution)
 * - Vector SVG
 * - Printable Air-Gap Transfer Card
 * - Native Web Share API
 * - Direct Copy to System Clipboard (PNG Blob)
 */

(function (window) {
    'use strict';

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 300);
    }

    const Exporter = {
        /**
         * Download QR code as PNG image
         * @param {HTMLCanvasElement} canvas
         * @param {string} [filename='aegis-qr.png']
         * @param {number} [scale=1]
         */
        async downloadPng(canvas, filename = 'aegis-qr.png', scale = 1) {
            if (!canvas) throw new Error('No QR canvas available to export.');

            let targetCanvas = canvas;
            if (scale > 1) {
                targetCanvas = document.createElement('canvas');
                targetCanvas.width = canvas.width * scale;
                targetCanvas.height = canvas.height * scale;
                const ctx = targetCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(canvas, 0, 0, targetCanvas.width, targetCanvas.height);
            }

            targetCanvas.toBlob((blob) => {
                if (blob) {
                    downloadBlob(blob, filename);
                }
            }, 'image/png');
        },

        /**
         * Download QR code as SVG
         * @param {HTMLElement} qrContainer
         * @param {string} [filename='aegis-qr.svg']
         */
        downloadSvg(qrContainer, filename = 'aegis-qr.svg') {
            const svgElem = qrContainer.querySelector('svg');
            if (svgElem) {
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(svgElem);
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                downloadBlob(blob, filename);
                return;
            }

            // Fallback: If drawn on canvas, embed canvas PNG into an SVG container
            const canvas = qrContainer.querySelector('canvas');
            if (canvas) {
                const dataUrl = canvas.toDataURL('image/png');
                const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}"/></svg>`;
                const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                downloadBlob(blob, filename);
                return;
            }

            throw new Error('No QR element found for SVG export.');
        },

        /**
         * Copy QR Code PNG directly to system clipboard
         * @param {HTMLCanvasElement} canvas
         */
        async copyImageToClipboard(canvas) {
            if (!canvas) throw new Error('No canvas available to copy.');
            if (!navigator.clipboard || !window.ClipboardItem) {
                throw new Error('Clipboard image writing is not supported by your browser.');
            }

            return new Promise((resolve, reject) => {
                canvas.toBlob(async (blob) => {
                    try {
                        const item = new ClipboardItem({ 'image/png': blob });
                        await navigator.clipboard.write([item]);
                        resolve(true);
                    } catch (err) {
                        reject(err);
                    }
                }, 'image/png');
            });
        },

        /**
         * Share via Native Device Web Share API
         * @param {Object} options
         * @param {HTMLCanvasElement} [options.canvas]
         * @param {string} [options.title]
         * @param {string} [options.text]
         * @param {string} [options.url]
         */
        async shareNative({ canvas, title = 'AegisQR Encrypted Vault', text = 'Scan with AegisQR to decrypt and view payload.', url = '' }) {
            if (!navigator.share) {
                throw new Error('Web Share API is not supported on this device/browser.');
            }

            const shareData = { title, text };
            if (url) shareData.url = url;

            if (canvas && navigator.canShare) {
                try {
                    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
                    const file = new File([blob], 'aegis-qr.png', { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        shareData.files = [file];
                    }
                } catch (e) {
                    console.warn('Could not attach file to share data:', e);
                }
            }

            await navigator.share(shareData);
            return true;
        },

        /**
         * Open print-ready Card modal/window for printing air-gapped QR sheets
         * @param {Object} details
         */
        printCard({ canvas, title = 'AegisQR Secure Vault', note = '', metadata = {}, date = new Date().toLocaleDateString() }) {
            const dataUrl = canvas.toDataURL('image/png');
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                throw new Error('Pop-up was blocked. Please allow pop-ups to print QR card.');
            }

            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>AegisQR Printable Transfer Card</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #fff;
            color: #111;
            margin: 0;
            padding: 40px;
            display: flex;
            justify-content: center;
        }
        .card {
            border: 2px dashed #333;
            border-radius: 16px;
            padding: 32px;
            max-width: 480px;
            width: 100%;
            text-align: center;
            box-sizing: border-box;
        }
        .badge {
            display: inline-block;
            background: #000;
            color: #00f2fe;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 16px;
        }
        h2 { margin: 8px 0; font-size: 22px; }
        p.subtitle { color: #555; font-size: 13px; margin: 4px 0 20px 0; }
        .qr-wrap {
            padding: 16px;
            background: #f8fafc;
            border-radius: 12px;
            display: inline-block;
            margin-bottom: 20px;
            border: 1px solid #e2e8f0;
        }
        .qr-wrap img { width: 280px; height: 280px; display: block; }
        .meta-table {
            width: 100%;
            font-size: 12px;
            text-align: left;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .meta-table td { padding: 6px 4px; border-bottom: 1px solid #eee; }
        .meta-table td.label { color: #666; font-weight: 600; width: 35%; }
        .notice {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
            padding: 10px;
            border-radius: 8px;
            font-size: 11px;
            line-height: 1.4;
        }
        @media print {
            body { padding: 0; }
            .card { border-color: #000; }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">AegisQR • Encrypted Vault</div>
        <h2>${title}</h2>
        <p class="subtitle">Air-Gapped QR Transfer • AES-256-GCM Authenticated</p>
        
        <div class="qr-wrap">
            <img src="${dataUrl}" alt="AegisQR Code">
        </div>

        <table class="meta-table">
            <tr><td class="label">Data Type:</td><td>${metadata.type || 'Encrypted Payload'}</td></tr>
            ${metadata.name ? `<tr><td class="label">File Name:</td><td>${metadata.name}</td></tr>` : ''}
            ${metadata.size ? `<tr><td class="label">Size:</td><td>${Math.round(metadata.size / 1024 * 10) / 10} KB</td></tr>` : ''}
            ${note ? `<tr><td class="label">Note:</td><td>${note}</td></tr>` : ''}
            <tr><td class="label">Created Date:</td><td>${date}</td></tr>
            <tr><td class="label">Security:</td><td>Exclusive AegisQR Decryption</td></tr>
        </table>

        <div class="notice">
            <strong>How to Decrypt:</strong> Scan this QR code using the AegisQR web scanner. Standard third-party barcode readers cannot read this encrypted data.
        </div>
    </div>
    <script>
        window.onload = function() {
            setTimeout(() => { window.print(); }, 250);
        };
    </script>
</body>
</html>`;
            printWindow.document.write(html);
            printWindow.document.close();
        }
    };

    window.AegisExporter = Exporter;
})(window);
