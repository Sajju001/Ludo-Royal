# Ludo Royale Security Specification

## 1. Data Invariants
- User profiles (`/users/{userId}`) contain zero PII (`email`, `phone`, etc.), enforce strict key whitelists (`hasOnly`), and keep `uid` and `createdAt` immutable.
- Password credentials (`/authCredentials/{userId}`) contain zero PII, disable directory listing (`allow list: if false`), and store server-derived salted `scrypt` password hashes paired with a server-signed HMAC integrity proof (`authProof`). Password verification and session cookie issuance happen strictly on the server.
- Multiplayer rooms (`/rooms/{roomCode}`) enforce `^[A-Z0-9]{6}$` room codes, lock `hostId` and `createdAt` immutably, and freeze all mutations once `status == 'finished'`.
- Voice signaling (`/rooms/{roomCode}/voiceSignals/{signalId}`) and peer mic state (`/rooms/{roomCode}/voicePeers/{peerUid}`) use Master Gate parent-room checks on single-doc reads/writes to guarantee room membership and active `playing` room status, and constrain `allow list` to `resource.data.roomCode == roomCode`.

## 2. Adversarial Test Vectors ("Dirty Dozen")
1. Directory scan (`list`) on `/users` or `/authCredentials` -> `PERMISSION_DENIED`
2. Shadow field injection (`isAdmin: true`) on `/users/{uid}` or `/authCredentials/{uid}` -> `PERMISSION_DENIED`
3. Client-forged `createdAt` / `updatedAt` timestamp not equal to `request.time` -> `PERMISSION_DENIED`
4. Forged `/authCredentials/{uid}` without valid server `authProof` -> rejected by `/api/auth/login-password` with HTTP 401
5. Path ID poisoning (`roomCode` invalid or doc ID > 128 chars) -> `PERMISSION_DENIED`
6. Modifying `hostId` on an existing room -> `PERMISSION_DENIED`
7. Updating a room whose `status` is already `'finished'` -> `PERMISSION_DENIED`
8. Joining a room that is already full (`playerUids.size() >= maxPlayers`) -> `PERMISSION_DENIED`
9. Listing all private rooms without public waiting status -> `PERMISSION_DENIED`
10. Sending a WebRTC `voiceSignals` doc from a UID not in parent room's `playerUids` -> `PERMISSION_DENIED`
11. Creating a `voiceSignals` doc with oversized (>16KB) payload or `fromUid == toUid` -> `PERMISSION_DENIED`
12. Deleting an active `'playing'` room -> `PERMISSION_DENIED`
