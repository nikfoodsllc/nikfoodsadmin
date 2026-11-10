/**
 * Instructions to paste into an AI assistant (ChatGPT, Claude, ...) when it designs an email for the Communication tab. They state
 * what the sending tool does and what mail apps (Gmail, Apple Mail, Outlook) can and cannot show, so the answer works first time.
 * Keep it in step with the rules in livesite/src/lib/communications/rules.ts (htmlProblem, placeholders, size limit).
 */
export const EMAIL_DESIGN_GUIDE = `You are designing ONE marketing/update email for NikFoods, a home-style Indian food delivery business in the Seattle area. Reply with a single complete HTML email in one code block, then one short line on what to change. No explanations before it.

HOW THE EMAIL IS SENT
- The HTML is sent exactly as written, to each customer separately. Gmail, Apple Mail (iPhone) and Outlook must all show it correctly. Most customers read it on an iPhone.
- It is NOT a web page. Build it like a classic email: nested <table role="presentation"> layouts, inline style="" on every element, and a small <style> block in <head> only for the mobile @media rule.
- Never use: <script>, <iframe>, <form>, <input>, <button>, <link>, <object>, <embed>, <base>, onclick-style attributes, or javascript: links. They are refused. No JavaScript, no web fonts, no CSS grid/flexbox/variables, no position, no background images.
- Make buttons from a table cell with bgcolor plus a padded <a>, never <button>.
- Keep it under 90,000 characters (Gmail cuts longer emails). Aim for under 20,000.

LAYOUT
- One centered column, 640px wide on computers (width="640" and max-width:640px), full width on phones. Add @media only screen and (max-width:620px) rules: .wrap{width:100%!important} and smaller side padding, smaller headline.
- Outer page background plus an inner card. Put a bgcolor="#RRGGBB" ATTRIBUTE on every coloured table/cell in addition to the CSS background (Apple Mail dark mode otherwise darkens boxes but not their text).
- Include <meta name="viewport" content="width=device-width, initial-scale=1.0">, <meta name="color-scheme" content="light dark"> and lang="en".
- Add a hidden preheader line right after <body> (display:none; max-height:0; overflow:hidden) of about 90 characters.
- Use a system font stack: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif. Body text 16px minimum, line-height 1.5, buttons at least 44px tall.

BRAND
- Colours: page #F3EBDD, card #FFFBF5, border #EADBC3, dark strip #1E1409, headline cream #F6D58E, orange (buttons, accents) #F89C35 with dark text #1A1106, body text #54442F, headings #2B1D0E, muted #76664F, soft tile #FFF1DC, link brown #A85A00.
- Logo: <img src="cid:nikfoods-logo" alt="NikFoods" width="150"> on a dark #1E1409 strip at the top. Use exactly that cid:nikfoods-logo address (the tool attaches the logo). Do not invent logo URLs.
- Other pictures must be public https:// links that you are sure exist (give each width, height:auto, alt text). If you have no real image, design without one.
- Tone: warm, short, plain. As few words as possible: one headline, one or two short lines, one clear button. No emoji clutter, no exclamation marks in a row, no discounts or coupons (NikFoods does not do discounts).
- Website: https://www.nikfoods.com . iPhone app: https://apps.apple.com/app/id6767141830 . Support: support@nikfoods.com .

PLACEHOLDERS (typed exactly, in curly braces, replaced for each customer)
- {firstName} the customer's first name (use it once, in the greeting, e.g. "Hi {firstName},").
- {unsubscribeUrl} the unsubscribe link. REQUIRED: end every email with a small footer that has <a href="{unsubscribeUrl}">Unsubscribe</a>.
- {orderNumber} and {date} exist only for messages sent to customers picked by their orders or one day; avoid them unless the user asks.
- Do not use any other word in curly braces. CSS braces are fine.

CHECK BEFORE YOU ANSWER
1. Looks right at 375px wide and at 640px wide, no sideways scrolling.
2. Every coloured block has a bgcolor attribute. No banned tags or attributes.
3. Logo uses cid:nikfoods-logo. Footer has the {unsubscribeUrl} link and support@nikfoods.com.
4. One clear call to action. Subject line suggestion under 60 characters, given in one line after the code.`;
