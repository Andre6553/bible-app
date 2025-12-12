
import fs from 'fs';
import readline from 'readline';

const XML_FILE_PATH = './afr53.xml.xml';

async function check() {
    console.log("Reading book names from XML...");

    const fileStream = fs.createReadStream(XML_FILE_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        const trimmed = line.trim();
        const bookMatch = trimmed.match(/<BIBLEBOOK.*?bname="(.*?)"/);
        if (bookMatch) {
            console.log(`Found Book: ${bookMatch[1]}`);
        }
    }
}

check().catch(console.error);
