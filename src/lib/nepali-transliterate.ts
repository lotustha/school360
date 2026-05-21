/**
 * Romanized Nepali → Devanagari phonetic transliterator.
 * Convention: 'a' after consonant = long ā (ा matra), matching common Nepali Romanization.
 * e.g. "Ram" → "राम", "Sita" → "सिता", "Krishna" → "कृष्ण"
 */

type CharEntry =
  | { type: "consonant"; deva: string }
  | { type: "vowel";     standalone: string; matra: string }

// Multi-char sequences — checked in order (longer first)
const MULTI: [string, CharEntry][] = [
  // Clusters
  ["ksh", { type:"consonant", deva:"क्ष" }],
  ["gy",  { type:"consonant", deva:"ज्ञ" }],
  // Aspirates
  ["chh", { type:"consonant", deva:"छ" }],
  ["kh",  { type:"consonant", deva:"ख" }],
  ["gh",  { type:"consonant", deva:"घ" }],
  ["ng",  { type:"consonant", deva:"ङ" }],
  ["ch",  { type:"consonant", deva:"च" }],
  ["jh",  { type:"consonant", deva:"झ" }],
  ["ny",  { type:"consonant", deva:"ञ" }],
  ["Th",  { type:"consonant", deva:"ठ" }],
  ["th",  { type:"consonant", deva:"थ" }],
  ["Dh",  { type:"consonant", deva:"ढ" }],
  ["dh",  { type:"consonant", deva:"ध" }],
  ["ph",  { type:"consonant", deva:"फ" }],
  ["bh",  { type:"consonant", deva:"भ" }],
  ["sh",  { type:"consonant", deva:"श" }],
  ["Sh",  { type:"consonant", deva:"ष" }],
  // Long vowels (multi-char first)
  ["aa",  { type:"vowel", standalone:"आ", matra:"ा" }],
  ["ii",  { type:"vowel", standalone:"ई", matra:"ी" }],
  ["ee",  { type:"vowel", standalone:"ई", matra:"ी" }],
  ["uu",  { type:"vowel", standalone:"ऊ", matra:"ू" }],
  ["oo",  { type:"vowel", standalone:"ऊ", matra:"ू" }],
  ["ai",  { type:"vowel", standalone:"ऐ", matra:"ै" }],
  ["au",  { type:"vowel", standalone:"औ", matra:"ौ" }],
  ["ri",  { type:"vowel", standalone:"ऋ", matra:"ृ" }],
]

// Single char — consonants and vowels
const SINGLE: Record<string, CharEntry> = {
  // Consonants
  k: { type:"consonant", deva:"क" },
  K: { type:"consonant", deva:"क" },
  g: { type:"consonant", deva:"ग" },
  G: { type:"consonant", deva:"ग" },
  c: { type:"consonant", deva:"च" },
  j: { type:"consonant", deva:"ज" },
  J: { type:"consonant", deva:"ज" },
  T: { type:"consonant", deva:"ट" },
  t: { type:"consonant", deva:"त" },
  D: { type:"consonant", deva:"ड" },
  d: { type:"consonant", deva:"द" },
  N: { type:"consonant", deva:"ण" },
  n: { type:"consonant", deva:"न" },
  p: { type:"consonant", deva:"प" },
  b: { type:"consonant", deva:"ब" },
  B: { type:"consonant", deva:"ब" },
  m: { type:"consonant", deva:"म" },
  y: { type:"consonant", deva:"य" },
  Y: { type:"consonant", deva:"य" },
  r: { type:"consonant", deva:"र" },
  R: { type:"consonant", deva:"र" },
  l: { type:"consonant", deva:"ल" },
  L: { type:"consonant", deva:"ल" },
  v: { type:"consonant", deva:"व" },
  V: { type:"consonant", deva:"व" },
  w: { type:"consonant", deva:"व" },
  W: { type:"consonant", deva:"व" },
  s: { type:"consonant", deva:"स" },
  S: { type:"consonant", deva:"स" },
  h: { type:"consonant", deva:"ह" },
  H: { type:"consonant", deva:"ह" },
  f: { type:"consonant", deva:"फ" },
  F: { type:"consonant", deva:"फ" },
  z: { type:"consonant", deva:"ज" },
  Z: { type:"consonant", deva:"ज" },
  x: { type:"consonant", deva:"क्ष" },
  // Short vowels
  a: { type:"vowel", standalone:"आ", matra:"ा" },  // convention: 'a' → ā (common in Nepali names)
  A: { type:"vowel", standalone:"आ", matra:"ा" },
  i: { type:"vowel", standalone:"इ", matra:"ि" },
  I: { type:"vowel", standalone:"ई", matra:"ी" },
  u: { type:"vowel", standalone:"उ", matra:"ु" },
  U: { type:"vowel", standalone:"ऊ", matra:"ू" },
  e: { type:"vowel", standalone:"ए", matra:"े" },
  E: { type:"vowel", standalone:"ए", matra:"े" },
  o: { type:"vowel", standalone:"ओ", matra:"ो" },
  O: { type:"vowel", standalone:"ओ", matra:"ो" },
}

export function transliterateToNepali(roman: string): string {
  let result = ""
  let i = 0
  let prevWasConsonant = false

  while (i < roman.length) {
    // Try multi-char sequences
    let matched = false
    for (const [seq, entry] of MULTI) {
      if (roman.startsWith(seq, i)) {
        if (entry.type === "consonant") {
          if (prevWasConsonant) result += "्"  // halant
          result += entry.deva
          prevWasConsonant = true
        } else {
          result += prevWasConsonant ? entry.matra : entry.standalone
          prevWasConsonant = false
        }
        i += seq.length
        matched = true
        break
      }
    }
    if (matched) continue

    // Try single char
    const ch = roman[i]
    const entry = SINGLE[ch]
    if (entry) {
      if (entry.type === "consonant") {
        if (prevWasConsonant) result += "्"  // halant between consonants
        result += entry.deva
        prevWasConsonant = true
      } else {
        result += prevWasConsonant ? entry.matra : entry.standalone
        prevWasConsonant = false
      }
    } else {
      // Pass through (space, digit, punctuation, unknown)
      // Space after consonant → consonant keeps inherent 'a', no halant
      result += ch
      prevWasConsonant = false
    }
    i++
  }

  return result
}
