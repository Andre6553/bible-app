
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// We don't have 'sharp' or 'image-size' installed by default in this environment usually? 
// Actually package.json showed "html-to-image", no server-side image lib.
// We can use a simple header reader for PNG/JPEG dimensions or just try to use 'size-of' if available, 
// but sticking to basic binary reading for PNG/JPG IHDR/SOF markers is safest/fastest without deps.
// OR, we can just use `jim` or `jimp` if installed? No.
// Let's use a very simple buffer check for PNG (since they are all PNGs).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '../public/screenshots');

function getDimensions(filePath) {
    const buffer = fs.readFileSync(filePath);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    // IHDR chunk starts at byte 8
    // Width at byte 16 (4 bytes), Height at byte 20 (4 bytes)
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        return 'Not PNG';
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return `${width}x${height}`;
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png'));
console.log('Found files:');
files.forEach(f => {
    try {
        const dims = getDimensions(path.join(DIR, f));
        console.log(`${f}: ${dims} (${(fs.statSync(path.join(DIR, f)).size / 1024).toFixed(1)} KB)`);
    } catch (e) {
        console.log(`${f}: Error reading dimensions`);
    }
});
