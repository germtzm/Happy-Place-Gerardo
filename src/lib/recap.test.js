import { describe, expect, mock, test } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const {
  normalizeRecapInput,
  RECAP_EMPTY_PREVIEW,
  RECAP_HOURS,
  RECAP_MINUTES,
  recapPreviewText,
  recapTimeFromParts,
  recapTimeLabel,
  recapTimeParts,
  recapUpdatedLabel,
  stepRecapHour,
  stepRecapMinute,
  validateRecapInput,
} = await import("./dashboard");

const input = (over = {}) => ({
  channel_app: true,
  channel_email: true,
  frequency: "hebdomadaire",
  send_day: 1,
  send_time: "08:00",
  ...over,
});

describe("recap validation", () => {
  test("an active frequency without any channel is refused", () => {
    const noChannel = { channel_app: false, channel_email: false };
    expect(validateRecapInput(input({ ...noChannel, frequency: "quotidien" }))).toBe(
      "Choisis au moins un canal de réception.",
    );
    expect(validateRecapInput(input({ ...noChannel, frequency: "hebdomadaire" }))).not.toBeNull();
  });
  test("a disabled frequency without any channel is accepted", () => {
    expect(
      validateRecapInput(
        input({ channel_app: false, channel_email: false, frequency: "desactive" }),
      ),
    ).toBeNull();
  });
  test("one channel is enough", () => {
    expect(validateRecapInput(input({ channel_app: false }))).toBeNull();
    expect(validateRecapInput(input({ channel_email: false }))).toBeNull();
  });
  test("a malformed time is refused", () => {
    expect(validateRecapInput(input({ send_time: "08:10" }))).not.toBeNull();
    expect(validateRecapInput(input({ send_time: "24:00" }))).not.toBeNull();
    expect(validateRecapInput(input({ send_time: "8:00" }))).not.toBeNull();
    expect(validateRecapInput(input({ send_time: "" }))).not.toBeNull();
  });
  test("the hours go from 00 to 23 in steps of one", () => {
    expect(RECAP_HOURS).toHaveLength(24);
    expect(RECAP_HOURS[0]).toBe("00");
    expect(RECAP_HOURS[8]).toBe("08");
    expect(RECAP_HOURS[23]).toBe("23");
  });
  test("the minutes are 00, 15, 30 and 45", () => {
    expect(RECAP_MINUTES).toEqual(["00", "15", "30", "45"]);
  });
  test("every hour and minute combination gives an accepted HH:MM time", () => {
    for (const hour of RECAP_HOURS) {
      for (const minute of RECAP_MINUTES) {
        const time = recapTimeFromParts(hour, minute);
        expect(time).toMatch(/^\d\d:\d\d$/);
        expect(validateRecapInput(input({ send_time: time }))).toBeNull();
      }
    }
    expect(recapTimeFromParts("08", "15")).toBe("08:15");
    expect(recapTimeFromParts("23", "45")).toBe("23:45");
  });
  test("a minute outside the four values is refused", () => {
    for (const minute of ["05", "10", "20", "59", "60", "0", "1", ""]) {
      expect(
        validateRecapInput(input({ send_time: recapTimeFromParts("08", minute) })),
      ).not.toBeNull();
    }
  });
  test("an hour outside 00 to 23 is refused", () => {
    for (const hour of ["24", "99", "8", ""]) {
      expect(
        validateRecapInput(input({ send_time: recapTimeFromParts(hour, "00") })),
      ).not.toBeNull();
    }
  });
  test("the stored time is split back into hour and minute", () => {
    expect(recapTimeParts("08:15:00")).toEqual({ hour: "08", minute: "15" });
    expect(recapTimeParts("23:45")).toEqual({ hour: "23", minute: "45" });
    expect(recapTimeParts(null)).toEqual({ hour: "08", minute: "00" });
  });
  test("a day outside 1 to 7 is refused for the weekly frequency", () => {
    for (const day of [0, 8, -1, 1.5, null, undefined, "3"]) {
      expect(validateRecapInput(input({ send_day: day }))).not.toBeNull();
    }
    for (const day of [1, 2, 3, 4, 5, 6, 7]) {
      expect(validateRecapInput(input({ send_day: day }))).toBeNull();
    }
  });
  test("the day is ignored outside the weekly frequency", () => {
    expect(validateRecapInput(input({ frequency: "quotidien", send_day: 9 }))).toBeNull();
    expect(validateRecapInput(input({ frequency: "desactive", send_day: 0 }))).toBeNull();
  });
  test("an unknown frequency is refused", () => {
    expect(validateRecapInput(input({ frequency: "mensuel" }))).not.toBeNull();
  });
});

describe("recap hour and minute counters", () => {
  test("the hour goes up and down by one", () => {
    expect(stepRecapHour("08", 1)).toBe("09");
    expect(stepRecapHour("08", -1)).toBe("07");
    expect(stepRecapHour("09", 1)).toBe("10");
  });
  test("the hour wraps: 23 plus gives 00, 00 minus gives 23", () => {
    expect(stepRecapHour("23", 1)).toBe("00");
    expect(stepRecapHour("00", -1)).toBe("23");
  });
  test("the minutes go through 00, 15, 30, 45", () => {
    expect(stepRecapMinute("00", 1)).toBe("15");
    expect(stepRecapMinute("15", 1)).toBe("30");
    expect(stepRecapMinute("30", 1)).toBe("45");
    expect(stepRecapMinute("30", -1)).toBe("15");
  });
  test("the minutes wrap: 45 plus gives 00, 00 minus gives 45", () => {
    expect(stepRecapMinute("45", 1)).toBe("00");
    expect(stepRecapMinute("00", -1)).toBe("45");
  });
  test("a stepped value is always a two-digit, accepted time", () => {
    let hour = "00";
    let minute = "00";
    for (let i = 0; i < 100; i++) {
      hour = stepRecapHour(hour, 1);
      minute = stepRecapMinute(minute, -1);
      expect(hour).toMatch(/^\d\d$/);
      expect(RECAP_MINUTES).toContain(minute);
      expect(validateRecapInput(input({ send_time: recapTimeFromParts(hour, minute) }))).toBeNull();
    }
  });
  test("an unknown value falls back to a valid one", () => {
    expect(RECAP_HOURS).toContain(stepRecapHour("zz", 1));
    expect(RECAP_MINUTES).toContain(stepRecapMinute("07", 1));
  });
});

describe("recap values sent to the database", () => {
  test("an invalid day outside the weekly frequency is replaced by Monday", () => {
    expect(normalizeRecapInput(input({ frequency: "quotidien", send_day: 9 })).send_day).toBe(1);
  });
  test("a valid day is kept", () => {
    expect(normalizeRecapInput(input({ frequency: "quotidien", send_day: 5 })).send_day).toBe(5);
  });
  test("the time loses its seconds", () => {
    expect(recapTimeLabel("08:00:00")).toBe("08:00");
    expect(recapTimeLabel("23:45")).toBe("23:45");
    expect(recapTimeLabel(null)).toBe("08:00");
  });
});

describe("recap preview and date label", () => {
  test("the last text is shown as is, line breaks included", () => {
    expect(recapPreviewText("Bonjour,\n3 demandes en attente.")).toBe(
      "Bonjour,\n3 demandes en attente.",
    );
  });
  test("without a text the preview is a neutral sentence", () => {
    expect(recapPreviewText(null)).toBe(RECAP_EMPTY_PREVIEW);
    expect(recapPreviewText("   ")).toBe("Aucun récapitulatif envoyé pour le moment.");
  });
  test("the date label is relative", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    expect(recapUpdatedLabel(twoHoursAgo)).toBe("Dernière mise à jour : il y a 2 heures");
    expect(recapUpdatedLabel(new Date().toISOString())).toBe("Dernière mise à jour : à l'instant");
  });
  test("without a date there is no label", () => {
    expect(recapUpdatedLabel(null)).toBeNull();
    expect(recapUpdatedLabel(undefined)).toBeNull();
  });
});
