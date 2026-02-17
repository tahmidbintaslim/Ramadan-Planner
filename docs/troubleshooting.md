# Troubleshooting

## Prayer Times Not Loading

- Check if location permissions are granted
- Verify API (AlAdhan) is reachable
- Check browser console for CORS or network errors
- Fallback: manually set lat/lng in settings

## Timezone Issues

- Ensure user profile has correct timezone
- DST transitions: times should auto-adjust
- If times seem wrong, clear cache and reload

## Auth Problems

- Social login: check Supabase OAuth provider config
- Email login: verify email confirmation flow
- Session expired: redirect to login

## Calendar Sync

- Google: re-authorize if token expired
- ICS: regenerate secret if link compromised

## Build/Dev Errors

- Run `npm run lint` to catch type errors
- Clear `.next` cache: `rm -rf .next && npm run dev`
- Prisma issues: `npx prisma generate` after schema changes
