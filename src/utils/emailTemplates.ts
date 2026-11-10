/**
 * Ready-made HTML emails for the Communication tab. Each one is plain, editable email HTML: tables and inline styles (what mail apps
 * understand), a bgcolor on every coloured block (so Apple Mail dark mode keeps them light), the NikFoods logo as `cid:nikfoods-logo`
 * (the site attaches it when the HTML uses it) and {firstName}. Admins pick one, change the words, and send.
 */

export const APP_STORE_URL = 'https://apps.apple.com/app/id6767141830';
export const SITE_URL = 'https://www.nikfoods.com';
const SUPPORT = 'support@nikfoods.com';

const C = { page: '#F3EBDD', card: '#FFFBF5', line: '#EADBC3', text: '#2B1D0E', body: '#54442F', muted: '#76664F', brand: '#F89C35', brandText: '#A85A00', strip: '#1E1409', cream: '#F6D58E', tile: '#FFF1DC' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const css = `
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  a { text-decoration:none; }
  @media only screen and (max-width: 620px) {
    .wrap { width:100% !important; border-radius:0 !important; }
    .px { padding-left:22px !important; padding-right:22px !important; }
    .hero { font-size:31px !important; line-height:37px !important; }
    .outer { padding:0 !important; }
    .stack { display:block !important; width:100% !important; }
    .gap { display:block !important; height:12px !important; }
  }`;

const button = (label: string, href: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td bgcolor="${C.brand}" style="background:${C.brand};border-radius:999px;"><a href="${href}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:16px;font-weight:800;color:#1A1106;">${label}</a></td></tr></table>`;

const strip = `<tr><td align="center" bgcolor="${C.strip}" style="padding:16px 32px;background:${C.strip};"><img src="cid:nikfoods-logo" alt="NikFoods" width="150" style="display:block;border:0;width:150px;height:auto;max-width:100%;margin:0 auto;font-family:Arial,sans-serif;font-size:26px;font-weight:800;color:${C.cream};"></td></tr>`;

const footer = (note: string) =>
  `<tr><td class="px" bgcolor="${C.card}" style="padding:8px 32px 24px;background:${C.card};"><div style="border-top:1px solid ${C.line};padding-top:14px;font-family:${FONT};font-size:13px;line-height:19px;color:${C.muted};text-align:center;">${note}<br>Questions? Write to <a href="mailto:${SUPPORT}" style="color:${C.brandText};font-weight:700;">${SUPPORT}</a>.<br><a href="{unsubscribeUrl}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a></div></td></tr>`;

function shell(title: string, preheader: string, rows: string): string {
  return `<!DOCTYPE html>
<html lang="en" style="color-scheme:light dark;supported-color-schemes:light dark;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${title}</title>
<style>${css}
</style>
</head>
<body bgcolor="${C.page}" style="margin:0;padding:0;background:${C.page};font-family:${FONT};color:${C.text};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" style="background:${C.page};">
<tr><td class="outer" align="center" style="padding:16px 12px;">
<table role="presentation" class="wrap" width="640" cellpadding="0" cellspacing="0" bgcolor="${C.card}" style="width:640px;max-width:640px;background:${C.card};border-radius:24px;overflow:hidden;border:1px solid ${C.line};border-collapse:separate;">
  <tr><td height="5" bgcolor="${C.brand}" style="height:5px;line-height:5px;font-size:1px;background:${C.brand};">&nbsp;</td></tr>
  ${strip}
${rows}
</table>
</td></tr>
</table>
</body>
</html>
`;
}

/** The dark hero block: small orange tag, big cream headline, one sentence. */
const hero = (tag: string, headline: string, sentence: string) =>
  `  <tr><td class="px" align="center" bgcolor="${C.strip}" style="padding:10px 40px 38px;background:${C.strip};">
    <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td bgcolor="${C.brand}" style="background:${C.brand};border-radius:999px;padding:5px 14px;font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:0.14em;color:#1A1106;">${tag}</td></tr></table>
    <div class="hero" style="font-family:${FONT};font-size:38px;line-height:44px;font-weight:800;color:${C.cream};margin:18px 0 12px;">${headline}</div>
    <div style="font-family:${FONT};font-size:17px;line-height:26px;color:#E9DCC4;">${sentence}</div>
  </td></tr>`;

const feature = (n: string, title: string, text: string) =>
  `<tr><td style="padding:0 0 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.tile}" style="background:${C.tile};border-radius:16px;border-collapse:separate;"><tr>
      <td width="64" valign="top" style="padding:16px 0 16px 16px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="40" height="40" align="center" bgcolor="${C.brand}" style="width:40px;height:40px;background:${C.brand};border-radius:20px;font-family:${FONT};font-size:18px;font-weight:800;color:#1A1106;">${n}</td></tr></table></td>
      <td valign="top" style="padding:16px 18px 16px 4px;font-family:${FONT};"><div style="font-size:17px;line-height:22px;font-weight:800;color:${C.text};">${title}</div><div style="font-size:15px;line-height:22px;color:${C.body};margin-top:2px;">${text}</div></td>
    </tr></table></td></tr>`;

export interface EmailTemplate {
  id: string;
  name: string;
  blurb: string;
  subject: string;
  html: string;
}

const app: EmailTemplate = {
  id: 'app',
  name: 'Get the NikFoods app',
  blurb: 'Tells customers about the iPhone app with a download button.',
  subject: 'The NikFoods app is here',
  html: shell(
    'The NikFoods app is here',
    'Order, get menu alerts and follow your order from your iPhone.',
    `${hero('NEW · NIKFOODS APP', 'Dinner, a few taps away', 'Hi {firstName}, the NikFoods app is now on the App Store.')}
  <tr><td class="px" bgcolor="${C.card}" style="padding:30px 32px 6px;background:${C.card};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${feature('1', 'Order in a few taps', 'Pick your day, pay with Apple Pay, done.')}
      ${feature('2', 'Menu alerts', 'Know the moment the new menu is up.')}
      ${feature('3', 'Order updates', 'See your order and delivery news on your phone.')}
    </table>
  </td></tr>
  <tr><td class="px" align="center" bgcolor="${C.card}" style="padding:14px 32px 12px;background:${C.card};">
    ${button('Download on the App Store', APP_STORE_URL)}
    <div style="font-family:${FONT};font-size:13px;line-height:19px;color:${C.muted};margin-top:12px;">Free for iPhone. Sign in with the same email you use on nikfoods.com.</div>
  </td></tr>
${footer('You are getting this because you signed up for NikFoods updates.')}`
  ),
};

const menu: EmailTemplate = {
  id: 'menu',
  name: 'New menu is live',
  blurb: 'Announces the new weekly menu with an order button.',
  subject: "This week's menu is up",
  html: shell(
    "This week's menu is up",
    'Fresh Indian food, ready to order.',
    `${hero('FRESH MENU', "This week's menu is up", 'Hi {firstName}, pick your days and we will cook.')}
  <tr><td class="px" bgcolor="${C.card}" style="padding:28px 32px 8px;background:${C.card};font-family:${FONT};font-size:16px;line-height:25px;color:${C.body};">
    <p style="margin:0 0 14px;">Write one or two lines about this week here: a new dish, a favourite coming back, or the last day to order.</p>
    <p style="margin:0;">Thank you for eating with us.</p>
  </td></tr>
  <tr><td class="px" align="center" bgcolor="${C.card}" style="padding:22px 32px 14px;background:${C.card};">
    ${button('See the menu', SITE_URL)}
  </td></tr>
${footer('You are getting this because you signed up for NikFoods updates.')}`
  ),
};

const notice: EmailTemplate = {
  id: 'notice',
  name: 'Important notice',
  blurb: 'A short, clear notice: a delay, a holiday, a change to deliveries.',
  subject: 'A note about your NikFoods order',
  html: shell(
    'A note about your NikFoods order',
    'Please read: a short update from NikFoods.',
    `  <tr><td class="px" bgcolor="${C.card}" style="padding:28px 32px 8px;background:${C.card};">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${C.tile}" style="background:${C.tile};border-radius:999px;padding:5px 14px;font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:0.14em;color:${C.brandText};">PLEASE NOTE</td></tr></table>
    <div style="font-family:${FONT};font-size:28px;line-height:34px;font-weight:800;color:${C.text};margin:14px 0 12px;">A short update, {firstName}</div>
    <div style="font-family:${FONT};font-size:16px;line-height:25px;color:${C.body};">
      <p style="margin:0 0 14px;">Write what changed and what it means for the customer: which day, what to expect, and what we are doing about it.</p>
      <p style="margin:0 0 14px;">If they need to do something, say it in one clear sentence.</p>
      <p style="margin:0;">Thank you for your patience.<br><b>The NikFoods team</b></p>
    </div>
  </td></tr>
${footer('')}`
  ),
};

const thanks: EmailTemplate = {
  id: 'thanks',
  name: 'Thank you',
  blurb: 'A warm thank-you note to your customers.',
  subject: 'Thank you from NikFoods',
  html: shell(
    'Thank you from NikFoods',
    'A thank you from our kitchen to your table.',
    `${hero('THANK YOU', 'Thank you, {firstName}', 'From our kitchen to your table.')}
  <tr><td class="px" bgcolor="${C.card}" style="padding:28px 32px 20px;background:${C.card};font-family:${FONT};font-size:16px;line-height:25px;color:${C.body};">
    <p style="margin:0 0 14px;">Write your thank-you here. Keep it short and real: what their support means and what is coming next.</p>
    <p style="margin:0;">With gratitude,<br><b>Kunal and the NikFoods team</b></p>
  </td></tr>
${footer('')}`
  ),
};

export const EMAIL_TEMPLATES: EmailTemplate[] = [app, menu, notice, thanks];
