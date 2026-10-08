/**
 * The "Understanding Admin" page: every status, label, colour and code the admin panel shows, and what it means,
 * in plain words. When a screen gets a new status or label, add it here too.
 */
export type GlossaryTone = 'good' | 'bad' | 'warn' | 'info' | 'none';

export interface GlossaryEntry {
  id: string;
  /** The heading it is listed under */
  section: string;
  /** The word or label exactly as it appears on screen */
  term: string;
  /** The colour it appears in, when it has one */
  tone?: GlossaryTone;
  /** Which screen and column/place shows it */
  where: string;
  meaning: string;
  /** Extra words that should find this entry when searching */
  keywords?: string;
}

export const GLOSSARY_SECTIONS = [
  'Orders: order status',
  'Orders: payment status',
  'Orders: payment method',
  'Orders: Confirmation Email column',
  'Orders: OptimoRoute column',
  'Orders: moving a delivery date',
  'Orders: money columns',
  'Orders: card payment problems',
  'Create Order and Recent orders',
  'Manage Days and cutoffs',
  'Abandoned Checkout',
  'Kitchen Dashboard',
  'Kitchen Report',
  'Food Items',
] as const;

const e = (
  section: (typeof GLOSSARY_SECTIONS)[number],
  term: string,
  where: string,
  meaning: string,
  tone?: GlossaryTone,
  keywords?: string
): GlossaryEntry => ({ id: `${section}-${term}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), section, term, where, meaning, tone, keywords });

export const GLOSSARY: GlossaryEntry[] = [
  // ---- order status
  e('Orders: order status', 'Pending', 'Orders table, Order Status', 'The order exists but is not confirmed yet. A card order stays Pending until the payment goes through.', 'warn'),
  e('Orders: order status', 'Confirmed', 'Orders table, Order Status', 'The order is accepted (a card order is confirmed once it is paid, a cash or other order when it is entered). Nothing has been started in the kitchen yet.', 'info'),
  e('Orders: order status', 'Preparing', 'Orders table, Order Status', 'The kitchen is making the order.', 'info'),
  e('Orders: order status', 'Ready', 'Orders table, Order Status', 'The order is packed and waiting for the delivery.', 'good'),
  e('Orders: order status', 'Out for Delivery', 'Orders table, Order Status', 'The order has left for the customer.', 'good'),
  e('Orders: order status', 'Delivered', 'Orders table, Order Status', 'The order reached the customer.', 'good'),
  e('Orders: order status', 'Cancelled', 'Orders table, Order Status; Recent orders Cancelled tab', 'The order was cancelled, by an admin, or automatically when the payment was cancelled or failed for good. A cancelled order is left out of the Kitchen Dashboard counts.', 'bad'),

  // ---- payment status
  e('Orders: payment status', 'Paid', 'Orders table, Payment Status', 'The money has been received (card payment succeeded, or an admin marked it paid, for example cash).', 'good'),
  e('Orders: payment status', 'Unpaid', 'Orders table, Payment Status', 'No payment yet. A payment-link order is Unpaid until the customer pays the link.', 'warn'),
  e('Orders: payment status', 'Failed', 'Orders table, Payment Status', 'The payment was tried and did not go through (for example a declined card) and has not succeeded since. See "Orders: card payment problems" for the reason.', 'bad'),
  e('Orders: payment status', 'Refunded', 'Orders table, Payment Status', 'The whole amount was given back to the customer (done in the Stripe dashboard).', 'info'),
  e('Orders: payment status', 'Partially refunded', 'Orders table, Payment Status and filter', 'Part of the amount was given back. The order stays Paid for the rest; the "Refunded Amt" column and the order details show how much.', 'info', 'partial refund'),

  // ---- payment method
  e('Orders: payment method', 'Credit Card', 'Orders table, Payment Method', 'A plain card payment through Stripe.'),
  e('Orders: payment method', 'Apple Pay', 'Orders table, Payment Method', 'Paid with Apple Pay through Stripe.'),
  e('Orders: payment method', 'Google Pay', 'Orders table, Payment Method', 'Paid with Google Pay through Stripe.'),
  e('Orders: payment method', 'Link', 'Orders table, Payment Method', 'Paid with Stripe Link, the saved-card wallet from Stripe. This is not the same as a payment link an admin sends.'),
  e('Orders: payment method', 'Bank', 'Orders table, Payment Method', 'Paid by bank transfer through Stripe.'),
  e('Orders: payment method', 'Klarna', 'Orders table, Payment Method', 'Paid with Klarna through Stripe.'),
  e('Orders: payment method', 'Cash on Delivery', 'Orders table, Payment Method; Create Order shows it as "Cash"', 'The customer pays in cash. Entered through Create Order and marked Paid right away.', undefined, 'cash'),
  e('Orders: payment method', 'Other', 'Orders table, Payment Method', 'Paid some other way that an admin typed in (for example Zelle or a cheque). The typed name and note are on the order.', undefined, 'zelle'),

  // ---- confirmation email
  e('Orders: Confirmation Email column', 'Sent', 'Orders table, Confirmation Email', 'We handed the confirmation email to the email service. We have not heard back yet whether it arrived. Orders from before the tracking started stay on Sent.', 'good'),
  e('Orders: Confirmation Email column', 'Delivered', 'Orders table, Confirmation Email', "The email reached the customer's mail server. Not opened yet, as far as we know. The cell shows the time.", 'good'),
  e('Orders: Confirmation Email column', 'Opened', 'Orders table, Confirmation Email', 'The email was opened (the cell shows the last time and how many times). It is only a hint: some mail apps load emails on their own.', 'good'),
  e('Orders: Confirmation Email column', 'Bounced', 'Orders table, Confirmation Email', "The customer's mail server rejected it, for example a wrong address or a blocked sender. The tooltip has the reason, and the cell shows the time it bounced. The customer did not get it.", 'bad'),
  e('Orders: Confirmation Email column', 'Spam', 'Orders table, Confirmation Email', "The customer's mail provider marked the email as spam.", 'bad', 'complained complaint'),
  e('Orders: Confirmation Email column', 'Failed', 'Orders table, Confirmation Email', 'Our own sending failed: the email service refused or errored on the send. The tooltip shows the error, with the number of tries.', 'bad'),
  e('Orders: Confirmation Email column', 'Retrying', 'Orders table, Confirmation Email', 'The send failed and is being tried again.', 'warn'),
  e('Orders: Confirmation Email column', 'Pending', 'Orders table, Confirmation Email', 'The send is on its way.', 'warn'),
  e('Orders: Confirmation Email column', 'Delayed', 'Orders table, Confirmation Email', "The customer's mail server has not accepted it yet. It is still being tried.", 'warn'),
  e('Orders: Confirmation Email column', '- (dash)', 'Orders table, Confirmation Email', 'No confirmation email was ever sent, for example an unpaid order.', 'none', 'dash empty blank'),

  // ---- optimoroute
  e('Orders: OptimoRoute column', 'In OptimoRoute', 'Orders table, OptimoRoute; order details', 'The delivery stop for this order is in OptimoRoute (the route planner). The cell shows the delivery day(s). A customer with two orders on one day shares one stop.', 'good', 'optimo routes delivery stop'),
  e('Orders: OptimoRoute column', 'Failed', 'Orders table, OptimoRoute; order details', 'The stop could not be sent to OptimoRoute (for example an address OptimoRoute could not find). The tooltip has the error. It is tried again every 30 minutes; fix the address if it keeps failing.', 'bad'),
  e('Orders: OptimoRoute column', 'Remove failed', 'Orders table, OptimoRoute; order details', 'The order was cancelled or fully refunded but its stop could not be removed from OptimoRoute (for example the day is being planned). Delete the stop in OptimoRoute by hand.', 'bad'),
  e('Orders: OptimoRoute column', 'Removed', 'Orders table, OptimoRoute', 'The order was cancelled or fully refunded, so its stop was taken out of OptimoRoute.', 'warn'),
  e('Orders: OptimoRoute column', '- (dash)', 'Orders table, OptimoRoute', 'Nothing was sent to OptimoRoute: the order is unpaid, pending or cancelled, is older than the sync (before Oct 8), or its delivery day had already passed.', 'none', 'dash empty blank'),

  // ---- moving a delivery date
  e('Orders: moving a delivery date', 'Move items to a new delivery date', 'Order details: tick items, pick a date, press Move', 'Tick one or more items (or a whole day with the box next to the day), pick a new delivery date and press Move. Only the DELIVERY date changes; the kitchen day (the menu day it was picked for) stays, so the Kitchen Dashboard, Kitchen Report and Ordered Items report do not move. If only some items of a day move, the day is split in two lines (same kitchen day, different delivery date); moving them back joins them again. The stop in OptimoRoute, the customer\'s order page and the email follow the new delivery date. Any date from today to 120 days ahead can be picked, also one that has already closed for ordering. Only paid orders that are confirmed, preparing or ready can be moved.', undefined, 'reschedule move delivery date change date checkbox tick select items'),
  e('Orders: moving a delivery date', 'Rescheduled', 'Orders table, Rescheduled column; Rescheduled filter', 'This order has had a delivery date moved by an admin. The row is tinted amber with an amber edge. Hover for what moved, who did it and whether the customer was emailed.', 'warn', 'reschedule moved'),
  e('Orders: moving a delivery date', 'Customer not told', 'Orders table, Rescheduled column', 'The date was moved but the customer has not been emailed since. Open the order and press "Send email to customer".', 'bad'),
  e('Orders: moving a delivery date', 'Customer emailed', 'Orders table, Rescheduled column; order details', 'The customer was sent the "delivery date updated" email after the last move. If the date is moved again, it goes back to "Customer not told".', 'good'),
  e('Orders: moving a delivery date', 'Send email to customer', 'Order details, amber banner', 'Sends the customer an email with the new delivery date(s) and what is on each day. Support gets an identical copy. It is never sent by itself; press it when you are ready (after all moves).'),
  e('Orders: moving a delivery date', 'Delivery date moved', 'Order details, amber banner', 'Shows the original and the new dates, who moved them and when. If an order is moved back to its original date, it says so and no email is needed.'),

  // ---- money columns
  e('Orders: money columns', 'Subtotal', 'Orders table, order details', 'The food total before taxes, fees and tip.'),
  e('Orders: money columns', 'Platform Fee', 'Orders table, order details', 'The customer-facing fee for digital payment processing: 4% of the subtotal plus $0.31. It does not depend on the tip. On the website and in emails it is included in "Taxes & Fees".'),
  e('Orders: money columns', 'Taxes', 'Orders table, order details', 'Sales tax, 10.3% of the subtotal plus the Platform Fee. On the website and in emails it is included in "Taxes & Fees".', undefined, 'tax 10.3'),
  e('Orders: money columns', 'Taxes & Fees', 'Website, emails, My Orders (customers see this one line)', 'What customers see instead of separate tax, Platform Fee and delivery fee lines: all of them added together. Admin screens keep the breakdown.'),
  e('Orders: money columns', 'Tip', 'Orders table, order details', 'The tip the customer chose at checkout (0, 5, 10 or 15% of the subtotal).'),
  e('Orders: money columns', 'Total Paid', 'Orders table, order details', 'Subtotal + Taxes + Platform Fee + Tip: what the customer was charged. After a refund, the order details also show "Refunded" and "Total after refund".'),
  e('Orders: money columns', 'Stripe Fee', 'Orders table', "What Stripe charged us for this payment (about 2.9% + 30 cents), saved when the payment succeeds. A dash means it is not saved: cash and other offline orders have none, and orders from before it was tracked have none."),
  e('Orders: money columns', 'Refunded Amt', 'Orders table', 'How much of the order has been given back so far. Empty when nothing was refunded.'),

  // ---- card payment problems
  e('Orders: card payment problems', 'card_declined', 'Order details, Payment Information', "The card company declined the payment. The second code (decline code) says why.", 'bad'),
  e('Orders: card payment problems', 'generic_decline', 'Order details, Payment Information', "The bank declined without giving a reason. The customer should try another card or call their bank.", 'bad'),
  e('Orders: card payment problems', 'insufficient_funds', 'Order details, Payment Information', 'Not enough money on the card.', 'bad'),
  e('Orders: card payment problems', 'expired_card', 'Order details, Payment Information', 'The card has expired.', 'bad'),
  e('Orders: card payment problems', 'incorrect_cvc', 'Order details, Payment Information', 'The 3 or 4 digit security code was wrong.', 'bad', 'cvv'),
  e('Orders: card payment problems', 'processing_error', 'Order details, Payment Information', 'The card network had a temporary error. Trying again often works.', 'bad'),
  e('Orders: card payment problems', 'fraudulent', 'Order details, Payment Information', 'The bank or Stripe flagged the payment as likely fraud.', 'bad'),
  e('Orders: card payment problems', 'payment_intent_authentication_failure', 'Order details, Payment Information', "The customer's bank asked for extra verification (3D Secure) and it was not completed or failed.", 'bad', '3ds 3d secure'),
  e('Orders: card payment problems', 'canceled_...', 'Order details, Payment Information', 'The payment was cancelled in Stripe. The part after "canceled_" is the reason given (for example duplicate or requested_by_customer). The order is cancelled too.', 'bad', 'cancelled'),
  e('Orders: card payment problems', 'Payment attempts', 'Order details, Payment Information', 'How many times a payment was tried on this order. The latest failure reason is the one shown.'),
  e('Orders: card payment problems', 'Waiting for 3D Secure', 'Order details, Stripe payment note', "The customer's bank asked for extra verification and the customer has not finished it yet.", 'warn', 'requires action'),

  // ---- create order / recent orders
  e('Create Order and Recent orders', 'Waiting for payment', 'Recent orders tab', 'Payment-link orders the customer has not paid yet. A paid order leaves this tab by itself within about 30 seconds.', 'warn'),
  e('Create Order and Recent orders', 'Paid', 'Recent orders tab and chip', 'The order is paid. The chip also says how: Paid · Cash, Paid · Zelle, Paid · Credit Card and so on.', 'good'),
  e('Create Order and Recent orders', 'Cancelled', 'Recent orders tab and chip', 'An admin cancelled the order. A cancelled payment-link order has a dead link and no action buttons.', 'bad'),
  e('Create Order and Recent orders', 'All', 'Recent orders tab', 'Every order entered here that the list loaded: every unpaid link order plus the newest ones. Unpaid ones are listed first.'),
  e('Create Order and Recent orders', 'Link emailed <time>', 'Recent orders, under an unpaid order', 'The payment link was emailed to the customer at that time. "The payment link has not been emailed yet" means it was only created, so use Copy link or Email a new link.'),
  e('Create Order and Recent orders', 'Email delivered', 'Recent orders, payment-link line', "The link email reached the customer's mail server.", 'info'),
  e('Create Order and Recent orders', 'Email opened', 'Recent orders, payment-link line', 'The link email was opened (it can happen automatically, so it is only a hint).', 'info'),
  e('Create Order and Recent orders', 'The email bounced: ...', 'Recent orders, payment-link line', "The customer's mail server rejected the link email (the reason follows). Check the email address, or send the link another way.", 'bad', 'bounce'),
  e('Create Order and Recent orders', "The customer's mail provider marked the email as spam", 'Recent orders, payment-link line', 'The link email was reported as spam. Send the link another way (Copy link).', 'bad', 'complained'),
  e('Create Order and Recent orders', 'The email is delayed', 'Recent orders, payment-link line', "The customer's mail server has not accepted the link email yet.", 'warn'),
  e('Create Order and Recent orders', 'Opened the payment page', 'Recent orders, payment-link line', 'The customer opened the link in a browser (the most reliable sign they saw it). It adds "and paid" once they paid. Reloading within 15 seconds is not counted again.', 'good', 'page views'),
  e('Create Order and Recent orders', 'Has not opened the payment page yet', 'Recent orders, payment-link line', 'The link was sent but not opened yet. After 24 hours the line turns amber and suggests emailing a new link or calling the customer.', 'warn', 'nudge 24 hours'),
  e('Create Order and Recent orders', 'Send a reminder', 'Recent orders, action button', 'Emails the customer the same payment email again with the SAME link, so the link they already have keeps working. It cannot be sent twice within 30 seconds.'),
  e('Create Order and Recent orders', 'Copy current link', 'Recent orders, action button', 'Copies the link the customer already has (nothing changes, nobody is emailed). Orders made before links were saved ask first, because they need a fresh link and the old one stops working.'),
  e('Create Order and Recent orders', 'Email a new link', 'Recent orders, action button', 'Makes a fresh payment link and emails it. The old link stops working at once.'),
  e('Create Order and Recent orders', 'Paid another way', 'Recent orders, action button', 'Marks a link order paid when the customer paid you outside the link (cash, Zelle...). The link is closed so it cannot be paid twice.'),
  e('Create Order and Recent orders', 'Offline NikFoods Order', 'Email subject of orders entered by an admin', 'Orders entered through Create Order (payment link, cash, other) have "Offline" in the confirmation email subject so the team can tell them apart from website orders.', 'info', 'offline subject'),

  // ---- manage days
  e('Manage Days and cutoffs', 'Open (green bar)', 'Manage Days calendar, Flat / Day-wise bars', 'That kind of item (Flat or Day-wise) is switched on for the day and customers can still order it.', 'good'),
  e('Manage Days and cutoffs', 'Closed (locked bar)', 'Manage Days calendar, Flat / Day-wise bars', 'Switched on, but its order cutoff has passed, so customers can no longer order it. The Enabled switch is not turned off: Extend can reopen the day.', 'warn', 'cutoff passed locked'),
  e('Manage Days and cutoffs', 'Off (red X)', 'Manage Days calendar', 'That kind of item is switched off for the day.', 'bad', 'disabled'),
  e('Manage Days and cutoffs', 'Grey dashed day', 'Manage Days calendar', 'Everything that was switched on for that day has closed (all cutoffs passed).', 'none'),
  e('Manage Days and cutoffs', 'Flat', 'Manage Days', 'Items sold as a normal menu (batters, sweets, pickles...), not tied to a weekday menu. Their standard cutoff is 5 PM Pacific the day before delivery.', undefined, 'flat category 5 pm'),
  e('Manage Days and cutoffs', 'Day-wise', 'Manage Days', 'The Food Menu: items chosen for each delivery day. Their standard cutoff is 1 PM Pacific the day before delivery.', undefined, 'food menu 1 pm'),
  e('Manage Days and cutoffs', 'Enabled', 'Manage Days, day dialog', 'The on/off switch for a kind on a day. It does not change by itself when the cutoff passes.'),
  e('Manage Days and cutoffs', 'Custom cutoff / Extend', 'Manage Days, day dialog', 'Move the closing time of one kind on one day. Extending a day that has already closed reopens it from now. The dialog shows when and by whom a custom cutoff was set.', undefined, 'extend cutoff'),
  e('Manage Days and cutoffs', 'Lock row (repeats weekly)', 'Food Menu items page', 'Locks an item row so that, when you switch on next week\'s days, the item is added again on the same weekdays it had last week. Nothing is ever removed, and a day that already has items is left alone.', undefined, 'lock repeat weekly'),

  // ---- abandoned checkout
  e('Abandoned Checkout', 'To contact', 'Abandoned Checkout tab', 'People who started a checkout and left without ordering, and have not been contacted. Anyone who ordered afterwards is not listed.', 'warn'),
  e('Abandoned Checkout', 'Contacted', 'Abandoned Checkout tab', 'You marked this person as contacted (with an optional note).', 'good'),
  e('Abandoned Checkout', 'Pressed Pay, payment did not go through', 'Abandoned Checkout chip', 'The customer pressed Pay but the payment failed or was not finished. They wanted to buy, so they are the best people to contact.', 'warn'),
  e('Abandoned Checkout', 'N earlier checkouts', 'Abandoned Checkout chip', 'The same person left checkout before as well.', undefined, 'earlier checkouts'),
  e('Abandoned Checkout', 'Contacted before (<time>)', 'Abandoned Checkout chip', 'You already contacted this person about an earlier checkout, at that time.'),
  e('Abandoned Checkout', 'Date range (Today, 7, 14, 30, 60 days, Custom)', 'Abandoned Checkout', 'Which days of leftovers to show, in Pacific days, both ends included. The oldest you can look back is 60 days.'),

  // ---- kitchen dashboard
  e('Kitchen Dashboard', 'Delivered Wed, Oct 14 (amber truck line)', 'Kitchen Dashboard, under an item or combo', 'The item stays on the day it is cooked (its menu day) but goes out on a later day: a small day the cart combined into the next delivery, or items an admin moved to another delivery date. The line says when. If only some of the units go later it says how many ("1 of 3 delivered Wed, Oct 14"). Tap the item to see which order goes out when.', 'warn', 'delivery later clubbed moved deliver date'),
  e('Kitchen Dashboard', 'Week (Saturday to Friday)', 'Kitchen Dashboard', 'A kitchen week runs Saturday to Friday: the menu goes out on Friday night and deliveries run through the next Friday. This week, Last week and Week before last follow it.', undefined, 'saturday friday weeks'),
  e('Kitchen Dashboard', 'Menu day', 'Kitchen Dashboard day columns', 'Each item counts on the menu day it was picked for, not the day it is delivered. An item picked for Wednesday but delivered with Thursday\'s order is still produced for Wednesday.', undefined, 'delivery day clubbing'),
  e('Kitchen Dashboard', 'Which orders are counted', 'Kitchen Dashboard', 'Orders that are not cancelled and either paid, or already in preparing / ready / out for delivery / delivered with a payment that is not failed or refunded.'),
  e('Kitchen Dashboard', 'Combos and "includes N inside combos"', 'Kitchen Dashboard item cards', 'A combo is counted as a combo, and its chosen parts are also added to the item totals. "Includes N inside combos" says how many of an item\'s units came from combos.', undefined, 'combo parts'),
  e('Kitchen Dashboard', 'Amount in oz (lb)', 'Kitchen Dashboard item cards', 'Size times quantity added up: for example 12Oz x 7 = 84 oz (5.25 lb). Items without a size have no amount.', undefined, 'ounces pounds weight total'),
  e('Kitchen Dashboard', 'Size chips (16Oz, 12Oz, 8Oz...)', 'Kitchen Dashboard item cards', 'How many were ordered in each size, biggest first.'),
  e('Kitchen Dashboard', 'Spice line (chilli icon)', 'Kitchen Dashboard item cards', 'How many were ordered at each spice level, from Mild to Hot.', undefined, 'spice mild hot'),
  e('Kitchen Dashboard', 'Eco', 'Kitchen Dashboard item cards', 'How many were packed in an eco-friendly container, by size (biggest first).', undefined, 'eco container'),
  e('Kitchen Dashboard', 'Who ordered', 'Kitchen Dashboard, item dialog', 'Every order line for the item, sorted by spice level (Mild to Hot), then size (biggest first), then customer name.'),

  // ---- food items
  // ---- kitchen report
  e('Kitchen Report', 'Kitchen Prep tab', 'Reporting > Kitchen Report (BETA)', 'One card per COOKED item for the menu days you pick: the item total on top (ounces and pounds, or the number of pieces), the number of eco containers, then one line per order with the customer, spice, size, amount and ECO, and three dates: Ordered (the day the customer placed the order), Kitchen (the menu day it is cooked) and Delivery (the day it goes out; amber when that is a later day). Lines go mild to hot, biggest size first. A combo is not an item to cook: its chosen parts (curry, rice, chapati ...) are listed as their own items with "with <combo>" under the customer. Rows alternate red and white (each item starts with red) so no row is missed, and an ECO row is green. Print it, or download the Excel file: its Kitchen Prep sheet is laid out like Kunal\'s sheet (a box round each item, the item total in pounds or pieces in bold on the first row, ECO written on eco rows), plus a Stickers and a Day totals sheet; it follows the search box.', undefined, 'prep cooked report cook list print csv'),
  e('Kitchen Report', 'Stickers tab', 'Reporting > Kitchen Report (BETA)', 'The READY TO EAT items (pickles, sweets, batters ...): one line per customer order line, grouped by delivery day, with the same three dates, so you can print a sticker for each. Only items set to Ready to eat in Food Items appear here.', undefined, 'stickers ready to eat pack label'),
  e('Kitchen Report', 'Day totals tab', 'Reporting > Kitchen Report (BETA)', 'What to make on each menu day, like the Kitchen Dashboard: every item with its quantity and total amount. An item that goes out on a later day says "Delivered <day>".', undefined, 'totals per day'),
  e('Kitchen Report', 'Preparation type not set yet', 'Kitchen Prep tab (amber section)', 'Items whose Preparation Type is not set in Food Items. They are kept in the report (at the end) so nothing is missing, but they are not in the cooked list or in the stickers until you set Cooked or Ready to eat.', 'warn', 'not set unclassified'),

  e('Food Items', 'Preparation Type: Cooked', 'Food Items table and edit dialog', 'Made fresh for the day\'s menu. It is for admin reporting only: customers never see it.', 'info'),
  e('Food Items', 'Preparation Type: Ready to eat', 'Food Items table and edit dialog', 'Already made, only packed (for example sweets or pickles). Admin reporting only.', 'info'),
  e('Food Items', '(not set yet)', 'Food Items, Preparation Type', 'Nobody has chosen Cooked or Ready to eat for this item yet.', 'none'),
  e('Food Items', 'Available', 'Food Items table', 'Whether the item can be ordered at all. An unavailable item is hidden on the website.'),
];

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9$%.#&+-]+/).filter(Boolean);

/** Entries where every word typed appears somewhere in the term, meaning, screen, heading or extra keywords. */
export function searchGlossary(entries: GlossaryEntry[], query: string): GlossaryEntry[] {
  const wanted = words(query);
  if (wanted.length === 0) return entries;
  return entries.filter((entry) => {
    const haystack = `${entry.term} ${entry.meaning} ${entry.where} ${entry.section} ${entry.keywords ?? ''}`.toLowerCase();
    return wanted.every((word) => haystack.includes(word));
  });
}

export function groupBySection(entries: GlossaryEntry[]): Array<{ section: string; entries: GlossaryEntry[] }> {
  return GLOSSARY_SECTIONS.map((section) => ({ section, entries: entries.filter((x) => x.section === section) })).filter((g) => g.entries.length > 0);
}
