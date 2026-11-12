// @ts-nocheck
// Invoke on a schedule (pg_cron / external cron) with header: x-cron-secret: <CRON_SECRET>
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

const USER_DATA_TABLES = [
    "verse_highlights",
    "verse_notes",
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
    "payment_orders",
]

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

    const { data: due, error: fetchErr } = await supabase
        .from("account_deletion_requests")
        .select("*")
        .eq("status", "pending")
        .lte("execute_after", new Date().toISOString())
        .limit(20)

    if (fetchErr) {
        return json({ success: false, error: fetchErr.message }, 500)
    }

    const results = []

    for (const row of due || []) {
        await supabase
            .from("account_deletion_requests")
            .update({ status: "processing" })
            .eq("id", row.id)

        try {
            for (const table of USER_DATA_TABLES) {
                await supabase.from(table).delete().eq("user_id", row.user_id)
            }
            await supabase.from("user_profiles").delete().eq("user_id", row.user_id)

            const { error: authDelErr } = await supabase.auth.admin.deleteUser(row.user_id)
            if (authDelErr) {
                throw authDelErr
            }

            await supabase
                .from("account_deletion_requests")
                .update({ status: "completed", processed_at: new Date().toISOString() })
                .eq("id", row.id)

            results.push({ id: row.id, user_id: row.user_id, ok: true })
        } catch (e) {
            await supabase
                .from("account_deletion_requests")
                .update({
                    status: "pending",
                    error_message: String(e?.message || e),
                })
                .eq("id", row.id)
            results.push({ id: row.id, user_id: row.user_id, ok: false, error: String(e?.message || e) })
        }
    }

    return json({ success: true, processed: results.length, results })
})
