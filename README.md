# SchedulAI 🚀

**An Intelligent Timetable Scheduling System with AI-Powered Optimization**

SchedulAI is a full-stack, AI-driven timetable management platform designed to automatically generate optimized academic schedules for educational institutions. It handles complex constraints such as teacher availability, room capacity, subject requirements, and institutional policies—delivering conflict-free, high-quality timetables in minutes instead of days.

This project is built with performance, scalability, and real-time collaboration in mind.

---

## ✨ Key Features

- ⚡ **AI-Based Timetable Generation** – Generates thousands of candidate schedules and selects the best one using hard and soft constraints.
- ✅ **Conflict-Free Scheduling** – Prevents double booking, room clashes, and teacher overlaps.
- 🧠 **Soft Constraint Optimization** – Minimizes student gaps and balances teacher workload.
- 👨‍🏫 **Role-Based Dashboards** – Separate views for Admins, Teachers, and Students.
- 🛠️ **Live Manual Editor** – Drag-and-drop manual overrides with conflict prevention.
- 🔄 **Real-Time Updates** – Powered by Supabase Realtime.
- 🤖 **AI Chat Assistant for Teachers** – Integrated with Google Gemini.
- 📄 **PDF Export of Timetables** – One-click professional timetable export.

---

## 🏗️ System Architecture

```
Frontend (React + Vite + Tailwind)
        |
        |  REST + Realtime
        v
Backend (FastAPI + AI Solver)
        |
        v
Database (Supabase / PostgreSQL)
```

- **Frontend** handles UI, dashboards, and Live Editor
- **Backend** handles AI optimization, constraint checking, APIs
- **Database** stores users, teachers, rooms, subjects, and timetables
- **Realtime Layer** handles live updates across users

---

## 🧑‍💻 Tech Stack

### Frontend
- React 19
- Vite
- TailwindCSS
- Radix UI

### Backend
- FastAPI (Python)
- Uvicorn (ASGI Server)

### Database & Realtime
- Supabase (PostgreSQL + Realtime)

### AI Integration
- Google Gemini API (Teacher Assistant)

### Dev & Ops
- Git & GitHub
- Docker (optional)
- Vercel (Frontend Hosting)
- Render / Fly / VPS (Backend Hosting)

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/schedulai.git
cd schedulai
```

---

### 2️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will run at:
```
http://localhost:5173
```

---

### 3️⃣ Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend will run at:
```
http://localhost:8000
```

---

### 4️⃣ Environment Variables

Create a `.env` file inside the backend folder:

```env
DATABASE_URL=postgres://username:password@host:port/dbname
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-public-or-service-role-key
GOOGLE_GEMINI_API_KEY=your_api_key_here
SECRET_KEY=your_secret_key
NODE_ENV=development
```

---

## 🧠 AI Timetable Optimization Logic

SchedulAI uses a **Generate-and-Test Stochastic Search Algorithm**:

1. Random candidate timetables are generated.
2. Each candidate is checked against **hard constraints**.
3. A scoring function evaluates **soft constraints**.
4. The highest-scoring valid timetable is selected.

### Example Core Loop

```python
def generate_timetable(config, iterations=1000):
    best = None
    best_score = -10**9

    for _ in range(iterations):
        candidate = _generate_candidate(config)
        hard_violations = _count_hard_violations(candidate)
        score = _score_timetable(candidate)

        if hard_violations == 0 and score > best_score:
            best = candidate
            best_score = score

    if best is None:
        raise RuntimeError('No valid timetable found.')

    return best
```

---

## 🗄️ Database Schema (Summary)

| Table | Description |
|-------|-------------|
| users | Admins, teachers, students |
| subjects | Subjects offered per branch & semester |
| rooms | Classrooms & labs |
| timetable | Final generated schedules |
| teacher_availability | Weekly teacher availability slots |
| class_requests | Teacher swap and edit requests |

---

## 🧪 Testing Strategy

- ✅ **Unit Tests** – Solver and constraint validation
- 🔗 **Integration Tests** – API endpoints via Postman / Pytest
- 🌐 **End-to-End Tests** – Full timetable generation flow
- 📈 **Load Tests** – Large dataset performance evaluation

---

## 🖼️ Screenshots

> Add these inside `/figs/` folder in your repo:

- `admin_wizard.png` – Admin timetable generator
- `generated_timetable.png` – Final timetable grid
- `teacher_dashboard.png` – Teacher dashboard with AI chat
- `live_editor.png` – Manual drag-and-drop editor

---

## 🚀 Deployment Guide

### Frontend

```bash
npm run build
```
Deploy `/dist` to **Vercel**.

### Backend

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```
Deploy on **Render, Fly.io, or VPS**.

### Database
- Create project on **Supabase**
- Apply schema
- Enable Realtime

---

## 📌 Roadmap & Future Scope

- ✅ Weighted soft-constraint tuning UI
- ✅ Genetic Algorithm-based optimization engine
- ✅ Versioned timetable history
- ✅ Mobile app (Android & iOS)
- ✅ Advanced analytics dashboard

---

## 👥 Team

- **Project Name:** SchedulAI
- **Domain:** Artificial Intelligence + Web Systems
- **Developed By:** Team SchedulAI
- **Department:** Computer Science & Engineering

---

## 📜 License

This project is released under the **MIT License**. You are free to use, modify, and distribute it with attribution.

---

## ⭐ Support

If you like this project:

- ⭐ Star the repository
- 🍴 Fork and extend it
- 🐛 Open issues for bugs
- 💡 Share feature ideas

---

### ✅ Ready for GitHub Showcase

This README is structured for:
- Final-year project review
- Portfolio presentation
- Open-source hosting
- Internship & placement evaluation
