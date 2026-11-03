import { describe, expect, test } from "bun:test";
import {
  announceProgress,
  documentFileName,
  formatDay,
  hasDocuments,
  kindLabel,
  needsAction,
  noticeProgress,
  progressLabel,
  safeDocumentTitle,
} from "./departure-progress";

const docs = [{ path: "a.pdf" }, { path: "b.pdf" }, { path: "c.pdf" }];

describe("hasDocuments", () => {
  test("vrai seulement pour une liste non vide", () => {
    expect(hasDocuments([{ path: "a" }])).toBe(true);
    expect(hasDocuments([])).toBe(false);
    expect(hasDocuments(null)).toBe(false);
    expect(hasDocuments(undefined)).toBe(false);
  });
});

describe("noticeProgress", () => {
  test("sans document : rien à faire", () => {
    expect(noticeProgress([], [])).toEqual({ total: 0, done: 0, state: "no-documents", completedAt: null });
    expect(noticeProgress(null, null).state).toBe("no-documents");
  });

  test("aucun téléchargement : à télécharger", () => {
    expect(noticeProgress(docs, [])).toEqual({ total: 3, done: 0, state: "pending", completedAt: null });
  });

  test("téléchargement partiel", () => {
    const p = noticeProgress(docs, [{ doc_path: "a.pdf", downloaded_at: "2026-11-03T10:00:00Z" }]);
    expect(p).toEqual({ total: 3, done: 1, state: "partial", completedAt: null });
  });

  test("tous téléchargés : date du dernier enregistrement", () => {
    const p = noticeProgress(docs, [
      { doc_path: "a.pdf", downloaded_at: "2026-11-03T10:00:00Z" },
      { doc_path: "b.pdf", downloaded_at: "2026-11-04T09:00:00Z" },
      { doc_path: "c.pdf", downloaded_at: "2026-11-03T12:00:00Z" },
    ]);
    expect(p.state).toBe("complete");
    expect(p.completedAt).toBe("2026-11-04T09:00:00Z");
  });

  test("un chemin enregistré deux fois compte une fois, un chemin inconnu est ignoré", () => {
    const p = noticeProgress(docs, [
      { doc_path: "a.pdf", downloaded_at: "2026-11-03T10:00:00Z" },
      { doc_path: "a.pdf", downloaded_at: "2026-11-03T11:00:00Z" },
      { doc_path: "z.pdf", downloaded_at: "2026-11-03T11:00:00Z" },
    ]);
    expect(p.done).toBe(1);
    expect(p.state).toBe("partial");
  });

  test("des chemins en double dans l'avis comptent une fois", () => {
    expect(noticeProgress([{ path: "a" }, { path: "a" }], []).total).toBe(1);
  });
});

describe("needsAction", () => {
  test("à traiter tant qu'il reste un document ; jamais sans document", () => {
    expect(needsAction({ state: "pending" })).toBe(true);
    expect(needsAction({ state: "partial" })).toBe(true);
    expect(needsAction({ state: "complete" })).toBe(false);
    expect(needsAction({ state: "no-documents" })).toBe(false);
  });
});

describe("formatDay", () => {
  test("jj/mm/aaaa à l'heure de Paris", () => {
    expect(formatDay("2026-11-03T10:00:00Z")).toBe("03/11/2026");
    expect(formatDay("2026-11-03T23:30:00Z")).toBe("04/11/2026");
  });
});

describe("progressLabel", () => {
  test("un libellé par état", () => {
    expect(progressLabel(noticeProgress([], []))).toBe("Aucun document à télécharger");
    expect(progressLabel(noticeProgress(docs, []))).toBe("Documents à télécharger");
    const partial = noticeProgress(docs, [
      { doc_path: "a.pdf", downloaded_at: "2026-11-03T10:00:00Z" },
      { doc_path: "b.pdf", downloaded_at: "2026-11-03T10:00:00Z" },
    ]);
    expect(progressLabel(partial)).toBe("2/3 documents téléchargés");
  });

  test("tous téléchargés : date, et prénom seulement s'il est connu", () => {
    const rows = docs.map((d) => ({ doc_path: d.path, downloaded_at: "2026-11-03T10:00:00Z" }));
    const p = noticeProgress(docs, rows);
    expect(progressLabel(p)).toBe("Documents téléchargés le 03/11/2026");
    expect(progressLabel(p, "  ")).toBe("Documents téléchargés le 03/11/2026");
    expect(progressLabel(p, null)).toBe("Documents téléchargés le 03/11/2026");
    expect(progressLabel(p, "Gerardo")).toBe("Documents téléchargés le 03/11/2026 par Gerardo");
  });
});

describe("kindLabel", () => {
  test("pastille de type", () => {
    expect(kindLabel("préavis")).toBe("Préavis");
    expect(kindLabel("sans préavis")).toBe("Sans préavis");
  });
});

describe("announceProgress", () => {
  test("phrase partielle puis complète", () => {
    expect(announceProgress("Ana", { done_count: 2, total_count: 3, is_complete: false })).toBe(
      "2/3 documents téléchargés pour Ana.",
    );
    expect(announceProgress("Ana", { done_count: 3, total_count: 3, is_complete: true })).toBe(
      "Tous les documents de Ana sont téléchargés.",
    );
  });
});

describe("noms de fichier", () => {
  test("safeDocumentTitle retire les caractères interdits et borne la longueur", () => {
    expect(safeDocumentTitle('a/b:c*"d')).toBe("a b c d");
    expect(safeDocumentTitle("   ")).toBe("document");
    expect(safeDocumentTitle("x".repeat(100)).length).toBe(60);
  });

  test("documentFileName garde le nom d'origine, sinon date et extrait, toujours en .pdf", () => {
    const base = { created_at: "2026-11-03T10:00:00Z", excerpt: "Question RH" };
    expect(documentFileName({ ...base, name: "contrat.pdf" })).toBe("contrat.pdf");
    expect(documentFileName({ ...base, name: "contrat" })).toBe("contrat.pdf");
    expect(documentFileName({ ...base, name: null })).toBe("2026-11-03 - Question RH.pdf");
    expect(documentFileName({ ...base, name: "a/b.PDF" })).toBe("a b.PDF");
  });
});
