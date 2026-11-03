import { describe, expect, test } from "bun:test";
import {
  attachmentChange,
  canManageOwnSubmission,
  MAX_PDF_BYTES,
  pdfFileError,
  submissionLabel,
} from "./own-submission";

describe("pdfFileError", () => {
  test("accepte un PDF de taille raisonnable, y compris à la limite", () => {
    expect(pdfFileError({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(pdfFileError({ type: "application/pdf", size: MAX_PDF_BYTES })).toBeNull();
  });

  test("refuse un fichier qui n'est pas un PDF", () => {
    expect(pdfFileError({ type: "image/png", size: 1000 })).toBe(
      "Seuls les fichiers PDF sont acceptés.",
    );
  });

  test("refuse un PDF de plus de 20 Mo", () => {
    expect(pdfFileError({ type: "application/pdf", size: MAX_PDF_BYTES + 1 })).toBe(
      "Le fichier dépasse 20 Mo.",
    );
  });
});

describe("attachmentChange", () => {
  const file = { name: "a.pdf" };

  test("sans fichier ni retrait : la pièce jointe est conservée", () => {
    expect(attachmentChange(false, null)).toEqual({ kind: "keep" });
  });

  test("retrait demandé sans fichier : retirée", () => {
    expect(attachmentChange(true, null)).toEqual({ kind: "remove" });
  });

  test("fichier choisi : remplacement, même si un retrait avait été demandé", () => {
    expect(attachmentChange(false, file)).toEqual({ kind: "replace", file });
    expect(attachmentChange(true, file)).toEqual({ kind: "replace", file });
  });
});

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
