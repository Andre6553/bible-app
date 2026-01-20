import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port must match your running dev server
const BASE_URL = 'http://localhost:3005';
// Ensure output directory matches where manifest expects them
const OUTPUT_DIR = path.join(__dirname, '../public/screenshots');

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function capture(page, route, filename, width, height, isMobile = true) {
    console.log(`Capturing ${route} to ${filename} (${width}x${height})...`);

    await page.setViewport({
        width,
        height,
        isMobile,
        hasTouch: isMobile,
        deviceScaleFactor: 1, // 1 to ensure 1:1 pixel match with declared size
        isLandscape: !isMobile
    });

    try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
    } catch (e) {
        console.warn(`Navigation to ${route} timed out (networkidle0), trying again/proceeding...`);
        // Sometimes networkidle0 hangs if there's a recurring network request (like analytics or polling)
    }

    // Wait for Splash Screen to disappear (App.jsx has ~2.7s timeout + transitions)
    // We'll give it 5 seconds to be safe
    console.log('Waiting for splash screen / animations...');
    await new Promise(r => setTimeout(r, 5000));

    // Attempt to wait for key elements to ensure content is loaded
    try {
        if (route === '/bible') {
            await page.waitForSelector('.bible-content, .verse-text, .chapter-content', { timeout: 5000 });
        } else if (route === '/sermon-prep') {
            // Wait for dashboard or foundation step
            await page.waitForSelector('.sermon-dashboard, .foundation-step, .create-card', { timeout: 5000 });
        } else if (route === '/blog') {
            await page.waitForSelector('.blog-container, .post-card', { timeout: 5000 });
        }
    } catch (e) {
        console.log(`Warning: Specific selector for ${route} not found within timeout. Screenshotting anyway.`);
    }

    await page.screenshot({
        path: path.join(OUTPUT_DIR, filename),
        type: 'png'
    });
    console.log(`Saved ${filename}`);
}

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // 1. Bible Reader (Vertical) -> 1080x1920
        await capture(page, '/bible', 'bible_reader.png', 1080, 1920, true);

        // 2. Sermon Prep (Wide/Landscape) -> 1920x1080
        // Use desktop mode for landscape
        await capture(page, '/sermon-prep', 'sermon_prep.png', 1920, 1080, false);

        // 3. For You / Blog (Vertical) -> 1080x1920
        await capture(page, '/blog', 'for_you.png', 1080, 1920, true);

    } catch (err) {
        console.error('Error taking screenshots:', err);
    } finally {
        await browser.close();
        console.log('Done.');
    }
})();
