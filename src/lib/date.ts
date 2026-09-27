export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(date));
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium'
  }).format(new Date(date));
}

export function relativeTime(date: string): string {
  const target = new Date(date).getTime();
  const now = Date.now();
  const diffSeconds = Math.round((target - now) / 1000);
  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.345, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year']
  ];
  let duration = diffSeconds;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(duration), unit);
    }
    duration /= amount;
  }
  return formatDate(date);
}
