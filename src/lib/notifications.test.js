import { describe, expect, mock, test } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { notificationExcerpt, notificationTitle } = await import("./dashboard");

const submission = (over = {}) => ({
  author_name: "Gontran",
  team: "Product",
  status: "en attente",
  ...over,
});

describe("notification title", () => {
  test("new request names the author and the team", () => {
    expect(notificationTitle({ type: "nouvelle_demande", submission: submission() })).toBe(
      "Nouvelle demande de Gontran (Product)",
    );
  });
  test("decision on a validated request", () => {
    expect(
      notificationTitle({ type: "decision", submission: submission({ status: "validée" }) }),
    ).toBe("Ta demande a été validée");
  });
  test("decision on a rejected request", () => {
    expect(
      notificationTitle({ type: "decision", submission: submission({ status: "refusée" }) }),
    ).toBe("Ta demande a été refusée");
  });
  test("unreadable request gives a generic title without detail", () => {
    expect(notificationTitle({ type: "nouvelle_demande", submission: null })).toBe(
      "Nouvelle demande",
    );
    expect(notificationTitle({ type: "decision", submission: null })).toBe(
      "Décision sur ta demande",
    );
  });
  test("decision whose request went back to pending stays generic", () => {
    expect(notificationTitle({ type: "decision", submission: submission() })).toBe(
      "Décision sur ta demande",
    );
  });
});

describe("notification excerpt", () => {
  test("short text is kept as is", () => {
    expect(notificationExcerpt("Une idée courte")).toBe("Une idée courte");
  });
  test("exactly 80 characters is not truncated", () => {
    const text = "a".repeat(80);
    expect(notificationExcerpt(text)).toBe(text);
  });
  test("long text is cut to 80 characters with an ellipsis", () => {
    const out = notificationExcerpt("a".repeat(200));
    expect(out).toBe(`${"a".repeat(80)}…`);
  });
  test("line breaks and repeated spaces are collapsed", () => {
    expect(notificationExcerpt("une  idée\n\nsur   deux lignes")).toBe("une idée sur deux lignes");
  });
  test("unreadable request has no excerpt", () => {
    expect(notificationExcerpt(null)).toBe("");
    expect(notificationExcerpt(undefined)).toBe("");
  });
});
