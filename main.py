"""
Root ASGI entrypoint for Render and cloud hostings.
Directs requests straight to backend.main:app.
"""
import sys
from pathlib import Path

# Add backend directory to path so internal imports in backend work seamlessly
backend_path = Path(__file__).resolve().parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from backend.main import app  # noqa: E402
