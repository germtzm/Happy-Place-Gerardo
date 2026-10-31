import { describe, expect, test } from "bun:test";
import { waitingDays, waitingLabel } from "./waiting";

const now = new Date("2026-10-31T12:00:00Z");

describe("waiting days", () => {
  test("0 jour : demande créée aujourd'hui", () => {
    expect(waitingDays("2026-10-31T08:00:00Z", now)).toBe(0);
    expect(waitingLabel(0)).toBe("EN ATTENTE AUJOURD'HUI");
  });
  test("1 jour : singulier", () => {
    expect(waitingDays("2026-10-30T12:00:00Z", now)).toBe(1);
    expect(waitingLabel(1)).toBe("EN ATTENTE DEPUIS 1 JOUR");
  });
  test("3 jours : pluriel", () => {
    expect(waitingDays("2026-10-28T12:00:00Z", now)).toBe(3);
    expect(waitingLabel(3)).toBe("EN ATTENTE DEPUIS 3 JOURS");
  });
  test("date future ou invalide : 0", () => {
    expect(waitingDays("2026-11-02T12:00:00Z", now)).toBe(0);
    expect(waitingDays("n'importe quoi", now)).toBe(0);
  });
});
