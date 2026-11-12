export function isValidPlanDay(day, durationDays) {
    const d = Number(day);
    const duration = Number(durationDays);
    if (!Number.isInteger(d) || d < 1) return false;
    if (!Number.isInteger(duration) || duration < 1) return false;
    return d <= duration;
}

export function validCompletedDays(days, durationDays) {
    return [...new Set(days || [])]
        .filter((d) => isValidPlanDay(d, durationDays))
        .sort((a, b) => a - b);
}
