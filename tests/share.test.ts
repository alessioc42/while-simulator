import { describe, expect, it } from "vitest";
import { readSharedProgram, sharedProgramHash } from "../src/lib/share";
const defaults = { code: "x0 := x1 + 0", inputs: "3", maximumSteps: 10000 };
describe("shareable program state", () => {
  it("round-trips Unicode, newlines, comments, and URL-sensitive characters", () => {
    const program = {
      code: "{ ü + # & = % ? }\nx0 := x1 − 1",
      inputs: "12345678901234567890, 5",
      maximumSteps: 27,
    };
    expect(readSharedProgram(sharedProgramHash(program), defaults)).toEqual(
      program,
    );
  });
  it("uses defaults only for absent parameters, preserving empty fields", () => {
    expect(readSharedProgram("", defaults)).toEqual(defaults);
    expect(readSharedProgram("#inputs=", defaults)).toEqual({
      ...defaults,
      inputs: "",
    });
    const empty = { code: "", inputs: "", maximumSteps: "" };
    expect(readSharedProgram(sharedProgramHash(empty), defaults)).toEqual(
      empty,
    );
  });
  it.each(["0", "-1", "1.5", "oops", "9007199254740993"])(
    "preserves invalid limit %s for validation in the UI",
    (maximumSteps) => {
      const program = { ...defaults, maximumSteps };
      expect(readSharedProgram(sharedProgramHash(program), defaults)).toEqual(
        program,
      );
    },
  );
});
