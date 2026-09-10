import { formatMessageTimestamp } from "./message-timestamp.js";

export function MessageTimestamp({ at }: { at: number }) {
  const date = new Date(at);
  const fullTimestamp = date.toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "long",
  });
  return (
    <time
      dateTime={date.toISOString()}
      title={fullTimestamp}
      aria-label={fullTimestamp}
      className="opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 shrink-0 text-xs leading-5 text-muted-foreground whitespace-nowrap tabular-nums"
    >
      {formatMessageTimestamp(at, Date.now())}
    </time>
  );
}
