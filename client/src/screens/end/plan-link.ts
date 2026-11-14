// "Copy link" for the real-world plan: the whole plan travels in the URL fragment, compressed, so the link opens
// on any device without a login or a server (the fragment never leaves the browser).
import type { RealWorldPlan } from '@ohh/shared/types';

const PREFIX_DEFLATE = 'z.';
const PREFIX_PLAIN = 'j.';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const source = new Response(bytes as BodyInit).body!;
  return new Uint8Array(await new Response(source.pipeThrough(stream)).arrayBuffer());
}

export async function encodePlan(plan: RealWorldPlan): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(plan));
  if (typeof CompressionStream === 'function') return PREFIX_DEFLATE + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
  return PREFIX_PLAIN + toBase64Url(json);
}

export async function decodePlan(token: string): Promise<RealWorldPlan | null> {
  try {
    if (token.startsWith(PREFIX_DEFLATE)) {
      const bytes = await pipe(fromBase64Url(token.slice(2)), new DecompressionStream('deflate-raw'));
      return JSON.parse(new TextDecoder().decode(bytes)) as RealWorldPlan;
    }
    if (token.startsWith(PREFIX_PLAIN)) return JSON.parse(new TextDecoder().decode(fromBase64Url(token.slice(2)))) as RealWorldPlan;
  } catch {
    return null;
  }
  return null;
}

/** `/end/plan#plan=z.…` on the current origin. */
export async function planLink(plan: RealWorldPlan, origin: string, path = '/end/plan'): Promise<string> {
  return `${origin}${path}#plan=${await encodePlan(plan)}`;
}

export function planTokenFromHash(hash: string): string | null {
  const m = /(?:^#|&)plan=([^&]+)/.exec(hash);
  return m ? m[1] : null;
}
