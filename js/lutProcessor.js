/**
 * Kafta Analogue Studio - LUT Processing Module
 *
 * @description High-performance 3D LUT processor.
 *              Storage: flat Float32Array (interleaved RGB) — eliminates 300 k+ object
 *              allocations per LUT that the previous array-of-objects design produced.
 *              Trilinear interpolation is fully inlined — zero object allocation per pixel.
 *              LRU cache eviction keeps at most MAX_LOADED_LUTS in memory simultaneously.
 * @developer krafta.
 * @portfolio https://www.facebook.com/krafta.visio
 * @github https://github.com/krafta-visio
 * @version 3.0.0
 * @created 2025
 */

class LUTProcessor {
    constructor() {
        /**
         * Cache entry shape:
         * {
         *   data:        Float32Array | null,   // flat interleaved [r0,g0,b0, r1,g1,b1 …]
         *   size:        number,                // LUT_3D_SIZE (e.g. 33 or 64)
         *   metadata:    Object,
         *   lastAccessed: number,               // Date.now() — used for LRU eviction
         * }
         */
        this.lutCache      = new Map();
        this.lutManifest   = null;
        this.isInitialized = false;
        this.initPromise   = null;

        // LRU eviction: never hold more than this many LUT data buffers in memory
        this.MAX_LOADED_LUTS = 3;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALISATION
    // ─────────────────────────────────────────────────────────────────────────

    async initialize() {
        if (this.isInitialized) return;
        if (this.initPromise)   return this.initPromise;
        this.initPromise = this._initializeInternal();
        return this.initPromise;
    }

    async _initializeInternal() {
        console.log('🚀 Initializing LUT system...');
        try {
            await this.loadLUTManifest();
        } catch {
            console.warn('📋 Manifest not found, scanning folder...');
            await this.scanLUTsFolder();
        }
        this.isInitialized = true;
        console.log(`✅ LUT system ready — ${this.lutCache.size} LUTs registered`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DISCOVERY
    // ─────────────────────────────────────────────────────────────────────────

    async loadLUTManifest() {
        const response = await fetch('luts/manifest.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        this.lutManifest = await response.json();
        this.lutManifest.luts.forEach(lut => {
            this.lutCache.set(lut.id, {
                data: null, size: 0, metadata: lut, lastAccessed: 0,
            });
        });
        console.log(`📄 Manifest loaded — ${this.lutManifest.luts.length} LUTs registered`);
    }

    async scanLUTsFolder() {
        const discovered = new Set();

        try {
            const response = await fetch('luts/');
            if (response.ok) {
                const html = await response.text();
                this._parseDirectoryListing(html)
                    .forEach(f => discovered.add(f.replace('.cube', '')));
            }
        } catch { /* directory listing not available */ }

        if (discovered.size === 0) {
            await this._scanCommonLUTs(discovered);
        }

        discovered.forEach(id => {
            this.lutCache.set(id, {
                data: null, size: 0,
                metadata: { id, name: this._formatLUTName(id) },
                lastAccessed: 0,
            });
        });
        console.log(`📋 Discovered ${discovered.size} LUTs via folder scan`);
    }

	async _scanCommonLUTs(set) {
		try {
			const response = await fetch('luts/luts.json');
			if (!response.ok) throw new Error('Failed to load LUT manifest');
			
			const manifest = await response.json();
			
			await Promise.allSettled(manifest.luts.map(async lut => {
				try {
					const r = await fetch(`luts/${lut.filename}`, { method: 'HEAD' });
					if (r.ok) set.add(lut.id);
				} catch { /* skip */ }
			}));
		} catch (err) {
			console.warn('_scanCommonLUTs error:', err);
		}
	}


    _parseDirectoryListing(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return Array.from(doc.querySelectorAll('a[href$=".cube"]'))
            .map(a => a.getAttribute('href'))
            .filter(Boolean);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    async getAvailableLUTs() {
        if (!this.isInitialized) await this.initialize();
        const list = [];
        for (const [id, info] of this.lutCache) {
            list.push({
                id,
                name:        info.metadata?.name        || this._formatLUTName(id),
                displayName: this._formatDisplayName(id),
                loaded:      info.data !== null,
                category:    info.metadata?.category    || 'film',
            });
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Primary method — applies a named LUT to a raw ImageData at the given strength.
     * Lazy-loads the LUT file on first use; subsequent calls use the cached buffer.
     *
     * @param {ImageData} imageData
     * @param {string}    lutName
     * @param {number}    strength  [0 … 1]
     * @returns {Promise<ImageData>}
     */
    async applyLUT(imageData, lutName, strength = 1.0) {
        if (!this.isInitialized) await this.initialize();
        if (lutName === 'none' || strength === 0 || !imageData) return imageData;

        let info = this.lutCache.get(lutName);
        if (!info) {
            console.warn(`LUT not found in registry: ${lutName}`);
            return imageData;
        }

        // Lazy load
        if (!info.data) {
            try {
                await this.loadExternalLUT(lutName);
                info = this.lutCache.get(lutName);
            } catch (err) {
                console.warn(`Failed to load LUT ${lutName}:`, err.message);
                return imageData;
            }
        }

        info.lastAccessed = Date.now();
        return this._applyLUTTransformation(imageData, info.data, info.size, strength);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOADING & PARSING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch and parse a .cube file into memory.
     * LRU eviction is run first so we never exceed MAX_LOADED_LUTS.
     */
    async loadExternalLUT(lutName) {
        console.log(`📥 Loading LUT: ${lutName}`);
        try {
            const response = await fetch(`luts/${lutName}.CUBE`);
            if (!response.ok) throw new Error(`Not found: ${lutName}.cube`);

            const text    = await response.text();
            const lutData = this._parseCUBEFile(text);

            this._evictOldestIfNeeded();

            const existing = this.lutCache.get(lutName);
            if (existing) {
                existing.data         = null;      // release old buffer → eligible for GC
                existing.data         = lutData.buffer;
                existing.size         = lutData.size;
                existing.lastAccessed = Date.now();
            } else {
                this.lutCache.set(lutName, {
                    data: lutData.buffer, size: lutData.size,
                    metadata: { id: lutName, name: this._formatLUTName(lutName) },
                    lastAccessed: Date.now(),
                });
            }

            console.log(`✅ LUT ready: ${lutName} (${lutData.size}³ = ${lutData.count} entries)`);
            return lutData;

        } catch (error) {
            this.lutCache.delete(lutName);
            throw error;
        }
    }

    /**
     * Load a user-uploaded .cube file.
     * @param {File} file
     */
    async loadCustomLUT(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const lutData = this._parseCUBEFile(e.target.result);
                    this._evictOldestIfNeeded();

                    const existing = this.lutCache.get('custom');
                    if (existing) existing.data = null;   // release previous custom LUT

                    this.lutCache.set('custom', {
                        data: lutData.buffer, size: lutData.size,
                        metadata: {
                            id: 'custom', name: 'Custom LUT',
                            description: `Uploaded: ${file.name}`,
                        },
                        lastAccessed: Date.now(),
                    });

                    console.log(`✅ Custom LUT loaded: ${file.name}`);
                    resolve(lutData);
                } catch (err) {
                    reject(new Error(`Failed to parse LUT: ${err.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Parse a .cube file directly into a flat Float32Array.
     *
     * Previous implementation created one `{r,g,b}` object per data line.
     * For a 64³ LUT that was 262 144 objects — significant GC pressure.
     * This version uses a pre-allocated Float32Array (interleaved RGB):
     *   index = (z * size² + y * size + x) * 3
     *   R → buffer[index], G → buffer[index+1], B → buffer[index+2]
     *
     * @param {string} content  Raw .cube file text
     * @returns {{ buffer: Float32Array, size: number, title: string, count: number }}
     */
    _parseCUBEFile(content) {
        // ── Header scan (regex — fast, handles vary whitespace/CRLF) ──
        let size  = 33;
        let title = 'Unknown LUT';

        const sizeMatch  = content.match(/LUT_3D_SIZE\s+(\d+)/);
        const titleMatch = content.match(/TITLE\s+"?([^"\r\n]+)"?/);
        if (sizeMatch)  size  = parseInt(sizeMatch[1], 10);
        if (titleMatch) title = titleMatch[1].trim();

        const expectedCount = size * size * size;
        const buffer = new Float32Array(expectedCount * 3);

        let idx = 0;
        let lineStart = 0;
        const len = content.length;

        for (let i = 0; i <= len; i++) {
            const ch = i === len ? 10 : content.charCodeAt(i);  // treat EOF as newline
            if (ch === 10 || ch === 13) {                         // LF or CR
                if (i > lineStart) {
                    // Extract line without creating a substring when possible
                    const line = content.slice(lineStart, i).trim();

                    // Skip empty lines, comments, and keyword lines
                    if (line.length > 0 &&
                        line[0] !== '#' &&
                        line[0] !== 'T' &&    // TITLE
                        line[0] !== 'L' &&    // LUT_3D_SIZE / LUT_1D_SIZE
                        line[0] !== 'D') {    // DOMAIN_MIN / DOMAIN_MAX

                        // Split on whitespace — handles multiple spaces and tabs
                        let v0 = 0, v1 = 0, v2 = 0, vCount = 0;
                        let numStart = -1;

                        for (let j = 0; j <= line.length; j++) {
                            const c = j < line.length ? line.charCodeAt(j) : 32;
                            const isSpace = c === 32 || c === 9;

                            if (!isSpace && numStart < 0) {
                                numStart = j;
                            } else if (isSpace && numStart >= 0) {
                                const val = parseFloat(line.slice(numStart, j));
                                if (vCount === 0) v0 = val;
                                else if (vCount === 1) v1 = val;
                                else if (vCount === 2) v2 = val;
                                vCount++;
                                numStart = -1;
                            }
                        }

                        if (vCount >= 3 && !isNaN(v0) && !isNaN(v1) && !isNaN(v2)) {
                            if (idx < buffer.length) {
                                buffer[idx++] = v0 < 0 ? 0 : v0 > 1 ? 1 : v0;
                                buffer[idx++] = v1 < 0 ? 0 : v1 > 1 ? 1 : v1;
                                buffer[idx++] = v2 < 0 ? 0 : v2 > 1 ? 1 : v2;
                            }
                        }
                    }
                }
                lineStart = i + 1;
            }
        }

        const count = idx / 3;
        if (count === 0) throw new Error('No valid LUT data found in file');

        if (count !== expectedCount) {
            console.warn(`LUT size mismatch: expected ${expectedCount}, got ${count}`);
        }

        return { buffer, size, title, count };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRANSFORMATION — INLINED TRILINEAR INTERPOLATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Apply a 3D LUT transformation to ImageData using trilinear interpolation.
     *
     * Key optimisations vs previous version:
     *   • LUT data is a flat Float32Array (cache-friendly, no property lookups)
     *   • Zero object allocations inside the pixel loop (no {r,g,b} temporaries)
     *   • Integer bit-shifts replace Math.floor() where safe
     *   • Per-channel loop (c=0,1,2) reuses the 8 corner indices already computed
     *
     * @param {ImageData}    imageData
     * @param {Float32Array} lutBuffer  flat interleaved RGB
     * @param {number}       lutSize    LUT_3D_SIZE
     * @param {number}       strength   blend factor [0 … 1]
     * @returns {ImageData}
     */
    _applyLUTTransformation(imageData, lutBuffer, lutSize, strength) {
        const src      = imageData.data;
        const outData  = new Uint8ClampedArray(src);   // copy, then overwrite
        const pixCount = src.length >> 2;
        const maxIdx   = lutSize - 1;
        const s2       = lutSize * lutSize;
        const scale    = maxIdx / 255;

        for (let p = 0; p < pixCount; p++) {
            const base = p << 2;

            // Map 0-255 → 0-(size-1) float
            const rx = src[base]     * scale;
            const gx = src[base + 1] * scale;
            const bx = src[base + 2] * scale;

            // Floor via bitwise OR (safe for values < 2³¹)
            const r0 = rx | 0;
            const g0 = gx | 0;
            const b0 = bx | 0;

            const r1 = r0 < maxIdx ? r0 + 1 : maxIdx;
            const g1 = g0 < maxIdx ? g0 + 1 : maxIdx;
            const b1 = b0 < maxIdx ? b0 + 1 : maxIdx;

            const dr = rx - r0;
            const dg = gx - g0;
            const db = bx - b0;

            // Pre-compute all 8 corner positions × 3 (one multiply saves 24 additions)
            const i000 = (b0 * s2 + g0 * lutSize + r0) * 3;
            const i100 = (b0 * s2 + g0 * lutSize + r1) * 3;
            const i010 = (b0 * s2 + g1 * lutSize + r0) * 3;
            const i110 = (b0 * s2 + g1 * lutSize + r1) * 3;
            const i001 = (b1 * s2 + g0 * lutSize + r0) * 3;
            const i101 = (b1 * s2 + g0 * lutSize + r1) * 3;
            const i011 = (b1 * s2 + g1 * lutSize + r0) * 3;
            const i111 = (b1 * s2 + g1 * lutSize + r1) * 3;

            // Trilinear interpolation — one channel at a time, no temp objects
            for (let c = 0; c < 3; c++) {
                const c00 = lutBuffer[i000 + c] + (lutBuffer[i100 + c] - lutBuffer[i000 + c]) * dr;
                const c01 = lutBuffer[i001 + c] + (lutBuffer[i101 + c] - lutBuffer[i001 + c]) * dr;
                const c10 = lutBuffer[i010 + c] + (lutBuffer[i110 + c] - lutBuffer[i010 + c]) * dr;
                const c11 = lutBuffer[i011 + c] + (lutBuffer[i111 + c] - lutBuffer[i011 + c]) * dr;
                const c0  = c00 + (c10 - c00) * dg;
                const c1  = c01 + (c11 - c01) * dg;
                const mapped = (c0 + (c1 - c0) * db) * 255;

                // Blend original and LUT-mapped value
                const orig = src[base + c];
                outData[base + c] = orig + (mapped - orig) * strength;
            }
            // Alpha is already copied from src — leave unchanged
        }

        return new ImageData(outData, imageData.width, imageData.height);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LRU CACHE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * If the number of loaded (non-null data) LUTs reaches MAX_LOADED_LUTS,
     * null-out the data of the least recently accessed entry so the GC can
     * reclaim that Float32Array.
     */
    _evictOldestIfNeeded() {
        let loadedCount = 0;
        let oldestId    = null;
        let oldestTime  = Infinity;

        for (const [id, info] of this.lutCache) {
            if (info.data !== null) {
                loadedCount++;
                if (info.lastAccessed < oldestTime) {
                    oldestTime = info.lastAccessed;
                    oldestId   = id;
                }
            }
        }

        if (loadedCount >= this.MAX_LOADED_LUTS && oldestId !== null) {
            const victim = this.lutCache.get(oldestId);
            victim.data  = null;   // explicit null → Float32Array eligible for GC
            console.log(`🧹 LRU evict: released "${oldestId}" (${this.MAX_LOADED_LUTS} LUT limit)`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    _formatLUTName(lutId) {
        return lutId.replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase())
                    .replace(/(\d+)$/, ' $1');
    }

	_formatDisplayName(lutId, category = null) {
		const name = this._formatLUTName(lutId);
		let type = '(color)';
		
		// Use category from manifest if available
		if (category) {
			switch(category) {
				case 'monochrome':
					type = '(𝐁𝐖)';
					break;
				case 'portrait':
					type = '(𝐩𝐨𝐫𝐭𝐫𝐚𝐢𝐭)';
					break;
				default:
					type = '(𝐜𝐨𝐥𝐨𝐫)';
			}
		} else {
			// Fallback to keyword detection
			const lower = lutId.toLowerCase();
			if (lower.includes('bw') || lower.includes('mono') || lower.includes('black') || 
				lower.includes('white') || lower.includes('acros') || lower.includes('hp5') ||
				lower.includes('tmax') || lower.includes('ilford') || lower.includes('charcoal') ||
				lower.includes('graphite') || lower.includes('nitrate') || lower.includes('silver')) {
				type = '(B&W)';
			} else if (lower.includes('cinema') || lower.includes('eterna')) {
				type = '(cinematic)';
			} else if (lower.includes('vivid') || lower.includes('velvia')) {
				type = '(vibrant)';
			} else if (lower.includes('portrait') || lower.includes('portra')) {
				type = '(portrait)';
			}
		}
		
		return `${name} ${type}`;
	}

    /** Manually preload specific LUTs (e.g. on app startup for commonly-used ones) */
    async preloadLUTs(lutNames) {
        if (!this.isInitialized) await this.initialize();
        await Promise.allSettled(lutNames.map(async name => {
            const info = this.lutCache.get(name);
            if (info && !info.data) await this.loadExternalLUT(name);
        }));
        console.log(`✅ Preloaded ${lutNames.length} LUT(s)`);
    }

    /** Release all data buffers (full reset) or only unloaded entries. */
    clearCache(keepLoaded = false) {
        if (!keepLoaded) {
            for (const info of this.lutCache.values()) info.data = null;
            this.lutCache.clear();
        } else {
            for (const [id, info] of this.lutCache) {
                if (!info.data) this.lutCache.delete(id);
            }
        }
        console.log('🧹 LUT cache cleared');
    }

    getCacheStats() {
        let loaded = 0, total = 0;
        for (const info of this.lutCache.values()) {
            total++;
            if (info.data) loaded++;
        }
        return { total, loaded, percentage: total ? (loaded / total * 100).toFixed(1) : '0.0' };
    }
}
