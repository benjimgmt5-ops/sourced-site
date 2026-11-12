// Shared sign-off and legal footer for every email Sourced. sends to clients, partners and leads.
// Plain-text and HTML versions. Old sign-offs in queued emails are stripped and replaced at send time.
const SITE = 'https://www.wearesourced.co.uk';
const EMAIL = 'sourced.admin@gmail.com';
const PHONE = '07590 474421';
const PRIVACY = SITE + '/privacy/';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Removes any existing sign-off at the end of a message (e.g. "Best,\n\nBenji\nSourced. ...").
export function stripSignoff(text) {
  return String(text || '')
    .replace(/\n+(?:(?:Best|Thanks|Many thanks|Kind regards|Cheers|Regards|Best wishes),?\n+)?Benji\b[\s\S]*$/, '')
    .replace(/\n+Sourced\.\nSee it\. Say it\. Sourced\.\s*$/, '')
    .replace(/\s+$/, '');
}

const SIGN = ['Kind regards,', '', 'Benjamin Peagam T/A Benji', 'Director, SOURCED.', `Email: ${EMAIL}`, `Phone: ${PHONE}`, 'Web: www.wearesourced.co.uk', 'Instagram: @sourced_uk', 'See it. Say it. Sourced.'];

const LEGAL = [
  'Confidentiality: This email and any attachments are confidential and meant only for the person they are addressed to. If you have received it by mistake, please tell us and delete it.',
  `Privacy and GDPR: SOURCED. is run by Benjamin Peagam, who controls the personal data we hold. We keep your name and contact details only to talk to you about shoots, bookings and partnerships, as allowed under UK GDPR and the Data Protection Act 2018. We never sell your data. You can ask to see, correct or delete it at any time by emailing ${EMAIL}. Read our full privacy policy: ${PRIVACY}`,
  `Cookies: Our website only uses cookies that are needed for it to work. We don't use advertising or tracking cookies. More in our cookie policy: ${PRIVACY}#cookies`
];
const UNSUB = `If you'd rather not hear from us, just reply "remove" and we won't contact you again.`;

export function footerText({ unsub = false } = {}) {
  return '\n\n' + SIGN.join('\n') + '\n\n—\n' + LEGAL.join('\n\n') + (unsub ? '\n\n' + UNSUB : '');
}

export function footerHtml({ unsub = false } = {}) {
  const small = 'font-family:Arial,sans-serif;font-size:11px;line-height:1.5;color:#777;margin:0 0 8px';
  const link = 'color:#555;text-decoration:underline';
  const legal = LEGAL.map(p => esc(p)
    .replace('More in our cookie policy: ' + PRIVACY + '#cookies', `More in our <a href="${PRIVACY}#cookies" style="${link}">cookie policy</a>.`)
    .replace('Read our full privacy policy: ' + PRIVACY, `Read our full <a href="${PRIVACY}" style="${link}">privacy policy</a>.`)
    .replace(/^(\w[\w ]*?):/, '<b>$1:</b>'));
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;margin-top:18px;font-family:Arial,sans-serif">`
    + `<tr><td style="font-size:15px;line-height:1.5;color:#000;padding:0 0 14px">Kind regards,</td></tr>`
    + `<tr><td style="border-left:3px solid #000;padding:2px 0 2px 14px">`
    + `<img src="${SITE}/media/email/sourced-logo-black.png" width="110" alt="SOURCED." style="display:block;margin:0 0 8px;border:0">`
    + `<p style="margin:0;font-size:15px;font-weight:bold;color:#000">Benjamin Peagam T/A Benji</p>`
    + `<p style="margin:0 0 6px;font-size:13px;color:#555">Director, SOURCED.</p>`
    + `<p style="margin:0;font-size:13px;line-height:1.6;color:#000">`
    + `Email: <a href="mailto:${EMAIL}" style="color:#000">${EMAIL}</a><br>`
    + `Phone: <a href="tel:+447590474421" style="color:#000">${PHONE}</a><br>`
    + `Web: <a href="${SITE}" style="color:#000">www.wearesourced.co.uk</a><br>`
    + `Instagram: <a href="https://www.instagram.com/sourced_uk/" style="color:#000">@sourced_uk</a></p>`
    + `<p style="margin:6px 0 0;font-size:12px;color:#777;font-style:italic">See it. Say it. Sourced.</p></td></tr>`
    + `<tr><td style="padding:22px 0 0;border-bottom:1px solid #e5e5e5"></td></tr>`
    + `<tr><td style="padding:14px 0 0">` + legal.map(p => `<p style="${small}">${p}</p>`).join('')
    + (unsub ? `<p style="${small}">${esc(UNSUB)}</p>` : '') + `</td></tr>`
    + `<tr><td align="center" style="padding:18px 0 4px"><img src="${SITE}/media/email/sourced-logo-watermark-v2.png" width="190" alt="" style="display:block;margin:0 auto;border:0"></td></tr>`
    + `</table>`;
}

// Takes a full message (body + any old sign-off) and returns { text, html } with the new footer.
export function finish(text, bodyHtml, opts = {}) {
  const body = stripSignoff(text);
  return { text: body + footerText(opts), html: bodyHtml(body).replace(/<\/div>\s*$/, footerHtml(opts) + '</div>') };
}
