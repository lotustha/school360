// Nepal public-holiday seed data for the Academic Calendar (P15).
//
// Keyed by BS year so an academic year spanning two BS years (e.g. a fiscal
// 2082/83 year) can pull from both buckets. Dates are "YYYY-MM-DD" BS strings.
//
// Fixed national days (New Year, Republic Day, Constitution Day, Prithvi
// Jayanti, Martyrs' Day, Democracy Day, Maghe Sankranti) fall on the same BS
// date every year. Lunar festival dates (Dashain, Tihar, Holi, Shivaratri,
// Lhosars …) move year to year — the entries below follow the published
// 2082/2083 BS calendars but schools should verify/adjust after importing;
// every imported row is an ordinary editable calendar event.

export interface NepalHoliday {
  title:      string
  dateBS:     string
  endDateBS?: string // multi-day holidays (Dashain, Tihar)
}

export const NEPAL_PUBLIC_HOLIDAYS: Record<number, NepalHoliday[]> = {
  // ── BS 2082 (Apr 2025 – Apr 2026 AD) ──────────────────────────────────────
  2082: [
    { title: "Nepali New Year (Navavarsha)",            dateBS: "2082-01-01" },
    { title: "International Labour Day",                dateBS: "2082-01-18" },
    { title: "Buddha Jayanti",                          dateBS: "2082-01-29" },
    { title: "Republic Day (Ganatantra Diwas)",         dateBS: "2082-02-15" },
    { title: "Janai Purnima / Raksha Bandhan",          dateBS: "2082-04-24" },
    { title: "Gai Jatra",                               dateBS: "2082-04-25" },
    { title: "Shree Krishna Janmashtami",               dateBS: "2082-04-31" },
    { title: "Haritalika Teej",                         dateBS: "2082-05-10" },
    { title: "Indra Jatra",                             dateBS: "2082-05-21" },
    { title: "Constitution Day (Sambidhan Diwas)",      dateBS: "2082-06-03" },
    { title: "Ghatasthapana",                           dateBS: "2082-06-06" },
    { title: "Dashain Holidays (Phulpati – Ekadashi)",  dateBS: "2082-06-13", endDateBS: "2082-06-17" },
    { title: "Tihar Holidays (Kag Tihar – Bhai Tika)",  dateBS: "2082-07-02", endDateBS: "2082-07-06" },
    { title: "Chhath Parva",                            dateBS: "2082-07-10" },
    { title: "Tamu Lhosar",                             dateBS: "2082-09-15" },
    { title: "Prithvi Jayanti",                         dateBS: "2082-09-27" },
    { title: "Maghe Sankranti",                         dateBS: "2082-10-01" },
    { title: "Sonam Lhosar",                            dateBS: "2082-10-05" },
    { title: "Basanta Panchami (Saraswati Puja)",       dateBS: "2082-10-09" },
    { title: "Martyrs' Day (Sahid Diwas)",              dateBS: "2082-10-16" },
    { title: "Maha Shivaratri",                         dateBS: "2082-11-03" },
    { title: "Gyalpo Lhosar",                           dateBS: "2082-11-06" },
    { title: "Democracy Day (Prajatantra Diwas)",       dateBS: "2082-11-07" },
    { title: "Fagu Purnima (Holi)",                     dateBS: "2082-11-19" },
    { title: "International Women's Day",               dateBS: "2082-11-24" },
    { title: "Ghode Jatra",                             dateBS: "2082-12-04" },
    { title: "Ram Navami",                              dateBS: "2082-12-12" },
  ],

  // ── BS 2083 (Apr 2026 – Apr 2027 AD) ──────────────────────────────────────
  2083: [
    { title: "Nepali New Year (Navavarsha)",            dateBS: "2083-01-01" },
    { title: "International Labour Day",                dateBS: "2083-01-18" },
    { title: "Republic Day (Ganatantra Diwas)",         dateBS: "2083-02-15" },
    { title: "Buddha Jayanti",                          dateBS: "2083-02-17" },
    { title: "Janai Purnima / Raksha Bandhan",          dateBS: "2083-05-12" },
    { title: "Gai Jatra",                               dateBS: "2083-05-13" },
    { title: "Shree Krishna Janmashtami",               dateBS: "2083-05-19" },
    { title: "Haritalika Teej",                         dateBS: "2083-05-29" },
    { title: "Constitution Day (Sambidhan Diwas)",      dateBS: "2083-06-03" },
    { title: "Indra Jatra",                             dateBS: "2083-06-09" },
    { title: "Ghatasthapana",                           dateBS: "2083-06-25" },
    { title: "Dashain Holidays (Phulpati – Ekadashi)",  dateBS: "2083-06-30", endDateBS: "2083-07-04" },
    { title: "Tihar Holidays (Kag Tihar – Bhai Tika)",  dateBS: "2083-07-22", endDateBS: "2083-07-25" },
    { title: "Chhath Parva",                            dateBS: "2083-07-29" },
    { title: "Tamu Lhosar",                             dateBS: "2083-09-15" },
    { title: "Prithvi Jayanti",                         dateBS: "2083-09-27" },
    { title: "Maghe Sankranti",                         dateBS: "2083-10-01" },
    { title: "Martyrs' Day (Sahid Diwas)",              dateBS: "2083-10-16" },
    { title: "Sonam Lhosar",                            dateBS: "2083-10-25" },
    { title: "Basanta Panchami (Saraswati Puja)",       dateBS: "2083-10-28" },
    { title: "Democracy Day (Prajatantra Diwas)",       dateBS: "2083-11-07" },
    { title: "Maha Shivaratri",                         dateBS: "2083-11-22" },
    { title: "International Women's Day",               dateBS: "2083-11-24" },
    { title: "Gyalpo Lhosar",                           dateBS: "2083-11-25" },
    { title: "Fagu Purnima (Holi)",                     dateBS: "2083-12-08" },
    { title: "Ghode Jatra",                             dateBS: "2083-12-23" },
  ],
}

/** BS years we ship seed data for (used to message users when a year has none). */
export const SEEDED_BS_YEARS = Object.keys(NEPAL_PUBLIC_HOLIDAYS).map(Number)

/**
 * All seeded holidays whose start date falls inside [startBS, endBS]
 * (inclusive). Zero-padded "YYYY-MM-DD" strings compare lexicographically.
 */
export function holidaysForRangeBS(startBS: string, endBS: string): NepalHoliday[] {
  const startYear = Number(startBS.slice(0, 4))
  const endYear   = Number(endBS.slice(0, 4))
  const out: NepalHoliday[] = []
  for (let y = startYear; y <= endYear; y++) {
    for (const h of NEPAL_PUBLIC_HOLIDAYS[y] ?? []) {
      if (h.dateBS >= startBS && h.dateBS <= endBS) out.push(h)
    }
  }
  return out.sort((a, b) => a.dateBS.localeCompare(b.dateBS))
}
