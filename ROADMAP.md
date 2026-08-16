# JPS Roadmap — phase-wise implementation plan

Working rule: **one phase at a time**. A phase closes only when its Definition of Done is met and
`scripts/verify.sh` + live verification pass. Items never move between phases without owner sign-off.
This file is republished to GitHub with every client deploy (`scripts/deploy-app.sh`) and the shared
web copy is refreshed after every phase-relevant change — it is always current.

## Phase 0 — Foundation ✅ done
v0.2 port from the Python reference, live Apps Script backend on the district Gmail, Sheets/Drive
storage, 34-assertion harness, Sheets type-coercion bug found and fixed (normCell + '@' formats).

## Phase A — Farmer experience (v0.3.0-M2) ✅ done
- Master-data pipeline: workbook → `Seed.gs` (27 facilities, 20 services, 280 GPs, 70 staff)
- Language option తెలుగు / English / both; indigo redesign; PWA install from Chrome
- Service catalogue with per-service SLAs; GP → jurisdiction facility routing with doctor
  contact + Maps directions; visit slots; prescription photos; do's & don'ts page
- Video calls via per-ticket Jitsi rooms (b002)
- Installable from the browser on Android (Chrome → Install app) and iPhone (Safari → Share →
  Add to Home Screen) — no app store needed
- Live: backend + client b003 verified (44 live checks total)

## Phase B — Deploy automation & go-live 🔶 NOW (b003)
Goal: no manual editor steps ever again; clean data; first real users.
- [x] `ensureSchema` — migrations auto-apply on first request after a push
- [x] `scripts/deploy-backend.sh` (clasp push + new version, same /exec URL)
- [x] `scripts/deploy-app.sh` (client → GitHub Pages)
- [x] Owner one-time clasp login (district profile at `..\.clasp-district` — coexists with other accounts)
- [x] First automated deploy shipped b003 incl. video backend — 11/11 live checks
- [ ] Sheet cleanup: delete all test rows (Users/Requests/Events/Sessions/Prescriptions) + test photos
      (keep admin district.jana@gmail.com; test vets Dr Test / Dr Test Vet go too before go-live)
- [ ] Pilot rollout: WhatsApp the app link to field officers of 1–2 mandals; collect feedback weekly
Definition of Done: one command deploys backend + client; live suite green; zero test rows; ≥1 mandal using it.

## Phase C — Internal staff modules (v0.4.0-M3 b001) ✅ done (19 live checks)
The app is now the department's daily tool. Shipped 2026-08-16:
- [x] On-call/off-call toggle per vet (visible on admin dashboard + vet console)
- [x] Attendance: check-in/out with **mandatory camera photo + GPS geo-tag** (b002), double-entry
      guard, map link + photo view on records (photos private, served via API only)
- [x] Leave: staff request → admin approve/reject, date validation
- [x] Medicine stock: per-facility quantities + reorder alerts, 129-item catalogue seeded from F8
      (live quantities entered in-app by the stores wing — sidesteps the broken F8 qty columns)
- [x] Broadcasts: admin publishes notices → every farmer's home screen; end anytime
- [x] Staff support tickets: raise → admin responds and closes
Not built (deliberately): F9 month-view roster — availability + attendance + leave cover on-duty
tracking; revisit only if the DV&AHO asks for a printed monthly roster.

## Phase D — Reach & notifications (v0.5) ⏳ later
- FCM push notifications (needs district Firebase project + `google-services.json`)
- Automated D-3/D-7 recovery follow-ups from the service catalogue
- F4 GP latitude/longitude completion → farmer-location routing sharpens
- Play Store release: Capacitor build, PhoneHint on-device verify, Play Console via
  Government D-U-N-S route (`app/ANDROID.md`)
- App Store (iOS) release: Capacitor iOS build — needs a Mac + Apple Developer account (~₹8,000/yr);
  until then iPhone users install via Safari → Add to Home Screen (works today)

## Phase E — Scale & hardening ⏳ later
- Photo/prescription retention job (DPDP: purge >12 months)
- Analytics: mandal heatmaps, SLA trend reports for the Collectorate
- Self-hosted Jitsi decision (breaks ₹0 — only if video volume justifies)
- AWS migration triggers (FREEZE-v2): >1,000 requests/day, quota >60%, p95 >2.5 s, or a second district
