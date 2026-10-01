/**
 * AegisQR - Animated QR Stream Chunker & Sequencer
 * Solves the physical QR code data density barrier!
 * Splits arbitrary payloads into high-reliability sequential frames (like Keystone/AirGap hardware vaults)
 * allowing files of tens of kilobytes to be transferred screen-to-screen over an air-gapped camera stream.
 */

(function (window) {
    'use strict';

    const DEFAULT_CHUNK_SIZE = 750; // Optimized for high-speed, instant camera recognition

    class AnimatedStreamPlayer {
        constructor() {
            this.chunks = [];
            this.transferId = '';
            this.currentIndex = 0;
            this.timer = null;
            this.fps = 5; // 5 frames per second
            this.isPlaying = false;
            this.listeners = [];
        }

        /**
         * Prepare payload into chunk frames
         * @param {string} fullPayload
         * @param {number} [chunkSize=DEFAULT_CHUNK_SIZE]
         */
        prepare(fullPayload, chunkSize = DEFAULT_CHUNK_SIZE) {
            this.stop();
            this.chunks = [];
            this.currentIndex = 0;

            // Generate short random transfer ID (4 hex chars)
            this.transferId = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');

            if (fullPayload.length <= chunkSize) {
                // Single frame is sufficient
                this.chunks = [
                    {
                        index: 1,
                        total: 1,
                        transferId: this.transferId,
                        data: fullPayload,
                        frameString: fullPayload,
                        isMultiPart: false
                    }
                ];
                return this.chunks;
            }

            const totalChunks = Math.ceil(fullPayload.length / chunkSize);
            for (let i = 0; i < totalChunks; i++) {
                const chunkData = fullPayload.substring(i * chunkSize, (i + 1) * chunkSize);
                // Format: AQR1:C:<transferId>:<index>:<total>:<chunkData>
                const frameString = `AQR1:C:${this.transferId}:${i + 1}:${totalChunks}:${chunkData}`;
                this.chunks.push({
                    index: i + 1,
                    total: totalChunks,
                    transferId: this.transferId,
                    data: chunkData,
                    frameString: frameString,
                    isMultiPart: true
                });
            }

            return this.chunks;
        }

        /**
         * Subscribe to frame changes
         */
        onFrame(callback) {
            this.listeners.push(callback);
        }

        notify() {
            const frame = this.chunks[this.currentIndex];
            for (const cb of this.listeners) {
                try {
                    cb(frame, this.currentIndex, this.chunks.length);
                } catch (e) {
                    console.error('Frame listener error:', e);
                }
            }
        }

        /**
         * Start auto-play animation
         */
        play(fps = this.fps) {
            this.fps = Math.max(1, Math.min(15, fps));
            this.isPlaying = true;
            this.stopTimer();

            const interval = 1000 / this.fps;
            this.notify();

            this.timer = setInterval(() => {
                if (this.chunks.length <= 1) return;
                this.currentIndex = (this.currentIndex + 1) % this.chunks.length;
                this.notify();
            }, interval);
        }

        pause() {
            this.isPlaying = false;
            this.stopTimer();
        }

        stop() {
            this.isPlaying = false;
            this.stopTimer();
            this.currentIndex = 0;
        }

        stopTimer() {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        }

        setFps(fps) {
            this.fps = fps;
            if (this.isPlaying) {
                this.play(fps);
            }
        }

        next() {
            if (this.chunks.length === 0) return;
            this.currentIndex = (this.currentIndex + 1) % this.chunks.length;
            this.notify();
        }

        prev() {
            if (this.chunks.length === 0) return;
            this.currentIndex = (this.currentIndex - 1 + this.chunks.length) % this.chunks.length;
            this.notify();
        }

        goTo(index) {
            if (index >= 0 && index < this.chunks.length) {
                this.currentIndex = index;
                this.notify();
            }
        }

        getCurrentFrame() {
            return this.chunks[this.currentIndex] || null;
        }
    }

    window.AegisAnimatedStream = {
        DEFAULT_CHUNK_SIZE,
        createPlayer: () => new AnimatedStreamPlayer(),
        isChunkString(str) {
            return typeof str === 'string' && str.startsWith('AQR1:C:');
        },
        parseChunkString(str) {
            // AQR1:C:<transferId>:<index>:<total>:<chunkData>
            if (!this.isChunkString(str)) return null;
            const parts = str.split(':');
            if (parts.length < 6) return null;
            return {
                prefix: parts[0],
                flag: parts[1],
                transferId: parts[2],
                index: parseInt(parts[3], 10),
                total: parseInt(parts[4], 10),
                chunkData: parts.slice(5).join(':') // in case chunkData has colons
            };
        }
    };
})(window);
