# Ludo Royale Security Specification

## 1. Data Invariants
- User profiles (`/users/{userId}`) contain zero PII (`email`, `phone`, etc.) and are writable only by the authenticated verified owner (`request.auth.uid == userId`).
- Private PII (`email`, `lastDailyClaimDate`) is isolated under `/users/{userId}/private/{docId}` (`docId == 'account'`) and readable/writable exclusively by `userId`.
- Multiplayer rooms (`/rooms/{roomCode}`) require a verified authenticated user, strictly enforce `^[A-Z0-9]{6}$` room codes, lock `hostId` and `createdAt` immutably, and freeze all mutations once `status == 'finished'`.
- List queries on `/rooms` never delegate filtering to the client: `allow list` restricts results directly on `resource.data` to either public waiting rooms or rooms containing `request.auth.uid`.

## 2. Adversarial Test Vectors ("Dirty Dozen")
1. Unauthenticated read/write on `/users/{uid}` -> `PERMISSION_DENIED`
2. Unverified email user creating a room -> `PERMISSION_DENIED`
3. Shadow field injection (`isAdmin: true`) on `/users/{uid}` create/update -> `PERMISSION_DENIED`
4. Reading another user's `/users/{otherUid}/private/account` -> `PERMISSION_DENIED`
5. Client-forged `createdAt` / `updatedAt` timestamp not equal to `request.time` -> `PERMISSION_DENIED`
6. Path ID poisoning (`roomCode` > 128 chars or non-alphanumeric) -> `PERMISSION_DENIED`
7. Modifying `hostId` on an existing room -> `PERMISSION_DENIED`
8. Non-host starting a waiting room (`status: 'playing'`) -> `PERMISSION_DENIED`
9. Updating a room whose `status` is already `'finished'` -> `PERMISSION_DENIED`
10. Joining a room that is already full (`playerUids.size() >= maxPlayers`) -> `PERMISSION_DENIED`
11. Listing all private rooms without membership -> `PERMISSION_DENIED`
12. Deleting an active `'playing'` room or deleting as non-host -> `PERMISSION_DENIED`
