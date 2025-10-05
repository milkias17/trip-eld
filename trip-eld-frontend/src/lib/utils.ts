export function toMiles(meters: number) {
  return (meters / 1609.344).toFixed(2);
}

export function secondsToHourString(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (hrs) parts.push(`${hrs} hr${hrs !== 1 ? 's' : ''}`);
  if (mins) parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);

  return parts.join(' and ') || '0 minutes';
}

export function toHour(seconds: number) {
  return Math.floor(seconds / 3600);
}
