import { ScheduleEvent } from "./types";

export const NEET_2026_DATE = new Date("2026-05-03");

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

export function getDaysUntilNEET(): number {
    const today = new Date();
    const diff = NEET_2026_DATE.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
