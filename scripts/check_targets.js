
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '../public/screenshots');

const targetFiles = [
    'Screenshot 2026-01-14 081257.png',
    'Screenshot 2026-01-14 081405.png',
    'Screenshot 2026-01-14 081705.png',
    'Screenshot 2026-01-14 081839.png'
];

function getDimensions(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return 'Not PNG';
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
    } catch (e) {
        return null;
    }
}

targetFiles.forEach(f => {
    const p = path.join(DIR, f);
    if (fs.existsSync(p)) {
        const dims = getDimensions(p);
        console.log(`FILE:${f}|W:${dims.width}|H:${dims.height}`);
    } else {
        console.log(`FILE:${f}|NOTFOUND`);
    }
});
