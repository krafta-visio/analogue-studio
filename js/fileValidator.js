/**
 * Kafta Analogue Studio - File Validator Module
 * 
 * @description Professional-grade film grain simulation algorithm
 * @developer krafta.
 * @portfolio https://www.facebook.com/krafta.visio
 * @github https://github.com/krafta-visio
 * @version 1.0.0
 * @created 2025
 */

class FileValidator {
    constructor() {
        this.supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
    }

    validateFile(file) {
        return new Promise((resolve, reject) => {
            // Check file type
            if (!this.supportedFormats.includes(file.type)) {
                reject(new Error(`Format file tidak didukung. Gunakan: ${this.supportedFormats.join(', ')}`));
                return;
            }

            // Check file size
            if (file.size > this.maxFileSize) {
                reject(new Error(`File terlalu besar. Maksimal: ${this.maxFileSize / 1024 / 1024}MB`));
                return;
            }

            // Validate image menggunakan FileReader
            this._validateWithFileReader(file)
                .then(resolve)
                .catch(reject);
        });
    }

    _validateWithFileReader(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Check minimum dimensions
                    if (img.width < 10 || img.height < 10) {
                        reject(new Error('Gambar terlalu kecil. Minimum 10x10 pixels.'));
                        return;
                    }

                    // Check maximum dimensions (performance limit)
                    if (img.width > 5000 || img.height > 5000) {
                        reject(new Error('Gambar terlalu besar. Maksimal 5000x5000 pixels.'));
                        return;
                    }

                    resolve({
                        file: file,
                        width: img.width,
                        height: img.height,
                        aspectRatio: (img.width / img.height).toFixed(2),
                        dataUrl: e.target.result // Simpan data URL untuk digunakan nanti
                    });
                };

                img.onerror = () => {
                    reject(new Error('File gambar corrupt atau tidak valid.'));
                };

                img.src = e.target.result;
            };

            reader.onerror = () => {
                reject(new Error('Gagal membaca file.'));
            };

            reader.readAsDataURL(file);
        });
    }

    getFileInfo(file, dimensions) {
        return {
            name: file.name,
            type: file.type,
            size: this._formatFileSize(file.size),
            dimensions: `${dimensions.width} x ${dimensions.height} px`,
            aspectRatio: dimensions.aspectRatio
        };
    }

    _formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}