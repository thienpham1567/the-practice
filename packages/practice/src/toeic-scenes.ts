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
    wordA: "notebook",
    wordB: "glass",
    alt: "A wooden desk with a closed notebook, a glass of water, and a stack of books.",
  },
  {
    id: "night-office",
    imageUrl: "/toeic/night-office.jpg",
    wordA: "candle",
    wordB: "lamp",
    alt: "A desk at night with a notebook, a glass of water, a lit candle, and a lamp.",
  },
  {
    id: "meeting-table",
    imageUrl: "/toeic/meeting-table.jpg",
    wordA: "note",
    wordB: "pen",
    alt: "A desk by a window with a notebook, a handwritten note, a pen, and stacked books.",
  },
  {
    id: "conference-room",
    imageUrl: "/toeic/conference-room.jpg",
    wordA: "coffee",
    wordB: "notebook",
    alt: "A desk with a coffee cup, an open notebook, stacked books, and a lamp.",
  },
  {
    id: "reception-desk",
    imageUrl: "/toeic/reception-desk.jpg",
    wordA: "tea",
    wordB: "pens",
    alt: "A desk with a cup of tea, an open notebook, a small vase, and a pen holder.",
  },
  {
    id: "writing-station",
    imageUrl: "/toeic/writing-station.jpg",
    wordA: "coffee",
    wordB: "vase",
    alt: "A desk by a window with stacked books, a coffee cup, a notebook, and a vase of flowers.",
  },
  {
    id: "study-corner",
    imageUrl: "/toeic/study-corner.jpg",
    wordA: "cup",
    wordB: "scissors",
    alt: "A windowsill with a cup of tea, a notebook, scissors, and old books overlooking a forest.",
  },
  {
    id: "planning-board",
    imageUrl: "/toeic/planning-board.jpg",
    wordA: "glass",
    wordB: "note",
    alt: "A night desk with a notebook, a glass of water, a handwritten note, and stacked books.",
  },
];
