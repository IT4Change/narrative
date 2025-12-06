/**
 * Format a timestamp as a relative time string (e.g., "vor 3 Stunden", "gerade eben")
 * @param timestamp - Unix timestamp in milliseconds or ISO date string
 * @returns Relative time string in German
 */
export function formatRelativeTime(timestamp: number | string): string {
  const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const diffSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSeconds < 30) return 'gerade eben';
  if (diffSeconds < 90) return 'vor 1 Minute';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `vor ${diffMinutes} Minuten`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? 'vor 1 Stunde' : `vor ${diffHours} Stunden`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return diffDays === 1 ? 'vor 1 Tag' : `vor ${diffDays} Tagen`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return diffWeeks === 1 ? 'vor 1 Woche' : `vor ${diffWeeks} Wochen`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return diffMonths === 1 ? 'vor 1 Monat' : `vor ${diffMonths} Monaten`;
  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? 'vor 1 Jahr' : `vor ${diffYears} Jahren`;
}

/**
 * Format a timestamp as a full date/time string for tooltips
 * @param timestamp - Unix timestamp in milliseconds or ISO date string
 * @returns Full date/time string in German format
 */
export function formatFullDateTime(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}