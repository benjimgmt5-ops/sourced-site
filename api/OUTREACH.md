# MYL outreach → CRM board

The staff board on www.mylvisuals.com has an **Outreach** panel. It reads `api/_outreach.json`,
`api/_replied.json` and `api/_suppress.json` from this branch (`myl-site` of the sourced-site repo).

## Lead entry
```json
{ "id": "YYYY-MM-DD-<email-slug>", "to": "info@example.com", "company": "Example", "segment": "agency",
  "subject": "...", "via": "gmail", "stage": "emailed", "sentAt": "2026-10-15T17:03:00Z", "lastAt": "..." }
```
- `via: "gmail"` = the Gmail outreach bot sends it. The site only displays it.
- `stage`: queued, emailed, followed, final, replied, stopped, failed.
- Leads WITHOUT `via` are sent by the site itself from `NOTIFY_FROM` (hello@mylvisuals.com) through
  Resend every 10 minutes, with automatic follow-ups at 5 and 12 days. That needs `RESEND_API_KEY` set on
  the Vercel project `myl-visuals` and mylvisuals.com verified in Resend. Leads also need a `text` body.

## Replies and opt-outs
Add the address to `api/_replied.json` (replied) or `api/_suppress.json` (opted out / bounced).

## Deploying changes
The Vercel project `myl-visuals` is not git-linked. After pushing to `myl-site`, create a production
deployment with the Vercel connector: gitSource `{type: github, org: benjimgmt5-ops, repo: sourced-site,
ref: myl-site, sha: <new commit>}`, project `prj_Ym5FyrjKvMD6ehhi0qkRO335cpsk`, target production
(do not pass teamId).
