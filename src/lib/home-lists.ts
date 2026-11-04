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

/** Valeur du sélecteur d'équipe qui ne filtre rien. */
export const TEAM_FILTER_ALL = "all";

/**
 * Filtre par équipe choisie. « all » renvoie tout ; sinon les éléments qui ont cette équipe ou aucune
 * équipe (un élément sans équipe est visible de tout le cabinet). La base décide déjà de ce qui est lisible.
 */
export function filterByTeam<T extends { teams: string[] }>(items: T[], team: string): T[] {
  if (team === TEAM_FILTER_ALL) return items;
  return items.filter((item) => !item.teams?.length || item.teams.includes(team));
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
