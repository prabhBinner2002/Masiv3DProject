# Urban Design 3D City Dashboard

A web-based dashboard that fetches Calgary city map data, visualizes buildings in 3D (Three.js), and supports natural-language queries via an LLM. Users can save and load map analyses (filters) per project.

## Tech Stack

- **Backend:** Python, Flask, SQLite (Flask-SQLAlchemy)
- **Frontend:** React, Vite, Three.js (@react-three/fiber, @react-three/drei), Tailwind CSS
- **LLM:** Hugging Face Inference API (free tier)
- **Data:** City of Calgary Open Data (Socrata)

## Prerequisites

- Python 3.10+
- Node.js 18+
- A Hugging Face account (for the LLM API key)

## Setup

### 1. Backend

```bash
cd backend
python -m venv env
# Windows:
env\Scripts\activate
# macOS/Linux:
# source env/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in `backend/` :

```env
# Calgary Open Data app token (reduces rate limits)
DATASET_API=

# Calgary Land Use District dataset for zoning (e.g. ckwt-snq8)
ZONING_DATASET=

# Downtown Calgary bbox (defaults are fine)
# DOWNTOWN_TOP=51.058
# DOWNTOWN_BOTTOM=51.038
# DOWNTOWN_LEFT=-114.12
# DOWNTOWN_RIGHT=-114.04

# Required for natural-language queries (see below)
HF_API_TOKEN=your_huggingface_token
# Optional: model (default: google/flan-t5-large)
# HUGGINGFACE_MODEL=google/flan-t5-large
```

Run the API:

```bash
python app.py
```

API runs at `http://localhost:5000`. Health check: `GET http://localhost:5000/api/health`.

### 2. Frontend

```bash
cd frontend
npm install
```

Create `.env` in `frontend/` if the API is not on localhost:5000:

```env
VITE_API_URL=http://localhost:5000/api
```

Run the app:

```bash
npm run dev
```

Open the URL shown (e.g. `http://localhost:5173`).

### 3. Getting an LLM API Key (Hugging Face)

Natural-language map queries (e.g. “buildings over 100 feet”, “show commercial buildings”) use the **Hugging Face Inference API**. You need a free API token.

1. Go to [huggingface.co](https://huggingface.co) and sign up or log in.
2. Click your profile (top right) → **Settings**.
3. Open **Access Tokens** in the left sidebar.
4. Click **New token**, name it (e.g. “Masiv 3D”), choose **Read** (or default), and create.
5. Copy the token and set it in `backend/.env`:
   ```env
   HF_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. Restart the backend.

Without `HF_API_TOKEN`, the app still runs but query endpoints will return an error; the UI will show a “token not configured” style message. You can still load buildings, filter via the API, and use save/load projects.

## Project Structure

```
MasivProject3D/
├── backend/
│   ├── app.py              # Flask app factory
│   ├── config.py           # Config from env
│   ├── requirements.txt
│   ├── routes/api.py       # REST API (buildings, filter, query, users, projects)
│   ├── services/
│   │   ├── cityData.py     # Calgary Open Data fetch + normalize + zoning
│   │   ├── filters.py      # Apply attribute filters to buildings
│   │   └── llm.py          # Hugging Face LLM → filter parsing
│   └── models/             # User, Project (SQLite)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── lib/api.js      # API client
│   │   └── components/     # Navbar, MapCanvas, BuildingDetailCard
│   └── package.json
├── README.md
└── UML_DIAGRAM.md          
```

See [docs/README.md](./docs/README.md) for step-by-step export instructions.

