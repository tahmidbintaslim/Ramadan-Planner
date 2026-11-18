# Store listings: Google Play and App Store

What to paste into Play Console and App Store Connect for version 1.0.0. The answers describe what the code does
today (see `/privacy`, `src/server/account-impl.ts`, `src/lib/track.ts`); update both if that changes.

## Shared details

| Field | Value |
| --- | --- |
| App name | Ramadan Planner (bn: রমজান প্ল্যানার) |
| Package / bundle id | `space.tahmid.ramadanplanner` |
| Category | Lifestyle (App Store secondary: Reference) |
| Privacy policy URL | https://ramadanplanner.tahmid.space/privacy |
| Support URL / email | https://ramadanplanner.tahmid.space/contact · contact@tahmid.space |
| Website | https://ramadanplanner.tahmid.space |
| Price | Free. No ads, no in-app purchases |
| Account needed? | No. Everything works as a guest; reviewers need no login |
| Account deletion | In the app: Settings → Delete account. On the web: same page at /settings |

## Text

**Short description** (Play, 80 characters max)
- en: `Sehri, iftar and prayer times, amal planner, Quran and duas for Ramadan.` (72)
- bn: `সেহরি, ইফতার ও নামাজের সময়, আমলের পরিকল্পনা, কুরআন ও দোয়া।`

**App Store subtitle** (30 max)
- en: `Sehri, iftar & prayer times`
- bn: `সেহরি, ইফতার ও নামাজের সময়`

**App Store keywords** (100 max, comma separated, no spaces)
`ramadan,sehri,iftar,prayer times,namaz,salah,quran,dua,tasbih,zakat,bangladesh,muslim,fasting,roza`

**Full description** (en)

> Your Ramadan companion, in Bengali and English. Free, with no ads.
>
> • Sehri, iftar and the five prayer times for every district of Bangladesh and for cities worldwide, matched to
>   the Islamic Foundation Bangladesh timetable, with the calculation method shown.
> • The full 30-day Ramadan timetable with the three ashras.
> • A daily amal planner, prayer and Quran tracking, khatam progress and a private journal.
> • The Quran with Arabic, Bengali and English translations, and recitation.
> • Sourced duas, a tasbih counter and a zakat calculator.
> • Reminders for sehri, iftar and each prayer.
>
> No account needed: use it as a guest and your data stays on your phone. Sign in only if you want it on your other
> devices. You can download or delete your data at any time from Settings.

**Full description** (bn)

> বাংলা ও ইংরেজিতে আপনার রমজানের সঙ্গী। বিনামূল্যে, কোনো বিজ্ঞাপন নেই।
>
> • বাংলাদেশের প্রতিটি জেলা ও বিশ্বের শহরগুলোর সেহরি, ইফতার ও পাঁচ ওয়াক্ত নামাজের সময়, ইসলামিক ফাউন্ডেশন
>   বাংলাদেশের সময়সূচির সঙ্গে মিলিয়ে, হিসাবের পদ্ধতিসহ।
> • তিন আশরাসহ রমজানের পুরো ৩০ দিনের সময়সূচি।
> • দৈনিক আমলের পরিকল্পনা, নামাজ ও কুরআনের হিসাব, খতমের অগ্রগতি ও ব্যক্তিগত ডায়েরি।
> • আরবি, বাংলা ও ইংরেজি অনুবাদ এবং তিলাওয়াতসহ কুরআন।
> • সূত্রসহ দোয়া, তাসবিহ গণনা ও যাকাত হিসাব।
> • সেহরি, ইফতার ও প্রতি ওয়াক্ত নামাজের রিমাইন্ডার।
>
> অ্যাকাউন্ট লাগবে না: গেস্ট হিসেবে ব্যবহার করুন, তথ্য আপনার ফোনেই থাকবে। অন্য ডিভাইসেও চাইলে তবেই সাইন ইন করুন।
> সেটিংস থেকে যেকোনো সময় তথ্য ডাউনলোড বা মুছে ফেলা যায়।

## Google Play: Data safety form

- **Does the app collect or share user data?** Yes, collects. Not shared (the services listed on /privacy act as
  service providers).
- **Encrypted in transit:** Yes. **Users can request deletion:** Yes (in the app, and on the web).
- Data types collected, all for *App functionality*, none for ads or marketing:
  - Location → *Approximate location* (rounded to about 1 km). Optional, stored only with an account.
  - Personal info → *Name*, *Email address*. Only with an account (sign-in).
  - App activity → *Other user-generated content* (planner, journal). Only with an account.
  - App activity → *App interactions* (anonymous usage counts; also *Analytics*). Skipped under Do Not Track.
- **Ads:** No. **Target audience:** 13 and over. **Content rating:** answer the questionnaire as a reference/lifestyle
  app with no violence, gambling, user-to-user chat or user-generated content shared with others.
- **App access:** "All functionality is available without special access."

## App Store: App Privacy ("nutrition label")

- Data used to track you: **None**.
- Data linked to you (only when signed in), purpose *App Functionality*:
  - Contact Info → Name, Email Address.
  - Location → Coarse Location.
  - User Content → Other User Content (planner, journal).
  - Usage Data → Product Interaction (also *Analytics*).
- **Export compliance:** the app uses only standard HTTPS (`ITSAppUsesNonExemptEncryption` = NO in `Info.plist`).
- **Age rating:** 4+.

## Screenshots and graphics

Generated from the live site by `scripts/store-screenshots.mjs` into `store/` (bn and en):

| Store | Size | Files |
| --- | --- | --- |
| Google Play phone | 1080 × 2340 | `store/play/{bn,en}/*.png` |
| Google Play feature graphic | 1024 × 500 | `store/play/feature-graphic.png` |
| App Store 6.9" iPhone | 1320 × 2868 | `store/ios/{bn,en}/*.png` |
| Icon | 512 × 512 | `public/icons/icon-512.png` |
