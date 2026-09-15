# Studio Projects

Production-ready React/Vite project tracking for the architecture studio. Firebase Authentication provides individual email/password accounts, while Cloud Firestore is the shared real-time repository for projects, people, deliverables, updates, reports, help requests, cycles, time entries, and activity.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The Firebase web configuration belongs in `.env.local` and is intentionally excluded from Git. The required variables are:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

For GitHub Hosting deployments, add `VITE_FIREBASE_API_KEY` as a repository secret and the other five values as repository variables with the same names. The checked-in Hosting workflows pass them to Vite during the build.

## One-time Firebase Console setup

1. In **Firestore Database**, create the production database in the region selected for the studio.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. In **Authentication → Users**, create Kiran's account and copy its UID.
4. Create the Firestore document `users/kiran` with these fields:

```text
id: "kiran"
name: "Kiran Rao"
initials: "KR"
title: "Principal"
access: "admin"
tone: "#20372f"
active: true
loginEnabled: true
email: "<Kiran's email>"
authUid: "<Kiran's Authentication UID>"
```

5. Create `authProfiles/<Kiran's Authentication UID>` with:

```text
userId: "kiran"
access: "admin"
active: true
```

6. Deploy the rules and indexes:

```bash
firebase deploy --only firestore --project nebulous-project--tracker
```

7. Sign in as Kiran. If the cloud repository is empty, the app shows a one-time **Import existing local data** action. Run it in the browser that contains the approved prototype data.

For every additional team member, create an Email/Password Authentication user, update the matching `users/<stable user id>` document with `email`, `authUid`, and `active: true`, then create `authProfiles/<Authentication UID>` with that stable `userId`, the matching `access`, and `active: true`.

Adding a person inside the app creates their shared staff profile. Creating their password-bearing Authentication account and UID mapping remains an administrator's Firebase Console step; privileged account creation must not run in the browser client.

## Data model

Top-level Firestore collections:

- `users`
- `projects`
- `workItems`
- `dailyUpdates`
- `dailyReports`
- `helpRequests`
- `activity`
- `cycles`
- `timeEntries`
- `authProfiles` (Authentication UID → stable app user ID)
- `notificationDevices` (one enabled FCM registration per user installation)

Dates without a time component remain ISO `YYYY-MM-DD` strings. Event timestamps are written as Firestore `Timestamp` values and converted back to ISO strings at the repository boundary. Existing stable IDs and arrays are preserved during the one-time local-data import.

## Verification

```bash
npm run build
```

To test synchronization, sign in in two separate browser profiles with different staff accounts. Update a deliverable or submit a daily report in one profile and confirm the other profile updates without refreshing. Then sign out and back in to confirm the change persisted.

Firebase Hosting remains configured to serve `dist` with SPA rewrites. Build before deploying:

```bash
npm run build
firebase deploy --only hosting --project nebulous-project--tracker
```

## Web push notifications

The PWA registers notifications only after the signed-in user taps **Enable notifications**. Each browser installation is stored in `notificationDevices` against the existing stable application user ID and current Authentication UID, so a user may enable several devices. Signing out removes that browser's registration. The generated `firebase-messaging-sw.js` uses the same build-time Firebase web configuration as the application; no `.env` file or Admin SDK credential is committed.

Cloud Functions send only these two notification types:

- a new employee help request at `level: "lead"` → that project's `leadId`
- a project-lead escalation (created directly or transitioned to `level: "principal"` and `status: "Escalated"`) → that project's `principalId` and `principalIds`

Before the first Functions deployment:

1. Upgrade the Firebase project to the Blaze plan if it is not already billing-enabled.
2. In **Firebase Console → Project settings → Cloud Messaging → Web configuration**, confirm the Web Push certificate public key matches the key configured in `notificationService.ts`.
3. Confirm both the **Firebase Cloud Messaging API (V1)** and **FCM Registration API** are enabled in the linked Google Cloud project. New Firebase projects normally enable the registration API automatically.
4. Install and verify the server package locally with `npm --prefix functions install` and `npm --prefix functions test`.
5. Deploy the server and device-registration rules without deploying Hosting: `firebase deploy --only functions,firestore:rules --project nebulous-project--tracker`.

On iPhone, web push requires the HTTPS site to be added to the Home Screen. Open the installed PWA, sign in, and tap **Enable notifications** from that installed app. No APNs key, native iOS bundle, or service-account key is added to the frontend.
