import "server-only";

/**
 * PostgREST caps a single response at 1000 rows. This pages through a query in
 * 1000-row chunks so callers get every row — important for large pharmacies
 * with several thousand products. Pass a factory that applies `.range(from, to)`
 * to your query builder.
 */
export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  page = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += page) {
    const { data } = await makeQuery(from, from + page - 1);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < page) break;
  }
  return all;
}
