# FitTrack — AI-Powered Fitness Tracker & Gym Management System

One React Native codebase (Expo SDK 58 + Expo Router + React Native Web) that runs as a **website** and an **Android app**, with a Node/Express API and **Firebase** (Auth + Firestore). Black/red theme (#0B0B0B / #171717 / #E50914 / #A30000).

```
fittrack/
  src/app/            screens (Expo Router): (auth) (member) (admin)
  src/components/     reusable UI kit, charts, layout shell, popup notifications
  src/lib/            firebase, auth, db hooks, calculators, geo, notifications
  src/data/           workouts, face exercises, fasting schedules
  backend/            Express API (AI, payments, admin) + tests + seed/admin scripts
  firestore.rules     security rules (deploy these!)
```

## What is built

| Area | Details |
|---|---|
| Auth | Register, login, logout, forgot/reset password, email verification (resend + "I verified"), **separate Member / Admin login**, role from a Firebase **custom claim** (admins can only be created by the setup script) |
| Member dashboard | Workouts (total/week/month), level, weight, BMI, body fat, calories eaten/burned, water, running, active fast, membership status + expiry |
| Workouts | 3 levels × 4 programs, 40 exercises, live session player with rest timer, favourites, custom routines (create/edit/delete/schedule days), history + chart |
| Calculators (10) | BMI, body fat (US Navy), BMR, TDEE, daily calories, ideal weight, macros, water, heart-rate zones, calorie deficit — validation, explanations, saved history, comparison with previous result, medical disclaimer |
| Face fitness | 17 exercises in 6 categories, daily routine, custom routines, step-by-step player with timer, completion tracking + streak |
| Fasting | 12:12, 14:10, 16:8, 18:6, 20:4 + custom, pause/resume, countdown, history, weekly stats, end-of-fast notification |
| Water | Goal, quick-add/custom, glass visual, 7-day chart, reminders |
| Running | GPS tracking (foreground, location asked only when you press Start), pause/resume, pace, calories, route preview, manual entry fallback, weekly/monthly stats |
| AI coach | Chat with history, suggested questions, clear chat; **Gemini → Hugging Face → built-in rule-based coach**; prompt is personalised from the member's own data (no email/name sent); not medical advice |
| Memberships | Plans (admin CRUD), checkout, payment history, PDF/print receipts, expiry reminders |
| Payments | Sandbox gateway (works out of the box) + SSLCommerz (bKash / Nagad / cards) behind the same interface; **server-side verification only**, idempotent settlement, pending/successful/failed/refunded |
| Admin | Stats dashboard + charts, member search/filter, member profile (progress charts, workouts, running, water, fasting, payments), activate/deactivate, plans, payments + refunds, announcements |
| Notifications | In-app **popup** when a new notification arrives, inbox with unread badge, browser popups (web, when tab is in background), scheduled local reminders on Android (workout, water, fasting end, membership expiry) |

## 1. Prerequisites
- Node 20+ (22 recommended), a Firebase project, and for Android: Expo Go (quick test) or an emulator.

## 2. Firebase setup (5 minutes)
1. <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode).
4. **Project settings → General → Your apps → Web (`</>`)** → register → copy the config values.
5. **Project settings → Service accounts → Generate new private key** → save as `backend/serviceAccount.json` (never commit it; it's git-ignored).
6. Deploy the security rules (**required** — without them your data is not protected):
   ```bash
   npm i -g firebase-tools && firebase login
   firebase use --add          # pick your project
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   (Or paste `firestore.rules` into Firestore → Rules → Publish.)

## 3. Configure
```bash
cp .env.example .env              # fill the EXPO_PUBLIC_FIREBASE_* values
cp backend/.env.example backend/.env
```
In `backend/.env` set `GEMINI_API_KEY` and `HF_API_TOKEN` (both optional — without them the built-in coach answers). **Keys live only in `backend/.env`; never put them in `.env` at the root** (anything `EXPO_PUBLIC_*` is shipped inside the app).

## 4. Run
```bash
# terminal 1 — API
cd backend && npm install
npm run seed                                   # creates 4 default membership plans
npm run create-admin -- you@gym.com "Str0ng!AdminPass" "Gym Owner"
npm start                                      # http://localhost:4000

# terminal 2 — app
npm install
npx expo start            # press w for web, or scan the QR with Expo Go (Android)
```
- **Android emulator:** set `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`. **Physical phone:** use your PC's LAN IP, e.g. `http://192.168.1.20:4000`, and add the web origin to `CORS_ORIGINS` if testing in a browser from another host.
- Log in as admin with **Login as Admin**. Members register from the app.
- Android release build: `npx eas-cli build -p android` (see Expo docs).

### Tests
```bash
npm test      # calculator + GPS unit tests, and 26 backend API tests (auth, roles, payments, AI, admin)
```

## 5. Payments (sandbox)
- Default `PAYMENT_GATEWAY=mock`: checkout shows a **sandbox simulator** ("Simulate successful payment / failure"). It uses dummy money, but follows the real flow: the server prices the plan, creates a pending payment, then **verifies with the gateway and only then** activates/extends the membership inside a transaction (double taps and repeated callbacks cannot extend it twice; a gateway amount that differs from the server price is rejected). The mock gateway is refused when `NODE_ENV=production`.
- **SSLCommerz sandbox** (bKash / Nagad / cards): create a sandbox store at <https://developer.sslcommerz.com/registration/>, then in `backend/.env`:
  ```
  PAYMENT_GATEWAY=sslcommerz
  SSLCZ_STORE_ID=...   SSLCZ_STORE_PASSWD=...   SSLCZ_SANDBOX=true
  PUBLIC_URL=https://<your-https-tunnel>      # e.g. ngrok http 4000 — the gateway must reach /payments/sslcommerz/ipn
  ```
  The app opens the hosted payment page; the IPN/return callbacks are **re-verified server-to-server** (never trusted as sent). Direct bKash/Nagad merchant APIs can be added as new files in `backend/src/lib/gateways/` implementing `init` + `verify`.
- Card numbers are never seen or stored by FitTrack.

## 6. Upgrading Expo later
One SDK at a time: `npm install expo@^<next> && npx expo install --fix && npx expo-doctor`, delete `android/` and `ios/` if you generated them, and read the release notes. Don't switch architecture and SDK in the same step.

## 7. Security notes
- Role = verified token claim (`admin: true`), checked in the API **and** in Firestore rules; the UI also hides screens, but URL/data tampering gets nothing (members get 403 from every `/admin` route; rules block cross-user reads).
- Admins read member data only through the API, which returns a limited set (no AI chats, meals, calculator inputs).
- Subscriptions, payments, plans, announcements and AI chat history are **server-write-only** in the rules.
- Helmet, CORS allow-list, per-route rate limits, zod validation, 50 KB JSON limit.

## 8. Known limitations (please read)
- **Not verified against real services from the build sandbox:** Firebase (Auth/Firestore), Gemini, Hugging Face, SSLCommerz and a real Android device. What *was* verified: TypeScript strict typecheck, web + Android bundles export, login screen renders at desktop/phone widths, 26 backend tests run against an in-memory Firestore (auth, roles, payments, AI fallback chain, admin), plus calculator/GPS unit tests. Expect to fix small issues on first real run — tell me what you see.
- AI model names change; set `GEMINI_MODEL` / `HF_MODEL` to current ones from your provider dashboards.
- **Notifications:** popups appear while the app/tab is open; scheduled reminders work on Android. True background *push* from the server (FCM) is not set up — announcements reach members' inbox and popup the next time the app is open.
- Browser can't schedule reminders while closed; GPS tracking runs in the foreground only (keep the screen on — the app requests keep-awake).
- Exercise "videos" are links to YouTube searches (no hosted media); route preview is drawn from GPS points (no map tiles / API key needed).
- Admin statistics scan all members (fine for a gym-sized dataset; add aggregate counters if you grow past a few thousand).
- Profile photos are resized to 256 px and stored in the profile document (no Firebase Storage needed).
- Health calculators and AI output are estimates / general information, not medical advice.
