import { finish } from './_footer.js';
// Benji's onboarding email for new suppliers (partner sign-ups). Used on sign-up (api/enquiry.js)
// and by the hourly job (api/deals.js) for sign-ups that haven't had it yet.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function partnerEmail(e) {
  const f = (e.name || '').trim().split(/\s+/)[0];
  const text = [
    `Hi ${f || 'there'},`,
    `We'd love to have you onboard with SOURCED.`,
    `As we're currently building our inventory, we're offering new partners their first 3 months hosted on our platform completely free. During this time we'll be ramping up our marketing through SEO and social media to drive more contractors and companies to your listing.`,
    `How it works after the trial:`,
    `• A monthly fee of £124.99 to host your listing and proactively promote your business to contractors and production companies.\n• You keep 100% of your booking fee – we never take a cut of what you charge.\n• Our commission (15–35%, depending on the complexity and needs of the job) is charged to the client on top, and we're always fully transparent about it.`,
    `If you're happy after the 3 months, we'll simply set up a monthly direct debit.`,
    `We want this to work for you. If you're ever not happy with the service, we're always open to renegotiating terms or offering a breathing period. Once the direct debit is in place, we just ask for one month's notice to cancel.`,
    `To get you listed, all we need is:`,
    `• Photos of the product / vehicle / location\n• Location address\n• A title for the service you're offering\n• Your hourly / day rate`,
    `Just reply to this email with the above and we'll get you live.`,
    `Thanks,`,
    `Benji\nSOURCED.`
  ].join('\n\n');
  const wrap = t => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#000;max-width:560px"><p style="font-size:26px;font-weight:bold;margin:0 0 20px">Sourced.</p>`
    + t.split('\n\n').map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') + `</div>`;
  return { subject: 'Join SOURCED. – 3 months free hosting', ...finish(text, wrap) };
}
