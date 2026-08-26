export function folioDateline(date: Date): string {
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `Vol. 1 · ${day} · English writing`;
}
