# Unmask-Terms Backend

FastAPI backend for the Unmask-Terms legal document risk analyzer.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --port 8001
```
