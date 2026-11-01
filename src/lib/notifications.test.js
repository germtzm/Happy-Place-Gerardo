import { describe, expect, mock, test } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const {
  isNotificationVisible,
  notificationExcerpt,
  notificationTitle,
  selectVisibleNotifications,
} = await import("./dashboard");

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

const notif = (over = {}) => ({
  type: "nouvelle_demande",
  read_at: null,
  submission: { status: "en attente" },
  ...over,
});
const READ = "2026-11-01T10:00:00Z";

describe("notification visibility rule", () => {
  test("a pending new request is shown when unread", () => {
    expect(isNotificationVisible(notif())).toBe(true);
  });
  test("a pending new request is still shown once read", () => {
    expect(isNotificationVisible(notif({ read_at: READ }))).toBe(true);
  });
  test("a new request already decided is hidden, read or not", () => {
    for (const status of ["validée", "refusée"]) {
      expect(isNotificationVisible(notif({ submission: { status } }))).toBe(false);
      expect(isNotificationVisible(notif({ submission: { status }, read_at: READ }))).toBe(false);
    }
  });
  test("an unreadable request hides a new request, read or not", () => {
    expect(isNotificationVisible(notif({ submission: null }))).toBe(false);
    expect(isNotificationVisible(notif({ submission: null, read_at: READ }))).toBe(false);
  });
  test("an unread decision is shown, even when its request is unreadable", () => {
    expect(
      isNotificationVisible(notif({ type: "decision", submission: { status: "validée" } })),
    ).toBe(true);
    expect(isNotificationVisible(notif({ type: "decision", submission: null }))).toBe(true);
  });
  test("a read decision is hidden", () => {
    expect(
      isNotificationVisible(
        notif({ type: "decision", submission: { status: "validée" }, read_at: READ }),
      ),
    ).toBe(false);
  });
});

describe("visible notifications selection", () => {
  test("the filter is applied before the limit of 20", () => {
    const hidden = Array.from({ length: 25 }, (_, i) =>
      notif({ id: `h${i}`, submission: { status: "validée" } }),
    );
    const shown = Array.from({ length: 5 }, (_, i) => notif({ id: `s${i}` }));
    const out = selectVisibleNotifications([...hidden, ...shown]);
    expect(out.items.map((n) => n.id)).toEqual(["s0", "s1", "s2", "s3", "s4"]);
    expect(out.unread).toBe(5);
  });
  test("the list keeps 20 rows in order", () => {
    const all = Array.from({ length: 30 }, (_, i) => notif({ id: `n${i}` }));
    const out = selectVisibleNotifications(all);
    expect(out.items).toHaveLength(20);
    expect(out.items[0].id).toBe("n0");
    expect(out.items[19].id).toBe("n19");
  });
  test("unread counts only the unread rows among the displayed ones", () => {
    const out = selectVisibleNotifications([
      notif({ id: "a" }),
      notif({ id: "b", read_at: READ }),
      notif({ id: "c", type: "decision" }),
      notif({ id: "d", type: "decision", read_at: READ }),
      notif({ id: "e", submission: { status: "refusée" } }),
    ]);
    expect(out.items.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(out.unread).toBe(2);
  });
  test("rows beyond the limit are not counted as unread", () => {
    const all = Array.from({ length: 30 }, (_, i) => notif({ id: `n${i}` }));
    expect(selectVisibleNotifications(all).unread).toBe(20);
  });
  test("nothing visible gives an empty list and a zero count", () => {
    expect(selectVisibleNotifications([notif({ submission: { status: "validée" } })])).toEqual({
      items: [],
      unread: 0,
    });
  });
});
