/**
 * Kafta Analogue Studio - Image EXIF Reader
 * 
 * @description Professional-grade film grain simulation algorithm
 * @developer krafta.
 * @portfolio https://www.facebook.com/krafta.visio
 * @github https://github.com/krafta-visio
 * @version 1.0.0
 * @created 2025
 */

class ExifReader {

    constructor() {
        this.available = typeof EXIF !== 'undefined';
        console.log('EXIF available:', this.available);
    }

    async getExifData(file) {
        if (!this.available) {
            console.warn('EXIF.js not available');
            return null;
        }

        return new Promise((resolve) => {
            EXIF.getData(file, function() {
                try {
                    const exifData = {
                        iso: EXIF.getTag(this, 'ISOSpeedRatings'),
                        aperture: EXIF.getTag(this, 'FNumber'),
                        shutterSpeed: EXIF.getTag(this, 'ExposureTime'),
                        focalLength: EXIF.getTag(this, 'FocalLength'),
                        camera: EXIF.getTag(this, 'Model'),
                        lens: EXIF.getTag(this, 'LensModel'),
                        date: EXIF.getTag(this, 'DateTimeOriginal')
                    };

                    // Clean up undefined values
                    Object.keys(exifData).forEach(key => {
                        if (exifData[key] === undefined) {
                            delete exifData[key];
                        }
                    });

                    console.log('EXIF extracted:', exifData);
                    resolve(Object.keys(exifData).length > 0 ? exifData : null);
                } catch (error) {
                    console.error('EXIF reading error:', error);
                    resolve(null);
                }
            });
        });
    }

    formatExifDisplay(exifData) {
        if (!exifData) return 'Tidak ada data EXIF';

        const parts = [];

        if (exifData.camera) parts.push(`Kamera: ${exifData.camera}`);
        if (exifData.iso) parts.push(`ISO: ${exifData.iso}`);
        if (exifData.aperture) parts.push(`Aperture: f/${exifData.aperture}`);
        if (exifData.shutterSpeed) parts.push(`Shutter: 1/${Math.round(1/exifData.shutterSpeed)}s`);
        if (exifData.focalLength) parts.push(`Focal: ${exifData.focalLength}mm`);

        return parts.join(' | ');
    }

    getRecommendedIso(exifData) {
        if (!exifData || !exifData.iso) {
            return 800; // Default value
        }

        const actualIso = exifData.iso;
        
        // Map actual ISO to simulation presets
        const isoMap = {
            100: 100, 200: 200, 400: 400, 800: 800, 
            1600: 1600, 3200: 3200, 6400: 3200
        };

        return isoMap[actualIso] || Math.min(3200, Math.max(100, Math.round(actualIso / 100) * 100));
    }
}