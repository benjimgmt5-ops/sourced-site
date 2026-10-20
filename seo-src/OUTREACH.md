# Daily outreach job

## Step 0: keep Sourced separate from MYL (read first)
Sourced. and MYL are two different businesses with two different bots. Sourced. replies, briefs and alerts go ONLY to
sourced.admin@gmail.com, and Sourced. emails go out ONLY from hello@wearesourced.co.uk through this site's sender.
The Gmail connector is Benji's personal account (benjimgmt5@gmail.com, default send-as = MYL), so this job must
NEVER read, search, draft or send in Gmail, and must never touch anything MYL. Lead replies are handled by Benji in
the sourced.admin@gmail.com inbox and /admin until Sourced. has its own reply inbox.

Follow-ups at 5 and 12 days are sent automatically by the sender; never queue them by hand.

Emails are queued in `api/_outreach.json` and sent by `/api/outreach` (Vercel Cron, every 10 minutes,
5 per run) from hello@wearesourced.co.uk with replies to sourced.admin@gmail.com.
`api/_suppress.json` lists addresses or "@domain" entries that must never be emailed.
Email wording lives in `seo-src/outreach-templates.json`; replace `{name}` with the company name and change nothing else.

## Each day: at least 70 NEW contacts, spread across ALL of these

Sourced. covers anything a production needs: film, TV, music videos, runway and fashion shows, photo shoots,
events, lifestyle management and transport. Every day must include a real mix. Aim for roughly:

**Clients (people who book) - about 50 a day**
| Template | Who | Daily |
|---|---|---|
| production_company | music video and commercials production companies | 10 |
| tv_film | TV and film production companies | 6 |
| production_services | production services companies, fixers, location managers and scouts | 5 |
| event_fashion | event and experiential agencies, fashion show producers, fashion PR, brand launches | 8 |
| festival | festivals and live event promoters | 5 |
| music_management_label | artist management, record labels, music video commissioners, tour managers | 6 |
| lifestyle_concierge | lifestyle management, concierge, luxury travel and VIP services, wedding and private event planners | 5 |
| talent_model_agency / photo_studio_photographer | model and talent agencies, photo studios, photographers' agents | 5 |

**Suppliers (people we book) - about 20 a day**
| Template | Who | Daily |
|---|---|---|
| location_owner | location houses, warehouses, studios, venues, industrial and empty buildings, property and meanwhile-use companies that advertise filming hire themselves | 8 |
| vehicle_transport_supplier | supercar hire, classic and picture car hire, chauffeur firms, Sprinter, V-Class and coach operators, private aviation | 7 |
| site_services_supplier | security firms, film and event caterers, trailer and dressing room hire, portable toilets, generators, marquees | 5 |

**Upcoming productions radar:** each day, include at least 10 production companies with UK projects currently in
pre-production or prep (public production listings such as productionlist.com, Kays, The Knowledge news, Screen Daily,
Deadline, Variety production news). Use the production company's own published contact email and the tv_film or
production_company template. Do not mention project details you can't confirm.

If one category runs short, top up from another, but never skip a category entirely two days in a row.
Rotate across London, the Home Counties and other UK cities so the same areas aren't hit every day.

## Rules
1. Only use an email the business publishes itself: its own website, or a trade directory such as the APA members
   list (www.a-p-a.net/members/, emails are Cloudflare-obfuscated in data-cfemail and can be decoded).
2. Business addresses only. Never private individuals or homeowners. A location owner qualifies only if they run the
   space as a business with its own website and contact details for filming or hire. Never take contact details from
   booking platforms (Scouty, Giggster, Peerspace, Airbnb, etc.) and never guess addresses.
3. Skip anyone (same address or same domain) already in `api/_outreach.json`, `api/_suppress.json` or
   `api/_replied.json`. Do not use Gmail for this.
4. Never read or use Gmail. Removals are added to `api/_suppress.json` by Benji.
5. Append to the queue with ids `YYYY-MM-DD-<email-slug>`, validate the JSON, `node --check api/outreach.js`,
   commit and push to main.
6. Report: total queued and count per template.
