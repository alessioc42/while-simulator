/** Course handout, slides 447–449. Only the three primitive constructs. */
type Token = { text: string; line: number; column: number; from: number };
export type Instruction =
  | {
      kind: "assign";
      line: number;
      target: string;
      source: string;
      op: "+" | "-";
      value: bigint;
    }
  | { kind: "check"; line: number; variable: string; exit: number }
  | { kind: "jump"; line: number; to: number };
export type VariableLocation = { position: number; variable: string };
export type Program = {
  instructions: Instruction[];
  variables: string[];
  variableLocations: VariableLocation[];
};
export class SyntaxError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
  ) {
    super(`Line ${line}, column ${column}: ${message}`);
  }
}
export function compile(source: string): Program {
  const tokens: Token[] = [];
  let position = 0,
    line = 1,
    column = 1;
  function advance(text: string) {
    for (const char of text) {
      if (char === "\n") {
        line++;
        column = 1;
      } else column++;
    }
    position += text.length;
  }
  while (position < source.length) {
    const rest = source.slice(position);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      advance(whitespace[0]);
      continue;
    }
    if (rest.startsWith("//") || rest.startsWith("#")) {
      advance(rest.split("\n")[0]);
      continue;
    }
    if (rest.startsWith("{")) {
      const end = rest.indexOf("}");
      if (end < 0)
        throw new SyntaxError("Unclosed comment; expected }.", line, column);
      advance(rest.slice(0, end + 1));
      continue;
    }
    const match = /^(while\b|do\b|end\b|x\d+\b|\d+\b|:=|[+−;\-])/.exec(rest);
    if (!match)
      throw new SyntaxError(`Unexpected character “${rest[0]}”.`, line, column);
    tokens.push({
      text: match[0] === "−" ? "-" : match[0],
      line,
      column,
      from: position,
    });
    advance(match[0]);
  }
  tokens.push({ text: "<eof>", line, column, from: position });
  let cursor = 0;
  const instructions: Instruction[] = [];
  const variableLocations: VariableLocation[] = [];
  const variables = new Set<string>(["x0"]);
  const peek = () => tokens[cursor]!;
  function fail(message: string): never {
    const t = peek();
    throw new SyntaxError(message, t.line, t.column);
  }
  function take(expected: string) {
    if (peek().text !== expected)
      fail(`Expected “${expected}”, found “${peek().text}”.`);
    return tokens[cursor++]!;
  }
  function variable() {
    if (!/^x\d+$/.test(peek().text))
      fail("Expected a variable such as x0 or x1.");
    const token = tokens[cursor++]!;
    const name = `x${BigInt(token.text.slice(1))}`;
    variables.add(name);
    variableLocations.push({
      position: token.from + token.text.length,
      variable: name,
    });
    return name;
  }
  function statement() {
    const first = peek();
    if (first.text === "while") {
      take("while");
      const name = variable();
      take("do");
      const start = instructions.length;
      const check: Instruction = {
        kind: "check",
        line: first.line,
        variable: name,
        exit: 0,
      };
      instructions.push(check);
      sequence();
      const end = take("end");
      instructions.push({ kind: "jump", line: end.line, to: start });
      check.exit = instructions.length;
    } else {
      const target = variable();
      take(":=");
      const source = variable();
      if (peek().text !== "+" && peek().text !== "-")
        fail("Expected + or - followed by a natural-number constant.");
      const op = tokens[cursor++]!.text as "+" | "-";
      if (!/^\d+$/.test(peek().text))
        fail(
          "Expected a natural-number constant; variable arithmetic is not part of WHILE.",
        );
      const value = BigInt(tokens[cursor++]!.text);
      instructions.push({
        kind: "assign",
        line: first.line,
        target,
        source,
        op,
        value,
      });
    }
  }
  function sequence() {
    if (peek().text === "<eof>" || peek().text === "end")
      fail("Expected an assignment or while loop.");
    statement();
    while (peek().text === ";") {
      take(";");
      // A final semicolon is accepted as an editor convenience.
      if (peek().text === "end" || peek().text === "<eof>") break;
      statement();
    }
  }
  sequence();
  take("<eof>");
  return {
    instructions,
    variableLocations,
    variables: [...variables].sort((a, b) =>
      BigInt(a.slice(1)) < BigInt(b.slice(1)) ? -1 : 1,
    ),
  };
}
export type Snapshot = {
  pc: number;
  memory: Record<string, bigint>;
  steps: number;
};
export type StepResult = {
  line: number;
  description: string;
  changed: string | null;
};
export class Machine {
  pc = 0;
  steps = 0;
  memory: Record<string, bigint> = {};
  constructor(
    public program: Program,
    inputs: bigint[] = [],
  ) {
    for (const name of program.variables) this.memory[name] = 0n;
    inputs.forEach((value, index) => {
      if (value < 0n) throw new Error("Inputs must be natural numbers.");
      this.memory[`x${index + 1}`] = value;
    });
  }
  get done() {
    return this.pc >= this.program.instructions.length;
  }
  get line(): number | null {
    return this.program.instructions[this.pc]?.line ?? null;
  }
  snapshot(): Snapshot {
    return { pc: this.pc, memory: { ...this.memory }, steps: this.steps };
  }
  restore(state: Snapshot) {
    this.pc = state.pc;
    this.memory = { ...state.memory };
    this.steps = state.steps;
  }
  step(): StepResult | null {
    if (this.done) return null;
    const instruction = this.program.instructions[this.pc]!;
    let description = "",
      changed: string | null = null;
    if (instruction.kind === "assign") {
      const previous = this.memory[instruction.target] ?? 0n;
      const value =
        (this.memory[instruction.source] ?? 0n) +
        (instruction.op === "+" ? instruction.value : -instruction.value);
      this.memory[instruction.target] = value < 0n ? 0n : value;
      changed =
        this.memory[instruction.target] !== previous
          ? instruction.target
          : null;
      description = `${instruction.target}: ${previous} → ${this.memory[instruction.target]}`;
      this.pc++;
    } else if (instruction.kind === "check") {
      const value = this.memory[instruction.variable] ?? 0n;
      description = `${instruction.variable} = ${value} · ${value > 0n ? "enter loop" : "exit loop"}`;
      this.pc = value > 0n ? this.pc + 1 : instruction.exit;
    } else throw new Error("Unexpected internal jump.");
    // Loop-back is bookkeeping, not a separate language instruction.
    while (this.program.instructions[this.pc]?.kind === "jump") {
      this.pc = (
        this.program.instructions[this.pc] as Extract<
          Instruction,
          { kind: "jump" }
        >
      ).to;
    }
    this.steps++;
    return { line: instruction.line, description, changed };
  }
}
export function parseInputs(text: string): bigint[] {
  if (!text.trim()) return [];
  if (/(^\s*,|,\s*,|,\s*$)/.test(text))
    throw new Error("Each comma must separate two natural numbers.");
  const values = text.trim().split(/[\s,]+/);
  if (values.some((value) => !/^\d+$/.test(value)))
    throw new Error(
      "Use natural numbers separated by commas or spaces, for example: 3, 5.",
    );
  return values.map((value) => BigInt(value));
}
