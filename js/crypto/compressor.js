/**
 * AegisQR - Compressor Module
 * Utilizes standard DEFLATE / INFLATE compression (via Pako) to pack maximal data
 * into QR code capacity (yielding 40-80% size reductions for text, JSON, and files).
 */

(function (window) {
    'use strict';

    const Compressor = {
        /**
         * Compress a Uint8Array or string using DEFLATE
         * @param {Uint8Array|string} input
         * @returns {Uint8Array}
         */
        compress(input) {
            try {
                if (typeof input === 'string') {
                    const encoder = new TextEncoder();
                    input = encoder.encode(input);
                }
                if (window.pako && window.pako.deflate) {
                    return window.pako.deflate(input, { level: 9 });
                }
                // Fallback: return uncompressed if pako isn't loaded
                console.warn('Pako not detected, passing uncompressed bytes.');
                return input instanceof Uint8Array ? input : new Uint8Array(input);
            } catch (err) {
                console.error('Compression error:', err);
                return input instanceof Uint8Array ? input : new TextEncoder().encode(input);
            }
        },

        /**
         * Decompress DEFLATE data back to Uint8Array or string
         * @param {Uint8Array} compressedBytes
         * @param {boolean} asString
         * @returns {Uint8Array|string}
         */
        decompress(compressedBytes, asString = false) {
            try {
                if (window.pako && window.pako.inflate) {
                    if (asString) {
                        return window.pako.inflate(compressedBytes, { to: 'string' });
                    }
                    return window.pako.inflate(compressedBytes);
                }
                // Fallback
                if (asString) {
                    return new TextDecoder().decode(compressedBytes);
                }
                return compressedBytes;
            } catch (err) {
                console.error('Decompression error:', err);
                throw new Error('Failed to decompress payload. Data may be corrupted.');
            }
        },

        /**
         * Calculate compression savings percentage
         */
        getSavings(originalLength, compressedLength) {
            if (!originalLength || originalLength <= 0) return 0;
            const diff = originalLength - compressedLength;
            return Math.max(0, Math.round((diff / originalLength) * 100));
        }
    };

    window.AegisCompressor = Compressor;
})(window);
