"""
ai_service.py — Resilient Multi-Tier AI Classification & Chat Service with Full Rate-Limit Fallback.

Fallback Architecture:
  1. Primary Free Gemini Model (configurable via GEMINI_MODEL / GEMINI_PRIMARY_MODEL, e.g. gemini-2.5-flash)
  2. Sequential Secondary Free Gemini Models:
     gemini-2.5-flash -> gemini-2.0-flash -> gemini-2.0-flash-lite -> gemini-1.5-flash -> gemini-1.5-flash-8b
  3. xAI Grok (grok-2-latest / grok-beta) via REST API
  4. OpenAI (gpt-4o-mini) via REST API
  5. Deterministic Local Campus Engine (Zero external dependencies, always available)

Features:
  - Ticket Classification (classify_ticket)
  - Interactive Conversational Campus Assistant (generate_chat_reply)
  - Full Error & Quota Handling (429 RateLimit, ResourceExhausted, 503 Overloaded, Timeouts)
  - Strict Safety Guidelines: Never falsely claims issues are resolved or staff dispatched.
"""

import os
import re
import json
import logging
import urllib.request
import urllib.error
from datetime import datetime
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

from models import (
    GeminiClassification,
    AICategoryType,
    PriorityType,
    ChatMessage,
    ChatResponse,
)

# Configure logger
logger = logging.getLogger("greencampus.ai")
logging.basicConfig(level=logging.INFO)

# Load .env file from backend folder
ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

DEFAULT_PRIMARY_GEMINI = os.getenv("GEMINI_PRIMARY_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.5-flash")).strip()
DEFAULT_GROK_MODEL = os.getenv("XAI_MODEL", "grok-2-latest").strip()
DEFAULT_OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
REQUEST_TIMEOUT_SECONDS = 12

# Sequential free Gemini models to cycle through if primary hits limits or errors
FREE_GEMINI_FALLBACK_MODELS = [
    DEFAULT_PRIMARY_GEMINI,
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-8b",
]

# De-duplicate while preserving order
_seen = set()
CANDIDATE_GEMINI_MODELS = [m for m in FREE_GEMINI_FALLBACK_MODELS if not (m in _seen or _seen.add(m))]

SYSTEM_INSTRUCTION_TRIAGE = (
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

SYSTEM_INSTRUCTION_CHAT = (
    "You are 'Echo', the intelligent, friendly, vibrant AI companion and operations brain of GreenCampus AI.\n"
    "\n"
    "WHO YOU ARE & SYSTEM CONTEXT:\n"
    "- Name: Echo (GreenCampus AI Assistant).\n"
    "- Platform: GreenCampus AI — a university smart campus management, issue reporting, and student connect platform.\n"
    "- Architecture: Full-stack system built with React + Vite on Vercel, Python + FastAPI on Render, persistent database, "
    "and a resilient 4-tier AI engine (Google Gemini Studio, xAI Grok, OpenAI, and local campus engine).\n"
    "\n"
    "WHAT YOU CAN DO:\n"
    "1. ⚡ Instant Facility Triage: Help students & staff report broken facilities (leaks, electrical, ACs, trash, potholes), "
    "assess urgency (High/Medium/Low), and route to departments (Facilities, Electrical, Housekeeping, Civil Maintenance).\n"
    "2. 📊 Track Campus Tickets: Guide users on how to check live ticket status and summary statistics on the Dashboard.\n"
    "3. 🤝 Campus Connect Matchmaking: Explain how students can broadcast availability for 15, 30, or 60 mins for "
    "STUDY, COFFEE, LUNCH, WALK, or CASUAL_CHAT across designated campus areas.\n"
    "4. 🌱 Sustainability Hacks: Give campus-tailored recycling tips, energy reduction advice, and green living habits.\n"
    "\n"
    "WHAT YOU CANNOT DO:\n"
    "1. 🚫 You cannot physically repair broken pipes, change light bulbs, or flip breakers (university facilities staff do that).\n"
    "2. 🚫 You cannot claim an issue is resolved or that technicians have already arrived when they haven't.\n"
    "3. 🚫 You cannot access confidential student grades, financial data, or collect invasive live GPS tracking.\n"
    "\n"
    "CONVERSATION & GREETING GUIDELINES:\n"
    "- When user says 'Hi', 'Hello', 'Hey', 'Who are you?', or 'What can you do?':\n"
    "  Give a warm, enthusiastic greeting introducing yourself as Echo! Clearly summarize what GreenCampus AI is, "
    "what you CAN do (triage issues, track tickets, find study buddies via Campus Connect, green hacks), and what you "
    "CANNOT do (physical repairs, claiming things are resolved). Provide 3 clickable starter action suggestions!\n"
    "- When user reports a CRITICAL EMERGENCY (fire, smoke, bare sparking wires, gushing ceiling flood, injury):\n"
    "  IMMEDIATELY give urgent safety advice (evacuate, do not touch water/wires), tell them to call campus security/emergency services, "
    "and direct them to file an urgent ticket under 'High Priority' with location details.\n"
    "- When user asks about errors, backend status, fallbacks, or system connectivity:\n"
    "  Be transparent, intelligent, and helpful! Explain that GreenCampus AI uses a 5-tier resilient architecture:\n"
    "  1) Google Gemini 2.5 Flash (Primary free-tier studio model)\n"
    "  2) Sequential Gemini Free Fallbacks (gemini-2.0-flash, gemini-1.5-flash, gemini-2.0-flash-lite)\n"
    "  3) xAI Grok (grok-2-latest)\n"
    "  4) OpenAI (gpt-4o-mini)\n"
    "  5) Deterministic Local Campus Rule Engine (always available offline)\n"
    "  Mention that any API error (like 429 RateLimit or network timeout) is automatically caught and handled gracefully so students always get assistance.\n"
    "- Tone: Friendly, modern, upbeat with relevant emojis (✨, 🌿, 💡, ☕, ⚡). Keep it punchy and actionable."
)


def _is_valid_key(key: Optional[str]) -> bool:
    """Helper to verify a non-empty, non-placeholder API key."""
    if not key or not key.strip():
        return False
    placeholders = {
        "your_gemini_api_key_here",
        "your_key_here",
        "placeholder",
        "your_xai_api_key_here",
        "your_openai_api_key_here",
    }
    return key.strip().lower() not in placeholders


def is_gemini_configured() -> bool:
    return _is_valid_key(os.getenv("GEMINI_API_KEY"))


def is_xai_configured() -> bool:
    return _is_valid_key(os.getenv("XAI_API_KEY"))


def is_openai_configured() -> bool:
    return _is_valid_key(os.getenv("OPENAI_API_KEY"))


def is_api_key_configured() -> bool:
    return is_gemini_configured() or is_xai_configured() or is_openai_configured()


def get_ai_providers_status() -> dict:
    """Returns detailed status of all AI tiers for /api/health."""
    active_primary = "rule_based_fallback"
    if is_gemini_configured():
        active_primary = f"gemini ({DEFAULT_PRIMARY_GEMINI})"
    elif is_xai_configured():
        active_primary = f"grok ({DEFAULT_GROK_MODEL})"
    elif is_openai_configured():
        active_primary = f"openai ({DEFAULT_OPENAI_MODEL})"

    return {
        "active_primary": active_primary,
        "gemini": {
            "configured": is_gemini_configured(),
            "model": DEFAULT_PRIMARY_GEMINI,
            "primary_model": DEFAULT_PRIMARY_GEMINI,
            "fallback_models": CANDIDATE_GEMINI_MODELS,
        },
        "grok": {
            "configured": is_xai_configured(),
            "model": DEFAULT_GROK_MODEL,
        },
        "openai": {
            "configured": is_openai_configured(),
            "model": DEFAULT_OPENAI_MODEL,
        },
        "rule_based_fallback": {
            "configured": True,
            "status": "always active",
        },
    }


def _build_triage_prompt(
    title: str,
    description: str,
    location: str,
    user_category: Optional[str] = None,
) -> str:
    return (
        f"Campus Issue Report to Triage:\n"
        f"Title: {title}\n"
        f"Location: {location}\n"
        f"User-Suggested Category: {user_category or 'Not specified'}\n"
        f"Detailed Description: {description}\n"
        f"\n"
        f"Generate the structured JSON classification with keys: "
        f"category, priority, department, explanation, recommended_action."
    )


# ─────────────────────────────────────────────────────────────────────────────
# TIER 4: DETERMINISTIC LOCAL RULE-BASED FALLBACK CLASSIFIER
# ─────────────────────────────────────────────────────────────────────────────
def fallback_classify(
    title: str,
    description: str,
    location: str,
    user_category: Optional[str] = None,
) -> GeminiClassification:
    """Guaranteed zero-dependency keyword classifier."""
    combined_text = f"{title} {description} {location} {user_category or ''}".lower()

    water_keywords = [
        "water", "leak", "leaking", "pipe", "tap", "faucet", "drain", "drainage",
        "flush", "toilet", "washroom", "restroom", "sink", "sewage", "sewer",
        "plumbing", "flood", "flooding", "overflow", "drip", "dripping",
    ]
    electrical_keywords = [
        "electric", "electrical", "light", "lighting", "bulb", "lamp", "spark",
        "sparking", "wire", "wiring", "power", "switch", "socket", "outlet",
        "blackout", "ac", "air condition", "air-condition", "cooler", "fan",
        "generator", "mcb", "circuit", "short circuit", "voltage", "projector",
    ]
    cleanliness_keywords = [
        "garbage", "trash", "dustbin", "bin", "waste", "dirty", "filth", "clean",
        "cleanliness", "smell", "odour", "odor", "litter", "spill", "stain",
        "housekeeping", "hygiene", "unhygienic", "pest", "rodent", "insects",
    ]
    infrastructure_keywords = [
        "bench", "desk", "chair", "table", "door", "window", "glass", "pothole",
        "road", "pathway", "sidewalk", "wall", "crack", "cracked", "tile",
        "corridor", "ceiling", "floor", "stairs", "staircase", "step", "railing",
        "handrail", "lock", "handle", "gate", "fence", "lift", "elevator",
    ]
    sustainability_keywords = [
        "solar", "recycle", "recycling", "compost", "composting", "energy waste",
        "food waste", "tree", "greenery", "garden", "plants", "sustainable",
        "sustainability", "conservation", "water waste", "plastic",
    ]

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
            action = "Locate and isolate the nearest section shut-off valve, cordon off wet flooring with caution cones, and schedule plumbing technician inspection."
        else:
            priority = "Medium"
            explanation = (
                "[Fallback Classifier] Plumbing fixture malfunction reported. Causes continuous water waste "
                "and campus facility degradation if unaddressed."
            )
            action = "Inspect the tap/valve seals, replace faulty washers or fittings, and confirm drainage flow."

    elif any(k in combined_text for k in electrical_keywords):
        category = "Electrical"
        department = "Electrical Maintenance Team"
        emergency_words = ["spark", "smoke", "burning", "bare wire", "shock", "fire"]
        if any(w in combined_text for w in emergency_words):
            priority = "High"
            explanation = (
                "[Fallback Classifier] Severe electrical hazard detected. Risk of electrical shock, "
                "circuit blowout, or fire hazard requiring urgent isolation."
            )
            action = "Trip corresponding distribution MCB breaker immediately, place danger warning tape, and dispatch certified electrician."
        else:
            priority = "Medium"
            explanation = (
                "[Fallback Classifier] Electrical fixture outage affecting campus usability and lighting levels."
            )
            action = "Check fixture ballasts, replace burnt-out lamps, and verify voltage supply at the distribution board."

    elif any(k in combined_text for k in cleanliness_keywords):
        category = "Cleanliness"
        department = "Housekeeping & Sanitation Services"
        if any(w in combined_text for w in ["overflow", "pest", "rodent", "rotting", "stink"]):
            priority = "Medium"
            explanation = (
                "[Fallback Classifier] Unsanitary conditions reported in active campus area. "
                "Presents hygiene risks and aesthetic disturbance."
            )
            action = "Empty waste containers, sanitize surrounding area with hospital-grade disinfectant, and deploy odor-neutralizing treatment."
        else:
            priority = "Low"
            explanation = (
                "[Fallback Classifier] Routine cleaning requirement identified in campus premises."
            )
            action = "Schedule janitorial round for sweep, mop, and waste clearance during regular service hours."

    elif any(k in combined_text for k in infrastructure_keywords):
        category = "Infrastructure"
        department = "Campus Civil Infrastructure & Maintenance"
        danger_words = ["stairs", "staircase", "broken glass", "collapsed", "hole", "pothole"]
        if any(w in combined_text for w in danger_words):
            priority = "High"
            explanation = (
                "[Fallback Classifier] Physical infrastructure damage presenting physical injury risk to students and faculty."
            )
            action = "Place protective barriers around damaged section and schedule emergency carpentry/masonry repair."
        else:
            priority = "Medium"
            explanation = (
                "[Fallback Classifier] Damaged fixture or physical infrastructure impacting normal academic operations."
            )
            action = "Log work order for structural repair, assess repair parts needed, and schedule restoration."

    elif any(k in combined_text for k in sustainability_keywords):
        category = "Sustainability"
        department = "Campus Sustainability Office"
        priority = "Low"
        explanation = (
            "[Fallback Classifier] Sustainability or resource conservation opportunity observed."
        )
        action = "Assess conservation impact, adjust timers or signage, and log for the campus sustainability review."

    else:
        category = "Other"
        department = "Campus Facilities General Helpdesk"
        priority = "Medium" if "urgent" in combined_text else "Low"
        explanation = (
            "[Fallback Classifier] General campus issue report categorized under facilities overview."
        )
        action = "Conduct initial on-site review to identify appropriate maintenance trade and log task."

    return GeminiClassification(
        category=category,
        priority=priority,
        department=department,
        explanation=explanation,
        recommended_action=action,
        source="fallback",
    )


# ─────────────────────────────────────────────────────────────────────────────
# TIER 1: GOOGLE GEMINI (Sequential Free Models Cycle)
# ─────────────────────────────────────────────────────────────────────────────
def classify_with_gemini(
    title: str,
    description: str,
    location: str,
    user_category: Optional[str] = None,
) -> GeminiClassification:
    """
    Calls Google Gemini using the official google-genai SDK.
    Tries the primary free model, and automatically cycles through other free models
    if rate limit (429), quota exhaustion, or model availability errors occur.
    """
    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    client = genai.Client(api_key=api_key)
    prompt = _build_triage_prompt(title, description, location, user_category)

    last_error = None
    for model_name in CANDIDATE_GEMINI_MODELS:
        try:
            logger.info("Attempting Gemini model triage: %s", model_name)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION_TRIAGE,
                    response_mime_type="application/json",
                    response_schema=GeminiClassification,
                    temperature=0.2,
                ),
            )

            if not response or not response.text:
                raise ValueError("Gemini returned an empty response.")

            parsed = GeminiClassification.model_validate_json(response.text)
            return GeminiClassification(
                category=parsed.category,
                priority=parsed.priority,
                department=parsed.department,
                explanation=parsed.explanation,
                recommended_action=parsed.recommended_action,
                source="gemini",
            )
        except Exception as exc:
            logger.warning(
                "Gemini model '%s' limit/error (%s: %s). Checking next free model...",
                model_name,
                type(exc).__name__,
                exc,
            )
            last_error = exc
            # If invalid API key, no point cycling models
            if "API_KEY_INVALID" in str(exc) or "PERMISSION_DENIED" in str(exc):
                raise exc

    raise last_error or RuntimeError("All candidate free Gemini models failed.")


# ─────────────────────────────────────────────────────────────────────────────
# TIER 2: xAI GROK (First Provider Fallback)
# ─────────────────────────────────────────────────────────────────────────────
def classify_with_grok(
    title: str,
    description: str,
    location: str,
    user_category: Optional[str] = None,
) -> GeminiClassification:
    """Calls xAI Grok using OpenAI-compatible REST API."""
    api_key = os.getenv("XAI_API_KEY", "").strip()
    model = os.getenv("XAI_MODEL", DEFAULT_GROK_MODEL).strip() or DEFAULT_GROK_MODEL

    prompt = _build_triage_prompt(title, description, location, user_category)
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    SYSTEM_INSTRUCTION_TRIAGE
                    + "\nYou MUST respond with ONLY a valid JSON object matching the keys: "
                    + "category, priority, department, explanation, recommended_action."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }

    req = urllib.request.Request(
        "https://api.x.ai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "GreenCampus-AI/1.3.0",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        res_data = json.loads(response.read().decode("utf-8"))
        content = res_data["choices"][0]["message"]["content"]
        parsed = GeminiClassification.model_validate_json(content)
        return GeminiClassification(
            category=parsed.category,
            priority=parsed.priority,
            department=parsed.department,
            explanation=f"[xAI Grok] {parsed.explanation}",
            recommended_action=parsed.recommended_action,
            source="grok",
        )


# ─────────────────────────────────────────────────────────────────────────────
# TIER 3: OPENAI (Second Provider Fallback)
# ─────────────────────────────────────────────────────────────────────────────
def classify_with_openai(
    title: str,
    description: str,
    location: str,
    user_category: Optional[str] = None,
) -> GeminiClassification:
    """Calls OpenAI using chat completions REST API."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL).strip() or DEFAULT_OPENAI_MODEL

    prompt = _build_triage_prompt(title, description, location, user_category)
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    SYSTEM_INSTRUCTION_TRIAGE
                    + "\nYou MUST respond with ONLY a valid JSON object matching the keys: "
                    + "category, priority, department, explanation, recommended_action."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "GreenCampus-AI/1.3.0",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        res_data = json.loads(response.read().decode("utf-8"))
        content = res_data["choices"][0]["message"]["content"]
        parsed = GeminiClassification.model_validate_json(content)
        return GeminiClassification(
            category=parsed.category,
            priority=parsed.priority,
            department=parsed.department,
            explanation=f"[OpenAI {model}] {parsed.explanation}",
            recommended_action=parsed.recommended_action,
            source="openai",
        )


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PUBLIC FUNCTION: TICKET CLASSIFICATION
# ─────────────────────────────────────────────────────────────────────────────
def classify_ticket(
    title: str,
    description: str,
    location: str,
    user_category: Optional[str] = None,
) -> GeminiClassification:
    """
    Multi-Tier AI Classification Pipeline:
      1. Free Google Gemini Models (Primary + Free Fallbacks)
      2. xAI Grok (first provider fallback)
      3. OpenAI (second provider fallback)
      4. Deterministic local rule-based fallback (guaranteed resilience)
    """
    fail_reasons = []

    # ── Tier 1: Free Gemini Models ──
    if is_gemini_configured():
        try:
            logger.info("Tier 1: Classifying campus issue with Google Gemini free tier...")
            result = classify_with_gemini(title, description, location, user_category)
            logger.info("Gemini classification successful: %s [%s]", result.category, result.priority)
            return result
        except Exception as exc:
            logger.warning("All Gemini candidate models hit limits or failed (%s: %s). Advancing to Tier 2 (xAI Grok)...", type(exc).__name__, exc)
            fail_reasons.append(f"Gemini: {type(exc).__name__}")
    else:
        logger.info("Gemini not configured — skipping Tier 1.")

    # ── Tier 2: xAI Grok ──
    if is_xai_configured():
        try:
            logger.info("Tier 2: Classifying campus issue with xAI Grok...")
            result = classify_with_grok(title, description, location, user_category)
            logger.info("xAI Grok classification successful: %s [%s]", result.category, result.priority)
            return result
        except Exception as exc:
            logger.warning("xAI Grok failed (%s: %s). Advancing to Tier 3 (OpenAI)...", type(exc).__name__, exc)
            fail_reasons.append(f"Grok: {type(exc).__name__}")
    else:
        logger.info("xAI Grok not configured — skipping Tier 2.")

    # ── Tier 3: OpenAI ──
    if is_openai_configured():
        try:
            logger.info("Tier 3: Classifying campus issue with OpenAI...")
            result = classify_with_openai(title, description, location, user_category)
            logger.info("OpenAI classification successful: %s [%s]", result.category, result.priority)
            return result
        except Exception as exc:
            logger.warning("OpenAI failed (%s: %s). Advancing to Tier 4 (Rule Fallback)...", type(exc).__name__, exc)
            fail_reasons.append(f"OpenAI: {type(exc).__name__}")
    else:
        logger.info("OpenAI not configured — skipping Tier 3.")

    # ── Tier 4: Guaranteed Rule-Based Fallback ──
    logger.info("Tier 4: Using deterministic local rule-based classifier.")
    fallback = fallback_classify(title, description, location, user_category)
    if fail_reasons:
        fallback.explanation = f"{fallback.explanation} (Fallback activated after: {', '.join(fail_reasons)})"
    return fallback


# =============================================================================
# CONVERSATIONAL CHATBOT (Echo — Gen Z GreenCampus AI Assistant)
# =============================================================================

def _campus_knowledge_fallback(message: str) -> ChatResponse:
    """
    Intelligent local campus knowledge responder when external APIs hit limits or are unconfigured.
    Provides complete persona clarity: who Echo is, the GreenCampus AI architecture,
    what she CAN do, what she CANNOT do, emergency instructions, and quick actions.
    """
    text = message.lower().strip()
    timestamp = datetime.now().strftime("%I:%M %p")

    # 1. Critical Campus Emergency
    critical_words = ["fire", "smoke", "sparking", "shock", "bare wire", "explosion", "collapse", "gas leak", "injury", "blood", "emergency"]
    if any(w in text for w in critical_words):
        reply = (
            "🚨 **CRITICAL CAMPUS EMERGENCY ALERT** 🚨\n\n"
            "If there is an active safety hazard, immediate personal danger, or structural failure:\n\n"
            "1. **EVACUATE IMMEDIATELY:** Move to a safe, open outdoor area (campus lawns or muster station).\n"
            "2. **DO NOT TOUCH:** Keep clear of pooling water near electrical outlets, bare wires, or debris.\n"
            "3. **CALL CAMPUS SECURITY / EMERGENCY:** Dial the Campus Control Room immediately!\n"
            "4. **SUBMIT HIGH-PRIORITY REPORT:** Click **Report Issue** above, tag it **High Priority**, and specify the exact Block and Room so facilities dispatch emergency technicians right away! 🚒⚡"
        )
        actions = ["Report Emergency Issue 🚨", "Campus Security Contacts ☎️", "View Urgent Alerts 📊"]

    # 2. Greeting / Identity / Capabilities ("Hi", "Hello", "Who are you?", "What can you do?")
    elif any(re.search(pattern, text) for pattern in [
        r"\b(hi|hello|hey|yo|sup|greetings|hola)\b",
        r"\bwho (are you|is echo)\b",
        r"\bwhat (can you do|are you|do you do|is this)\b",
        r"\bhelp\b",
    ]):
        reply = (
            "Hey there! 👋 I'm **Echo**, the central AI intelligence powering **GreenCampus AI**! 🌿✨\n\n"
            "### 🧠 What I'm Built Around\n"
            "I connect university students, faculty, and maintenance staff to keep our campus safe, sustainable, and connected. "
            "My system runs on a high-availability full-stack architecture (React on Vercel + FastAPI on Render + persistent database), "
            "backed by an auto-failing multi-tier AI engine (**Google Gemini Free Tier** $\\rightarrow$ **xAI Grok** $\\rightarrow$ **OpenAI** $\\rightarrow$ **Local Heuristic Engine**).\n\n"
            "---\n\n"
            "### 🚀 What I CAN Do For You\n"
            "• ⚡ **Instant Facility Triage:** Spot a broken AC, water leak, flickering light, or overflowing bin? Tell me and I'll analyze urgency and guide your report.\n"
            "• 📊 **Live Campus Health & Tracking:** Check real-time resolution rates and see which campus tickets are currently *Open*, *In Progress*, or *Resolved*.\n"
            "• 🤝 **Campus Connect Matchmaking:** Broadcast your availability for 15, 30, or 60 mins for STUDY, COFFEE, or CASUAL_CHAT to meet peers without awkward DMs!\n"
            "• 🌱 **Eco & Green Campus Hacks:** Learn university recycling bin locations, energy-saving habits, and eco-initiatives.\n\n"
            "---\n\n"
            "### 🛑 What I CANNOT Do\n"
            "• 🚫 I cannot physically turn off water valves or fix circuit breakers myself (our human campus maintenance crew does that!).\n"
            "• 🚫 I will never falsely claim a repair is finished or that technicians have arrived when they haven't.\n"
            "• 🚫 I do not access confidential student grades or personal financial records, and I never track live GPS.\n\n"
            "What would you like to do on campus today? Tap a quick option below or ask me anything! ✨"
        )
        actions = ["Report Campus Issue ✏️", "Find Study Buddy ☕", "Check Open Issues 📊"]

    # 3. Water & Plumbing
    elif any(w in text for w in ["leak", "water", "pipe", "tap", "flood", "drain", "sink", "toilet", "washroom"]):
        reply = (
            "💧 **Water & Plumbing Triage**\n\n"
            "Active water leaks are a primary slip hazard and cause major facility damage! "
            "Please watch your step and report the exact floor/washroom in the **Report Issue** tab. "
            "Our AI auto-flags active leaks as **High Priority** for the Plumbing Maintenance team. 🛠️"
        )
        actions = ["Report Water Leak 💧", "View Open Tickets 📊", "Campus Map 📍"]

    # 4. Electrical & HVAC
    elif any(w in text for w in ["ac", "air condition", "cooler", "light", "power", "spark", "electric", "switch", "fan", "projector"]):
        reply = (
            "⚡ **Electrical & Air Conditioning Triage**\n\n"
            "Safety protocol: never touch flickering fixtures or sparking outlets! "
            "If an AC is blowing warm air or a projector is down in a lecture hall, submit a quick ticket under **Electrical** "
            "with the room number so technicians can replace ballasts or recharge refrigerant. 💡"
        )
        actions = ["Report Electrical Fault ⚡", "Check Dashboard Status 📊"]

    # 5. Cleanliness & Sanitation
    elif any(w in text for w in ["trash", "dustbin", "clean", "dirty", "smell", "garbage", "waste", "litter", "spill"]):
        reply = (
            "🧹 **Cleanliness & Sanitation Alert**\n\n"
            "Keeping campus hygienic is top priority. Drop a quick report specifying the cafeteria area or corridor. "
            "Housekeeping services will dispatch sanitation staff for waste clearance and surface disinfection! 🌿"
        )
        actions = ["Report Cleanliness Issue 🧹", "View Cafeteria Tickets 🍽️"]

    # 6. Student Connection & Meetups
    elif any(w in text for w in ["friend", "study", "meet", "coffee", "connect", "bored", "chat", "peer", "lonely", "lunch", "walk"]):
        reply = (
            "🤝 **Looking to connect with fellow students?**\n\n"
            "Check out our **Campus Connect** tab! You can broadcast your availability for 15, 30, or 60 mins "
            "for STUDY, COFFEE, or CASUAL_CHAT, or discover who is free right now in the Library, SAC, or Cafeteria. "
            "Zero awkward DMs — just friendly, safe campus connections! ✨"
        )
        actions = ["Open Campus Connect 🤝", "Broadcast Availability ⏱️"]

    # 7. Sustainability & Green Campus
    elif any(w in text for w in ["recycle", "plastic", "green", "sustainable", "solar", "eco", "waste", "conservation"]):
        reply = (
            "🌱 **Green Campus Pro-Tips:**\n\n"
            "• **E-Waste:** Drop dead batteries and obsolete cables at the Student Activity Center tech collection box.\n"
            "• **Reusables:** Bring your own cup to the campus cafeteria to save hundreds of single-use paper cups every term.\n"
            "• **Energy:** Always toggle off lab PC monitors and lighting before leaving study pods.\n\n"
            "Every green habit keeps our university leading sustainability! 💚"
        )
        actions = ["Campus Green Map 🗺️", "Report Energy Waste 💡"]

    # 8. General Campus Query
    else:
        reply = (
            "Got it! 🌿 As your campus AI companion, I can help you triage facility issues, "
            "find study partners in **Campus Connect**, check the **Admin Dashboard**, or give eco-tips. "
            "Could you give me a bit more detail on what you need help with? ✨"
        )
        actions = ["Report Issue ✏️", "Campus Connect 🤝", "Dashboard 📊"]

    return ChatResponse(
        reply=reply,
        model_used="local-campus-engine",
        provider="fallback",
        timestamp=timestamp,
        suggested_actions=actions,
    )


def generate_chat_reply(
    message: str,
    history: Optional[list[ChatMessage]] = None,
) -> ChatResponse:
    """
    Generates a conversational response using the full 4-tier fallback:
      1. Free Google Gemini Models (cycling through primary + fallbacks)
      2. xAI Grok
      3. OpenAI
      4. Local Campus Knowledge Base
    """
    timestamp = datetime.now().strftime("%I:%M %p")

    # ── Tier 1: Free Gemini Models ──
    if is_gemini_configured():
        try:
            from google import genai
            from google.genai import types

            api_key = os.getenv("GEMINI_API_KEY", "").strip()
            client = genai.Client(api_key=api_key)

            # Build conversational prompt
            prompt_parts = []
            if history:
                for h in history[-6:]:
                    prompt_parts.append(f"{h.role.capitalize()}: {h.content}")
            prompt_parts.append(f"User: {message}")
            full_prompt = "\n".join(prompt_parts)

            for model_name in CANDIDATE_GEMINI_MODELS:
                try:
                    logger.info("Attempting Gemini chat: %s", model_name)
                    response = client.models.generate_content(
                        model=model_name,
                        contents=full_prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_INSTRUCTION_CHAT,
                            temperature=0.7,
                        ),
                    )

                    if response and response.text:
                        return ChatResponse(
                            reply=response.text.strip(),
                            model_used=model_name,
                            provider="gemini",
                            timestamp=timestamp,
                            suggested_actions=["Report Issue ✏️", "Campus Connect 🤝", "Dashboard 📊"],
                        )
                except Exception as exc:
                    logger.warning("Gemini chat model '%s' limit/error (%s). Trying next free model...", model_name, exc)
                    if "API_KEY_INVALID" in str(exc) or "PERMISSION_DENIED" in str(exc):
                        break

        except Exception as e:
            logger.warning("Gemini chat tier failed (%s). Advancing to xAI Grok...", e)

    # ── Tier 2: xAI Grok ──
    if is_xai_configured():
        try:
            logger.info("Attempting xAI Grok chat...")
            api_key = os.getenv("XAI_API_KEY", "").strip()
            model = os.getenv("XAI_MODEL", DEFAULT_GROK_MODEL).strip() or DEFAULT_GROK_MODEL

            messages = [{"role": "system", "content": SYSTEM_INSTRUCTION_CHAT}]
            if history:
                for h in history[-6:]:
                    messages.append({"role": h.role, "content": h.content})
            messages.append({"role": "user", "content": message})

            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.7,
            }

            req = urllib.request.Request(
                "https://api.x.ai/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "GreenCampus-AI/1.3.0",
                },
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as res:
                res_data = json.loads(res.read().decode("utf-8"))
                reply_text = res_data["choices"][0]["message"]["content"]
                return ChatResponse(
                    reply=reply_text.strip(),
                    model_used=f"xAI {model}",
                    provider="grok",
                    timestamp=timestamp,
                    suggested_actions=["Report Issue ✏️", "Campus Connect 🤝", "Dashboard 📊"],
                )
        except Exception as e:
            logger.warning("xAI Grok chat failed (%s). Advancing to OpenAI...", e)

    # ── Tier 3: OpenAI ──
    if is_openai_configured():
        try:
            logger.info("Attempting OpenAI chat...")
            api_key = os.getenv("OPENAI_API_KEY", "").strip()
            model = os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL).strip() or DEFAULT_OPENAI_MODEL

            messages = [{"role": "system", "content": SYSTEM_INSTRUCTION_CHAT}]
            if history:
                for h in history[-6:]:
                    messages.append({"role": h.role, "content": h.content})
            messages.append({"role": "user", "content": message})

            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.7,
            }

            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "GreenCampus-AI/1.3.0",
                },
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as res:
                res_data = json.loads(res.read().decode("utf-8"))
                reply_text = res_data["choices"][0]["message"]["content"]
                return ChatResponse(
                    reply=reply_text.strip(),
                    model_used=f"OpenAI {model}",
                    provider="openai",
                    timestamp=timestamp,
                    suggested_actions=["Report Issue ✏️", "Campus Connect 🤝", "Dashboard 📊"],
                )
        except Exception as e:
            logger.warning("OpenAI chat failed (%s). Falling back to local campus engine...", e)

    # ── Tier 4: Local Campus Knowledge Base Fallback ──
    logger.info("Using local campus knowledge base fallback for chat.")
    return _campus_knowledge_fallback(message)
