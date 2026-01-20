
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.join(__dirname, '../public/screenshots');
const OUTPUT_DIR = path.join(__dirname, '../public/screenshots');
const RESULT_FILE = path.join(__dirname, 'processed_manifest.json');

const targetFiles = [
    'Screenshot 2026-01-14 081257.png',
    'Screenshot 2026-01-14 081405.png',
    'Screenshot 2026-01-14 081705.png',
    'Screenshot 2026-01-14 081839.png'
];

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
    });

    const page = await browser.newPage();
    const results = [];

    for (let i = 0; i < targetFiles.length; i++) {
        const filename = targetFiles[i];
        const filePath = path.join(INPUT_DIR, filename);

        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filename}`);
            continue;
        }

        // Navigate directly to file
        const fileUrl = 'file:///' + filePath.split(path.sep).join('/');
        await page.goto(fileUrl);

        // Wait for image to be loaded by browser Image Viewer
        await page.waitForSelector('img');

        const dimensions = await page.evaluate(() => {
            const img = document.querySelector('img');
            return { width: img.naturalWidth, height: img.naturalHeight };
        });

        if (dimensions.width === 0) {
            console.error(`Failed to load dimensions for ${filename}`);
            continue;
        }

        // Logic: If aspect ratio > 1, it's Landscape
        const aspect = dimensions.width / dimensions.height;
        let isLandscape = aspect > 1;

        // Force check: If it's SQUARE or close to it, maybe prefer portrait?
        // User's files usually match phone screens (Portrait).
        // Let's assume > 1.2 is Landscape, otherwise Portrait (Safe bet for tablets/phones)
        // 1920/1080 = 1.77. 1080/1920 = 0.56.

        const targetWidth = isLandscape ? 1920 : 1080;
        const targetHeight = isLandscape ? 1080 : 1920;

        console.log(`Processing ${filename}: ${dimensions.width}x${dimensions.height} (Aspect: ${aspect.toFixed(2)}) -> ${targetWidth}x${targetHeight}`);

        // Set Viewport
        await page.setViewport({ width: targetWidth, height: targetHeight, deviceScaleFactor: 1 });

        // Inject styles to force cover
        await page.evaluate((w, h) => {
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.overflow = 'hidden';
            document.body.style.background = '#000'; // Black background if any empty space (shouldnt be with cover)

            const img = document.querySelector('img');
            // Remove browser default styling for image viewer
            img.style.cursor = 'default';
            img.style.transition = 'none';
            // Center and Cover
            img.style.position = 'absolute';
            img.style.top = '50%';
            img.style.left = '50%';
            img.style.transform = 'translate(-50%, -50%)';

            // To achieve 'cover', we need to scale specifically
            // CSS object-fit doesn't work easily on the default viewer img tag without wrapper in some chrome versions
            // simplest manual math:
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const targetAspect = w / h;

            if (imgAspect > targetAspect) {
                // Image is wider than container -> Match Height
                img.style.height = '100%';
                img.style.width = 'auto';
            } else {
                // Image is taller than container -> Match Width
                img.style.width = '100%';
                img.style.height = 'auto';
            }
        }, targetWidth, targetHeight);

        // Screenshot
        const newFilename = `processed_${i + 1}.png`;
        const outputPath = path.join(OUTPUT_DIR, newFilename);

        await page.screenshot({ path: outputPath, type: 'png' });

        results.push({
            src: `screenshots/${newFilename}`,
            sizes: `${targetWidth}x${targetHeight}`,
            type: 'image/png',
            form_factor: isLandscape ? 'wide' : 'narrow',
            label: `Screenshot ${i + 1}`
        });
    }

    await browser.close();

    fs.writeFileSync(RESULT_FILE, JSON.stringify(results, null, 2));
    console.log(`Wrote results to ${RESULT_FILE}`);
})();
