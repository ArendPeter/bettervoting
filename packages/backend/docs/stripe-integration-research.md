# Stripe Integration Research — Phase 1 Payment System (Issue #1567)

> **Note on location**: `packages/backend/docs/` did not exist before this file. The repo has no
> established convention for where research notes live. This file may be relocated once a
> convention is established (e.g. a top-level `docs/` or `docs/design/` folder).

This document researches the best-fit Stripe integration pattern for BetterVoting's Phase 1
tiered, pay-as-you-go election service fees:

- **Free**: ≤100 voters, no charge.
- **Large**: 100–5,000 voters, $10 per 200 voters.
- **Custom**: >5,000 voters, contact-us (no self-serve checkout).
- Organizer pays once via a Stripe-hosted flow to unlock a tier for one specific election.
- If the organizer later needs to raise their voter count again, they should be charged only the
  **difference** between what they already paid and the new tier's price — not the full new-tier
  price again.

All Stripe facts below are cited to `docs.stripe.com` pages fetched directly. Where Stripe's docs
don't answer a BetterVoting-specific question, that's called out explicitly and followed by a
recommendation labeled as such (not a Stripe fact).

---

## Summary / Recommendation

**Use Stripe Checkout Sessions in `payment` mode, hosted page (`ui_mode: hosted_page`), created
per-purchase via the API with `line_items[0].price_data` set to a dynamically computed one-time
amount, plus `client_reference_id` set to the internal election ID and `payment_intent_data.metadata`
carrying `election_id` / `user_id` / `tier`.** Confirm payment via the
`checkout.session.completed` webhook (and `checkout.session.async_payment_succeeded` for delayed
payment methods), verified with `Stripe-Signature` / `stripe.webhooks.constructEvent`.

Why this combination, in one sentence each:

- **Checkout Sessions over Payment Links**: Payment Links are created once and reused by many
  buyers with a fixed, pre-existing Price; they cannot carry a different dynamic amount or a
  different `client_reference_id` per purchase, which BetterVoting needs (each purchase is for
  one specific election at a computed delta amount). ([Create a payment link](https://docs.stripe.com/api/payment-link/create))
- **Checkout Sessions over raw Payment Intents + custom UI**: Stripe's own docs state Checkout
  Sessions with the Payment Element are recommended "over Payment Intents for most integrations,"
  and explicitly say "Don't use the Payment Intent API unless the user explicitly asks, because it
  requires significantly more code." ([The Payment Intents API](https://docs.stripe.com/payments/payment-intents))
- **Tier-delta pricing is application logic, not a Stripe pricing-model feature**: Stripe's
  graduated/volume tiered Prices and Billing proration both apply to recurring *subscriptions*.
  There is no Stripe primitive for "charge the delta between two one-time payments." BetterVoting
  must compute `amountOwed = tierPrice(newTier) - amountAlreadyPaid` in its own backend and pass
  it as a one-off `price_data.unit_amount` on the next Checkout Session. This is a recommendation,
  not a Stripe-documented capability — see Section 2.

---

## 1. Stripe Checkout vs. Payment Links vs. custom Payment Intents

### Stripe Checkout (Checkout Sessions API, hosted page)

- Built via the [Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions.md); the
  hosted, full-page option is Stripe's **Recommended** default. Stripe's comparison table lists
  "Complexity: Low," built-in Billing/Tax/Adaptive Pricing support, and either hosted or embedded
  presentation. ([Build a payments page](https://docs.stripe.com/payments/checkout))
- Supports dynamic, per-session pricing: `line_items[].price_data` lets you set `currency`,
  `unit_amount`, and `product_data` inline at Checkout Session creation time — you don't have to
  pre-create a Stripe Price object for every possible dollar amount. (Search result confirmed
  from [Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create) and
  related Stripe pages on `price_data`.)
- Supports `metadata` (map, up to 50 keys / 40-char keys / 500-char values — see Section 4) and
  `client_reference_id` (string, up to 200 characters) directly on the Session object.
  ([Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create))
- Redirect-based: customer is sent to a Stripe-hosted `url`, then redirected back to your
  `success_url` (which can embed `{CHECKOUT_SESSION_ID}`). Fulfillment must not rely solely on
  this redirect — webhooks are required as the reliable path. ([Fulfill orders](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted))
- UI work required: minimal. The hosted page needs no custom payment UI at all — organizer clicks
  a link/button your backend generates via the API, and Stripe renders the entire payment form.

### Payment Links

- A **shareable, reusable, no-code** payment page: "Reuse multiple times with multiple customers"
  — a single Payment Link is a static object with a fixed `line_items[].price` referencing a
  pre-existing Price ID (confirmed by [Create a payment link](https://docs.stripe.com/api/payment-link/create):
  `line_items` requires a `price`; there is no `price_data` override for a one-off amount at
  purchase time).
- `metadata` set on the Payment Link is copied identically to every Checkout Session it spawns —
  it is **not** per-purchase data. There is no `client_reference_id` parameter on Payment Links at
  all — that field exists only on the Checkout Session object. ([Create a payment link](https://docs.stripe.com/api/payment-link/create); [Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object))
- The official Checkout-vs-Payment-Links-vs-Invoicing comparison notes "Customers can choose what
  to pay" as a Payment Links feature (pay-what-you-want), which is a different mechanism from an
  organizer selecting one of three fixed application-defined tiers with a server-computed amount.
  ([Payment Links overview](https://docs.stripe.com/payment-links))
- Fulfillment webhooks are identical to Checkout ("Payment Links use Checkout, so all of the
  information below applies to both Payment Links and Checkout unless otherwise noted" —
  [Fulfill orders](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted)), but
  the inability to set a dynamic amount or a per-purchase `client_reference_id` rules Payment
  Links out for BetterVoting's "pay the exact computed delta for this specific election" flow.

### Custom Payment Intents (+ Stripe Elements / your own UI)

- Stripe's own guide is explicit: "Stripe recommends using the Checkout Sessions API with the
  Payment Element over Payment Intents for most integrations... Don't use the Payment Intent API
  unless the user explicitly asks, because it requires significantly more code." ([The Payment
  Intents API](https://docs.stripe.com/payments/payment-intents))
- Payment Intents support `metadata` (same size limits) and require you to build/host your own
  checkout UI (Stripe Elements or fully custom), handle the client secret, call
  `stripe.confirmCardPayment`/`stripe.handleCardAction` client-side, and manage the PaymentIntent
  lifecycle (`requires_payment_method` → `requires_confirmation` → `requires_action` →
  `processing` → `succeeded`) yourself. There is no `client_reference_id` equivalent — you'd rely
  entirely on `metadata`.
- Advantages Stripe calls out (automatic SCA/3DS handling, idempotency-key support, no double
  charges) are largely *also* present under the hood of a Checkout Session, since a Checkout
  Session in `payment` mode creates and manages a PaymentIntent for you.

**Recommendation for BetterVoting**: Checkout Sessions, hosted page, created server-side per
purchase attempt. This gives dynamic pricing, both identifier fields, webhook-driven fulfillment,
and requires no custom payment UI — matching "organizer selects tier, pays once via a
Stripe-hosted flow."

---

## 2. Do Stripe's tiered/graduated Price objects fit "charge only the difference on upgrade"?

- Stripe's tiered pricing (`billing_scheme: tiered`, `tiers_mode: volume` or `graduated`) is
  documented under **"Recurring pricing models"** / **"Set up tiered pricing"**, and every
  example ties tiers to a `recurring` Price used with a **subscription**
  ([Recurring pricing models](https://docs.stripe.com/products-prices/pricing-models);
  [Set up tiered pricing](https://docs.stripe.com/subscriptions/pricing-models/tiered-pricing)).
  Volume pricing re-rates the *entire* quantity at the matched tier's unit price; graduated
  pricing sums per-tier charges. Neither mode has any concept of "what was already paid" — they
  compute a **total** for the current quantity, not a delta from a prior one-time payment.
- **Proration**, which is the Stripe concept closest to "charge only the difference," is
  explicitly a **Billing/subscription** feature: "The most complex aspect of changing existing
  subscriptions are prorations... If a customer upgrades from a 10 USD monthly plan to a 20 USD
  option halfway through the billing period, the customer is billed an additional 5 USD."
  ([Prorations](https://docs.stripe.com/billing/subscriptions/prorations)) Proration is computed
  by the `proration_behavior` parameter on `POST /v1/subscriptions/:id` (or a subscription
  schedule) and only fires for defined subscription-update triggers (changing `items`, `price`,
  `quantity`, `trial_end`, `billing_cycle_anchor`, or `cancel_at`) — see the "What triggers
  prorations" / "What doesn't trigger prorations" tables on that same page.
- **Why proration doesn't apply here**: BetterVoting's tier purchase is a one-time payment for a
  single election (`mode: payment`), not a subscription with a billing period. There is no
  Stripe `Subscription` object, no billing cycle, and no "unused time" to credit — proration math
  is defined in terms of time remaining in a billing period, which has no meaning for a one-time,
  perpetual-for-this-election unlock. Stripe's Prices/tiered-pricing API has no "one-time tiered
  Price with delta billing" mode; `billing_scheme: tiered` requires `recurring` in every documented
  example.

**Recommendation for BetterVoting (not a Stripe-documented feature)**: Treat the three tiers as
plain application data (e.g. a config table: `{tier, maxVoters, priceCents}`), not Stripe Price
tiers. On each purchase attempt:
1. Look up how much has already been paid for this election (sum of successful Checkout Sessions
   recorded against that `election_id`, or a stored `currentTierPriceCents` on the election row).
2. Compute `amountOwedCents = tierPrice(requestedTier) - amountAlreadyPaidCents`, clamped to `>= 0`.
3. Create a new Checkout Session with `line_items[0].price_data.unit_amount = amountOwedCents`
   (a one-off, non-Price-catalog amount) rather than a saved Price ID.
4. On successful webhook confirmation, update the election's paid tier / voter cap and record the
   cumulative amount paid.

This keeps Stripe's role purely as "collect exactly $X now," while BetterVoting owns all tier and
delta logic — which is more auditable and simpler than trying to force Stripe's subscription
proration model onto a one-time-payment product.

---

## 3. Webhook events to reliably confirm payment and mark something paid

- **Primary event**: `checkout.session.completed` — fired "when someone pays you" via Checkout.
  ([Fulfill orders](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted))
- **Delayed/async payment methods** (ACH direct debit, other bank transfers, etc.) don't have
  funds available immediately when Checkout completes; for these, listen also for
  `checkout.session.async_payment_succeeded` (payment later succeeded) and
  `checkout.session.async_payment_failed` (payment later failed), and check the Session's
  `payment_status` field before fulfilling. ([Fulfill orders](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted))
- Stripe's own example handler explicitly triggers fulfillment on **both**
  `checkout.session.completed` **and** `checkout.session.async_payment_succeeded`:
  ```ruby
  if event['type'] == 'checkout.session.completed' ||
     event['type'] == 'checkout.session.async_payment_succeeded'
    fulfill_checkout(event['data']['object']['id'])
  end
  ```
  ([Fulfill orders](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted))
- Webhooks are **required**, not optional: "You can't rely on triggering fulfillment only from
  your checkout landing page, because it's not guaranteed customers visit that page. For example,
  a customer can pay successfully and then lose their internet connection before your landing page
  loads." ([Fulfill orders](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted))
- `payment_intent.succeeded` is a lower-level event on the PaymentIntent itself and is the
  standard event for non-Checkout (raw Payment Intents) integrations
  ([Receive Stripe events](https://docs.stripe.com/webhooks), example handler switches on
  `payment_intent.succeeded`). For a Checkout-based integration, `checkout.session.completed` is
  the documented, recommended event — it's fired once your specific Session (which carries your
  `client_reference_id`/`metadata`) is done, saving a lookup hop.

### Idempotency / de-duplication

- **Webhook event de-duplication** (different from API idempotency keys): "Webhook endpoints
  might occasionally receive the same event more than once. You can guard against duplicated
  event receipts by logging the event IDs you've processed, and then not processing
  already-logged events. In some cases, two separate Event objects are generated and sent. To
  identify these duplicates, use the ID of the object in `data.object` along with the
  `event.type`." ([Receive Stripe events — Handle duplicate events](https://docs.stripe.com/webhooks))
- Stripe's fulfillment guide independently requires your fulfillment function to be **idempotent
  by design**: "Perform fulfillment only once per payment... your `fulfill_checkout` function
  might be called multiple times, possibly concurrently, for the same Checkout Session... it must
  correctly handle being called multiple times with the same Checkout Session ID," and to "record
  fulfillment status for the provided Checkout Session." ([Fulfill orders](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted))
- Stripe **retries** webhook delivery on non-2xx responses "for up to three days with an
  exponential back off in live mode" (three retries over a few hours in sandbox), so handlers must
  tolerate redelivery and should return a 2xx quickly, before slow business logic.
  ([Receive Stripe events — Automatic retries](https://docs.stripe.com/webhooks))
- **API idempotency keys** (`Idempotency-Key` header) are a *separate* mechanism from webhook
  de-duplication: they protect `POST` requests you make *to* Stripe (e.g. "create a Checkout
  Session") from being double-executed if your own retry logic re-sends the same request after a
  network error. "Stripe's idempotency works by saving the resulting status code and body of the
  first request made for any given idempotency key... Idempotency keys are up to 255 characters
  long... You can remove keys from the system automatically after they're at least 24 hours old."
  ([Idempotent requests](https://docs.stripe.com/idempotency))

### Signature verification

- Every inbound webhook must be verified using the `Stripe-Signature` header, a per-endpoint
  **webhook signing secret** (`whsec_...`, distinct from API keys — "Webhook signing secrets
  aren't API keys — they're per-webhook secrets"), and the official library helper
  (`Stripe::Webhook.construct_event` in Ruby; `stripe.webhooks.constructEvent` in Node). Stripe
  requires the **raw** request body — any middleware that parses/re-serializes JSON before
  verification breaks the signature check. ([Receive Stripe events — Verify webhook signatures](https://docs.stripe.com/webhooks); [API keys](https://docs.stripe.com/keys))
- If you use the same endpoint URL for both test and live mode, "the secret is different for each
  one" — each mode needs its own signing secret configured. ([Receive Stripe events](https://docs.stripe.com/webhooks))
- Additional hardening Stripe recommends: IP allowlisting Stripe's published webhook IPs, a replay
  protection window (default 5-minute tolerance on the signed timestamp — "Don't use a tolerance
  value of 0"), and periodic signing-secret rotation. ([Receive Stripe events — Preventing replay
  attacks / Roll endpoint signing secrets](https://docs.stripe.com/webhooks))

**Recommendation for BetterVoting**: Subscribe the webhook endpoint to `checkout.session.completed`
and `checkout.session.async_payment_succeeded` (plus `checkout.session.async_payment_failed` for
notifying the organizer of a failed delayed payment). Verify signatures with
`stripe.webhooks.constructEvent` using a raw body parser exemption for that route. Use the
Checkout Session ID (already unique) as the idempotency/dedup key in a small `stripe_events` or
`payments` table with a unique constraint, and check `payment_status !== 'unpaid'` before applying
the tier unlock — mirroring Stripe's own `fulfill_checkout` pattern.

---

## 4. Attaching `election_id` / `user_id`: `metadata` vs. `client_reference_id`

| | `metadata` | `client_reference_id` |
|---|---|---|
| Shape | Map of up to 50 key/value string pairs | Single string |
| Size limit | Keys ≤ 40 chars, values ≤ 500 chars, no `[`/`]` in keys ([Metadata](https://docs.stripe.com/api/metadata)) | ≤ 200 characters ([Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)) |
| Where it can be set | Checkout Session (top level), and separately on `payment_intent_data.metadata` for the resulting PaymentIntent/Charge, plus Customer, Refund, Subscription, Transfer, Account, etc. ([Metadata](https://docs.stripe.com/api/metadata)) | Only on the Checkout Session object itself — no PaymentIntent/Charge/Payment Link equivalent field exists ([Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object)) |
| Does it auto-propagate? | Checkout Session's top-level `metadata` does **not** automatically copy to the PaymentIntent/Charge — you must separately set `payment_intent_data.metadata` if you want it visible there too. ([Create a Checkout Session — payment_intent_data.metadata](https://docs.stripe.com/api/checkout/sessions/create)) A PaymentIntent's own `metadata` *does* copy forward to the Charges it creates: "When a PaymentIntent creates a charge, the PaymentIntent copies its metadata to the charge." ([The Payment Intents API](https://docs.stripe.com/payments/payment-intents)) | N/A — lives only on the Session; you retrieve the Session (e.g. by ID from the webhook payload) to read it. |
| Documented intended use | "Link IDs: Attach your system's unique IDs to a Stripe object to simplify lookups... add your order number to a charge, your user ID to a customer." Multiple structured keys. ([Metadata](https://docs.stripe.com/api/metadata)) | "A unique string to reference the Checkout Session. This can be a customer ID, a cart ID, or similar, and can be used to reconcile the session with your internal systems." Single reconciliation key. ([Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)) |
| Visible to customer? | No — "won't be seen by your users unless you choose to show it to them." ([Metadata](https://docs.stripe.com/api/metadata)) | Not customer-facing either. |

**Recommendation for BetterVoting**: Use both, for different purposes.
- Set `client_reference_id = election_id` on the Checkout Session — it's the single documented
  "reconcile with your internal system" field, and one value (the election being unlocked) is a
  natural fit.
- Set `metadata` (both on the Checkout Session **and** duplicated onto `payment_intent_data.metadata`
  so it's visible on the PaymentIntent/Charge too) with a small structured payload:
  `{ election_id, user_id, requested_tier, prior_paid_cents }`. This gives redundancy (you can
  look the election up from either field), gives you `user_id` which `client_reference_id` alone
  can't carry alongside an election id, and keeps the audit trail visible on the Charge object in
  the Dashboard for support/finance review.
- In the webhook handler, retrieve the Checkout Session by ID (`expand: ['line_items']` per
  Stripe's fulfillment guide) and read `client_reference_id` / `metadata` off that object — do not
  trust values passed only in the webhook JSON without re-fetching, per Stripe's fulfillment
  best practice of retrieving the Session from the API.

---

## 5. Test-mode vs. live-mode keys

- Every Stripe account has two parallel key sets, "sandbox" (test) and "live," each with its own
  objects: "Each mode has its own set of API keys, and objects in one mode aren't accessible to
  the other. For example, a sandbox product object can't be part of a live mode payment."
  ([API keys](https://docs.stripe.com/keys))
- Prefixes: sandbox/test keys start with `pk_test_` (publishable), `rk_test_` (restricted),
  `sk_test_` (secret); live keys start with `pk_live_`, `rk_live_`, `sk_live_`.
  ([API keys](https://docs.stripe.com/keys))
- Stripe now recommends **restricted API keys (RAKs)** over unrestricted secret keys for new
  integrations: "we don't recommend using secret keys for new use cases, and for existing
  integrations, we recommend migrating secret key usage to RAKs." ([API keys](https://docs.stripe.com/keys))
- **Webhook signing secrets are separate from API keys** and are also per-mode: "If you use the
  same endpoint for both test and live API keys, the secret is different for each one."
  ([API keys](https://docs.stripe.com/keys); [Receive Stripe events](https://docs.stripe.com/webhooks))
- Switching to live mode is documented as purely a config swap: replace the `pk_test_...` key in
  client-side code with the `pk_live_...` key, replace the server-side `sk_test_.../rk_test_...`
  key (via a secrets vault or environment variable — "If your platform doesn't provide a secrets
  vault, you can use an environment variable"), and update the webhook endpoint's live-mode
  signing secret. No code changes are implied by Stripe's own "Switch to live mode" walkthrough.
  ([API keys — Switch to live mode](https://docs.stripe.com/keys))
- Stripe's key-safety guidance: never hardcode keys or commit them to source control; use a
  secrets vault or environment variables; restrict server-side keys with access policies (IP/ASN
  allowlisting) in live mode. ([API keys — Protect your keys](https://docs.stripe.com/keys))

**Recommendation for BetterVoting**: Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and
`STRIPE_WEBHOOK_SECRET` env vars (mirroring the existing `SENDGRID_API_KEY` / `KEYCLOAK_SECRET`
pattern already documented in this repo's CLAUDE.md), sourced with the `sk_test_`/`sk_live_` (or
`rk_test_`/`rk_live_` if using a Restricted key) values depending on environment, and never branch
application code on test vs. live — only the env var values differ between deploys. Since a single
webhook endpoint can technically serve both modes but with different secrets, prefer one env-var
set per deploy environment consistent with how the rest of the backend's config already works
(`DATABASE_URL`, `ALLOWED_URLS`, etc. per `packages/backend`).

---

## 6. Receipt / statement descriptor / custom text — can copy be added?

- **Automatic email receipts** are an all-or-nothing account-level toggle
  (Dashboard → Settings → Business → Customer emails → "Successful payments"). Stripe's receipts
  documentation does **not** describe any way to inject custom body copy or a disclaimer sentence
  into the automatic receipt email itself. ([Receipts and paid invoices](https://docs.stripe.com/receipts))
- What **is** customizable on receipts, per Stripe's docs:
  - **Branding**: logo/icon image and brand/accent colors (Settings → Business → Branding →
    Email receipts tab). ([Receipts — Branding](https://docs.stripe.com/receipts))
  - **Business information**: legal business name, customer support address/email, privacy
    policy URL — these are described as "always required on receipts for compliance reasons," i.e.
    fixed fields, not freeform copy. ([Receipts — Business information](https://docs.stripe.com/receipts))
  - **Post-purchase Invoice add-on** (a separate, separately-priced feature from the plain
    receipt): if you enable `invoice_creation.enabled` on the Checkout Session, you can pass
    `invoice_creation.invoice_data.description`, `.footer`, and `.custom_fields[].name/value` —
    e.g. a `footer` string is genuinely freeform text that renders on the generated invoice PDF.
    ("Invoice creation for one-time payments through the Checkout Sessions API is not an
    Invoicing feature, and is priced separately.") ([Receipts — Custom invoice data](https://docs.stripe.com/receipts))
  - **Statement descriptor**: the short label on the customer's card/bank statement — not the same
    surface as an email receipt. Limited to 5–22 Latin characters (or a 2–10 char static prefix +
    dynamic suffix for card charges), must reflect your DBA name, and disallows certain special
    characters. Set via `payment_intent_data.statement_descriptor_suffix` on the Checkout Session
    (card charges) or `payment_intent_data.statement_descriptor` (non-card charges).
    ([Statement descriptors](https://docs.stripe.com/get-started/account/statement-descriptors))
    A 22-character descriptor cannot carry a sentence like "not tax-deductible" — it's meant for a
    short business/product label (e.g. `BETTERVOTING* ELECTION FEE`), not a legal disclaimer.
  - **Checkout Session `custom_text`**: `submit`, `after_submit`, `shipping_address`, and
    `terms_of_service_acceptance` fields, each up to 1,200 characters, but these render **on the
    Checkout page itself** (before/around payment), not on the emailed receipt.
    ([Create a Checkout Session — custom_text](https://docs.stripe.com/api/checkout/sessions/create))
- Stripe's fulfillment guide itself acknowledges the gap: your fulfillment function may need to
  "Send the customer a custom receipt email if you don't have Stripe's receipts enabled" — i.e.
  Stripe anticipates that some businesses will send their **own** email instead of/alongside
  Stripe's, precisely for cases needing custom copy. ([Fulfill orders](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted))

**Recommendation for BetterVoting (not a Stripe-documented capability)**: Stripe's automatic email
receipt cannot carry a custom "this is a program service fee, not tax-deductible" sentence in its
body. Options, in order of fit:
1. Use `custom_text.after_submit` (up to 1,200 chars) so the organizer sees the disclaimer on the
   Checkout page itself, immediately after paying, before Stripe's receipt is even generated.
2. Send BetterVoting's own transactional email (via the existing SendGrid integration already in
   `packages/backend/src/Services/`) from the `checkout.session.completed` webhook handler,
   containing the required disclaimer language, in addition to (not instead of) Stripe's
   automatic receipt.
3. If a compliant PDF paper trail matters more than cost, enable
   `invoice_creation.enabled` and put the disclaimer in `invoice_data.footer` — but note Stripe
   prices post-purchase Checkout invoices as a separate paid feature (see linked support article),
   which is a business/cost decision, not just an engineering one.

---

## Open questions / account-level setup needing a product or business decision

These are flagged, not answered, because they require decisions outside of what Stripe's docs
alone can settle:

1. **Statement descriptor text.** What should appear on a cardholder's bank/card statement for
   this charge (e.g. `BETTERVOTING* ELECTION FEE`)? Needs sign-off from whoever owns the Stripe
   account's business profile, and must be decided per the 22-character/DBA-name constraints in
   Section 6.
2. **Nonprofit status and receipts.** Stripe's receipts docs don't have any nonprofit-specific
   mode. If BetterVoting wants receipts to *not* look like tax-deductible donation receipts (since
   this is a service fee, not a donation), that likely means explicitly avoiding
   `submit_type: donate` on the Checkout Session (which uses `donate.stripe.com` and a "Donate"
   button label) and instead using the default `pay` submit type — a product decision, and one
   worth stating explicitly in the implementation ticket so nobody defaults to "donate" styling by
   habit.
3. **Whether to enable post-purchase Invoicing** (Section 6, option 3) given it's billed
   separately by Stripe — a cost/business decision, not just a technical one.
4. **Where "amount already paid for this election" is stored and how it's computed** if an
   organizer pays, then later is refunded, then upgrades again — the delta-charging logic in
   Section 2 needs a clear, single source of truth (e.g. a `paid_tier` + `paid_amount_cents`
   column on the election row, updated only by the webhook handler) and an explicit decision on
   how (or whether) refunds affect the "already paid" baseline. This is a data-model design
   question for the implementation ticket, not something Stripe's docs can answer.
5. **Custom/>5,000-voter tier flow.** The issue describes this as "contact-us," i.e. no Stripe
   Checkout Session at all for that tier — confirm that's the intended Phase 1 scope (no custom
   quote-to-Checkout-Session flow yet) before implementation.
6. **Restricted API keys vs. secret keys.** Stripe now steers new integrations toward Restricted
   API Keys (RAKs) with scoped permissions rather than an all-access secret key (Section 5). Worth
   deciding upfront whether BetterVoting provisions a RAK scoped to just Checkout Sessions +
   Webhook Endpoints, rather than a full `sk_live_...` key, to limit blast radius if the backend's
   env is ever compromised.

---

## References (all `docs.stripe.com`)

- [Build a payments page](https://docs.stripe.com/payments/checkout)
- [Payment Links overview](https://docs.stripe.com/payment-links)
- [Create a payment link](https://docs.stripe.com/api/payment-link/create)
- [The Payment Intents API](https://docs.stripe.com/payments/payment-intents)
- [Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- [The Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object)
- [Fulfill orders](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted)
- [Recurring pricing models](https://docs.stripe.com/products-prices/pricing-models)
- [Set up tiered pricing](https://docs.stripe.com/subscriptions/pricing-models/tiered-pricing)
- [Prorations](https://docs.stripe.com/billing/subscriptions/prorations)
- [Receive Stripe events (webhooks)](https://docs.stripe.com/webhooks)
- [Idempotent requests](https://docs.stripe.com/idempotency)
- [Metadata](https://docs.stripe.com/api/metadata)
- [API keys](https://docs.stripe.com/keys)
- [Receipts and paid invoices](https://docs.stripe.com/receipts)
- [Statement descriptors](https://docs.stripe.com/get-started/account/statement-descriptors)
