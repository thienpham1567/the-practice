import { describe, expect, it } from "vitest";
import { promptBody } from "./prompt-body";

const FRAME = "Write an email to a specific person for a given purpose.";
const SITUATION = "Your friend Alex is visiting your city next month. Write to Alex.";

/**
 * The exam frame is a fixed sentence per task type. It used to be baked into
 * the stored prompt, which read as a redundant trailing sentence after a
 * generated situation that already said the same thing. It is rendered on its
 * own line now — so anything stored the old way has to have it stripped, or it
 * would appear twice.
 */
describe("promptBody", () => {
  it("returns a newly stored prompt unchanged", () => {
    expect(promptBody(SITUATION, FRAME)).toBe(SITUATION);
  });

  it("strips the frame an older prompt had appended to it", () => {
    expect(promptBody(`${SITUATION}\n\n${FRAME}`, FRAME)).toBe(SITUATION);
  });

  it("strips the frame even with trailing whitespace after it", () => {
    expect(promptBody(`${SITUATION}\n\n${FRAME}  \n`, FRAME)).toBe(SITUATION);
  });

  it("leaves the frame alone when it is not at the end", () => {
    const midway = `${FRAME} Then something else entirely.`;
    expect(promptBody(midway, FRAME)).toBe(midway);
  });

  it("returns the prompt unchanged when the task has no frame", () => {
    expect(promptBody(SITUATION, "")).toBe(SITUATION);
  });

  it("trims surrounding whitespace so the rendered line has no stray gap", () => {
    expect(promptBody(`  ${SITUATION}  `, FRAME)).toBe(SITUATION);
  });
});
