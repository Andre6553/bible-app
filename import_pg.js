/**
 * Bible Import via Direct PostgreSQL Connection
 * Bypasses Supabase REST API limits
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

// Supabase PostgreSQL connection
const client = new Client({
    host: 'db.fikjnvkzhemamtlwsrin.supabase.co',
    port: 6543,
    database: 'postgres',
    user: 'postgres',
    password: 'Bible@Andre@58078',
    ssl: { rejectUnauthorized: false }
});

const SQL_DIR = './sql_imports';

async function importFile(filename) {
    console.log(`   📄 Importing ${filename}...`);

    const filePath = path.join(SQL_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
        await client.query(sql);
        console.log(`   ✅ ${filename} imported successfully`);
        return true;
    } catch (error) {
        console.error(`   ❌ Error in ${filename}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Bible Import via PostgreSQL');
    console.log('='.repeat(50));

    try {
        console.log('🔌 Connecting to Supabase PostgreSQL...');
        await client.connect();
        console.log('✅ Connected!\n');

        // Get all SQL files
        const files = fs.readdirSync(SQL_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`📁 Found ${files.length} SQL files\n`);

        // Group by version
        const versions = ['NLT', 'AFR83', 'AFRNLV', 'XHO22'];

        for (const version of versions) {
            const versionFiles = files.filter(f => f.startsWith(version));
            console.log(`\n📖 Importing ${version} (${versionFiles.length} parts)...`);

            // First, clear existing data for this version
            console.log(`   🗑️ Clearing existing ${version} verses...`);
            await client.query(`DELETE FROM verses WHERE version = '${version}'`);

            for (const file of versionFiles) {
                await importFile(file);
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ All Bible versions imported!');

    } catch (error) {
        console.error('❌ Connection error:', error.message);
    } finally {
        await client.end();
    }
}

main();
