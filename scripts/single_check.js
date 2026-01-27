
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const p = path.join(__dirname, '../public/screenshots/Screenshot 2026-01-14 081839.png');

const buffer = fs.readFileSync(p);
const width = buffer.readUInt32BE(16);
const height = buffer.readUInt32BE(20);

fs.writeFileSync(path.join(__dirname, 'dims_check.txt'), `WIDTH:${width}\nHEIGHT:${height}`);
