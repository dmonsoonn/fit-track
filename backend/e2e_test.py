"""End-to-end smoke test against the running FitTrack backend.

Walks the CLAUDE.md scenario with real HTTP calls and asserts each step.
Run with the stack up:  python backend/e2e_test.py
"""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://localhost:8080/api/v1"
PASS, FAIL = 0, 0


def call(method, path, token=None, body=None, expect=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            status, payload = r.status, json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        status, payload = e.code, json.loads(e.read() or "null")
    if expect is not None and status != expect:
        raise AssertionError(f"{method} {path} -> {status} (expected {expect}): {payload}")
    return status, payload


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


def main():
    stamp = int(time.time())
    trainer_email = f"trainer{stamp}@test.local"
    client_email = f"client{stamp}@test.local"
    pw = "passw0rd123"

    print("\n[1] Admin login")
    _, p = call("POST", "/auth/login", body={"email": "admin@fittrack.local", "password": "admin1234"}, expect=200)
    admin = p["data"]["token"]
    check("admin receives JWT", bool(admin))

    print("\n[2] Admin lists users")
    _, p = call("GET", "/admin/users", token=admin, expect=200)
    check("admin sees >=1 user", len(p["data"]) >= 1, str(len(p["data"])))

    print("\n[3] RBAC: admin token forbidden on client-only route")
    st, _ = call("GET", "/clients/me", token=admin)
    check("admin blocked from /clients/me (403)", st == 403, f"got {st}")

    print("\n[4] Register trainer")
    call("POST", "/auth/register", body={
        "email": trainer_email, "first_name": "Тест", "last_name": "Тренер",
        "password": pw, "role": "trainer"}, expect=201)
    _, p = call("POST", "/auth/login", body={"email": trainer_email, "password": pw}, expect=200)
    trainer = p["data"]["token"]
    check("trainer receives JWT", bool(trainer))

    print("\n[5] Trainer gets invite code")
    _, p = call("GET", "/trainers/me/invite-code", token=trainer, expect=200)
    invite = p["data"]["invite_code"]
    check("invite code present", bool(invite), invite)

    print("\n[6] Register client with invite code")
    call("POST", "/auth/register", body={
        "email": client_email, "first_name": "Тест", "last_name": "Клиент",
        "password": pw, "role": "client", "invite_code": invite}, expect=201)
    _, p = call("POST", "/auth/login", body={"email": client_email, "password": pw}, expect=200)
    client = p["data"]["token"]
    check("client receives JWT", bool(client))

    print("\n[7] Bad invite code rejected")
    st, _ = call("POST", "/auth/register", body={
        "email": f"x{stamp}@t.local", "first_name": "X", "last_name": "Y",
        "password": pw, "role": "client", "invite_code": "NOPE"})
    check("invalid invite code -> 400", st == 400, f"got {st}")

    print("\n[8] Trainer sees the client")
    _, p = call("GET", "/trainer/clients", token=trainer, expect=200)
    check("client appears in trainer's list", len(p["data"]) == 1, str(p["data"]))
    client_id = p["data"][0]["client_id"]

    print("\n[9] Trainer creates an active plan")
    _, p = call("POST", f"/trainer/clients/{client_id}/plans", token=trainer,
                body={"title": "Набор массы — фаза 1", "description": "тест", "is_active": True}, expect=201)
    plan_id = p["data"]["workout_plan_id"]
    check("plan created & active", p["data"]["is_active"] is True)

    print("\n[10] Client sees active plan")
    _, p = call("GET", "/clients/me/plans", token=client, expect=200)
    check("client's active plan matches", p["data"]["workout_plan_id"] == plan_id)

    print("\n[11] Trainer creates an exercise")
    _, p = call("POST", "/exercises", token=trainer,
                body={"name": "Приседания со штангой", "muscle_group": "Ноги", "description": "База"}, expect=201)
    exercise_id = p["data"]["exercise_id"]
    check("exercise created", bool(exercise_id))

    print("\n[12] Trainer creates a workout in the plan")
    # Mirrors the frontend: datetime-local "2026-06-01T18:00" normalized to include seconds.
    _, p = call("POST", f"/plans/{plan_id}/workouts", token=trainer,
                body={"scheduled_date": "2026-06-01T18:00:00", "duration_minutes": 60}, expect=201)
    workout_id = p["data"]["workout_id"]
    check("workout created (planned)", p["data"]["status"] == "planned")

    print("\n[13] Trainer adds exercise to workout")
    _, p = call("POST", f"/workouts/{workout_id}/exercises", token=trainer,
                body={"exercise_id": exercise_id, "sets": 4, "reps": 10, "weight": 80, "order": 0}, expect=201)
    we_id = p["data"]["workout_exercise_id"]
    check("workout exercise added", bool(we_id))

    print("\n[14] Client schedule shows the workout")
    _, p = call("GET", "/clients/me/schedule", token=client, expect=200)
    check("workout in client schedule", any(w["workout_id"] == workout_id for w in p["data"]))

    print("\n[15] Client sees workout exercises with planned params")
    _, p = call("GET", f"/workouts/{workout_id}/exercises", token=client, expect=200)
    check("planned params returned", p["data"][0]["sets"] == 4 and p["data"][0]["reps"] == 10)

    print("\n[16] Client saves results")
    call("POST", f"/workouts/{workout_id}/results", token=client, body={"results": [
        {"workout_exercise_id": we_id, "actual_sets": 4, "actual_reps": 9,
         "actual_weight": 82.5, "client_comment": "колено беспокоило"}]}, expect=201)
    check("results accepted", True)

    print("\n[17] Client completes the workout")
    call("POST", f"/workouts/{workout_id}/complete", token=client, expect=200)
    _, p = call("GET", f"/workouts/{workout_id}", token=client, expect=200)
    check("workout now completed", p["data"]["status"] == "completed")

    print("\n[18] RBAC: trainer cannot complete a workout")
    st, _ = call("POST", f"/workouts/{workout_id}/complete", token=trainer)
    check("trainer blocked from complete (403)", st == 403, f"got {st}")

    print("\n[19] Trainer receives workout_completed notification")
    _, p = call("GET", "/notifications", token=trainer, expect=200)
    types = [n["type"] for n in p["data"]]
    check("trainer has workout_completed", "workout_completed" in types, str(types))

    print("\n[20] Trainer reads back the saved results")
    _, p = call("GET", f"/workouts/{workout_id}/results", token=trainer, expect=200)
    check("actual results persisted", p["data"][0]["actual_weight"] == 82.5, str(p["data"]))

    print("\n[21] Client food diary CRUD")
    date = "2026-06-01"
    _, p = call("POST", f"/clients/me/food-logs/{date}/entries", token=client,
                body={"title": "Овсянка", "calories": 480, "protein": 18, "fat": 14, "carbs": 62}, expect=201)
    entry_id = p["data"]["food_entry_id"]
    _, p = call("GET", f"/clients/me/food-logs/{date}", token=client, expect=200)
    check("food entry stored", any(e["food_entry_id"] == entry_id for e in p["data"]["entries"]))
    call("DELETE", f"/clients/me/food-logs/entries/{entry_id}", token=client, expect=200)

    print("\n[22] Unauthorized request rejected")
    st, _ = call("GET", "/clients/me")
    check("no token -> 401", st == 401, f"got {st}")

    print(f"\n==== RESULT: {PASS} passed, {FAIL} failed ====")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
