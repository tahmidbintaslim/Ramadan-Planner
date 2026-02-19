-- Ramadan Planner: Quran Data Tables
-- Stores surahs, ayahs (with Arabic/English/Bengali), reciters, and audio links
-- Source: quranapi.pages.dev  —  seeded via scripts/seed-quran.ts

-- ============================================================
-- 1. Quran Surahs (114 rows)
-- ============================================================
CREATE TABLE IF NOT EXISTS quran_surahs (
  surah_no         INTEGER PRIMARY KEY CHECK (surah_no >= 1 AND surah_no <= 114),
  name_arabic      TEXT NOT NULL,
  name_arabic_long TEXT NOT NULL DEFAULT '',
  name_english     TEXT NOT NULL,
  name_translation TEXT NOT NULL DEFAULT '',
  name_bengali     TEXT NOT NULL DEFAULT '',
  revelation_place TEXT NOT NULL DEFAULT 'Mecca' CHECK (revelation_place IN ('Mecca', 'Madina')),
  total_ayah       INTEGER NOT NULL CHECK (total_ayah > 0),
  audio            JSONB NOT NULL DEFAULT '{}'::jsonb  -- chapter audio by reciter id
);

-- Public read, service_role write
ALTER TABLE quran_surahs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read quran surahs" ON quran_surahs
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage quran surahs" ON quran_surahs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 2. Quran Ayahs (6236 rows, multi-language text + audio)
-- ============================================================
CREATE TABLE IF NOT EXISTS quran_ayahs (
  id               SERIAL PRIMARY KEY,
  surah_no         INTEGER NOT NULL REFERENCES quran_surahs(surah_no) ON DELETE CASCADE,
  ayah_no          INTEGER NOT NULL CHECK (ayah_no >= 1),
  text_arabic      TEXT NOT NULL DEFAULT '',   -- with tashkeel (diacritics)
  text_arabic_clean TEXT NOT NULL DEFAULT '',  -- without tashkeel
  text_english     TEXT NOT NULL DEFAULT '',
  text_bengali     TEXT NOT NULL DEFAULT '',
  audio            JSONB NOT NULL DEFAULT '{}'::jsonb,  -- verse audio by reciter id

  UNIQUE (surah_no, ayah_no)
);

ALTER TABLE quran_ayahs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read quran ayahs" ON quran_ayahs
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage quran ayahs" ON quran_ayahs
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_quran_ayahs_surah ON quran_ayahs(surah_no);

-- ============================================================
-- 3. Quran Reciters (small lookup table)
-- ============================================================
CREATE TABLE IF NOT EXISTS quran_reciters (
  reciter_id INTEGER PRIMARY KEY,
  name       TEXT NOT NULL
);

ALTER TABLE quran_reciters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reciters" ON quran_reciters
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage reciters" ON quran_reciters
  FOR ALL USING (auth.role() = 'service_role');
