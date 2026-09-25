# Dometra Mobile — React Native / Expo MVP

A runnable iPhone-first rental-management MVP built with React Native + Expo + TypeScript.

## Included

- Landlord and Tenant modes in one account
- Dashboard KPIs: expected, received, outstanding, advance
- Properties list, details and create flow
- Tenant/rent summary
- Single- and dual-tariff meters
- T1/T2 workflow with a separate photo for every register
- Manual reading confirmation and consumption calculation
- Invoice list/details and local invoice generation from rent + meter consumption
- Payments and unallocated advance concept
- Reminders and local notification test
- Ukrainian / English / German / Russian localization
- Runtime remote-translation updater
- Supabase Auth adapter
- Supabase Storage upload helper for meter photos
- Full Supabase PostgreSQL schema in `supabase/schema.sql`
- Local persistent demo data so the app works immediately without backend setup

## Why Expo SDK 54?

This project intentionally targets Expo SDK 54 / React Native 0.81. It is a conservative baseline for an existing Xcode 26.0 setup. Once your Xcode is updated, you can upgrade Expo independently.

## Requirements

- macOS
- Node.js 20.19+ recommended
- npm
- Xcode
- CocoaPods (Xcode/prebuild will use it for native iOS dependencies)

Check:

```bash
node -v
npm -v
xcodebuild -version
```

## 1. Open in VS Code

Unzip the archive, then:

```bash
cd dometra-react-native
code .
```

## 2. Install packages

```bash
npm install
```

Then let Expo verify native package versions:

```bash
npx expo install --fix
npx expo-doctor
```

## 3. Start immediately in demo mode

No Supabase is required for the first run.

```bash
npx expo start
```

Then:

- press `i` for iOS Simulator, or
- scan the QR code with Expo Go where supported.

On the login screen select **Continue demo**.

Demo state is persisted in AsyncStorage. Use **Settings → Reset demo data** to restore initial data.

## 4. Run on a physical iPhone

For the full camera/native workflow, use a development build.

Connect the iPhone to the Mac, enable Developer Mode on the iPhone, and run:

```bash
npx expo run:ios --device
```

Expo will generate `ios/`, invoke the local Xcode toolchain, install the app and launch it.

If signing needs manual configuration:

```bash
open ios/*.xcworkspace
```

Then in Xcode:

1. Select the Dometra target.
2. Open **Signing & Capabilities**.
3. Select your Apple Team.
4. Change the bundle ID in `app.json` from `com.example.dometra` to your own unique bundle ID.
5. Build with `Cmd + R`.

After changing native configuration, regenerate native projects when necessary:

```bash
npx expo prebuild --clean
npx expo run:ios --device
```

## 5. Connect Supabase

Create a Supabase project, then copy:

```bash
cp .env.example .env
```

Fill:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never put a Supabase `service_role` key in the mobile app.

Restart Metro after editing `.env`:

```bash
npx expo start -c
```

### Apply the database schema

The complete schema is included at:

```text
supabase/schema.sql
```

For the fastest first setup, paste it into **Supabase → SQL Editor** and run it.

For a migration workflow, install/configure the Supabase CLI and use the file as the initial migration.

The schema includes:

- profiles / settings
- workspaces and members
- Free / Pro subscription model
- properties
- tenancies and tenant memberships
- rent terms
- property services and historical tariffs
- meters and N meter registers
- meter-reading sessions
- per-register photos
- invoices / invoice lines
- payments / allocations / advances
- security deposits
- reminder rules / notifications
- localization tables
- private `meter-photos` and invoice-document storage buckets
- RLS policies

## 6. Current backend behavior

The project is intentionally usable before Supabase is configured:

- **Demo mode:** all application data runs locally and persists with AsyncStorage.
- **Supabase configured:** login/register uses Supabase Auth.
- `src/services/supabaseRepository.ts` contains the first production repository helpers for real properties and private meter-photo uploads.

This makes it possible to build each module independently without blocking the UI on backend implementation.

The next production step is to replace the local context mutations in `AppContext.tsx` with repository calls module-by-module.

## 7. T1 / T2 meter photo flow

Open a property → meter → readings.

For a dual-tariff meter:

```text
Physical electricity meter
  ├── T1 / Day
  │     ├── separate photo
  │     ├── previous value
  │     └── current value
  └── T2 / Night
        ├── separate photo
        ├── previous value
        └── current value
```

The Save button is disabled until the register has a valid reading and a photo.

## 8. Remote localization updates without App Store release

Bundled translations are in:

```text
src/i18n/resources.ts
```

Optional remote updates are implemented in:

```text
src/services/remoteTranslations.ts
```

Set:

```env
EXPO_PUBLIC_TRANSLATIONS_BASE_URL=https://your-cdn-or-storage/i18n
```

Expected remote files:

```text
/i18n/
  manifest.json
  uk.json
  en.json
  de.json
  ru.json
```

Example `manifest.json`:

```json
{
  "version": 2
}
```

When a user changes language, the app checks the remote version, downloads a newer JSON file and adds it to i18next at runtime.

## 9. Notifications

The Settings screen contains a test local notification.

For real server-triggered reminders, the production flow should be:

```text
Supabase Cron
   ↓
Edge Function
   ↓
reminder_rules
   ↓
device_push_tokens
   ↓
Expo Push Service / APNs
```

Remote push notifications should be tested with a development build / production build rather than relying on Expo Go.

## 10. Project structure

```text
dometra-react-native/
├── App.tsx
├── app.json
├── package.json
├── .env.example
├── supabase/
│   └── schema.sql
└── src/
    ├── components/
    │   └── ui.tsx
    ├── context/
    │   └── AppContext.tsx
    ├── data/
    │   └── mock.ts
    ├── i18n/
    │   ├── index.ts
    │   └── resources.ts
    ├── lib/
    │   └── supabase.ts
    ├── navigation/
    │   └── RootNavigator.tsx
    ├── screens/
    │   ├── AuthScreen.tsx
    │   ├── DashboardScreen.tsx
    │   ├── PropertiesScreen.tsx
    │   ├── PropertyDetailsScreen.tsx
    │   ├── AddPropertyScreen.tsx
    │   ├── AddMeterScreen.tsx
    │   ├── MeterReadingScreen.tsx
    │   ├── ReadingsScreen.tsx
    │   ├── InvoicesScreen.tsx
    │   ├── InvoiceDetailsScreen.tsx
    │   ├── PaymentsScreen.tsx
    │   ├── AddPaymentScreen.tsx
    │   ├── TenantHomeScreen.tsx
    │   ├── SettingsScreen.tsx
    │   └── LanguageScreen.tsx
    ├── services/
    │   ├── notifications.ts
    │   ├── remoteTranslations.ts
    │   └── supabaseRepository.ts
    ├── theme.ts
    └── types.ts
```

## 11. Recommended implementation order from here

1. Run and validate the complete demo UX on your iPhone.
2. Apply `supabase/schema.sql`.
3. Create a real signup bootstrap flow: profile → workspace → FREE subscription → workspace member.
4. Move Properties CRUD from local state to Supabase.
5. Move meters/registers/tariffs to Supabase.
6. Upload T1/T2 photos and save reading sessions to Supabase.
7. Move invoice calculation into an Edge Function / transactional backend path.
8. Move payments and allocations to Supabase.
9. Register Expo push tokens and implement scheduled reminder Edge Function.
10. Add OCR after manual T1/T2 reading flow is stable.
11. Add PDF generation and native share.
12. Add StoreKit/App Store subscription entitlement for 5+ active properties.

## Useful commands

```bash
npm install
npx expo install --fix
npm run typecheck
npm run doctor
npx expo start
npx expo run:ios --device
npx expo prebuild
```
