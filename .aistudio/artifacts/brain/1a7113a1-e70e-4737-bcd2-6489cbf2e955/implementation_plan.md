# Ludo Royale — Gameplay, Auth & Voice Chat Upgrade Plan

An upgrade to Ludo Royale that removes blocking loading screens, synchronizes live 3D dice spinning across multiplayer peers, rotates the board so every player's own tokens and dice always sit at the bottom-left, adds full Name + Email + Password accounts with first-time and password-reset OTPs, and introduces live WebRTC voice chat with one-tap Mic On/Off controls.

## User Review & Critical Decisions

> [!IMPORTANT] All core UX preferences from Phase 1 are locked in below. Review and click Proceed to begin implementation.

- **Bottom-Left Player Perspective**: In Online, Play with Friends, and Play vs. Computer matches, the board and player pods automatically rotate so the local player's home yard, tokens, and dice always sit at the **bottom-left corner**.
- **Fixed Board in Local Pass & Play**: When playing Local Multiplayer on a single device, the board stays in a fixed orientation so players around one phone don't experience jarring screen flips between turns.
- **Voice Chat Defaults**: Live multiplayer voice chat starts **muted** on match entry with a one-tap **Mic On/Off** button (plus a speaker mute toggle), requesting microphone permission only when the player taps to speak.
- **Zero-Spinner Instant Updates**: Screen transitions, room entry, dice rolls, and token moves update optimistically without full-screen loading spinners or blocking overlays.

---

## 1. Overview & Core Concept

- **What It Does**: Elevates Ludo Royale from a static-board OTP prototype into a responsive, social multiplayer board game featuring perspective-corrected gameplay, real-time synced dice animations, familiar email/password authentication with OTP verification, and built-in peer-to-peer voice chat.
- **Target Audience**: Casual and competitive Ludo players on mobile and desktop who want instant responsiveness, natural bottom-seat ergonomics, simple password login after initial verification, and live voice banter with friends.
- **Key Value**: Eliminates waiting screens, upside-down play from upper quadrants, repetitive OTP entry on every sign-in, and the need for external calling apps while playing together.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Account Sign Up, Password Login & Forgot Password**:
   - **Sign Up Tab**: Player enters **Display Name**, **Email**, and **Password**, then receives a **first-time 6-digit OTP** by email. Entering the OTP creates their account, hashes their password on the server, syncs their profile, and keeps them logged in via the 30-day persistent session.
   - **Sign In Tab (Normal Login)**: Returning players simply enter **Email + Password** to sign in immediately without waiting for an OTP.
   - **Forgot Password Flow**: Player enters their **Email**, receives a **6-digit reset OTP**, verifies it, and sets a new password.
2. **Perspective-Rotated Board & Synchronized Rolling Dice**:
   - When entering any Online, Friends, or vs-Computer game, the board coordinates and surrounding 4 corner player pods smoothly map the local player's color to the **bottom-left** seat.
   - When any player taps the dice (or AI rolls), a shared `ROLLING` phase broadcasts immediately so every connected player sees the 3D dice cube actively tumbling 360° in real time before landing simultaneously on the final face.
3. **Instant Seamless Transitions (Zero Loading Screens)**:
   - Opening rooms, joining matches, rolling dice, and moving pieces react immediately via optimistic local state updates while cloud writes complete quietly in the background.
4. **Live Voice Chat in Multiplayer Matches**:
   - A compact **Mic On/Off** control and **Voice Audio** mute toggle sit cleanly in the arena HUD bar alongside Quick Chat emotes.
   - Mic begins muted (`Mic Off`). Tapping **Mic On** connects peer-to-peer audio streams with all active room players and displays a subtle active-mic indicator on speaking players' pods.

### Visual Identity & Theme

- **Aesthetic Direction**: High-craft tactile royal board game preserving the existing **Royal Velvet** (deep purple `#160B33` / `#271257` + polished gold `#FFBC41`) palette alongside **Heritage Wood** and **Midnight Arena** selectable themes.
- **Color Budget (60-30-10)**: 60% deep royal arena canvas, 30% structured 15×15 board & corner pods, 10% high-intent gold/crimson action controls and active turn rings (with non-color turn/mic labels and icons for accessibility).
- **Typography & Controls**: `Poppins` display headers + `Plus Jakarta Sans` UI body with `tabular-nums` on coin/match counters and single-line (`whitespace-nowrap`) HUD buttons.
- **Motion & Latency**: Snappy $\le 200\text{ms}$ button feedback, smooth compositor-only token spring hops, upright board stars/arrows/crowns regardless of board rotation, and instant optimistic move rendering.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Coordinate-Level Board Rotation vs. Whole-Container CSS Rotation**
  - *Chosen Approach*: Transform the 15×15 grid `(row, col)` coordinates and quadrant yard slots mathematically around the board center (`0`, `90°`, `180°`, `270°`) based on the local player's color.
  - *Why*: Rotating the entire DOM node with CSS `transform: rotate(...)` flips star icons, entry arrows, crown emblems, and 3D token drop-shadows sideways or upside-down. Coordinate rotation keeps every icon and pawn shadow crisp and upright while placing the player's yard at bottom-left.
  - *Alternatives Considered*: CSS `rotate()` on the wrapper with per-child counter-rotation (fragile across responsive breakpoints).

- **Decision 2: Server-Verified Password Auth + Firestore Credential Store**
  - *Chosen Approach*: Hash passwords on the server with salted `scrypt`, stamp each credential record with an HMAC integrity tag tied to the user's hashed ID, store only non-PII credential hashes in a dedicated Firestore collection (`allow list: false`), and verify logins + issue the 30-day `HttpOnly` session cookie on the server.
  - *Why*: Works seamlessly on Vercel Serverless Functions without needing Firebase Admin IAM permissions or manual Firebase Console Auth provider setup, while keeping normal logins OTP-free and password resets OTP-protected.
  - *Alternatives Considered*: Enabling Firebase Email/Password Auth in the Firebase Console (explicitly avoided per user requirement).

- **Decision 3: WebRTC Peer-to-Peer Voice Mesh via Firestore Signaling**
  - *Chosen Approach*: Establish direct browser-to-browser `RTCPeerConnection` audio streams between room players (2–4 peers max) using Firestore subcollections inside the room for SDP offers/answers, ICE candidates, and mic mute state.
  - *Why*: Delivers low-latency, full-duplex voice chat inside both local preview and Vercel serverless deployments without requiring a paid media server or persistent WebSocket relay.
  - *Alternatives Considered*: Dedicated SFU/WebSocket audio relay server (incompatible with stateless Vercel serverless hosting).

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          Browser Client (React)                         │
│  ┌──────────────┐   ┌───────────────────┐   ┌────────────────────────┐  │
│  │  Auth Modal  │   │  Game Arena HUD   │   │  WebRTC Voice Engine   │  │
│  │ SignUp/Login │   │ Perspective Board │   │ Mic On/Off + PeerAudio │  │
│  │ Forgot + OTP │   │ Synced 360° Dice  │   │ Echo-Cancelled Streams │  │
│  └──────┬───────┘   └─────────┬─────────┘   └───────────┬────────────┘  │
└─────────┼─────────────────────┼─────────────────────────┼───────────────┘
          │ HTTPS JSON          │ Real-Time Snapshot      │ SDP / ICE Signals
          ▼                     ▼                         ▼
┌──────────────────────┐  ┌───────────────────────────────────────────────┐
│  Server / Vercel API │  │          Cloud Firestore Database             │
│  • send-otp          │  │  • users/{uid} (Profile, Coins, Stats)        │
│  • register (scrypt) │  │  • authCredentials/{uid} (Salted Hash + Tag)  │
│  • login-password    │  │  • rooms/{code} (Live Board & ROLLING Dice)   │
│  • reset-password    │  │  • rooms/{code}/voiceSignals (WebRTC Handshake│
│  • session / logout  │  │  • rooms/{code}/voicePeers (Mic Active State) │
└──────────────────────┘  └───────────────────────────────────────────────┘
```

### Data Model & Security Safeguards

- **User Profiles & Private Credentials Split**: Public/game profile stats (`displayName`, `avatarId`, `coins`, `gems`, `wins`) live separately from salted `scrypt` password hashes, with zero raw email addresses stored in Firestore and directory listing disabled.
- **Server-Enforced Password & OTP Security**: All password hashing (`scrypt` + per-user random salt), timing-safe comparisons, OTP verification, and 30-day `HttpOnly` session cookies are executed strictly on the server with HMAC-bound credential integrity tags.
- **Room-Scoped Voice & Game Rules**: Firestore security rules enforce strict schema validation (`hasOnly`), room membership checks via parent document lookups (`Master Gate`) for voice signaling subcollections, immutable room ownership, and terminal state locking once a match finishes.

### Interactive Component & State Mapping

- **Auth Tabs & Handlers**: `Sign In` (Email + Password), `Sign Up` (Name + Email + Password → inline 6-digit OTP verification → auto-profile creation), and `Forgot Password` (Email → 6-digit OTP → New Password update) all execute inline with instant validation feedback and no full-screen blockers.
- **Board & Pod Orientation**: A deterministic perspective helper maps `[Bottom-Left, Top-Left, Top-Right, Bottom-Right]` colors from the local player's color (`blue` fixed in Local mode) and transforms every track, home-lane, yard, and token coordinate smoothly.
- **Live Synced Dice Loop**: Clicking Roll transitions `turnPhase` to `ROLLING` immediately (syncing to Firestore so opponents see the 3D dice spinning), then transitions to `SELECT_TOKEN` / `WAITING_ROLL` on roll completion, firing Smart Auto-Move when applicable.
- **Voice Chat Lifecycle**: Tapping **Mic On/Off** acquires or toggles the microphone audio track, negotiates WebRTC peer audio connections via Firestore room signaling, updates the player's mic badge in `voicePeers`, and tears down all tracks and peer connections cleanly upon exiting the arena.
