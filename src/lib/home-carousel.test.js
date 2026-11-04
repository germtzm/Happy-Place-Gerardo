import { describe, expect, test } from "bun:test";
import {
  chunk,
  clampIndex,
  countWords,
  loopWindow,
  marqueeDurationSeconds,
  mostCritical,
  newsCardWords,
  newsPageDurationMs,
  newsPages,
  nextIndex,
  pageDurationMs,
  planBlockers,
  prevIndex,
  shouldMarquee,
} from "./home-carousel";

const words = (n) => Array.from({ length: n }, (_, i) => `mot${i}`).join(" ");
const blocker = (id, severity = "warning") => ({ id, severity });
const many = (n, severity) => Array.from({ length: n }, (_, i) => blocker(`b${i}`, severity));

describe("countWords", () => {
  test("compte les mots séparés par des espaces, 0 si vide ou absent", () => {
    expect(countWords("un deux  trois\nquatre")).toBe(4);
    expect(countWords("   ")).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords(undefined)).toBe(0);
  });
});

describe("pageDurationMs", () => {
  test("minimum de 8 s tant que 4 s + 0,25 s par mot ne le dépasse pas", () => {
    expect(pageDurationMs(0)).toBe(8000);
    expect(pageDurationMs(10)).toBe(8000);
    expect(pageDurationMs(16)).toBe(8000);
  });

  test("au-delà du seuil de 16 mots, 4 s + 0,25 s par mot", () => {
    expect(pageDurationMs(17)).toBe(8250);
    expect(pageDurationMs(32)).toBe(12000);
    expect(pageDurationMs(40)).toBe(14000);
  });

  test("un nombre de mots invalide retombe sur le minimum", () => {
    expect(pageDurationMs(-5)).toBe(8000);
    expect(pageDurationMs(Number.NaN)).toBe(8000);
  });
});

describe("durée d'une page d'actualités", () => {
  test("titre complet plus 30 mots de résumé au plus", () => {
    expect(newsCardWords({ title: "Deux mots", body: words(100) })).toBe(2 + 30);
    expect(newsCardWords({ title: "Deux mots", body: null })).toBe(2);
  });

  test("somme des mots des deux cartes de la page", () => {
    const page = [
      { title: words(5), body: words(10) },
      { title: words(5), body: words(30) },
    ];
    // 5 + 10 + 5 + 30 = 50 mots : 4 s + 12,5 s
    expect(newsPageDurationMs(page)).toBe(16500);
  });

  test("une page courte reste à 8 s", () => {
    expect(newsPageDurationMs([{ title: "Court", body: "Très court" }])).toBe(8000);
  });
});

describe("chunk et newsPages", () => {
  test("découpe en pages, la dernière peut être plus courte", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });

  test("refuse une taille de page invalide", () => {
    expect(() => chunk([1], 0)).toThrow();
    expect(() => chunk([1], 1.5)).toThrow();
  });

  test("les actualités vont par pages de 2 : une seule page jusqu'à 2 actualités", () => {
    expect(newsPages([1, 2]).length).toBe(1);
    expect(newsPages([1, 2, 3]).length).toBe(2);
    expect(newsPages([1, 2, 3, 4, 5]).map((p) => p.length)).toEqual([2, 2, 1]);
  });
});

describe("boucle", () => {
  test("nextIndex revient à 0 après la dernière page", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(0, 0)).toBe(0);
  });

  test("prevIndex revient à la dernière page avant la première", () => {
    expect(prevIndex(2, 3)).toBe(1);
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(0, 0)).toBe(0);
  });

  test("clampIndex ramène un indice dans les bornes", () => {
    expect(clampIndex(5, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(1, 0)).toBe(0);
  });

  test("loopWindow reboucle au début et décale d'un élément à chaque pas", () => {
    const items = ["a", "b", "c"];
    expect(loopWindow(items, 0, 2)).toEqual(["a", "b"]);
    expect(loopWindow(items, 1, 2)).toEqual(["b", "c"]);
    expect(loopWindow(items, 2, 2)).toEqual(["c", "a"]);
    expect(loopWindow(items, 3, 2)).toEqual(["a", "b"]);
  });

  test("loopWindow : liste vide, liste plus courte que la fenêtre, départ négatif", () => {
    expect(loopWindow([], 0, 2)).toEqual([]);
    expect(loopWindow(["a"], 0, 2)).toEqual(["a"]);
    expect(loopWindow(["a", "b", "c"], -1, 2)).toEqual(["c", "a"]);
  });
});

describe("défilement continu des indicateurs", () => {
  test("ne démarre que si le contenu dépasse la largeur", () => {
    expect(shouldMarquee(1200, 1000)).toBe(true);
    expect(shouldMarquee(1000, 1000)).toBe(false);
    expect(shouldMarquee(800, 1000)).toBe(false);
  });

  test("30 px par seconde", () => {
    expect(marqueeDurationSeconds(1500)).toBe(50);
    expect(marqueeDurationSeconds(0)).toBe(0);
  });
});

describe("planBlockers", () => {
  test("4 points ou moins : rien ne bouge", () => {
    expect(planBlockers([]).mode).toBe("static");
    expect(planBlockers(many(4, "critical")).mode).toBe("static");
    const plan = planBlockers(many(3));
    expect(plan.mode).toBe("static");
    expect(plan.items.map((b) => b.id)).toEqual(["b0", "b1", "b2"]);
  });

  test("5 points ou plus avec 1 ou 2 critiques : les critiques sont épinglés, les autres tournent", () => {
    const items = [
      blocker("a"),
      blocker("c1", "critical"),
      blocker("b"),
      blocker("c2", "critical"),
      blocker("d", "info"),
    ];
    const plan = planBlockers(items);
    expect(plan.mode).toBe("pinned");
    expect(plan.pinned.map((b) => b.id)).toEqual(["c1", "c2"]);
    expect(plan.rotating.map((b) => b.id)).toEqual(["a", "b", "d"]);
  });

  test("un seul critique est épinglé aussi", () => {
    const plan = planBlockers([blocker("c", "critical"), ...many(4)]);
    expect(plan.mode).toBe("pinned");
    expect(plan.pinned.length).toBe(1);
    expect(plan.rotating.length).toBe(4);
  });

  test("plus de 2 critiques : pas d'épinglage, pages de 4", () => {
    const plan = planBlockers([...many(3, "critical"), ...many(3)]);
    expect(plan.mode).toBe("paged");
    expect(plan.pages.map((p) => p.length)).toEqual([4, 2]);
  });

  test("5 points ou plus sans critique : rien à épingler, pages de 4", () => {
    const plan = planBlockers(many(9));
    expect(plan.mode).toBe("paged");
    expect(plan.pages.map((p) => p.length)).toEqual([4, 4, 1]);
  });

  test("la colonne de droite fait un tour complet puis revient au départ", () => {
    const plan = planBlockers([blocker("c", "critical"), ...many(4)]);
    const seen = [];
    let offset = 0;
    for (let step = 0; step < plan.rotating.length; step += 1) {
      seen.push(loopWindow(plan.rotating, offset, 2).map((b) => b.id));
      offset = nextIndex(offset, plan.rotating.length);
    }
    expect(seen).toEqual([
      ["b0", "b1"],
      ["b1", "b2"],
      ["b2", "b3"],
      ["b3", "b0"],
    ]);
    expect(loopWindow(plan.rotating, offset, 2).map((b) => b.id)).toEqual(["b0", "b1"]);
  });
});

describe("mostCritical (mobile)", () => {
  test("les critiques d'abord, ordre d'origine conservé, 2 points", () => {
    const items = [blocker("a"), blocker("c", "critical"), blocker("b"), blocker("d", "critical")];
    expect(mostCritical(items).map((b) => b.id)).toEqual(["c", "d"]);
    expect(mostCritical([blocker("a"), blocker("b"), blocker("c")]).map((b) => b.id)).toEqual([
      "a",
      "b",
    ]);
    expect(mostCritical([])).toEqual([]);
  });
});
