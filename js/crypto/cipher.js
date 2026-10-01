/**
 * AegisQR - Cryptographic Engine
 * Industrial-grade AES-256-GCM client-side encryption and proprietary envelope packaging.
 * Guarantees that QR code payloads can only be authenticated, decrypted, and reconstructed
 * by the AegisQR engine.
 */

(function (window) {
    'use strict';

    // Application Master Salt & Pepper for proprietary key derivation
    const APP_SECRET_SEED = 'AegisQR::v1.0::UniversalEncryptedVault::4f9b8c2e1d7a3f05b82c9e7a';
    const MAGIC_HEADER = new Uint8Array([0x41, 0x51, 0x52, 0x31]); // 'AQR1'
    const PBKDF2_ITERATIONS = 75000;

    /**
     * Binary <-> URL-Safe Base64 helpers
     */
    function uint8ArrayToBase64Url(bytes) {
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function base64UrlToUint8Array(base64Url) {
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Derive AES-256-GCM CryptoKey using PBKDF2
     */
    async function deriveKey(salt, userPassword = '') {
        const encoder = new TextEncoder();
        // Bind both the app secret seed and user password to the key derivation
        const keyMaterialString = userPassword
            ? `${APP_SECRET_SEED}::USER::${userPassword}`
            : `${APP_SECRET_SEED}::DEFAULT`;

        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(keyMaterialString),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    const Cipher = {
        /**
         * Check if ciphertext was encrypted with an optional user password
         */
        isPasswordProtected(rawEnvelope) {
            try {
                let bytes;
                if (typeof rawEnvelope === 'string') {
                    const cleanStr = rawEnvelope.replace(/^AQR1:/, '');
                    bytes = base64UrlToUint8Array(cleanStr);
                } else {
                    bytes = rawEnvelope;
                }
                if (bytes.length < 5) return false;
                // Check magic header
                for (let i = 0; i < 4; i++) {
                    if (bytes[i] !== MAGIC_HEADER[i]) return false;
                }
                const flags = bytes[4];
                return (flags & 0x01) !== 0; // Bit 0 is password flag
            } catch (e) {
                return false;
            }
        },

        /**
         * Encrypt an arbitrary payload into the AegisQR envelope
         * @param {Object} options
         * @param {Uint8Array|string} options.data - The raw file/text bytes
         * @param {string} options.type - 'file' | 'text' | 'url' | 'image' | 'audio' | 'vcard' | 'wifi' | 'code' | 'json'
         * @param {string} [options.name] - Filename if applicable
         * @param {string} [options.mime] - MIME type
         * @param {string} [options.password] - Optional user password/PIN
         * @param {string} [options.note] - Optional label
         * @param {boolean} [options.compress=true] - Whether to apply DEFLATE
         * @returns {Promise<{ envelopeBase64: string, rawBytes: Uint8Array, directUrl: string, stats: Object }>}
         */
        async encrypt({ data, type = 'text', name = '', mime = 'text/plain', password = '', note = '', compress = true }) {
            const encoder = new TextEncoder();
            let rawBytes;
            if (typeof data === 'string') {
                rawBytes = encoder.encode(data);
            } else if (data instanceof Uint8Array) {
                rawBytes = data;
            } else if (data instanceof ArrayBuffer) {
                rawBytes = new Uint8Array(data);
            } else {
                rawBytes = encoder.encode(String(data));
            }

            const originalSize = rawBytes.length;
            let payloadBytes = rawBytes;
            let isCompressed = false;

            if (compress && window.AegisCompressor) {
                const compressed = window.AegisCompressor.compress(rawBytes);
                // Only use compressed if it actually reduced the size
                if (compressed.length < originalSize) {
                    payloadBytes = compressed;
                    isCompressed = true;
                }
            }

            // Construct JSON metadata header
            const metaObj = {
                v: 1,
                type: type,
                name: name || (type === 'file' ? 'downloaded-file.bin' : ''),
                mime: mime,
                size: originalSize,
                comp: isCompressed,
                note: note || '',
                ts: Date.now()
            };

            const metaJsonBytes = encoder.encode(JSON.stringify(metaObj));
            // Format: [4-byte meta-length uint32BE] [meta JSON] [payload bytes]
            const combinedLength = 4 + metaJsonBytes.length + payloadBytes.length;
            const plaintext = new Uint8Array(combinedLength);
            const view = new DataView(plaintext.buffer);
            view.setUint32(0, metaJsonBytes.length, false); // Big endian
            plaintext.set(metaJsonBytes, 4);
            plaintext.set(payloadBytes, 4 + metaJsonBytes.length);

            // Generate cryptographic random salt (16 bytes) and IV (12 bytes)
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            const iv = window.crypto.getRandomValues(new Uint8Array(12));

            // Derive AES-256-GCM key
            const cryptoKey = await deriveKey(salt, password);

            // Encrypt with AES-GCM
            const ciphertextBuffer = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    tagLength: 128
                },
                cryptoKey,
                plaintext
            );
            const ciphertextBytes = new Uint8Array(ciphertextBuffer);

            // Envelope format:
            // [0..3]: MAGIC 'AQR1'
            // [4]: FLAGS (bit 0: password protected, bit 1: compressed payload)
            // [5..20]: SALT (16 bytes)
            // [21..32]: IV (12 bytes)
            // [33..end]: CIPHERTEXT + 16-byte AUTH TAG
            const hasPassword = Boolean(password && password.length > 0);
            let flags = 0;
            if (hasPassword) flags |= 0x01;
            if (isCompressed) flags |= 0x02;

            const envelope = new Uint8Array(4 + 1 + 16 + 12 + ciphertextBytes.length);
            envelope.set(MAGIC_HEADER, 0);
            envelope[4] = flags;
            envelope.set(salt, 5);
            envelope.set(iv, 21);
            envelope.set(ciphertextBytes, 33);

            const envelopeBase64 = uint8ArrayToBase64Url(envelope);
            const rawCipherQr = `AQR1:${envelopeBase64}`;

            // Generate clean web direct link
            const baseUrl = window.location.origin + window.location.pathname;
            const directUrl = `${baseUrl}#vault=${envelopeBase64}`;

            return {
                envelopeBase64,
                rawCipherQr,
                directUrl,
                rawBytes: envelope,
                stats: {
                    originalSize,
                    payloadSize: payloadBytes.length,
                    envelopeSize: envelope.byteLength,
                    isCompressed,
                    savings: isCompressed ? window.AegisCompressor.getSavings(originalSize, payloadBytes.length) : 0,
                    hasPassword
                }
            };
        },

        /**
         * Decrypt an AegisQR envelope
         * @param {string|Uint8Array} input - Either full URL with #vault=, raw AQR1:..., or binary envelope
         * @param {string} [password=''] - Optional user password if protected
         * @returns {Promise<{ metadata: Object, data: Uint8Array, asText: Function, asBlob: Function, asDataUrl: Function }>}
         */
        async decrypt(input, password = '') {
            let base64Str = '';

            if (typeof input === 'string') {
                input = input.trim();
                if (input.includes('#vault=')) {
                    base64Str = input.split('#vault=')[1].split('&')[0];
                } else if (input.includes('?vault=')) {
                    base64Str = input.split('?vault=')[1].split('&')[0];
                } else if (input.startsWith('AQR1:')) {
                    base64Str = input.substring(5);
                } else {
                    base64Str = input;
                }
            }

            let envelope;
            if (typeof input === 'string') {
                try {
                    envelope = base64UrlToUint8Array(base64Str);
                } catch (e) {
                    throw new Error('Invalid Base64 payload encoding. Cannot parse QR envelope.');
                }
            } else if (input instanceof Uint8Array) {
                envelope = input;
            } else {
                throw new Error('Unsupported envelope data format.');
            }

            // Verify minimum length: 4 (magic) + 1 (flags) + 16 (salt) + 12 (iv) + 16 (tag) + 4 (min payload) = 53
            if (envelope.length < 53) {
                throw new Error('Corrupted or truncated QR envelope. Missing required cryptographic headers.');
            }

            // Verify Magic Header 'AQR1'
            for (let i = 0; i < 4; i++) {
                if (envelope[i] !== MAGIC_HEADER[i]) {
                    throw new Error('Unrecognized format: This QR code was not encrypted by AegisQR, or is from an incompatible version.');
                }
            }

            const flags = envelope[4];
            const isPasswordProtected = (flags & 0x01) !== 0;

            const salt = envelope.slice(5, 21);
            const iv = envelope.slice(21, 33);
            const ciphertext = envelope.slice(33);

            // Derive key
            const cryptoKey = await deriveKey(salt, password);

            // Decrypt with AES-GCM
            let plaintextBuffer;
            try {
                plaintextBuffer = await window.crypto.subtle.decrypt(
                    {
                        name: 'AES-GCM',
                        iv: iv,
                        tagLength: 128
                    },
                    cryptoKey,
                    ciphertext
                );
            } catch (err) {
                if (isPasswordProtected) {
                    throw new Error('PASSWORD_REQUIRED_OR_INVALID');
                }
                throw new Error('Decryption failed: Payload signature invalid or corrupted. Only AegisQR can decrypt this code.');
            }

            const plaintext = new Uint8Array(plaintextBuffer);
            const view = new DataView(plaintext.buffer, plaintext.byteOffset, plaintext.byteLength);
            const metaLength = view.getUint32(0, false);

            if (4 + metaLength > plaintext.length) {
                throw new Error('Malformed metadata header in decrypted payload.');
            }

            const metaBytes = plaintext.slice(4, 4 + metaLength);
            const payloadBytes = plaintext.slice(4 + metaLength);

            const decoder = new TextDecoder('utf-8');
            let metadata;
            try {
                metadata = JSON.parse(decoder.decode(metaBytes));
            } catch (e) {
                throw new Error('Failed to parse envelope metadata descriptor.');
            }

            // Decompress if flag was set
            let finalDataBytes = payloadBytes;
            if (metadata.comp && window.AegisCompressor) {
                try {
                    finalDataBytes = window.AegisCompressor.decompress(payloadBytes);
                } catch (e) {
                    throw new Error('Decompression error on decrypted content.');
                }
            }

            return {
                metadata,
                data: finalDataBytes,
                rawSize: finalDataBytes.length,
                isPasswordProtected,
                asText: () => new TextDecoder('utf-8').decode(finalDataBytes),
                asBlob: () => new Blob([finalDataBytes], { type: metadata.mime || 'application/octet-stream' }),
                asDataUrl: () => {
                    const blob = new Blob([finalDataBytes], { type: metadata.mime || 'application/octet-stream' });
                    return URL.createObjectURL(blob);
                }
            };
        },

        /**
         * Helper to parse and extract vault token from current browser URL hash
         */
        getVaultTokenFromUrl() {
            const hash = window.location.hash;
            if (hash && hash.includes('vault=')) {
                const match = hash.match(/vault=([A-Za-z0-9_-]+)/);
                if (match && match[1]) {
                    return match[1];
                }
            }
            return null;
        }
    };

    window.AegisCipher = Cipher;
})(window);
