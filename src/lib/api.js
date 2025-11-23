// Use the environment variable if it exists (Production), otherwise use localhost (Development)
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function generateTimetable(payload) {
  const res = await fetch(`${API_BASE}/generate-timetable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate timetable");
  }

  return res.json();
}