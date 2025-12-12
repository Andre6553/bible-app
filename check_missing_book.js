
import fs from 'fs';
import readline from 'readline';

const XML_FILE_PATH = './afr53.xml.xml';

async function check() {
    const fileStream = fs.createReadStream(XML_FILE_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.includes('bnumber="14"')) {
            console.log("Found II Chronicles (bnumber 14):", line.trim());
        }
    }
}

check().catch(console.error);
