import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Crons are declared in code and deployed with it. The dashboard shows them and
// their run history. Both call internal mutations that the client cannot reach.
const crons = cronJobs();

// Everyone gets their five fires back at midnight UTC.
crons.daily("reset fires", { hourUTC: 0, minuteUTC: 0 }, internal.users.resetFires, {});

// Once an hour, schedule the random ping for everyone whose window opens now.
crons.hourly("schedule pings", { minuteUTC: 0 }, internal.pings.scheduleWindow, {});

export default crons;
