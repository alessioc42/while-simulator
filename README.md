# WHILE Lab

A browser simulator for the WHILE language in `FLA2026_handout.pdf`, slides 447–449. Built with Vue, Vite, Tailwind CSS, TypeScript, and CodeMirror.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Edit the code on the right and enter inputs above the memory table on the left. Input fields and input labels are hidden during automatic execution and return when paused. The output label stays visible.

Use **Step** to execute one instruction, **Step back** to undo it, or **Run** for automatic execution. While running or paused, the highlighted line executes next. A non-editable badge previews assignment updates or loop conditions such as `3 > 0 → true` and `0 > 0 → false`. Variable updates briefly highlight the corresponding memory row, then fade. The editor shows no execution highlight before starting or after completion. Current-value badges appear after every variable occurrence, including both sides of assignments. The editor is editable only in the initial or reset state, when **Reset** is disabled. Running, pausing, stepping, and completing execution keep the code locked until reset. **Pause** stops automatic execution. **Reset** restores the initial memory and clears execution history. Adjust the run speed with the slider on the right of the header. Its current value is shown in steps per second. **Maximum steps** defaults to 10,000 and applies to both Run and Step. Increase the cap or step back to continue after reaching it.

Editing code or inputs resets execution. After completion, **Run** starts the program again. **Dark mode** switches the interface and editor theme. The selected theme is saved locally; your system preference is used on the first visit.

Copy the browser URL to share the current source code, inputs, and maximum steps. These values are stored in the URL fragment and update without reloading or adding history entries. Opening the link restores the program in its initial state.

## Language reference

Assignments have exactly one source variable and one natural-number constant:

```text
xi := xj + c
xi := xj - c
```

Subtraction stops at zero. Separate statements with semicolons. A loop repeats while its variable is greater than zero:

```text
x0 := x1 + 0;
x3 := x2 + 0;
while x3 do
  x0 := x0 + 1;
  x3 := x3 - 1
end
```

With inputs `3, 5`, this program finishes with `x0 = 8`. Inputs initialize `x1` through `xn`. All other variables start at zero, and `x0` is the output. Loops can be nested. Variable-to-variable arithmetic and additional conditions such as `x1 > 3` are rejected.

Editor conveniences extend the handout notation: `{ comments }`, `// comments`, `# comments`, Unicode minus, and a final semicolon. Values use `bigint` for exact integer arithmetic.

One step executes an assignment or evaluates a loop condition. `end` returns control to its loop condition without adding a step. Execution pauses at the maximum steps value in the header, which defaults to 10,000. Editing code or inputs clears the execution history.

## Verify changes

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm audit
```

The build checks TypeScript and produces the static app in `dist/`. Unit tests cover the parser, interpreter, input validation, and Vue controls. Playwright tests cover the real editor, syntax highlighting, execution highlighting, nested loops, and mobile layout. Playwright starts and stops its own Vite server.

The `glob` and `minimatch` overrides in `package.json` select patched versions for the Vue test utilities' formatting dependencies.
