# PLAYNEX_PROGRESS.md
> Last updated: 2026-11-25 | Status: Build & Typecheck Passing

---

## Project Overview

| Field | Value |
|---|---|
| Project | PlayNex |
| Framework | Next.js 14.2.5 + React 18 + TypeScript + Tailwind CSS |
| Backend | Firebase Auth + Firestore + Storage + Admin SDK |
| Active folder | `/Users/balaji/playnex-main` |
| GitHub | https://github.com/balajipanchireddy-arch/playnex.git |
| Deployment | https://playnex-beta.vercel.app/ |
| Android | `com.playnex.app` (preserved) |

---

## Completed Phases

### 1. Project Audit & Environment Fix
- Created `.env.local` from `.env.example` with client Firebase config, Admin SDK credentials, and both permanent admin UIDs.
- Preserved `/android`, signing configurations, existing APIs, and Firestore data structure.

### 2. Dual Permanent Administrators
- Updated `lib/auth/admin.ts` to support both permanent admin UIDs (`PLAYNEX_SUPER_ADMIN_UID` for `balajipanchireddy@gmail.com` / `lGRNmCBnf1TDHTPEE052uvHqC9D2` and `PLAYNEX_ADMIN_UID_2` for `gowthamisindhu27@gmail.com` / `HZAcvx31iWQzEaO21goOXYkImhG3`).
- Updated `app/api/auth/session/route.ts` and `scripts/seed-admin.ts` to verify and provision both admin accounts with active `admin` roles in `userRoles` while preserving existing records.

### 3. Four Main Modules Only (Staff Integrated into Academy)
- Removed Staff from top-level navigation in `components/Navbar.tsx`.
- Converted `app/(app)/staff/page.tsx` into a redirect to `/academy`.
- Integrated **Staff Management** and **Check-In Hub** into `app/(app)/academy/page.tsx`.
- Created `app/api/academies/me/staff/route.ts` with academy-scoped `GET`, `POST`, `PATCH`, `DELETE` and admin `?academyId=` support.

### 4. Custom Sports Support
- Restored `app/api/games/route.ts` as the Sports & Games Catalog API (`GET` with `?all=true` and `POST`) with whitespace/capitalization normalization, slug deduplication, and `isCustom` support.
- Wired `Other / Custom Sport` + custom sport input into `app/(app)/academy/page.tsx` (Add Ground) and `app/(app)/player/page.tsx` (Create Match).

### 5. Player Verification, Matchmaking & Court Bookings
- Created `app/api/player/verification/route.ts` (`GET`, `POST`, `PATCH`) for player verification submissions, history, and admin review (`not_submitted`, `pending`, `under_review`, `approved`, `rejected`, `resubmission_required`).
- Created `app/api/matches/route.ts` (`GET`, `POST`) and `app/api/matches/[id]/route.ts` (`PATCH` with atomic Firestore transactions for `join_request`, `accept`, `reject`, `leave`, `remove`, `confirm`, `cancel`, waitlist, capacity checks, and notifications).
- Upgraded `app/api/bookings/route.ts` with `GET` (player, academy, and admin scopes), atomic `POST`, and atomic `PATCH` cancellation (restoring court slot availability + notifications + activity logging).
- Added Player Verification, Matchmaking Hub, and My Court Bookings UI sections and modals to `app/(app)/player/page.tsx`.

### 6. Admin, Security & Light-Theme UI Redesign
- Added `PATCH` user reactivation endpoint to `app/api/admin/users/route.ts`.
- Extended `lib/firebase/activity.ts` `entityType` union to include `'staff'` and `'match'`.
- Updated `firestore.rules` with `staffProfiles`, `playerVerifications`, `games`, and recipient-scoped `notifications` rules.
- Updated `tailwind.config.ts`, `app/globals.css`, `components/Navbar.tsx`, and `app/(app)/layout.tsx` to the PlayNex light-theme palette (`#101828` navy, `#16A36A` green, `#F8FAFC` page background, `#FFFFFF` card, `#E5E7EB` border, `#172033` main text, `#667085` secondary text).

---

## Modified & Created Files

| File | Status |
|---|---|
| `.env.local` | Created (not committed) |
| `PLAYNEX_PROGRESS.md` | Created & updated |
| `lib/auth/admin.ts` | Modified |
| `lib/firebase/activity.ts` | Modified |
| `app/api/auth/session/route.ts` | Modified |
| `app/api/games/route.ts` | Restored & enhanced |
| `app/api/matches/route.ts` | Created |
| `app/api/matches/[id]/route.ts` | Created |
| `app/api/bookings/route.ts` | Modified |
| `app/api/player/verification/route.ts` | Created |
| `app/api/academies/me/staff/route.ts` | Created |
| `app/api/admin/users/route.ts` | Modified |
| `app/(app)/layout.tsx` | Modified |
| `app/(app)/academy/page.tsx` | Modified |
| `app/(app)/player/page.tsx` | Modified |
| `app/(app)/staff/page.tsx` | Modified (redirects to `/academy`) |
| `components/Navbar.tsx` | Modified |
| `tailwind.config.ts` | Modified |
| `app/globals.css` | Modified |
| `firestore.rules` | Modified |
| `scripts/seed-admin.ts` | Modified |

---

## Verification Results

- `npm run typecheck` (`tsc --noEmit`): **PASS** (0 errors)
- `npm run build` (`next build`): **PASS** (all routes compiled cleanly)

---

## Manual Configuration Required (Not Executed Automatically)

1. **Seed admin roles in Firestore**:
   ```bash
   cd /Users/balaji/playnex-main
   npm run seed:admin
   ```
2. **Deploy updated Firestore rules** (when ready, with explicit user permission):
   ```bash
   firebase deploy --only firestore:rules
   ```
3. **Set Vercel Environment Variables** before deploying to production (`PLAYNEX_SUPER_ADMIN_UID`, `PLAYNEX_ADMIN_UID_2`, and all Firebase client/admin env vars from `.env.local`).
4. **Run locally**:
   ```bash
   cd /Users/balaji/playnex-main
   npm run dev
   ```
