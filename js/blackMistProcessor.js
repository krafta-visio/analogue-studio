/**
 * Fujifilm Grain Simulator - Black Mist Filter Module
 *
 * @description Simulates the optical behaviour of Black Mist / Pro-Mist camera filters
 *              (e.g. Tiffen Black Pro-Mist, Kenko Black Mist).
 *
 * Physical mechanism:
 *   Microcrystalline particles embedded in the filter glass scatter light from
 *   bright areas into surrounding dark areas — producing a neutral white glow,
 *   subtle shadow lift, and an overall soft "dreamy" diffusion without
 *   sacrificing sharpness in mid-tones.
 *
 * Algorithm (three-stage pipeline):
 *   1. Screen Bloom  — full-image Gaussian-approximated blur, Screen-blended at
 *                      variable opacity (bright areas bleed into dark, never vice-versa)
 *   2. Diffuse Haze  — soft normal blend of blurred layer (reduces micro-contrast)
 *   3. Shadow Lift   — raises dark values proportionally to their darkness
 *                      (models the flare-induced grey haze of physical filters)
 *
 * Pipeline position:
 *   Applied AFTER grain but BEFORE halation and LUT, matching the intended
 *   artistic order (lens effect → film effect → color rendering).
 *
 * @developer krafta.
 * @portfolio https://www.facebook.com/krafta.visio
 * @github    https://github.com/krafta-visio
 * @version   1.0.0
 * @created   2025
 */

class BlackMistProcessor {

    /**
     * Apply Black Mist filter to a canvas in-place.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} settings
     * @param {number} settings.blackMistIntensity  [0 … 3.0]  overall strength
     * @param {number} settings.blackMistRadius     [5 … 100]  spread of the glow
     */
    applyBlackMist(canvas, settings) {
        const intensity = Math.max(settings.blackMistIntensity || 0.5, 0);
        const radius    = Math.max(5, Math.min(settings.blackMistRadius || 25, 100));

        if (intensity === 0) return;

        const ctx  = canvas.getContext('2d', { willReadFrequently: true });
        const w    = canvas.width;
        const h    = canvas.height;
        const img  = ctx.getImageData(0, 0, w, h);
        const data = img.data;
        const total = w * h;

        // ── Step 1: Extract each channel into flat Float32Arrays ─────────────
        // Separate R, G, B so we can blur all three uniformly (neutral mist).
        const rCh = new Float32Array(total);
        const gCh = new Float32Array(total);
        const bCh = new Float32Array(total);

        for (let i = 0; i < total; i++) {
            const b  = i << 2;
            rCh[i]   = data[b]     / 255;
            gCh[i]   = data[b + 1] / 255;
            bCh[i]   = data[b + 2] / 255;
        }

        // ── Step 2: Blur all channels (2 passes = 4 H+V operations) ──────────
        // Scale radius to image resolution so the visual spread is consistent.
        const scaledRadius = Math.max(3, Math.round(
            radius * Math.sqrt(Math.min(w, h) / 500)
        ));

        this._boxBlur(rCh, w, h, scaledRadius);
        this._boxBlur(gCh, w, h, scaledRadius);
        this._boxBlur(bCh, w, h, scaledRadius);
        this._boxBlur(rCh, w, h, scaledRadius);  // 2nd pass
        this._boxBlur(gCh, w, h, scaledRadius);
        this._boxBlur(bCh, w, h, scaledRadius);

        // ── Effect strength breakdown (derived from intensity) ────────────────
        // bloomStr  : Screen blend strength  — drives highlight-bleed into dark areas
        // diffuse   : Normal blend strength  — softens micro-contrast
        // liftAmt   : Shadow-lift offset     — models grey-fog of physical filter
        const bloomStr = Math.min(intensity * 0.50, 1.0);
        const diffuse  = Math.min(intensity * 0.12, 0.22);
        const liftAmt  = Math.min(intensity * 0.07, 0.12);

        // ── Step 3: Composite ─────────────────────────────────────────────────
        for (let i = 0; i < total; i++) {
            const b  = i << 2;

            const sr = data[b]     / 255;
            const sg = data[b + 1] / 255;
            const sb = data[b + 2] / 255;

            const br = rCh[i];
            const bg = gCh[i];
            const bb = bCh[i];

            // Stage A — Screen bloom: bright areas bleed into dark (neutral white glow)
            // Screen formula: out = src + blur*strength − src*blur*strength
            const r1 = sr + br * bloomStr - sr * br * bloomStr;
            const g1 = sg + bg * bloomStr - sg * bg * bloomStr;
            const b1 = sb + bb * bloomStr - sb * bb * bloomStr;

            // Stage B — Diffuse haze: soft normal blend with blurred layer
            // Reduces micro-contrast, adds overall dreamy softness
            const r2 = r1 + (br - r1) * diffuse;
            const g2 = g1 + (bg - g1) * diffuse;
            const b2 = b1 + (bb - b1) * diffuse;

            // Stage C — Shadow lift: raise dark areas proportional to their darkness
            // (Brighter pixels are barely affected; deep shadows receive the most lift)
            const r3 = r2 + liftAmt * (1.0 - sr);
            const g3 = g2 + liftAmt * (1.0 - sg);
            const b3 = b2 + liftAmt * (1.0 - sb);

            // Assign (Uint8ClampedArray auto-clamps to [0, 255])
            data[b]     = r3 * 255 + 0.5;
            data[b + 1] = g3 * 255 + 0.5;
            data[b + 2] = b3 * 255 + 0.5;
            // Alpha unchanged
        }

        ctx.putImageData(img, 0, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEPARABLE BOX BLUR  (O(n) — fast regardless of radius)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * In-place two-pass (horizontal + vertical) box blur on a Float32Array.
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
