/**
 * Paginate a Supabase query until a short page. Caller must order by a unique
 * tie-breaker (typically created_at + id) so pages do not skip/duplicate.
 *
 * @param {(from: number, to: number) => Promise<{ data: unknown[]|null, error: object|null }>} runPage
 * @param {number} pageSize
 * @returns {Promise<unknown[]>}
 */
export async function fetchAllPages(runPage, pageSize = 1000) {
    const all = [];
    let from = 0;
    const size = Math.max(1, pageSize);

    for (;;) {
        const to = from + size - 1;
        const { data, error } = await runPage(from, to);
        if (error) throw error;
        const batch = data || [];
        all.push(...batch);
        if (batch.length < size) break;
        from += size;
        if (from > 5_000_000) {
            throw new Error('fetchAllPages aborted: too many pages');
        }
    }

    return all;
}

/** Prefer this for collections: newest first, unique id as tie-breaker. */
export function rangeOrder(query, { createdAt = 'created_at', id = 'id', ascending = false } = {}) {
    return query.order(createdAt, { ascending }).order(id, { ascending });
}
