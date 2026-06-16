import { detectChineseText } from "./prompts";

const EN_WORD =
  /\b(the|and|of|to|in|for|on|with|is|are|was|were|has|have|had|said|says|new|after|from|that|this|will|not|police|government)\b/i;

/** Heuristic: is this text already usable as English UI copy? */
export function isLikelyEnglish(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 4) return true;
  if (detectChineseText(t)) return false;

  if (/[äöüßÄÖÜ]/.test(t)) return false;
  if (/\b(und|der|die|das|nicht|sind|wurde|gegen|auch|beamte|polizei|ermittlungen)\b/i.test(t)) return false;

  if (/[àâçéèêëîïôùûœæ]/i.test(t)) return false;
  if (/\b(les|des|une|dans|pour|avec|cette|sont|été|contre|police)\b/i.test(t) && !EN_WORD.test(t)) return false;

  if (/\b(el|los|las|del|por|para|como|más|gobierno)\b/i.test(t) && !EN_WORD.test(t)) return false;

  const enHits = (t.match(EN_WORD) ?? []).length;
  if (enHits >= 2) return true;
  if (enHits >= 1 && t.split(/\s+/).length <= 12) return true;

  const letters = t.replace(/\s/g, "");
  const latin = (letters.match(/[a-zA-Z]/g) ?? []).length;
  const ratio = latin / Math.max(1, letters.length);
  return ratio > 0.9 && enHits >= 1;
}

export function needsEnglishDisplay(title: string, summary: string): boolean {
  return !isLikelyEnglish(title) || !isLikelyEnglish(summary.slice(0, 400));
}
