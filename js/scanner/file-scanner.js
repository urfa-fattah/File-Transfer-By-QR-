/**
 * AegisQR - File & Clipboard QR Scanner
 * Enables scanning QR codes directly from image uploads, drag-and-drop zones,
 * and system clipboard paste events (Ctrl+V).
 */

(function (window) {
    'use strict';

    const FileScanner = {
        /**
         * Scan a QR code from an Image File or Blob
         * @param {File|Blob} file
         * @returns {Promise<string>}
         */
        async scanFile(file) {
            if (!file || !file.type.startsWith('image/')) {
                throw new Error('Please select a valid image file containing a QR code.');
            }

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const result = await this.scanImageUrl(e.target.result);
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => reject(new Error('Failed to read image file.'));
                reader.readAsDataURL(file);
            });
        },

        /**
         * Scan a QR code from an Image Data URL or Object URL
         * @param {string} src
         * @returns {Promise<string>}
         */
        scanImageUrl(src) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    if (!window.jsQR) {
                        return reject(new Error('QR Decoder library is not loaded.'));
                    }

                    // Attempt 1: Standard read
                    let code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: 'attemptBoth'
                    });

                    if (code && code.data) {
                        return resolve(code.data);
                    }

                    // Attempt 2: High-contrast binarization fallback for stylized/gradient QR images
                    const enhancedData = this.preprocessContrast(imageData);
                    code = window.jsQR(enhancedData.data, enhancedData.width, enhancedData.height, {
                        inversionAttempts: 'attemptBoth'
                    });

                    if (code && code.data) {
                        return resolve(code.data);
                    }

                    reject(new Error('No QR code could be detected in this image. Please ensure the QR code is clearly visible.'));
                };
                img.onerror = () => reject(new Error('Failed to load image for scanning.'));
                img.src = src;
            });
        },

        /**
         * Enhance image contrast to help jsQR decode custom gradient / stylized QR codes
         */
        preprocessContrast(imageData) {
            const data = new Uint8ClampedArray(imageData.data);
            const len = data.length;

            for (let i = 0; i < len; i += 4) {
                // Grayscale luminance
                const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                // High contrast threshold
                const val = avg > 128 ? 255 : 0;
                data[i] = val;
                data[i + 1] = val;
                data[i + 2] = val;
            }

            return new ImageData(data, imageData.width, imageData.height);
        },

        /**
         * Check and extract image from a Clipboard Event
         * @param {ClipboardEvent} event
         * @returns {File|null}
         */
        extractImageFromClipboard(event) {
            const items = (event.clipboardData || event.originalEvent.clipboardData).items;
            if (!items) return null;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    return items[i].getAsFile();
                }
            }
            return null;
        }
    };

    window.AegisFileScanner = FileScanner;
})(window);
