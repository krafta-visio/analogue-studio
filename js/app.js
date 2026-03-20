/**
 * Kafta Analogue Studio - App Processing Module
 * 
 * @description Professional-grade film grain simulation algorithm
 * @developer krafta.
 * @portfolio https://www.facebook.com/krafta.visio
 * @github https://github.com/krafta-visio
 * @version 3.0.0
 * @created 2025
 */

class FujiGrainApp {
    constructor() {
        this.validator = new FileValidator();
        this.exifReader = new ExifReader();
        this.grainProcessor = new GrainProcessor();
        this.lutProcessor = new LUTProcessor();
        this.halationProcessor = new HalationProcessor();
        this.blackMistProcessor = new BlackMistProcessor();
        
        this.originalImage = null;
        this.processedCanvas = null;
        this.currentSettings = {};
        this.currentFile = null;
        this.availableLUTs = [];
        
        this.initializeApp();
    }

    initializeApp() {
        console.log('🚀 Initializing Kafta Analogue Studio...');
        this.initializeEventListeners();
        this.loadAvailableLUTs();
        this.initializeSettings();
    }

    initializeEventListeners() {
        console.log('📝 Setting up event listeners...');
        
        // File input
        document.getElementById('imageInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                console.log('📁 File selected:', file.name);
                this.handleFileSelect(file);
            }
        });

        // Grain controls
        document.getElementById('applyGrainToggle').addEventListener('change', (e) => {
            this.updateSetting('applyGrain', e.target.checked);
        });

        document.getElementById('isoSelect').addEventListener('change', (e) => {
            this.updateSetting('iso', e.target.value);
        });

        document.getElementById('strengthSlider').addEventListener('input', (e) => {
            document.getElementById('strengthValue').textContent = e.target.value;
            this.updateSetting('strength', parseFloat(e.target.value));
        });

        document.getElementById('grainSizeSlider').addEventListener('input', (e) => {
            document.getElementById('grainSizeValue').textContent = e.target.value;
            this.updateSetting('grainSize', parseFloat(e.target.value));
        });
        
        // LUT controls
        document.getElementById('lutSelect').addEventListener('change', (e) => {
            this.handleLUTSelection(e.target.value);
        });

        document.getElementById('lutFileInput').addEventListener('change', (e) => {
            this.handleCustomLUTUpload(e.target.files[0]);
        });

        document.getElementById('lutStrengthSlider').addEventListener('input', (e) => {
            document.getElementById('lutStrengthValue').textContent = e.target.value;
            this.updateSetting('lutStrength', parseFloat(e.target.value));
        });

        document.getElementById('applyLutToggle').addEventListener('change', (e) => {
            this.updateSetting('applyLUT', e.target.checked);
        });

        // Halation controls
        document.getElementById('applyHalationToggle').addEventListener('change', (e) => {
            this.updateSetting('applyHalation', e.target.checked);
        });

        document.getElementById('halationStrengthSlider').addEventListener('input', (e) => {
            document.getElementById('halationStrengthValue').textContent = e.target.value;
            this.updateSetting('halationStrength', parseFloat(e.target.value));
        });

        document.getElementById('halationRadiusSlider').addEventListener('input', (e) => {
            document.getElementById('halationRadiusValue').textContent = e.target.value;
            this.updateSetting('halationRadius', parseInt(e.target.value, 10));
        });

        // Black Mist controls
        document.getElementById('applyBlackMistToggle').addEventListener('change', (e) => {
            this.updateSetting('applyBlackMist', e.target.checked);
        });

        document.getElementById('blackMistIntensitySlider').addEventListener('input', (e) => {
            document.getElementById('blackMistIntensityValue').textContent = e.target.value;
            this.updateSetting('blackMistIntensity', parseFloat(e.target.value));
        });

        document.getElementById('blackMistRadiusSlider').addEventListener('input', (e) => {
            document.getElementById('blackMistRadiusValue').textContent = e.target.value;
            this.updateSetting('blackMistRadius', parseInt(e.target.value, 10));
        });

        // Action buttons
        document.getElementById('applyGrainBtn').addEventListener('click', () => {
            this.applyGrain();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetImage();
        });

        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadResult();
        });
    }

    initializeSettings() {
        this.currentSettings = {
            applyGrain: document.getElementById('applyGrainToggle').checked,
            iso: document.getElementById('isoSelect').value,
            strength: parseFloat(document.getElementById('strengthSlider').value),
            grainSize: parseFloat(document.getElementById('grainSizeSlider').value),
            selectedLUT: 'none',
            lutStrength: parseFloat(document.getElementById('lutStrengthSlider').value),
            applyLUT: document.getElementById('applyLutToggle').checked,
            applyHalation: document.getElementById('applyHalationToggle').checked,
            halationStrength: parseFloat(document.getElementById('halationStrengthSlider').value),
            halationRadius: parseInt(document.getElementById('halationRadiusSlider').value, 10),
            applyBlackMist: document.getElementById('applyBlackMistToggle').checked,
            blackMistIntensity: parseFloat(document.getElementById('blackMistIntensitySlider').value),
            blackMistRadius: parseInt(document.getElementById('blackMistRadiusSlider').value, 10)
        };
        console.log('⚙️ Settings initialized:', this.currentSettings);
    }

    async loadAvailableLUTs() {
        try {
            console.log('🎨 Loading available LUTs...');
            this.availableLUTs = await this.lutProcessor.getAvailableLUTs();
            this.populateLUTDropdown();
            console.log('✅ Available LUTs loaded:', this.availableLUTs.length, 'LUTs found');
        } catch (error) {
            console.error('❌ Failed to load LUT list:', error);
        }
    }

	populateLUTDropdown() {
		const lutSelect = document.getElementById('lutSelect');
		
		const newOptions = [
			{ value: 'none', text: 'No LUT (Original Colors)', selected: true },
			{ value: 'custom', text: 'Custom LUT (.cube)…' }
		];
		
		this.availableLUTs.forEach(lut => {
			newOptions.push({
				value: lut.id,
				text: lut.displayName
			});
		});
		
		lutSelect.innerHTML = '';
		newOptions.forEach(opt => {
			const option = document.createElement('option');
			option.value = opt.value;
			option.textContent = opt.text;
			if (opt.selected) option.selected = true;
			lutSelect.appendChild(option);
		});
		
		console.log(`📋 LUT dropdown rebuilt with ${this.availableLUTs.length} LUTs + static options`);
	}

    handleLUTSelection(lutName) {
        const customUpload = document.getElementById('customLutUpload');
        if (lutName === 'custom') {
            customUpload.classList.remove('hidden');
        } else {
            customUpload.classList.add('hidden');
        }
        this.updateSetting('selectedLUT', lutName);
    }

    async handleCustomLUTUpload(file) {
        if (!file) return;

        try {
            this.showLoading(true);
            await this.lutProcessor.loadCustomLUT(file);
            console.log('✅ Custom LUT loaded successfully');
            this.showSuccess('Custom LUT loaded successfully!');
        } catch (error) {
            this.showError('Failed to load LUT: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async handleFileSelect(file) {
        if (!file) return;

        try {
            this.showLoading(true);
            this.enableControls(false);
            
            console.log('📄 Processing file:', file.name);
            this.currentFile = file;
            
            const validation = await this.validator.validateFile(file);
            console.log('✅ File validated:', validation);
            
            await this.loadImage(validation.dataUrl);
            
            const exifData = await this.exifReader.getExifData(file);
            console.log('📊 EXIF data:', exifData);
            
            this.updateFileInfo(validation, exifData);
            this.autoConfigureIso(exifData);
            
            this.enableControls(true);
            
        } catch (error) {
            console.error('❌ Error processing file:', error);
            this.showError(error.message);
            this.resetFileInput();
        } finally {
            this.showLoading(false);
        }
    }

    async loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                console.log('🖼️ Image loaded:', img.naturalWidth, 'x', img.naturalHeight);
                this.originalImage = img;
                this.displayOriginalImage(img);
                resolve(img);
            };

            img.onerror = () => {
                console.error('❌ Failed to load image');
                reject(new Error('Failed to load image'));
            };

            img.src = dataUrl;
        });
    }

    displayOriginalImage(img) {
        const originalImgElement = document.getElementById('originalImage');
        const previewContainer = document.getElementById('previewContainer');
        const emptyState = document.getElementById('emptyState');

        originalImgElement.src = '';
        originalImgElement.src = img.src;
        
        const canvas = document.getElementById('processedCanvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        
        // Show preview, hide empty state (Tailwind classes)
        previewContainer.classList.remove('hidden');
        emptyState.classList.add('hidden');

        // Update image stats
        document.getElementById('imageStats').textContent = 
            `${img.naturalWidth} × ${img.naturalHeight}px`;

        // Reset viewer to fit image after a short delay (DOM needs to settle)
        requestAnimationFrame(() => {
            if (typeof viewerReset === 'function') viewerReset();
        });
    }

    updateFileInfo(validation, exifData) {
        const fileInfo = this.validator.getFileInfo(validation.file, validation);
        
        document.getElementById('fileDetails').textContent = 
            `${fileInfo.name} · ${fileInfo.size} · ${fileInfo.dimensions}`;
        document.getElementById('fileInfo').classList.remove('hidden');

        if (exifData) {
            document.getElementById('exifDetails').textContent = 
                this.exifReader.formatExifDisplay(exifData);
            document.getElementById('exifInfo').classList.remove('hidden');
        } else {
            document.getElementById('exifInfo').classList.add('hidden');
        }
    }

    autoConfigureIso(exifData) {
        const isoSelect = document.getElementById('isoSelect');
        if (exifData && isoSelect.value === 'auto') {
            const recommendedIso = this.exifReader.getRecommendedIso(exifData);
            isoSelect.value = recommendedIso;
            this.updateSetting('iso', recommendedIso);
            console.log('⚙️ Auto-configured ISO to:', recommendedIso);
        }
    }

    updateSetting(key, value) {
        this.currentSettings[key] = value;
        console.log('⚙️ Setting updated:', key, value);
    }

    async applyGrain() {
        if (!this.originalImage) {
            this.showError('Please upload an image first');
            return;
        }

        this.showLoading(true);
        this.enableControls(false);

        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            console.log('🎯 Starting image processing with settings:', this.currentSettings);
            
            // Step 1: Apply grain (if enabled)
            let canvas;
            if (this.currentSettings.applyGrain) {
                canvas = await this.grainProcessor.applyGrain(
                    this.originalImage, 
                    this.currentSettings
                );
            } else {
                // No grain — just copy original to canvas
                canvas = document.createElement('canvas');
                canvas.width = this.originalImage.naturalWidth;
                canvas.height = this.originalImage.naturalHeight;
                canvas.getContext('2d').drawImage(this.originalImage, 0, 0);
            }

            // Step 2: Apply Black Mist (if enabled)
            if (this.currentSettings.applyBlackMist) {
                console.log('☁️ Applying Black Mist filter...');
                this.blackMistProcessor.applyBlackMist(canvas, this.currentSettings);
            }

            // Step 3: Apply halation (if enabled)
            if (this.currentSettings.applyHalation) {
                console.log('🌟 Applying film halation...');
                this.halationProcessor.applyHalation(canvas, this.currentSettings);
            }

            // Step 4: Apply LUT (if enabled)
            if (this.currentSettings.applyLUT && 
                this.currentSettings.selectedLUT && 
                this.currentSettings.selectedLUT !== 'none') {
                await this.applyLUTToCanvas(canvas);
            }

            // Step 5: Update result
            this.processedCanvas = canvas;
            this.displayProcessedImage();
            
            console.log('✅ Image processing completed successfully');
            this.showSuccess('Film simulation applied!');
            
        } catch (error) {
            console.error('❌ Error processing image:', error);
            this.handleProcessingError(error);
            
        } finally {
            this.showLoading(false);
            this.enableControls(true);
        }
    }

    async applyLUTToCanvas(canvas) {
        try {
            console.log('🎨 Applying LUT:', this.currentSettings.selectedLUT);
            
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            const processedData = await this.lutProcessor.applyLUT(
                imageData, 
                this.currentSettings.selectedLUT,
                this.currentSettings.lutStrength || 1.0
            );
            
            if (!processedData || !(processedData instanceof ImageData)) {
                throw new Error('LUT processing returned invalid ImageData');
            }
            
            ctx.putImageData(processedData, 0, 0);
            console.log('✅ LUT applied successfully');
            
        } catch (lutError) {
            console.error('❌ LUT processing failed:', lutError);
            this.showError('LUT processing failed: ' + lutError.message);
        }
    }

    handleProcessingError(error) {
        let errorMessage = 'Failed to process image: ' + error.message;
        
        if (error.message.includes('memory') || error.message.includes('size')) {
            errorMessage = 'Image is too large for processing. Try with a smaller image.';
        } else if (error.message.includes('LUT')) {
            errorMessage = 'Color grading failed: ' + error.message;
        } else if (error.message.includes('grain')) {
            errorMessage = 'Grain application failed: ' + error.message;
        }
        
        this.showError(errorMessage);
        this.resetImage();
    }

    displayProcessedImage() {
        const canvasElement = document.getElementById('processedCanvas');
        const context = canvasElement.getContext('2d');
        
        canvasElement.width = this.processedCanvas.width;
        canvasElement.height = this.processedCanvas.height;
        
        context.clearRect(0, 0, canvasElement.width, canvasElement.height);
        context.drawImage(this.processedCanvas, 0, 0);
    }

    resetImage() {
        if (this.originalImage) {
            this.displayOriginalImage(this.originalImage);
            this.processedCanvas = null;
            
            this.resetUIControls();
            
            this.currentSettings = {
                applyGrain: true,
                iso: '800',
                strength: 0.7,
                grainSize: 1.0,
                selectedLUT: 'none',
                lutStrength: 1.0,
                applyLUT: false,
                applyHalation: false,
                halationStrength: 0.50,
                halationRadius: 20,
                applyBlackMist: false,
                blackMistIntensity: 0.50,
                blackMistRadius: 25
            };
            
            console.log('🔄 Image and settings reset to original');
        }
    }

	resetUIControls() {
		// Reset grain controls
		document.getElementById('applyGrainToggle').checked = true;
		document.getElementById('isoSelect').value = '800';
		document.getElementById('strengthSlider').value = 0.7;
		document.getElementById('strengthValue').textContent = '0.7';
		document.getElementById('grainSizeSlider').value = 1.0;
		document.getElementById('grainSizeValue').textContent = '1.0';

		// Reset LUT controls
		document.getElementById('applyLutToggle').checked = false;
		document.getElementById('lutSelect').value = 'none';
		document.getElementById('customLutUpload').classList.add('hidden');
		document.getElementById('lutStrengthSlider').value = 1.0;
		document.getElementById('lutStrengthValue').textContent = '1.0';

		// Reset halation controls
		document.getElementById('applyHalationToggle').checked = false;
		document.getElementById('halationStrengthSlider').value = 0.50;
		document.getElementById('halationStrengthValue').textContent = '0.50';
		document.getElementById('halationRadiusSlider').value = 20;
		document.getElementById('halationRadiusValue').textContent = '20';

		// Reset black mist controls
		document.getElementById('applyBlackMistToggle').checked = false;
		document.getElementById('blackMistIntensitySlider').value = 0.50;
		document.getElementById('blackMistIntensityValue').textContent = '0.50';
		document.getElementById('blackMistRadiusSlider').value = 25;
		document.getElementById('blackMistRadiusValue').textContent = '25';

		// Re-sync accordion panels with new toggle states
		document.getElementById('grainSettingsPanel').classList.remove('hidden');
		document.getElementById('lutSettingsPanel').classList.add('hidden');
		document.getElementById('halationSettingsPanel').classList.add('hidden');
		document.getElementById('blackMistSettingsPanel').classList.add('hidden');
	}

    downloadResult() {
        if (!this.processedCanvas) {
            this.showError('No processed image to download. Apply film simulation first.');
            return;
        }

        try {
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `kafta-analogue-${timestamp}.jpg`;
            link.href = this.processedCanvas.toDataURL('image/jpeg', 0.95);
            link.click();
            
            console.log('📥 Download initiated');
            this.showSuccess('Download started!');
            
        } catch (error) {
            console.error('❌ Download error:', error);
            this.showError('Failed to download image: ' + error.message);
        }
    }

    enableControls(enabled) {
        const controls = [
            'applyGrainBtn', 'resetBtn', 'downloadBtn', 
            'applyGrainToggle', 'isoSelect', 'strengthSlider', 'grainSizeSlider',
            'lutSelect', 'lutStrengthSlider', 'applyLutToggle', 'lutFileInput',
            'applyHalationToggle', 'halationStrengthSlider', 'halationRadiusSlider',
            'applyBlackMistToggle', 'blackMistIntensitySlider', 'blackMistRadiusSlider'
        ];
        
        controls.forEach(controlId => {
            const element = document.getElementById(controlId);
            if (element) {
                element.disabled = !enabled;
            }
        });
        
        // Apply button text update
        const applyBtn = document.getElementById('applyGrainBtn');
        if (applyBtn) {
            applyBtn.textContent = enabled ? 'Apply Film Simulation' : 'Processing…';
        }

        // Download only when there's a result
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.disabled = !(enabled && this.processedCanvas);
        }
    }

    resetFileInput() {
        document.getElementById('imageInput').value = '';
        this.currentFile = null;
        this.enableControls(false);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;

        if (show) {
            overlay.classList.remove('hidden');
            document.body.style.cursor = 'wait';
        } else {
            overlay.classList.add('hidden');
            document.body.style.cursor = '';
        }
    }

    showError(message) {
        console.error('❌ App Error:', message);
        this._showToast(message, '#dc2626');
    }
    
    showSuccess(message) {
        console.log('✅ Success:', message);
        this._showToast(message, '#16a34a');
    }

    _showToast(message, bgColor) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'film-toast pointer-events-auto px-4 py-2.5 rounded-lg text-white text-sm shadow-xl';
        toast.style.background = bgColor;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity .2s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 220);
        }, 3000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 DOM loaded, initializing Kafta Analogue Studio...');
    new FujiGrainApp();
});