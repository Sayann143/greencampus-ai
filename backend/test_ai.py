"""
test_ai.py — Automated test suite for Stage 3: Gemini AI classification & fallback.

Tests:
1. Fallback classifier logic on sample water leak report.
2. Structure and Pydantic validation of classification output.
3. Safety rules:
   - Does NOT claim issue is resolved.
   - Does NOT claim campus staff have already been contacted or dispatched.
4. End-to-end FastAPI endpoint POST /api/tickets creating a ticket with AI classification.
5. Cleanup of any test tickets created.
"""

import unittest
from fastapi.testclient import TestClient

from models import GeminiClassification
from ai_service import classify_ticket, fallback_classify, is_api_key_configured
from main import app
from database import get_connection, create_tables


class TestGreenCampusAI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        create_tables()

    def setUp(self):
        # Sample water-leak report as specified in requirements
        self.sample_water_leak = {
            "title": "Severe water leak in Library basement",
            "description": (
                "There is an active water leak gushing from the ceiling near reading desks. "
                "A large puddle is forming on the floor, creating a severe slip hazard for students."
            ),
            "location": "Central Library, Basement Floor 1",
            "category": "Water & Plumbing",
            "submitted_by": "Test Student",
        }

    def test_01_fallback_classifier_water_leak(self):
        """Test fallback classifier classifies water leak with High priority and valid schema."""
        result = fallback_classify(
            title=self.sample_water_leak["title"],
            description=self.sample_water_leak["description"],
            location=self.sample_water_leak["location"],
            user_category=self.sample_water_leak["category"],
        )

        self.assertIsInstance(result, GeminiClassification)
        self.assertEqual(result.category, "Water & Plumbing")
        self.assertEqual(result.priority, "High")
        self.assertIn("Facilities Management", result.department)
        self.assertIn("[Fallback Classifier]", result.explanation)
        self.assertTrue(len(result.recommended_action) > 10)
        self.assertEqual(result.source, "fallback")

    def test_02_classify_ticket_entrypoint(self):
        """Test public classify_ticket function returns valid Pydantic model."""
        result = classify_ticket(
            title=self.sample_water_leak["title"],
            description=self.sample_water_leak["description"],
            location=self.sample_water_leak["location"],
            user_category=self.sample_water_leak["category"],
        )

        self.assertIsInstance(result, GeminiClassification)
        self.assertIn(result.category, [
            "Water & Plumbing", "Electrical", "Cleanliness",
            "Infrastructure", "Sustainability", "Other"
        ])
        self.assertIn(result.priority, ["Low", "Medium", "High"])
        self.assertTrue(bool(result.department))
        self.assertTrue(bool(result.explanation))
        self.assertTrue(bool(result.recommended_action))

    def test_03_safety_rules_compliance(self):
        """Verify output does not claim issue is resolved or staff contacted."""
        result = classify_ticket(
            title=self.sample_water_leak["title"],
            description=self.sample_water_leak["description"],
            location=self.sample_water_leak["location"],
            user_category=self.sample_water_leak["category"],
        )

        forbidden_phrases = [
            "has been resolved",
            "issue is resolved",
            "staff have arrived",
            "technician has arrived",
            "staff have been contacted",
            "contractor has been contacted",
        ]
        combined = f"{result.explanation} {result.recommended_action}".lower()
        for phrase in forbidden_phrases:
            self.assertNotIn(phrase, combined, f"Output should not contain '{phrase}'")

    def test_04_api_create_ticket_with_ai(self):
        """Test POST /api/tickets creates a ticket with AI classification and Open status."""
        with TestClient(app) as client:
            response = client.post("/api/tickets", json=self.sample_water_leak)
            self.assertEqual(response.status_code, 201)

            data = response.json()
            self.assertIn("id", data)
            created_id = data["id"]

            try:
                self.assertEqual(data["title"], self.sample_water_leak["title"])
                self.assertEqual(data["status"], "Open")
                self.assertEqual(data["category"], "Water & Plumbing")
                self.assertEqual(data["priority"], "High")
                self.assertIsNotNone(data["ai_suggestion"])
                self.assertTrue(len(data["ai_suggestion"]) > 10)
            finally:
                # Clean up test ticket from database
                with get_connection() as conn:
                    conn.execute("DELETE FROM tickets WHERE id = ?", (created_id,))
                    conn.commit()

    def test_05_api_ai_classify_preview(self):
        """Test POST /api/ai/classify preview endpoint."""
        with TestClient(app) as client:
            response = client.post("/api/ai/classify", json={
                "title": self.sample_water_leak["title"],
                "description": self.sample_water_leak["description"],
                "location": self.sample_water_leak["location"],
                "category": self.sample_water_leak["category"],
            })
            self.assertEqual(response.status_code, 200)

            data = response.json()
            self.assertEqual(data["category"], "Water & Plumbing")
            self.assertEqual(data["priority"], "High")
            self.assertIn("department", data)
            self.assertIn("explanation", data)
            self.assertIn("recommended_action", data)


if __name__ == "__main__":
    print(f"Running Stage 3 tests (API Key Configured: {is_api_key_configured()})...")
    unittest.main()
