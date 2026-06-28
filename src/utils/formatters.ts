export function formatNumber(n: number): string {
  if (n === undefined || n === null || isNaN(n)) return '0';
  if (n >= 1000000) {
    const formatted = (n / 1000000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.round(n / 1000000)}M` : `${formatted}M`;
  }
  if (n >= 1000) {
    const formatted = (n / 1000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.round(n / 1000)}K` : `${formatted}K`;
  }
  return n.toLocaleString();
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0H 00M 00S';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}H ${m.toString().padStart(2, '0')}M ${s.toString().padStart(2, '0')}S`;
}

export function formatRank(n: number): string {
  if (n <= 3) return '';
  return n < 10 ? `0${n}` : `${n}`;
}
