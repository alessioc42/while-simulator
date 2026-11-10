import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import App from "../src/App.vue";
import CodeEditor from "../src/components/CodeEditor.vue";
let wrapper: VueWrapper;
const button = (text: string) =>
  wrapper.findAll("button").find((b) => b.text() === text)!;
function start() {
  wrapper = mount(App, {
    global: {
      stubs: {
        CodeEditor: {
          props: [
            "modelValue",
            "activeLine",
            "annotation",
            "variableValues",
            "readOnly",
          ],
          template:
            '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
      },
    },
  });
}
const value = (name = "x0") =>
  wrapper.get(`[data-testid="value-${name}"]`).text();
beforeEach(() => {
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
});
describe("simulator controls", () => {
  it("previews both outcomes of loop conditions and restores them on step back", async () => {
    start();
    await wrapper
      .get("textarea")
      .setValue("x0 := x0 + 0; while x1 do x1 := x1 - 1 end; x0 := x0 + 1");
    await wrapper.get("#inputs").setValue("1");
    const annotation = () =>
      wrapper.findComponent(CodeEditor).props("annotation");
    await button("Step").trigger("click");
    expect(annotation()).toBe("1 > 0 → true");
    await button("Step").trigger("click");
    expect(annotation()).toBe("x1: 1 → 0");
    await button("Step").trigger("click");
    expect(annotation()).toBe("0 > 0 → false");
    await button("Step").trigger("click");
    expect(annotation()).toBe("x0: 0 → 1");
    await button("Step back").trigger("click");
    expect(annotation()).toBe("0 > 0 → false");
  });
  it("permits code editing only while Reset is disabled", async () => {
    vi.useFakeTimers();
    start();
    const check = () =>
      expect(wrapper.findComponent(CodeEditor).props("readOnly")).toBe(
        button("Reset").attributes("disabled") === undefined,
      );
    check();
    await button("Step").trigger("click");
    check();
    await button("Step back").trigger("click");
    check();
    await button("Run").trigger("click");
    check();
    await button("Pause").trigger("click");
    check();
    await button("Run").trigger("click");
    await vi.runAllTimersAsync();
    check();
    await button("Reset").trigger("click");
    check();
    expect(wrapper.findComponent(CodeEditor).props("readOnly")).toBe(false);
  });
  it("previews exact assignment results on the next paused line", async () => {
    start();
    await wrapper
      .get("textarea")
      .setValue("x0 := x0 + 0;\nx0 := x1 - 10;\nx0 := x1 + 9007199254740993");
    await button("Step").trigger("click");
    expect(wrapper.findComponent(CodeEditor).props("annotation")).toBe(
      "x0: 0 → 0",
    );
    await button("Step").trigger("click");
    expect(wrapper.findComponent(CodeEditor).props("annotation")).toBe(
      "x0: 0 → 9007199254740996",
    );
    await button("Step back").trigger("click");
    expect(wrapper.findComponent(CodeEditor).props("annotation")).toBe(
      "x0: 0 → 0",
    );
    await button("Reset").trigger("click");
    expect(wrapper.findComponent(CodeEditor).props("annotation")).toBeNull();
  });
  it("highlights while running or paused and gates controls by state", async () => {
    vi.useFakeTimers();
    start();
    const line = () => wrapper.findComponent(CodeEditor).props("activeLine");
    const disabled = (name: string) =>
      button(name).attributes("disabled") !== undefined;
    expect(line()).toBeNull();
    expect(disabled("Run")).toBe(false);
    expect(disabled("Pause")).toBe(true);
    expect(disabled("Reset")).toBe(true);
    expect(disabled("Step back")).toBe(true);
    await button("Run").trigger("click");
    expect(line()).not.toBeNull();
    expect(disabled("Run")).toBe(true);
    expect(disabled("Pause")).toBe(false);
    expect(disabled("Step")).toBe(true);
    expect(disabled("Step back")).toBe(true);
    await button("Pause").trigger("click");
    expect(line()).toBe(3);
    expect(disabled("Pause")).toBe(true);
    expect(button("Pause").attributes("aria-pressed")).toBe("true");
    await button("Run").trigger("click");
    expect(line()).not.toBeNull();
    await vi.runAllTimersAsync();
    expect(line()).toBeNull();
    expect(disabled("Step")).toBe(true);
    expect(disabled("Pause")).toBe(true);
    expect(disabled("Step back")).toBe(false);
    await button("Step back").trigger("click");
    expect(line()).not.toBeNull();
    await wrapper.get("#inputs").setValue("4, 5");
    expect(line()).toBeNull();
  });
  it("labels variables and hides inputs while running, then restores them on pause", async () => {
    vi.useFakeTimers();
    start();
    const labels = () =>
      wrapper.findAll(".variable-label").map((label) => label.text());
    expect(labels()).toEqual(["output", "input", "input"]);
    expect(wrapper.find("#inputs").exists()).toBe(true);
    await button("Run").trigger("click");
    expect(labels()).toEqual(["output"]);
    expect(wrapper.find("#inputs").exists()).toBe(false);
    await button("Pause").trigger("click");
    expect(labels()).toEqual(["output", "input", "input"]);
    expect(wrapper.find("#inputs").exists()).toBe(true);
  });
  it("resets memory, highlighting and history while stopping the timer", async () => {
    vi.useFakeTimers();
    start();
    await wrapper.get("#speed").setValue("10");
    await wrapper.get("#maximum-steps").setValue("20");
    await button("Run").trigger("click");
    await vi.advanceTimersByTimeAsync(100);
    expect(value()).toBe("3");
    expect(value("x3")).toBe("5");
    await button("Reset").trigger("click");
    expect(value()).toBe("0");
    expect(value("x3")).toBe("0");
    expect(value("x1")).toBe("3");
    expect(wrapper.findComponent(CodeEditor).props("activeLine")).toBeNull();
    expect(button("Step back").attributes("disabled")).toBeDefined();
    expect(wrapper.find("#inputs").exists()).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(value()).toBe("0");
    expect(wrapper.get('[data-testid="speed-value"]').text()).toBe(
      "10 steps/s",
    );
    expect(
      (wrapper.get("#maximum-steps").element as HTMLInputElement).value,
    ).toBe("20");
  });
  it("steps forward and back with matching memory and highlighting", async () => {
    start();
    expect(value("x1")).toBe("3");
    await button("Step").trigger("click");
    expect(value()).toBe("3");
    expect(wrapper.findComponent(CodeEditor).props("activeLine")).toBe(3);
    await button("Step back").trigger("click");
    expect(value()).toBe("0");
    expect(wrapper.findComponent(CodeEditor).props("activeLine")).toBe(2);
  });
  it("runs to completion and restarts on Run", async () => {
    vi.useFakeTimers();
    start();
    await button("Run").trigger("click");
    await vi.runAllTimersAsync();
    expect(value()).toBe("8");
    expect(button("Step").attributes("disabled")).toBeDefined();
    await button("Run").trigger("click");
    expect(value()).toBe("3");
    await vi.runAllTimersAsync();
    expect(value()).toBe("8");
  });
  it("pauses without executing further steps", async () => {
    vi.useFakeTimers();
    start();
    await button("Run").trigger("click");
    await button("Pause").trigger("click");
    const memory = wrapper.get("table").text();
    await vi.advanceTimersByTimeAsync(2000);
    expect(wrapper.get("table").text()).toBe(memory);
  });
  it("changing inputs resets execution and updates memory", async () => {
    start();
    await button("Step").trigger("click");
    await wrapper.get("#inputs").setValue("7, 9");
    expect(value("x1")).toBe("7");
    expect(value()).toBe("0");
    expect(button("Step back").attributes("disabled")).toBeDefined();
  });
  it("reports syntax errors and blocks execution", async () => {
    start();
    await wrapper.get("textarea").setValue("x0 := 5");
    expect(wrapper.get('[role="alert"]').text()).toContain("Line 1");
    expect(button("Step").attributes("disabled")).toBeDefined();
  });
  it("reports invalid inputs and recovers after correction", async () => {
    start();
    await wrapper.get("#inputs").setValue("-3");
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    await wrapper.get("#inputs").setValue("3");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
  it("defaults to 10,000 maximum steps and enforces a custom cap during Run", async () => {
    vi.useFakeTimers();
    start();
    expect(
      (wrapper.get("#maximum-steps").element as HTMLInputElement).value,
    ).toBe("10000");
    await wrapper.get("textarea").setValue("while x1 do x0 := x0 + 1 end");
    await wrapper.get("#maximum-steps").setValue("4");
    await button("Run").trigger("click");
    await vi.runAllTimersAsync();
    expect(value()).toBe("2");
    expect(button("Step").attributes("disabled")).toBeDefined();
    expect(button("Run").attributes("disabled")).toBeDefined();
    await wrapper.get("#maximum-steps").setValue("6");
    await button("Run").trigger("click");
    await vi.runAllTimersAsync();
    expect(value()).toBe("3");
    await button("Step back").trigger("click");
    expect(value()).toBe("2");
    await button("Step").trigger("click");
    expect(value()).toBe("3");
  });
  it("enforces the same cap for manual steps", async () => {
    start();
    await wrapper.get("#maximum-steps").setValue("1");
    await button("Step").trigger("click");
    expect(value()).toBe("3");
    expect(button("Step").attributes("disabled")).toBeDefined();
    await button("Step back").trigger("click");
    expect(button("Step").attributes("disabled")).toBeUndefined();
  });
  it.each(["", "0", "-1", "1.5"])(
    "blocks execution for invalid step limit %s",
    async (limit) => {
      start();
      await wrapper.get("#maximum-steps").setValue(limit);
      expect(button("Run").attributes("disabled")).toBeDefined();
      expect(wrapper.get("#maximum-steps").attributes("aria-invalid")).toBe(
        "true",
      );
    },
  );
  it("uses the run speed slider for subsequent steps", async () => {
    vi.useFakeTimers();
    start();
    await wrapper.get("#speed").setValue("10");
    expect(wrapper.get('[data-testid="speed-value"]').text()).toBe(
      "10 steps/s",
    );
    await button("Run").trigger("click");
    await vi.advanceTimersByTimeAsync(99);
    expect(value("x3")).toBe("0");
    await vi.advanceTimersByTimeAsync(1);
    expect(value("x3")).toBe("5");
  });
});
