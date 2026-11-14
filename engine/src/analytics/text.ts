// Форматирование чисел для текстов, которые видит игрок (английский, США).
export const usd = (x: number): string => `${x < 0 ? '-' : ''}$${Math.abs(Math.round(x)).toLocaleString('en-US')}`;
export const usd2 = (x: number): string => `${x < 0 ? '-' : ''}$${Math.abs(x).toFixed(2)}`;
export const pct = (x: number): string => `${Math.round(x * 100)}%`;
export const num = (x: number): string => Math.round(x).toLocaleString('en-US');
export const plural = (n: number, word: string): string => `${num(n)} ${word}${Math.round(n) === 1 ? '' : 's'}`;
