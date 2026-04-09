# BabyGuard AI — Smart Baby Monitor App

## Vision
A cross-platform baby monitor app that turns two phones into an intelligent monitoring system. Unlike existing apps (Baby Monitor 3G, Annie, Bibino), this app uses on-device AI for smart sound classification, low-light video enhancement, and predictive sleep insights.

## Target User
Cost-conscious parents (25–40) with a spare phone/tablet. They want a reliable, smart baby monitor without buying dedicated hardware. They value simplicity over feature overload.

---

## Tech Stack

- **Framework**: React Native (Expo) — cross-platform from day 1
- **Routing**: expo-router (file-based)
- **Real-time streaming**: WebRTC (react-native-webrtc) — Phase 2
- **AI/ML on-device**: TensorFlow Lite (react-native-tflite) — Phase 3
- **Backend**: Supabase (auth, database, signaling server)
- **Push notifications**: expo-notifications
- **State management**: Zustand
- **Styling**: React Native StyleSheet (plain, no CSS-in-JS libraries)

### Dependency philosophy
Add dependencies only when a phase actually starts. No speculative installs. Use `npx expo install` (not `npm install`) to always get SDK-compatible versions.

---

## Core Architecture

The app runs in two modes on two devices:

### Baby Unit (sender device)
- Streams audio + video via WebRTC
- Runs on-device sound classification (cry / cough / babble / silence / noise)
- Sends classified events to parent unit
- Plays soothing sounds when triggered (auto or remote)
- Keeps screen dimmed, prevents sleep

### Parent Unit (receiver device)
- Receives audio + video stream
- Shows live feed with sound classification labels
- Displays alerts with severity levels
- Controls baby unit remotely (talk-back, play sounds, toggle light)
- Shows sleep log and pattern analytics

### Connection Flow
1. Both devices sign in (or guest mode with room code pairing)
2. Supabase Realtime handles signaling (WebRTC SDP exchange)
3. Direct peer-to-peer connection established
4. Falls back to TURN server if P2P fails
5. Aggressive keep-alive pings every 5 seconds
6. Push notification on disconnect (critical alert)

---

## Screens & Navigation

All screens are flat files in `app/` using expo-router. Navigation is imperative (`router.push/replace`).

| File | Description |
|------|-------------|
| `app/index.tsx` | Redirects to `/welcome` |
| `app/welcome.tsx` | Onboarding screen 1 — value prop |
| `app/choose-role.tsx` | Onboarding screen 2 — baby or parent |
| `app/pair-devices.tsx` | Onboarding screen 3 — room code pairing |
| `app/baby-monitor.tsx` | Baby unit monitoring screen |
| `app/parent-monitor.tsx` | Parent unit monitoring screen |
| `app/sleep-log.tsx` | Sleep timeline and stats |
| `app/settings.tsx` | Settings screen |

---

## Build Phases (in order)

### Phase 1 — MVP: Core Screens + State ✅ Done
- [x] Expo project setup (SDK 54, blank-typescript template)
- [x] expo-router file-based navigation
- [x] Supabase client configured (`lib/supabase.ts`)
- [x] Zustand stores: connection-store, monitor-store
- [x] All screens scaffolded with StyleSheet styling
- [x] Role selection and room code pairing UI
- [ ] Supabase anonymous auth
- [ ] Supabase Realtime signaling channel for WebRTC
- [ ] QR code pairing (add `react-native-qrcode-svg` when starting this)
- [ ] Volume-threshold alerts

### Phase 2 — Audio + Video Streaming
- [ ] Install `react-native-webrtc` (`npx expo install react-native-webrtc`)
- [ ] WebRTC audio streaming (baby → parent)
- [ ] Push-to-talk (parent → baby)
- [ ] WebRTC video streaming
- [ ] Camera controls (flip, zoom)
- [ ] Low-light enhancement filter
- [ ] Bandwidth auto-adjust
- [ ] Push notification on disconnect (expo-notifications)

### Phase 3 — AI Sound Classification
- [ ] Install `react-native-tflite` when starting this phase
- [ ] TFLite sound classification model (cry/cough/babble/noise/silence)
- [ ] Real-time classification on baby unit
- [ ] Severity-based alert system on parent unit
- [ ] Auto-soothe: play white noise/lullaby on cry detection

### Phase 4 — Sleep Analytics
- [ ] Automatic sleep/wake event logging (sleep-store)
- [ ] Sleep timeline visualization
- [ ] Weekly trend charts
- [ ] AI-generated sleep insights (Claude API via Supabase Edge Functions)
- [ ] Export sleep data (PDF/CSV)

### Phase 5 — Polish & Launch
- [ ] Onboarding illustrations
- [ ] Account-based licensing
- [ ] Subscription model for premium AI features
- [ ] App Store / Play Store optimization
- [ ] Privacy policy & data handling (GDPR compliant)

---

## File Structure

```
babyguard-ai/
├── app/
│   ├── _layout.tsx          # Root layout (dark theme, StatusBar)
│   ├── index.tsx            # Redirects to /welcome
│   ├── welcome.tsx          # Onboarding: value prop
│   ├── choose-role.tsx      # Onboarding: baby or parent
│   ├── pair-devices.tsx     # Onboarding: room code pairing
│   ├── baby-monitor.tsx     # Baby unit screen
│   ├── parent-monitor.tsx   # Parent unit screen
│   ├── sleep-log.tsx        # Sleep log screen
│   └── settings.tsx         # Settings screen
├── stores/
│   ├── connection-store.ts  # Connection state (Zustand)
│   └── monitor-store.ts     # Monitoring state, alerts (Zustand)
├── lib/
│   └── supabase.ts          # Supabase client
├── assets/                  # Icons, splash
├── PLAN.md
├── app.json
├── package.json
└── tsconfig.json
```

---

## Design Direction

- **Aesthetic**: Soft, calm, reassuring — nightlight, not dashboard
- **Colors**: Deep navy background (`#0B1426`), soft amber accents (`#F5C06E`), gentle greens for "all good" (`#7DD3A0`)
- **Styling**: Plain React Native `StyleSheet` — add a styling library only if it earns its place

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Cross-platform | React Native (Expo) | One codebase, solves #1 competitor complaint |
| Streaming | WebRTC | P2P = low latency, no server costs |
| AI inference | On-device (TFLite) | Privacy-first, works offline |
| Backend | Supabase | Fast setup, built-in realtime, generous free tier |
| Auth | Anonymous + optional account | Zero friction to start |
| Styling | StyleSheet only (Phase 1) | Avoids dependency conflicts; add NativeWind later if needed |
| Deps | Install with `npx expo install` | Always gets SDK-compatible versions |

---

## Commands for Claude Code Sessions

### Session 2: Supabase Auth + Pairing
```
Read PLAN.md. Set up Supabase integration: implement anonymous auth in lib/supabase.ts, create the signaling channel using Supabase Realtime for WebRTC SDP exchange, implement QR code pairing. Install new packages with npx expo install.
```

### Session 3: Audio Streaming
```
Read PLAN.md. Install react-native-webrtc with npx expo install. Implement WebRTC audio streaming between baby unit and parent unit using the Supabase signaling channel. Add push-to-talk on the parent unit.
```

### Session 4: Alerts + Notifications
```
Read PLAN.md. Add volume-threshold-based alerts and disconnect detection with push notifications via expo-notifications.
```

---

## Success Metrics

- Setup time: under 30 seconds
- Audio latency: < 300ms
- Sound classification accuracy: > 85%
- Disconnect alert: within 10 seconds
- App Store rating target: 4.7+
