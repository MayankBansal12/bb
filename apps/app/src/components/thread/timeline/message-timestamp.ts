export function formatMessageTimestamp(at: number, now: number): string {
  const date = new Date(at);
  const today = new Date(now);
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (date.toDateString() === today.toDateString()) return time;

  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  if (at >= weekStart.getTime() && at < now) {
    return `${date.toLocaleDateString(undefined, { weekday: "long" })} ${time}`;
  }
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== today.getFullYear()
      ? { year: "numeric" as const }
      : {}),
  });
  return `${day}, ${time}`;
}
