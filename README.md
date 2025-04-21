# Chatbot App

A full-stack AI-powered chatbot application with PDF document Q&A, web search, authentication, and a modern React UI.

## Features (Not all is finished yet)

- User authentication (login/register/logout)
- Persistent chat history (multi-chat)
- Real-time AI chat with streaming responses
- PDF document upload and question answering
- Web search integration for up-to-date answers
- Responsive sidebar and mobile-friendly layout
- Dark/light theme support
- Toast notifications for feedback
- Dockerized backend (FastAPI) and frontend (React + Vite)

## Project Structure

```
Basic Chatbot 2/
├── backend/        # FastAPI backend
├── frontend/       # React + Vite frontend
├── docker-compose.yml
├── LICENSE
└── README.md
```

## Local Development

### Prerequisites
- Docker & Docker Compose **OR**
- Node.js (v18+) and Python 3.10+

### 1. Clone the repository
```bash
git clone <repo-url>
cd Basic\ Chatbot\ 2
```

### 2. Configure Environment Variables

#### Backend (`backend/.env`):
```
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///./chatbot.db
GROQ_API_KEY = your-groq-api-key
TAVILY_API_KEY = your-tavily-api-key
```

#### Frontend (`frontend/.env`):
```
VITE_API_URL=http://localhost:8000
```

### 3. Run with Docker Compose
```bash
docker-compose up --build
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

### 4. Manual Local Run (without Docker)
- Backend:
  ```bash
  cd backend
  python -m venv venv && source venv/bin/activate  # or .venv/Scripts/activate on Windows
  pip install -r requirements.txt
  uvicorn main:app --reload
  ```
- Frontend:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).


