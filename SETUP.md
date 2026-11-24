# Gear Cage setup guide

Gear Cage runs as a website on **GitHub Pages**. It stores data in **Supabase**, and your crew sign in with their **Kehelmala Microsoft 365 accounts**. All three are free at your size. Setup takes about an hour, once.

You'll set up four things, in this order:

1. **Supabase**, the database
2. **Microsoft sign-in**, so crew can log in with their work accounts
3. **GitHub Pages**, which hosts the app
4. **Connecting them**, by filling in `config.js`

Keep a notes file open. You'll copy a few values from one site to another.

> **Try it first.** Open `index.html` from GitHub Pages before filling in `config.js` (step 3 before step 4) and the app runs in **demo mode** with example gear. Nothing is shared in demo mode.

---

## 1. Supabase (the database)

1. Go to **supabase.com** and sign up (free).
2. Click **New project**.
   - Name: `gear-cage`
   - Database password: generate one and save it in your password manager.
   - Region: **Southeast Asia (Singapore)** or **South Asia (Mumbai)**. These are closest to Colombo.
   - Plan: Free.
3. When the project is ready, open **SQL Editor** in the left menu, then **New query**.
4. Open `supabase/schema.sql` from this folder, copy everything, paste it in, and click **Run**. You should see "Success. No rows returned".
5. Still in the SQL Editor, make yourself the admin and let company accounts in automatically. Change the two values, then run:

   ```sql
   update public.settings
   set owner_email = 'you@kehelmala.com',
       allowed_domain = 'kehelmala.com'
   where id = 1;
   ```

   - `owner_email`: your own work email. You become admin the first time you sign in.
   - `allowed_domain`: anyone signing in with an email at this domain becomes crew straight away. Anyone else (freelancers) waits until you approve them in the app.
6. Go to **Project Settings**, then **API** (on some accounts it's **API Keys**). Copy these into your notes:
   - **Project URL**, which looks like `https://abcdefghijklm.supabase.co`
   - The **anon public** key, which is a long string. Newer projects may show a **publishable** key starting `sb_publishable_` instead. Either works.

   Do **not** copy the `service_role` or secret key anywhere.

## 2. Microsoft sign-in

You need to be a Microsoft 365 admin for your company, or ask whoever is.

1. Go to **entra.microsoft.com** and sign in with your work account.
2. Open **Applications**, then **App registrations**, then **New registration**.
   - Name: `Gear Cage`
   - Supported account types: **Accounts in this organizational directory only**.
   - Redirect URI: choose **Web** and enter
     `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
     using your Project URL from step 1.6.
   - Click **Register**.
3. On the app's **Overview** page, copy these into your notes:
   - **Application (client) ID**
   - **Directory (tenant) ID**
4. Open **Certificates & secrets**, then **New client secret**.
   - Description: `Supabase`. Expires: **24 months**.
   - Copy the secret's **Value** now, because it's only shown once. You don't need the Secret ID.
   - Put a reminder in your calendar for 23 months from now. When the secret expires, sign-in stops until you make a new one and paste it into Supabase.
5. Open **Token configuration**, then **Add optional claim**, choose **ID**, and tick **email** and **xms_edov** (Supabase recommends both). Click **Add**. If Microsoft asks about Graph permissions, accept. If **xms_edov** isn't in the list, open **Manifest** instead and add `xms_edov` and `email` under `optionalClaims` > `idToken`, then click **Save**.
6. Back in **Supabase**, go to **Authentication**, then **Sign In / Providers** (on some accounts **Providers**), then **Azure**.
   - Turn it on.
   - **Application (client) ID**: from step 2.3.
   - **Secret Value**: from step 2.4.
   - **Azure Tenant URL**: `https://login.microsoftonline.com/YOUR-TENANT-ID`, using the Directory (tenant) ID from step 2.3. This limits sign-in to Kehelmala accounts.
   - Save.

**Freelancers without a Kehelmala account** can use the "email me a sign-in link" option on the sign-in page. Supabase's built-in email service only sends a few emails per hour, which is fine for occasional use. You approve these people under **More**, then **People**.

## 3. GitHub Pages (hosting)

1. Go to **github.com** and sign up (free).
2. Click **New repository**.
   - Name: `gear-cage`
   - Visibility: **Public**. Free GitHub Pages needs a public repository. Only the app's code is public. Your gear data stays in Supabase behind sign-in.
   - Click **Create repository**.
3. On the new repository page, click **uploading an existing file**.
4. In Finder, open this `gear-cage-team` folder. Select **everything inside it** (`index.html`, `config.js`, `sw.js`, `manifest.webmanifest`, and the `css`, `js`, `assets` and `supabase` folders) and drag it onto the GitHub page. Keep the folders as they are.
5. Click **Commit changes**.
6. Open the repository's **Settings**, then **Pages**.
   - Source: **Deploy from a branch**. Branch: **main**, folder **/ (root)**. Click **Save**.
   - After a minute or two the page shows your site address, such as `https://YOUR-NAME.github.io/gear-cage/`. Copy it into your notes.

## 4. Connect them

1. In **Supabase**, go to **Authentication**, then **URL Configuration**.
   - **Site URL**: your GitHub Pages address from step 3.6.
   - Under **Redirect URLs**, add the same address. Save.
2. On **GitHub**, open `config.js` in your repository and click the pencil icon to edit it. Fill in:

   ```js
   supabaseUrl: "https://YOUR-PROJECT.supabase.co",
   supabaseAnonKey: "your anon or publishable key",
   ```

   Click **Commit changes**.
3. Wait a minute, then open your site address. You should see **Sign in with Microsoft**. Sign in with the email you set as `owner_email`. You're the admin.

## 5. First day

1. **Install it on phones.**
   - iPhone: open the site in Safari, tap **Share**, then **Add to Home Screen**.
   - Android: open it in Chrome and tap **Install app**.

   Allow camera access the first time you scan.
2. **Load your gear.** Go to **Gear**, then **Import**, then **Download template**. Fill it in with one row per item:
   - Cases get **Is case: Yes**.
   - Gear with a fixed place in a case gets that case's tag in **Home case**, for example `CSE-0001`.
   - Small parts that are easy to forget get **Critical: Yes**.
   - **Quantity** makes identical units, such as 6 batteries, each with its own tag.

   Save it as CSV and import it.
3. **Print labels.** Go to **More**, then **Print QR labels**.
   - Small labels (38 × 21 mm sheets) suit cables, cards and batteries.
   - Medium labels suit bodies, lenses and monitors.
   - Case labels go on Pelicans.

   In the print dialog, set scale to **100%** and margins to **None**.
4. **Make kits.** Go to **More**, then **Kits**. Add cases to a kit and everything that lives in them comes along.
5. **Invite the crew.** Send them the site address. With `allowed_domain` set, they're in as soon as they sign in. Otherwise approve them under **More**, then **People**.

## How a shoot works

1. **Book it.** Go to **Jobs**, then **New job**. Set the dates and the responsible crew member. Add kits. Anything already booked or out on overlapping dates is flagged.
2. **Pull.** In the storage room, scan every item, including each item inside a case. The **Check out** button stays locked until everything is scanned or deliberately left behind. Critical items need an extra confirmation to leave behind.
3. **Wrap on set.** Scan a case, then scan each item as it goes in. Repeat for each case. Mark anything that travels loose (tripods, stands), anything damaged, and anything missing. This works **with no signal**: scans wait on the phone and sync when you're back online. Gear packed in the wrong home case is flagged.
4. **Studio check-in.** Scan each case to see what's inside it, then scan each item back. Anyone can do this. The job stays with the responsible person, and the app logs who did each step. Damaged items open a repair record, and missing items show their replacement cost. Close the job when everything is accounted for.

Scan any label at any time with the **Scan** button to see where that item is: on a shelf, in a case, or on a job and with whom.

## Updating the app later

If you get new versions of these files, upload them to the GitHub repository the same way. They replace the old ones. Also open `sw.js` and change `VERSION` (for example `gc-v1` to `gc-v2`) so phones pick up the update.

## Limits and costs

- **Supabase Free:** 500 MB of data, which is far more than 500 items need.
  - Free projects **pause after 7 days with no activity**. If the studio is quiet for a week, open the Supabase dashboard and click **Restore**. Nothing is lost.
  - If pausing becomes annoying, the Pro plan is USD 25 a month.
- **GitHub Pages:** free for public repositories.
- **Microsoft:** the app registration is free with your Microsoft 365 plan. The client secret expires after 24 months (see step 2.4).

## If something goes wrong

- **"Couldn't load from the server", or sign-in loops back to the sign-in page:** check that the Site URL and Redirect URLs in step 4.1 exactly match your GitHub Pages address, including the trailing `/`.
- **Microsoft says the redirect URI doesn't match:** the redirect URI in step 2.2 must be exactly `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
- **Signed in but "Waiting for approval":** an admin approves you under **More**, then **People**. Or check that `allowed_domain` matches your email domain.
- **The camera doesn't open:** the site must be opened over `https://` (GitHub Pages always is). Allow camera access in the browser's site settings. A USB or Bluetooth barcode scanner also works: tap the scan box and scan.
- **"N waiting" stays on screen:** the phone is offline or the session expired. Connect to Wi-Fi and open the app, and it syncs by itself. Don't sign out while changes are waiting.
