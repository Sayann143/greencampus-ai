"""
test_connect.py — Automated test suite for Campus Connect (Profiles, Availability & Connection Requests).

Verifies:
1. Student profile creation and retrieval.
2. Broadcasting availability for 15, 30, or 60 minutes.
3. Backend enforcement of active vs expired status.
4. Cancelling availability (stopping broadcast).
5. Filtering active students by activity and shared interest.
6. Integrity of existing GreenCampus AI ticket routes.
7. Step 2: Connection request creation, self-request prevention, duplicate prevention.
8. Step 2: Permission enforcement on accepting/rejecting requests.
9. Step 2: Mutual connections list retrieval.
"""

import unittest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from main import app
from database import create_tables, get_connection
from seed import seed_database


class TestCampusConnect(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        create_tables()
        seed_database()

    def test_01_create_and_list_profile(self):
        """Test creating a new student profile with interests and bio."""
        with TestClient(app) as client:
            payload = {
                "name": "Sarah Jenkins",
                "department": "Computer Science & Engineering",
                "study_year": "2nd Year",
                "bio": "Enjoys competitive programming and badminton.",
                "interests": ["Coding", "AI & ML", "Badminton"],
            }
            res = client.post("/api/connect/profiles", json=payload)
            self.assertEqual(res.status_code, 201)
            data = res.json()
            self.assertIn("id", data)
            self.assertEqual(data["name"], "Sarah Jenkins")
            self.assertEqual(data["department"], "Computer Science & Engineering")
            self.assertEqual(data["interests"], ["Coding", "AI & ML", "Badminton"])
            profile_id = data["id"]

            list_res = client.get("/api/connect/profiles")
            self.assertEqual(list_res.status_code, 200)
            profiles = list_res.json()
            found = any(p["id"] == profile_id for p in profiles)
            self.assertTrue(found)

            with get_connection() as conn:
                conn.execute("DELETE FROM student_profiles WHERE id = ?", (profile_id,))
                conn.commit()

    def test_02_broadcast_and_get_available(self):
        """Test marking a student available for 30 minutes and checking the active directory."""
        with TestClient(app) as client:
            p_res = client.post("/api/connect/profiles", json={
                "name": "Tariq Ali",
                "department": "Mechanical Engineering",
                "study_year": "3rd Year",
                "bio": "Studying thermodynamics at Central Library.",
                "interests": ["Robotics", "Gaming"],
            })
            profile_id = p_res.json()["id"]

            try:
                avail_res = client.post("/api/connect/availability", json={
                    "profile_id": profile_id,
                    "activity": "STUDY",
                    "duration_minutes": 30,
                    "location_area": "Central Library",
                    "note": "Working on problem set 4",
                })
                self.assertEqual(avail_res.status_code, 201)
                avail_data = avail_res.json()
                self.assertEqual(avail_data["activity"], "STUDY")
                self.assertEqual(avail_data["duration_minutes"], 30)
                self.assertEqual(avail_data["status"], "ACTIVE")
                self.assertTrue(avail_data["minutes_remaining"] > 25)

                dir_res = client.get("/api/connect/available")
                self.assertEqual(dir_res.status_code, 200)
                students = dir_res.json()
                active_match = next((s for s in students if s["profile_id"] == profile_id), None)
                self.assertIsNotNone(active_match)
                self.assertEqual(active_match["name"], "Tariq Ali")
            finally:
                with get_connection() as conn:
                    conn.execute("DELETE FROM student_profiles WHERE id = ?", (profile_id,))
                    conn.commit()

    def test_03_cancel_availability(self):
        """Test stopping availability broadcast removes student from active directory."""
        with TestClient(app) as client:
            p_res = client.post("/api/connect/profiles", json={
                "name": "Ananya Roy",
                "department": "Biotechnology",
                "study_year": "4th Year",
                "interests": ["Music", "Reading & Literature"],
            })
            profile_id = p_res.json()["id"]

            try:
                client.post("/api/connect/availability", json={
                    "profile_id": profile_id,
                    "activity": "COFFEE",
                    "duration_minutes": 15,
                    "location_area": "Main Cafeteria",
                })

                cancel_res = client.post(f"/api/connect/availability/{profile_id}/cancel")
                self.assertEqual(cancel_res.status_code, 200)

                dir_res = client.get("/api/connect/available")
                students = dir_res.json()
                found = any(s["profile_id"] == profile_id for s in students)
                self.assertFalse(found)
            finally:
                with get_connection() as conn:
                    conn.execute("DELETE FROM student_profiles WHERE id = ?", (profile_id,))
                    conn.commit()

    def test_04_filters_activity_and_interest(self):
        """Test filtering active students by activity and shared interest."""
        with TestClient(app) as client:
            res_study = client.get("/api/connect/available?activity=STUDY")
            self.assertEqual(res_study.status_code, 200)
            for s in res_study.json():
                self.assertEqual(s["activity"], "STUDY")

            res_coding = client.get("/api/connect/available?interest=Coding")
            self.assertEqual(res_coding.status_code, 200)
            for s in res_coding.json():
                self.assertTrue(any("coding" in i.lower() for i in s["interests"]))

    def test_05_backend_enforces_expiration(self):
        """Test that past/expired availabilities are excluded by the backend query."""
        with get_connection() as conn:
            p_cur = conn.execute(
                "INSERT INTO student_profiles (name, department, study_year) VALUES ('Expired Student', 'Physics', '1st Year')"
            )
            expired_pid = p_cur.lastrowid
            past_time = (datetime.now() - timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
            past_start = (datetime.now() - timedelta(minutes=40)).strftime("%Y-%m-%d %H:%M:%S")

            conn.execute(
                """
                INSERT INTO student_availabilities
                  (profile_id, activity, duration_minutes, location_area, available_from, expires_at, status)
                VALUES (?, 'STUDY', 30, 'Central Library', ?, ?, 'ACTIVE')
                """,
                (expired_pid, past_start, past_time),
            )
            conn.commit()

        try:
            with TestClient(app) as client:
                res = client.get("/api/connect/available")
                self.assertEqual(res.status_code, 200)
                found = any(s["profile_id"] == expired_pid for s in res.json())
                self.assertFalse(found)
        finally:
            with get_connection() as conn:
                conn.execute("DELETE FROM student_profiles WHERE id = ?", (expired_pid,))
                conn.commit()

    def test_06_connection_requests_flow(self):
        """Test Step 2: Sending, preventing self/duplicate requests, accepting, and listing connections."""
        with TestClient(app) as client:
            # Create two test students
            s1 = client.post("/api/connect/profiles", json={
                "name": "Student Alpha",
                "department": "Computer Science",
                "study_year": "2nd Year",
                "interests": ["Coding"],
            }).json()
            s2 = client.post("/api/connect/profiles", json={
                "name": "Student Beta",
                "department": "Electronics",
                "study_year": "3rd Year",
                "interests": ["Robotics"],
            }).json()

            p1_id, p2_id = s1["id"], s2["id"]

            try:
                # 1. Self-request should fail with 400
                self_res = client.post("/api/connect/requests", json={
                    "sender_id": p1_id,
                    "receiver_id": p1_id,
                    "message": "Self connect",
                })
                self.assertEqual(self_res.status_code, 400)
                self.assertIn("yourself", self_res.json()["detail"].lower())

                # 2. Valid request from Alpha to Beta
                req_res = client.post("/api/connect/requests", json={
                    "sender_id": p1_id,
                    "receiver_id": p2_id,
                    "message": "Hey Beta, want to study at the library?",
                })
                self.assertEqual(req_res.status_code, 201)
                req_data = req_res.json()
                self.assertEqual(req_data["status"], "PENDING")
                self.assertEqual(req_data["sender_id"], p1_id)
                self.assertEqual(req_data["receiver_id"], p2_id)
                request_id = req_data["id"]

                # 3. Duplicate request should fail with 400
                dup_res = client.post("/api/connect/requests", json={
                    "sender_id": p1_id,
                    "receiver_id": p2_id,
                })
                self.assertEqual(dup_res.status_code, 400)
                self.assertIn("already pending", dup_res.json()["detail"].lower())

                # 4. Reverse pending request should fail with 400
                rev_res = client.post("/api/connect/requests", json={
                    "sender_id": p2_id,
                    "receiver_id": p1_id,
                })
                self.assertEqual(rev_res.status_code, 400)

                # 5. Check pending received for Beta
                pending_res = client.get(f"/api/connect/requests/pending?profile_id={p2_id}")
                self.assertEqual(pending_res.status_code, 200)
                pending_list = pending_res.json()
                self.assertEqual(len(pending_list), 1)
                self.assertEqual(pending_list[0]["sender"]["name"], "Student Alpha")

                # 6. Unauthorized user cannot accept Beta's request (Permission check)
                unauth_res = client.patch(f"/api/connect/requests/{request_id}", json={
                    "action": "ACCEPT",
                    "profile_id": 9999,  # Not the recipient
                })
                self.assertEqual(unauth_res.status_code, 403)

                # 7. Beta accepts Alpha's request
                accept_res = client.patch(f"/api/connect/requests/{request_id}", json={
                    "action": "ACCEPT",
                    "profile_id": p2_id,
                })
                self.assertEqual(accept_res.status_code, 200)
                self.assertEqual(accept_res.json()["status"], "ACCEPTED")

                # 8. Check my connections for both Alpha and Beta
                alpha_conns = client.get(f"/api/connect/connections?profile_id={p1_id}").json()
                self.assertEqual(len(alpha_conns), 1)
                self.assertEqual(alpha_conns[0]["peer_profile"]["name"], "Student Beta")

                beta_conns = client.get(f"/api/connect/connections?profile_id={p2_id}").json()
                self.assertEqual(len(beta_conns), 1)
                self.assertEqual(beta_conns[0]["peer_profile"]["name"], "Student Alpha")

                # 9. Status map check
                status_map = client.get(f"/api/connect/requests/status-map?profile_id={p1_id}").json()
                self.assertEqual(status_map.get(str(p2_id)), "CONNECTED")

            finally:
                with get_connection() as conn:
                    conn.execute("DELETE FROM student_profiles WHERE id IN (?, ?)", (p1_id, p2_id))
                    conn.commit()

    def test_07_reject_request_flow(self):
        """Test rejecting a connection request."""
        with TestClient(app) as client:
            s1 = client.post("/api/connect/profiles", json={"name": "Alice", "department": "Civil", "study_year": "1st Year"}).json()
            s2 = client.post("/api/connect/profiles", json={"name": "Bob", "department": "Mech", "study_year": "1st Year"}).json()
            p1_id, p2_id = s1["id"], s2["id"]

            try:
                req = client.post("/api/connect/requests", json={"sender_id": p1_id, "receiver_id": p2_id}).json()
                req_id = req["id"]

                # Bob rejects Alice's request
                reject_res = client.patch(f"/api/connect/requests/{req_id}", json={
                    "action": "REJECT",
                    "profile_id": p2_id,
                })
                self.assertEqual(reject_res.status_code, 200)
                self.assertEqual(reject_res.json()["status"], "REJECTED")

                # Bob should have 0 pending received requests
                pending = client.get(f"/api/connect/requests/pending?profile_id={p2_id}").json()
                self.assertEqual(len(pending), 0)

                # Neither should have connections
                conns = client.get(f"/api/connect/connections?profile_id={p1_id}").json()
                self.assertEqual(len(conns), 0)
            finally:
                with get_connection() as conn:
                    conn.execute("DELETE FROM student_profiles WHERE id IN (?, ?)", (p1_id, p2_id))
                    conn.commit()

    def test_08_existing_ticket_routes_intact(self):
        """Confirm that GreenCampus AI issue reporting endpoints remain completely functional."""
        with TestClient(app) as client:
            health = client.get("/api/health")
            self.assertEqual(health.status_code, 200)
            self.assertEqual(health.json()["status"], "ok")

            tickets = client.get("/api/tickets")
            self.assertEqual(tickets.status_code, 200)
            self.assertTrue(len(tickets.json()) >= 6)


if __name__ == "__main__":
    unittest.main()
