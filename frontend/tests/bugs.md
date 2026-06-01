# FitTrack E2E Test — Discovered Bugs

Bugs discovered by running the Playwright test suite (`npm run test:e2e`).
**Last test run:** 2026-06-01 — 140 passed, 1 failed, 2 skipped (143 total).

---

## Format

### BUG-XXX: Short descriptive title
- **Spec:** `tests/e2e/<path>/file.spec.ts`
- **Test:** `describe block > test name`
- **Date:** YYYY-MM-DD
- **Severity:** Critical | High | Medium | Low
- **Status:** Open | In Progress | Fixed | Won't Fix
- **Reproduction:**
  1. Step 1
  2. **Expected:** …
  3. **Actual:** …
- **Screenshot:** `test-results/<folder>/test-failed-1.png`
- **Notes:** API response body, console errors, network tab observations.

---

## Open Bugs

### BUG-001: Trainer name not shown on client profile page
- **Spec:** `tests/e2e/client/profile.spec.ts`
- **Test:** `Client Profile (/profile) > shows trainer name banner`
- **Date:** 2026-06-01
- **Severity:** Medium
- **Status:** Open
- **Reproduction:**
  1. Register a trainer, get invite code
  2. Register a client using that invite code
  3. Log in as the client and navigate to `/profile`
  4. **Expected:** A banner reading "Ваш тренер: `<trainer first name>` `<trainer last name>`" appears below the page header
  5. **Actual:** No trainer banner is rendered; the `trainer_first_name` / `trainer_last_name` fields are absent from the API response
- **Screenshot:** `test-results/client-profile-Client-Prof-3d95c-e-shows-trainer-name-banner-chromium/test-failed-1.png`
- **Notes:**
  - Backend endpoint: `GET /api/v1/clients/me`
  - Go struct fields: `TrainerFirstName string \`json:"trainer_first_name,omitempty"\`` and `TrainerLastName string \`json:"trainer_last_name,omitempty"\``
  - The `omitempty` tag on a non-pointer `string` means the field is **omitted** when it equals `""`. If the `clientSelectWithTrainer` JOIN returns an empty string instead of the trainer's name, the field is silently dropped from JSON.
  - The React component in `Profile.tsx` shows the banner only when `client.trainer_first_name || client.trainer_last_name` is truthy; if both are `undefined` (due to omitempty omission), no banner renders.
  - **Likely root cause:** The `clientSelectWithTrainer` SQL query uses an `INNER JOIN` on both `trainers` and `users` tables. If the trainer record or its associated user is unavailable at query time, pgx returns `pgx.ErrNoRows`, the service returns 404, and the React app falls into an indefinite loader. However in the tested case the page fully loads (form data is visible), which means the JOIN succeeds but `tu.first_name` scans as an empty string — possibly a column ordering/aliasing issue between the SELECT list and the Scan call, or a NULL being returned unexpectedly.
  - **Files to investigate:** `backend/internal/modules/clients/repository.go:44-78` (`clientSelectWithTrainer`, `scanClientWithTrainer`)

---

### BUG-002: Missing ON DELETE CASCADE on clients.trainer_id causes teardown failures
- **Spec:** N/A (infrastructure / DB schema)
- **Test:** N/A — discovered via test teardown analysis
- **Date:** 2026-06-01
- **Severity:** Medium
- **Status:** Open
- **Reproduction:**
  1. Create a trainer user and a client linked to that trainer
  2. Attempt to DELETE the trainer user via `DELETE /admin/users/:trainerId`
  3. **Expected:** Trainer user, their trainers record, and their clients' records all cascade-deleted
  4. **Actual:** PostgreSQL raises a foreign key constraint violation (`clients.trainer_id` → `trainers.trainer_id` has no `ON DELETE CASCADE`), the DELETE is silently rejected (error swallowed in teardown's `.catch(() => {})`), and the stale trainer record persists in the DB
- **Screenshot:** N/A
- **Notes:**
  - Migration file: `backend/internal/db/migrations/001_init.up.sql`
  - Affected FK: `clients.trainer_id BIGINT NOT NULL REFERENCES trainers(trainer_id)` — missing `ON DELETE CASCADE`
  - Consequence: over multiple test runs, orphaned trainer records accumulate. Any client created under that trainer still appears in their client list, polluting trainer-specific queries.
  - **Fix:** Add `ON DELETE CASCADE` (or `ON DELETE SET NULL` if clients without a trainer is a valid state) to the `clients.trainer_id` foreign key. Example migration:
    ```sql
    ALTER TABLE clients DROP CONSTRAINT clients_trainer_id_fkey;
    ALTER TABLE clients ADD CONSTRAINT clients_trainer_id_fkey
      FOREIGN KEY (trainer_id) REFERENCES trainers(trainer_id) ON DELETE CASCADE;
    ```
  - Workaround applied in test teardown: client user is now deleted **before** trainer user to satisfy the FK constraint order.

---

### BUG-003: Register test creates clients linked to E2E trainer but never cleans them up
- **Spec:** `tests/e2e/auth/register.spec.ts`
- **Test:** `Registration page > registers a client with valid invite code and redirects to /profile`
- **Date:** 2026-06-01
- **Severity:** Low
- **Status:** Open
- **Reproduction:**
  1. Run the full test suite multiple times
  2. After each run, a "Test Client" user remains in the DB linked to the current E2E trainer
  3. **Expected:** All users created during tests are cleaned up by global teardown
  4. **Actual:** `register.spec.ts` creates a client (`first_name: 'Test'`, `last_name: 'Client'`) using `env.inviteCode`; this user is not in `test-env.json` so teardown never deletes it. Over multiple runs the trainer accumulates unrelated clients.
- **Notes:**
  - Symptom: Trainer client list shows "Всего: 2+" with unexpected client names
  - Fix options: (a) Store dynamically created users in teardown context and clean them up, or (b) use a unique domain suffix that the teardown queries and deletes in bulk (`DELETE FROM users WHERE email LIKE '%@test.local%'`).

---

## Fixed Bugs / Test Infrastructure Fixes Applied

### TEST-FIX-001: `fullyParallel: true` broke shared state in beforeAll blocks
- **Status:** Fixed
- **Fix:** Changed `fullyParallel: false` in `playwright.config.ts`. Tests within each file now run sequentially in the same worker, preserving `let planId`, `let workoutId`, etc.

### TEST-FIX-002: Strict mode violations in multiple spec files
- **Status:** Fixed
- **Fixes applied:**
  - `register.spec.ts`: `getByText('Тренер')` → `locator('[data-table="users"][data-attr="role"]').getByText('Тренер')` (targets only the role chip container)
  - `admin/users.spec.ts`: `getByText('Тренеры')` / `getByText('Клиенты')` → `getByRole('button', { name: ... })` (avoids matching subtitle text)
  - `admin/users.spec.ts`: `getByText(email)` → `.first()` (email appears in both desktop table and mobile card)
  - `food-diary.spec.ts`: `getByText('Дневник питания')` → `getByRole('heading', { name: ... })`
  - `notifications.spec.ts`: `getByText('Уведомления')` → `getByRole('heading', { name: ... })`
  - `trainer/exercises.spec.ts`: `getByText('Упражнения')` → `getByRole('heading', { name: ... })`
  - `schedule.spec.ts`: `getByText('Начать')` / `getByText('45 мин')` → `.first()`

### TEST-FIX-003: Wrong fitness level label in profile test
- **Status:** Fixed
- **Fix:** `LEVEL_LABEL` uses `'Начальный'`, not `'Начинающий'`. Test updated to `getByRole('button', { name: 'Начальный' })`.

### TEST-FIX-004: Питание tab date regex failed on Cyrillic
- **Status:** Fixed
- **Fix:** Changed regex from `/\d{1,2} \w+ \d{4}/` (JS `\w` doesn't match Cyrillic) to `/\d{1,2} .+ 20\d{2}/`.

### TEST-FIX-005: Setup project testDir mismatch
- **Status:** Fixed
- **Fix:** Added `testDir: './tests/fixtures'` to the setup project in `playwright.config.ts`. Without it, the setup file was outside the default `testDir: './tests/e2e'` and wasn't found.

### TEST-FIX-006: Teardown deleted trainer before client causing FK violation
- **Status:** Fixed
- **Fix:** `global.teardown.ts` now explicitly deletes the client user first, then the trainer user.

### TEST-FIX-007: Template delete tests clicked wrong "Удалить" button
- **Status:** Fixed
- **Fix:** Templates delete tests now filter for the specific card containing the unique template text before clicking delete, instead of using `.last()` which selected the wrong card as templates accumulated.
