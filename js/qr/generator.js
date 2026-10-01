/**
 * AegisQR - QR Code Generator Engine
 * Wraps and enhances EasyQRCode with responsive sizing, custom gradient palettes,
 * custom eye designs, logo badges, and error correction levels.
 */

(function (window) {
    'use strict';

    // Built-in center logos (SVG data URIs for crisp vector rendering)
    const EMBEDDED_LOGOS = {
        shield: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2300f2fe"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>',
        lock: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%237928ca"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>',
        key: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2300ff88"><path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31.84 2.41 2 2.83V21c0 .55.45 1 1 1s1-.45 1-1v-1.17c1.16-.42 2-1.52 2-2.83 0-1.66-1.34-3-3-3zm14-11l-9.04 9.04C11.31 12.37 10.22 12 9 12 5.69 12 3 14.69 3 18s2.69 6 6 6 6-2.69 6-6c0-1.22-.37-2.31-1.04-2.96L16 13v-2h2V9h2V7h2V3h-1z"/></svg>',
        none: null
    };

    const THEME_PALETTES = {
        'obsidian-cyan': {
            name: 'Obsidian Cyan (Default)',
            dotColor: '#00F2FE',
            dotColorDark: '#0072FF',
            bgColor: '#0B0F17',
            eyeColorOuter: '#00F2FE',
            eyeColorInner: '#4FACFE'
        },
        'neon-violet': {
            name: 'Neon Violet',
            dotColor: '#9D4EDD',
            dotColorDark: '#5A189A',
            bgColor: '#0D0B18',
            eyeColorOuter: '#C77DFF',
            eyeColorInner: '#7B2CBF'
        },
        'matrix-emerald': {
            name: 'Matrix Emerald',
            dotColor: '#00FF88',
            dotColorDark: '#00B050',
            bgColor: '#0A1510',
            eyeColorOuter: '#00FF88',
            eyeColorInner: '#10B981'
        },
        'solar-amber': {
            name: 'Solar Amber',
            dotColor: '#FFB703',
            dotColorDark: '#FB8500',
            bgColor: '#17120A',
            eyeColorOuter: '#FFB703',
            eyeColorInner: '#FB8500'
        },
        'monochrome-dark': {
            name: 'Monochrome Dark',
            dotColor: '#E2E8F0',
            dotColorDark: '#94A3B8',
            bgColor: '#0F172A',
            eyeColorOuter: '#FFFFFF',
            eyeColorInner: '#38BDF8'
        },
        'monochrome-light': {
            name: 'Monochrome High-Contrast',
            dotColor: '#0A0A0A',
            dotColorDark: '#1E293B',
            bgColor: '#FFFFFF',
            eyeColorOuter: '#000000',
            eyeColorInner: '#000000'
        }
    };

    class QRGenerator {
        constructor() {
            this.instance = null;
            this.container = null;
            this.lastConfig = null;
        }

        /**
         * Render a styled QR code inside container element
         * @param {HTMLElement} container
         * @param {string} text
         * @param {Object} options
         */
        render(container, text, options = {}) {
            if (!container) throw new Error('Container element required for QR rendering.');
            this.container = container;
            container.innerHTML = '';

            const themeKey = options.theme || 'obsidian-cyan';
            const theme = THEME_PALETTES[themeKey] || THEME_PALETTES['obsidian-cyan'];

            const width = options.width || 320;
            const height = options.height || 320;

            // Map ECC Level string to QRCode.CorrectLevel
            let correctLevel = QRCode.CorrectLevel.M;
            if (options.ecc === 'L') correctLevel = QRCode.CorrectLevel.L;
            if (options.ecc === 'M') correctLevel = QRCode.CorrectLevel.M;
            if (options.ecc === 'Q') correctLevel = QRCode.CorrectLevel.Q;
            if (options.ecc === 'H') correctLevel = QRCode.CorrectLevel.H;

            // Logo configuration
            let logoSrc = null;
            if (options.logo && options.logo !== 'none') {
                logoSrc = EMBEDDED_LOGOS[options.logo] || options.customLogo || null;
            }

            // Dot style: 'rounded', 'dot', 'square'
            let dotScale = 1;
            if (options.dotStyle === 'rounded') dotScale = 0.85;
            if (options.dotStyle === 'dot') dotScale = 0.65;

            const qrConfig = {
                text: text,
                width: width,
                height: height,
                colorDark: theme.dotColor,
                colorLight: theme.bgColor,
                correctLevel: correctLevel,
                quietZone: 16,
                quietZoneColor: theme.bgColor,
                dotScale: dotScale,
                // EasyQRCode styling parameters
                drawer: 'canvas',
                // Corner Eye styling
                PO: theme.eyeColorOuter, // Outer square
                PI: theme.eyeColorInner, // Inner square
                PO_TL: theme.eyeColorOuter,
                PI_TL: theme.eyeColorInner,
                PO_TR: theme.eyeColorOuter,
                PI_TR: theme.eyeColorInner,
                PO_BL: theme.eyeColorOuter,
                PI_BL: theme.eyeColorInner
            };

            // If gradient option enabled
            if (options.useGradient) {
                qrConfig.colorDark = theme.dotColor;
                qrConfig.linearGradient = [0, 0, width, height, [
                    [0, theme.dotColor],
                    [1, theme.dotColorDark]
                ]];
            }

            if (logoSrc) {
                qrConfig.logo = logoSrc;
                qrConfig.logoWidth = Math.round(width * 0.22);
                qrConfig.logoHeight = Math.round(height * 0.22);
                qrConfig.logoBackgroundColor = theme.bgColor;
                qrConfig.logoBackgroundTransparent = false;
            }

            this.lastConfig = { ...qrConfig, rawOptions: options, originalText: text };
            this.instance = new QRCode(container, qrConfig);

            return this.instance;
        }

        /**
         * Get the generated canvas element
         */
        getCanvas() {
            if (!this.container) return null;
            return this.container.querySelector('canvas');
        }

        /**
         * Export current QR code as high-resolution PNG data URL
         * @param {number} [scale=1] - 1 = normal, 2 = 2x, 4 = 4x (print ready)
         */
        exportDataUrl(scale = 1) {
            const canvas = this.getCanvas();
            if (!canvas) return null;

            if (scale === 1) {
                return canvas.toDataURL('image/png');
            }

            // Create offscreen scaled canvas for pristine print resolution
            const scaledCanvas = document.createElement('canvas');
            scaledCanvas.width = canvas.width * scale;
            scaledCanvas.height = canvas.height * scale;
            const ctx = scaledCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = false; // keep crisp edges
            ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
            return scaledCanvas.toDataURL('image/png');
        }
    }

    window.AegisQRGenerator = {
        THEME_PALETTES,
        EMBEDDED_LOGOS,
        create: () => new QRGenerator()
    };
})(window);
