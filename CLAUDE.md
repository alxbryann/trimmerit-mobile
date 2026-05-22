# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start development (Expo Go)
npm start

# Start with tunnel (for physical devices on different network)
npm run start:tunnel

# Start with dev client (after native builds)
npm run start:dev

# Run on platform
npm run ios
npm run android

# Lint
npm run lint
```

No test runner is configured. There is no build step — this is an Expo managed/bare workflow.

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `EXPO_PUBLIC_SITE_URL` — Next.js backend URL (for notifications)

Set `EXPO_PUBLIC_USE_MOCK=true` to use mock data without a real Supabase connection (`src/lib/mockData.js`).

Supabase dashboard must have these redirect URLs allowed: `exp://**` and `trimmerit://**`.

## Architecture

**Stack:** React Native 0.81 + Expo 54, JavaScript (not TypeScript), Supabase backend.

**Entry:** `index.js` → `App.js` → `src/navigation/AppNavigator.js`

### Navigation

Two-phase navigation in `AppNavigator.js`:
1. **Auth stack** — HomeScreen → Login/Register → CompletarPerfil
2. **Main stack** — wraps `MainTabNavigator` + modal screens pushed on top

`MainTabNavigator.js` renders different bottom tab sets based on user role (`cliente`, `barbero`, `admin`, `empleado`). Role comes from Supabase user metadata after login.

Post-login routing logic lives in `src/navigation/postAuthRouting.js` — handles incomplete profiles, first-time flows, and deep links.

### State Management

React Context only — no Redux/Zustand:
- **ThemeContext** (`src/theme/ThemeContext.js`) — dark/light mode, persisted to AsyncStorage
- **BarberSlugContext** (inside `MainTabNavigator`) — active barber/shop context for nested screens

Auth state is managed directly through Supabase's `onAuthStateChange` listener in `AppNavigator`.

### API Layer (`src/api/`)

Thin query functions over Supabase JS client:
- `feed.js` — paginated social feed posts with reactions & comments
- `stats.js` — income/expense aggregation by period (day/week/month/year)
- `notify.js` — push notification triggers

### Key Libraries

- **`src/lib/supabase.js`** — Supabase client with `expo-secure-store` for token persistence (Keychain/Keystore). Falls back to AsyncStorage on web.
- **`src/lib/googleAuth.js`** — Google OAuth via `expo-auth-session`
- **`src/lib/s3Upload.js`** — Media uploads (barber photos, hero videos)
- **`src/lib/stripeBooking.js`** — Stripe payment integration
- **`src/lib/notifications.js`** — Expo push token registration + notification handlers

### Theme System

**`src/theme.js`** — main export with color palette, typography scale, radii, shadows.

Design language: editorial premium. Key tokens:
- Ink `#0a0a0a` / Paper `#f2efe7` — primary dark/light pair
- Champagne `#c8a96a` — gold accent (buttons, highlights)
- Sharp edges (no border-radius except pill `999`)

Fonts loaded at startup in `App.js`: **Playfair Display** (display/headings), **Inter** (body), **DM Mono** (mono).

Dark/light variants defined in `src/theme/tokens.js`; active theme accessed via `useTheme()` from ThemeContext.

### Screens

`src/screens/` — all screens are `.js` files. Role-specific screens:
- **Customer:** Inicio, Catálogo, Barberos, Agenda, LoyaltyCard, Logros
- **Barber/Admin:** Panel, FeedBarbero, AgendaBarbero, AdminBarberia, EmpleadoBarberia
- **Stats (admin):** `src/screens/stats/` — ResumenGeneral, EquipoStats, ClientesStats, CajaStats, Billetera

### Custom Components (`src/components/`)

- `PostCard.js` — social feed card with reaction bar (fire/scissors/star/heart)
- `stats/` — chart components (BarChart, DonutChart, etc.) built with `react-native-svg`
- `ReservaActionsCard.js`, `SolicitudPopup.js`, `LoyaltyCard.js`
