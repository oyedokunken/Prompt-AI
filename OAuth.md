# OAuth Setup — GitHub & Google via Supabase

The code is already wired in — callback route, OAuth buttons, session handling.
You only need to fill in the provider dashboards and paste the keys into Supabase.

| | |
|---|---|
| **Supabase project ref** | `cglrkliewuidvdkfnivf` |
| **Supabase dashboard** | https://supabase.com/dashboard/project/cglrkliewuidvdkfnivf |
| **Production URL** | `https://prompt-swe.vercel.app` |
| **Supabase callback URL** | `https://cglrkliewuidvdkfnivf.supabase.co/auth/v1/callback` |

---

## Step 0 — Supabase URL configuration (do this first)

**Authentication → URL Configuration**

| Field | Value |
|---|---|
| Site URL | `https://prompt-swe.vercel.app` |
| Redirect URLs (add both) | `https://prompt-swe.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` |

Save before moving on. Supabase will only send tokens back to URLs on this list.

---

## Step 1 — GitHub OAuth App

### 1.1 — Register the app at GitHub

**Go to:** https://github.com/settings/developers → OAuth Apps → **New OAuth App**

Fill in every field exactly as shown:

| GitHub field | Value to enter |
|---|---|
| **Application name** | `Prompt AI` |
| **Homepage URL** | `https://prompt-swe.vercel.app` |
| **Application description** | `Structured prompts from plain language — turn vague instructions into detailed, optimised AI prompts.` |
| **Redirect URI** | `https://cglrkliewuidvdkfnivf.supabase.co/auth/v1/callback` |
| Allow wildcard matching | **Leave unchecked** |
| Enable Device Flow | **Leave unchecked** |
| Expire user access tokens | **Leave unchecked** (Supabase manages its own token lifetime) |

Click **Register application**.

On the next screen:
1. Copy the **Client ID** — you'll paste it into Supabase
2. Click **Generate a new client secret** → copy the secret immediately (it is only shown once)

> The redirect URI **must** point at Supabase, not your app. Supabase exchanges the
> code server-side, then redirects the user to `https://prompt-swe.vercel.app/auth/callback`.

### 1.2 — Enable GitHub in Supabase

**Authentication → Providers → GitHub**

| Supabase field | Value to enter |
|---|---|
| **GitHub enabled** | Toggle **on** |
| **Client ID** | Paste the Client ID from step 1.1 |
| **Client Secret** | Paste the Client Secret from step 1.1 |
| Allow users without an email | Leave **off** (GitHub exposes email; no need) |
| **Callback URL** | Already filled — `https://cglrkliewuidvdkfnivf.supabase.co/auth/v1/callback` (read-only, for reference) |

Click **Save**.

---

## Step 2 — Google OAuth

### 2.1 — OAuth consent screen (one-time setup)

**Go to:** https://console.cloud.google.com → create or select a project named `Prompt AI`

**APIs & Services → OAuth consent screen**

| Field | Value |
|---|---|
| User type | **External** |
| App name | `Prompt AI` |
| User support email | `oyedokunken@gmail.com` |
| App logo | *(optional — upload your logo PNG)* |
| App domain – Homepage link | `https://prompt-swe.vercel.app` |
| App domain – Privacy policy | `https://prompt-swe.vercel.app/privacy` *(add later)* |
| Authorised domains | `vercel.app` |
| Developer contact email | `oyedokunken@gmail.com` |

Click **Save and Continue**. On the **Scopes** screen add nothing extra — the defaults (`email`, `profile`, `openid`) are all you need. Continue through to the summary and click **Back to Dashboard**.

> While the app is in **Testing** mode, only Google accounts you add as test users can sign in.
> Add your own Gmail as a test user now so you can verify the flow.
> Publish when you're ready to open it to everyone.

### 2.2 — Create OAuth 2.0 credentials

**APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**

| Field | Value |
|---|---|
| Application type | **Web application** |
| Name | `Prompt AI Web` |
| Authorised JavaScript origins | `https://prompt-swe.vercel.app` |
| *(add second origin)* | `http://localhost:3000` |
| Authorised redirect URIs | `https://cglrkliewuidvdkfnivf.supabase.co/auth/v1/callback` |

Click **Create**. A popup shows your **Client ID** and **Client Secret** — copy both now.

### 2.3 — Enable Google in Supabase

**Authentication → Providers → Google**

| Supabase field | Value to enter |
|---|---|
| **Enable Sign in with Google** | Toggle **on** |
| **Client IDs** | Paste the Client ID from step 2.2 |
| **Client Secret (for OAuth)** | Paste the Client Secret from step 2.2 |
| Skip nonce checks | Leave **off** |
| Allow users without an email | Leave **off** |
| **Callback URL** | Already filled — `https://cglrkliewuidvdkfnivf.supabase.co/auth/v1/callback` (read-only) |

Click **Save**.

---

## Step 3 — Email auth (already in code)

**Authentication → Providers → Email**

| Field | Value |
|---|---|
| Enable Email provider | **On** |
| Confirm email | **On** — the custom OTP flow in `/api` handles this; keep it enabled |

---

## How the flow works end to end

```
User clicks "Continue with GitHub" or "Continue with Google"
  ↓
login/page.tsx calls supabase.auth.signInWithOAuth({ provider })
  ↓
Browser is redirected to GitHub / Google for authorisation
  ↓
Provider redirects to Supabase callback:
  https://cglrkliewuidvdkfnivf.supabase.co/auth/v1/callback
  ↓
Supabase exchanges the code, creates a session, redirects to:
  https://prompt-swe.vercel.app/auth/callback?code=...
  ↓
app/auth/callback/route.ts calls supabase.auth.exchangeCodeForSession(code)
  ↓
Session cookie is set → user redirected to /dashboard
```

---

## Pre-ship checklist

- [ ] Supabase Site URL → `https://prompt-swe.vercel.app`
- [ ] Supabase Redirect URLs include `https://prompt-swe.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`
- [ ] GitHub OAuth App registered with correct Redirect URI (Supabase callback)
- [ ] GitHub Client ID + Secret pasted into Supabase → GitHub provider
- [ ] Google consent screen created, your Gmail added as test user
- [ ] Google OAuth Client created with correct origins + redirect URI
- [ ] Google Client ID + Secret pasted into Supabase → Google provider
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in Vercel env vars
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Vercel env vars
- [ ] Google consent screen published when opening to real users

---

## Troubleshooting

| Symptom | Cause + fix |
|---|---|
| `redirect_uri_mismatch` (GitHub or Google) | The Redirect URI / Authorised redirect URI in the provider app doesn't exactly match `https://cglrkliewuidvdkfnivf.supabase.co/auth/v1/callback` — check for trailing slash |
| `Error 400: redirect_uri_mismatch` (Google) | The origin (`https://prompt-swe.vercel.app`) is missing from Authorised JavaScript origins |
| Blank page after GitHub redirect | `/auth/callback` route failed — check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel |
| "Access blocked: This app's request is invalid" | Google consent screen is in Testing and your account isn't a test user |
| Redirect loop on `/login` | Middleware running before session cookie is written — make sure the callback route path isn't blocked by the middleware matcher |
| Sign-in works locally but not on Vercel | Supabase Site URL still points to localhost, or redirect URL allowlist doesn't include the Vercel domain |
