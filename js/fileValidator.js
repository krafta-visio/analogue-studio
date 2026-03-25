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

class FileValidator{constructor(){this.supportedFormats=["image/jpeg","image/jpg","image/png","image/webp"],this.maxFileSize=31457280}validateFile(i){return new Promise((e,t)=>{this.supportedFormats.includes(i.type)?i.size>this.maxFileSize?t(new Error(`File too large. Maximum: ${this.maxFileSize/1024/1024}MB`)):this._validateWithFileReader(i).then(e).catch(t):t(new Error("Unsupported file format. Use: "+this.supportedFormats.join(", ")))})}_validateWithFileReader(a){return new Promise((i,r)=>{var e=new FileReader;e.onload=e=>{const t=new Image;t.onload=()=>{t.width<10||t.height<10?r(new Error("Image too small. Minimum 10x10 pixels.")):5e3<t.width||5e3<t.height?r(new Error("Image too large. Maximum 5000x5000 pixels.")):i({file:a,width:t.width,height:t.height,aspectRatio:(t.width/t.height).toFixed(2),dataUrl:e.target.result})},t.onerror=()=>{r(new Error("Corrupt or invalid image file."))},t.src=e.target.result},e.onerror=()=>{r(new Error("Failed to read file."))},e.readAsDataURL(a)})}getFileInfo(e,t){return{name:e.name,type:e.type,size:this._formatFileSize(e.size),dimensions:t.width+` x ${t.height} px`,aspectRatio:t.aspectRatio}}_formatFileSize(e){var t;return 0===e?"0 Bytes":(t=Math.floor(Math.log(e)/Math.log(1024)),parseFloat((e/Math.pow(1024,t)).toFixed(2))+" "+["Bytes","KB","MB","GB"][t])}}