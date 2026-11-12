// Isolated UI integration checks: real Blog component + fixture services. No live API/AI calls.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-for-you-ui-'));
const piece = (slot, format) => ({ id: slot, slot, format_id: format, topic_id: 'faith', reason: 'explored', language: 'en',
    day: '2026-11-12', prompt_version: 'for-you-v2', title: slot === 'devotional' ? 'A moment to reflect on trust' : 'Looking closely at the passage',
    summary: 'An explanatory reading with a different structure and purpose.',
    paragraphs: [
        'This is fixture commentary for layout testing. It represents a longer reflection without making any live provider requests. The page should keep this paragraph readable on narrow and wide screens.',
        'A second paragraph checks line lengths, spacing and scrolling. Scripture is presented separately from the generated explanation. No private account data is used in this fixture.',
    ], closing: 'A final observation to check spacing.',
    passage: { book_id: 43, chapter: 3, start: 1, reference: 'John 3:1–2', version: 'KJV', verses: [
        { verse: 1, text: 'Fixture verse text, shown here to test the Scripture panel layout.' },
        { verse: 2, text: 'A second fixture verse for responsive line wrapping.' },
    ] },
});
const pieces = [piece('devotional', 'quiet_reflection'), piece('article_1', 'passage_explainer'), piece('article_2', 'historical_context')];
const context = { userId: 'fixture', language: 'en', day: '2026-11-12', zone: 'Africa/Johannesburg', guest: false,
    prefs: { version: 1, preferences: { topics: { faith: 'prefer' } } }, interests: [{ id: 'faith', score: 5 }], history: pieces, feedback: {}, offline: false,
    activePlan: { reading_plans: { slug: 'fixture', title: 'A fixture reading plan' } } };

const fixtureServices = `
const pieces=${JSON.stringify(pieces)}; const ctx=${JSON.stringify(context)};
export const getForYouContext=async(id,language)=>({...ctx,language});
export const getForYouPlan=()=>pieces;
export const cachedForSlot=(ctx,slot)=>pieces.find(p=>p.slot===slot);
export const getForYouPiece=async(ctx,spec)=>({content:pieces.find(p=>p.slot===spec.slot),status:'cached'});
export const patchForYouInterest=async(ctx,id,state)=>({version:2,preferences:{topics:{[id]:state}}});
export const setForYouFeedback=async(ctx,id,field,value)=>({[field]:value});
export const getSavedForYou=async()=>pieces;
`;
const bundle = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Blog from './src/components/Blog.jsx'; createRoot(document.getElementById('root')).render(<Blog/>);`,
        resolveDir: root, loader: 'jsx' },
    bundle: true, write: false, outdir: output, jsx: 'automatic', format: 'iife', logLevel: 'silent',
    plugins: [{ name: 'fixture-services', setup(b) {
        b.onResolve({ filter: /forYouService$/ }, () => ({ path: 'service', namespace: 'fixture' }));
        b.onResolve({ filter: /SettingsContext$/ }, () => ({ path: 'settings', namespace: 'fixture' }));
        b.onResolve({ filter: /services\/bibleService$/ }, () => ({ path: 'bible', namespace: 'fixture' }));
        b.onResolve({ filter: /services\/blogService$/ }, () => ({ path: 'blog', namespace: 'fixture' }));
        b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'router', namespace: 'fixture' }));
        b.onResolve({ filter: /utils\/appUtils$/ }, () => ({ path: 'copy', namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ loader: 'js', contents: ({
            service: fixtureServices,
            settings: `const user={id:'fixture'}; export const useSettings=()=>({settings:{language:window.fixtureLanguage||'en',fontSize:18},user,authLoading:false});`,
            bible: `export const getUserId=async()=> 'fixture';`,
            blog: `export const logBlogView=async()=>{};`,
            router: `export const useNavigate=()=>()=>{};`,
            copy: `export const copyToClipboard=async()=>true;`,
        })[name] }));
    } }],
});
const js = bundle.outputFiles.find(f => f.path.endsWith('.js')).text;
const css = bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
const executablePath = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(file => fs.existsSync(file));
const browser = await puppeteer.launch({ executablePath, headless: true, pipe: true });
try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const language of ['en', 'af']) for (const width of [375, 1280]) {
        await page.setViewport({ width, height: 900 });
        await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#101a2b;--header-top-padding:32px;--text-primary:#edf1f7;--text-secondary:#bcc7d9;--bg-primary:#101a2b;--bg-secondary:#172438;--bg-tertiary:#24334a;--border-subtle:#35435a;--accent-primary:#a9c2ff;font-family:Arial,sans-serif;} ${css}</style></head><body><div id="root"></div><script>window.fixtureLanguage='${language}';${js.replaceAll('</script>', '<\\/script>')}</script></body></html>`);
        await page.waitForSelector('.fy-devotional');
        await page.waitForFunction(() => !document.querySelector('.fy-status'));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        if (overflow) throw new Error(`Horizontal overflow at ${language}/${width}`);
        const shortControls = await page.$$eval('.fy-page button,.fy-page select', nodes => nodes.filter(n => n.getBoundingClientRect().height > 0 && n.getBoundingClientRect().height < 43).length);
        if (shortControls) throw new Error(`Small controls at ${language}/${width}`);
        await page.screenshot({ path: path.join(output, `${language}-${width}.png`), fullPage: true });
        await page.click('.fy-primary');
        await page.waitForSelector('[role="dialog"]');
        const fits = await page.$eval('[role="dialog"]', node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1; });
        if (!fits) throw new Error(`Modal outside viewport at ${language}/${width}`);
        await page.keyboard.press('Escape');
        if (await page.$('[role="dialog"]')) throw new Error('Escape did not close dialog');
        console.log(`PASS ${language} ${width}px: no overflow, touch controls >=44px, modal fits, Escape works.`);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`Fixture screenshots: ${output}`);
} finally { await browser.close(); }
