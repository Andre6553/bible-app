// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const GRACE_DAYS = 7

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    const json = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status,
        })

    try {
        const authHeader = req.headers.get("Authorization")
        if (!authHeader) {
            return json({ success: false, error: "missing_auth" }, 401)
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
        const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? ""

        const userClient = createClient(supabaseUrl, supabaseAnon, {
            global: { headers: { Authorization: authHeader } },
        })

        const { data: { user }, error: userErr } = await userClient.auth.getUser()
        if (userErr || !user) {
            return json({ success: false, error: "invalid_session" }, 401)
        }

        const executeAfter = new Date()
        executeAfter.setDate(executeAfter.getDate() + GRACE_DAYS)

        const { data: existing } = await userClient
            .from("account_deletion_requests")
            .select("id, status, execute_after")
            .eq("user_id", user.id)
            .eq("status", "pending")
            .maybeSingle()

        if (existing) {
            return json({
                success: true,
                already_requested: true,
                execute_after: existing.execute_after,
            })
        }

        const { error: insErr } = await userClient.from("account_deletion_requests").insert({
            user_id: user.id,
            email: user.email,
            execute_after: executeAfter.toISOString(),
            status: "pending",
        })

        if (insErr) {
            console.error("[delete-request]", insErr)
            return json({ success: false, error: insErr.message }, 500)
        }

        return json({
            success: true,
            execute_after: executeAfter.toISOString(),
            grace_days: GRACE_DAYS,
        })
    } catch (e) {
        console.error("[delete-request]", e)
        return json({ success: false, error: String(e?.message || e) }, 500)
    }
})
