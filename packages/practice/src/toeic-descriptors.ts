const SPEAKING_BANDS = [
  [
    30,
    "Typically left a significant part of the speaking test unanswered, or may not have the listening or reading skills needed to understand the directions.",
  ],
  [
    50,
    "Typically cannot state an opinion or support it, and they are difficult to understand in routine social and occupational interactions such as answering questions and giving basic information.",
  ],
  [
    70,
    "Typically can, with some difficulty, state an opinion but cannot support it. Most of the time they cannot answer questions and give basic information, and they have insufficient vocabulary or grammar to create simple descriptions.",
  ],
  [
    100,
    "Typically are unsuccessful when attempting to explain an opinion or respond to a complicated request. Most of the time they cannot answer questions or give basic information.",
  ],
  [
    120,
    "Typically have limited success at expressing an opinion or responding to a complicated request; responses may be inaccurate, vague, or repetitive, with limited vocabulary. Most of the time they can answer questions and give basic information, though sometimes they are difficult to understand.",
  ],
  [
    150,
    "Typically can create a relevant response when asked to express an opinion or respond to a complicated request, but explanations are often unclear because of pronunciation, grammar, or limited vocabulary. Most of the time they can answer questions and give basic information, though sometimes they are difficult to understand.",
  ],
  [
    180,
    "Typically can create connected, sustained workplace discourse and express opinions or respond to complicated requests effectively, though minor pronunciation, complex-grammar, or vocabulary lapses may occur without interfering with the message.",
  ],
  [
    200,
    "Typically can create connected, sustained discourse appropriate to the typical workplace. When they express opinions or respond to complicated requests, their speech is highly intelligible; grammar and vocabulary are accurate and precise.",
  ],
] as const;

const WRITING_BANDS = [
  [
    30,
    "Typically left part of the writing test unanswered, or may need stronger reading ability to understand the directions and questions.",
  ],
  [
    40,
    "Typically have only very limited ability to express an opinion and cannot give straightforward information; they are unable to produce grammatically correct sentences.",
  ],
  [
    60,
    "Typically have limited ability to express an opinion and give straightforward information; responses often show serious disorganization, little detail, or frequent grammatical mistakes.",
  ],
  [
    80,
    "Typically have some developing ability to express an opinion and give straightforward information, but communication is limited.",
  ],
  [
    100,
    "Typically are at least partially successful when giving straightforward information, but mostly unsuccessful when supporting an opinion; significant weaknesses interfere with communication.",
  ],
  [
    130,
    "Typically are partially successful when giving straightforward information or supporting an opinion; the message may omit important information or be partly unintelligible.",
  ],
  [
    160,
    "Typically can effectively give straightforward information, ask questions, give instructions, or make requests, but are only partially successful when supporting an opinion. Straightforward information remains clear, coherent, and effective.",
  ],
  [
    190,
    "Typically can communicate straightforward information effectively and support an opinion; writing is generally well organized with a variety of sentence structures, though occasional unclear connections or minor grammatical or word-choice mistakes may appear.",
  ],
  [
    200,
    "Typically can communicate straightforward information effectively and use reasons, examples, or explanations to support an opinion. The writing is well organized and well developed, with a variety of sentence structures, appropriate word choice, and grammatical accuracy.",
  ],
] as const;

function descriptorFor(
  scaled: number,
  bands: readonly (readonly [number, string])[],
): string {
  const score = Math.max(0, Math.min(200, scaled));
  return bands.find(([upperBound]) => score <= upperBound)![1];
}

export function speakingDescriptor(scaled: number): string {
  return descriptorFor(scaled, SPEAKING_BANDS);
}

export function writingDescriptor(scaled: number): string {
  return descriptorFor(scaled, WRITING_BANDS);
}
