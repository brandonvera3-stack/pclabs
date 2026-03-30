# PCLabs Discord Server Setup Guide

> Copy-paste ready. Execute top to bottom.

---

## 1. Create the Server

1. Open Discord → click **+** (Add a Server) → **Create My Own** → **For a club or community**
2. Name: **PCLabs**
3. Upload the PCLabs logo as the server icon
4. Region: **Optimal** (auto)

---

## 2. Categories & Channels

Create in this exact order. Category names are in ALL CAPS.

### WELCOME
| Channel | Type | Purpose |
|---|---|---|
| `#welcome` | Text | Rules, intro, server overview |
| `#announcements` | Text | App updates, releases, news (announcement channel — slow mode off, only mods post) |
| `#roles` | Text | Self-assign roles via reactions |

### COMMUNITY
| Channel | Type | Purpose |
|---|---|---|
| `#general` | Text | General chat |
| `#introductions` | Text | New members say hi |
| `#off-topic` | Text | Anything goes (within rules) |

### PCLABS HELP
| Channel | Type | Purpose |
|---|---|---|
| `#ask-a-question` | Text | Users post PC problems; community helps |
| `#share-your-results` | Text | Screenshot your PCLabs scan results |
| `#bug-reports` | Text | App bugs only — pinned template at top |
| `#feature-requests` | Text | Suggest features; react with ✅ to upvote |

### CONTENT & SOCIAL
| Channel | Type | Purpose |
|---|---|---|
| `#content-drops` | Text | Links to new YouTube, TikTok, Twitter posts |
| `#memes` | Text | PC memes, jokes, cursed builds |

### VOICE
| Channel | Type | Purpose |
|---|---|---|
| `🔊 Lounge` | Voice | General hangout |
| `🔊 Tech Support Live` | Voice | Real-time help sessions |

---

## 3. Roles

Create these roles in order (top = highest). Assign colors as noted.

| Role | Color | Who Gets It | How |
|---|---|---|---|
| `⚡ PCLabs Dev` | `#4f8ef7` (blue) | You (owner) | Manual |
| `🛠️ Moderator` | `#a78bfa` (purple) | Trusted mods | Manual |
| `🧰 Helper` | `#34d399` (green) | Active helpers | Manual |
| `🖥️ Power User` | `#f59e0b` (amber) | 50+ messages, verified helpful | Manual or bot |
| `🧪 Beta Tester` | `#f97316` (orange) | Anyone who tests pre-release builds | Manual |
| `👾 Member` | `#e8e8f0` (white-ish) | Everyone after verification | Auto |
| `🤖 Bot` | `#6b7280` (gray) | Bots | Manual |

### Role Permissions Summary
- **Dev / Mod**: All permissions except 2FA bypass
- **Helper**: Can manage messages in help channels
- **Power User / Beta / Member**: Standard member perms — read, send, react
- **#announcements**: Only Dev + Mod can send messages

---

## 4. Server Settings

**Overview**
- Server name: `PCLabs`
- System messages channel: `#welcome`
- Enable: "Send a random welcome message when someone joins" → **OFF** (you'll use your own)

**Moderation**
- Verification level: **Medium** (must have verified email, on Discord 5+ min)
- Explicit media content filter: **Scan messages from all members**

**Community Features** (if eligible)
- Enable Community Server
- Set `#welcome` as Rules channel
- Set `#announcements` as Updates channel

---

## 5. Welcome Message Copy

Post this in `#welcome` and **pin it**.

---

> **Welcome to the official PCLabs Discord!**
>
> PCLabs is a free Windows PC diagnostics tool that checks your hardware, thermals, drivers, and more — in plain English, no tech degree required.
>
> **Get started:**
> 📥 Download the app → https://thepclabs.com/download
> ❓ Got a question? → #ask-a-question
> 🐛 Found a bug? → #bug-reports
> 💡 Have an idea? → #feature-requests
>
> **Server rules:**
> 1. Be respectful. No harassment, hate speech, or personal attacks.
> 2. Keep it on topic. Help channels are for PC/PCLabs questions only.
> 3. No spam, self-promo, or unsolicited DMs.
> 4. No piracy, key sharing, or links to malicious software.
> 5. English only in main channels so everyone can help each other.
>
> Grab a role in #roles and introduce yourself in #introductions.
> We're glad you're here. 🖥️

---

## 6. Pinned Bug Report Template

Pin this in `#bug-reports`:

---

> **Before posting a bug, search to make sure it hasn't been reported.**
>
> **Bug Report Template:**
> ```
> PCLabs Version:
> Windows Version (10/11, build number):
> What happened:
> What you expected to happen:
> Steps to reproduce:
> Screenshot or error message (if any):
> ```

---

## 7. Bots to Add (Optional but Recommended)

| Bot | Purpose | Invite |
|---|---|---|
| **MEE6** | Welcome DMs, auto-role on join, leveling | mee6.xyz |
| **Carl-bot** | Reaction roles for `#roles` channel | carl.gg |
| **Ticket Tool** | Private support tickets (advanced help) | tickettool.xyz |

### Carl-bot Reaction Role Setup (for #roles)
Post this message in `#roles`, then use Carl-bot to attach reactions:

> **Pick your roles:**
>
> 🧪 — Beta Tester (I want early access to new builds)
> 💬 — Content Pings (notify me when new videos/posts drop)
> 🔔 — Update Pings (notify me on new PCLabs releases)

---

## 8. Launch Checklist

- [ ] Server created with logo
- [ ] All categories and channels created
- [ ] All roles created with correct colors and permissions
- [ ] Welcome message posted and pinned in `#welcome`
- [ ] Bug report template pinned in `#bug-reports`
- [ ] Bots invited and configured
- [ ] Reaction roles live in `#roles`
- [ ] Announcement channel permissions locked to Dev/Mod only
- [ ] Invite link created (never-expire, unlimited uses) and saved
