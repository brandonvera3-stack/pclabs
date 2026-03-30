# PCLabs Monetization Roadmap

> From free tool to sustainable product.
> Principle: Everything that's free today stays free. Pro tier adds value — it does not remove it.

---

## The Core Philosophy

PCLabs earns trust by being genuinely free and genuinely useful. Monetization happens *after* trust is established and only by offering features users actually want to pay for — never by restricting existing functionality or adding dark patterns.

**Non-negotiables (never monetize these):**
- The core hardware scan (thermals, RAM speed, driver check, S.M.A.R.T.)
- Plain-English explanations of findings
- Any findings that affect user safety or data loss risk

---

## Phase Overview

| Phase | Timeline | Goal | Revenue Target |
|---|---|---|---|
| 0 — Foundation | Month 1–2 | Ship, grow, listen | $0 |
| 1 — Validate | Month 3–4 | Identify what users pay for | $0–$200/mo |
| 2 — Soft Launch | Month 5–6 | Launch Pro tier | $500–$2,000/mo |
| 3 — Scale | Month 7–12 | Grow Pro users, add features | $2,000–$8,000/mo |
| 4 — Expand | Month 13–18 | Team, partnerships, B2B | $8,000+/mo |

---

## Phase 0 — Foundation (Month 1–2)

**Goal:** Build trust and install base before touching monetization.

### Actions
- Ship the core app. Keep it fast, free, and clean.
- Launch social media (Twitter, TikTok, YouTube) per content calendar.
- Set up Discord.
- Track: downloads per week, Discord members, social follower growth.
- Read every support message and bug report — this is your product research.
- Identify the top 3 requests that come up repeatedly.

### Metrics to Hit Before Moving to Phase 1
- [ ] 500+ total downloads
- [ ] 100+ Discord members
- [ ] 1,000+ Twitter followers **or** one TikTok video with 10,000+ views
- [ ] 3 clear, recurring feature requests documented

**Do not touch monetization until these are hit.**

---

## Phase 1 — Validate (Month 3–4)

**Goal:** Confirm which features users would pay for, before building them.

### Actions

**User research (do this before writing a line of Pro code):**
1. Post a Twitter poll: "Would you pay for PCLabs if it included: scan history / PDF export / scheduled scans / priority support?"
2. Post in Discord: "What would make PCLabs worth $3–5/month to you?"
3. Look at your top feature requests — rank them by how often they appear and how much effort they require to build.

**Soft signals to watch:**
- "Is there a Pro version?" in any channel = strong buying intent
- "Can I export this?" = high-value request
- "I run this on 5 PCs" = potential multi-license or team buyer

### Feature Shortlist for Pro (validate these)

| Feature | Effort | Expected Demand |
|---|---|---|
| Scan history & timeline tracking | Medium | High |
| Export scan report as PDF | Low | Very High |
| Scheduled/automatic scans | Medium | High |
| Email alerts when issues found | Medium | Medium |
| Multi-PC monitoring (up to 5 devices) | High | Medium |
| Priority Discord support | None | Medium |
| Deeper GPU analysis (VRAM, shader errors) | Medium | Medium |
| Dark/Light theme toggle | Low | Low |

### Metrics to Hit Before Moving to Phase 2
- [ ] 2,000+ total downloads
- [ ] Validated 3+ Pro features via polls/feedback
- [ ] 250+ Discord members
- [ ] At least 5 people have directly said they'd pay for the app

---

## Phase 2 — Soft Launch (Month 5–6)

**Goal:** Ship Pro tier. Validate pricing. Start generating revenue.

### Pricing Model

**PCLabs Free** — Forever free
- All current core diagnostics
- Hardware, thermals, drivers, disk health, Windows health
- Plain-English explanations
- Manual scan on demand

**PCLabs Pro** — $4.99/month or $39/year (~35% discount)
- Everything in Free
- Scan history — track how your PC changes over time
- Export reports as PDF (shareable, archivable)
- Scheduled scans (daily/weekly, runs silently)
- Email digest — weekly health summary sent to your inbox
- Priority Discord support badge + channel access
- Early access to new features

> **Pricing rationale:** $4.99/mo is impulse-buy territory — less than a coffee. $39/yr feels like a "one-time" purchase psychologically. Offer both. Most users who pay will choose annual.

### Implementation Stack (low-overhead)

| Component | Tool | Cost |
|---|---|---|
| Payments | Stripe (one-time + subscription) | 2.9% + 30¢ per transaction |
| License management | Gumroad or LemonSqueezy | 10% fee (simpler) or Stripe direct (lower fees, more setup) |
| Email delivery | Resend or Mailgun | Free tier covers early volume |
| Backend (scan history sync) | Supabase (free tier to start) | Free up to 500MB DB |

**Recommendation for launch simplicity:** Start with LemonSqueezy. It handles VAT, licensing, and payments in one dashboard. Move to direct Stripe integration once revenue justifies the engineering time.

### Upgrade Flow in App
- Pro features are visible in the UI but locked with a subtle "Pro" badge
- Clicking a locked feature shows a clean modal: "This is a PCLabs Pro feature. [Upgrade for $4.99/mo] [Maybe later]"
- No nagging, no pop-ups, no dark patterns
- Settings → "Upgrade to Pro" always accessible

### Launch Announcement Copy (Twitter)
```
PCLabs Pro is live.

Everything free stays free. Always.

Pro adds:
→ Scan history (track your PC over time)
→ PDF export (shareable reports)
→ Scheduled scans (automatic, silent)
→ Weekly email digest
→ Priority support

$4.99/mo or $39/yr.

If you've ever found PCLabs useful, this is how you support the project.

→ [link]
```

### Metrics to Hit Before Moving to Phase 3
- [ ] 50+ paying Pro users
- [ ] $200+/month recurring revenue
- [ ] Pro churn rate under 10%/month
- [ ] Net Promoter feedback from Pro users collected

---

## Phase 3 — Scale (Month 7–12)

**Goal:** Grow Pro user base, deepen features, explore additional revenue.

### Feature Roadmap for Pro (build in this order)

**Quarter 3 (Month 7–9):**
- [ ] Scan history with visual timeline (chart: temps, RAM speed, driver age over time)
- [ ] PDF export — branded, clean, shareable
- [ ] Scheduled scans with Windows Task Scheduler integration

**Quarter 4 (Month 10–12):**
- [ ] Email digest (weekly summary, alerts for new issues)
- [ ] Multi-PC mode: manage up to 5 machines under one account
- [ ] Comparison view: "Your PC vs. typical healthy PC for your hardware tier"
- [ ] "Share results" link — generate a read-only public URL for a scan report

### Additional Revenue Streams to Explore

**1. Referral / Affiliate (low effort, passive)**
- If PCLabs recommends thermal paste → link to Amazon affiliate product
- If PCLabs flags outdated RAM → affiliate link to compatible upgrade options
- Rule: Only recommend when genuinely relevant to a scan finding. Never insert ads.
- Expected revenue: $50–$300/month once traffic scales

**2. "Recommended by PCLabs" Hardware Partners (Month 10+)**
- Partner with 1–2 PC hardware brands (thermal paste, budget SSDs)
- Sponsorship: flat monthly fee in exchange for "Recommended" label in relevant scan results
- Only pursue this if you can maintain trust — vet partners carefully
- Expected: $200–$1,000/month per partner

**3. PCLabs for Teams / IT (Month 9+)**
See Phase 4 for full B2B plan. Start with a waitlist at month 9.

### Growth Levers to Pull

| Lever | Action |
|---|---|
| YouTube | Post 2 long-form videos/month. SEO-optimized titles. Drives consistent download traffic. |
| SEO | Build landing pages for high-intent queries: "free cpu temp checker windows," "how to check if ram is running at full speed" |
| Reddit | Be helpful in r/techsupport, r/buildapc, r/pcmasterrace — never spam, always add value |
| Product Hunt | Launch on Product Hunt (aim for Top 5 of the day) — drives a spike in installs and press |
| App directory listings | Submit to AlternativeTo, Softpedia, MajorGeeks, FileHippo |

### Metrics to Hit Before Moving to Phase 4
- [ ] 300+ active Pro users
- [ ] $2,000+/month MRR (Monthly Recurring Revenue)
- [ ] 10,000+ total downloads
- [ ] Churn stabilized under 5%/month
- [ ] At least 10 inbound requests for a "team" or "business" version

---

## Phase 4 — Expand (Month 13–18)

**Goal:** Introduce B2B tier, explore hiring first contractor, build toward sustainability.

### PCLabs for Teams

**Target customer:** Small IT teams, managed service providers (MSPs), IT consultants who manage fleets of Windows machines for clients.

**The problem they have:** Running individual diagnostics on 20–50 machines is tedious. There's no easy way to get a quick health snapshot across a fleet without expensive RMM (Remote Monitoring & Management) software.

**PCLabs Teams — $19/month per seat (up to 10 devices per seat)**
- All Pro features
- Centralized dashboard: see all managed machines in one view
- Alerts when any machine crosses a threshold
- Bulk PDF report generation
- CSV export of all findings across fleet

**PCLabs Business — Custom pricing (10+ seats)**
- Everything in Teams
- Dedicated onboarding call
- SLA for support response time
- White-label report option (MSPs can brand the PDF)

> Even 20 Teams customers at $19/month = $380/month on top of existing Pro revenue. MSPs typically pay without hesitation for tools that save them time.

### Hiring Milestone

When you hit $3,000/month MRR consistently for 3 months, consider:
- First hire: Part-time contractor for Windows/Electron development ($20–40/hr, 10–15hr/week)
- This frees you to focus on growth, content, and product decisions

### Long-Term Options (Month 18+)

| Path | Description | Viability |
|---|---|---|
| Stay indie | Keep it lean, high margins, lifestyle business | High — $5K–$15K/mo MRR is achievable |
| Raise a small round | $150K–$500K angel round to hire and accelerate | Viable if growth metrics are strong |
| Acquisition | Larger diagnostics/security company acquires | Realistic at scale (10K+ paid users) |

---

## Revenue Model Summary

| Stream | Phase | Est. Monthly at Scale |
|---|---|---|
| PCLabs Pro ($4.99/mo or $39/yr) | Phase 2+ | $3,000–$10,000 |
| Affiliate / hardware links | Phase 3+ | $100–$500 |
| Hardware partner sponsorships | Phase 3+ | $200–$2,000 |
| PCLabs Teams ($19/seat/mo) | Phase 4+ | $1,000–$5,000 |
| PCLabs Business (custom) | Phase 4+ | $500–$3,000 |

**Realistic 18-month ceiling (solo developer, no funding):** $8,000–$15,000/month gross

---

## Anti-Patterns to Avoid

- **Do not** add ads to the free tier. It destroys trust and earns almost nothing.
- **Do not** gate existing free features behind Pro. Treat this as a hard rule.
- **Do not** launch Pro before you have enough users to get meaningful conversion data.
- **Do not** underprice out of fear. $4.99/mo is already cheap. If users find value, they pay.
- **Do not** add a freemium "scan limit" (e.g., only 3 scans/month free). This is anti-user and will kill growth.
- **Do not** build Teams before you have inbound demand. Wait for 10 real requests first.
