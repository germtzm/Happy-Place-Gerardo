import type { Blocker, MetricHistoryPoint, News } from "@/lib/dashboard";

/** Statuts affichés dans la vue « Points bloquants » (les résolus sont dans l'archive). */
export const OPEN_BLOCKER_STATUSES = ["OUVERT", "EN COURS", "SURVEILLANCE"] as const;

/** Actualités publiées uniquement (jamais de brouillon), la plus récente d'abord. */
export function publishedNewsLatestFirst(news: News[] | undefined): News[] {
  return (news ?? [])
    .filter((n) => n.status === "publiée")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Points ouverts, en cours ou sous surveillance, le plus récemment mis à jour d'abord. */
export function openBlockersLatestFirst(blockers: Blocker[] | undefined): Blocker[] {
  return (blockers ?? [])
    .filter((b) => (OPEN_BLOCKER_STATUSES as readonly string[]).includes(b.status))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/** Les `count` dernières valeurs de l'historique, la plus récente d'abord. */
export function latestHistory(
  points: MetricHistoryPoint[] | undefined,
  count = 10,
): MetricHistoryPoint[] {
  return [...(points ?? [])]
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .slice(0, count);
}
