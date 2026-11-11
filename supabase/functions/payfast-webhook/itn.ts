/** PayFast ITN encode/signature string — keep in sync with src/utils/payfastItn.js */

export function pfUrlEncode(value: string): string {
    const trimmed = String(value ?? "").trim()
    return encodeURIComponent(trimmed)
        .replace(/%20/g, "+")
        .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function buildItnParamString(
    fieldsInPostedOrder: Array<[string, string]>,
    passphrase: string,
): string {
    if (!passphrase || !String(passphrase).trim()) {
        throw new Error("PAYFAST_PASSPHRASE required")
    }
    const pairs: string[] = []
    for (const [key, val] of fieldsInPostedOrder) {
        if (key === "signature") continue
        pairs.push(`${key}=${pfUrlEncode(val)}`)
    }
    return `${pairs.join("&")}&passphrase=${pfUrlEncode(passphrase)}`
}

export function parseAmountToCents(amountGross: string | undefined): number | null {
    if (amountGross == null || String(amountGross).trim() === "") return null
    const n = Number(String(amountGross).trim())
    if (!Number.isFinite(n) || n <= 0) return null
    return Math.round(n * 100)
}
