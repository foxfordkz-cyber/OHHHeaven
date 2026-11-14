import type { SVGProps } from 'react';

// Inline SVG icons, 24×24 grid, stroke style. No emoji, no icon font.
const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-5.5h3V20h5V9.5',
  store: 'M4 9h16l-1.5-4.5h-13L4 9Zm0 0v1.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0V9M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20',
  map: 'M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14',
  pin: 'M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  chart: 'M4 20V4m0 16h16M8 16v-4m4 4V8m4 8v-6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 9a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M21.5 20a6.5 6.5 0 0 0-4-6',
  shield: 'M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3Z',
  badge: 'M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3Zm-3 9 2 2 4-4',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z',
  cloud: 'M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 11 3.5 3.5 0 0 0 7 18Z',
  rain: 'M7 15h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 8 3.5 3.5 0 0 0 7 15Zm1 3-1 2.5m5-2.5-1 2.5m5-2.5-1 2.5',
  snow: 'M7 14h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 7 3.5 3.5 0 0 0 7 14Zm1 4h.01M12 19h.01M16 18h.01M10 21h.01M14 21h.01',
  heat: 'M12 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0ZM16 6h4m-4 4h3',
  storm: 'M7 14h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 7 3.5 3.5 0 0 0 7 14Zm6 0-2.5 4h3L11 22',
  coffee: 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Zm12 1.5h1.5a2.5 2.5 0 0 1 0 5H16M7 3v3m4-3v3',
  scissors: 'M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8 6.5 20 18M8 17.5 20 6',
  basket: 'M3 10h18l-2 9.5H5L3 10Zm4 0 3-6m7 6-3-6m-6 9.5v3m4-3v3m4-3v3',
  bed: 'M3 18V6m0 6h18v6M3 15h18M7 12V9.5a1.5 1.5 0 0 1 1.5-1.5H11v4',
  key: 'M14.5 13a5 5 0 1 0-4.7-6.6A5 5 0 0 0 14.5 13Zm-4.2-2.2L3 18v3h3l1-1v-2h2l1.3-1.3M16 7h.01',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  arrowLeft: 'M19 12H5m6-6-6 6 6 6',
  chevronRight: 'm9 6 6 6-6 6',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  lock: 'M6.5 11h11v9h-11v-9Zm2.5 0V8a3 3 0 0 1 6 0v3',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v4.5m0 3h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5.5M12 8h.01',
  x: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  sparkle: 'M12 3.5 13.8 9l5.7 1.9-5.7 1.9L12 18.5l-1.8-5.7L4.5 11l5.7-1.9L12 3.5ZM19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z',
  doc: 'M7 3h7l4 4v14H7V3Zm7 0v4h4M9.5 12h5M9.5 15.5h5',
  money: 'M3 7h18v10H3V7Zm9 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v.01M18 14v.01',
  truck: 'M3 6h11v10H3V6Zm11 4h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  handshake: 'M3 12l3.5-4.5L11 9l2-1.5 4.5 0L21 12l-4 4-2.5-2-2 2-2.5-2-2 1.5L3 12Zm8-3-3 3 1.5 1.5',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  gavel: 'm14 4 6 6m-8-4 6 6M9 9l6 6m-8.5 4.5 7-7M3 21h8',
  building: 'M5 21V5l7-2v18M12 7h7v14M8 8h.01M8 12h.01M8 16h.01M15.5 11h.01M15.5 15h.01M3 21h18',
  wallet: 'M4 7h15a1 1 0 0 1 1 1v11H5a1 1 0 0 1-1-1V7Zm0 0 12-3v3m-1 6.5h.01',
  trophy: 'M8 4h8v4.5a4 4 0 0 1-8 0V4Zm0 1.5H5a3 3 0 0 0 3 3.5m8-3.5h3a3 3 0 0 1-3 3.5M12 12.5V17m-4 3.5h8M9.5 17h5',
  play: 'M8 5.5v13l10-6.5-10-6.5Z',
  pause: 'M8 5h3v14H8V5Zm5 0h3v14h-3V5Z',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.5-2.6M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.6-3M10.5 5.1A15 15 0 0 1 22 9.5M12 20h.01',
  edit: 'M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16v4Z',
  external: 'M14 4h6v6m0-6-9 9M18 14v6H4V6h6',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
  hourglass: 'M7 3h10M7 21h10M8 3v4l4 5-4 5v4m8-18v4l-4 5 4 5v4',
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
