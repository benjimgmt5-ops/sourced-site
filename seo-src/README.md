# Sourced. SEO pages

Kept off the live site by `.vercelignore`. Build with `python3 seo-src/build.py` from the repo root.
That regenerates every service page, every guide, `/guides/` and `sitemap.xml`.

- `pages/*.json`: service pages (locations, cars, transport, security, crew & kit)
- `guides/*.json`: guide articles, one file each, named `YYYY-MM-DD-short-name.json`
- `topics.md`: the queue of guide topics for the weekly job

## Weekly guide job

1. Take the first unchecked topic in `topics.md`.
2. Write one guide as `guides/<today>-<short-name>.json`, copying the shape of an existing guide:
   `slug`, `date` (today, YYYY-MM-DD), `title` (under 65 characters before " | Sourced."), `description` (140 to 160 characters),
   `h1`, `lede`, `hero` (`src` must be an existing file in `/media/*.jpg`, plus `alt`), `services` (1 to 4 service slugs that fit),
   `sections` (5 to 7, each `h2` + `text`, optional `bullets`), `faqs` (3 or 4).
3. Run the build, check it prints no errors and the new page and sitemap entry exist.
4. Tick the topic in `topics.md`, commit, push to `main`. Vercel deploys automatically.

## Rules for every guide

- 700 to 1,100 words. Plain British English, short sentences, practical and specific.
- Write for producers, directors, artists' teams, fashion and event planners in London.
- Never invent clients, artists, shoots, reviews, quotes, statistics, prices or fees.
- Only mention vehicles, properties and services that appear in `pages/*.json` or on the home page.
- Keep legal and permit points general and correct (for example, council film offices handle public street filming; drones need a registered operator). No specific fees or rules you are not sure of.
- No keyword stuffing. Use the topic's main phrase in the title, H1, first section and one H2, naturally.
- End by pointing readers to the brief form or Amelia; `build.py` adds the call to action and links automatically.
