/** Wait before the next password attempt: 0 before the first failure, then 1s, 2s, 4s ... capped. */
export function delayAfterFailures(failures: number, capMs = 30_000): number {
  if (failures <= 0) return 0;
  return Math.min(1000 * 2 ** (failures - 1), capMs);
}
