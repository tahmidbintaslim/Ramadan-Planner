// Database types matching the Supabase schema

export interface DailyContent {
    id: string;
    day: number;
    ayah_ar: string;
    ayah_bn: string;
    ayah_en: string | null;
    ayah_ref: string;
    hadith_ar: string | null;
    hadith_bn: string;
    hadith_en: string | null;
    hadith_ref: string;
    dua_ar: string;
    dua_bn: string;
    dua_en: string | null;
    dua_context: string | null;
    day_task_bn: string | null;
    day_task_en: string | null;
    checklist_template: string[];
    created_at: string;
    updated_at: string;
}

export interface UserProfile {
    id: string;
    display_name: string;
    locale: "bn" | "en";
    timezone: string;
    latitude: number;
    longitude: number;
    location_label: string;
    created_at: string;
    updated_at: string;
}

export interface PrayerLog {
    fajr?: boolean;
    fajr_sunnah?: boolean;
    dhuhr?: boolean;
    dhuhr_sunnah?: boolean;
    asr?: boolean;
    asr_sunnah?: boolean;
    maghrib?: boolean;
    maghrib_sunnah?: boolean;
    isha?: boolean;
    isha_sunnah?: boolean;
    taraweeh?: boolean;
    tahajjud?: boolean;
}

export interface DailyLog {
    id: string;
    user_id: string;
    day: number;
    log_date: string;
    prayers: PrayerLog;
    quran_para: number;
    quran_surah: string;
    quran_ayah: number;
    quran_pages: number;
    checklist: string[];
    journal_text: string;
    my_dua: string;
    day_task_done: boolean;
    created_at: string;
    updated_at: string;
}

export interface PrayerGoal {
    id: string;
    user_id: string;
    title: string;
    target_count: number;
    target_unit: string;
    is_completed: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface PlanTask {
    id: string;
    user_id: string;
    title: string;
    is_done: boolean;
    due_date: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export type ReminderType =
    | "sehri"
    | "iftar"
    | "fajr"
    | "dhuhr"
    | "asr"
    | "maghrib"
    | "isha"
    | "taraweeh"
    | "tahajjud"
    | "custom";

export type ReminderChannel = "push" | "calendar";

export interface ReminderRule {
    id: string;
    user_id: string;
    type: ReminderType;
    label: string;
    offset_minutes: number;
    channels: ReminderChannel[];
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface PushSubscription {
    id: string;
    user_id: string;
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    created_at: string;
}

export interface CalendarLink {
    id: string;
    user_id: string;
    google_tokens: Record<string, unknown> | null;
    ics_secret: string | null;
    created_at: string;
    updated_at: string;
}

export interface Announcement {
    id: string;
    title_bn: string;
    title_en: string;
    body_bn: string;
    body_en: string;
    start_at: string;
    end_at: string | null;
    created_at: string;
}

// ── Quran data (stored in DB, sourced from quranapi.pages.dev) ──

export interface QuranAudioEntry {
    reciter: string;
    url: string;
    originalUrl: string;
}

export interface QuranSurahRow {
    surah_no: number;
    name_arabic: string;
    name_arabic_long: string;
    name_english: string;
    name_translation: string;
    name_bengali: string;
    revelation_place: string;
    total_ayah: number;
    audio: Record<string, QuranAudioEntry>;
}

export interface QuranAyahRow {
    id: number;
    surah_no: number;
    ayah_no: number;
    text_arabic: string;
    text_arabic_clean: string;
    text_english: string;
    text_bengali: string;
    audio: Record<string, QuranAudioEntry>;
}

export interface QuranReciterRow {
    reciter_id: number;
    name: string;
}

// Prayer times from AlAdhan API
export interface PrayerTimes {
    fajr: string;
    sunrise: string;
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
    sehri: string; // Same as fajr for sehri end
    iftar: string; // Same as maghrib
}

export interface TimingData {
    prayerTimes: PrayerTimes;
    hijriDate: {
        day: string;
        month: string;
        year: string;
        monthAr: string;
        monthBn: string;
    };
    gregorianDate: string;
    timezone: string;
    location: string;
}
