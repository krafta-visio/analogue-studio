/**
 * Fujifilm Grain Simulator - Grain Processing Module
 *
 * @description Professional film grain simulation — authentic Fujifilm/analog film response
 *              Uses Mulberry32 PRNG + Box-Muller Gaussian distribution + multi-octave
 *              fractal noise + 3-zone luminance adaptive strength.
 *              Memory: flat Float32Array buffers, no persistent canvas (zero memory leak).
 * @developer krafta.
 * @portfolio https://www.facebook.com/krafta.visio
 * @github https://github.com/krafta-visio
 * @version 2.0.0
 * @created 2025
 */

class GrainProcessor {

    // No persistent canvas stored — each call creates a temporary canvas
    // that becomes eligible for GC after the returned reference is released.

    /**
     * Apply authentic film grain to an image element.
     * @param {HTMLImageElement} imageElement
     * @param {Object} settings  { iso: number|string, strength: number, grainSize: number }
     * @returns {Promise<HTMLCanvasElement>}
     */
    async applyGrain(imageElement, settings) {
        const width  = imageElement.naturalWidth;
        const height = imageElement.naturalHeight;

        // Per-call canvas — discarded when caller releases the reference
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(imageElement, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        this._applyFilmGrain(imageData.data, width, height, settings);
        ctx.putImageData(imageData, 0, 0);

        return canvas;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORE PIPELINE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Apply all grain processing stages in-place on a Uint8ClampedArray.
     * @param {Uint8ClampedArray} data   Raw RGBA pixel data (modified in-place)
     * @param {number} width
     * @param {number} height
     * @param {Object} settings
     */
    _applyFilmGrain(data, width, height, settings) {
        const isoParams     = this._getIsoParameters(parseInt(settings.iso, 10) || 800);
        const grainIntensity = Math.min(Math.max(settings.strength, 0), 2.0) * isoParams.intensity;
        const grainSize      = Math.max(0.5, settings.grainSize * isoParams.size);
        const contrast       = isoParams.contrast;

        // Generate flat grain pattern (Float32Array, width*height elements)
        const grainPattern   = this._generateFilmGrain(width, height, grainSize, grainIntensity);

        const total = width * height;
        const dataLen = data.length;

        for (let i = 0; i < dataLen; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Perceptual luminance (Rec. 709 coefficients)
            const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

            // 3-zone adaptive scaling
            const adaptiveScale = this._getAdaptiveStrength(lum, contrast);

            const pixelIdx  = i >> 2;                        // i / 4
            const baseGrain = grainPattern[pixelIdx] * adaptiveScale;

            // Subtle per-channel variation — mimics film's multi-layer halation.
            // Each dye layer (RGB) reacts slightly differently to silver halide.
            // Warm (red) bias in grain; cool (blue) slightly less.
            const rGrain = baseGrain * 1.04;   // +4% red → slight warm grain tint
            const gGrain = baseGrain;           // green anchors the luminance
            const bGrain = baseGrain * 0.96;   // -4% blue → keeps highlights clean

            data[i]     = this._clamp(r + rGrain * 255);
            data[i + 1] = this._clamp(g + gGrain * 255);
            data[i + 2] = this._clamp(b + bGrain * 255);
            // Alpha (data[i+3]) untouched
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GRAIN PATTERN GENERATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate an authentic multi-octave film grain pattern.
     *
     * Algorithm:
     *   1. Mulberry32 PRNG  — fast, high-quality, seeded per render
     *   2. Box-Muller transform — Gaussian-distributed noise (not uniform!)
     *   3. Three octaves at different spatial scales — fine / medium / coarse
     *      (mirrors the granularity found in different film emulsions)
     *   4. Separable box-blur — controls grain clumping per grainSize setting
     *   5. Intensity scale
     *
     * @param {number} width
     * @param {number} height
     * @param {number} grainSize    user setting [0.5 … 3.0+]
     * @param {number} intensity    combined strength value
     * @returns {Float32Array}      values centred around 0, scaled by intensity
     */
    _generateFilmGrain(width, height, grainSize, intensity) {
        const total = width * height;

        // New seed every render → non-repeating grain across multiple Apply clicks
        const seed  = (Date.now() ^ (Math.random() * 0xFFFFFFFF | 0)) >>> 0;
        const prng  = this._mulberry32(seed);

        // ── Layer 1: Fine grain (full resolution) ──
        const fine = this._gaussianNoise(total, prng);

        // ── Layer 2: Medium grain (1/3 resolution, up-sampled) ──
        const mw = Math.max(1, Math.round(width  / 3));
        const mh = Math.max(1, Math.round(height / 3));
        const medium = this._nearestUpsample(
            this._gaussianNoise(mw * mh, prng),
            mw, mh, width, height
        );

        // ── Layer 3: Coarse grain (1/8 resolution, up-sampled) ──
        const cw = Math.max(1, Math.round(width  / 8));
        const ch = Math.max(1, Math.round(height / 8));
        const coarse = this._nearestUpsample(
            this._gaussianNoise(cw * ch, prng),
            cw, ch, width, height
        );

        // ── Combine octaves (film grain frequency content weights) ──
        // Fine: 60 %, Medium: 30 %, Coarse: 10 %
        const grain = new Float32Array(total);
        for (let i = 0; i < total; i++) {
            grain[i] = fine[i] * 0.60 + medium[i] * 0.30 + coarse[i] * 0.10;
        }

        // ── Box-blur for spatial coherence / grain clumping ──
        // grainSize > 1 makes grain "clump" — visible at ISO 1600+
        const blurRadius = Math.round((grainSize - 1.0) * 2.5);
        if (blurRadius >= 1) {
            this._boxBlurInPlace(grain, width, height, blurRadius);
        }

        // ── Normalize and scale ──
        // Gaussian combination sigma ≈ 0.77; divide by ~3.3 to keep within [-1,1]
        const normalizer = intensity / 3.3;
        for (let i = 0; i < total; i++) {
            grain[i] *= normalizer;
        }

        return grain;
    }

    /**
     * Produce a Float32Array of `count` Gaussian samples using Box-Muller.
     * Gaussian distribution matches the statistical behaviour of silver halide
     * grain in real film — unlike uniform Math.random().
     *
     * @param {number}   count
     * @param {Function} prng   Mulberry32 PRNG function
     * @returns {Float32Array}
     */
    _gaussianNoise(count, prng) {
        const out = new Float32Array(count);
        for (let i = 0; i < count - 1; i += 2) {
            // Box-Muller: U1, U2 ∈ (0,1) → Z0, Z1 ∈ N(0,1)
            const u1  = prng() || 1e-12;   // guard against log(0)
            const u2  = prng();
            const mag = Math.sqrt(-2.0 * Math.log(u1));
            out[i]     = mag * Math.cos(2.0 * Math.PI * u2);
            out[i + 1] = mag * Math.sin(2.0 * Math.PI * u2);
        }
        // Handle odd count
        if (count & 1) {
            const u1  = prng() || 1e-12;
            const u2  = prng();
            out[count - 1] = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        }
        return out;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRNG
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Mulberry32 — high-quality, extremely fast 32-bit PRNG.
     * Passes BigCrush; far superior to `Math.sin` hashing.
     * @param {number} seed  unsigned 32-bit integer
     * @returns {Function}   () → float in [0, 1)
     */
    _mulberry32(seed) {
        let s = seed >>> 0;
        return function () {
            s |= 0;
            s  = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESAMPLING & BLURRING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Nearest-neighbour upsample a Float32Array from (sw × sh) → (dw × dh).
     * Used to create spatially-coherent coarser-scale grain layers.
     * @param {Float32Array} src
     * @param {number} sw  source width
     * @param {number} sh  source height
     * @param {number} dw  destination width
     * @param {number} dh  destination height
     * @returns {Float32Array}
     */
    _nearestUpsample(src, sw, sh, dw, dh) {
        const dst    = new Float32Array(dw * dh);
        const xRatio = sw / dw;
        const yRatio = sh / dh;
        for (let dy = 0; dy < dh; dy++) {
            const sy           = Math.min((dy * yRatio) | 0, sh - 1);
            const srcRowOffset = sy * sw;
            const dstRowOffset = dy * dw;
            for (let dx = 0; dx < dw; dx++) {
                const sx = Math.min((dx * xRatio) | 0, sw - 1);
                dst[dstRowOffset + dx] = src[srcRowOffset + sx];
            }
        }
        return dst;
    }

    /**
     * Fast in-place separable box-blur on a Float32Array.
     * Two-pass (horizontal then vertical) → O(w*h) regardless of radius.
     * Controls grain "clumping" (grainSize parameter).
     * @param {Float32Array} data
     * @param {number} width
     * @param {number} height
     * @param {number} radius  integer ≥ 1
     */
    _boxBlurInPlace(data, width, height, radius) {
        const temp       = new Float32Array(data.length);
        const kernelSize = 2 * radius + 1;
        const inv        = 1.0 / kernelSize;

        // ── Horizontal pass: data → temp ──
        for (let y = 0; y < height; y++) {
            const row = y * width;
            let sum   = 0;

            // Initialise window around x = 0  (clamp OOB to edge pixels)
            for (let kx = -radius; kx <= radius; kx++) {
                sum += data[row + Math.max(0, Math.min(kx, width - 1))];
            }

            for (let x = 0; x < width; x++) {
                temp[row + x] = sum * inv;
                sum -= data[row + Math.max(0, x - radius)];
                sum += data[row + Math.min(x + radius + 1, width - 1)];
            }
        }

        // ── Vertical pass: temp → data ──
        for (let x = 0; x < width; x++) {
            let sum = 0;

            for (let ky = -radius; ky <= radius; ky++) {
                sum += temp[Math.max(0, Math.min(ky, height - 1)) * width + x];
            }

            for (let y = 0; y < height; y++) {
                data[y * width + x] = sum * inv;
                sum -= temp[Math.max(0, y - radius) * width + x];
                sum += temp[Math.min(y + radius + 1, height - 1) * width + x];
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADAPTIVE STRENGTH (3-ZONE)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Return a grain strength multiplier based on pixel luminance.
     *
     * Zone behaviour (matches Fujifilm film response):
     *   Shadows (lum < 0.2)  → low-moderate grain (silver halide still reacts to underexposure)
     *   Midtones (lum ≈ 0.45)→ peak grain (Fuji film characteristic midtone grit)
     *   Highlights (lum > 0.8)→ very little grain (overexposed areas resolve cleanly)
     *
     * `contrast` (from ISO params) tightens or widens the midtone peak:
     *   low ISO → softer/wider curve → grain more diffuse
     *   high ISO → sharper curve → grain more concentrated in midtones
     *
     * @param {number} luminance  [0 … 1]
     * @param {number} contrast   ISO-derived sharpness [0 … 1]
     * @returns {number}
     */
    _getAdaptiveStrength(luminance, contrast) {
        // Midtone Gaussian — centre at 0.45, width controlled by contrast
        const sigma   = 0.28 - contrast * 0.08;   // narrows with higher ISO
        const midPeak = Math.exp(-Math.pow((luminance - 0.45) / (sigma * 2), 2));

        // Shadow floor: real film still shows grain in dense shadows
        const shadowFloor = 0.22 * Math.pow(1.0 - luminance, 1.5);

        // Highlight suppression: exponential roll-off above 0.78
        const highlightRolloff = luminance > 0.78
            ? Math.max(0.0, 1.0 - Math.pow((luminance - 0.78) / 0.22, 2))
            : 1.0;

        const base = 0.25 + 0.75 * midPeak + shadowFloor;
        return base * highlightRolloff * (0.65 + 0.35 * contrast);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ISO PARAMETERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Map a film ISO value to empirically tuned grain parameters.
     *
     * intensity : overall grain strength multiplier (lower = subtler)
     * size      : grain spatial scale multiplier (higher = bigger clumps)
     * contrast  : adaptive-curve sharpness & shadow-tone weight [0…1]
     *
     * Values are tuned against reference scans of Fujifilm film stocks
     * (Provia 100, Superia 400, Neopan ACROS).
     *
     * @param {number} iso
     * @returns {{ intensity: number, size: number, contrast: number }}
     */
    _getIsoParameters(iso) {
        const params = {
            100:  { intensity: 0.040, size: 0.55, contrast: 0.20 },
            200:  { intensity: 0.065, size: 0.72, contrast: 0.32 },
            400:  { intensity: 0.105, size: 0.88, contrast: 0.48 },
            800:  { intensity: 0.170, size: 1.00, contrast: 0.64 },
            1600: { intensity: 0.265, size: 1.28, contrast: 0.80 },
            3200: { intensity: 0.400, size: 1.65, contrast: 0.96 },
        };
        return params[iso] || params[800];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    /** Clamp a float to the [0, 255] uint8 range — branchless (avoids Math.max/min overhead) */
    _clamp(v) {
        return v < 0 ? 0 : v > 255 ? 255 : v;
    }
}