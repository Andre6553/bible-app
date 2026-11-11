/**
 * PayFast ITN signature helpers (Instant Transaction Notification).
 * Matches PayFast PHP: posted field order (not alphabetical), urlencode + spaces as '+'.
 * https://developers.payfast.co.za/docs/itn-instant-transaction-notification/
 */

export function pfUrlEncode(value) {
    const trimmed = String(value ?? '').trim();
    return encodeURIComponent(trimmed)
        .replace(/%20/g, '+')
        .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * @param {Array<[string, string]>} fieldsInPostedOrder
 * @param {string} passphrase
 */
export function buildItnParamString(fieldsInPostedOrder, passphrase) {
    if (!passphrase || !String(passphrase).trim()) {
        throw new Error('PAYFAST_PASSPHRASE required');
    }
    const pairs = [];
    for (const [key, val] of fieldsInPostedOrder) {
        if (key === 'signature') continue;
        pairs.push(`${key}=${pfUrlEncode(val)}`);
    }
    return `${pairs.join('&')}&passphrase=${pfUrlEncode(passphrase)}`;
}

export function parseAmountToCents(amountGross) {
    if (amountGross == null || String(amountGross).trim() === '') return null;
    const n = Number(String(amountGross).trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
}
