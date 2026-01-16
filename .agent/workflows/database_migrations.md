---
description: How to perform database migrations in Omni Bible
---

// turbo-all

# Database Migration Workflow

When performing database migrations (adding columns, creating tables, updating RLS), ALWAYS use the `exec_sql` RPC function. Do NOT attempt to connect via direct PostgreSQL (`pg` client) unless this method fails.

### Connection Details
- **SUPABASE_URL**: `https://fikjnvkzhemamtlwsrin.supabase.co`
- **SERVICE_ROLE_KEY**: Found in the `.env` file under `SUPABASE_SERVICE_ROLE_KEY`.

### Procedure

1. **Create a temporary migration script** (e.g., `run_migration.js`):
   ```javascript
   import { createClient } from '@supabase/supabase-js';
   import 'dotenv/config';

   const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

   async function migrate() {
       const sql = `ALTER TABLE ...`;
       const { error } = await supabase.rpc('exec_sql', { sql });
       if (error) console.error(error);
       else console.log('✅ Migration successful');
   }
   migrate();
   ```

2. **Run the script**:
   ```bash
   node run_migration.js
   ```

3. **Cleanup**:
   Delete the temporary script after verification.

> [!IMPORTANT]
> This `exec_sql` function is a highly privileged tool. Only use it for structural changes or global data fixes requested by the user.
