/**
 * AegisQR - Audio & Haptic Feedback Engine
 * Synthesizes sci-fi scan chimes using standard Web Audio API (zero audio files needed)
 * and triggers tactile vibration patterns via Navigator.vibrate.
 */

(function (window) {
    'use strict';

    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    const Feedback = {
        /**
         * Play positive scan confirmation chime
         */
        playScanSuccess() {
            try {
                const ctx = getAudioContext();
                if (!ctx) return;

                const now = ctx.currentTime;

                // Dual oscillator chord (arpeggio 880Hz -> 1320Hz)
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();

                osc1.type = 'sine';
                osc2.type = 'triangle';

                osc1.frequency.setValueAtTime(880, now); // A5
                osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6

                osc2.frequency.setValueAtTime(440, now);
                osc2.frequency.exponentialRampToValueAtTime(880, now + 0.12);

                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.3);
                osc2.stop(now + 0.3);

                // Tactile feedback
                this.vibrate([40, 30, 60]);
            } catch (e) {
                // Audio may fail if user hasn't interacted with page yet
            }
        },

        /**
         * Short frame capture chirp for animated multi-frame stream
         */
        playChunkChirp(index, total) {
            try {
                const ctx = getAudioContext();
                if (!ctx) return;

                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                // Pitch rises slightly with each chunk progress
                const baseFreq = 600 + (index / total) * 400;
                osc.type = 'sine';
                osc.frequency.setValueAtTime(baseFreq, now);

                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.09);

                this.vibrate(20);
            } catch (e) {}
        },

        /**
         * Error alert tone
         */
        playError() {
            try {
                const ctx = getAudioContext();
                if (!ctx) return;

                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.setValueAtTime(160, now + 0.1);

                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.3);

                this.vibrate([100, 50, 100]);
            } catch (e) {}
        },

        /**
         * Trigger haptic vibration if supported
         */
        vibrate(pattern) {
            if (navigator.vibrate) {
                try {
                    navigator.vibrate(pattern);
                } catch (e) {}
            }
        }
    };

    window.AegisFeedback = Feedback;
})(window);
