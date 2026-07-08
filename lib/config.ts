import { ScheduleEvent } from "./types";

export const MENTOR_NAME = "Vicky Vaswani";

export const SCHEDULE_EVENTS: ScheduleEvent[] = [
    {
        id: "1",
        title: "Cell Biology Chapter Test",
        day: "Monday",
        time: "10:00 AM",
        type: "test",
    },
    {
        id: "2",
        title: "Genetics Study Session",
        day: "Wednesday",
        time: "02:00 PM",
        type: "class",
    },
    {
        id: "3",
        title: "Human Physiology DPP",
        day: "Friday",
        time: "11:00 AM",
        type: "assignment",
    },
    {
        id: "4",
        title: "Full Mock Test",
        day: "Sunday",
        time: "09:00 AM",
        type: "test",
    },
];

/** Days until a date string (YYYY-MM-DD) or Date. Returns 0 if past/missing. */
export function getDaysUntilDate(value: string | Date | null | undefined): number {
    if (!value) return 0;
    const target = value instanceof Date ? value : new Date(value + "T00:00:00");
    if (Number.isNaN(target.getTime())) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = target.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
