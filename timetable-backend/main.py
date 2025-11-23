# type: ignore
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from solver import generate_timetable  # <-- This is our new AI solver
from supabase import create_client, Client
from postgrest.exceptions import APIError
import google.generativeai as genai
from datetime import datetime

load_dotenv()

# --- Supabase Setup ---
SUPABASE_URL = os.getenv("SUPABASE_URL") or ""
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing Supabase credentials. Check your .env file.")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- FastAPI Setup ---
app = FastAPI(title="Timetable Generator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class SubjectAssignment(BaseModel):
    subject_id: str
    teacher_id: str

class GenerateRequest(BaseModel):
    branch: str
    semester: int
    days: List[str]
    slots: List[str]
    assignments: List[SubjectAssignment]
    save_to_db: bool = True
    generated_by: Optional[str] = None
    # Optional: pass non_bookable_slots from frontend if dynamic, else handled in solver/logic
    non_bookable_slots: Optional[List[str]] = []

# --- Helper Function ---
def get_slot_times(slot_list: List[str], current_slot: str):
    try:
        idx = slot_list.index(current_slot)
        start_time = current_slot
        if idx + 1 < len(slot_list):
            end_time = slot_list[idx+1]
        else:
            hour = int(start_time.split(':')[0])
            end_time = f"{hour+1:02d}:00"
        return start_time, end_time
    except ValueError:
        return current_slot, current_slot

@app.post("/generate-timetable")
async def generate(req: GenerateRequest):
    try:
        config = req.dict()
        
        # --- 1. Fetch ALL data needed for the AI ---
        subject_ids = [assign["subject_id"] for assign in config["assignments"]]
        teacher_ids = [assign["teacher_id"] for assign in config["assignments"]]
        class_name = f"{config['branch']} {config['semester']} Sem"

        # Fetch subjects (with new fields)
        sb_subjects = supabase.table("subjects").select("*") \
            .in_("id", subject_ids) \
            .execute()

        # Fetch rooms (with new fields)
        sb_rooms = supabase.table("rooms").select("*").execute()

        # Fetch teacher availability
        sb_availability = supabase.table("teacher_availability").select("*") \
            .in_("teacher_id", teacher_ids) \
            .execute()
            
        # --- NEW: Fetch EXISTING SCHEDULES for these teachers ---
        # We need to know if these teachers are already busy in OTHER semesters
        # (e.g., Dr. Reed is busy with 3rd Sem, so she can't teach 5th Sem at that time)
        
        sb_existing_schedule = supabase.table("timetable") \
            .select("teacher_id, day, start_time") \
            .in_("teacher_id", teacher_ids) \
            .neq("class_name", class_name) \
            .execute() 
            # .neq("class_name", class_name) ensures we don't count the 
            # OLD version of the *current* schedule (which we are about to overwrite) as a conflict.

        # Format this into a set of busy slots for the solver
        # Format: [[teacher_id, day, slot], ...]
        pre_booked_slots = []
        for entry in sb_existing_schedule.data:
            # We only care about the start time for collision detection
            slot = entry["start_time"][:5] # "09:00"
            pre_booked_slots.append([entry["teacher_id"], entry["day"], slot])
        
        config["pre_booked_slots"] = pre_booked_slots
        
        # --- 2. Build the Config for the AI ---
        # Format data for easy access by the solver
        config["subjects_data"] = {str(s["id"]): s for s in sb_subjects.data}
        config["rooms_data"] = sb_rooms.data # List of room dicts
        
        # Format availability: { teacher_id: { day: (start, end) } }
        teacher_availability = {}
        for avail in sb_availability.data:
            t_id = str(avail["teacher_id"])
            if t_id not in teacher_availability:
                teacher_availability[t_id] = {}
            teacher_availability[t_id][avail["day_of_week"]] = (
                avail["start_time"], avail["end_time"]
            )
        config["teacher_availability"] = teacher_availability

        # --- 3. Call the new AI solver ---
        print(f"Calling AI solver with {len(pre_booked_slots)} pre-booked slots...")
        # The solver will return the *best* timetable it can find
        result = generate_timetable(config) 
        
        if "error" in result:
            print(f"Solver Error: {result['error']}")
            return HTTPException(status_code=400, detail=result["error"])

        # --- 4. Save to DB (if requested) ---
        if config.get("save_to_db"):
            rows_to_insert = []
            
            # `result` is now the single best timetable
            for day, entries in result.items():
                for entry in entries:
                    if not entry["subject_id"]: # Skip blank slots
                        continue
                    
                    start_time, end_time = get_slot_times(config["slots"], entry["slot"])

                    rows_to_insert.append({
                        "day": day,
                        "start_time": start_time,
                        "end_time": end_time,
                        "subject_id": entry["subject_id"],
                        "teacher_id": entry["teacher_id"],
                        "room_id": entry["room_id"],
                        "class_name": class_name,
                        "branch": config["branch"],
                        "semester": config["semester"],
                        "updated_by": config.get("generated_by")
                    })
            
            if rows_to_insert:
                print(f"Inserting {len(rows_to_insert)} rows into Supabase...")
                supabase.table("timetable").delete() \
                    .eq("branch", config["branch"]) \
                    .eq("semester", config["semester"]) \
                    .execute()
                
                supabase.table("timetable").insert(rows_to_insert).execute()

        # Return the new timetable to the frontend
        return {"message": "Timetable generated and saved", "timetable": result}

    except APIError as e:
        print("Supabase API Error:", e)
        return HTTPException(status_code=500, detail=f"Database error: {e.message}")
    except Exception as e:
        print("General Error:", e)
        import traceback
        traceback.print_exc()
        return HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

# --- AI Chat Endpoint ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not found in .env. AI features will fail.")

class ChatRequest(BaseModel):
    teacher_id: str
    message: str

@app.post("/ai-chat")
async def ai_chat(req: ChatRequest):
    if not GEMINI_API_KEY:
        return HTTPException(status_code=500, detail="AI service not configured (Missing API Key)")

    try:
        # 1. Fetch Context (Teacher's Timetable & Requests)
        today_day = datetime.now().strftime("%A")
        
        # Get timetable for this teacher
        sb_timetable = supabase.table("timetable") \
            .select("*, subject:subjects(name), room:rooms(name)") \
            .eq("teacher_id", req.teacher_id) \
            .execute()
            
        my_schedule = sb_timetable.data
        
        # Get pending requests (incoming)
        sb_requests = supabase.table("class_requests") \
            .select("*, from_teacher:users!class_requests_from_teacher_id_fkey(name), timetable:timetable(teacher_id, day, start_time, class_name, subject:subjects(name))") \
            .eq("to_teacher_id", req.teacher_id) \
            .eq("status", "pending") \
            .execute()
            
        pending_requests = []
        for r in sb_requests.data:
            # Determine Request Type
            # If timetable.teacher_id == req.teacher_id (ME), then someone wants MY class -> CLAIM
            # If timetable.teacher_id != req.teacher_id (THEM), then they want me to take THEIR class -> SUB
            req_type = "CLAIM (They want your class)" if r["timetable"]["teacher_id"] == req.teacher_id else "SUB (They need a substitute)"
            
            pending_requests.append({
                "from": r["from_teacher"]["name"],
                "type": req_type,
                "class": r["timetable"]["class_name"],
                "subject": r["timetable"]["subject"]["name"],
                "day": r["timetable"]["day"],
                "time": r["timetable"]["start_time"]
            })

        # 2. Construct System Prompt
        context_str = f"""
        You are an intelligent assistant for a teacher in a school.
        Current Time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} ({today_day})
        
        Teacher's Schedule (All Days):
        {my_schedule}
        
        Pending Class Requests (Incoming):
        {pending_requests}
        
        Instructions:
        - Answer questions about the teacher's schedule (e.g., "What is my next class?", "Do I have class on Friday?").
        - Help with class requests (e.g., "Do I have any requests?", "Who is asking for help?").
        - If asked for a "Topic" for a class, generate a relevant, academic topic based on the subject name.
        - Be concise, helpful, and professional.
        - If the user asks to "Request a class" or "Find a sub", guide them to use the "Request a Sub" button in the UI.
        
        FORMATTING RULES:
        - **DO NOT use Markdown Tables for schedule lists.** Use simple bullet points instead.
        - Example:
          * **09:00 AM:** Mathematics (Room 101)
          * **02:00 PM:** Physics Lab (Lab 2)
        - Use **Bold** for Class Names and Times.
        - Keep the tone conversational.
        """
        # 3. Call Gemini
        # Use the model confirmed to exist in your logs
        model = genai.GenerativeModel('gemini-2.5-flash')
        chat = model.start_chat(history=[])
        response = chat.send_message(f"{context_str}\n\nUser Query: {req.message}")
        
        return {"response": response.text}

    except Exception as e:
        print("AI Error:", e)
        # Log error for debugging
        # with open("backend_error.log", "w") as f:
        #     f.write(str(e))
        return HTTPException(status_code=500, detail=f"AI Error: {str(e)}")