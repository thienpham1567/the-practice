import { buildSpeakingGradePrompt, SPEAKING_GRADE_SCHEMA } from "./speaking-grade-prompt";

describe("buildSpeakingGradePrompt", () => {
  it("grades express-opinion on ETS criteria with a 0–5 raw rating and no IELTS band", () => {
    const prompt = buildSpeakingGradePrompt({
      type: "express-opinion",
      speakSeconds: 60,
      maxRaw: 5,
      question: "Should companies allow two work-from-home days a week?",
    });

    expect(prompt).toContain("Should companies allow two work-from-home days a week?");
    expect(prompt).toContain("express-opinion");
    expect(prompt.toLowerCase()).toMatch(/transcript/);
    expect(prompt.toLowerCase()).toMatch(/verbatim|exact/);
    expect(prompt).toMatch(/0\s*[–-]\s*5|0 to 5/);
    expect(prompt.toLowerCase()).toContain("task appropriateness");
    expect(prompt.toLowerCase()).toContain("delivery");
    expect(prompt.toLowerCase()).toContain("language use");
    expect(prompt).not.toMatch(/IELTS/i);
    expect(prompt).not.toMatch(/Part 2/i);
    expect(prompt.toLowerCase()).not.toMatch(/overall band/);
  });

  it("grades read-aloud on pronunciation and intonation with a 0–3 raw rating", () => {
    const prompt = buildSpeakingGradePrompt({
      type: "read-aloud",
      speakSeconds: 45,
      maxRaw: 3,
      passage: "The staff cafeteria on the second floor will open at seven thirty.",
    });

    expect(prompt).toContain("staff cafeteria");
    expect(prompt.toLowerCase()).toContain("pronunciation");
    expect(prompt.toLowerCase()).toMatch(/intonation|stress/);
    expect(prompt).toMatch(/0\s*[–-]\s*3|0 to 3/);
    expect(prompt).not.toMatch(/IELTS/i);
    expect(prompt).not.toMatch(/Part 2/i);
  });

  it("grades describe-picture, questions, and info on task, delivery, and language with a 0–3 rating", () => {
    for (const input of [
      {
        type: "describe-picture" as const,
        speakSeconds: 30,
        maxRaw: 3,
        imageUrl: "/toeic/office-desk.jpg",
      },
      {
        type: "respond-question" as const,
        speakSeconds: 15,
        maxRaw: 3,
        question: "What time do you usually start work?",
      },
      {
        type: "respond-with-info" as const,
        speakSeconds: 30,
        maxRaw: 3,
        info: "Lunch 11:30–14:00. Today's special: grilled fish.",
        question: "Until what time is lunch served?",
      },
    ]) {
      const prompt = buildSpeakingGradePrompt(input);
      expect(prompt.toLowerCase()).toContain("task appropriateness");
      expect(prompt.toLowerCase()).toContain("delivery");
      expect(prompt.toLowerCase()).toContain("language use");
      expect(prompt).toMatch(/0\s*[–-]\s*3|0 to 3/);
      expect(prompt).not.toMatch(/IELTS/i);
      expect(prompt).not.toMatch(/Part 2/i);
    }
  });

  it("asks for quotes, not character offsets, and no overall band", () => {
    const prompt = buildSpeakingGradePrompt({
      type: "express-opinion",
      speakSeconds: 60,
      maxRaw: 5,
      question: "Is a long lunch break better?",
    });

    expect(prompt.toLowerCase()).toMatch(/quote/);
    expect(prompt.toLowerCase()).toMatch(/do not invent character offsets|not.*offsets/);
    expect(prompt.toLowerCase()).toMatch(/do not compute an overall|server will/);
    expect(prompt.toLowerCase()).not.toMatch(/words per minute|filler count|wpm/);
  });
});

describe("SPEAKING_GRADE_SCHEMA", () => {
  it("requires rawRating, transcript, marks, and feedback without IELTS scores", () => {
    expect(SPEAKING_GRADE_SCHEMA.schema.required).toEqual(
      expect.arrayContaining(["rawRating", "transcript", "marks", "feedback"]),
    );
    const properties = SPEAKING_GRADE_SCHEMA.schema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty("rawRating");
    expect(properties).not.toHaveProperty("band");
    expect(properties).not.toHaveProperty("scores");
    const feedback = properties.feedback as { required: string[] };
    expect(feedback.required).toEqual(
      expect.arrayContaining([
        "pronunciation",
        "intonationStress",
        "taskAppropriateness",
        "delivery",
        "languageUse",
        "overview",
        "nextFocus",
      ]),
    );
    expect(feedback.required).not.toEqual(
      expect.arrayContaining([
        "fluencyCoherence",
        "lexicalResource",
        "grammaticalRange",
      ]),
    );
  });
});
