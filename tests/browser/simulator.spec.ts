import { expect, test } from "@playwright/test";

test("editor highlighting and memory follow execution", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "WHILE program editor" });
  await expect(editor).toContainText("while");
  await expect(page.locator(".executing-line")).toHaveCount(0);
  const gutter = await page
    .locator(".cm-lineNumbers .cm-gutterElement")
    .filter({ hasText: /^1$/ })
    .boundingBox();
  const firstLine = await page
    .locator(".cm-content .cm-line")
    .first()
    .boundingBox();
  expect(Math.abs(gutter!.y - firstLine!.y)).toBeLessThan(2);
  await expect(
    editor
      .locator("span")
      .filter({ hasText: /^while$/ })
      .first(),
  ).toHaveCSS("color", "rgb(144, 96, 207)");
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.getByTestId("value-x0")).toHaveText("3");
  await expect(page.locator(".executing-line")).toContainText(":= x2");
  await page.getByRole("button", { name: "Step back" }).click();
  await expect(page.getByTestId("value-x0")).toHaveText("0");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.locator(".executing-line")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".executing-line")).toHaveCount(1);

  await page.getByLabel("Run speed").focus();
  await page.keyboard.press("End");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByTestId("value-x0")).toHaveText("8");
  await expect(page.locator(".executing-line")).toHaveCount(0);
  await expect(page.getByTestId("speed-value")).toHaveText("50 steps/s");
  await expect(page.locator(".toolbar-actions button svg")).toHaveCount(5);
  const settings = await page.locator(".toolbar-settings").boundingBox();
  const actions = await page.locator(".toolbar-actions").boundingBox();
  expect(settings!.x).toBeGreaterThan(actions!.x + actions!.width);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("value-x0")).toHaveText("0");
  await expect(page.locator(".executing-line")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("editing, inputs, nested loops and custom cap", async ({ page }) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "WHILE program editor" });
  await editor.fill("x0 := x1 + x2");
  await expect(page.getByRole("alert")).toContainText(
    "natural-number constant",
  );
  await editor.fill("x0 := x1 + 9007199254740993");
  await page.getByLabel("Inputs", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.getByTestId("value-x0")).toHaveText("9007199254740995");
  await expect(editor).toHaveAttribute("aria-readonly", "true");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await editor.fill(
    "while x1 do\n x2 := x1 + 0;\n while x2 do\n  x0 := x0 + 1;\n  x2 := x2 - 1\n end;\n x1 := x1 - 1\nend",
  );
  await page.getByLabel("Run speed").focus();
  await page.keyboard.press("End");
  await page.getByLabel("Maximum steps").fill("4");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId("value-x0")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".executing-line")).toHaveCount(1);
  await page.getByLabel("Maximum steps").fill("100");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByTestId("value-x0")).toHaveText("3");
  await expect(
    page.getByRole("button", { name: "Step", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".executing-line")).toHaveCount(0);
});

test("minimal layout keeps inputs above memory on the left and fits mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const editorBox = await page.locator(".editor-pane").boundingBox();
  const memoryBox = await page
    .getByRole("table", { name: "Memory" })
    .boundingBox();
  const inputsBox = await page
    .getByLabel("Inputs", { exact: true })
    .boundingBox();
  expect(memoryBox!.x).toBeLessThan(editorBox!.x);
  expect(inputsBox!.y).toBeLessThan(memoryBox!.y);
  expect(
    (await page.locator("header button").allTextContents()).map((text) =>
      text.trim(),
    ),
  ).toEqual(["Run", "Pause", "Reset", "Step back", "Step", "Dark mode"]);
  expect(
    await page
      .locator("button, input, table")
      .evaluateAll((es) =>
        es.every((e) => getComputedStyle(e).borderRadius === "0px"),
      ),
  ).toBe(true);
  await expect(page.getByRole("switch", { name: "Dark mode" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("assignment previews are separate from code and memory flashes fade and restart", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "WHILE program editor" });
  await editor.fill("x0 := x0 + 1;\nx0 := x0 + 1;\nx0 := x0 + 1");
  await expect(
    page.locator(".execution-annotation:not(.variable-value-annotation)"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Step", exact: true }).click();
  const note = page.locator(
    ".execution-annotation:not(.variable-value-annotation)",
  );
  await expect(note).toHaveText("x0: 1 → 2");
  await expect(note).toHaveAttribute("contenteditable", "false");
  await expect(
    page.locator(
      ".executing-line .execution-annotation:not(.variable-value-annotation)",
    ),
  ).toHaveCount(1);
  const row = page.getByTestId("value-x0").locator("..");
  await expect(row).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(row).toHaveCSS("background-color", "rgba(0, 0, 0, 0)", {
    timeout: 3000,
  });
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(note).toHaveText("x0: 2 → 3");
  await expect(row).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  // Reset unlocks editing and clears the preview without inserting its text into code.
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await editor.press("Control+End");
  await page.keyboard.type(";");
  await expect(note).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(editor).not.toContainText("→");
});

test("live badges annotate every variable occurrence; running locks the editor", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "WHILE program editor" });
  const code =
    "{ while x9 do x8 := x0 + 0 end }\nx0 := x1 + 0;\nwhile x2 do\n x0 := x0 + 1;\n x2 := x2 - 1\nend";
  await editor.fill(code);
  const badges = page.locator(".variable-value-annotation");
  await expect(badges).toHaveCount(7);
  await expect(badges).toHaveText(["0", "3", "5", "0", "0", "5", "5"]);
  const loop = page.locator(".cm-line").filter({ hasText: /^while/ });
  await expect(loop.locator(".variable-value-annotation")).toHaveText("5");
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(badges).toHaveText(["3", "3", "5", "3", "3", "5", "5"]);
  await page.getByRole("button", { name: "Step back" }).click();
  await expect(badges).toHaveText(["0", "3", "5", "0", "0", "5", "5"]);
  await page.getByLabel("Run speed").focus();
  await page.keyboard.press("Home");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(editor).toHaveAttribute("aria-readonly", "true");
  await editor.click();
  await editor.press("Control+End");
  await page.keyboard.type("x9");
  await expect(editor).not.toContainText("endx9");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(editor).toHaveAttribute("aria-readonly", "true");
  await editor.press("Control+End");
  await page.keyboard.type("x9");
  await expect(editor).not.toContainText("endx9");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await expect(editor).toHaveAttribute("aria-readonly", "false");
  await editor.press("Control+End");
  await page.keyboard.type(";");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("value-x0")).toHaveText("0");
});

test("dark mode themes the editor and badges, preserves execution, and persists", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Guide" })).toHaveCount(0);
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByTestId("value-x0")).toHaveText("3");
  await expect(page.locator(".cm-editor")).toHaveCSS(
    "background-color",
    "rgb(23, 27, 35)",
  );
  await expect(page.locator(".variable-value-annotation").first()).toHaveCSS(
    "color",
    "rgb(206, 194, 230)",
  );
  await expect(
    page.getByRole("textbox", { name: "WHILE program editor" }),
  ).toHaveAttribute("aria-readonly", "true");
  await page.reload();
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(page.locator(".cm-editor")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.reload();
  await expect(toggle).not.toBeChecked();
});

test("first visit respects the system dark theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByRole("switch", { name: "Dark mode" })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("loop condition badges show the mathematical evaluation for true and false", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "WHILE program editor" })
    .fill("x0 := x0 + 0;\nwhile x1 do\n x1 := x1 - 1\nend;\nx0 := x0 + 1");
  await page.getByLabel("Inputs", { exact: true }).fill("1");
  const step = page.getByRole("button", { name: "Step", exact: true });
  const note = page.locator(
    ".executing-line .execution-annotation:not(.variable-value-annotation)",
  );
  await step.click();
  await expect(note).toHaveText("1 > 0 → true");
  await expect(note).toHaveAttribute("contenteditable", "false");
  await step.click();
  await step.click();
  await expect(note).toHaveText("0 > 0 → false");
  await expect(page.locator(".executing-line")).toContainText("while");
  await step.click();
  await expect(page.locator(".executing-line")).toContainText(":= x0");
  await page.getByRole("button", { name: "Step back" }).click();
  await expect(note).toHaveText("0 > 0 → false");
});

test("URL updates without reloads and restores a shared program", async ({
  page,
  context,
}) => {
  await page.goto("/?keep=1");
  const source = "{ ü + # & = % ? }\nx0 := x1 + 0;\nx0 := x0 − 1";
  await page.evaluate(() => {
    (window as unknown as { shareTestMarker: string }).shareTestMarker =
      "same-page";
  });
  const initialHistory = await page.evaluate(() => history.length);
  await page
    .getByRole("textbox", { name: "WHILE program editor" })
    .fill(source);
  await page.getByLabel("Inputs", { exact: true }).fill("12, 34");
  await page.getByLabel("Maximum steps").fill("17");
  await expect
    .poll(() =>
      new URLSearchParams(new URL(page.url()).hash.slice(1)).get("maxSteps"),
    )
    .toBe("17");
  const sharedUrl = page.url();
  const parameters = new URLSearchParams(new URL(sharedUrl).hash.slice(1));
  expect(parameters.get("code")).toBe(source);
  expect(parameters.get("inputs")).toBe("12, 34");
  expect(new URL(sharedUrl).search).toBe("?keep=1");
  expect(
    await page.evaluate(
      () => (window as unknown as { shareTestMarker: string }).shareTestMarker,
    ),
  ).toBe("same-page");
  expect(await page.evaluate(() => history.length)).toBe(initialHistory);
  const recipient = await context.newPage();
  await recipient.goto(sharedUrl);
  await expect(recipient.getByLabel("Inputs", { exact: true })).toHaveValue(
    "12, 34",
  );
  await expect(recipient.getByLabel("Maximum steps")).toHaveValue("17");
  await expect(
    recipient.getByRole("textbox", { name: "WHILE program editor" }),
  ).toContainText("ü + # & = % ?");
  await expect(
    recipient.getByRole("button", { name: "Reset", exact: true }),
  ).toBeDisabled();
  await recipient.getByRole("button", { name: "Step", exact: true }).click();
  await expect(recipient.getByTestId("value-x0")).toHaveText("12");
  await recipient.getByRole("button", { name: "Step", exact: true }).click();
  await expect(recipient.getByTestId("value-x0")).toHaveText("11");
  await recipient.close();
});
