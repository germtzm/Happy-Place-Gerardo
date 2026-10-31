const DAY_MS = 24 * 60 * 60 * 1000;

/** Nombre de jours entiers écoulés depuis `since` (jamais négatif). */
export function waitingDays(since: string | Date, now: Date = new Date()): number {
  const start = typeof since === "string" ? new Date(since) : since;
  const diff = now.getTime() - start.getTime();
  if (Number.isNaN(diff) || diff <= 0) return 0;
  return Math.floor(diff / DAY_MS);
}

/** Libellé du badge d'attente : « AUJOURD'HUI », « 1 JOUR », « N JOURS ». */
export function waitingLabel(days: number): string {
  if (days < 1) return "EN ATTENTE AUJOURD'HUI";
  return `EN ATTENTE DEPUIS ${days} ${days === 1 ? "JOUR" : "JOURS"}`;
}
