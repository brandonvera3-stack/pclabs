# PCLabs Stripe Setup Guide

> One-time payment link for PCLabs Pro — Early Access ($4.99)
> Estimated time: 15 minutes start to finish.

---

## Step 1 — Create a Stripe Account

1. Go to **https://stripe.com** and click **Start now**
2. Enter your email address and create a password
3. Verify your email
4. Fill in your business details:
   - **Business type:** Individual / Sole proprietor (unless you have an LLC)
   - **Business name:** PCLabs (or your legal name if sole proprietor)
   - **Website:** `https://thepclabs.com`
   - **Industry:** Software
   - **Product description:** "Windows PC diagnostics software — one-time Pro license"
5. Add your bank account for payouts (routing + account number)
6. Complete identity verification (government ID required — this is Stripe's KYC requirement, not optional)

> You can start in **test mode** before completing verification to build and test the payment flow. Switch to live mode before sharing the link publicly.

---

## Step 2 — Create the Product

1. In the Stripe Dashboard left sidebar, go to **Catalog → Products**
2. Click **+ Add product**
3. Fill in:
   - **Name:** `PCLabs Pro — Early Access`
   - **Description:** `One-time purchase. Includes scan history, PDF export, scheduled scans, priority support, and all future Pro features. Price increases as new features are added — lock in $4.99 now.`
   - **Image:** Upload the PCLabs logo (optional but recommended — shows on the checkout page)
4. Under **Pricing**, click **+ Add a price**:
   - **Pricing model:** One-time
   - **Price:** `4.99`
   - **Currency:** USD (add additional currencies later if needed)
5. Click **Save product**

---

## Step 3 — Generate a Payment Link

Payment Links are Stripe's no-code checkout solution — no backend required.

1. In the left sidebar, go to **Payment Links**
2. Click **+ New**
3. Under **Products**, search for and select `PCLabs Pro — Early Access`
4. Configure options:
   - **Quantity:** Fixed at 1 (users can't buy multiples)
   - **Allow promotion codes:** Optional — useful for launch discounts later
   - **Collect customer's:** Check **Email address** (required — you'll need this to deliver the license key later)
   - **After payment:** Select **Show a confirmation page** and set the message to:
     ```
     Thank you for supporting PCLabs!

     Your Early Access license key will be emailed to you within a few minutes.
     Check your spam folder if you don't see it.

     Questions? Join our Discord: [your Discord invite link]
     ```
5. Under **Advanced options**:
   - **Custom URL:** Set a slug like `pclabs-pro` if available
   - **Custom fields:** Optional — you can add a "PC nickname" field for fun
6. Click **Create link**

Stripe will give you a URL in this format:
```
https://buy.stripe.com/XXXXXXXXXXXXXXXX
```

**Copy this URL — you'll paste it into pricing.html in the next step.**

---

## Step 4 — Connect the Payment Link to pricing.html

Open `pricing.html` and find this line (near the bottom of the Pro card):

```html
<a href="REPLACE_WITH_STRIPE_PAYMENT_LINK" class="btn-pro" id="stripe-btn">
```

Replace `REPLACE_WITH_STRIPE_PAYMENT_LINK` with your actual Stripe URL:

```html
<a href="https://buy.stripe.com/XXXXXXXXXXXXXXXX" class="btn-pro" id="stripe-btn">
```

Also remove or delete the developer warning block at the bottom of the `<script>` tag — it's only there to remind you the link isn't set yet:

```js
// DELETE this entire block before launch:
if (stripeBtn && stripeBtn.getAttribute('href') === 'REPLACE_WITH_STRIPE_PAYMENT_LINK') {
  stripeBtn.addEventListener('click', function(e) {
    e.preventDefault();
    alert('Stripe payment link not yet configured.\nSee stripe-setup.md for instructions.');
  });
}
```

Save the file and deploy.

---

## Step 5 — Test the Payment Flow

Before going live, test with Stripe's built-in test cards.

1. In your Stripe Dashboard, make sure **Test mode** is toggled ON (top-left toggle)
2. Open your payment link in a browser
3. Use these test card numbers:
   - **Successful payment:** `4242 4242 4242 4242` — any future expiry, any 3-digit CVC
   - **Card declined:** `4000 0000 0000 0002`
   - **Requires authentication:** `4000 0025 0000 3155`
4. Use any name, any zip code
5. Confirm the payment shows in your Stripe Dashboard under **Payments**
6. Confirm the confirmation page message displays correctly

When testing passes, toggle to **Live mode** in Stripe. Your payment link URL stays the same — it automatically switches to live when your account is activated.

---

## Step 6 — Set Up Email Delivery for License Keys (Manual for Now)

Until you build automated key delivery, handle this manually:

1. In Stripe Dashboard, go to **Payments**
2. When a new payment comes in, click it to see the customer's email
3. Send them a license key email manually

**Email template to use:**

> **Subject:** Your PCLabs Pro Early Access license
>
> Hey,
>
> Thanks for grabbing PCLabs Pro Early Access — you locked in $4.99 before the price goes up.
>
> **Your license key:** `PCLABS-XXXX-XXXX-XXXX`
>
> Once the Pro features ship, you'll enter this key in the PCLabs app under Settings → Activate Pro. I'll email you when it's ready.
>
> In the meantime, join the Discord for updates and priority support:
> [your Discord invite link]
>
> — [your name], PCLabs

Keep a spreadsheet of issued keys and which email received them. A simple format:

| Date | Stripe Payment ID | Customer Email | License Key | Notes |
|---|---|---|---|---|
| 2026-03-28 | pi_XXXX | user@email.com | PCLABS-A1B2-C3D4-E5F6 | Issued manually |

---

## Step 7 — Optional Enhancements (Do Later)

These are not needed at launch but worth noting:

### Add a Stripe Webhook for Automated Key Delivery
When you're ready to automate:
1. Stripe Dashboard → **Developers → Webhooks → + Add endpoint**
2. Endpoint URL: `https://thepclabs.com/api/stripe-webhook` (you'll build this)
3. Events to listen for: `checkout.session.completed`
4. On that event: generate a license key, store it in your DB, email it to the customer

### Enable Stripe Tax (if needed)
- Dashboard → **Settings → Tax** → Enable Stripe Tax
- Stripe auto-calculates and collects sales tax / VAT based on customer location
- Required if you sell to EU customers (VAT rules) — worth enabling from the start

### Add a Refund Policy
- Dashboard → **Settings → Checkout → Policies**
- Recommended policy: "30-day refund if Pro features aren't working as described"
- This reduces chargebacks and builds trust

---

## Launch Checklist

- [ ] Stripe account created and verified
- [ ] Bank account connected
- [ ] Product created: `PCLabs Pro — Early Access` at $4.99 one-time
- [ ] Payment link generated (`https://buy.stripe.com/...`)
- [ ] Payment link pasted into `pricing.html`
- [ ] Dev warning script removed from `pricing.html`
- [ ] Test payment completed successfully with `4242 4242 4242 4242`
- [ ] Confirmation page message set correctly
- [ ] License key email template ready
- [ ] Stripe account switched to Live mode
- [ ] `pricing.html` deployed to production
- [ ] Nav link to `/pricing.html` added to `index.html` and `faq.html`
