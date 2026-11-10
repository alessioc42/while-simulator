export const examples = [
  {
    name: "Addition",
    file: "addition.while",
    description: "Add two natural numbers.",
    inputs: "3, 5",
    code: "{ Add x1 and x2; store the result in x0. }\nx0 := x1 + 0;\nx3 := x2 + 0;\n\nwhile x3 do\n  x0 := x0 + 1;\n  x3 := x3 - 1\nend",
  },
  {
    name: "Multiplication",
    file: "multiplication.while",
    description: "Repeated addition with nested loops.",
    inputs: "3, 4",
    code: "{ Multiply x1 by x2. }\nx0 := x0 + 0;\nx3 := x1 + 0;\nwhile x3 do\n  x4 := x2 + 0;\n  while x4 do\n    x0 := x0 + 1;\n    x4 := x4 - 1\n  end;\n  x3 := x3 - 1\nend",
  },
  {
    name: "Subtraction",
    file: "subtraction.while",
    description: "Subtract with a lower bound of zero.",
    inputs: "7, 3",
    code: "{ Compute max(0, x1 - x2). }\nx0 := x1 + 0;\nx3 := x2 + 0;\nwhile x3 do\n  x0 := x0 - 1;\n  x3 := x3 - 1\nend",
  },
  {
    name: "Countdown",
    file: "countdown.while",
    description: "A first look at a WHILE loop.",
    inputs: "5",
    code: "{ Count down from the first input. }\nx0 := x1 + 0;\nwhile x0 do\n  x0 := x0 - 1\nend",
  },
];
