import { describe, expect, mock, test } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { canDecideSubmission } = await import("./dashboard");

const sub = (submitted_by_email) => ({ submitted_by_email });
const ME = "kesha@example.test";

describe("who can decide a pending submission", () => {
  test("a manager can decide another person's request", () => {
    expect(
      canDecideSubmission({ role: "manager", email: ME, submission: sub("sophie@example.test") }),
    ).toBe(true);
  });
  test("a manager cannot decide their own request", () => {
    expect(canDecideSubmission({ role: "manager", email: ME, submission: sub(ME) })).toBe(false);
  });
  test("the own-request comparison ignores case", () => {
    expect(
      canDecideSubmission({ role: "manager", email: ME, submission: sub("Kesha@Example.TEST") }),
    ).toBe(false);
  });
  test("a request without author e-mail can be decided by a manager", () => {
    expect(canDecideSubmission({ role: "manager", email: ME, submission: sub(null) })).toBe(true);
    expect(canDecideSubmission({ role: "manager", email: ME, submission: sub(undefined) })).toBe(
      true,
    );
  });
  test("an admin can always decide, even their own request", () => {
    expect(canDecideSubmission({ role: "admin", email: ME, submission: sub(ME) })).toBe(true);
    expect(
      canDecideSubmission({ role: "admin", email: ME, submission: sub("sophie@example.test") }),
    ).toBe(true);
  });
  test("a collaborator can never decide", () => {
    expect(
      canDecideSubmission({
        role: "collaborateur",
        email: ME,
        submission: sub("sophie@example.test"),
      }),
    ).toBe(false);
  });
});
