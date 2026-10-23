# Voice assistant setup (one time)

The assistant has three parts:

```
Phone / laptop browser ──► Cloudflare Worker (holds the NVIDIA key) ──► NVIDIA model
   speech-to-text + voice           wallet-ai, free plan                  meta/llama-3.1-70b-instruct
   (built into the browser)
```

* **The NVIDIA key only ever lives in Cloudflare**, as an encrypted secret. It is not in the code, the GitHub repo, `.env.local`, or the browser.
* The Worker only answers requests from the sites you list (`ALLOWED_ORIGINS`), limits how many requests each visitor can send per minute, and caps reply size.
* Voice is free: the browser's built-in speech recognition (Chrome, Edge, Safari; not Firefox) and its built-in voice for replies. Language: English.
* Until you finish these steps the app uses **Basic mode**, a simple on-device parser for sentences like "lunch 18.50 yesterday on AMEX".

Commands below are for **Windows Command Prompt**, run from the `wallet-app` folder.

---

## 1. Get your NVIDIA API key

1. Go to **https://build.nvidia.com** and sign in (or create a free account).
2. Open your profile menu, choose **API Keys**, then **Generate API Key**.
3. Copy the key (it starts with `nvapi-`). It is shown only once, so save it in a password manager.

> Never paste the key into a chat, an issue, a commit, `.env.local`, or the app. Step 4 is the only place it goes.

## 2. Create a free Cloudflare account

1. Sign up at **https://dash.cloudflare.com/sign-up** (the free plan is enough).
2. In the dashboard, open **Workers & Pages** once. Cloudflare asks you to pick a `workers.dev` subdomain; choose any name, e.g. `kesava`.

## 3. Install the Worker tools and log in

```bat
cd worker
npm install
npx wrangler login
```

A browser tab opens. Click **Allow**, then return to the terminal.

## 4. Store the NVIDIA key as a Cloudflare secret

```bat
npx wrangler secret put NVIDIA_API_KEY
```

Paste the key when asked and press Enter. Nothing is shown while you paste; that's normal. (If wrangler asks to create the Worker first, answer **Yes**.)

## 5. Allow your sites

Open `worker/wrangler.toml` and edit `ALLOWED_ORIGINS`. Use the **site address only**, with no path and no trailing slash:

```toml
ALLOWED_ORIGINS = "http://localhost:3000,https://YOUR-GITHUB-USERNAME.github.io"
```

Add more, separated by commas, if you host elsewhere too, e.g. `https://wallet.yourdomain.com`.

## 6. Deploy the Worker

```bat
npx wrangler deploy
```

It prints your Worker address, e.g. `https://wallet-ai.kesava.workers.dev`.

**Check it:** open `https://wallet-ai.kesava.workers.dev/health` in a browser. You should see `"ok": true`. If it says `"ok": false`, the secret from step 4 is missing.

## 7. Connect the app

1. Start the app (`cd ..` then `npm run dev`) and open **Profile → Voice assistant**.
2. Paste the Worker address into **Assistant URL** and click **Save & test**. You should see **Connected · meta/llama-3.1-70b-instruct**.

Optional: to make this address the default (so you don't type it in each browser), create `wallet-app\.env.local`:

```
NEXT_PUBLIC_AI_ENDPOINT=https://wallet-ai.kesava.workers.dev
```

The Worker address is **not** a secret. It is useless without an allowed origin, and the key stays in Cloudflare.

## 8. Publish on GitHub Pages

1. Move the deploy workflow into place (once):
   ```bat
   mkdir .github\workflows
   move docs\deploy.yml .github\workflows\deploy.yml
   ```
2. Push the project to GitHub. `.gitignore` already keeps out `.env.local`, `worker/.dev.vars` and `node_modules`.
3. In the repo, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Go to **Settings → Secrets and variables → Actions → Variables** and add:
   * `AI_ENDPOINT` = your Worker address
   * `BASE_PATH` = `/your-repo-name`. Leave it empty if the repo is named `YOUR-USERNAME.github.io`.
5. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes the site.
6. Make sure `https://YOUR-USERNAME.github.io` is in `ALLOWED_ORIGINS` (step 5), then run `npx wrangler deploy` again.

---

## Using it

* **Phone / tablet:** hold the **+** button for 3 seconds (a ring fills), speak, and let go to send. A normal tap still opens the regular form.
* **Laptop:** double-click the **+** in the dock. A single click still opens the regular form.
* Or tap **Speak instead** at the top of the add form, or type into the assistant's text box.
* The first time, the browser asks for microphone permission. Choose **Allow**.
* You can say several things at once, e.g. *"Lunch at McD 25.50 on AMEX yesterday, and move 200 from Everyday to Savings every month."* You'll see each transaction to check, edit or remove before **Add all**. Turn on **Add without confirming** in Profile to skip this.

## Keeping it safe

* **If the key ever leaks:** revoke it on build.nvidia.com, create a new one, and run `npx wrangler secret put NVIDIA_API_KEY` again. No app rebuild is needed.
* **Extra protection (optional):** in Cloudflare go to **Security → WAF → Rate limiting rules** and add a rule for your `workers.dev` route.
* **See requests live:** `cd worker` then `npx wrangler tail`. Keys are never logged.
* **Before every commit:** check `git status`. It should never list `.dev.vars` or `.env.local`.

## Local Worker testing (optional)

```bat
cd worker
copy .dev.vars.example .dev.vars
REM edit .dev.vars and paste your key (this file is git-ignored)
npm run dev
```

Then set the app's Assistant URL to `http://localhost:8787`.

## Changing the model

Edit `NVIDIA_MODEL` in `worker/wrangler.toml` to any chat model on build.nvidia.com (e.g. `meta/llama-3.3-70b-instruct`), then run `npx wrangler deploy`. NVIDIA's free credits are limited, and larger models use more per request.
