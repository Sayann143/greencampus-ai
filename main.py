"""
Root ASGI entrypoint for Render.
Changes working directory to 'backend/' before importing so all bare
imports inside backend/main.py (database, models, seed, ai_service) resolve.
"""
import os
import sys
from pathlib import Path

# Resolve the backend directory
_root = Path(__file__).resolve().parent
_backend = _root / "backend"

# Change CWD to backend so that relative file paths (e.g. SQLite DB) work
os.chdir(str(_backend))

# Put backend on sys.path so bare imports work
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

# Now import app using a direct exec so Python treats it as a top-level module
# (avoids the "package import" namespace problem with `from backend.main import app`)
import importlib.util as _ilu

_spec = _ilu.spec_from_file_location("main_backend", str(_backend / "main.py"))
_mod = _ilu.module_from_spec(_spec)
sys.modules["main_backend"] = _mod
_spec.loader.exec_module(_mod)

app = _mod.app  # expose as `app` so uvicorn main:app works
