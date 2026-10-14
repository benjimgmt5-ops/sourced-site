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
<div><strong style="color:#fff">Services</strong><br>{svc}</div>
<div><strong style="color:#fff">Contact</strong><br><a href="mailto:{EMAIL}">{EMAIL}</a><br><a href="tel:{PHONE_INTL}">{PHONE_DISPLAY}</a><br><a href="https://www.instagram.com/sourced_uk/" target="_blank" rel="noopener">Instagram</a><br><a href="/guides/">Guides</a></div>
</div><div class="wrap"><p>© {datetime.date.today().year} Sourced.</p></div></footer>"""


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
<main class="wrap">{sections}{gallery}{faqs}{cta_block(s['cta'])}{related}</main>{footer()}</body></html>"""
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
<section class="hero"><img src="{E(g['hero']['src'])}" alt="{E(g['hero']['alt'])}" fetchpriority="high">
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
<section class="hero"><img src="{hero['src']}" alt="{hero['alt']}"><div class="wrap"><p class="crumbs"><a href="/">Home</a> / Guides</p>
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


if __name__ == "__main__":
    paths = {"services": [build_service(s) for s in SERVICES], "guides": [build_guide(g) for g in GUIDES]}
    build_guides_index()
    build_sitemap(paths)
    print(f"Built {len(paths['services'])} service pages, {len(paths['guides'])} guides, sitemap.xml")
