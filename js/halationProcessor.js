/**
 * Kafta Analogue Studio - Halation Processing Module
 *
 * @description Authentic film halation: warm orange-red glow around highlights.
 *              In real film, bright light penetrates the emulsion, reflects off the
 *              anti-halation backing, and bleeds back — creating a soft warm halo.
 *
 * Pipeline: highlight mask → 2× box-blur (≈ Gaussian) → Screen blend with warm tint.
 *
 * @developer krafta.
 * @portfolio https://www.facebook.com/krafta.visio
 * @github    https://github.com/krafta-visio
 * @version   1.1.0
 * @created   2025
 */

class HalationProcessor {

    /**
     * Apply film halation to a canvas in-place.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} settings
     * @param {number} settings.halationStrength  [0 … 1]
     * @param {number} settings.halationRadius    [5 … 60]
     */
    applyHalation(canvas, settings) {
        // strength > 1.0 intentionally allowed — produces stronger/wider glow
        const strength = Math.max(settings.halationStrength || 0.50, 0);
        const radius   = Math.max(5, Math.min(settings.halationRadius  || 20,  150));

        if (strength === 0) return;

        const ctx  = canvas.getContext('2d', { willReadFrequently: true });
        const w    = canvas.width;
        const h    = canvas.height;
        const img  = ctx.getImageData(0, 0, w, h);
        const data = img.data;    // Uint8ClampedArray, modified in-place
        const total = w * h;

        // ── Step 1: Highlight mask ────────────────────────────────────────────
        // Threshold 0.55 — broad enough to catch diffuse indoor highlights
        // even when no pure-white source is present.
        const THRESHOLD = 0.55;
        const invRange  = 1.0 / (1.0 - THRESHOLD);
        const mask = new Float32Array(total);

        for (let i = 0; i < total; i++) {
            const b   = i << 2;
            const lum = (0.2126 * data[b] + 0.7152 * data[b + 1] + 0.0722 * data[b + 2]) / 255;
            if (lum > THRESHOLD) {
                const excess = (lum - THRESHOLD) * invRange;  // 0 … 1
                // When strength > 1 lower the exponent so more pixels glow
                const exp = Math.max(0.5, 2.0 - strength * 0.4);
                mask[i] = Math.pow(excess, exp);
            }
        }

        // ── Step 2: Spread glow with 2× box-blur (4 total H+V passes) ────────
        // 2 passes produces a smooth Gaussian-like spread without over-diluting
        // small highlight areas (3 passes was too aggressive for point sources).
        //
        // Radius scaled by sqrt(min_dim / 500) so the spread is visually
        // proportional regardless of image resolution.
        const scaledRadius = Math.max(4, Math.round(
            radius * Math.sqrt(Math.min(w, h) / 500)
        ));

        this._boxBlur(mask, w, h, scaledRadius);
        this._boxBlur(mask, w, h, scaledRadius);

        // ── Step 3 + 4: Warm tint + Screen blend ─────────────────────────────
        // Signature halation: warm orange-red.
        //   R 1.00 · G 0.35 · B 0.08
        // Screen formula: out = src + glow − src × glow
        // (Never darkens; only adds light — physically correct.)
        const TR = 1.00;
        const TG = 0.35;
        const TB = 0.08;

        for (let i = 0; i < total; i++) {
            const glow = mask[i] * strength;
            if (glow < 1e-6) continue;       // genuinely zero — skip (no effect)

            const b  = i << 2;
            const sr = data[b]     / 255;
            const sg = data[b + 1] / 255;
            const sb = data[b + 2] / 255;

            const gr = glow * TR;
            const gg = glow * TG;
            const gb = glow * TB;

            // Screen blend (clamping handled by Uint8ClampedArray assignment)
            data[b]     = (sr + gr - sr * gr) * 255 + 0.5;
            data[b + 1] = (sg + gg - sg * gg) * 255 + 0.5;
            data[b + 2] = (sb + gb - sb * gb) * 255 + 0.5;
            // data[b+3] alpha — untouched
        }

        ctx.putImageData(img, 0, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEPARABLE BOX BLUR  (O(n) — fast regardless of radius)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * In-place separable box-blur on a Float32Array.
     * @param {Float32Array} data
     * @param {number} w
     * @param {number} h
     * @param {number} radius  integer ≥ 1
     */
    _boxBlur(data, w, h, radius) {
        const temp = new Float32Array(data.length);
        const inv  = 1.0 / (2 * radius + 1);

        // Horizontal pass: data → temp
        for (let y = 0; y < h; y++) {
            const row = y * w;
            let sum   = 0;
            for (let kx = -radius; kx <= radius; kx++) {
                sum += data[row + Math.max(0, Math.min(kx, w - 1))];
            }
            for (let x = 0; x < w; x++) {
                temp[row + x] = sum * inv;
                sum -= data[row + Math.max(0, x - radius)];
                sum += data[row + Math.min(x + radius + 1, w - 1)];
            }
        }

        // Vertical pass: temp → data
        for (let x = 0; x < w; x++) {
            let sum = 0;
            for (let ky = -radius; ky <= radius; ky++) {
                sum += temp[Math.max(0, Math.min(ky, h - 1)) * w + x];
            }
            for (let y = 0; y < h; y++) {
                data[y * w + x] = sum * inv;
                sum -= temp[Math.max(0, y - radius) * w + x];
                sum += temp[Math.min(y + radius + 1, h - 1) * w + x];
            }
        }
    }
}
