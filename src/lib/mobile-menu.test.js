import { describe, expect, test } from "bun:test";
import { menuButtonLabel, menuEntries } from "./mobile-menu";

describe("menuButtonLabel", () => {
  test("ajoute le nom de la section active", () => {
    expect(menuButtonLabel("Demandes")).toBe("Menu : Demandes");
    expect(menuButtonLabel("  Actualités ")).toBe("Menu : Actualités");
  });

  test("sans section active, le libellé reste « Menu »", () => {
    expect(menuButtonLabel(undefined)).toBe("Menu");
    expect(menuButtonLabel(null)).toBe("Menu");
    expect(menuButtonLabel("   ")).toBe("Menu");
  });
});

const section = (id) => ({ id });
const action = (id) => ({ id, onSelect: () => {} });
const shape = (entries) => entries.map((e) => (e.type === "item" ? e.item.id : e.key));

describe("menuEntries", () => {
  test("même ordre que le rail, avec les séparateurs", () => {
    const entries = menuEntries(
      [section("apercu"), section("demandes"), section("actus")],
      [section("notifications"), section("recap"), action("donnees"), action("deconnexion")],
    );
    expect(shape(entries)).toEqual([
      "apercu",
      "sep-first",
      "demandes",
      "actus",
      "sep-groups",
      "notifications",
      "recap",
      "sep-donnees",
      "donnees",
      "deconnexion",
    ]);
  });

  test("pas de séparateur après une seule section ni entre deux actions", () => {
    const entries = menuEntries([section("apercu")], [action("deconnexion")]);
    expect(shape(entries)).toEqual(["apercu", "sep-groups", "deconnexion"]);
  });

  test("sans entrées du bas, pas de séparateur de groupe", () => {
    expect(shape(menuEntries([section("a"), section("b")], []))).toEqual(["a", "sep-first", "b"]);
  });

  test("les entrées d'action restent des entrées", () => {
    const entries = menuEntries([section("a")], [action("x")]);
    const last = entries[entries.length - 1];
    expect(last.type).toBe("item");
    expect(typeof last.item.onSelect).toBe("function");
  });
});
