import type { SpeakingTaskSpec, SpeakingTaskType } from "./types";

export type { SpeakingTaskSpec, SpeakingTaskType };

export interface SpeakingSeed {
  type: SpeakingTaskType;
  key: string;
  passage?: string;
  question?: string;
  info?: string;
  sceneId?: string;
}

export const SPEAKING_TASKS: SpeakingTaskSpec[] = [
  {
    type: "read-aloud",
    label: "Read a text aloud",
    prepSeconds: 45,
    speakSeconds: 45,
    maxRaw: 3,
  },
  {
    type: "describe-picture",
    label: "Describe a picture",
    prepSeconds: 45,
    speakSeconds: 30,
    maxRaw: 3,
  },
  {
    type: "respond-question",
    label: "Respond to questions",
    prepSeconds: 3,
    speakSeconds: 15,
    maxRaw: 3,
  },
  {
    type: "respond-with-info",
    label: "Respond using information",
    prepSeconds: 3,
    speakSeconds: 30,
    infoSeconds: 45,
    maxRaw: 3,
  },
  {
    type: "express-opinion",
    label: "Express an opinion",
    prepSeconds: 45,
    speakSeconds: 60,
    maxRaw: 5,
  },
];

export function pickSpeakingSpec(type: SpeakingTaskType): SpeakingTaskSpec {
  const spec = SPEAKING_TASKS.find((task) => task.type === type);
  if (!spec) {
    throw new Error(`Unknown speaking task type: ${type}`);
  }
  return spec;
}

export const SPEAKING_SEEDS: SpeakingSeed[] = [
  {
    type: "read-aloud",
    key: "cafeteria-hours",
    passage:
      "Good morning. The staff cafeteria on the second floor will open at seven thirty and close at two o'clock on weekdays. Please keep your ID badge visible when you enter. Hot meals are served until one, and coffee remains available until closing. Thank you for leaving trays on the return cart.",
  },
  {
    type: "read-aloud",
    key: "visitor-parking",
    passage:
      "Please note that the visitor parking lot beside Building B will be closed this Friday for line painting. Employees should use the garage on Maple Street and bring their parking pass. Overnight parking is not allowed. If you expect a client, ask reception to reserve a space at least one day in advance. Thank you.",
  },
  {
    type: "read-aloud",
    key: "all-staff-meeting",
    passage:
      "This is a reminder that the monthly all-staff meeting will begin at ten o'clock in Conference Room A. Please arrive five minutes early and silence your phones. The agenda covers the sales report, the new travel policy, and questions from the floor. Printed copies will be on the table. Thank you for your attention.",
  },
  {
    type: "describe-picture",
    key: "scene-office-desk",
    sceneId: "office-desk",
  },
  {
    type: "describe-picture",
    key: "scene-night-office",
    sceneId: "night-office",
  },
  {
    type: "describe-picture",
    key: "scene-meeting-table",
    sceneId: "meeting-table",
  },
  {
    type: "respond-question",
    key: "start-work-time",
    question: "What time do you usually start work, and why?",
  },
  {
    type: "respond-question",
    key: "commute-to-office",
    question: "How do you usually get to the office?",
  },
  {
    type: "respond-question",
    key: "like-about-job",
    question: "What do you like most about your current job?",
  },
  {
    type: "respond-with-info",
    key: "conference-keynote",
    info:
      "City Business Forum — Friday schedule:\n" +
      "8:30 Registration, lobby\n" +
      "9:15 Keynote: Ms. Elena Park, Hall A\n" +
      "11:00 Breakout sessions, Rooms 2–4\n" +
      "12:30 Lunch, cafeteria",
    question: "What time does the keynote speech begin, and where is it held?",
  },
  {
    type: "respond-with-info",
    key: "cafeteria-lunch",
    info:
      "Staff cafeteria hours this week:\n" +
      "Breakfast 7:00–9:00\n" +
      "Lunch 11:30–14:00\n" +
      "Today's special: grilled fish with rice\n" +
      "Closed on Saturday and Sunday",
    question: "Until what time is lunch served, and what is today's special?",
  },
  {
    type: "respond-with-info",
    key: "hotel-shuttle",
    info:
      "Airport shuttle notice:\n" +
      "Buses leave the hotel every 30 minutes from 6:00 to 22:00.\n" +
      "Stops: Downtown Station, Riverside Office Park, Terminal 2.\n" +
      "Travel time to the airport is about 40 minutes.\n" +
      "Show your booking confirmation to the driver.",
    question: "How often do the shuttle buses leave, and which stop serves the office park?",
  },
  {
    type: "express-opinion",
    key: "wfh-two-days",
    question:
      "Do you think companies should allow employees to work from home two days a week? Give reasons for your opinion.",
  },
  {
    type: "express-opinion",
    key: "long-lunch-break",
    question:
      "Is it better for offices to have a long lunch break or a short one? Explain your view.",
  },
  {
    type: "express-opinion",
    key: "video-vs-inperson",
    question:
      "Should companies replace most in-person meetings with video calls? Why or why not?",
  },
];
