// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
import { buildItnParamString, parseAmountToCents } from "./itn.ts"

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

    try {
        const passphrase = Deno.env.get("PAYFAST_PASSPHRASE")
        const expectedMerchant = Deno.env.get("PAYFAST_MERCHANT_ID")
        if (!passphrase || !String(passphrase).trim()) {
            console.error("[PayFast IPN] Missing PAYFAST_PASSPHRASE")
            return json({ error: "Payment configuration error" }, 500)
        }
        if (!expectedMerchant || !String(expectedMerchant).trim()) {
            console.error("[PayFast IPN] Missing PAYFAST_MERCHANT_ID")
            return json({ error: "Payment configuration error" }, 500)
        }

        const raw = await req.text()
        const params = new URLSearchParams(raw)
        const fields: Array<[string, string]> = []
        const ipnData: Record<string, string> = {}
        for (const [key, value] of params) {
            fields.push([key, value])
            ipnData[key] = value
        }

        const signature = ipnData.signature
        if (!signature || !String(signature).trim()) {
            return json({ error: "Invalid signature" }, 400)
        }

        const paramString = buildItnParamString(fields, passphrase)
        const hashHex = await md5Hex(paramString)
        if (signature.toLowerCase() !== hashHex.toLowerCase()) {
            console.error("[PayFast IPN] Signature mismatch")
            return json({ error: "Invalid signature" }, 400)
        }

        if (!ipnData.merchant_id || ipnData.merchant_id !== expectedMerchant) {
            return json({ error: "Merchant mismatch" }, 400)
        }

        const validateHost = Deno.env.get("PAYFAST_VALIDATE_HOST") || "www.payfast.co.za"
        const validateRes = await fetch(`https://${validateHost}/eng/query/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: raw,
        })
        const validateText = (await validateRes.text()).trim()
        if (validateText !== "VALID") {
            console.error("[PayFast IPN] Server validate failed")
            return json({ error: "Invalid notification" }, 400)
        }

        const status = ipnData.payment_status
        if (status !== "COMPLETE") {
            return json({ received: true, status }, 200)
        }

        const amountCents = parseAmountToCents(ipnData.amount_gross)
        if (amountCents == null) {
            return json({ error: "Invalid amount" }, 400)
        }

        const pfPaymentId = ipnData.pf_payment_id
        const orderId = ipnData.m_payment_id
        const userId = ipnData.custom_str1
        if (!orderId || !userId || !pfPaymentId) {
            return json({ error: "Missing order" }, 400)
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        )

        const { data, error } = await supabase.rpc("fulfill_payfast_itn", {
            p_order_id: orderId,
            p_pf_payment_id: pfPaymentId,
            p_amount_cents: amountCents,
            p_user_id: userId,
            p_item_name: ipnData.item_name ?? "",
            p_amount_gross: amountCents / 100,
        })

        if (error) {
            console.error("[PayFast IPN] Fulfill failed:", error.message)
            return json({ error: "Fulfillment failed" }, 500)
        }

        return json({ received: true, duplicate: Boolean(data?.duplicate) }, 200)
    } catch (error) {
        console.error("[PayFast IPN] Error:", error.message)
        return json({ error: "Payment processing error" }, 500)
    }
})
