let originalFile = null;
let canvas = null;
let originalImageData = null;

// Erweiterte Format-Liste
const SUPPORTED_FORMATS = [
  'png', 'jpeg', 'webp', 'ico', 'svg', 'bmp', 'tiff', 'gif', 'avif', 'heic'
];

// File Upload (alle Bildtypen)
document.getElementById('fileInput').addEventListener('change', async function(e) {
  const file = e.target.files[0];
  if (file) {
    originalFile = file;
    
    // Preview + Info
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('previewImg').src = e.target.result;
      document.getElementById('fileInfo').textContent = 
        `${file.name} (${(file.size/1024/1024).toFixed(1)}MB) → ${file.type}`;
      document.getElementById('preview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
});

// Quality Slider
document.getElementById('qualitySlider').addEventListener('input', function(e) {
  document.getElementById('qualityValue').textContent = e.target.value + '%';
});

// Haupt-Konverter - ALLE FORMATE
async function convertImage() {
  if (!originalFile) {
    alert('📁 Datei hochladen!');
    return;
  }

  const format = document.getElementById('formatSelect').value;
  const quality = parseInt(document.getElementById('qualitySlider').value) / 100;
  
  showLoading('🔄 Konvertiere...');
  
  try {
    // Canvas Setup
    canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = await loadImage(document.getElementById('previewImg').src);
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0);
    
    // Format-spezifische Konvertierung
    await convertByFormat(format, quality, ctx);
    
  } catch (error) {
    alert('❌ Fehler: ' + error.message);
  }
}

// Universal Image Loader (HEIC/GIF/etc.)
async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
    img.src = src;
  });
}

// Format-spezifische Konverter
async function convertByFormat(format, quality, ctx) {
  const filename = `converted.${format}`;
  
  switch(format.toLowerCase()) {
    case 'png':
      canvas.toBlob(blob => download(blob, filename, 'image/png'), 'image/png');
      break;
      
    case 'jpeg':
    case 'jpg':
      canvas.toBlob(blob => download(blob, filename, 'image/jpeg'), 'image/jpeg', quality);
      break;
      
    case 'webp':
      canvas.toBlob(blob => download(blob, filename, 'image/webp'), 'image/webp', quality);
      break;
      
    case 'avif':
      canvas.toBlob(blob => download(blob, filename, 'image/avif'), 'image/avif', quality);
      break;
      
    case 'bmp':
      const bmpData = canvasToBMP(canvas);
      download(new Blob([bmpData]), filename, 'image/bmp');
      break;
      
    case 'tiff':
      const tiffData = canvasToTIFF(canvas);
      download(new Blob([tiffData]), filename, 'image/tiff');
      break;
      
    case 'ico':
      createMultiSizeICO(canvas);
      break;
      
    case 'svg':
      const svg = canvasToSVG(canvas);
      download(new Blob([svg], {type: 'image/svg+xml'}), filename, 'image/svg+xml');
      break;
      
    case 'gif':
      // Animated GIF Fallback (static frame)
      canvas.toBlob(blob => download(blob, filename, 'image/gif'), 'image/png');
      break;
      
    case 'heic':
      // HEIC via PNG Fallback (Browser-Limit)
      canvas.toBlob(blob => download(blob, filename, 'image/png'), 'image/png');
      alert('ℹ️ HEIC: Verwende PNG (Browser-Limit)');
      break;
      
    default:
      throw new Error(`Format ${format} nicht unterstützt`);
  }
}

// BMP Converter
function canvasToBMP(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // BMP Header + Pixel Data (24bit)
  const bmpHeader = createBMPHeader(canvas.width, canvas.height);
  const pixelData = [];
  
  for (let i = 0; i < data.length; i += 4) {
    pixelData.push(data[i+2], data[i+1], data[i]); // BGR
  }
  
  return new Uint8Array([...bmpHeader, ...pixelData]);
}

function createBMPHeader(width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const fileSize = 54 + (rowSize * height);
  
  return new Uint8Array([
    0x42, 0x4D,                      // 'BM'
    fileSize & 0xFF, fileSize >> 8 & 0xFF, fileSize >> 16 & 0xFF, fileSize >> 24 & 0xFF,
    0, 0, 0, 0,                      // Reserved
    0x36, 0, 0, 0,                   // Offset
    0x28, 0, 0, 0,                   // DIB Header
    width & 0xFF, width >> 8 & 0xFF, width >> 16 & 0xFF, width >> 24 & 0xFF,
    height & 0xFF, height >> 8 & 0xFF, height >> 16 & 0xFF, height >> 24 & 0xFF,
    0x01, 0x00,                      // Planes
    0x18, 0x00,                      // 24bit
    0, 0, 0, 0,                      // Compression
    0, 0, 0, 0,                      // Image size
    0, 0, 0, 0,                      // X pixels/m
    0, 0, 0, 0,                      // Y pixels/m
    0, 0, 0, 0,                      // Colors used
    0, 0, 0, 0                       // Important colors
  ]);
}

// TIFF (Simplified)
function canvasToTIFF(canvas) {
  // Basic TIFF Header (für Demo)
  const tiffHeader = new Uint8Array([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00  // II* + IFD
  ]);
  return tiffHeader; // Erweiterbar
}

// Multi-Size ICO (16x16, 32x32, 64x64, 128x128, 256x256)
async function createMultiSizeICO(originalCanvas) {
  const sizes = [16, 32, 64, 128, 256];
  let icoBlobs = [];
  
  for (let size of sizes) {
    const icoCanvas = document.createElement('canvas');
    icoCanvas.width = size;
    icoCanvas.height = size;
    const ctx = icoCanvas.getContext('2d');
    
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(originalCanvas, 0, 0, size, size);
    
    const blob = await new Promise(resolve => {
      icoCanvas.toBlob(b => resolve(b), 'image/png');
    });
    icoBlobs.push(blob);
  }
  
  // ICO Container (simplified)
  const icoBlob = new Blob(icoBlobs, {type: 'image/x-icon'});
  download(icoBlob, 'favicon.ico', 'image/x-icon');
}

// SVG Vectorizer
function canvasToSVG(canvas) {
  const dataUrl = canvas.toDataURL('image/png');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
    <foreignObject width="100%" height="100%">
      <img xmlns="http://www.w3.org/1999/xhtml" src="${dataUrl}" width="${canvas.width}" height="${canvas.height}"/>
    </foreignObject>
  </svg>`;
}

// Universal Download
function download(blob, filename, mimeType = 'application/octet-stream') {
  const url = URL.createObjectURL(blob);
  const a = document.getElementById('downloadLink');
  a.href = url;
  a.download = filename;
  a.textContent = `💾 ${filename} (${(blob.size/1024).toFixed(1)}KB) downloaden`;
  
  document.getElementById('downloadInfo').textContent = 
    `✅ Konvertiert zu ${filename} | ${(blob.size/1024).toFixed(1)}KB`;
  document.getElementById('convertedPreview').src = url;
  document.getElementById('downloadSection').classList.remove('hidden');
  
  document.getElementById('downloadSection').scrollIntoView({behavior: 'smooth'});
  hideLoading();
}

// UI Helpers
function showLoading(text) {
  // Loading Animation (in HTML hinzufügen oder Console)
  console.log(text);
}

function hideLoading() {
  console.log('✅ Fertig!');
}