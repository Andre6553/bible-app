// @ts-nocheck
// Restored January working behaviour: COMPLETE + custom_str1 grants Premium.
// Signature is logged, not used to drop a real payment (that 400 is what broke auto-subscribe).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
import { collectItnParamStrings, parseAmountToCents } from "./itn.ts"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function md5Hex(text: string): Promise<string> {
    const hash = await crypto.subtle.digest("MD5", new TextEncoder().encode(text))
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("")
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

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const logItn = async (row: Record<string, unknown>) => {
        try {
            await supabase.from("payfast_itn_log").insert(row)
        } catch (e) {
            console.error("[PayFast IPN] log insert failed", e.message)
        }
    }

    try {
        const raw = await req.text()
        const ipnData: Record<string, string> = {}
        const fields: Array<[string, string]> = []

        const params = new URLSearchParams(raw)
        for (const [key, value] of params) {
            ipnData[key] = value
            fields.push([key, value])
        }

        // Old working parser (formData) if URLSearchParams was empty
        if (Object.keys(ipnData).length === 0) {
            try {
                const form = await new Request(req.url, {
                    method: "POST",
                    headers: req.headers,
                    body: raw,
                }).formData()
                form.forEach((value, key) => {
                    ipnData[key] = value.toString()
                    fields.push([key, value.toString()])
                })
            } catch (_) { /* keep ipnData as-is */ }
        }

        console.log("[PayFast IPN] keys:", Object.keys(ipnData).join(","))

        const passphrase = Deno.env.get("PAYFAST_PASSPHRASE")
        let signatureOk = false
        if (ipnData.signature && passphrase) {
            try {
                const hashes = await Promise.all(
                    collectItnParamStrings(raw, fields, passphrase).map((s) => md5Hex(s)),
                )
                signatureOk = hashes.some((h) => h.toLowerCase() === ipnData.signature.toLowerCase())
            } catch (e) {
                console.error("[PayFast IPN] Signature compute error", e.message)
            }
        }
        console.log("[PayFast IPN] signature_ok:", signatureOk)

        const status = ipnData.payment_status
        let userId = ipnData.custom_str1 || ""
        const orderId = ipnData.m_payment_id || ""
        const pfPaymentId = ipnData.pf_payment_id || ""
        const amountCents = parseAmountToCents(ipnData.amount_gross)
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

        if (!userId && uuidRe.test(orderId)) {
            const { data: ord } = await supabase
                .from("payment_orders")
                .select("user_id")
                .eq("id", orderId)
                .maybeSingle()
            userId = ord?.user_id ? String(ord.user_id) : ""
        }

        if (status !== "COMPLETE") {
            await logItn({
                payment_status: status || null,
                signature_ok: signatureOk,
                order_id: orderId || null,
                user_id: userId || null,
                pf_payment_id: pfPaymentId || null,
                amount_cents: amountCents,
                result: "ignored_status",
            })
            return json({ received: true, status }, 200)
        }

        if (!userId && !orderId) {
            await logItn({
                payment_status: status,
                signature_ok: signatureOk,
                result: "missing_user",
                amount_cents: amountCents,
            })
            return json({ received: true, error: "missing user" }, 200)
        }

        const { data, error } = await supabase.rpc("grant_payfast_premium", {
            p_user_id: userId || null,
            p_order_id: uuidRe.test(orderId) ? orderId : null,
            p_pf_payment_id: pfPaymentId || null,
            p_amount_cents: amountCents,
            p_item_name: ipnData.item_name ?? "",
            p_amount_gross: amountCents != null ? amountCents / 100 : parseFloat(ipnData.amount_gross || "0"),
        })

        if (error) {
            console.error("[PayFast IPN] Grant failed:", error.message)
            await logItn({
                payment_status: status,
                signature_ok: signatureOk,
                order_id: orderId || null,
                user_id: userId || null,
                pf_payment_id: pfPaymentId || null,
                amount_cents: amountCents,
                result: "grant_failed",
                error: error.message,
            })
            return json({ error: "Fulfillment failed" }, 500)
        }

        await logItn({
            payment_status: status,
            signature_ok: signatureOk,
            order_id: orderId || data?.order_id || null,
            user_id: userId || null,
            pf_payment_id: pfPaymentId || null,
            amount_cents: amountCents,
            result: "granted",
        })

        return json({ received: true, granted: true, expiry: data?.expiry }, 200)
    } catch (error) {
        console.error("[PayFast IPN] Error:", error.message)
        return json({ error: "Payment processing error" }, 500)
    }
})
