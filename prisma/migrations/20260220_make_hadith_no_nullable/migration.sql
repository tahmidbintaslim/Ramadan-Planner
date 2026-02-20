-- Manual migration: make hadith.hadith_no nullable
ALTER TABLE public.hadith ALTER COLUMN hadith_no DROP NOT NULL;
