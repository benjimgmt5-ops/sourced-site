#!/usr/bin/env python3
"""Builds the Sourced. SEO pages from JSON content.

  seo-src/pages/*.json   -> /<slug>/index.html   (service pages)
  seo-src/guides/*.json  -> /guides/<slug>/index.html, plus /guides/index.html
  sitemap.xml            -> regenerated with every page

Run from the repo root:  python3 seo-src/build.py
"""
import json, html, pathlib, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "seo-src"
SITE = "https://www.wearesourced.co.uk"
PHONE_DISPLAY = "07590 474421"
PHONE_INTL = "+447590474421"
EMAIL = "sourced.admin@gmail.com"
TODAY = datetime.date.today().isoformat()

E = lambda s: html.escape(str(s), quote=True)

CSS = """
:root{--black:#000;--ink:#0d0d0d;--graphite:#1a1a1a;--steel:#2e2e2e;--ash:#8f8f8f;--mist:#c9c9c9;--white:#fff;
--display:Anton,'Arial Narrow','Helvetica Neue Condensed',Impact,sans-serif;
--body:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;--pad:clamp(16px,5vw,64px)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--black);color:var(--white);font-family:var(--body);font-size:17px;line-height:1.6}
a{color:inherit}
.wrap{max-width:1100px;margin:0 auto;padding:0 var(--pad)}
header.top{position:sticky;top:0;z-index:5;background:rgba(0,0,0,.88);backdrop-filter:blur(8px);border-bottom:1px solid var(--graphite)}
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;height:64px}
.logo{font-family:var(--display);font-size:28px;letter-spacing:.5px;text-decoration:none}
.navlinks{display:flex;gap:18px;font-size:14px;color:var(--mist)}
.navlinks a{text-decoration:none}.navlinks a:hover{color:var(--white)}
@media(max-width:760px){.navlinks .hide-sm{display:none}}
.btn{display:inline-block;background:var(--white);color:var(--black);text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;font-size:15px}
.btn.ghost{background:transparent;color:var(--white);border:1px solid var(--steel)}
.hero{position:relative;min-height:62vh;display:flex;align-items:flex-end;overflow:hidden}
.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55}
.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.1),#000 92%)}
.hero .wrap{position:relative;z-index:1;padding-bottom:48px;padding-top:120px}
.kicker{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--ash);margin:0 0 10px}
h1{font-family:var(--display);font-weight:400;font-size:clamp(40px,8vw,84px);line-height:1;margin:0 0 18px;text-transform:uppercase}
h2{font-family:var(--display);font-weight:400;font-size:clamp(28px,4.5vw,44px);line-height:1.05;margin:56px 0 16px;text-transform:uppercase}
h3{font-size:19px;margin:0 0 6px}
.lede{font-size:clamp(18px,2.4vw,21px);color:var(--mist);max-width:720px;margin:0 0 26px}
.ctas{display:flex;gap:12px;flex-wrap:wrap}
main p,main li{color:var(--mist)}main strong{color:var(--white)}
.prose{max-width:760px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:20px 0}
.card{background:var(--ink);border:1px solid var(--graphite);border-radius:14px;padding:20px}
.card p{margin:0;font-size:15px}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:24px 0}
.gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block}
details{border-top:1px solid var(--graphite);padding:16px 0}details:last-of-type{border-bottom:1px solid var(--graphite)}
summary{cursor:pointer;font-weight:700;color:var(--white);font-size:17px}
details p{margin:10px 0 0}
.cta{margin:64px 0;background:var(--ink);border:1px solid var(--graphite);border-radius:20px;padding:clamp(24px,5vw,48px)}
.cta h2{margin-top:0}
.related{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 0;padding:0;list-style:none}
.related a{display:inline-block;border:1px solid var(--steel);border-radius:999px;padding:8px 14px;text-decoration:none;font-size:14px;color:var(--white)}
footer{border-top:1px solid var(--graphite);padding:36px 0 48px;color:var(--ash);font-size:14px}
footer .cols{display:flex;flex-wrap:wrap;gap:28px;justify-content:space-between}
footer a{text-decoration:none}footer a:hover{color:var(--white)}
.crumbs{font-size:13px;color:var(--ash);margin:0 0 14px}.crumbs a{text-decoration:none}
.guides{display:grid;gap:14px;margin:24px 0}
.guides a{display:block;text-decoration:none;background:var(--ink);border:1px solid var(--graphite);border-radius:14px;padding:20px}
.guides a:hover{border-color:var(--steel)}.guides small{color:var(--ash)}
"""


def load(folder):
    d = SRC / folder
    return [json.loads(p.read_text()) for p in sorted(d.glob("*.json"))] if d.exists() else []


SERVICES = load("pages")
GUIDES = sorted(load("guides"), key=lambda g: g.get("date", ""), reverse=True)


def nav():
    links = "".join(
        f'<a class="hide-sm" href="/{E(s["slug"])}/">{E(s["nav"])}</a>' for s in SERVICES
    )
    return f"""<header class="top"><div class="wrap bar">
<a class="logo" href="/" aria-label="Sourced. home">Sourced.</a>
<nav class="navlinks" aria-label="Services">{links}<a href="/guides/">Guides</a></nav>
<a class="btn" href="/#brief">Get a quote</a>
</div></header>"""


def footer():
    svc = "<br>".join(f'<a href="/{E(s["slug"])}/">{E(s["nav"])}</a>' for s in SERVICES)
    return f"""<footer><div class="wrap cols">
<div><div class="logo" style="font-size:24px;color:#fff">Sourced.</div><p>See it. Say it. Sourced.<br>Production sourcing across London and the UK.</p></div>
<div><strong style="color:#fff">Services</strong><br>{svc}<br><a href="/location-scouting/">Location scouting</a></div>
<div><strong style="color:#fff">Contact</strong><br><a href="mailto:{EMAIL}">{EMAIL}</a><br><a href="tel:{PHONE_INTL}">{PHONE_DISPLAY}</a><br><a href="https://www.instagram.com/sourced_uk/" target="_blank" rel="noopener">Instagram</a><br><a href="/guides/">Guides</a><br><a href="/partners/">List with us</a><br><a href="/list-your-house-for-filming/">List your house</a></div>
</div><div class="wrap"><p>© {datetime.date.today().year} Sourced. · <a href="/privacy/">Privacy policy</a> · <a href="/privacy/#cookies">Cookies</a></p></div></footer>"""


def head(title, desc, path, image, extra_ld):
    url = SITE + path
    img = SITE + image
    ld = "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in extra_ld)
    return f"""<!doctype html><html lang="en-GB"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title><meta name="description" content="{E(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Sourced.">
<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#000000">
<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/media/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap">
<style>{CSS}</style>{ld}</head>"""


def breadcrumb_ld(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + p}
                                for i, (n, p) in enumerate(items)]}


def faq_ld(faqs):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q["q"],
                            "acceptedAnswer": {"@type": "Answer", "text": q["a"]}} for q in faqs]}


def para(text):
    return "".join(f"<p>{E(p)}</p>" for p in text.split("\n\n"))


def cta_block(heading):
    return f"""<section class="cta"><h2>{E(heading)}</h2>
<p>Send one brief with your date, location and what you need. Fill in the form yourself, or talk to Amelia, our AI assistant, and she writes it for you. We come back with one quote for the whole job.</p>
<div class="ctas"><a class="btn" href="/#brief">Send your brief</a><a class="btn ghost" href="/#/talk">Talk to Amelia</a><a class="btn ghost" href="tel:{PHONE_INTL}">Call {PHONE_DISPLAY}</a></div></section>"""


def write(path, doc):
    out = ROOT / path.strip("/") / "index.html" if path != "/" else ROOT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc)


def build_service(s):
    path = f"/{s['slug']}/"
    others = [o for o in SERVICES if o["slug"] != s["slug"]]
    service_ld = {"@context": "https://schema.org", "@type": "Service", "name": s["h1"],
                  "serviceType": s["nav"], "description": s["description"], "url": SITE + path,
                  "areaServed": [{"@type": "City", "name": "London"}, {"@type": "Country", "name": "United Kingdom"}],
                  "provider": {"@type": "ProfessionalService", "name": "Sourced.", "url": SITE + "/",
                               "telephone": PHONE_INTL, "email": EMAIL, "sameAs": ["https://www.instagram.com/sourced_uk/"]}}
    ld = [service_ld, breadcrumb_ld([("Home", "/"), (s["nav"], path)])]
    if s.get("faqs"):
        ld.append(faq_ld(s["faqs"]))
    sections = ""
    for sec in s["sections"]:
        sections += f"<h2>{E(sec['h2'])}</h2>"
        if sec.get("text"):
            sections += f'<div class="prose">{para(sec["text"])}</div>'
        if sec.get("cards"):
            sections += '<div class="grid">' + "".join(
                f'<div class="card"><h3>{E(c["t"])}</h3><p>{E(c["d"])}</p></div>' for c in sec["cards"]) + "</div>"
    gallery = '<div class="gallery">' + "".join(
        f'<img src="{E(g["src"])}" alt="{E(g["alt"])}" loading="lazy" width="800" height="600">' for g in s.get("gallery", [])) + "</div>"
    faqs = ""
    if s.get("faqs"):
        faqs = "<h2>Questions</h2>" + "".join(
            f"<details><summary>{E(q['q'])}</summary><p>{E(q['a'])}</p></details>" for q in s["faqs"])
    related = '<h2>Also sourced</h2><ul class="related">' + "".join(
        f'<li><a href="/{E(o["slug"])}/">{E(o["nav"])}</a></li>' for o in others) + "</ul>"
    doc = head(s["title"], s["description"], path, s["hero"]["src"], ld) + f"""<body>{nav()}
<section class="hero"><img src="{E(s['hero']['src'])}" alt="{E(s['hero']['alt'])}" fetchpriority="high">
<div class="wrap"><p class="crumbs"><a href="/">Home</a> / {E(s['nav'])}</p><p class="kicker">{E(s['kicker'])}</p><h1>{E(s['h1'])}</h1>
<p class="lede">{E(s['lede'])}</p>
<div class="ctas"><a class="btn" href="/#brief">Get a quote</a><a class="btn ghost" href="{E(s['browse'])}">See what's available</a></div></div></section>
<main class="wrap">{sections}{vehicle_links_html(s['slug'])}{gallery}{faqs}{cta_block(s['cta'])}{related}</main>{footer()}</body></html>"""
    write(path, doc)
    return path


def build_guide(g):
    path = f"/guides/{g['slug']}/"
    article = {"@context": "https://schema.org", "@type": "Article", "headline": g["h1"],
               "description": g["description"], "datePublished": g["date"], "dateModified": g.get("updated", g["date"]),
               "image": SITE + g["hero"]["src"], "mainEntityOfPage": SITE + path,
               "author": {"@type": "Organization", "name": "Sourced."},
               "publisher": {"@type": "Organization", "name": "Sourced.", "url": SITE + "/"}}
    ld = [article, breadcrumb_ld([("Home", "/"), ("Guides", "/guides/"), (g["h1"], path)])]
    if g.get("faqs"):
        ld.append(faq_ld(g["faqs"]))
    body = ""
    for sec in g["sections"]:
        body += f"<h2>{E(sec['h2'])}</h2>{para(sec['text'])}"
        if sec.get("bullets"):
            body += "<ul>" + "".join(f"<li>{E(b)}</li>" for b in sec["bullets"]) + "</ul>"
    faqs = ""
    if g.get("faqs"):
        faqs = "<h2>Questions</h2>" + "".join(
            f"<details><summary>{E(q['q'])}</summary><p>{E(q['a'])}</p></details>" for q in g["faqs"])
    links = [o for o in SERVICES if o["slug"] in g.get("services", [])] or SERVICES[:3]
    related = '<h2>Sourced for your shoot</h2><ul class="related">' + "".join(
        f'<li><a href="/{E(o["slug"])}/">{E(o["nav"])}</a></li>' for o in links) + "</ul>"
    date_h = datetime.date.fromisoformat(g["date"]).strftime("%-d %B %Y")
    doc = head(g["title"], g["description"], path, g["hero"]["src"], ld) + f"""<body>{nav()}
<section class="hero" style="background:#000">
<div class="wrap"><p class="crumbs"><a href="/">Home</a> / <a href="/guides/">Guides</a></p><p class="kicker">Guide · {E(date_h)}</p><h1>{E(g['h1'])}</h1>
<p class="lede">{E(g['lede'])}</p></div></section>
<main class="wrap"><article class="prose">{body}{faqs}</article>{related}{cta_block('Planning a shoot?')}</main>{footer()}</body></html>"""
    write(path, doc)
    return path


def build_guides_index():
    path = "/guides/"
    items = "".join(
        f'<a href="/guides/{E(g["slug"])}/"><small>{E(datetime.date.fromisoformat(g["date"]).strftime("%-d %B %Y"))}</small><h3>{E(g["h1"])}</h3><p>{E(g["description"])}</p></a>'
        for g in GUIDES) or "<p>New guides are on the way.</p>"
    hero = {"src": "/media/music-video-set.jpg", "alt": "Music video set sourced by Sourced."}
    desc = "Practical guides to sourcing locations, cars, transport, security and crew for music videos, film, fashion and photo shoots in London."
    doc = head("Shoot Sourcing Guides | Sourced.", desc, path, hero["src"],
               [breadcrumb_ld([("Home", "/"), ("Guides", path)])]) + f"""<body>{nav()}
<section class="hero" style="background:#000"><div class="wrap"><p class="crumbs"><a href="/">Home</a> / Guides</p>
<p class="kicker">Guides</p><h1>Shoot sourcing guides</h1><p class="lede">{E(desc)}</p></div></section>
<main class="wrap"><div class="guides">{items}</div>{cta_block('Got a shoot coming up?')}</main>{footer()}</body></html>"""
    write(path, doc)
    return path


def build_sitemap(paths):
    urls = [("/", "weekly", "1.0")] + [(p, "monthly", "0.8") for p in paths["services"]] + \
           [("/guides/", "weekly", "0.6")] + [(p, "yearly", "0.5") for p in paths["guides"]]
    body = "".join(
        f"  <url>\n    <loc>{SITE}{p}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>{c}</changefreq>\n    <priority>{pr}</priority>\n  </url>\n"
        for p, c, pr in urls)
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "</urlset>\n")


# ---- Vehicle pages: one per model, built from vehicles.json + the home page's own listings ----
import re as _re

def _home_data():
    s = (ROOT / "index.html").read_text()
    gals = json.loads(_re.search(r"const GALS=(\{.*?\});?\n", s).group(1))
    imgs = json.loads(_re.search(r"const IMGS=(\{.*?\});?\n", s).group(1))
    return gals, imgs

VEHICLES = json.loads((SRC / "vehicles.json").read_text()) if (SRC / "vehicles.json").exists() else []


def _img(imgs, key):
    v = imgs.get(key, "")
    return "/" + v if v.startswith("media/") else None


def build_vehicle(v, gals, imgs):
    path = f"/{v['slug']}/"
    parent = next((s for s in SERVICES if s["slug"] == v["parent"]), SERVICES[0])
    items = [gals[g] for g in v["groups"] if g in gals]
    photos = []
    for it in items:
        for k in it["imgs"]:
            src = _img(imgs, k)
            if src and src not in [p for p, _ in photos]:
                photos.append((src, it["name"]))
    hero = photos[0][0]
    cards = "".join(f'<div class="card"><h3>{E(it["name"])}</h3><p>{E(it.get("sub") or it.get("meta") or "")}</p></div>' for it in items)
    gallery = '<div class="gallery">' + "".join(
        f'<img src="{E(src)}" alt="{E(alt)}" loading="lazy" width="800" height="600">' for src, alt in photos[1:9]) + "</div>"
    faqs = "<h2>Questions</h2>" + "".join(
        f"<details><summary>{E(q['q'])}</summary><p>{E(q['a'])}</p></details>" for q in v["faqs"])
    siblings = [o for o in VEHICLES if o["slug"] != v["slug"] and o["parent"] == v["parent"]][:6]
    related = '<h2>Also available</h2><ul class="related">' + "".join(
        f'<li><a href="/{E(o["slug"])}/">{E(o["name"])}</a></li>' for o in siblings) + \
        f'<li><a href="/{E(parent["slug"])}/">All {E(parent["nav"].lower())}</a></li></ul>'
    product = {"@context": "https://schema.org", "@type": "Service", "name": v["h1"], "description": v["description"],
               "url": SITE + path, "image": SITE + hero,
               "areaServed": [{"@type": "City", "name": "London"}, {"@type": "Country", "name": "United Kingdom"}],
               "provider": {"@type": "ProfessionalService", "name": "Sourced.", "url": SITE + "/", "telephone": PHONE_INTL,
                            "email": EMAIL, "sameAs": ["https://www.instagram.com/sourced_uk/"]}}
    ld = [product, breadcrumb_ld([("Home", "/"), (parent["nav"], f"/{parent['slug']}/"), (v["name"], path)]), faq_ld(v["faqs"])]
    doc = head(v["title"], v["description"], path, hero, ld) + f"""<body>{nav()}
<section class="hero"><img src="{E(hero)}" alt="{E(v['name'])}" fetchpriority="high">
<div class="wrap"><p class="crumbs"><a href="/">Home</a> / <a href="/{E(parent['slug'])}/">{E(parent['nav'])}</a> / {E(v['name'])}</p><p class="kicker">{E(parent['nav'])} · London and UK</p><h1>{E(v['h1'])}</h1>
<p class="lede">{E(v['lede'])}</p>
<div class="ctas"><a class="btn" href="/#brief">Get a quote</a><a class="btn ghost" href="{E(parent['browse'])}">See all {E(parent['nav'].lower())}</a></div></div></section>
<main class="wrap"><h2>About the {E(v['name'])}</h2><div class="prose">{para(v['intro'])}</div>
<h2>Available now</h2><div class="grid">{cards}</div>
<h2>Good for</h2><div class="prose"><p>{E(v['good'])}</p></div>
{gallery}{faqs}{cta_block('Want the ' + v['name'] + ' on your shoot?')}{related}</main>{footer()}</body></html>"""
    write(path, doc)
    return path


def vehicle_links_html(service_slug):
    vs = [v for v in VEHICLES if v["parent"] == service_slug]
    if not vs:
        return ""
    return '<h2>Popular picks</h2><ul class="related">' + "".join(
        f'<li><a href="/{E(v["slug"])}/">{E(v["name"])}</a></li>' for v in vs) + "</ul>"


def build_partners():
    path = "/partners/"
    desc = "List your location, cars, transport or services with Sourced. and get booked for music videos, films, fashion shows, photo shoots and events. First 3 months free."
    hero = {"src": "/media/i/m1_pool.jpg", "alt": "Mansion with pool used for shoots"}
    if not (ROOT / hero["src"].lstrip("/")).exists():
        hero["src"] = "/media/mansion-hall.jpg"
    opts = ["Location house or mansion", "Warehouse, studio or venue", "Empty or industrial building", "Supercars or luxury cars",
            "Classic or picture vehicles", "Chauffeur, Sprinter or coach transport", "Security or close protection",
            "Catering", "Trailers, dressing rooms or toilets", "Crew or kit", "Something else"]
    checks = "".join(f'<label class="chk"><input type="checkbox" name="offer" value="{E(o)}"> {E(o)}</label>' for o in opts)
    form = f"""<form id="pf" class="pform" novalidate>
<input type="text" name="hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<div class="row"><label>Your name<input name="name" required autocomplete="name"></label><label>Company<input name="company" autocomplete="organization"></label></div>
<div class="row"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Phone<input name="phone" type="tel" autocomplete="tel"></label></div>
<fieldset><legend>What can you offer?</legend><div class="chks">{checks}</div></fieldset>
<label>Where are you based, and where can you cover?<input name="area" placeholder="e.g. East London, anywhere within the M25"></label>
<label>Website, Instagram or photo links<input name="links" placeholder="Links to your space, fleet or work"></label>
<label>Tell us more<textarea name="details" rows="5" placeholder="Rooms, sizes and features, vehicles and colours, team size, typical rates, anything productions should know"></textarea></label>
<button class="btn" type="submit">Join as a partner</button><p id="pmsg" class="pmsg" role="status"></p></form>
<script>
document.getElementById('pf').addEventListener('submit', async function (ev) {{
  ev.preventDefault();
  var f = ev.target, m = document.getElementById('pmsg');
  var d = Object.fromEntries(new FormData(f).entries());
  d.offer = Array.from(f.querySelectorAll('input[name=offer]:checked')).map(function (i) {{ return i.value; }}).join(', ');
  d.source = 'Partner sign-up'; d.company = d.company || ''; d.categories = 'Partner: ' + (d.offer || 'not specified');
  if (!d.name || !d.email) {{ m.textContent = 'Please add your name and email.'; return; }}
  m.textContent = 'Sending...';
  try {{
    var r = await fetch('/api/enquiry', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(d) }});
    if (!r.ok) throw new Error();
    f.reset(); m.textContent = "Thanks, you're signed up. We'll be in touch to confirm your listing.";
  }} catch (e) {{ m.textContent = 'Something went wrong. Please email sourced.admin@gmail.com instead.'; }}
}});
</script>"""
    css = """<style>.pform{max-width:760px;margin:24px 0}.pform label{display:block;margin:0 0 16px;color:var(--mist);font-size:15px}
.pform input,.pform textarea{display:block;width:100%;margin-top:6px;background:var(--ink);border:1px solid var(--steel);border-radius:10px;color:#fff;font:inherit;padding:12px}
.pform .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:640px){.pform .row{grid-template-columns:1fr}}
.pform fieldset{border:1px solid var(--graphite);border-radius:12px;margin:0 0 16px;padding:14px}.pform legend{color:#fff;padding:0 6px}
.chks{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 16px}.pform .chk{display:flex;gap:8px;align-items:center;margin:4px 0;color:#fff}
.pform .chk input{width:auto;margin:0}.pform button{border:0;cursor:pointer;font-size:16px}.pmsg{color:#fff;min-height:1.5em}
.grid.g2{grid-template-columns:repeat(2,1fr)}@media(max-width:640px){.grid.g2{grid-template-columns:1fr}}</style>"""
    ld = [breadcrumb_ld([("Home", "/"), ("Partners", path)])]
    doc = head("Become a Sourced. Partner | List Your Location, Cars or Services", desc, path, hero["src"], ld) + css + f"""<body>{nav()}
<section class="hero"><img src="{E(hero['src'])}" alt="{E(hero['alt'])}" fetchpriority="high">
<div class="wrap"><p class="crumbs"><a href="/">Home</a> / Partners</p><p class="kicker">Partners · First 3 months free</p><h1>Get booked for shoots and events</h1>
<p class="lede">Own a location, run a fleet or supply anything productions need? Join Sourced. and we'll send you bookings from music videos, films, fashion shows, photo shoots and events.</p>
<div class="ctas"><a class="btn" href="#join">Join now</a></div></div></section>
<main class="wrap"><h2>How it works</h2><div class="grid">
<div class="card"><h3>1. Tell us what you offer</h3><p>A few details and links. It takes two minutes, and your first 3 months are free.</p></div>
<div class="card"><h3>2. We send you matching briefs</h3><p>When a production needs a space, car or service like yours, we bring you the brief.</p></div>
<div class="card"><h3>3. You stay in control</h3><p>You set your rates and availability, and approve every booking.</p></div></div>
<h2 id="homeowners">For homeowners</h2><div class="prose"><p>Thinking about opening your home to shoots for the first time? Here's how we look after it. <a href="/list-your-house-for-filming/">List your house here</a>.</p></div>
<div class="grid">
<div class="card"><h3>You decide everything</h3><p>You set your day rate, choose your dates and approve every booking. You can turn down any shoot you're not comfortable with, with no penalty.</p></div>
<div class="card"><h3>Insured productions only</h3><p>Every production must show us valid public liability insurance before we confirm a booking. A damage deposit can be agreed for every shoot.</p></div>
<div class="card"><h3>Security on site</h3><p>We can put a professional security team on site for the whole booking, so your home is protected from arrival to wrap.</p></div>
<div class="card"><h3>Agreed rules, in writing</h3><p>Rooms that are off limits, crew numbers, parking, start and finish times: everything is agreed and confirmed before anyone arrives.</p></div>
<div class="card"><h3>Protected floors and walls</h3><p>Productions protect floors, doorways and furniture, and any furniture that's moved is put back where it was.</p></div>
<div class="card"><h3>Paid properly</h3><p>Payment terms are agreed up front, so you know exactly what you're getting before the shoot day.</p></div></div>
<h2 id="shoot-day">What happens on shoot day</h2><div class="grid g2">
<div class="card"><h3>1. You're met by a Sourced. agent</h3><p>Your dedicated Sourced. agent arrives before the crew, walks the house with you and confirms the rules for the day.</p></div>
<div class="card"><h3>2. We run the whole booking</h3><p>Your agent manages the production from start to finish: arrivals, parking, crew, deliveries and timings. You don't have to do anything, and you're welcome to stay or head out for the day.</p></div>
<div class="card"><h3>3. Your home is protected throughout</h3><p>Your agent checks floor and wall protection, keeps the crew to the agreed areas and deals with any questions so they never land on you.</p></div>
<div class="card"><h3>4. Returned exactly as we received it</h3><p>At wrap, your agent does a full walkthrough with you. Your location is returned exactly how it was received, and anything that isn't right is put right.</p></div></div>
<h2>Who we work with</h2><div class="prose"><p>Location houses and mansions, warehouses, studios, venues and industrial spaces; supercar, classic and picture car owners; chauffeur, Sprinter, coach and jet operators; security and close protection teams; caterers; trailer, dressing room and toilet hire; crews and kit houses.</p></div>
<h2 id="join">Join as a partner</h2>{form}</main>{footer()}</body></html>"""
    write(path, doc)
    return path


def build_list_house():
    path = "/list-your-house-for-filming/"
    title = "List Your House for Filming & Photoshoots | Sourced."
    desc = "Earn from your home. List your house with Sourced. for music videos, fashion shoots, adverts and films. You set the rate and approve every booking. First 3 months free."
    hero = {"src": "/media/i/m1_pool.jpg", "alt": "Modern house with pool used for a shoot"}
    if not (ROOT / hero["src"].lstrip("/")).exists():
        hero["src"] = "/media/mansion-hall.jpg"
    looks = [("Modern and glass houses", "Clean lines, big windows and open-plan living for fashion, beauty and adverts."),
             ("Mansions and gated homes", "Grand entrances, driveways and big rooms for music videos and luxury shoots."),
             ("Pools and big gardens", "Pools, hot tubs, terraces and lawns are some of the most requested features."),
             ("Period and country houses", "Georgian, Victorian and Tudor homes with character for drama and editorial."),
             ("Townhouses and apartments", "Stylish London homes with great light, staircases and kitchens."),
             ("Barns, farms and unusual homes", "Converted barns, cottages and one-off architecture for something different.")]
    look_html = "".join(f'<div class="card"><h3>{E(t)}</h3><p>{E(d)}</p></div>' for t, d in looks)
    gal = [("m1_hall", "Hallway of a location house"), ("glass_pool", "Glass house with pool"), ("redbrick_front", "Red brick house frontage"),
           ("sunset_living", "Living room in a location house"), ("stone_new_pool", "Stone house with pool"), ("m2_stairs", "Grand staircase")]
    gal_html = "".join(f'<img src="/media/i/{k}.jpg" alt="{E(a)}" loading="lazy">' for k, a in gal if (ROOT / "media" / "i" / f"{k}.jpg").exists())
    feats = ["Swimming pool or hot tub", "Large garden or grounds", "Gated driveway and parking", "Big kitchen", "Grand staircase or hallway",
             "Period features", "Modern or glass architecture", "Cinema or games room", "Gym or spa", "Rooftop or terrace"]
    checks = "".join(f'<label class="chk"><input type="checkbox" name="feat" value="{E(o)}"> {E(o)}</label>' for o in feats)
    faqs = [
        {"q": "What does it cost to list my house?", "a": "Your first 3 months are completely free. After that it's £124.99 a month to keep your home listed and actively promoted to production companies, paid by direct debit with one month's notice to cancel. You keep 100% of your location fee. Our commission is charged to the production on top, and we're always transparent about it."},
        {"q": "How much can I earn?", "a": "You set your own day rate. What a shoot pays depends on the size of the shoot, how long they need the house and which rooms they use. We'll talk you through what similar homes charge when we set up your listing."},
        {"q": "Do I have to be at home on the shoot day?", "a": "No. A Sourced. agent meets you before the crew arrives, walks the house with you and runs the booking from start to finish. You're welcome to stay or head out for the day."},
        {"q": "What if something gets damaged?", "a": "Every production must show us valid public liability insurance before we confirm a booking, and a damage deposit can be agreed for every shoot. Floors, doorways and furniture are protected, and your home is returned exactly as we received it. It's also worth letting your home insurer know you're hosting shoots."},
        {"q": "Can I say no to a shoot?", "a": "Yes. You approve every booking, and you can turn down any shoot you're not comfortable with, with no penalty. Rooms that are off limits, crew numbers, parking and timings are all agreed in writing before anyone arrives."},
        {"q": "What kind of shoots will I get?", "a": "Music videos, fashion and beauty shoots, adverts, brand content, films, TV and photography. We tell you what the shoot is before you agree to it."},
    ]
    faq_html = "".join(f'<details><summary>{E(f["q"])}</summary><p>{E(f["a"])}</p></details>' for f in faqs)
    form = """<form id="hf" class="pform" novalidate>
<input type="text" name="hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<div class="row"><label>Your name<input name="name" required autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label></div>
<div class="row"><label>Phone<input name="phone" type="tel" autocomplete="tel"></label><label>Town and postcode<input name="area" placeholder="e.g. Chigwell, IG7"></label></div>
<label>Type of home<select name="ptype"><option>Detached house</option><option>Mansion or gated home</option><option>Modern or glass house</option><option>Period or country house</option><option>Townhouse</option><option>Apartment or penthouse</option><option>Barn, farm or cottage</option><option>Something else</option></select></label>
<fieldset><legend>Standout features</legend><div class="chks">""" + checks + """</div></fieldset>
<label>Photo links<input name="links" placeholder="Instagram, Google Drive, Dropbox or an estate agent listing"></label>
<label>Tell us about your home<textarea name="details" rows="5" placeholder="Bedrooms, best rooms, parking, any rooms that are off limits, when it's usually free"></textarea></label>
<button class="btn" type="submit">List my house</button><p id="hmsg" class="pmsg" role="status"></p></form>
<script>
document.getElementById('hf').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var f = ev.target, m = document.getElementById('hmsg');
  var d = Object.fromEntries(new FormData(f).entries());
  if (!d.name || !d.email) { m.textContent = 'Please add your name and email.'; return; }
  var feats = Array.from(f.querySelectorAll('input[name=feat]:checked')).map(function (i) { return i.value; }).join(', ');
  d.offer = 'Location house or mansion'; d.source = 'Partner sign-up (homeowner)'; d.company = '';
  d.categories = 'Partner: Location house or mansion';
  d.details = 'Type: ' + (d.ptype || '') + (feats ? '\\nFeatures: ' + feats : '') + (d.details ? '\\n\\n' + d.details : '');
  delete d.ptype; delete d.feat;
  m.textContent = 'Sending...';
  try {
    var r = await fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    if (!r.ok) throw new Error();
    f.reset(); m.textContent = "Thanks, your house is in. We'll be in touch to set up your listing.";
  } catch (e) { m.textContent = 'Something went wrong. Please email sourced.admin@gmail.com instead.'; }
});
</script>"""
    css = """<style>.pform{max-width:760px;margin:24px 0}.pform label{display:block;margin:0 0 16px;color:var(--mist);font-size:15px}
.pform input,.pform textarea,.pform select{display:block;width:100%;margin-top:6px;background:var(--ink);border:1px solid var(--steel);border-radius:10px;color:#fff;font:inherit;padding:12px}
.pform .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:640px){.pform .row{grid-template-columns:1fr}}
.pform fieldset{border:1px solid var(--graphite);border-radius:12px;margin:0 0 16px;padding:14px}.pform legend{color:#fff;padding:0 6px}
.chks{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 16px}.pform .chk{display:flex;gap:8px;align-items:center;margin:4px 0;color:#fff}
.pform .chk input{width:auto;margin:0}.pform button{border:0;cursor:pointer;font-size:16px}.pmsg{color:#fff;min-height:1.5em}
.grid.g2{grid-template-columns:repeat(2,1fr)}@media(max-width:640px){.grid.g2{grid-template-columns:1fr}}</style>"""
    ld = [breadcrumb_ld([("Home", "/"), ("List your house", path)]), faq_ld(faqs)]
    doc = head(title, desc, path, hero["src"], ld) + css + f"""<body>{nav()}
<section class="hero"><img src="{E(hero['src'])}" alt="{E(hero['alt'])}" fetchpriority="high">
<div class="wrap"><p class="crumbs"><a href="/">Home</a> / List your house</p><p class="kicker">For homeowners · First 3 months free</p><h1>Earn from your home. List it for filming.</h1>
<p class="lede">Music videos, fashion shoots, adverts and films need real homes. List your house with Sourced. and we'll bring you vetted productions, run every booking and return your home exactly as we found it.</p>
<div class="ctas"><a class="btn" href="#list">List my house</a><a class="btn ghost" href="#faq">Questions</a></div></div></section>
<main class="wrap"><h2>How it works</h2><div class="grid">
<div class="card"><h3>1. Tell us about your home</h3><p>A few details and some photos. It takes two minutes.</p></div>
<div class="card"><h3>2. We list and promote it</h3><p>We put your home in front of production companies, directors and artists' teams.</p></div>
<div class="card"><h3>3. You approve every booking</h3><p>You set your day rate and your dates, and say yes or no to each shoot.</p></div>
<div class="card"><h3>4. Get paid</h3><p>You keep 100% of your location fee. Payment terms are agreed before the shoot day.</p></div></div>
<h2>Homes productions are looking for</h2><div class="grid">{look_html}</div>
<div class="gallery">{gal_html}</div>
<h2>Your home is protected</h2><div class="grid">
<div class="card"><h3>Insured productions only</h3><p>Every production must show us valid public liability insurance before we confirm a booking. A damage deposit can be agreed for every shoot.</p></div>
<div class="card"><h3>Agreed rules, in writing</h3><p>Rooms that are off limits, crew numbers, parking, start and finish times: everything is confirmed before anyone arrives.</p></div>
<div class="card"><h3>Security on site</h3><p>We can put a professional security team on site for the whole booking, from arrival to wrap.</p></div>
<div class="card"><h3>Protected floors and walls</h3><p>Floors, doorways and furniture are protected, and anything that's moved is put back where it was.</p></div></div>
<h2>What happens on shoot day</h2><div class="grid g2">
<div class="card"><h3>You're met by a Sourced. agent</h3><p>Your agent arrives before the crew, walks the house with you and confirms the rules for the day.</p></div>
<div class="card"><h3>Returned exactly as we received it</h3><p>At wrap, your agent does a full walkthrough with you, and anything that isn't right is put right.</p></div></div>
<h2 id="faq">Questions homeowners ask</h2>{faq_html}
<h2 id="list">List your house</h2>{form}
<div class="prose"><p>Run a venue, fleet or production service instead? <a href="/partners/">Join as a partner</a>.</p></div>
</main>{footer()}</body></html>"""
    write(path, doc)
    return path


def build_scouting(gals, imgs):
    path = "/location-scouting/"
    desc = "Location scouting and venue sourcing for music videos, films, fashion and photo shoots. Shortlists in 48 hours, bookings handled, on-site recces. Mansions, Art Deco, brutalist, industrial, period and unique spaces across London and the UK."
    hero_src = _img(imgs, "m1_pool") or "/media/mansion-hall.jpg"
    tiers = [
        ("Shortlist", "A bespoke search for your brief.", ["6 to 10 locations that fit your look, budget and dates", "Photos, rates and availability in one deck", "Turned around in 48 hours, faster for urgent shoots"]),
        ("Shortlist and bookings", "Everything in Shortlist, and we do the legwork.", ["We contact the owners and hold your dates", "Rates negotiated for you", "Permits, parking and filming clearance sorted"]),
        ("Full recce", "Everything in Shortlist and bookings, plus feet on the ground.", ["We visit your top locations in person", "Recce report per location: power, access, parking, noise, light and unit base", "Photos and video walkthroughs for your director and DOP"]),
    ]
    tier_html = "".join(f'<div class="card"><h3>{E(t)}</h3><p>{E(d)}</p><ul class="tl">' + "".join(f"<li>{E(b)}</li>" for b in bl) + f'</ul><a class="btn ghost sbtn" href="#scout" data-tier="{E(t)}">Enquire about {E(t.lower())}</a></div>' for t, d, bl in tiers)
    styles = ["Modern and glass houses", "Mansions and gated homes", "Period and stately homes", "Art Deco", "Brutalist and concrete", "Industrial and warehouses", "Retro and mid-century", "Americana and diners", "Gothic and dark", "Unique: forts, bunkers, tunnels"]
    chips = "".join(f'<button type="button" class="chip" data-style="{E(x)}">{E(x)}</button>' for x in styles)
    props = [(k, g) for k, g in gals.items() if g.get("tab") == "properties"][:6]
    cards = ""
    for k, g in props:
        src = _img(imgs, g["imgs"][0])
        if src:
            cards += f'<a class="pcard" href="/#/item/{E(k)}"><img src="{E(src)}" alt="{E(g["name"])}" loading="lazy"><span><strong>{E(g["name"])}</strong><small>{E(g.get("loc") or g.get("sub") or "")}</small></span></a>'
    form = """<form id="sf" class="pform" novalidate>
<input type="text" name="hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<div class="row"><label>Your name<input name="name" required autocomplete="name"></label><label>Company or artist<input name="company" autocomplete="organization"></label></div>
<div class="row"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Phone<input name="phone" type="tel" autocomplete="tel"></label></div>
<div class="row"><label>Shoot dates<input name="date" placeholder="e.g. 14 to 15 March"></label><label>Where?<input name="location" placeholder="e.g. London, within the M25, anywhere in the UK"></label></div>
<div class="row"><label>Service<select name="tier"><option>Shortlist</option><option>Shortlist and bookings</option><option>Full recce</option><option>Not sure yet</option></select></label><label>Look or style<input name="style" id="sstyle" placeholder="e.g. Art Deco, brutalist, mansion with pool"></label></div>
<label>Tell us about the shoot<textarea name="details" rows="5" placeholder="Type of shoot, crew size, rooms or features you need, budget, references"></textarea></label>
<button class="btn" type="submit">Send scouting request</button><p id="smsg" class="pmsg" role="status"></p></form>
<script>
document.querySelectorAll('.chip').forEach(function(c){c.addEventListener('click',function(){c.classList.toggle('on');var v=Array.from(document.querySelectorAll('.chip.on')).map(function(x){return x.dataset.style;}).join(', ');document.getElementById('sstyle').value=v;});});
document.querySelectorAll('.sbtn').forEach(function(b){b.addEventListener('click',function(){var s=document.querySelector('#sf select[name=tier]');if(s)s.value=b.dataset.tier;});});
document.getElementById('sf').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var f = ev.target, m = document.getElementById('smsg');
  var d = Object.fromEntries(new FormData(f).entries());
  if (!d.name || !d.email) { m.textContent = 'Please add your name and email.'; return; }
  d.source = 'Location scouting'; d.categories = 'Properties';
  d.summary = 'Location scouting: ' + (d.tier || '') + (d.style ? ' | Style: ' + d.style : '');
  delete d.tier; delete d.style;
  m.textContent = 'Sending...';
  try {
    var r = await fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    if (!r.ok) throw new Error();
    f.reset(); document.querySelectorAll('.chip.on').forEach(function(c){c.classList.remove('on');});
    m.textContent = "Thanks, we've got it. We'll come back to you with options.";
  } catch (e) { m.textContent = 'Something went wrong. Please email sourced.admin@gmail.com instead.'; }
});
</script>"""
    css = """<style>.pform{max-width:860px;margin:24px 0}.pform label{display:block;margin:0 0 16px;color:var(--mist);font-size:15px}
.pform input,.pform textarea,.pform select{display:block;width:100%;margin-top:6px;background:var(--ink);border:1px solid var(--steel);border-radius:10px;color:#fff;font:inherit;padding:12px}
.pform .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:640px){.pform .row{grid-template-columns:1fr}}
.pform button{border:0;cursor:pointer;font-size:16px}.pmsg{color:#fff;min-height:1.5em}
.tl{margin:12px 0 18px;padding-left:18px}.tl li{font-size:15px;margin:4px 0}.card .btn{font-size:14px;padding:10px 16px}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.chip{background:transparent;color:#fff;border:1px solid var(--steel);border-radius:999px;padding:9px 16px;font:inherit;font-size:14px;cursor:pointer}.chip.on{background:#fff;color:#000;border-color:#fff}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin:20px 0}.pcard{display:block;text-decoration:none;background:var(--ink);border:1px solid var(--graphite);border-radius:14px;overflow:hidden}
.pcard img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}.pcard span{display:block;padding:12px 14px}.pcard small{display:block;color:var(--ash);font-size:13px;margin-top:2px}</style>"""
    ld = [breadcrumb_ld([("Home", "/"), ("Location scouting", path)]),
          {"@context": "https://schema.org", "@type": "Service", "name": "Location scouting and venue sourcing", "serviceType": "Location scouting",
           "areaServed": "United Kingdom", "provider": {"@type": "ProfessionalService", "name": "Sourced.", "url": SITE + "/", "telephone": PHONE_INTL, "email": EMAIL}}]
    doc = head("Location Scouting & Venue Sourcing UK | Sourced.", desc, path, hero_src, ld) + css + f"""<body>{nav()}
<section class="hero"><img src="{E(hero_src)}" alt="Modern house with pool used as a shoot location" fetchpriority="high">
<div class="wrap"><p class="crumbs"><a href="/">Home</a> / Location scouting</p><p class="kicker">Location scouting · Venue sourcing</p><h1>Find the location nobody else has</h1>
<p class="lede">Tell us the look. We find it, book it and get you cleared to shoot. Mansions, Art Deco blocks, brutalist estates, warehouses, period houses and the strange, specific places that never show up on public listings.</p>
<div class="ctas"><a class="btn" href="#scout">Start a search</a><a class="btn ghost" href="/location-houses-london/">See our locations</a></div></div></section>
<main class="wrap"><h2>How we scout</h2><div class="grid">{tier_html}</div>
<h2>Browse by look</h2><div class="prose"><p>Pick the looks you're after and we'll build your shortlist around them. Our team has access to private homes, heritage sites, venues and industrial spaces across London, the Home Counties and the rest of the UK.</p></div>
<div class="chips">{chips}</div>
<h2>From our locations</h2><div class="pgrid">{cards}</div>
<h2 id="scout">Start a scouting request</h2>{form}
<h2>Own a location?</h2><div class="prose"><p>If you own a house, <a href="/list-your-house-for-filming/">list it for filming</a>. If you run a venue or building that hires out, <a href="/partners/">list it with Sourced.</a> Your first 3 months are free.</p></div>
</main>{footer()}</body></html>"""
    write(path, doc)
    return path


def build_privacy():
    path = "/privacy/"
    title = "Privacy, GDPR and Cookie Policy | Sourced."
    desc = "How Sourced. collects, uses and protects your personal data under UK GDPR, your rights, and the cookies our website uses."
    sections = [
        ("Who we are", f"SOURCED. is a London production sourcing service run by Benjamin Peagam (trading as Benji), Director of SOURCED. He is the data controller for the personal data described here. You can contact us about anything in this policy at {EMAIL} or {PHONE_DISPLAY}."),
        ("What we collect", "When you send a brief or talk to Amelia, our AI assistant: your name, email, phone number, company, and the details of your shoot or event (dates, locations, budget and what you need).\n\nWhen you join as a partner or list your house: your name and business details, contact details, the address of your location or service, photos, and your rates.\n\nWhen we contact businesses about working with us: business names and work contact details that the business has published, such as a general enquiries email address.\n\nWhen you email, call or message us: the content of those messages so we can reply and keep a record of your booking."),
        ("How we use it and our lawful basis", "We use your data to reply to you, prepare quotes, arrange and manage bookings, list and promote partners, and handle payments. When this is part of a booking or a partner agreement, the lawful basis is contract. When we contact businesses about our services or follow up an enquiry, the basis is our legitimate interests in running and growing SOURCED., and every outreach email lets you opt out. Where we need your consent, for example to feature your photos or location publicly, we ask first, and you can withdraw consent at any time."),
        ("Who we share it with", "We only share what is needed to deliver your booking. For example, we pass a production's shoot details to the location, vehicle or security partner they've booked, and a partner's details to the client who has booked them. We also use trusted service providers to run SOURCED.: Vercel (website hosting and storage), Resend (email delivery), ElevenLabs (the Amelia voice assistant), Google (email and website fonts) and Meta (WhatsApp, if you message us there). Some of these providers are based outside the UK. Where that happens, your data is protected by UK-approved safeguards such as standard contractual clauses. We never sell your data."),
        ("How long we keep it", "We keep booking and quote records for up to 6 years for accounting and legal reasons. We keep enquiries that don't become bookings, and outreach contact details, for up to 2 years, unless you ask us to delete them sooner. If you ask us not to contact you, we keep only your email address on a do-not-contact list so we can make sure we never email you again."),
        ("Your rights under UK GDPR", f"You have the right to access the personal data we hold about you, to have it corrected, to have it deleted, to restrict or object to how we use it (including for marketing), and to receive a copy of it in a portable format. To use any of these rights, email {EMAIL}. We'll reply within one month. You can stop marketing emails at any time by replying \"remove\"."),
        ("Complaints", "If you're unhappy with how we've handled your data, please contact us first so we can put it right. You also have the right to complain to the Information Commissioner's Office (ICO) at ico.org.uk or on 0303 123 1113."),
        ("Keeping your data safe", "Your data is stored with secure, access-controlled providers. Only the SOURCED. team can see your details, and only for the purposes set out in this policy."),
    ]
    cookies = [
        ("Cookies", "Cookies are small files a website stores on your device. Our website only uses cookies and similar browser storage that are strictly necessary for it to work. We don't use advertising cookies, and we don't use tracking or analytics cookies to follow you around the web."),
        ("What we use", "Our staff hub uses a secure login cookie so our team can stay signed in. It isn't set for visitors. If you use Amelia, our AI voice assistant, the ElevenLabs service may store small amounts of data in your browser so the conversation works. Our pages load fonts from Google Fonts, which means Google receives your IP address to deliver them, but no cookies are set for this."),
        ("Managing cookies", "Because we only use necessary cookies, we don't show a cookie banner. You can block or delete cookies at any time in your browser settings, although parts of the site, such as the voice assistant, may not work properly. If we ever add non-essential cookies, we'll ask for your consent first and update this page."),
    ]
    sec_html = "".join(f"<h2>{E(h)}</h2><div class=\"prose\">{para(t)}</div>" for h, t in sections)
    ck_html = "".join((f"<h2 id=\"cookies\">{E(h)}</h2>" if i == 0 else f"<h3>{E(h)}</h3>") + f"<div class=\"prose\">{para(t)}</div>" for i, (h, t) in enumerate(cookies))
    ld = [breadcrumb_ld([("Home", "/"), ("Privacy policy", path)])]
    doc = head(title, desc, path, "/media/icon-512.png", ld) + f"""<body>{nav()}
<main class="wrap" style="padding-top:40px;padding-bottom:60px"><p class="crumbs"><a href="/">Home</a> / Privacy policy</p>
<h1>Privacy, GDPR and cookie policy</h1>
<div class="prose"><p>This policy explains how SOURCED. collects, uses and protects your personal data, in line with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018, and how our website uses cookies. Last updated {E(datetime.date.today().strftime('%-d %B %Y'))}.</p></div>
{sec_html}{ck_html}
<h2>Changes to this policy</h2><div class="prose"><p>We may update this policy from time to time. The latest version will always be on this page.</p></div>
</main>{footer()}</body></html>"""
    write(path, doc)
    return path


if __name__ == "__main__":
    _g, _i = _home_data()
    paths = {"services": [build_service(s) for s in SERVICES] + [build_vehicle(v, _g, _i) for v in VEHICLES], "guides": [build_guide(g) for g in GUIDES]}
    build_guides_index()
    paths["services"].append(build_partners())
    paths["services"].append(build_list_house())
    paths["services"].append(build_scouting(_g, _i))
    paths["services"].append(build_privacy())
    build_sitemap(paths)
    print(f"Built {len(paths['services'])} service pages, {len(paths['guides'])} guides, sitemap.xml")
