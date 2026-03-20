/**
 * Fujifilm Grain Simulator — UI Module
 * Handles: accordion (effect switches), synchronized zoom/pan viewer
 */

// ─────────────────────────────────────────────────────────────
// ACCORDION — effect cards show/hide when toggle changes
// ─────────────────────────────────────────────────────────────

function initAccordion() {
    const pairs = [
        { toggle: 'applyGrainToggle',     panel: 'grainSettingsPanel'     },
        { toggle: 'applyLutToggle',        panel: 'lutSettingsPanel'        },
        { toggle: 'applyBlackMistToggle', panel: 'blackMistSettingsPanel'  },
        { toggle: 'applyHalationToggle',  panel: 'halationSettingsPanel'   },
    ];

    pairs.forEach(({ toggle: toggleId, panel: panelId }) => {
        const toggleEl = document.getElementById(toggleId);
        const panelEl  = document.getElementById(panelId);
        if (!toggleEl || !panelEl) return;

        const sync = () => {
            if (toggleEl.checked) {
                panelEl.classList.remove('hidden');
            } else {
                panelEl.classList.add('hidden');
            }
        };

        toggleEl.addEventListener('change', sync);
        sync(); // set initial state
    });
}

// ─────────────────────────────────────────────────────────────
// SYNCHRONIZED VIEWER — zoom + pan both panels together
// ─────────────────────────────────────────────────────────────

const viewer = {
    scale:     1,
    tx:        0,
    ty:        0,
    isDragging: false,
    startX:    0,
    startY:    0,
    startTx:   0,
    startTy:   0,
};

function applyViewerTransform() {
    const t = `translate(${viewer.tx}px,${viewer.ty}px) scale(${viewer.scale})`;
    const a = document.getElementById('originalTransform');
    const b = document.getElementById('processedTransform');
    if (a) a.style.transform = t;
    if (b) b.style.transform = t;
    const zd = document.getElementById('zoomLevelDisplay');
    if (zd) zd.textContent = Math.round(viewer.scale * 100) + '%';
}

/**
 * Zoom towards a specific point (cx, cy) in the panel's coordinate space.
 * @param {number} factor  scale multiplier (>1 zoom in, <1 zoom out)
 * @param {number} cx      cursor x relative to panel left
 * @param {number} cy      cursor y relative to panel top
 */
function doZoom(factor, cx, cy) {
    const newScale = Math.max(0.1, Math.min(16, viewer.scale * factor));
    // Keep the world point under the cursor stationary
    const imgX = (cx - viewer.tx) / viewer.scale;
    const imgY = (cy - viewer.ty) / viewer.scale;
    viewer.tx    = cx - imgX * newScale;
    viewer.ty    = cy - imgY * newScale;
    viewer.scale = newScale;
    applyViewerTransform();
}

/** Zoom towards the panel centre */
function viewerZoomIn() {
    const p = document.getElementById('originalPanel');
    if (p) doZoom(1.25, p.clientWidth / 2, p.clientHeight / 2);
}
function viewerZoomOut() {
    const p = document.getElementById('originalPanel');
    if (p) doZoom(0.8, p.clientWidth / 2, p.clientHeight / 2);
}

/** Reset to fit-to-panel */
function viewerReset() {
    const panel = document.getElementById('originalPanel');
    const img   = document.getElementById('originalImage');
    if (!panel || !img || !img.naturalWidth) return;

    const pw = panel.clientWidth;
    const ph = panel.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = Math.min(pw / iw, ph / ih);
    viewer.scale = scale;
    viewer.tx    = (pw - iw * scale) / 2;
    viewer.ty    = (ph - ih * scale) / 2;
    applyViewerTransform();
}

function initViewer() {
    const panelIds = ['originalPanel', 'processedPanel'];
    const panels   = panelIds.map(id => document.getElementById(id)).filter(Boolean);

    panels.forEach(panel => {
        // Wheel → zoom towards cursor
        panel.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect   = panel.getBoundingClientRect();
            const cx     = e.clientX - rect.left;
            const cy     = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            doZoom(factor, cx, cy);
        }, { passive: false });

        // Mousedown → start drag
        panel.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            viewer.isDragging = true;
            viewer.startX  = e.clientX;
            viewer.startY  = e.clientY;
            viewer.startTx = viewer.tx;
            viewer.startTy = viewer.ty;
            e.preventDefault();
        });
    });

    // Global mousemove / mouseup for smooth drag (even when leaving panel)
    window.addEventListener('mousemove', (e) => {
        if (!viewer.isDragging) return;
        viewer.tx = viewer.startTx + (e.clientX - viewer.startX);
        viewer.ty = viewer.startTy + (e.clientY - viewer.startY);
        applyViewerTransform();
    });

    window.addEventListener('mouseup', () => {
        viewer.isDragging = false;
    });
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initAccordion();
    initViewer();
});
