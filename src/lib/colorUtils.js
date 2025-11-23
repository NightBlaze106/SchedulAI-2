// Deterministic color generation for subjects
// Ensures the same subject always gets the same color

const PRESET_COLORS = [
    { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
    { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-700", badge: "bg-blue-100 text-blue-800" },
    { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-700", badge: "bg-violet-100 text-violet-800" },
    { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
    { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-700", badge: "bg-rose-100 text-rose-800" },
    { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-700", badge: "bg-cyan-100 text-cyan-800" },
    { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-700", badge: "bg-indigo-100 text-indigo-800" },
    { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", text: "text-fuchsia-700", badge: "bg-fuchsia-100 text-fuchsia-800" },
    { bg: "bg-teal-500/10", border: "border-teal-500/20", text: "text-teal-700", badge: "bg-teal-100 text-teal-800" },
    { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-700", badge: "bg-orange-100 text-orange-800" },
];

// Simple hash function to map a string to an index
const hashCode = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

export const getSubjectColor = (subjectName) => {
    if (!subjectName) return PRESET_COLORS[0];
    const index = hashCode(subjectName) % PRESET_COLORS.length;
    return PRESET_COLORS[index];
};
