import type { Level } from "./types";

/** IELTS Speaking Part 2 cue card — topic + three prompts. */
export interface SpeakingCueCard {
  level: Level;
  topic: string;
  bullets: [string, string, string];
}

export const SPEAKING_CATALOG: SpeakingCueCard[] = [
  // A2 — familiar everyday topics, simple language
  {
    level: "A2",
    topic: "Describe a place you like to visit",
    bullets: [
      "where it is",
      "how often you go there",
      "what you do there and why you like it",
    ],
  },
  {
    level: "A2",
    topic: "Describe a meal you enjoy",
    bullets: [
      "what the meal is",
      "when you usually eat it",
      "who you eat it with and why you like it",
    ],
  },
  {
    level: "A2",
    topic: "Describe a friend you like",
    bullets: [
      "who this person is",
      "how you met",
      "what you do together and why you like them",
    ],
  },
  {
    level: "A2",
    topic: "Describe a hobby you have",
    bullets: [
      "what the hobby is",
      "when you started it",
      "how often you do it and why you enjoy it",
    ],
  },

  // B1 — personal experience with a little more detail
  {
    level: "B1",
    topic: "Describe a trip you took",
    bullets: [
      "where you went",
      "who you went with",
      "what you did and how you felt about the trip",
    ],
  },
  {
    level: "B1",
    topic: "Describe a skill you learned",
    bullets: [
      "what the skill is",
      "how you learned it",
      "how you use it now and why it matters to you",
    ],
  },
  {
    level: "B1",
    topic: "Describe a celebration you remember",
    bullets: [
      "what the celebration was",
      "who was there",
      "what happened and why it was memorable",
    ],
  },
  {
    level: "B1",
    topic: "Describe a book or film you enjoyed",
    bullets: [
      "what it was about",
      "when you read or watched it",
      "why you enjoyed it and who you would recommend it to",
    ],
  },

  // B2 — more abstract or evaluative
  {
    level: "B2",
    topic: "Describe a time you helped someone",
    bullets: [
      "who you helped and why",
      "what you did",
      "how the person reacted and what you learned",
    ],
  },
  {
    level: "B2",
    topic: "Describe a change in your life",
    bullets: [
      "what changed",
      "why it happened",
      "how it affected you and whether it was positive",
    ],
  },
  {
    level: "B2",
    topic: "Describe a public place that impressed you",
    bullets: [
      "where it was",
      "what it looked like",
      "why it impressed you and whether you would return",
    ],
  },
  {
    level: "B2",
    topic: "Describe an ambition you have",
    bullets: [
      "what you want to achieve",
      "why it is important to you",
      "what you are doing to reach it and what challenges you face",
    ],
  },

  // C1 — nuanced topics requiring extended discourse
  {
    level: "C1",
    topic: "Describe a cultural tradition that interests you",
    bullets: [
      "what the tradition is and where it comes from",
      "how people take part in it",
      "why it matters today and how it might change in the future",
    ],
  },
  {
    level: "C1",
    topic: "Describe a piece of advice that influenced you",
    bullets: [
      "who gave you the advice",
      "what they said and the situation",
      "how you applied it and what difference it made",
    ],
  },
  {
    level: "C1",
    topic: "Describe a workplace or study challenge you faced",
    bullets: [
      "what the challenge was",
      "how you dealt with it",
      "what the outcome was and what you would do differently",
    ],
  },
  {
    level: "C1",
    topic: "Describe an invention that changed everyday life",
    bullets: [
      "what the invention is",
      "how people use it",
      "what benefits and drawbacks it has brought",
    ],
  },
];

export function speakingTasksForLevel(level: Level): SpeakingCueCard[] {
  return SPEAKING_CATALOG.filter((card) => card.level === level);
}
