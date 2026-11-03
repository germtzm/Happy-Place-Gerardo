import { describe, expect, test } from "bun:test";
import { nextNavIndex } from "./side-nav";

describe("nextNavIndex", () => {
  test("ArrowDown avance et boucle à la fin", () => {
    expect(nextNavIndex(5, 0, "ArrowDown")).toBe(1);
    expect(nextNavIndex(5, 4, "ArrowDown")).toBe(0);
  });

  test("ArrowUp recule et boucle au début", () => {
    expect(nextNavIndex(5, 3, "ArrowUp")).toBe(2);
    expect(nextNavIndex(5, 0, "ArrowUp")).toBe(4);
  });

  test("Home et End vont aux extrémités", () => {
    expect(nextNavIndex(5, 2, "Home")).toBe(0);
    expect(nextNavIndex(5, 2, "End")).toBe(4);
  });

  test("sans entrée focalisée (-1) : ArrowDown va à la première, ArrowUp à la dernière", () => {
    expect(nextNavIndex(5, -1, "ArrowDown")).toBe(0);
    expect(nextNavIndex(5, -1, "ArrowUp")).toBe(4);
  });

  test("une seule entrée : les flèches restent sur elle", () => {
    expect(nextNavIndex(1, 0, "ArrowDown")).toBe(0);
    expect(nextNavIndex(1, 0, "ArrowUp")).toBe(0);
  });

  test("touche non gérée ou menu vide : null", () => {
    expect(nextNavIndex(5, 2, "Enter")).toBeNull();
    expect(nextNavIndex(5, 2, "ArrowRight")).toBeNull();
    expect(nextNavIndex(0, -1, "ArrowDown")).toBeNull();
  });
});
