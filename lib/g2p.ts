// Grapheme-to-phoneme for the EXPECTED pronunciation.
//
// espeak-ng (via the `phonemizer` WASM package) is the canonical G2P, because the model
// (wav2vec2-lv-60-espeak-cv-ft) was fine-tuned on espeak phonemes — so generating the
// reference with the same engine keeps both in the SAME inventory. We then greedy
// longest-match the espeak IPA against the model's own 391-token vocab to get token ids
// for forced alignment, and anchor each phoneme to a grapheme span in the passage so the
// warm highlight sits on the spelling (the "th"), never on the IPA.

let phonemizeFn: ((text: string, lang?: string) => Promise<string[]>) | null = null;
const wordCache = new Map<string, string>();

async function getPhonemize() {
  if (!phonemizeFn) {
    const mod = await import("phonemizer");
    phonemizeFn = mod.phonemize;
  }
  return phonemizeFn;
}

const STRESS = /[ˈˌ‿]/g; // primary/secondary stress + tie bar (NOT ː — it's fused into tokens)

// espeak en-us sometimes emits these; the model vocab prefers the right column.
const NORMALIZE: Record<string, string> = { "ɝ": "ɜː", "ɚ": "ɚ" };

export interface Anchor {
  start: number; // absolute char offset in the passage (inclusive)
  end: number; // exclusive
  wordIndex: number;
}

export interface Expected {
  tokens: number[]; // model token ids, in passage order
  ipa: string[]; // the IPA token strings (for display), parallel to tokens
  anchors: Anchor[]; // one per token: the grapheme span it sits on
}

// --- grapheme segmentation (greedy, digraph-aware) ----------------------------------
const TRIGRAPHS = new Set(["tch", "igh", "dge", "eau"]);
const DIGRAPHS = new Set([
  "th", "sh", "ch", "ph", "wh", "ng", "ck", "qu", "oo", "ee", "ea", "ai", "ay",
  "oa", "ou", "ow", "oi", "oy", "au", "aw", "ew", "ie", "ei", "ue", "ui", "kn",
  "wr", "gn", "mb", "ss", "ll", "ar", "er", "ir", "or", "ur", "oe", "ey",
]);

function splitGraphemes(core: string, base: number): { start: number; end: number }[] {
  const units: { start: number; end: number }[] = [];
  const lower = core.toLowerCase();
  let i = 0;
  while (i < core.length) {
    const three = lower.slice(i, i + 3);
    const two = lower.slice(i, i + 2);
    if (three.length === 3 && TRIGRAPHS.has(three)) {
      units.push({ start: base + i, end: base + i + 3 });
      i += 3;
    } else if (two.length === 2 && DIGRAPHS.has(two)) {
      units.push({ start: base + i, end: base + i + 2 });
      i += 2;
    } else {
      units.push({ start: base + i, end: base + i + 1 });
      i += 1;
    }
  }
  return units;
}

// monotonic, proportional alignment of M phonemes onto N grapheme units
function alignPhonemesToUnits(
  units: { start: number; end: number }[],
  m: number,
  fallback: { start: number; end: number }
): { start: number; end: number }[] {
  const n = units.length;
  if (n === 0 || m === 0) return new Array(m).fill(fallback);
  const out: { start: number; end: number }[] = [];
  for (let j = 0; j < m; j++) {
    let lo = Math.floor((j * n) / m);
    let hi = Math.max(lo + 1, Math.floor(((j + 1) * n) / m));
    lo = Math.min(lo, n - 1);
    hi = Math.min(Math.max(hi, lo + 1), n);
    out.push({ start: units[lo].start, end: units[hi - 1].end });
  }
  return out;
}

function tokenizeIpa(ipaRaw: string, vocab: Record<string, number>): { tokens: number[]; ipa: string[] } {
  const s = ipaRaw.replace(STRESS, "").replace(/\s+/g, "");
  const tokens: number[] = [];
  const ipa: string[] = [];
  let i = 0;
  while (i < s.length) {
    let matched = false;
    for (let len = 4; len >= 1; len--) {
      let sub = s.slice(i, i + len);
      if (sub.length !== len) continue;
      if (!(sub in vocab) && NORMALIZE[sub]) sub = NORMALIZE[sub];
      if (sub in vocab) {
        tokens.push(vocab[sub]);
        ipa.push(sub);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1; // skip a glyph the model has no token for (honest: just not scored)
  }
  return { tokens, ipa };
}

async function phonemizeWord(core: string): Promise<string> {
  const key = core.toLowerCase();
  const cached = wordCache.get(key);
  if (cached !== undefined) return cached;
  const phon = await getPhonemize();
  let ipa = "";
  try {
    const out = await phon(core, "en-us");
    ipa = (Array.isArray(out) ? out.join(" ") : String(out)).trim();
  } catch {
    ipa = "";
  }
  wordCache.set(key, ipa);
  return ipa;
}

const LETTER = /[A-Za-zÀ-ɏ']/;

export async function buildExpected(
  passage: string,
  vocab: Record<string, number>
): Promise<Expected> {
  const tokens: number[] = [];
  const ipa: string[] = [];
  const anchors: Anchor[] = [];

  const re = /\S+/g;
  let m: RegExpExecArray | null;
  let wordIndex = -1;
  while ((m = re.exec(passage))) {
    wordIndex++;
    const word = m[0];
    const wStart = m.index;
    // trim leading/trailing non-letters (keep apostrophes inside)
    let cs = 0;
    let ce = word.length;
    while (cs < ce && !LETTER.test(word[cs])) cs++;
    while (ce > cs && !LETTER.test(word[ce - 1])) ce--;
    if (ce <= cs) continue; // pure punctuation/number-symbol token
    const core = word.slice(cs, ce);
    const coreBase = wStart + cs;

    const wordIpa = await phonemizeWord(core);
    if (!wordIpa) continue;
    const { tokens: wt, ipa: wi } = tokenizeIpa(wordIpa, vocab);
    if (wt.length === 0) continue;

    const units = splitGraphemes(core, coreBase);
    const spans = alignPhonemesToUnits(units, wt.length, { start: coreBase, end: wStart + ce });

    for (let k = 0; k < wt.length; k++) {
      tokens.push(wt[k]);
      ipa.push(wi[k]);
      anchors.push({ start: spans[k].start, end: spans[k].end, wordIndex });
    }
  }

  return { tokens, ipa, anchors };
}
