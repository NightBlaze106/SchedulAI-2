# type: ignore
import random

# --- AI TUNING ---
SCORE_HARD_CONSTRAINT_VIOLATION = -10000 # Make failure impossible to ignore
SCORE_TEACHER_CONSECUTIVE_MAX = -15      # Teachers hate 4 hours in a row
SCORE_STUDENT_CONSECUTIVE_MAX = -10      # Students get tired
SCORE_STUDENT_GAP = -50                  # GAPS ARE VERY BAD now (-50 vs -10)
SCORE_AFTERNOON_CLASS = 10               # Afternoon is nice, but not worth a 5-hour gap
SCORE_SUBJECT_PER_DAY_MAX = -100         # NEVER schedule 3 of the same class (huge penalty)
# --- Solver Configuration ---
GENERATION_ATTEMPTS = 1000
TEACHER_MAX_CONSECUTIVE = 3
STUDENT_MAX_CONSECUTIVE = 4
STUDENT_MAX_SUBJECTS_PER_DAY = 2 

class TimetableSolver:
    def __init__(self, config):
        self.days = config["days"]
        self.slots = config["slots"]
        self.slot_map = {slot: i for i, slot in enumerate(self.slots)}
        
        self.non_bookable_slots = set(config.get("non_bookable_slots", []))
        
        self.subjects_data = config["subjects_data"]
        self.rooms_data = config["rooms_data"]
        self.assignments = config["assignments"]
        self.teacher_availability = config["teacher_availability"]
        
        # --- NEW: Load Pre-booked slots ---
        # Convert list of lists back to set of tuples for fast lookup
        # Input: [[teacher_id, day, slot], ...]
        self.pre_booked_slots = set()
        if "pre_booked_slots" in config:
            for item in config["pre_booked_slots"]:
                self.pre_booked_slots.add(tuple(item))
        
        self.required_classes = self._create_class_list()
        
        self.best_timetable = None
        self.best_score = -float('inf')

    def _create_class_list(self):
        required = []
        for assign in self.assignments:
            subject_id = assign["subject_id"]
            if subject_id not in self.subjects_data:
                continue
            
            subject = self.subjects_data[subject_id]
            block_size = subject.get("block_size", 1)
            hours_per_week = subject.get("hours_per_week", 1)
            
            num_blocks = hours_per_week // block_size
            
            for _ in range(num_blocks):
                required.append({
                    "subject_id": subject["id"],
                    "teacher_id": assign["teacher_id"],
                    "block_size": block_size,
                    "student_count": subject.get("student_count", 50),
                    "subject_type": subject.get("type", "Theory"),
                })
        return required

    def solve(self):
        print(f"AI Solver starting... Generating {GENERATION_ATTEMPTS} chaotic candidates.")
        
        if not self.required_classes:
             return {"error": "No valid subjects or assignments were provided."}
        
        for i in range(GENERATION_ATTEMPTS):
            # 1. Generate one possible timetable
            timetable, schedules = self._generate_candidate()
            
            # 2. Score this timetable
            score, hard_violations = self._score_timetable(timetable, schedules)
            
            # 3. Select
            if hard_violations == 0:
                if score > self.best_score:
                    self.best_score = score
                    self.best_timetable = timetable
        
        if self.best_timetable:
            print(f"AI Solver finished. Best score: {self.best_score}")
            return self._fill_blanks(self.best_timetable)
        else:
            return {"error": "Failed to generate a valid timetable. Check for impossible constraints (e.g., not enough rooms, or not enough teacher time for all subjects)."}

    # --- THIS IS THE "CHAOTIC" GENERATOR ---
    def _generate_candidate(self):
        """
        Generates one "chaotic" candidate by randomly scattering classes
        into valid (hard-constraint-passing) slots.
        """
        timetable = {day: {} for day in self.days} # { day: { slot: entry } }
        
        # --- NEW: Initialize teacher_schedule with PRE-BOOKED slots ---
        teacher_schedule = {} 
        for (t_id, day, slot) in self.pre_booked_slots:
            teacher_schedule[(t_id, day, slot)] = True
        # -------------------------------------------------------------
        
        room_schedule = {}    # (room_id, day, slot) -> True
        class_schedule = {}   # (day, slot) -> True

        classes_to_assign = list(self.required_classes)
        random.shuffle(classes_to_assign)
        
        # Get all possible start slots and shuffle them
        all_slots = [(day, slot) for day in self.days for slot in self.slots]
        random.shuffle(all_slots) 
        
        for class_info in classes_to_assign:
            # Try to place this class in a random valid slot
            for day, start_slot in all_slots:
                
                if self._can_place_class(class_info, day, start_slot, teacher_schedule, room_schedule, class_schedule):
                    # Place it!
                    self._place_class(class_info, day, start_slot, timetable, teacher_schedule, room_schedule, class_schedule)
                    break # Class placed, move to next class
            
            # If we went through all slots and failed to place it,
            # the scorer will catch it as an "unassigned class".
        
        return timetable, (teacher_schedule, room_schedule, class_schedule)
    
    def _can_place_class(self, class_info, day, start_slot, teacher_schedule, room_schedule, class_schedule):
        block_size = class_info["block_size"]
        start_slot_index = self.slot_map.get(start_slot)
        
        if start_slot_index is None:
            return False

        # Check if there's enough time in the day for this block
        if start_slot_index + block_size > len(self.slots):
            return False 

        teacher_id = class_info["teacher_id"]
        
        # Find a suitable room
        available_room = self._find_available_room(class_info, day, start_slot, room_schedule)
        if not available_room:
            return False

        # Check all slots in the block
        for i in range(block_size):
            slot_index = start_slot_index + i
            slot = self.slots[slot_index]
            
            if slot in self.non_bookable_slots:
                return False
            
            if not self._is_teacher_available(teacher_id, day, slot):
                return False

            if (teacher_id, day, slot) in teacher_schedule:
                return False

            if (day, slot) in class_schedule:
                return False
        
        return True

    def _place_class(self, class_info, day, start_slot, timetable, teacher_schedule, room_schedule, class_schedule):
        room_id = self._find_available_room(class_info, day, start_slot, room_schedule)
        if not room_id:
            return 

        block_size = class_info["block_size"]
        start_slot_index = self.slot_map[start_slot]
        teacher_id = class_info["teacher_id"]

        for i in range(block_size):
            slot_index = start_slot_index + i
            slot = self.slots[slot_index]
            
            entry = {
                "slot": slot,
                "subject_id": class_info["subject_id"],
                "teacher_id": teacher_id,
                "room_id": room_id
            }
            
            timetable[day][slot] = entry
            teacher_schedule[(teacher_id, day, slot)] = True
            room_schedule[(room_id, day, slot)] = True
            class_schedule[(day, slot)] = True

    def _is_teacher_available(self, teacher_id, day, slot):
        teacher_id_str = str(teacher_id)
        if teacher_id_str not in self.teacher_availability:
            return True 
        
        if day not in self.teacher_availability[teacher_id_str]:
            return False 
        
        return True

    def _find_available_room(self, class_info, day, start_slot, room_schedule):
        block_size = class_info["block_size"]
        start_slot_index = self.slot_map[start_slot]
        
        shuffled_rooms = list(self.rooms_data)
        random.shuffle(shuffled_rooms)
        
        for room in shuffled_rooms:
            is_lab_match = (class_info["subject_type"] == "Lab" and room["type"] == "Lab")
            is_theory_match = (class_info["subject_type"] != "Lab" and room["type"] != "Lab")
            if not (is_lab_match or is_theory_match):
                continue

            if room["capacity"] < class_info["student_count"]:
                continue

            is_free = True
            for i in range(block_size):
                slot_index = start_slot_index + i
                if slot_index >= len(self.slots):
                    is_free = False
                    break
                slot = self.slots[slot_index]
                if (room["id"], day, slot) in room_schedule:
                    is_free = False
                    break 
            
            if is_free:
                return room["id"] 
        
        return None

    def _score_timetable(self, timetable, schedules):
        (_, _, class_schedule) = schedules
        
        score = 0
        hard_violations = 0
        
        for day in self.days:
            
            # --- Score: Student Gaps ---
            last_class_slot_index = -1 
            gaps = 0
            
            for i, slot in enumerate(self.slots):
                if slot in self.non_bookable_slots: 
                    if last_class_slot_index != -1: 
                        last_class_slot_index = i
                    continue
                
                if slot in timetable[day]:
                    if last_class_slot_index == -1 and i > 0:
                        gaps += i
                    elif i > last_class_slot_index + 1:
                        gaps += (i - last_class_slot_index - 1)
                    
                    last_class_slot_index = i
            
            score += gaps * SCORE_STUDENT_GAP
            
            # --- Score: Consecutive Classes & Daily Subject Limit ---
            teacher_consecutive = {}
            student_consecutive = 0
            
            # --- NEW: Subject-per-day counter ---
            subject_daily_count = {}
            
            for slot in self.slots:
                if slot in self.non_bookable_slots: 
                    student_consecutive = 0
                    teacher_consecutive = {}
                    continue

                if slot in timetable[day]:
                    entry = timetable[day][slot]
                    teacher_id = entry["teacher_id"]
                    subject_id = entry["subject_id"] # <-- Get the subject
                    
                    # Student Consecutive
                    student_consecutive += 1
                    if student_consecutive > STUDENT_MAX_CONSECUTIVE:
                        score += SCORE_STUDENT_CONSECUTIVE_MAX
                    
                    # Teacher Consecutive
                    teacher_consecutive[teacher_id] = teacher_consecutive.get(teacher_id, 0) + 1
                    if teacher_consecutive[teacher_id] > TEACHER_MAX_CONSECUTIVE:
                        score += SCORE_TEACHER_CONSECUTIVE_MAX
                    
                    # Afternoon Bonus
                    if self.slot_map[slot] > 4: # i.e., 14:00 and 15:00
                        score += SCORE_AFTERNOON_CLASS
                    
                    # --- NEW: Increment and score subject-per-day ---
                    subject_daily_count[subject_id] = subject_daily_count.get(subject_id, 0) + 1
                    if subject_daily_count[subject_id] > STUDENT_MAX_SUBJECTS_PER_DAY:
                        score += SCORE_SUBJECT_PER_DAY_MAX
                
                else: # A gap resets all counters
                    student_consecutive = 0
                    teacher_consecutive = {} 
        
        # --- Score: Unassigned Classes ---
        total_slots_filled = len(class_schedule)
        total_blocks_required = sum(c["block_size"] for c in self.required_classes)
        
        if total_slots_filled < total_blocks_required:
            unassigned_slots = total_blocks_required - total_slots_filled
            score += unassigned_slots * SCORE_HARD_CONSTRAINT_VIOLATION
            hard_violations += unassigned_slots

        return score, hard_violations

    def _fill_blanks(self, timetable_map):
        final_timetable = {day: [] for day in self.days}
        for day in self.days:
            for slot in self.slots:
                if slot in timetable_map[day]:
                    final_timetable[day].append(timetable_map[day][slot])
                else:
                    final_timetable[day].append({
                        "slot": slot,
                        "subject_id": None,
                        "teacher_id": None,
                        "room_id": None
                    })
        return final_timetable

# --- Main Entry Point ---
def generate_timetable(config):
    """
    Main entry point for the AI solver.
    """
    solver = TimetableSolver(config)
    best_timetable = solver.solve()
    return best_timetable