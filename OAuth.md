# OAuth Setup — GitHub & Google via Supabase

This guide walks through enabling GitHub and Google sign-in for Prompt AI.
The code is already wired in (callback route, OAuth buttons on login/signup pages).
You only need to configure the providers in Supabase and register your apps.

**Supabase project:** `cglrkliewuidvdkfnivf`
**Supabase dashboard:** https://supabase.com/dashboard/project/cglrkliewuidvdkfnivf

---

## Step 0 – Supabase Site URL

Before enabling any provider:

1. Open Supabase dashboard → **Authentication → URL Configuration**
2. Set **Site URL** to your production domain: `https://prompt.ai`
3. Under **Redirect URLs**, add:
   ```
   https://prompt.ai/auth/callback
   http://localhost:3000/auth/callback
   ```
4. Save.

> **Why?** Supabase will only redirect OAuth tokens to URLs on this allowlist.
> The local URL lets you test sign-in during development.

---

## Step 1 – GitHub OAuth

### 1.1 Create a GitHub OAuth App

1. Go to https://github.com/settings/developers → **OAuth Apps → New OAuth App**
2. Fill in:
   | Field | Value |
   |---|---|
   | Application name | `Prompt AI` |
   | Homepage URL | `https://prompt.ai` |
   | Authorization callback URL | `https://cglrkliewuidvdkfnivf.supabase.co/auth/v1/callback` |
3. Click **Register application**
4. On the next screen, copy the **Client ID**
5. Click **Generate a new client secret** → copy the **Client Secret**

> The callback URL must be the Supabase one (not your app). Supabase exchanges
> the code, then redirects to your app's `/auth/callback` route.

### 1.2 Enable GitHub in Supabase

1. Supabase dashboard → **Authentication → Providers → GitHub**
2. Toggle **Enable GitHub provider** on
3. Paste your **Client ID** and **Client Secret**
4. Save

### 1.3 Test GitHub sign-in locally

```bash
# In /app
npm run dev
# Open http://localhost:3000/login
# Click "Continue with GitHub"
```

You should be redirected to GitHub, then back to `/dashboard`.

---

## Step 2 – Google OAuth

### 2.1 Create a Google OAuth 2.0 Client

1. Go to https://console.cloud.google.com/
2. Create a new project (or reuse an existing one): name it `Prompt AI`
3. In the sidebar: **APIs & Services → OAuth consent screen**
   - User type: **External** → Create
   - App name: `Prompt AI`
   - User support email: `oyedokunken@gmail.com`
   - Developer contact: `oyedokunken@gmail.com`
   - Save and continue (skip scopes, skip test users for now)
   - Submit for verification later when publishing
4. In the sidebar: **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs**
   - Application type: **Web application**
   - Name: `Prompt AI Web`
   - Authorised JavaScript origins:
     ```
     https://prompt.ai
     http://localhost:3000
     ```
   - Authorised redirect URIs:
     ```
     https://cglrkliewuidvdkfnivf.supabase.co/auth/v1/callback
     ```
   - Click **Create**
5. Copy **Client ID** and **Client Secret** from the popup

### 2.2 Enable Google in Supabase

1. Supabase dashboard → **Authentication → Providers → Google**
2. Toggle **Enable Google provider** on
3. Paste your **Client ID** and **Client Secret**
4. Save

### 2.3 Publishing the OAuth consent screen (production)

While in **Testing** mode only the accounts you explicitly add as test users can sign in.
Before going live:

1. **APIs & Services → OAuth consent screen → Publish App**
2. If your app accesses sensitive scopes Google will require verification — for basic
   sign-in (`email`, `profile`) no verification is needed.

---

## Step 3 – Email Auth (already enabled)

Supabase email auth is already configured in code. Make sure it is enabled:

1. **Authentication → Providers → Email**
2. Confirm **Enable Email provider** is on
3. For production, disable **Confirm email** only if you want passwordless;
   the OTP flow in `/api` handles verification separately — keep it enabled.

---

## Step 4 – How the code works

```
User clicks "Continue with GitHub/Google"
  ↓
app/(auth)/login/page.tsx calls supabase.auth.signInWithOAuth({ provider })
  ↓
Browser redirected to provider (GitHub / Google)
  ↓
Provider redirects to: https://cglrkliewuidvdkfnivf.supabase.co/auth/v1/callback
  ↓
Supabase exchanges the code, creates a session, redirects to:
  https://prompt.ai/auth/callback?code=...
  ↓
app/auth/callback/route.ts exchanges the code for a session cookie
  ↓
User redirected to /dashboard
```

The callback route is at `app/app/auth/callback/route.ts`. It already handles
the `code` → session exchange via `supabase.auth.exchangeCodeForSession(code)`.

---

## Step 5 – Checklist before shipping

- [ ] Supabase Site URL set to `https://prompt.ai`
- [ ] `https://prompt.ai/auth/callback` in Supabase redirect allowlist
- [ ] `http://localhost:3000/auth/callback` in Supabase redirect allowlist (dev)
- [ ] GitHub OAuth App created, Client ID + Secret pasted into Supabase
- [ ] Google OAuth Client created, Client ID + Secret pasted into Supabase
- [ ] Google consent screen published (or test users added for staging)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Vercel env vars

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Redirect URI mismatch | Callback URL in GitHub/Google app doesn't match the Supabase one |
| "User not found" after redirect | `/auth/callback` route failed to exchange the code |
| Redirect loop on `/login` | Middleware is redirecting before session cookie is set |
| Google sign-in only works for test users | Consent screen still in Testing mode |
| PKCE error | Make sure `flowType: "pkce"` is set in Supabase client (already configured) |
