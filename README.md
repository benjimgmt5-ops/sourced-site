# MYL — Made You Look website

Static site (`public/`) + Vercel serverless functions (`api/`).

## What's in it
- Autoplaying blended video wall with Chloe flying around as the "Made You Look" lens
- Chloe AI assistant: fills in the brief form from what clients type (Claude), speaks with the ElevenLabs "Charlotte" British voice
- Brief form → stored in Vercel Blob
- Staff login (username + password) → briefs board (New / In review / Quote sent / Won / Lost) and live site editor (text, films, ticker, uploads)

## Deploy (one time)
1. Push this folder to a GitHub repo (e.g. `myl-site`).
2. In Vercel: **Add New → Project → Import** the repo. Framework preset: **Other**. Leave build settings empty. Deploy.
3. In the project: **Storage → Create → Blob** (access: Public) and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` automatically.
4. **Settings → Environment Variables** (Production + Preview):
   | Key | Value |
   |---|---|
   | `STAFF_USERS` | `benji:your-password` (add more as `name:password,name2:password2`) |
   | `SESSION_SECRET` | any long random string (40+ characters) |
   | `ELEVENLABS_API_KEY` | your ElevenLabs API key (Chloe's live voice) |
   | `ANTHROPIC_API_KEY` | your Claude API key (Chloe's smart replies) |
   | `ELEVENLABS_VOICE_ID` | optional, defaults to Charlotte `I7QBbqvBcOGnmbD4D98p` |
   | `CHLOE_MODEL` | optional, defaults to `claude-haiku-5-5` |
5. **Deployments → Redeploy** so the variables take effect.
6. **Settings → Domains → Add** your domain (buy it there or point your registrar's DNS at Vercel).

Without the two AI keys the site still works: Chloe uses her three recorded ElevenLabs lines, simple brief matching, and the browser's British voice.

## Staff
Click **Staff** in the top nav → sign in. The Staff bar gives you **Briefs** and **Edit site** (click any outlined text, rename/hide/add films, edit ticker words, then **Publish changes**).
