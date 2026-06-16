import { describe, expect, it } from "vitest";
import { isLikelyEnglish, needsEnglishDisplay } from "./languageDetect";

describe("languageDetect", () => {
  it("detects German headline as non-English", () => {
    const title =
      "Hannover: Polizisten wegen Vorwürfen der Körperverletzung und der Strafvereitelung im Amt suspendiert";
    const summary =
      "Gegen vier Beamte und eine Beamtin der Polizeidirektion Hannover laufen strafrechtliche Ermittlungen.";
    expect(isLikelyEnglish(title)).toBe(false);
    expect(isLikelyEnglish(summary)).toBe(false);
    expect(needsEnglishDisplay(title, summary)).toBe(true);
  });

  it("accepts normal English headlines", () => {
    expect(isLikelyEnglish("Police suspend officers amid misconduct probe in Hannover")).toBe(true);
  });
});
