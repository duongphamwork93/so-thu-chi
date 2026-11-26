# Security Specification — Sổ Thu Chi (Personal Finance Multi-Device Sync)

## 1. Data Invariants
1. **Strict User Ownership**: Every financial document (`/users/{userId}/...`) MUST belong strictly to `userId` (`ownerId == request.auth.uid`). No user can read, list, create, update, or delete another user's financial data.
2. **Verified Identity Required**: All read and write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Parent Master Gate**: No subcollection record (`transactions`, `accounts`, `cards`, `deposits`, `holdings`, `debts`, `goals`, `recurrings`, `transfers`, `customCategories`, `settings`) can be created unless the parent `/users/{userId}` document exists in Firestore.
4. **Immutable Ownership & Timestamps**: `ownerId`, `id` (or `key`), and `createdAt` cannot be modified after document creation. `createdAt` and `updatedAt` MUST equal `request.time`.
5. **Strict Schema & Bounds**: Shadow/unknown fields are rejected via `data.keys().hasAll(...)` and `data.keys().hasOnly(...)`. Every string has explicit `.size()` bounds; every ID matches `^[a-zA-Z0-9_\-]+$`.
6. **Terminal State Locking**: Once a `SavingsDepositItem` or `DebtItemRecord` reaches `closed == true`, updates are blocked to preserve settled ledger integrity (users can still delete or view history if needed, or reopen only if explicitly handled; here settled records are locked against silent mutation).

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Cross-User Read/List**: User B attempts `list` or `get` on `/users/{userA_uid}/transactions`.
2. **Unverified Email Write**: User A with `email_verified: false` attempts to create a transaction.
3. **Owner Spoofing on Create**: User B creates `/users/{userB_uid}/transactions/tx_1` with `ownerId: userA_uid`.
4. **Shadow Field Injection (Create)**: User A creates a transaction containing an extra ghost field `isAdmin: true`.
5. **Shadow Field Injection (Update)**: User A updates an account containing an extra ghost field `bypassLimit: true`.
6. **Orphaned Subcollection Write**: User A attempts to create a transaction before `/users/{userA_uid}` profile exists.
7. **Immutable Field Mutation**: User A attempts to mutate `ownerId` or `createdAt` on an existing transaction.
8. **Fake Timestamp Forgery**: User A creates a transaction with `createdAt: Timestamp(2020-01-01)` instead of `serverTimestamp()`.
9. **ID Poisoning**: User A tries to write to `/users/{userA_uid}/transactions/../../other/doc` or a 1.5KB string document ID.
10. **String Overflow (Denial of Wallet)**: User A submits a transaction `note` with 50,000 characters (> 500 max).
11. **PII Leak Attempt**: User B tries to `get` `/users/{userA_uid}` or `list` `/users`.
12. **Terminal State Mutation**: User A tries to modify `amount` on a `deposits` document where `existing().closed == true`.
