# Ludo Royale — Implementation Plan

Ludo Royale is a responsive, classic Ludo web game inspired by the royal purple, gold, and crimson visual language of the attached reference, featuring a pure TypeScript rules engine, configurable Smart AI, local Pass & Play, and real-time room-code multiplayer backed by Firebase Authentication and Cloud Firestore.

## User Review & Critical Decisions

> [!IMPORTANT]
> All core product decisions below reflect your Phase 1 selections and form the architectural baseline for implementation.

- **Confirmed Brand Identity**: **Ludo Royale** featuring a custom golden crown, navy-indigo shield emblem, and crimson ribbon banner across the splash screen, dashboard, and victory modal.
- **Confirmed Visual Theme**: **Royal Purple & Gold** default palette (`#1B0E3A`–`#5A2DAB` deep violet canvas, `#FFBC41` coin gold, `#FF201B` crimson, `#4396FC` sky blue, `#F300CC` magenta accents, `Poppins` display & `Plus Jakarta Sans` UI typography), paired with selectable board themes (**Royal Velvet**, **Classic Heritage**, and **Midnight Arena**) in Settings.
- **Confirmed Multiplayer & Persistence**: **Real-time Room Codes via Firestore + Guest Mode** — anyone can immediately play against AI or in Local Multiplayer as a Guest (with preferences and coins saved locally), while signing in with Google unlocks cloud profile/coin sync and real-time 2–4 player Firestore room codes.
- **Confirmed Ruleset & AI**: **Classic Rules + Smart AI (`Easy`, `Normal`, `Hard`)** implementing full 57-step Ludo movement, 6-to-enter, bonus rolls on 6/capture/home finish, 8 safe star/start zones, exact-roll finish, and an optional toggleable three-consecutive-sixes forfeit rule.

---

## 1. Overview & Core Concept

- **What It Does**: Delivers a complete, end-to-end Ludo gaming experience across four playable modes: **Play Online** (join or host public room codes), **Play with Friends** (private 6-character room codes synced via Firestore), **Play with Computer** (1 human vs. 1–3 AI opponents across 3 difficulty tiers), and **Local Multiplayer** (2–4 players Pass & Play on one device).
- **Target Audience**: Casual board-game players on mobile phones, tablets, and desktops looking for crisp board readability, fast responsive animations, and zero-friction guest play with optional online rooms.
- **Key Value**: Decouples an exact, deterministic Ludo state machine from a tactile, reference-faithful UI so every button, dice roll, token hop, capture, and match outcome behaves reliably without stubbed states.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Launch & Home Dashboard**:
   - Opens directly into the **Ludo Royale** Home Dashboard (no forced login wall).
   - Top HUD displays player avatar & name (or Guest badge with quick Google Sign-In), Gold Coins, Gems, Daily Lucky Dice reward button, Rules guide trigger, and Settings button.
   - Centerpiece displays the Crown Shield emblem and four primary mode cards (**Play Online**, **Play with Friends**, **Play with Computer**, **Local Multiplayer**).
2. **Match Setup & Lobby**:
   - Selecting **Computer** or **Local Multiplayer** opens a Match Setup panel: select 2, 3, or 4 players, pick your token color (Red, Green, Yellow, Blue), select AI difficulty (`Easy` / `Normal` / `Hard`), configure optional 3-Sixes Forfeit rule, and launch immediately.
   - Selecting **Play with Friends** or **Play Online** opens the Room Lobby: create a room with an entry coin stake & player count (generating a shareable 6-character code) or enter an existing room code to join in real time via Firestore.
3. **Active Ludo Arena**:
   - Responsive 15×15 classic Ludo board centered in the viewport, surrounded by 4 corner Player HUD pods (avatar, name, coin/progress indicator, active-turn highlight ring, quick-emote bubble, and interactive 3D-styled dice).
   - Rolling the dice triggers a Web Audio synthesized dice rattle and tumble animation. If no token has a legal move, turns advance smoothly after a brief feedback beat; if only one legal move exists (or the player taps a highlighted pulsing token), the token hops step-by-step along the board path.
   - Captures trigger a flash/burst and send the opponent's token back to its yard while awarding a bonus roll. Reaching the center home triangle awards a bonus roll and marks finish order.
   - Top bar includes Exit Match (guarded by a Yes/No confirmation modal matching the reference), Sound/Music quick toggles, and Rules sheet.
4. **Match Result & Rewards**:
   - Automatic winner detection displays the **YOU WIN!** ribbon banner, celebratory confetti, ranked podium (1st–4th), coins & XP rewarded, and working **Play Again** and **Home** actions.

### Visual Identity & Theme

- **Aesthetic Direction**: Modern Royal Arcade — rich indigo-violet backdrop gradients paired with high-contrast board quadrants so colored tokens and star safe zones pop effortlessly.
- **Color Palette & Mood**:
  - *Canvas (60%)*: Deep Royal Violet (`#1B0E3A` to `#3A1C71`) and dark indigo surfaces (`#24134D`).
  - *Structural Surfaces (30%)*: Elevated indigo cards (`#2F1963`), crisp white board lanes (`#F8FAFC`), subtle translucent borders (`rgba(255,255,255,0.12)`).
  - *Focal Accents & Player Colors (10%)*: Coin Gold (`#FFBC41`), Crimson Red (`#FF201B`), Emerald Green (`#16A34A`), Sunburst Yellow (`#FACC15`), Electric Blue (`#4396FC`), and Magenta (`#F300CC`).
- **Typography & Hierarchy**: `Poppins` (600–800) for game titles, banners, and numeric counters (`tabular-nums`), paired with `Plus Jakarta Sans` (400–600) for clean, readable menus, rules, and player names.
- **Interactive Feedback & Motion**:
  - Compositor-only `transform` and `opacity` animations via `motion` for dice rolls, step-by-step token hops (`<= 140ms` per cell), selectable token pulse rings, and modal transitions.
  - Web Audio API procedural sound engine for dice rattle, token hop, capture impact, safe-zone chime, victory fanfare, and optional toggleable ambient background music loop.

---

## 3. Key Product Decisions & Trade-Offs

- **Pure TypeScript Engine Separated from React UI**:
  - *Chosen Approach*: Implement all Ludo board geometry, coordinate mapping, legal-move calculation, capture/safe-zone logic, and AI heuristics inside pure TypeScript modules independent of React state.
  - *Why*: Guarantees deterministic classic rules across local play, AI turns, and Firestore-synced online games, and prevents UI animation timers from corrupting board state.
  - *Alternatives Considered*: Embedding move logic inside React component event handlers (rejected due to tight coupling and sync bugs during multiplayer).
- **Guest-First Experience + Firebase Auth & Firestore**:
  - *Chosen Approach*: Store local preferences (Sound, Music, Theme, Guest profile/coins) in `localStorage` so Guest users can launch AI and Local Multiplayer immediately, while provisioning Firebase Auth (Google Sign-In) and Cloud Firestore for persistent cloud profiles and real-time room-code multiplayer.
  - *Why*: Meets the requirement to never force login for guest play while keeping shared online rooms authenticated and secured under strict Firestore security rules.
- **Web Audio API Procedural Sound & Music**:
  - *Chosen Approach*: Synthesize crisp dice rolls, hops, captures, chimes, and optional background music using the browser's native Web Audio API.
  - *Why*: Zero external MP3 loading failures, instant low-latency playback, and full respect for Sound/Music ON/OFF toggles in Settings.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Ludo Royale Client                           │
│                                                                      │
│  ┌────────────────────┐      ┌────────────────────────────────────┐  │
│  │   Pure Ludo Engine │◄────►│        React UI & Screens          │  │
│  │  - Board 15x15 Map │      │  - Home Dashboard & Mode Setup     │  │
│  │  - Rules & Turns   │      │  - Interactive Board & Token Layer │  │
│  │  - Capture & Safe  │      │  - Corner Player Pods & Dice       │  │
│  │  - Smart AI (E/N/H)│      │  - Victory Modal, Rules, Settings  │  │
│  └─────────┬──────────┘      └──────────┬──────────────────┬──────┘  │
│            │                            │                  │         │
│            ▼                            ▼                  ▼         │
│  ┌────────────────────┐      ┌──────────────────┐  ┌──────────────┐  │
│  │  Web Audio Engine  │      │  LocalStorage    │  │ Firebase SDK │  │
│  │  (SFX + Music)     │      │  (Guest & Prefs) │  │ (Auth + DB)  │  │
│  └────────────────────┘      └──────────────────┘  └──────┬───────┘  │
└───────────────────────────────────────────────────────────┼──────────┘
                                                            │
                                                            ▼
                                            ┌──────────────────────────┐
                                            │   Firebase Backend       │
                                            │  - Google Auth           │
                                            │  - /users/{uid}/...      │
                                            │  - /rooms/{roomCode}     │
                                            │  - Hardened Rules +      │
                                            │    Blueprint Schema      │
                                            └──────────────────────────┘
```

### Data Model & State

- **Pure Game State (`GameState`)**:
  - `players`: Ordered list of active players (`red`, `green`, `yellow`, `blue`), each with `id`, `name`, `avatarId`, `type` (`human` | `ai` | `remote`), `aiDifficulty`, `tokens` (4 tokens each with `step: -1..56`, where `-1` is yard, `0..50` is relative main track, `51..55` is home column, `56` is finished), and `finishRank`.
  - `currentTurnIndex`, `diceValue`, `turnPhase` (`WAITING_ROLL` | `ROLLING` | `SELECT_TOKEN` | `ANIMATING_MOVE` | `GAME_OVER`), `consecutiveSixes`, `winners` array, and `lastEvent` (capture, safe landing, bonus roll, emote).
- **Local Preferences (`LocalPreferences`)**:
  - `soundEnabled`, `musicEnabled`, `boardTheme` (`royal` | `classic` | `midnight`), `threeSixesRule`, `guestName`, `guestAvatar`, `guestCoins`, `guestGems`, `lastDailyClaim`.
- **Firestore Collections (`firebase-blueprint.json`)**:
  - `users/{userId}` (public display profile: `displayName`, `avatarId`, `coins`, `gems`, `wins`, `gamesPlayed`, `updatedAt`) and `users/{userId}/private/account` (strict owner-only PII such as email & claim timestamps).
  - `rooms/{roomCode}` (real-time multiplayer room state: `hostId`, `status` (`waiting` | `playing` | `finished`), `maxPlayers`, `stake`, `threeSixesRule`, `playerIds`, `players`, `gameState`, `lastEmote`, `createdAt`, `updatedAt`).

### Interactive Component & State Mapping

- **Dice Control**: Clickable only by the active local player during `WAITING_ROLL` -> triggers tumble animation & SFX -> computes 1–6 roll -> transitions to `SELECT_TOKEN` (highlighting valid tokens) or auto-advances if zero moves are legal (or forfeits on 3rd consecutive 6 if enabled).
- **Token Selection & Movement**: Clicking a glowing valid token (or AI selecting via difficulty evaluator after a 600ms thinking delay) triggers sequential cell-by-cell coordinate hops -> evaluates capture on non-safe squares -> checks for finish rank & game over -> broadcasts updated `gameState` to Firestore when in an online room.
- **Online Room Sync**: `onSnapshot` listener on `rooms/{roomCode}` keeps all connected players synchronized in real time, guarded by `handleFirestoreError` and a React `ErrorBoundary`.
- **Firebase Provisioning Flow**: Before writing Firebase SDK or rules files, we will provision Firebase via the interactive `firebase_setup` UI and RPC flow, define `firebase-blueprint.json`, validate `firestore.rules` with `@firebase/eslint-plugin-security-rules`, and deploy rules.
