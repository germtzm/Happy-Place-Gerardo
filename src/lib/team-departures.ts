/** Un départ prévu ou récent dans l'une des équipes du lecteur (lecture seule, sans documents). */
export type TeamDeparture = {
  departing_label: string;
  departure_date: string;
  kind: "préavis" | "sans préavis";
  team: string | null;
};

/** « 2026-11-03 » → « 03/11/2026 » ; une valeur d'un autre format est renvoyée telle quelle. */
export function formatDepartureDay(ymd: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd.split("-").reverse().join("/") : ymd;
}

/** Départs triés par date de départ croissante, puis par libellé. Ne modifie pas la liste reçue. */
export function sortTeamDepartures(rows: TeamDeparture[]): TeamDeparture[] {
  return [...rows].sort(
    (a, b) =>
      a.departure_date.localeCompare(b.departure_date) ||
      a.departing_label.localeCompare(b.departing_label, "fr"),
  );
}
