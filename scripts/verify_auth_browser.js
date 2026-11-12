// Browser smoke tests against a running local Vite server. All backend calls are
// intercepted: this neither creates real accounts nor sends real email.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
const browser = await puppeteer.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (url.includes('.supabase.co')) {
            const body = url.includes('/auth/v1/signup')
                ? { id: '00000000-0000-4000-8000-000000000123', email: 'test@example.invalid', identities: [] }
                : [];
            return request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
        }
        if (!url.startsWith('http://127.0.0.1:5184') && !url.startsWith('data:')) return request.abort();
        request.continue();
    });
    await page.goto('http://127.0.0.1:5184/admin');
    await page.waitForFunction(() => location.pathname === '/auth');
    assert.equal(new URL(page.url()).searchParams.get('next'), '/admin');
    await page.goto('http://127.0.0.1:5184/study/private-study');
    await page.waitForFunction(() => location.pathname === '/auth');
    assert.equal(new URL(page.url()).searchParams.get('next'), '/study/private-study');
    await page.waitForSelector('.toggle-auth-btn');
    await page.click('.toggle-auth-btn');
    await page.type('input[type=email]', 'test@example.invalid');
    await page.type('input[type=password]', 'test-password-123');
    await page.click('.auth-submit-btn');
    await page.waitForFunction(() => document.body.textContent.includes('Please check your email for the confirmation link'));
    assert.equal(new URL(page.url()).pathname, '/auth');
    assert.equal(await page.$('.auth-syncing-state'), null);
    console.log('PASS: admin and private study redirects; unconfirmed signup stays on login without migration.');
} finally {
    await browser.close();
}
