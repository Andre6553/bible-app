// @ts-nocheck
// Invoke on a schedule with header: x-cron-secret: <CRON_SECRET>
// verify_jwt = false in config.toml so a custom cron header can authenticate.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

const USER_DATA_TABLES = [
    "note_labels",
    "verse_notes",
    "verse_highlights",
    "study_collections",
    "highlight_categories",
    "user_labels",
    "word_studies",
    "inductive_studies",
    "search_logs",
    "ai_questions",
    "devotional_history",
    "sermons",
    "user_settings",
    "user_reading_plans",
    "user_plan_events",
    "user_plan_profiles",
    "user_activity_logs",
    "bible_reading_logs",
    "blog_views",
    "user_trivia_history",
    "api_usage_logs",
    "payment_orders",
    "user_profiles",
]

function isAuthUserGone(err) {
    const msg = String(err?.message || err || "").toLowerCase()
    const status = err?.status || err?.code
    return status === 404 || msg.includes("user not found") || msg.includes("already been deleted")
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    const json = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status,
        })

    const cronSecret = Deno.env.get("CRON_SECRET")
    const provided = req.headers.get("x-cron-secret")
    if (!cronSecret || provided !== cronSecret) {
        return json({ success: false, error: "forbidden" }, 403)
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: claimed, error: claimErr } = await supabase.rpc("claim_account_deletion_jobs", {
        p_limit: 10,
    })

    if (claimErr) {
        return json({ success: false, error: claimErr.message }, 500)
    }

    const results = []

    for (const row of claimed || []) {
        const tableErrors = []
        const remainingCounts = {}

        try {
            for (const table of USER_DATA_TABLES) {
                const { error: delErr } = await supabase.from(table).delete().eq("user_id", row.user_id)
                if (delErr && !String(delErr.message || "").includes("does not exist")) {
                    tableErrors.push({ table, error: delErr.message })
                    continue
                }
                const { count, error: countErr } = await supabase
                    .from(table)
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", row.user_id)
                if (countErr && !String(countErr.message || "").includes("does not exist")) {
                    tableErrors.push({ table, error: countErr.message })
                    continue
                }
                remainingCounts[table] = count || 0
            }

            let authDeleteError = null
            const { error: authDelErr } = await supabase.auth.admin.deleteUser(row.user_id)
            if (authDelErr && !isAuthUserGone(authDelErr)) {
                authDeleteError = authDelErr
            }

            const leftover = Object.values(remainingCounts).some((n) => Number(n) > 0)
            const complete = tableErrors.length === 0 && !leftover && !authDeleteError

            if (complete) {
                const { error: doneErr } = await supabase
                    .from("account_deletion_requests")
                    .update({
                        status: "completed",
                        processed_at: new Date().toISOString(),
                        error_message: null,
                    })
                    .eq("id", row.id)
                if (doneErr) throw doneErr
                results.push({ id: row.id, user_id: row.user_id, ok: true })
            } else {
                const detail = JSON.stringify({ tableErrors, remainingCounts, authDeleteError: authDeleteError?.message })
                await supabase
                    .from("account_deletion_requests")
                    .update({
                        status: "pending",
                        error_message: detail.slice(0, 2000),
                        lease_until: null,
                    })
                    .eq("id", row.id)
                results.push({ id: row.id, user_id: row.user_id, ok: false, detail })
            }
        } catch (e) {
            await supabase
                .from("account_deletion_requests")
                .update({
                    status: "pending",
                    error_message: String(e?.message || e).slice(0, 2000),
                    lease_until: null,
                })
                .eq("id", row.id)
            results.push({ id: row.id, user_id: row.user_id, ok: false, error: String(e?.message || e) })
        }
    }

    return json({ success: true, processed: results.length, results })
})
