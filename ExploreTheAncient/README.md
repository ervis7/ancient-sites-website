# ExploreTheAncients

A Next.js application for maintaining private, per-account collections of
ancient places in Greece.

## Supabase setup

1. Create a Supabase project.
2. Open its SQL Editor and run
   `supabase/migrations/001_accounts_and_places.sql`. If the first migration
   was already applied, also run
   `supabase/migrations/002_private_browse_hierarchy.sql` and
   `supabase/migrations/003_extended_profiles.sql`, followed by
   `supabase/migrations/004_friends_and_activity.sql` and
   `supabase/migrations/005_private_nomos_preferences.sql`.
3. Copy `.env.example` to `.env.local`.
4. Add the project URL and publishable key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

5. Add `http://localhost:3000/auth/callback` to the Supabase Authentication
   redirect URLs.
6. Run `npm run dev`.

The `profiles` and `places` tables have row-level security enabled. Every place
query is restricted to the authenticated owner by database policy.
