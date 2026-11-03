import { describe, expect, test } from "bun:test";
import { formatDepartureDay, sortTeamDepartures } from "./team-departures";

const row = (departing_label, departure_date, kind = "préavis", team = "Équipe A") => ({
  departing_label,
  departure_date,
  kind,
  team,
});

describe("formatDepartureDay", () => {
  test("met la date au format jj/mm/aaaa", () => {
    expect(formatDepartureDay("2026-11-03")).toBe("03/11/2026");
    expect(formatDepartureDay("2027-01-31")).toBe("31/01/2027");
  });

  test("renvoie telle quelle une valeur d'un autre format", () => {
    expect(formatDepartureDay("03/11/2026")).toBe("03/11/2026");
    expect(formatDepartureDay("")).toBe("");
  });
});

describe("sortTeamDepartures", () => {
  test("trie par date de départ croissante", () => {
    const sorted = sortTeamDepartures([
      row("C", "2026-12-01"),
      row("A", "2026-11-03"),
      row("B", "2026-11-20"),
    ]);
    expect(sorted.map((d) => d.departing_label)).toEqual(["A", "B", "C"]);
  });

  test("à date égale, trie par libellé", () => {
    const sorted = sortTeamDepartures([
      row("Zoé Martin", "2026-11-03"),
      row("Élodie Durand", "2026-11-03"),
      row("Alice Petit", "2026-11-03"),
    ]);
    expect(sorted.map((d) => d.departing_label)).toEqual([
      "Alice Petit",
      "Élodie Durand",
      "Zoé Martin",
    ]);
  });

  test("ne modifie pas la liste reçue et accepte une liste vide", () => {
    const input = [row("B", "2026-12-01"), row("A", "2026-11-03")];
    sortTeamDepartures(input);
    expect(input.map((d) => d.departing_label)).toEqual(["B", "A"]);
    expect(sortTeamDepartures([])).toEqual([]);
  });
});
