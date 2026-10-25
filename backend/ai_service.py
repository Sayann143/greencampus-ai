"""
ai_service.py — AI Classification service using Google Gemini and a rule-based fallback.

Responsibilities:
1. Loads GEMINI_API_KEY from backend environment / .env file.
2. Calls Gemini using the official google-genai SDK with structured JSON outputs.
3. Validates every response against the GeminiClassification Pydantic schema.
4. Handles missing API keys, rate limits, invalid output, and network errors gracefully.
5. Provides a clearly-labelled fallback classifier when the Gemini key is absent or unreachable.
6. Strictly abides by campus safety guidelines:
   - Does NOT claim an issue is resolved.
   - Does NOT claim staff/contractors have already been contacted or dispatched.
"""

import os
import re
import json
import logging
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

from models import GeminiClassification, AICategoryType, PriorityType

# Configure logger
logger = logging.getLogger("greencampus.ai")
logging.basicConfig(level=logging.INFO)

# Load .env file from the backend folder
ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

DEFAULT_MODEL = "gemini-2.5-flash"


def is_api_key_configured() -> bool:
    """Check if a real Gemini API key is configured (not empty or default placeholder)."""
    key = os.getenv("GEMINI_API_KEY", "").strip()
    placeholder_patterns = [
        "",
        "your_gemini_api_key_here",
        "your_key_here",
        "placeholder",
    ]
    return bool(key) and key.lower() not in placeholder_patterns


# ─────────────────────────────────────────────────────────────────────────────
# FALLBACK CLASSIFIER (Clearly labelled, zero-dependency, always reliable)
# ─────────────────────────────────────────────────────────────────────────────
def fallback_classify(
    title: str,
    description: str,
    location: str,
    user_category: Optional[str] = None,
) -> GeminiClassification:
    """
    Keyword-based fallback classifier used when:
    - GEMINI_API_KEY is not set
    - Gemini API is unreachable, quota-exhausted, or returns an error

    Clearly labelled with '[Fallback Classifier]' in explanation.
    Never claims the issue is resolved or staff have been dispatched.
    """
    combined_text = f"{title} {description} {location} {user_category or ''}".lower()

    # Keyword rules for categorization
    water_keywords = [
        "water", "leak", "leaking", "pipe", "tap", "faucet", "drain", "drainage",
        "flush", "toilet", "washroom", "restroom", "sink", "sewage", "sewer",
        "plumbing", "flood", "flooding", "overflow", "drip", "dripping"
    ]
    electrical_keywords = [
        "electric", "electrical", "light", "lighting", "bulb", "lamp", "spark",
        "sparking", "wire", "wiring", "power", "switch", "socket", "outlet",
        "blackout", "ac", "air condition", "air-condition", "cooler", "fan",
        "generator", "mcb", "circuit", "short circuit", "voltage", "projector"
    ]
    cleanliness_keywords = [
        "garbage", "trash", "dustbin", "bin", "waste", "dirty", "filth", "clean",
        "cleanliness", "smell", "odour", "odor", "litter", "spill", "stain",
        "housekeeping", "hygiene", "unhygienic", "pest", "rodent", "insects"
    ]
    infrastructure_keywords = [
        "bench", "desk", "chair", "table", "door", "window", "glass", "pothole",
        "road", "pathway", "sidewalk", "wall", "crack", "cracked", "tile",
        "corridor", "ceiling", "floor", "stairs", "staircase", "step", "railing",
        "handrail", "lock", "handle", "gate", "fence", "lift", "elevator"
    ]
    sustainability_keywords = [
        "solar", "recycle", "recycling", "compost", "composting", "energy waste",
        "food waste", "tree", "greenery", "garden", "plants", "sustainable",
        "sustainability", "conservation", "water waste", "plastic"
    ]

    # Category matching
    if any(k in combined_text for k in water_keywords):
        category: AICategoryType = "Water & Plumbing"
        department = "Facilities Management (Plumbing)"
        high_risk_words = ["flood", "ceiling", "burst", "heavy", "electrical", "hazard", "slip", "gushing"]
        if any(w in combined_text for w in high_risk_words):
            priority: PriorityType = "High"
            explanation = (
                "[Fallback Classifier] Active water leakage identified near campus facilities. "
                "Presents immediate slip-and-fall hazard and potential structural/water damage risk."
            )
        else:
            priority = "Medium"
            explanation = (
                "[Fallback Classifier] Plumbing or water fixture defect reported. "
                "Requires timely maintenance to avoid water wastage and area deterioration."
            )
        recommended_action = (
            "Locate and isolate the nearest section shut-off valve, cordon off wet flooring with caution cones, "
            "and schedule plumbing technician inspection."
        )

    elif any(k in combined_text for k in electrical_keywords):
        category = "Electrical"
        department = "Campus Electrical Services"
        high_risk_words = ["spark", "fire", "smoke", "shock", "exposed", "burning", "danger", "hazard"]
        if any(w in combined_text for w in high_risk_words):
            priority = "High"
            explanation = (
                "[Fallback Classifier] Critical electrical fault with elevated safety risk. "
                "Presents hazard of electric shock, equipment damage, or electrical fire."
            )
        else:
            priority = "Medium"
            explanation = (
                "[Fallback Classifier] Electrical malfunction reported affecting lighting, cooling, or power delivery."
            )
        recommended_action = (
            "Switch off power at the local distribution board/MCB, place a hazard warning tag on the fixture, "
            "and schedule certified electrician diagnosis."
        )

    elif any(k in combined_text for k in cleanliness_keywords):
        category = "Cleanliness"
        department = "Housekeeping & Sanitation"
        high_risk_words = ["biohazard", "toxic", "chemical", "severe", "overflowing", "infestation"]
        priority = "Medium" if any(w in combined_text for w in high_risk_words) else "Low"
        explanation = (
            "[Fallback Classifier] Sanitation or waste accumulation reported on campus premises. "
            "Impacts campus hygiene and student comfort."
        )
        recommended_action = (
            "Dispatch housekeeping crew for waste collection, empty disposal bins, and sanitize surrounding surfaces."
        )

    elif any(k in combined_text for k in infrastructure_keywords):
        category = "Infrastructure"
        department = "Civil Works & Infrastructure"
        high_risk_words = ["collapse", "pothole", "broken glass", "stairs", "railing", "danger", "fall"]
        priority = "High" if any(w in combined_text for w in high_risk_words) else "Medium"
        explanation = (
            "[Fallback Classifier] Physical infrastructure or structural fixture reported damaged. "
            "Requires civil maintenance to prevent injury and restore facility function."
        )
        recommended_action = (
            "Mark the damaged item or zone with physical warning signage and schedule civil maintenance repairs."
        )

    elif any(k in combined_text for k in sustainability_keywords):
        category = "Sustainability"
        department = "Campus Sustainability Office"
        priority = "Low"
        explanation = (
            "[Fallback Classifier] Sustainability or ecological conservation observation on campus. "
            "Presents opportunity to optimize campus resource usage."
        )
        recommended_action = (
            "Log report with the Campus Sustainability Office for resource assessment and green initiative review."
        )

    else:
        # Default fallback
        category = "Other"
        department = "Campus Operations"
        priority = "Medium"
        explanation = (
            "[Fallback Classifier] Campus issue logged under general operations for evaluation."
        )
        recommended_action = (
            "Review report details, assign to appropriate building supervisor, and conduct on-site verification."
        )

    return GeminiClassification(
        category=category,
        priority=priority,
        department=department,
        explanation=explanation,
        recommended_action=recommended_action,
        source="fallback",
    )


# ─────────────────────────────────────────────────────────────────────────────
# GEMINI CLASSIFIER (Official google-genai SDK with structured output)
# ─────────────────────────────────────────────────────────────────────────────
def classify_with_gemini(
    title: str,
    description: str,
    location: str,
    user_category: Optional[str] = None,
) -> GeminiClassification:
    """
    Calls Google Gemini using the official `google-genai` SDK.
    Enforces structured JSON output validated against GeminiClassification.
    """
    # Import here so that backend works even if SDK imports fail in minimal test environments
    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model_name = os.getenv("GEMINI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL

    # Initialize official client
    client = genai.Client(api_key=api_key)

    system_instruction = (
        "You are the expert campus facility and operations triage assistant for GreenCampus AI.\n"
        "Your task is to analyze campus issue reports submitted by students and staff, and categorize them accurately.\n"
        "\n"
        "ALLOWED CATEGORIES:\n"
        "- 'Water & Plumbing' (leaks, pipe bursts, drainage, taps, toilets, floods)\n"
        "- 'Electrical' (power cuts, faulty lights, sparking, exposed wires, broken fans, ACs, projectors)\n"
        "- 'Cleanliness' (overflowing bins, litter, unhygienic washrooms, pest sightings, foul odors)\n"
        "- 'Infrastructure' (potholes, damaged stairs, broken furniture, doors, windows, structural cracks)\n"
        "- 'Sustainability' (energy wastage, continuous tap running without fault, recycling opportunities, campus greenery)\n"
        "- 'Other' (general campus issues not covered above)\n"
        "\n"
        "PRIORITY GUIDELINES:\n"
        "- 'High': Immediate safety hazards (sparking wires, active flooding, slippery floor in heavy traffic, broken stairs)\n"
        "- 'Medium': Impairs campus activities or causes discomfort (AC breakdown in lab, unlit path, broken bench, full bins)\n"
        "- 'Low': Minor cosmetic issues, non-urgent maintenance, general feedback\n"
        "\n"
        "STRICT ETHICAL & OPERATIONAL RULES:\n"
        "1. The ticket status is currently 'Open'. Do NOT claim or assume that the issue has been resolved.\n"
        "2. Do NOT claim or state that campus staff, technicians, or contractors have already been contacted, dispatched, or arrived.\n"
        "3. Frame 'recommended_action' as actionable, concrete immediate instructions for maintenance responders (e.g. 'Shut off supply valve and schedule plumbing repair', NOT 'Staff has arrived').\n"
        "4. Provide a clear, factual 'explanation' (1-2 sentences) of the root concern and priority rationale."
    )

    prompt = (
        f"Campus Issue Report to Triage:\n"
        f"Title: {title}\n"
        f"Location: {location}\n"
        f"User-Suggested Category: {user_category or 'Not specified'}\n"
        f"Detailed Description: {description}\n"
        f"\n"
        f"Generate the structured JSON classification adhering to the schema."
    )

    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=GeminiClassification,
            temperature=0.2,
        ),
    )

    if not response or not response.text:
        raise ValueError("Gemini returned an empty response.")

    # Validate output with Pydantic
    parsed = GeminiClassification.model_validate_json(response.text)
    # Ensure source is marked as gemini
    return GeminiClassification(
        category=parsed.category,
        priority=parsed.priority,
        department=parsed.department,
        explanation=parsed.explanation,
        recommended_action=parsed.recommended_action,
        source="gemini",
    )


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PUBLIC FUNCTION (Automatic fallback on any failure)
# ─────────────────────────────────────────────────────────────────────────────
def classify_ticket(
    title: str,
    description: str,
    location: str,
    user_category: Optional[str] = None,
) -> GeminiClassification:
    """
    Main entry point for classifying a campus issue ticket.

    1. Checks if GEMINI_API_KEY is configured. If not, uses fallback classifier.
    2. Calls Gemini API using google-genai SDK with structured output schema.
    3. If any error occurs (network, rate limit, quota, invalid JSON), catches it,
       logs a descriptive warning, and returns a valid fallback classification.
    """
    if not is_api_key_configured():
        logger.info("GEMINI_API_KEY is not configured — using fallback classifier.")
        return fallback_classify(title, description, location, user_category)

    try:
        logger.info("Classifying campus issue using Gemini AI...")
        result = classify_with_gemini(title, description, location, user_category)
        logger.info("Gemini classification successful: %s [%s]", result.category, result.priority)
        return result
    except Exception as exc:
        logger.warning(
            "Gemini classification failed (%s: %s). Falling back to rule-based classifier.",
            type(exc).__name__,
            exc,
        )
        fallback = fallback_classify(title, description, location, user_category)
        # Note the fallback reason in the explanation for transparency
        fallback.explanation = f"{fallback.explanation} (Fallback activated due to: {type(exc).__name__})"
        return fallback
