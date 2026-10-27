"""
seed.py — Inserts sample tickets and initial Campus Connect profiles into SQLite.

How it avoids duplicates:
  Before inserting, it checks if the tables already have any rows.
  If they do → skip. If empty → insert seed data.
  This means you can restart the server multiple times without duplicating data.
"""

import json
from datetime import datetime, timedelta
from database import get_connection

SEED_TICKETS = [
    {
        "title":        "Water leak in Library basement",
        "description":  "There is a visible water leak coming from the ceiling near the reading area on Basement Floor 1. The floor is wet and slippery — safety risk.",
        "category":     "Water & Plumbing",
        "location":     "Library, Basement Floor 1",
        "department":   "Facilities Management",
        "priority":     "High",
        "status":       "Open",
        "submitted_by": "Arjun Mehta",
        "ai_suggestion": "Shut off nearest water valve immediately. Contact plumbing contractor. Estimated fix: 2–4 hours.",
        "created_at":   "2026-10-25 09:12:00",
    },
    {
        "title":        "Broken street light near Hostel Block C",
        "description":  "The street light at the main entrance of Hostel Block C has been non-functional for three days. Creates a safety hazard at night.",
        "category":     "Electrical",
        "location":     "Hostel Block C Entrance",
        "department":   "Electrical Department",
        "priority":     "Medium",
        "status":       "In Progress",
        "submitted_by": "Priya Sharma",
        "ai_suggestion": "Replace bulb or check MCB for that circuit. Schedule inspection during daylight hours.",
        "created_at":   "2026-10-24 20:45:00",
    },
    {
        "title":        "Overflowing dustbins near Cafeteria",
        "description":  "The four dustbins outside the main cafeteria are completely full and overflowing. Waste is spilling onto the walkway. Very unhygienic.",
        "category":     "Cleanliness",
        "location":     "Main Cafeteria, Ground Floor",
        "department":   "Housekeeping",
        "priority":     "Medium",
        "status":       "Open",
        "submitted_by": "Rohan Das",
        "ai_suggestion": "Schedule immediate waste collection. Increase pickup frequency during peak hours (12–2 PM).",
        "created_at":   "2026-10-25 11:30:00",
    },
    {
        "title":        "Broken bench in Science Block corridor",
        "description":  "A wooden bench in the corridor of Science Block, 2nd floor, has a broken leg and is a fall hazard for students.",
        "category":     "Infrastructure",
        "location":     "Science Block, 2nd Floor Corridor",
        "department":   "Civil Maintenance",
        "priority":     "Low",
        "status":       "Open",
        "submitted_by": "Sneha Iyer",
        "ai_suggestion": "Mark bench as unsafe immediately. Schedule repair or replacement within 48 hours.",
        "created_at":   "2026-10-24 15:15:00",
    },
    {
        "title":        "AC not cooling in Computer Lab 3",
        "description":  "The air conditioning in Computer Lab 3 (Tech Building, 1st Floor) has not been cooling properly for a week. It turns on but blows warm air.",
        "category":     "Electrical",
        "location":     "Tech Building, Computer Lab 3",
        "department":   "Electrical Department",
        "priority":     "High",
        "status":       "Resolved",
        "submitted_by": "Vikram Singh",
        "ai_suggestion": "Check refrigerant levels and compressor. Clean air filters. Contact HVAC vendor.",
        "created_at":   "2026-10-23 14:00:00",
    },
    {
        "title":        "Pothole at main campus entrance gate",
        "description":  "A large pothole has developed at the main vehicle entrance. Vehicles have to swerve dangerously to avoid it.",
        "category":     "Infrastructure",
        "location":     "Main Campus Entrance Gate",
        "department":   "Civil Maintenance",
        "priority":     "High",
        "status":       "In Progress",
        "submitted_by": "Anjali Patel",
        "ai_suggestion": "Temporary patching required immediately. Schedule full road repair within 1 week.",
        "created_at":   "2026-10-22 10:00:00",
    },
]

SEED_PROFILES = [
    {
        "name": "Aarav Patel",
        "department": "Computer Science & Engineering",
        "study_year": "3rd Year",
        "bio": "Working on AI projects and web dev. Usually studying at the library.",
        "interests": ["Coding", "AI & ML", "Gaming", "Robotics"],
        "activity": "STUDY",
        "duration_minutes": 60,
        "location_area": "Central Library",
        "note": "Prepping Data Structures midterms on 2nd floor, table 4",
    },
    {
        "name": "Meera Nambiar",
        "department": "Civil & Environmental Engineering",
        "study_year": "2nd Year",
        "bio": "Passionate about green campus tech, smart architecture, and tea.",
        "interests": ["Environment & Green Tech", "Reading & Literature", "Design & UI/UX"],
        "activity": "COFFEE",
        "duration_minutes": 30,
        "location_area": "Main Cafeteria",
        "note": "Taking a quick break by the south window, free to chat!",
    },
    {
        "name": "Kabir Sharma",
        "department": "Mechanical Engineering",
        "study_year": "1st Year",
        "bio": "Robotics hobbyist, plays badminton at the campus arena.",
        "interests": ["Robotics", "Football", "Badminton", "Startups"],
        "activity": "WALK",
        "duration_minutes": 15,
        "location_area": "Science & Engineering Quad",
        "note": "Short stroll around the quad before afternoon lab",
    },
    {
        "name": "Diya Sengupta",
        "department": "Biotechnology & Sciences",
        "study_year": "4th Year",
        "bio": "Senior biotech student, debate society coordinator, loves photography.",
        "interests": ["Debating & MUN", "Music", "Photography", "AI & ML"],
        "activity": "CASUAL_CHAT",
        "duration_minutes": 60,
        "location_area": "Student Activity Center (SAC)",
        "note": "Brainstorming project ideas for green campus initiatives",
    },
]


def seed_database():
    """Seed tickets and Campus Connect profiles only if tables are currently empty."""
    with get_connection() as conn:
        # 1. Seed tickets
        ticket_count = conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]
        if ticket_count == 0:
            for t in SEED_TICKETS:
                conn.execute(
                    """
                    INSERT INTO tickets
                      (title, description, category, location, department,
                       priority, status, submitted_by, ai_suggestion, created_at)
                    VALUES
                      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        t["title"], t["description"], t["category"], t["location"],
                        t["department"], t["priority"], t["status"],
                        t["submitted_by"], t["ai_suggestion"], t["created_at"],
                    ),
                )
            conn.commit()
            print(f"  🌱 Seeded {len(SEED_TICKETS)} sample tickets.")
        else:
            print(f"  ⏭️  Tickets table has {ticket_count} ticket(s) — skipping ticket seed.")

        # 2. Seed student profiles & initial availabilities
        profile_count = conn.execute("SELECT COUNT(*) FROM student_profiles").fetchone()[0]
        if profile_count == 0:
            now = datetime.now()
            for sp in SEED_PROFILES:
                cur = conn.execute(
                    """
                    INSERT INTO student_profiles (name, department, study_year, bio, interests)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        sp["name"],
                        sp["department"],
                        sp["study_year"],
                        sp["bio"],
                        json.dumps(sp["interests"]),
                    ),
                )
                pid = cur.lastrowid
                duration = sp["duration_minutes"]
                avail_from = now.strftime("%Y-%m-%d %H:%M:%S")
                expires_at = (now + timedelta(minutes=duration)).strftime("%Y-%m-%d %H:%M:%S")

                conn.execute(
                    """
                    INSERT INTO student_availabilities
                      (profile_id, activity, duration_minutes, location_area, note, available_from, expires_at, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
                    """,
                    (
                        pid,
                        sp["activity"],
                        duration,
                        sp["location_area"],
                        sp["note"],
                        avail_from,
                        expires_at,
                    ),
                )
            conn.commit()
            print(f"  🌱 Seeded {len(SEED_PROFILES)} Campus Connect student profiles with active availability.")
        else:
            print(f"  ⏭️  student_profiles table has {profile_count} profile(s) — skipping connect seed.")
