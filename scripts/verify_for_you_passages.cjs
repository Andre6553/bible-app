const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function dedupe(rows) {
  const byVerse = new Map();
  for (const row of rows) {
    const verse = Number(row.verse);
    const text = String(row.text || '').trim();
    const ex = byVerse.get(verse);
    if (!ex || (!ex.text && text)) byVerse.set(verse, { verse, text });
  }
  return [...byVerse.values()].sort((a, b) => a.verse - b.verse);
}

async function tryPassage(books, passage, versions) {
  const book = books.find((b) => Number(b.order) === passage.book);
  if (!book) return { ok: false, why: 'no book' };
  const need = passage.end - passage.start + 1;
  for (const ver of versions) {
    const { data, error } = await sb.from('verses').select('verse,text').eq('book_id', book.id).eq('chapter', passage.chapter).eq('version', ver);
    if (error) continue;
    const rows = dedupe(data || []);
    const sel = rows.filter((v) => v.verse >= passage.start && v.verse <= passage.end);
    if (sel.length === need && sel.every((v) => v.text)) return { ok: true, ver, book: book.name_full };
  }
  return { ok: false, why: 'no version' };
}

const FALLBACKS = [
  { book: 43, chapter: 3, start: 16, end: 17 },
  { book: 45, chapter: 8, start: 28, end: 31 },
  { book: 19, chapter: 23, start: 1, end: 4 },
];

(async () => {
  const { data: books } = await sb.from('books').select('id,order,name_full').order('order');
  for (const lang of ['en', 'af']) {
    const versions = lang === 'af' ? ['AFR53', 'AFR83', 'AFRNLV'] : ['KJV', 'NIV', 'ESV', 'NKJV', 'NLT'];
    console.log('\n===', lang, '===');
    for (const p of FALLBACKS) {
      console.log(p, await tryPassage(books, p, versions));
    }
    console.log('genesis 1:1-5', await tryPassage(books, { book: 1, chapter: 1, start: 1, end: 5 }, versions));
    console.log('acts 9:1-5', await tryPassage(books, { book: 44, chapter: 9, start: 1, end: 5 }, versions));
  }
})();
