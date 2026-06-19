# 🌟 Rahasya Social Distribution Engine

**Automatically publish Rahasya horoscope content to Facebook, Instagram, and Threads — using only official APIs, GitHub Actions, and Supabase. Zero dollars/month.**

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [GitHub Secrets Setup](#github-secrets-setup)
- [Local Development](#local-development)
- [Available Commands](#available-commands)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Adding a New Platform](#adding-a-new-platform)
- [How Idempotency Works](#how-idempotency-works)
- [How Retry Works](#how-retry-works)
- [Token Renewal Guide](#token-renewal-guide)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
social_assets (Supabase)
       │
       ▼
fetchUnpublishedAssets()
       │
       ▼
lockAsset()  ◄── prevents concurrent duplicate publishes
       │
       ├──► FacebookPublisher.publish(asset)
       │         │
       │         ├── isAlreadyPublished() ◄── idempotency guard
       │         ├── validateAsset()
       │         ├── validateImage()
       │         ├── generateCaption("facebook")
       │         ├── publishToFacebook() ◄── Meta Graph API v21.0
       │         ├── markPlatformPublished()
       │         └── writePostLog()
       │
       ├──► InstagramPublisher.publish(asset)
       │         │
       │         └── publishToInstagram() ◄── 2-step container → publish
       │
       └──► ThreadsPublisher.publish(asset)
                 │
                 └── publishToThreads() ◄── Threads Graph API
```

**Key design decisions:**

- **BasePublisher** — abstract class; every platform extends it. Adding Pinterest/Twitter/LinkedIn requires only a new file.
- **Idempotency** — double-checked via platform flags AND `social_post_logs`. Safe to rerun the workflow N times.
- **Asset locking** — `processing` + `processing_started_at` columns prevent two GitHub Actions runs from posting the same asset simultaneously.
- **Retry queue** — `social_queue` table tracks failed posts with exponential backoff (0 → 15m → 1h → 6h).
- **Analytics** — every publish attempt (success/fail/skip) is written to `social_post_logs`. Future dashboard can query this table.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | GitHub Actions uses Node 20 |
| Supabase project | Free tier sufficient |
| Facebook Developer App | Must be approved for `pages_manage_posts` |
| Instagram Business Account | Linked to Facebook Page |
| Threads Account | Must apply for Threads API access at developers.facebook.com |

---

## Database Setup

Run the migration **once** in your Supabase SQL Editor:

```
supabase/migrations/001_social_distribution_engine.sql
```

This adds:
- `processing` and `processing_started_at` columns to `social_assets`
- Creates `social_post_logs` table (audit trail)
- Creates `social_queue` table (retry queue)
- Adds indexes for performance
- Configures Row Level Security

**Verify it worked:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;
```

You should see: `social_assets`, `social_post_logs`, `social_queue`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

### SUPABASE_URL
Your project URL from: **Supabase Dashboard → Project Settings → API → Project URL**

```
SUPABASE_URL=https://abcdefghij.supabase.co
```

### SUPABASE_SERVICE_ROLE_KEY
The `service_role` key (NOT the `anon` key). Found at: **Project Settings → API → service_role**

⚠️ Keep this secret. It bypasses Row Level Security.

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### FACEBOOK_PAGE_ID
Your Facebook Page ID. Found at: **Page Settings → About → Page ID**, or via:
```
GET https://graph.facebook.com/v21.0/me/accounts?access_token=YOUR_TOKEN
```

```
FACEBOOK_PAGE_ID=123456789012345
```

### FACEBOOK_ACCESS_TOKEN
A **long-lived Page Access Token**. Steps to generate:

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create an App → Business type
3. Add "Facebook Login" and "Instagram Graph API" products
4. Graph API Explorer → Get User Token with permissions:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
5. Exchange for long-lived token (60 days):
   ```
   GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN
   ```
6. Get Page Access Token from long-lived user token:
   ```
   GET /me/accounts?access_token=LONG_LIVED_USER_TOKEN
   ```

For **permanent** tokens: use a System User in Meta Business Manager.

```
FACEBOOK_ACCESS_TOKEN=EAABs0Z...
```

### INSTAGRAM_BUSINESS_ID
Your Instagram Business Account ID. Get it via:
```
GET /me?fields=instagram_business_account&access_token=PAGE_TOKEN
```
Then:
```
GET /INSTAGRAM_ACCOUNT_ID?fields=id,username&access_token=PAGE_TOKEN
```

```
INSTAGRAM_BUSINESS_ID=987654321098765
```

> Instagram uses the same `FACEBOOK_ACCESS_TOKEN` — no separate token needed.

### THREADS_USER_ID
Your Threads user ID. After getting API access:
```
GET https://graph.threads.net/v1.0/me?fields=id,username&access_token=THREADS_TOKEN
```

```
THREADS_USER_ID=111222333444555
```

### THREADS_ACCESS_TOKEN
Generated via the Threads API OAuth flow. Required scopes:
- `threads_basic`
- `threads_content_publish`

See: [developers.facebook.com/docs/threads](https://developers.facebook.com/docs/threads)

```
THREADS_ACCESS_TOKEN=THBwfTZ...
```

---

## GitHub Secrets Setup

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

Add all 7 secrets:

| Secret Name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `FACEBOOK_PAGE_ID` | Facebook Page numeric ID |
| `FACEBOOK_ACCESS_TOKEN` | Long-lived Page Access Token |
| `INSTAGRAM_BUSINESS_ID` | Instagram Business Account ID |
| `THREADS_USER_ID` | Threads user numeric ID |
| `THREADS_ACCESS_TOKEN` | Threads long-lived access token |

**Never** commit `.env` to git. It's in `.gitignore`.

---

## Local Development

```bash
# Clone and install
git clone https://github.com/YOUR_ORG/rahasya-social-distribution-engine
cd rahasya-social-distribution-engine
npm install

# Copy and fill env
cp .env.example .env
# Edit .env with your credentials

# Build TypeScript
npm run build

# Health check (validates all credentials)
npm run health-check

# Dry run (no publishing — validates everything)
npm run dry-run

# Publish all pending assets
npm run publish:social
```

---

## Available Commands

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run health-check` | Validate all API credentials and Supabase connection |
| `npm run dry-run` | Fetch assets, validate images and captions — no publishing |
| `npm run publish:social` | Main workflow: publish all pending assets |
| `npm run publish:asset -- --id=123` | Publish one specific asset |
| `npm run publish:asset -- --id=123 --platform=instagram` | Publish one asset to one platform |
| `npm run retry:failed` | Process the retry queue for failed posts |
| `npm run daily:report` | Print a summary of the last 25 hours |
| `npm run backfill` | Publish ALL historical unpublished assets in batches |

---

## GitHub Actions Workflows

The workflow file is at `.github/workflows/social-publisher.yml`.

### Automatic schedule
Runs every day at **7:00 AM IST** (1:30 AM UTC). Publishes new assets, then runs retry queue, then prints daily report.

### Manual triggers
Go to **GitHub → Actions → Rahasya Social Publisher → Run workflow**

Available modes:
- **publish** — normal publish run
- **dry-run** — preview without posting
- **retry** — process retry queue only
- **report** — print daily report only
- **health-check** — validate credentials only
- **backfill** — publish all historical assets

### Concurrency protection
The workflow uses `concurrency: group: social-publisher` — GitHub will never run two publishing jobs simultaneously. Combined with the database-level `processing` lock, duplicate posts are impossible.

---

## Adding a New Platform

To add Pinterest (or Twitter, LinkedIn, Reddit) — only **one new file** is needed:

```typescript
// src/publishers/PinterestPublisher.ts
import { BasePublisher } from "./BasePublisher.js";
import { SocialAsset, Platform } from "../types/socialAsset.js";

export class PinterestPublisher extends BasePublisher {
  readonly platform: Platform = "pinterest"; // add "pinterest" to Platform type

  protected validateForPlatform(asset: SocialAsset): string | null {
    // Pinterest-specific validation
    return null;
  }

  protected async publishToAPI(asset: SocialAsset) {
    // Call Pinterest API
    return { postId: "...", postUrl: "..." };
  }
}
```

Then register it in `src/workflows/publishSocial.ts`:
```typescript
const publishers = {
  facebook: new FacebookPublisher(),
  instagram: new InstagramPublisher(),
  threads: new ThreadsPublisher(),
  pinterest: new PinterestPublisher(), // ← add this
};
```

No changes needed to BasePublisher, Supabase service, analytics, or retry logic. It all inherits automatically.

---

## How Idempotency Works

The system uses **two independent checks** before every publish:

1. **Platform flag** — `social_assets.facebook_published`, `instagram_published`, `threads_published`
2. **Post log** — queries `social_post_logs` for a `status = 'success'` entry

Both must be false/absent for publishing to proceed. This means:
- Workflow reruns are safe
- Manual re-triggers are safe
- GitHub retrying a failed job is safe
- Two concurrent runs (extremely unlikely given concurrency lock) are safe

---

## How Retry Works

When a publish fails, the error is written to `social_post_logs` and a retry is queued in `social_queue`.

Retry schedule:
| Attempt | Delay |
|---|---|
| 1 (initial) | Immediate |
| 2 | 15 minutes |
| 3 | 1 hour |
| 4 | 6 hours |

After attempt 4 fails, the item stays in `social_queue` with `status = 'failed'` and `retry_count = 3`. No further automatic retries. You can manually rerun with:
```bash
npm run publish:asset -- --id=<asset_id>
```

---

## Token Renewal Guide

Facebook/Instagram Page Access Tokens expire after 60 days unless you use a System User. Set a recurring calendar reminder.

**To renew:**

1. Go to [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. Generate new long-lived token (see [Environment Variables](#environment-variables) above)
3. Update `FACEBOOK_ACCESS_TOKEN` in GitHub Secrets
4. Run `npm run health-check` to confirm

**Threads tokens** also expire. Re-authenticate via the Threads OAuth flow and update `THREADS_ACCESS_TOKEN` in GitHub Secrets.

**Pro tip:** Use Meta Business Manager System Users for non-expiring tokens.

---

## Troubleshooting

### "Missing required environment variable"
All 7 env vars must be set. Run `npm run health-check` to identify which one is missing.

### Facebook API error code 190 / OAuthException
Token is expired or invalid. Regenerate it (see Token Renewal Guide).

### Instagram container stuck in IN_PROGRESS
- Image URL may be unreachable from Meta's servers
- Ensure image is publicly accessible HTTPS URL (no auth, no signed URLs)
- Image must be JPEG or PNG, under 8MB

### Threads posts not appearing
- Verify `THREADS_USER_ID` matches your account (run `GET /me` via Threads API)
- Threads API may require re-approval for content_publish scope

### "Asset lock already held"
Another workflow run is in progress. Wait for it to complete. If a run crashed without releasing the lock, the engine auto-expires stale locks after 10 minutes.

### Build fails with TypeScript errors
```bash
npm run build 2>&1
```
All errors must be resolved before deploying. Do not skip TypeScript checks.

---

## Cost Breakdown

| Service | Cost |
|---|---|
| Supabase (free tier) | $0 |
| GitHub Actions (2,000 min/month free) | $0 |
| Meta Graph API | $0 |
| Threads API | $0 |
| **Total** | **$0/month** |

GitHub Actions usage: ~2 minutes/day × 30 days = 60 minutes/month (well within the 2,000 minute free tier).
