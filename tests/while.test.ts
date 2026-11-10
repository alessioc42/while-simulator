import { describe, expect, it } from "vitest";
import { compile, Machine, parseInputs } from "../src/lib/while";
import { examples } from "../src/lib/examples";
function execute(code: string, inputs: bigint[] = [], limit = 1000) {
  const machine = new Machine(compile(code), inputs);
  while (!machine.done && machine.steps < limit) machine.step();
  return machine;
}
it("tracks every variable occurrence, skipping comments", () => {
  const source =
    "{ x9 := x0 + 0 }\nwhile { note } x01 do\n x0 { note } := x1 + 0\nend";
  expect(compile(source).variableLocations).toEqual([
    { position: source.indexOf("x01") + 3, variable: "x1" },
    { position: source.lastIndexOf("x0") + 2, variable: "x0" },
    { position: source.lastIndexOf("x1") + 2, variable: "x1" },
  ]);
});
describe("WHILE grammar from slides 447–449", () => {
  it("initializes inputs, other variables, and the output correctly", () => {
    const machine = new Machine(compile("x0 := x7 + 0"), [3n, 5n]);
    expect(machine.memory).toEqual({ x0: 0n, x7: 0n, x1: 3n, x2: 5n });
    expect(machine.line).toBe(1);
  });
  it("executes sequential assignments and truncates subtraction at zero", () => {
    expect(execute("x0 := x1 - 7; x2 := x0 + 4", [2n]).memory).toEqual({
      x0: 0n,
      x1: 2n,
      x2: 4n,
    });
  });
  it("skips a loop whose condition is zero", () => {
    const m = execute("while x1 do x0 := x0 + 1 end; x0 := x0 + 2");
    expect(m.memory.x0).toBe(2n);
    expect(m.steps).toBe(2);
  });
  it("reevaluates conditions and highlights the next instruction", () => {
    const m = new Machine(
      compile("while x1 do\n x1 := x1 - 1\nend;\nx0 := x1 + 3"),
      [1n],
    );
    m.step();
    expect(m.line).toBe(2);
    m.step();
    expect(m.line).toBe(1);
    m.step();
    expect(m.line).toBe(4);
    m.step();
    expect(m.done).toBe(true);
    expect(m.line).toBeNull();
  });
  it("handles nested loop exits and loop-backs", () => {
    const m = execute(examples[1]!.code, [3n, 4n]);
    expect(m.done).toBe(true);
    expect(m.memory.x0).toBe(12n);
  });
  it.each([
    [0, "3, 5", 8n],
    [0, "0, 0", 0n],
    [1, "0, 4", 0n],
    [1, "4, 0", 0n],
    [2, "7, 3", 4n],
    [2, "2, 5", 0n],
    [3, "5", 0n],
  ] as const)("runs example %s with %s", (index, inputs, output) => {
    const m = execute(examples[index]!.code, parseInputs(inputs));
    expect(m.done).toBe(true);
    expect(m.memory.x0).toBe(output);
  });
  it("uses exact natural-number arithmetic beyond JavaScript safe integers", () => {
    expect(execute("x0 := x1 + 1", [9007199254740993n]).memory.x0).toBe(
      9007199254740994n,
    );
  });
  it("supports handout comments, multiline comments, and Unicode minus", () => {
    expect(
      execute("{ multi\nline }\nx0 := x1 − 1; // comment\n# comment", [4n])
        .memory.x0,
    ).toBe(3n);
  });
  it("normalizes variable indices", () => {
    expect(execute("x00 := x01 + 1", [4n]).memory.x0).toBe(5n);
  });
  it.each([
    "x0 := x1 + x2",
    "x0 := 3",
    "while x1 > 0 do x0 := x0 + 1 end",
    "loop x1 do x0 := x0 + 1 end",
    "while x1 do x0 := x0 + 1",
    "while x1 do end",
    "x0 := x0 + 1 x1 := x0 + 0",
    "",
    "{ unclosed",
    "x0 := x1 + -1",
    "x0 := x1 + 1;;",
  ])("rejects invalid source: %s", (source) => {
    expect(() => compile(source)).toThrow(/Line \d+, column \d+:/);
  });
  it("keeps nonterminating programs steppable", () => {
    const m = execute("while x1 do x0 := x0 + 1 end", [1n], 20);
    expect(m.done).toBe(false);
    expect(m.steps).toBe(20);
  });
  it("restores the complete prior execution state", () => {
    const m = new Machine(compile("x0 := x1 + 1; x0 := x0 + 1"), [3n]);
    const initial = m.snapshot();
    m.step();
    m.restore(initial);
    expect(m.steps).toBe(0);
    expect(m.memory.x0).toBe(0n);
    expect(m.pc).toBe(0);
    m.step();
    expect(initial.memory.x0).toBe(0n);
    expect(m.memory.x0).toBe(4n);
  });
  it("does nothing after completion", () => {
    const m = execute("x0 := x0 + 1");
    expect(m.step()).toBeNull();
    expect(m.steps).toBe(1);
  });
});
describe("inputs", () => {
  it("accepts whitespace, commas, empty input, and large integers", () => {
    expect(parseInputs(" 3, 5  9007199254740993 ")).toEqual([
      3n,
      5n,
      9007199254740993n,
    ]);
    expect(parseInputs("")).toEqual([]);
  });
  it.each(["-1", "1.2", "abc", "1e3", "1,,2", "3,"])(
    "rejects invalid input %s",
    (value) => {
      expect(() => parseInputs(value)).toThrow();
    },
  );
});
