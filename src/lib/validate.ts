// Input bounds for paid endpoints. Callers pay $0.02/request; the request must
// never be able to buy an unbounded query.
export const MAX_RADIUS_MI = 50;
export const MAX_RESULT_LIMIT = 100;
export const MAX_QUERY_LENGTH = 100;

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n =
    typeof value === 'number' ? Math.trunc(value) : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// Build a contains-match ILIKE pattern with user input matched literally
// (% _ \ are pattern metacharacters in Postgres).
export function likePattern(input: string): string {
  return '%' + input.replace(/([\\%_])/g, '\\$1') + '%';
}
