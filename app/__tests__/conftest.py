"""Shared pytest configuration for the app test suite.

The app's own modules use bare imports (``from models.domain import ...``,
``from services import transactionService``) that only resolve when the
``app/`` directory itself is on ``sys.path`` -- i.e. when running
``uvicorn main:app`` from inside ``app/``. Tests live one level deeper
(``app/__tests__/``), so we add ``app/`` to ``sys.path`` here before any
test module tries those same imports.
"""

import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))
