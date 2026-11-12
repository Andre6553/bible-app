import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
    fs
        .readFileSync(new URL('../.env', import.meta.url), 'utf8')
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => {
            const i = l.indexOf('=');
            return [l.slice(0, i), l.slice(i + 1)];
        }),
);

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: settings, error: e1 } = await sb
    .from('app_settings')
    .select('key,value')
    .in('key', ['super_users', 'super_users_auto']);
if (e1) throw e1;

let list = [];
try {
    const raw = settings.find((s) => s.key === 'super_users')?.value;
    list = typeof raw === 'string' ? JSON.parse(raw) : raw || [];
} catch {
    list = [];
}

const { data: profiles } = await sb
    .from('user_profiles')
    .select('user_id,email,subscription_tier,subscription_override,subscription_expiry');

const byId = new Map((profiles || []).map((p) => [p.user_id, p]));

const emails = new Set();
const uuids = new Set();

for (const e of list) {
    if (typeof e !== 'string') continue;
    if (e.includes('@')) emails.add(e.toLowerCase());
    else uuids.add(e);
}
for (const id of uuids) {
    const p = byId.get(id);
    if (p?.email) emails.add(p.email.toLowerCase());
}

const adminLike = (profiles || []).filter((p) => {
    const o = (p.subscription_override || '').toLowerCase();
    const t = (p.subscription_tier || '').toLowerCase();
    return o === 'admin' || o === 'tester' || t === 'admin';
});

console.log(JSON.stringify({
    super_users_auto: settings.find((s) => s.key === 'super_users_auto')?.value ?? null,
    explicit_emails_on_list: list.filter((x) => typeof x === 'string' && x.includes('@')).sort(),
    uuids_on_list: [...uuids].map((id) => ({
        user_id: id,
        email: byId.get(id)?.email ?? null,
    })),
    all_emails_with_super_via_list: [...emails].sort(),
    admin_tester_via_profile: adminLike.map((p) => ({
        email: p.email,
        user_id: p.user_id,
        subscription_override: p.subscription_override,
        subscription_tier: p.subscription_tier,
    })),
}, null, 2));
