// QR code as an inline SVG (qrcode-generator, MIT). No canvas, no innerHTML.
import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

export function QrCode({ value, size = 148, label }: { value: string; size?: number; label?: string }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { count: n, path: d };
  }, [value]);
  const m = 2;
  return (
    <svg className="cs-qr" width={size} height={size} viewBox={`${-m} ${-m} ${count + 2 * m} ${count + 2 * m}`} role="img" aria-label={label ?? `QR code: ${value}`} shapeRendering="crispEdges">
      <rect x={-m} y={-m} width={count + 2 * m} height={count + 2 * m} fill="#fff" rx="1.5" />
      <path d={path} fill="#0a0f1f" />
    </svg>
  );
}
