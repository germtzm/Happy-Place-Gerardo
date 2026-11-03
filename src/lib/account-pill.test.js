import { describe, expect, test } from "bun:test";
import { accountLabel, cleanFirstName, firstInitial } from "./account-pill";

describe("cleanFirstName", () => {
  test("retire les espaces autour du prénom", () => {
    expect(cleanFirstName("  Gerardo ")).toBe("Gerardo");
  });

  test("renvoie null pour une valeur absente ou vide", () => {
    expect(cleanFirstName(null)).toBeNull();
    expect(cleanFirstName(undefined)).toBeNull();
    expect(cleanFirstName("   ")).toBeNull();
  });
});

describe("firstInitial", () => {
  test("met la première lettre en majuscule", () => {
    expect(firstInitial("gerardo")).toBe("G");
    expect(firstInitial("  olivia")).toBe("O");
  });

  test("gère les lettres accentuées", () => {
    expect(firstInitial("élodie")).toBe("É");
  });

  test("renvoie « ? » quand le prénom est introuvable", () => {
    expect(firstInitial(null)).toBe("?");
    expect(firstInitial("")).toBe("?");
  });
});

describe("accountLabel", () => {
  test("assemble le prénom et le rôle en minuscules", () => {
    expect(accountLabel("Gerardo", "ADMIN")).toBe("Gerardo, admin");
    expect(accountLabel(" Kesha ", "COLLABORATEUR")).toBe("Kesha, collaborateur");
  });

  test("sans prénom, ne l'invente pas", () => {
    expect(accountLabel(undefined, "MANAGER")).toBe("Prénom introuvable, manager");
  });
});
