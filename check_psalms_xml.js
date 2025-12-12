
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
        if (line.includes('bname="Psalm"') || line.includes('bname="Psalms"')) {
            console.log("Found Psalms Tag:", line.trim());
        }
    }
}

check().catch(console.error);
