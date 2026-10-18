# Eventgram

Every VIT event in one feed. Events come in from EventHub automatically; clubs add what EventHub doesn't show (OD, timings, posters, reels, hooks); students browse, filter by date/OD/club, save, and tap Register to go to EventHub.

## Who does what

| Who | How they get in | What they can do |
| --- | --- | --- |
| Students | No login | Browse the feed and reels, filter by date, OD, club and category, save events (kept on their phone), share events to WhatsApp/Telegram/Insta (with a preview picture), add events and registration deadlines to Google or Apple Calendar, tap Register |
| A club | The username + password you create for it | On the **Clubs** tab: claim their EventHub events, add OD yes/no + OD timings + note, registration deadline, hook line, highlights, Instagram link, contact, posters and reels; add events that aren't on EventHub |
| You (owner) | Your email + password | Everything clubs can do for any event, plus **Clubs & sync**: create club logins, reset passwords, remove clubs, see sync status, Sync now |

The database itself enforces these rules: a club login can only change its own club's events (or claim unclaimed ones), can't change what came from EventHub (name, date, venue, fee), and can only upload into its own folder.

## How the EventHub sync works

- A small job on the server signs in to EventHub with **one** VIT account (set as a secret on Vercel), reads the event list and each event's page, and updates Eventgram.
- It runs every morning (Vercel cron), and also whenever someone opens the feed and the last sync is over 3 hours old. You can also press **Sync now** on the owner page.
- New events are added, changed ones updated, and upcoming events that disappear from EventHub are removed. If most events vanish at once (EventHub probably changed its site), it changes nothing and says so.
- Only events open to VITians are shown. Past events are skipped.
- If a club's **Name on EventHub** is set (e.g. `VITSOL`, as EventHub writes it under "Conducted By"), its events are put under that club automatically.
- It reads at most 25 event pages per run, with a short pause between each, so it stays gentle on EventHub.

**Things EventHub doesn't provide**, so clubs fill them in: OD, OD timings, registration deadline. Until a club adds OD, events show "OD: not confirmed by the club yet".

**Register:** EventHub opens events through a form, so there's no link to a single event. Register copies the event name and opens EventHub; the student signs in and pastes it into Search.

## Setup (about 30 minutes)

### 1. Supabase (database, logins, file storage)

1. Sign up at [supabase.com](https://supabase.com) and create a project. Pick the Mumbai region.
2. **SQL Editor → New query**: paste all of `supabase/schema.sql`, change `you@example.com` on the last line to your email, and click **Run**.
3. **Authentication → Users → Add user → Create new user**: your email and a strong password, tick **Auto Confirm User**. This is your owner login.
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". Club logins are created from the owner page instead. (The database blocks stray sign-ups anyway; this is a second lock.)
5. **Project Settings → API**: copy the **Project URL**, the **anon public** key and the **service_role** key. Keep the service_role key secret: it can do anything in your database.

### 2. Put it online with Vercel

1. Push this folder to a **private** GitHub repo.
2. At [vercel.com](https://vercel.com), import the repo. Under **Environment Variables** add:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `EVENTHUB_USERNAME` | the VIT username the sync should use (a spare account is best) |
| `EVENTHUB_PASSWORD` | that account's password |
| `CRON_SECRET` | any long random text, e.g. from a password generator |

3. Deploy. You get an address like `eventgram.vercel.app`.
4. In Supabase, **Authentication → URL Configuration**: set **Site URL** to that address.

You type the EventHub password into Vercel yourself. It isn't in the code, the database or anywhere students can see.

### 3. First run

1. Open the site → **Clubs** tab → log in with your email and password.
2. Tap **Clubs & sync → Sync now**. Upcoming EventHub events appear on the feed.
3. Under **Add a club**: type the club name; the username fills itself in; a password is suggested. Add its EventHub name if you know it. Tap **Create club login** and copy the details shown. **The password is only shown once.**
4. Send the username and password to the club's core team. They log in on the Clubs tab.

To change a club's password later (e.g. new core team): **Clubs & sync → Manage → Set new password**.

## Running it on your laptop

```bash
cp .env.example .env.local   # fill in the same values as on Vercel
npm install
npm run dev                  # http://localhost:3000
```

## If something breaks

- **Owner page says "EventHub didn't accept the username or password"**: the sync account's password changed. Update `EVENTHUB_PASSWORD` on Vercel and redeploy.
- **"…no events I could read" or "…disappeared at once"**: EventHub probably changed its pages. The parser is in `lib/eventhub/parse.ts`.
- **Uploads fail**: posters must be JPG/PNG/WebP up to 10 MB; reels MP4/MOV up to 50 MB (Supabase free plan limit).

## Costs and limits

- Supabase free plan: 1 GB storage, 5 GB downloads a month. Reels use the most; move to Pro ($25/month) once lots of clubs post videos.
- Vercel free plan allows one cron run a day; the refresh-on-visit covers the rest.
- The sync uses one VIT account in a way VIT hasn't officially approved. If Eventgram takes off, ask the Software Development Cell (who run EventHub) for an official feed.

## Project map

```
app/
  page.tsx                  Feed: date strip, filters, refresh from EventHub when stale
  event/[id]/               Event page: posters/reels, OD details, "From the club", Register
  reels/  saved/            Full-screen reels; saved events (stored on the phone)
  login/                    Club login (username + password)
  club/                     Club desk: list, edit event, add event
  owner/                    Clubs & sync (owner only) + server actions
  api/sync/                 Endpoint the daily cron calls
components/                 Cards, ticket poster, editor, owner panel, theme toggle…
lib/eventhub/               EventHub sign-in, page reader, sync
lib/                        Supabase clients, formatting, queries, types
supabase/schema.sql         Tables, access rules, storage bucket
vercel.json                 Daily sync schedule
```
