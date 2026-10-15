# Daily outreach job

Emails are queued in `api/_outreach.json` and sent by `/api/outreach` (Vercel Cron, every 10 minutes,
5 per run) from hello@wearesourced.co.uk with replies to sourced.admin@gmail.com.
`api/_suppress.json` lists addresses or "@domain" entries that must never be emailed.

## Each day
1. Find at least 70 NEW businesses that book or produce shoots and events in the UK: music video and commercials
   production companies, production services and fixers, location agencies and scouts, festivals, event and
   experiential agencies, fashion show producers, fashion and music PR, artist management, record label video teams,
   photo studios.
2. Only use an email the business publishes itself (its own website, or a trade directory such as the APA members
   list at a-p-a.net/members). Business addresses only. Never private individuals or homeowners, never emails
   taken from booking platforms (Scouty, Giggster, etc.), never guessed addresses.
3. Skip anyone already in `api/_outreach.json`, already in `api/_suppress.json`, or already emailed from Gmail
   (search Gmail sent for the domain).
4. Use the matching template already in the queue (production company, production services, festival,
   event/fashion), changing only the company name. Keep the signature and the "reply remove" line.
5. Before queueing, check Gmail for replies asking to be removed and add those addresses to `api/_suppress.json`.
6. Append to the queue with ids `YYYY-MM-DD-<email-slug>`, validate the JSON, commit and push to main.
