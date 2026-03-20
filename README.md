# Kafta Analogue Studio 🎞️

A professional web-based photo editor that brings the magic of authentic film simulation, halation, black mist, and color grading to your digital photos - right in your browser!

![Kafta Analogue Studio](https://img.shields.io/badge/Kafta-Analogue%20Studio-blue?style=for-the-badge)
![Pure JavaScript](https://img.shields.io/badge/Pure-JavaScript-yellow?style=for-the-badge)
![Free to Use](https://img.shields.io/badge/Free-100%25-green?style=for-the-badge)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS%20v3-ff69b4?style=for-the-badge)

## ✨ What Makes This Special?

### Authentic Film-like Experience
We've reverse-engineered what makes film photography so beloved by photographers. Unlike basic noise filters, our algorithm creates grain that actually behaves like real film! Coupled with organic **Halation**, **Black Mist Diffusion**, and an extensive **LUT Collection**, you get a complete analog darkroom style natively.

---

## 🛠️ Key Features

### 🎯 1. Natural Grain Engine
| Feature | What It Does | Why It Matters |
|---------|--------------|----------------|
| **Monochromatic Grain** | Creates black-and-white grain only | Looks like real film grain development, not digital noise |
| **Multi-octave Noise** | Combines fine and coarse grain layers | Matches the complex texture of actual film stocks |
| **Adaptive Strength** | Grain is heavy in mid-tones, less in highlights/shadows | Follows how film silver-halide crystals react to light |
| **Coherent Clumping** | Uses box-blur algorithms for micro-clumping | Creates that "organic" film texture we all love |

### 🌟 2. Advanced Lens & Film Effects
*   **Film Halation**
    *   Simulates light reflecting from the film base layer back to the emulsion.
    *   Creates a beautiful **warm orange-red glow** specifically around brightest highlights.
*   **Black Mist Filter**
    *   Neutral highlight bloom, shadow lifting, and diffuse haze.
    *   Softens micro-contrast for a magical, cinematic, dreamy atmosphere.

### 🎨 3. LUT Color Grading 
Include **50+ professional presets** recreating cinematic & classic film stocks:
*   **Film Styles**: Profile replicates of classic slide and negative styles (Astia, Provia, Velvia, Portra, Gold, etc.)
*   **Monochrome**: Named after natural elements with deep rich toning (Calcite, Beryl, Bloodstone).
*   **Custom LUT Support**: Upload any `.cube` file directly.

---

## 🚀 Quick Start

1. **Upload** your photo (JPG, PNG, or WebP)
2. **Toggle** each effect (Grain, LUT, Black Mist, Halation) independently
3. **Adjust** strength, spread, and intensities to fine-tune your looks
4. **Compare Mode**: Scroll to zoom & Drag to pan both panels synchronized to detailed view
5. **Download** your loaded analog masterpiece!

---

## 📸 Supported Formats
*   **Input**: JPG, PNG, WebP (Max 10MB recommended)
*   **Output**: High-quality JPEG
*   **Scale**: Resolves adaptive dimensions natively on CPU

---

## 🔧 Technical Details

Built fully serverless for privacy and speed:
*   **HTML5 Canvas & Float32Array** for heavy calculation and buffer rendering
*   **Separable Box Blur** optimization for smooth, fast GPU-less diffusion
*   **Tailwind CSS v3 Play** for modern, responsive dark sidebar editor layout
*   **Pure Vanilla JavaScript** architecture with modular separate effect processors

---

## 📦 Installation & Local Usage

1. **Clone** the workspace:
   ```bash
   git clone https://github.com/your-username/kafta-analogue-studio.git
   ```
2. **Open `index.html`** on any local webserver or browser.

---
*Created with 💙 for photographers looking to add soul into their digital workflow.*