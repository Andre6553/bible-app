import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'url';

const INPUT_FILE = './Bible Versions/Bible_Afrikaans/Bible_Afrikaans.xml';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../');

const run = async () => {
    const xmlPath = path.resolve(ROOT_DIR, INPUT_FILE);
    const xmlData = fs.readFileSync(xmlPath, 'utf8');

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: ""
    });
    const jsonObj = parser.parse(xmlData);

    const bibleBooks = jsonObj.XMLBIBLE.BIBLEBOOK;
    const booksArray = Array.isArray(bibleBooks) ? bibleBooks : [bibleBooks];

    console.log("Books found in XML:");
    booksArray.forEach(b => {
        console.log(`"${b.bname}"`);
    });
};

run();
