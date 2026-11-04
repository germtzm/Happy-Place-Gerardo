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

  test("les enfants d'un groupe suivent leur groupe, avec parentId", () => {
    const group = { id: "demandes", children: [section("nouvelle"), section("suivi")] };
    const entries = menuEntries([section("apercu"), group, section("actus")], [action("sortir")]);
    expect(shape(entries)).toEqual([
      "apercu",
      "sep-first",
      "demandes",
      "nouvelle",
      "suivi",
      "actus",
      "sep-groups",
      "sortir",
    ]);
    const parents = entries.map((e) => (e.type === "item" ? e.parentId : undefined));
    expect(parents).toEqual([
      undefined,
      undefined,
      undefined,
      "demandes",
      "demandes",
      undefined,
      undefined,
      undefined,
    ]);
  });

  test("un groupe en première position : séparateur après lui et ses enfants", () => {
    const group = { id: "g", children: [section("a")] };
    expect(shape(menuEntries([group, section("b")], []))).toEqual(["g", "a", "sep-first", "b"]);
  });

  test("groupe dans le bas : enfants juste après lui, séparateur avant la première action", () => {
    const group = { id: "g", children: [section("a")] };
    expect(shape(menuEntries([section("x")], [group, action("z")]))).toEqual([
      "x",
      "sep-groups",
      "g",
      "a",
      "sep-z",
      "z",
    ]);
  });

  test("les entrées d'action restent des entrées", () => {
    const entries = menuEntries([section("a")], [action("x")]);
    const last = entries[entries.length - 1];
    expect(last.type).toBe("item");
    expect(typeof last.item.onSelect).toBe("function");
  });
});
