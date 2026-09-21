import type { SpeakingTaskType } from "./types";

export interface ToeicScene {
  id: string;
  imageUrl: string;
  wordA: string;
  wordB: string;
  alt: string;
}

export const TOEIC_SCENES: ToeicScene[] = [
  {
    id: "office-desk",
    imageUrl: "/toeic/office-desk.jpg",
    wordA: "computer",
    wordB: "papers",
    alt: "A workplace desk with a computer and stacked papers",
  },
  {
    id: "night-office",
    imageUrl: "/toeic/night-office.jpg",
    wordA: "lamp",
    wordB: "notebook",
    alt: "An office desk at night with a lamp and an open notebook",
  },
  {
    id: "meeting-table",
    imageUrl: "/toeic/meeting-table.jpg",
    wordA: "laptop",
    wordB: "coffee",
    alt: "A meeting table with a laptop and a cup of coffee",
  },
  {
    id: "conference-room",
    imageUrl: "/toeic/conference-room.jpg",
    wordA: "chair",
    wordB: "window",
    alt: "A conference room with empty chairs near a window",
  },
  {
    id: "reception-desk",
    imageUrl: "/toeic/reception-desk.jpg",
    wordA: "telephone",
    wordB: "documents",
    alt: "A reception desk with a telephone and documents",
  },
  {
    id: "writing-station",
    imageUrl: "/toeic/writing-station.jpg",
    wordA: "pen",
    wordB: "folder",
    alt: "A writing station with a pen beside a folder",
  },
  {
    id: "study-corner",
    imageUrl: "/toeic/study-corner.jpg",
    wordA: "books",
    wordB: "glasses",
    alt: "A study corner with books and a pair of glasses",
  },
  {
    id: "planning-board",
    imageUrl: "/toeic/planning-board.jpg",
    wordA: "calendar",
    wordB: "desk",
    alt: "A planning desk with a calendar on the surface",
  },
];
