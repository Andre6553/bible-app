/**
 * Paginate a Supabase query builder until all rows are fetched (PostgREST default cap safe).
 *
 * @param {(from: number, to: number) => Promise<{ data: unknown[]|null, error: object|null }>} runPage
 * @param {number} pageSize
 * @returns {Promise<unknown[]>}
 */
export async function fetchAllPages(runPage, pageSize = 1000) {
    const all = [];
    let from = 0;

    for (;;) {
        const to = from + pageSize - 1;
        const { data, error } = await runPage(from, to);
        if (error) throw error;
        const batch = data || [];
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
    }

    return all;
}
