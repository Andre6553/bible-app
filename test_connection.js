import pg from 'pg';

const client = new pg.Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.fikjnvkzhemamtlwsrin',
    password: 'sb_secret_R-9Xx-B1uGev8Ijx19o36Q_DYQBRXfS',
    ssl: { rejectUnauthorized: false }
});

console.log('Testing connection to Supabase PostgreSQL...');
console.log('Host:', 'db.fikjnvkzhemamtlwsrin.supabase.co');

client.connect()
    .then(() => {
        console.log('✅ Connected successfully!');
        return client.query('SELECT COUNT(*) as count FROM verses');
    })
    .then(result => {
        console.log('📊 Current verse count:', result.rows[0].count);
    })
    .catch(err => {
        console.log('❌ Error:', err.message);
    })
    .finally(() => {
        client.end();
    });
