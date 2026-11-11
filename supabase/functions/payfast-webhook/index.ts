// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Handle CORS for direct browser tests (optional)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Parse Form Data
        const formData = await req.formData()
        const ipnData: Record<string, string> = {}
        formData.forEach((value, key) => {
            ipnData[key] = value.toString()
        })

        console.log('[PayFast IPN] Received data:', JSON.stringify(ipnData))

        // 3. Verify Signature (MD5)
        const signature = ipnData.signature
        if (!signature) throw new Error('No signature provided')

        // Create signature string
        // Note: PayFast signature string excludes 'signature' and any empty fields
        const signatureFields = Object.keys(ipnData)
            .filter(key => key !== 'signature' && ipnData[key] !== '')
            .sort() // Optional: PayFast usually expects specific order but sorted works if you match PayFast settings
            .map(key => `${key}=${encodeURIComponent(ipnData[key].replace(/ /g, "+"))}`)
            .join('&')

        // Append Passphrase if set in Supabase Secrets
        const passphrase = Deno.env.get('PAYFAST_PASSPHRASE')
        const finalString = passphrase ? `${signatureFields}&passphrase=${encodeURIComponent(passphrase)}` : signatureFields

        // MD5 Hash
        const hash = await crypto.subtle.digest("MD5", new TextEncoder().encode(finalString))
        const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')

        const sigOk = signature.toLowerCase() === hashHex.toLowerCase()
        if (!sigOk) {
            console.error('[PayFast IPN] Invalid signature', { provided: signature, computed: hashHex })
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        const expectedMerchant = Deno.env.get('PAYFAST_MERCHANT_ID')
        if (expectedMerchant && ipnData.merchant_id && ipnData.merchant_id !== expectedMerchant) {
            throw new Error('Merchant ID mismatch')
        }

        const amountGross = parseFloat(ipnData.amount_gross || '0')
        const minAmount = parseFloat(Deno.env.get('PAYFAST_MIN_AMOUNT_ZAR') || '1')
        if (Number.isFinite(amountGross) && amountGross > 0 && amountGross < minAmount) {
            throw new Error('Amount below minimum')
        }

        // 4. Process Payment
        const userId = ipnData.custom_str1 // We pass user_id in custom_str1
        const status = ipnData.payment_status
        const pfPaymentId = ipnData.pf_payment_id

        if (pfPaymentId && status === 'COMPLETE') {
            const { data: prior } = await supabase
                .from('payment_history')
                .select('id')
                .eq('pf_payment_id', pfPaymentId)
                .eq('payment_status', 'COMPLETE')
                .eq('status', 'success')
                .limit(1)
                .maybeSingle()

            if (prior) {
                console.log('[PayFast IPN] Duplicate COMPLETE ignored:', pfPaymentId)
                return new Response(JSON.stringify({ received: true, duplicate: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                })
            }
        }

        // Audit Log
        await supabase.from('payment_history').insert({
            user_id: userId || 'unknown',
            status: status === 'COMPLETE' ? 'success' : 'pending',
            amount_gross: amountGross,
            pf_payment_id: pfPaymentId,
            payment_status: status,
            item_name: ipnData.item_name,
            full_ipn_data: ipnData,
            provider: 'payfast'
        })

        if (status === 'COMPLETE' && userId) {
            console.log('[PayFast IPN] Granting subscription to user:', userId)

            const expiryDate = new Date()
            expiryDate.setDate(expiryDate.getDate() + 30)

            const { error: updateError } = await supabase
                .from('user_profiles')
                .update({
                    subscription_tier: 'premium',
                    subscription_override: 'premium', // Explicitly set for backend logic visibility
                    subscription_expiry: expiryDate.toISOString(),
                    last_renewal_month: new Date().toISOString().slice(0, 7)
                })
                .eq('user_id', userId)

            if (updateError) throw updateError
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('[PayFast IPN] Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
