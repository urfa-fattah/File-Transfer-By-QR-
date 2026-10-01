/**
 * AegisQR - Chunk Collector
 * Assembles multi-part animated QR stream frames in real time as the camera captures them.
 */

(function (window) {
    'use strict';

    class ChunkCollector {
        constructor() {
            this.transferId = null;
            this.totalChunks = 0;
            this.chunks = [];
            this.receivedSet = new Set();
            this.isComplete = false;

            this.onProgressCb = null;
            this.onCompleteCb = null;
        }

        reset() {
            this.transferId = null;
            this.totalChunks = 0;
            this.chunks = [];
            this.receivedSet = new Set();
            this.isComplete = false;
        }

        onProgress(callback) {
            this.onProgressCb = callback;
        }

        onComplete(callback) {
            this.onCompleteCb = callback;
        }

        /**
         * Process a scanned QR string
         * @param {string} qrString
         * @returns {boolean} true if complete or processed
         */
        feed(qrString) {
            if (!qrString) return false;

            // Check if multi-frame stream
            if (window.AegisAnimatedStream && window.AegisAnimatedStream.isChunkString(qrString)) {
                const parsed = window.AegisAnimatedStream.parseChunkString(qrString);
                if (!parsed) return false;

                // If starting a new transfer
                if (this.transferId !== parsed.transferId) {
                    this.reset();
                    this.transferId = parsed.transferId;
                    this.totalChunks = parsed.total;
                    this.chunks = new Array(parsed.total).fill(null);
                }

                // Check if chunk is new
                const chunkIdx = parsed.index - 1;
                if (!this.receivedSet.has(chunkIdx)) {
                    this.chunks[chunkIdx] = parsed.chunkData;
                    this.receivedSet.add(chunkIdx);

                    // Sound feedback
                    if (window.AegisFeedback) {
                        window.AegisFeedback.playChunkChirp(this.receivedSet.size, this.totalChunks);
                    }

                    if (this.onProgressCb) {
                        this.onProgressCb({
                            transferId: this.transferId,
                            received: this.receivedSet.size,
                            total: this.totalChunks,
                            percent: Math.round((this.receivedSet.size / this.totalChunks) * 100),
                            missingIndices: this.getMissingIndices()
                        });
                    }

                    // Check if all chunks received
                    if (this.receivedSet.size === this.totalChunks && !this.isComplete) {
                        this.isComplete = true;
                        const assembled = this.chunks.join('');
                        if (this.onCompleteCb) {
                            this.onCompleteCb(assembled);
                        }
                        return true;
                    }
                }
                return false;
            }

            // Single frame QR code!
            this.reset();
            this.isComplete = true;
            if (this.onCompleteCb) {
                this.onCompleteCb(qrString);
            }
            return true;
        }

        getMissingIndices() {
            const missing = [];
            for (let i = 0; i < this.totalChunks; i++) {
                if (!this.receivedSet.has(i)) {
                    missing.push(i + 1);
                }
            }
            return missing;
        }

        getStatus() {
            return {
                transferId: this.transferId,
                received: this.receivedSet.size,
                total: this.totalChunks,
                percent: this.totalChunks > 0 ? Math.round((this.receivedSet.size / this.totalChunks) * 100) : 0,
                isComplete: this.isComplete
            };
        }
    }

    window.AegisChunkCollector = {
        create: () => new ChunkCollector()
    };
})(window);
