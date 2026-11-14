// "Remind me": a calendar file for the moment the next month report lands. The player's own calendar
// does the reminding; nothing is sent anywhere.
import { pick } from '../../ui';
import type { NextReport } from './model';

const stamp = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function calendarText(next: NextReport, now: number, url = typeof location === 'undefined' ? '' : `${location.origin}/brief`): string | null {
  if (next.ms === null) return null;
  const start = now + next.ms;
  const title = pick(`First Year: your ${next.monthLabel} report is in`, `First Year: пришёл отчёт за ${next.monthLabel}`);
  const text = pick('See what changed, answer what waits and set tomorrow’s orders.', 'Посмотри, что изменилось, ответь на то, что ждёт, и задай распоряжения на завтра.');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//First Year//Brief//EN', 'BEGIN:VEVENT',
    `UID:first-year-report-${next.month}-${Math.floor(start / 60_000)}`,
    `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(start + 15 * 60_000)}`,
    `SUMMARY:${title}`, `DESCRIPTION:${text}${url ? ` ${url}` : ''}`, ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export function calendarFile(next: NextReport, now: number): { href: string; name: string } | null {
  const text = calendarText(next, now);
  return text ? { href: `data:text/calendar;charset=utf-8,${encodeURIComponent(text)}`, name: `first-year-report-month-${next.month}.ics` } : null;
}
