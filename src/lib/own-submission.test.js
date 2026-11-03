import { describe, expect, test } from "bun:test";
import { canManageOwnSubmission, submissionLabel } from "./own-submission";

describe("canManageOwnSubmission", () => {
  const pending = { status: "en attente", submitted_by_email: "Gontran@Example.com" };

  test("auteur sur sa demande en attente, sans tenir compte de la casse", () => {
    expect(canManageOwnSubmission(pending, "gontran@example.com")).toBe(true);
  });

  test("refuse une demande validée ou refusée", () => {
    expect(canManageOwnSubmission({ ...pending, status: "validée" }, "gontran@example.com")).toBe(
      false,
    );
    expect(canManageOwnSubmission({ ...pending, status: "refusée" }, "gontran@example.com")).toBe(
      false,
    );
  });

  test("refuse un autre auteur", () => {
    expect(canManageOwnSubmission(pending, "autre@example.com")).toBe(false);
  });

  test("refuse sans e-mail d'auteur ou sans e-mail connecté", () => {
    expect(canManageOwnSubmission({ status: "en attente", submitted_by_email: null }, "")).toBe(
      false,
    );
    expect(canManageOwnSubmission({ status: "en attente" }, "gontran@example.com")).toBe(false);
    expect(canManageOwnSubmission(pending, "")).toBe(false);
  });
});

describe("submissionLabel", () => {
  test("texte court inchangé, espaces réduits", () => {
    expect(submissionLabel("  Une   idée  ")).toBe("Une idée");
  });

  test("texte long tronqué avec points de suspension", () => {
    const out = submissionLabel("a".repeat(100), 10);
    expect(out).toBe(`${"a".repeat(10)}…`);
  });
});
