/**
 * AegisQR - Camera Scanner Subsystem
 * High-performance video stream processor using jsQR with camera switching,
 * flashlight/torch control, and dynamic bounding box tracking.
 */

(function (window) {
    'use strict';

    class CameraScanner {
        constructor() {
            this.video = null;
            this.canvas = null;
            this.ctx = null;
            this.overlayCanvas = null;
            this.overlayCtx = null;
            this.stream = null;
            this.track = null;

            this.isRunning = false;
            this.facingMode = 'environment'; // default to rear camera on mobile
            this.hasTorch = false;
            this.isTorchOn = false;

            this.animationFrameId = null;
            this.onScanCallback = null;
            this.onErrorCallback = null;

            this.lastScannedRaw = null;
            this.lastScanTime = 0;
            this.scanCooldownMs = 300; // prevent duplicate scanning of identical static QR within 300ms
        }

        init({ videoElement, canvasElement, overlayElement, onScan, onError }) {
            this.video = videoElement;
            this.canvas = canvasElement || document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            this.overlayCanvas = overlayElement;
            if (this.overlayCanvas) {
                this.overlayCtx = this.overlayCanvas.getContext('2d');
            }

            this.onScanCallback = onScan;
            this.onErrorCallback = onError;
        }

        /**
         * Start camera stream and scanning loop
         */
        async start() {
            if (this.isRunning) return;

            try {
                // Request modern media constraints with ideal resolution
                const constraints = {
                    audio: false,
                    video: {
                        facingMode: { ideal: this.facingMode },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };

                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.video.srcObject = this.stream;
                this.video.setAttribute('playsinline', 'true'); // Required for iOS Safari
                await this.video.play();

                this.track = this.stream.getVideoTracks()[0];
                this.checkTorchSupport();

                this.isRunning = true;
                this.lastScannedRaw = null;

                // Start scan loop
                this.scanLoop();
            } catch (err) {
                console.error('Camera access error:', err);
                this.isRunning = false;
                if (this.onErrorCallback) {
                    this.onErrorCallback(err);
                }
                throw err;
            }
        }

        /**
         * Stop camera stream and cleanup resources
         */
        stop() {
            this.isRunning = false;
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

            if (this.stream) {
                this.stream.getTracks().forEach((track) => track.stop());
                this.stream = null;
                this.track = null;
            }

            if (this.video) {
                this.video.srcObject = null;
            }

            this.clearOverlay();
            this.isTorchOn = false;
        }

        /**
         * Switch between rear and front cameras
         */
        async switchCamera() {
            this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
            if (this.isRunning) {
                this.stop();
                await this.start();
            }
            return this.facingMode;
        }

        /**
         * Check if device camera supports flashlight/torch
         */
        checkTorchSupport() {
            if (!this.track) return;
            const capabilities = this.track.getCapabilities ? this.track.getCapabilities() : {};
            this.hasTorch = Boolean(capabilities.torch);
        }

        /**
         * Toggle flashlight
         */
        async toggleTorch() {
            if (!this.track || !this.hasTorch) return false;
            try {
                this.isTorchOn = !this.isTorchOn;
                await this.track.applyConstraints({
                    advanced: [{ torch: this.isTorchOn }]
                });
                return this.isTorchOn;
            } catch (e) {
                console.warn('Torch toggle failed:', e);
                this.isTorchOn = false;
                return false;
            }
        }

        /**
         * Core frame scanning loop using jsQR
         */
        scanLoop() {
            if (!this.isRunning) return;

            if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
                const videoWidth = this.video.videoWidth;
                const videoHeight = this.video.videoHeight;

                if (videoWidth && videoHeight) {
                    this.canvas.width = videoWidth;
                    this.canvas.height = videoHeight;
                    this.ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);

                    const imageData = this.ctx.getImageData(0, 0, videoWidth, videoHeight);

                    if (window.jsQR) {
                        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: 'dontInvert'
                        });

                        if (code && code.data) {
                            this.drawBoundingBox(code.location, videoWidth, videoHeight);

                            const now = Date.now();
                            const isNewCode = code.data !== this.lastScannedRaw || (now - this.lastScanTime > this.scanCooldownMs);

                            if (isNewCode) {
                                this.lastScannedRaw = code.data;
                                this.lastScanTime = now;

                                if (this.onScanCallback) {
                                    this.onScanCallback(code.data);
                                }
                            }
                        } else {
                            this.clearOverlay();
                        }
                    }
                }
            }

            this.animationFrameId = requestAnimationFrame(() => this.scanLoop());
        }

        /**
         * Draw targeting highlights on the overlay canvas
         */
        drawBoundingBox(loc, videoWidth, videoHeight) {
            if (!this.overlayCanvas || !this.overlayCtx) return;

            this.overlayCanvas.width = this.video.clientWidth;
            this.overlayCanvas.height = this.video.clientHeight;

            const scaleX = this.overlayCanvas.width / videoWidth;
            const scaleY = this.overlayCanvas.height / videoHeight;

            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

            this.overlayCtx.lineWidth = 3;
            this.overlayCtx.strokeStyle = '#00F2FE';
            this.overlayCtx.fillStyle = 'rgba(0, 242, 254, 0.15)';

            this.overlayCtx.beginPath();
            this.overlayCtx.moveTo(loc.topLeftCorner.x * scaleX, loc.topLeftCorner.y * scaleY);
            this.overlayCtx.lineTo(loc.topRightCorner.x * scaleX, loc.topRightCorner.y * scaleY);
            this.overlayCtx.lineTo(loc.bottomRightCorner.x * scaleX, loc.bottomRightCorner.y * scaleY);
            this.overlayCtx.lineTo(loc.bottomLeftCorner.x * scaleX, loc.bottomLeftCorner.y * scaleY);
            this.overlayCtx.closePath();
            this.overlayCtx.fill();
            this.overlayCtx.stroke();
        }

        clearOverlay() {
            if (this.overlayCanvas && this.overlayCtx) {
                this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            }
        }
    }

    window.AegisCameraScanner = {
        create: () => new CameraScanner()
    };
})(window);
