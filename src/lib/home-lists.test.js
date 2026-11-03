import { describe, expect, test } from "bun:test";
import { latestHistory, openBlockersLatestFirst, publishedNewsLatestFirst } from "./home-lists";

const news = (id, status, created_at) => ({
  id,
  title: id,
  body: null,
  author: "A",
  status,
  created_at,
});

const blocker = (id, status, updated_at) => ({
  id,
  title: id,
  description: null,
  department: "IT",
  severity: "normal",
  status,
  updated_at,
});

const point = (id, recorded_at) => ({ id, metric_key: "nps", value: 1, recorded_at });

describe("publishedNewsLatestFirst", () => {
  test("exclut les brouillons et trie du plus récent au plus ancien", () => {
    const out = publishedNewsLatestFirst([
      news("a", "publiée", "2026-01-01T00:00:00Z"),
      news("b", "brouillon", "2026-03-01T00:00:00Z"),
      news("c", "publiée", "2026-02-01T00:00:00Z"),
    ]);
    expect(out.map((n) => n.id)).toEqual(["c", "a"]);
  });

  test("accepte undefined", () => {
    expect(publishedNewsLatestFirst(undefined)).toEqual([]);
  });
});

describe("openBlockersLatestFirst", () => {
  test("garde OUVERT, EN COURS et SURVEILLANCE, exclut RÉSOLU", () => {
    const out = openBlockersLatestFirst([
      blocker("a", "OUVERT", "2026-01-01T00:00:00Z"),
      blocker("b", "RÉSOLU", "2026-05-01T00:00:00Z"),
      blocker("c", "SURVEILLANCE", "2026-03-01T00:00:00Z"),
      blocker("d", "EN COURS", "2026-02-01T00:00:00Z"),
    ]);
    expect(out.map((b) => b.id)).toEqual(["c", "d", "a"]);
  });
});

describe("latestHistory", () => {
  test("renvoie les dernières valeurs, la plus récente d'abord, limitées", () => {
    const out = latestHistory(
      [
        point("a", "2026-01-01T00:00:00Z"),
        point("b", "2026-03-01T00:00:00Z"),
        point("c", "2026-02-01T00:00:00Z"),
      ],
      2,
    );
    expect(out.map((p) => p.id)).toEqual(["b", "c"]);
  });
});
