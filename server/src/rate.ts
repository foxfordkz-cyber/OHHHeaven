// Ограничение частоты запросов: «ведро с жетонами» на игрока (или на IP без токена).
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(private ratePerSec: number, private burst: number, private now: () => number = Date.now) {}

  /** true — запрос можно пропустить. */
  take(key: string, cost = 1): boolean {
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: this.burst, at: t };
    b.tokens = Math.min(this.burst, b.tokens + ((t - b.at) / 1000) * this.ratePerSec);
    b.at = t;
    const ok = b.tokens >= cost;
    if (ok) b.tokens -= cost;
    this.buckets.set(key, b);
    if (this.buckets.size > 50_000) this.sweep(t);
    return ok;
  }

  private sweep(t: number): void {
    for (const [k, b] of this.buckets) if (t - b.at > 60_000) this.buckets.delete(k);
  }
}
