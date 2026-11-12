// @ts-nocheck
// Invoke on a schedule with header: x-cron-secret: <CRON_SECRET>
// verify_jwt = false in config.toml so a custom cron header can authenticate.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

import { processDeletionJob } from "../_shared/deletionProcessor.js"

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

    const results = []
    // Claim just before processing, so waiting jobs do not consume their lease.
    for (let n = 0; n < 5; n++) {
        const { data: claimed, error: claimErr } = await supabase.rpc("claim_account_deletion_jobs", { p_limit: 1 })
        if (claimErr) return json({ success: false, error: claimErr.message, results }, 500)
        if (!claimed?.length) break
        const result = await processDeletionJob(supabase, claimed[0])
        results.push(result)
        // Do not immediately reclaim a failed pending job in this invocation.
        if (!result.ok) break
    }
    return json({ success: results.every((r) => r.ok), processed: results.length, results })
})
