import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY not found in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function cleanup() {
    console.log('Cleaning up hard "Easy" questions using Service Role...');

    const { data, count, error } = await supabase
        .from('trivia_questions')
        .delete()
        .eq('difficulty', 'easy');

    if (error) {
        console.error('Error deleting questions:', error.message);
    } else {
        console.log('Successfully completed cleanup of easy questions.');
    }
}

cleanup();
