# User Handbook

DORA Agent Package · Version 1.29.0 · This handbook has two parts: **User** and **Administrator**.

---

## Part 1 — User

### 1.1 First sign-in

1. Open `https://<server>/app/` in your browser.
2. Enter your username and password.
3. If an administrator sent you an **invitation e-mail**, click the link and set your password
   (the link is valid for 30 minutes and can be used once).
4. After signing in, open **Security → Start setup** to enable two-factor authentication.

> If you forget your password, ask your administrator for a **reset link**. If it arrives by e-mail,
> open the link and set a new password.

### 1.2 Two-factor authentication (2FA)

| Step | What to do |
|---|---|
| 1 | On the Security page press **Start setup** |
| 2 | In Google/Microsoft Authenticator choose **Enter a setup key** |
| 3 | Type the key shown on screen in groups of four |
| 4 | Enter the 6-digit code from the app → **Enable** |
| 5 | Save the **10 recovery codes** (shown only once) |

On later sign-ins you enter the 6-digit code after your password. If the code is not accepted, use
one of your recovery codes — each code works **once**.

### 1.3 Status page

The **Status** page shows three things:

- How many steps are complete (6 steps)
- Institution size and supervisory authority
- How many systems are connected (incident, service desk, compliance, inventory)

### 1.4 Institution details

On the **Institution details** page enter the institution name, size (tier), supervisory authority,
country of operation and business lines. These details appear in reports and in the evidence bundle.

### 1.5 Setup steps

| Step | What you enter |
|---|---|
| 1 | **Your services** — critical services, owners, criticality |
| 2 | **Outage tolerances** — MTD / RTO / RPO (hours) per service |
| 3 | **My assets** — servers/systems (CSV upload or paste) + **Owners** |
| 4 | **Scenario tests** — accuracy, SLA violations, hash chain for three scenarios |
| 5 | **Self-assessment** — coverage for 28 DORA articles and the independent reviewer |
| 6 | **Go-live** — agent autonomy levels, shadow/semi-automatic days |

Every step has a **"check this step"** button: anything missing is listed with a red cross.

### 1.6 Uploading the inventory (CSV)

1. **My assets** → **Download template**
2. Fill it in Excel: `id, name, criticality, vendor`
3. Pick the file → it is uploaded automatically

Criticality: `critical`, `important`, `standard` (Turkish equivalents are also accepted).

### 1.7 Incident records and reporting deadlines

If a SIEM is connected, events arrive automatically; otherwise an administrator presses
**SIEM events → Fetch events**.

1. Find the event row in the **Incident records** table.
2. Fill in customer count, outage minutes and economic impact.
3. **save** → **activate** (with four-eyes enabled this goes to a second administrator).
4. The **Reporting deadlines** card shows three counters:

| Step | Duration | Colour |
|---|---|---|
| Initial notification | 4 hours | green = sent, orange = approaching, red = overdue |
| Intermediate report | 72 hours | same |
| Final report | 1 month | same |

5. After reporting outside the system, press **"… sent"**; you may enter a reference number.

### 1.8 Incident history

The **history** button on an incident row shows who did what and when (creation, update, reporting,
approval).

### 1.9 Documents and evidence bundle

- **Documents** lists the records produced in the session.
- **Create evidence bundle** → all records in one signed zip.
- **Management report (PDF)** → institution, phases, incidents, deadlines, approvals, coverage.

### 1.10 Search

The **Search** page searches processes, controls, agents, terms and DORA articles. Turkish
characters are folded (`siniflandirma` = `sınıflandırma`).

### 1.11 Changing your password

**Change my password** → current password + new password (at least 8 characters). Changing it
signs you out on other devices.

### 1.12 Troubleshooting

| Symptom | Fix |
|---|---|
| Cannot sign in | Ask an administrator for a reset link |
| 6-digit code rejected | Is the phone clock correct? Try a recovery code |
| "no permission for this account" | An administrator must add you as a user |
| File upload fails | Use the template; the `name` column must not be empty |
| Cannot download the evidence bundle | Press **Create bundle** first, then **Download** |
| Page looks empty | Refresh the browser; the session may have expired |

---

## Part 2 — Administrator

### 2.1 User management

**Administration → Users**

| Action | Note |
|---|---|
| Add user | username + password + role; **send invitation e-mail** optional |
| Change role | user ↔ administrator |
| Reset password | set a temporary password |
| Reset link | 30 min, single use; copied to clipboard |
| Send invitation | e-mail with a reset link |
| Delete | the last administrator cannot be deleted |

### 2.2 E-mail (SMTP)

**Administration → E-mail (SMTP)**: server, port, sender, user, password, SSL options.
Verify with **Send test**. Undeliverable messages go to the **queue**; **Send queue** retries.

### 2.3 Notifications

**Administration → Notifications**: enable, recipients (comma-separated). When enabled, e-mails are
sent for:

- incidents whose reporting deadline is approaching or overdue
- pending approval requests

Use **Scan now** to test manually. The same alert is never sent twice.

### 2.4 Four-eyes approval

**Administration → Approval flow** → **Enabled**. When on, incident classification and go-live go to
a second administrator; **the requester cannot approve their own request**.

> With a single administrator do not enable it — the request cannot be approved. Create a second
> administrator first.

### 2.5 Integrations

**Integrations**: product, endpoint, authentication and key for SIEM / ITSM / GRC / CMDB.
**Test connection** checks reachability; the **SIEM events** page fetches events.

### 2.6 SIEM event rules and scheduled fetching

- **Event rules**: which keywords open a record, plus data-loss / unauthorised-access flags.
- **Scheduled fetching**: enabled + interval (minutes) → the server pulls by itself and creates
  draft records.

### 2.7 SSO (corporate sign-in)

**Administration → Corporate sign-in (SSO / OIDC)**: issuer, client ID, redirect URI, secret.
Details: `docs/SSO-KURULUM.md`. It does not work without TLS.

### 2.8 Backup

```bash
node tools/backup.mjs --out /var/backups/dora/$(date +%F).zip --keep 8
node tools/backup.mjs --verify /var/backups/dora/2026-11-09.zip
node tools/restore.mjs --zip /var/backups/dora/2026-11-09.zip --target /opt/dora-restore
```

Details: `docs/YEDEKLEME.md`.

### 2.9 Activity log

**Administration → Activity log** shows the last 150 actions; **Download as CSV** returns everything.

### 2.10 Technical panel

**Technical panel** in the sidebar opens the static report dashboard (processes, controls, agents,
glossary, DORA mapping). **Live dashboard** shows live data instead.

---

## Annex: Terms

| Term | Meaning |
|---|---|
| Tier | Institution size class (tier1 large, tier3 small) |
| MTD | Maximum tolerable downtime |
| RTO | Recovery time objective |
| RPO | Recovery point objective |
| Evidence bundle | Signed zip; manifest + hash chain |
| Four eyes | Approval by two different administrators |
| Intermediate report | Report due 72 hours after the initial notification |
