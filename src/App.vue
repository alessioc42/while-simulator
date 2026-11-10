<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import CodeEditor from "./components/CodeEditor.vue";
import ControlIcon from "./components/ControlIcon.vue";
import { compile, Machine, parseInputs, type Snapshot } from "./lib/while";
import { examples } from "./lib/examples";
import { readSharedProgram, sharedProgramHash } from "./lib/share";

const defaults = {
  code: examples[0]!.code,
  inputs: examples[0]!.inputs,
  maximumSteps: 10000,
};
const initialProgram = readSharedProgram(window.location.hash, defaults);
const code = ref(initialProgram.code);
const inputs = ref(initialProgram.inputs);
const machine = shallowRef<Machine | null>(null);
const revision = ref(0);
const error = ref("");
const phase = ref<"ready" | "running" | "paused" | "completed">("ready");
const running = computed(() => phase.value === "running");
const speed = ref(5);
const maximumSteps = ref<number | string>(initialProgram.maximumSteps);
const history = ref<Snapshot[]>([]);
const changed = ref<string | null>(null);
function initialDarkMode() {
  try {
    const saved = localStorage.getItem("while-theme");
    if (saved === "dark" || saved === "light") return saved === "dark";
  } catch {
    /* Theme still works when storage is unavailable. */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}
const darkMode = ref(initialDarkMode());
watch(
  darkMode,
  (dark) => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("while-theme", dark ? "dark" : "light");
    } catch {
      /* Storage is optional. */
    }
  },
  { immediate: true },
);
let timer: ReturnType<typeof setTimeout> | undefined;

const state = computed(() => {
  revision.value;
  const current = machine.value;
  return current
    ? { ...current.snapshot(), done: current.done, line: current.line }
    : null;
});
const variableValues = computed(() => {
  if (!state.value || !machine.value) return [];
  return machine.value.program.variableLocations.map((location) => ({
    ...location,
    value: (state.value!.memory[location.variable] ?? 0n).toString(),
  }));
});
const inputCount = computed(() => {
  try {
    return parseInputs(inputs.value).length;
  } catch {
    return 0;
  }
});
const activeLine = computed(() =>
  phase.value === "paused" || phase.value === "running"
    ? (state.value?.line ?? null)
    : null,
);
// Preview the assignment or condition at the highlighted instruction.
const executionAnnotation = computed(() => {
  if (activeLine.value === null || !machine.value || !state.value) return null;
  const instruction = machine.value.program.instructions[state.value.pc];
  if (instruction?.kind === "check") {
    const value = state.value.memory[instruction.variable] ?? 0n;
    return `${value} > 0 → ${value > 0n ? "true" : "false"}`;
  }
  if (instruction?.kind !== "assign") return null;
  const previous = state.value.memory[instruction.target] ?? 0n;
  const source = state.value.memory[instruction.source] ?? 0n;
  const value =
    source + (instruction.op === "+" ? instruction.value : -instruction.value);
  return `${instruction.target}: ${previous} → ${value < 0n ? 0n : value}`;
});
const memory = computed(() =>
  Object.entries(state.value?.memory ?? {}).sort(([a], [b]) =>
    BigInt(a.slice(1)) < BigInt(b.slice(1)) ? -1 : 1,
  ),
);
const validLimit = computed(
  () =>
    typeof maximumSteps.value === "number" &&
    Number.isSafeInteger(maximumSteps.value) &&
    maximumSteps.value > 0,
);
const atLimit = computed(
  () =>
    !validLimit.value ||
    (state.value?.steps ?? 0) >= Number(maximumSteps.value),
);
const canStep = computed(
  () => !!state.value && !state.value.done && !error.value && !atLimit.value,
);

function pause() {
  if (running.value) phase.value = "paused";
  clearTimeout(timer);
}
function reset() {
  pause();
  phase.value = "ready";
  history.value = [];
  changed.value = null;
  error.value = "";
  try {
    machine.value = new Machine(compile(code.value), parseInputs(inputs.value));
  } catch (e) {
    machine.value = null;
    error.value = (e as Error).message;
  }
  revision.value++;
}
function step() {
  if (!machine.value || !canStep.value) return;
  const snapshot = machine.value.snapshot();
  const result = machine.value.step();
  if (result) {
    history.value.push(snapshot);
    changed.value = result.changed;
  }
  revision.value++;
  if (machine.value.done) {
    pause();
    phase.value = "completed";
  } else if (!running.value || atLimit.value) {
    pause();
    phase.value = "paused";
  }
}
function tick() {
  if (!running.value) return;
  if (!canStep.value) {
    pause();
    return;
  }
  step();
  if (running.value) timer = setTimeout(tick, 1000 / speed.value);
}
function run() {
  if (running.value) return;
  if (state.value?.done) reset();
  if (!canStep.value) return;
  phase.value = "running";
  tick();
}
function back() {
  pause();
  const previous = history.value.pop();
  if (!previous || !machine.value) return;
  machine.value.restore(previous);
  phase.value = "paused";
  changed.value = null;
  revision.value++;
}
watch([code, inputs], reset);
watch(maximumSteps, () => {
  if (atLimit.value) pause();
});
let shareTimer: ReturnType<typeof setTimeout> | undefined;
function updateUrl() {
  const url = new URL(window.location.href);
  url.hash = sharedProgramHash({
    code: code.value,
    inputs: inputs.value,
    maximumSteps: maximumSteps.value,
  });
  if (url.href !== window.location.href)
    window.history.replaceState(window.history.state, "", url);
}
function restoreFromUrl() {
  clearTimeout(shareTimer);
  const program = readSharedProgram(window.location.hash, defaults);
  code.value = program.code;
  inputs.value = program.inputs;
  maximumSteps.value = program.maximumSteps;
  reset();
}
watch([code, inputs, maximumSteps], () => {
  clearTimeout(shareTimer);
  shareTimer = setTimeout(updateUrl, 150);
});
window.addEventListener("hashchange", restoreFromUrl);
window.addEventListener("popstate", restoreFromUrl);
reset();
updateUrl();
onBeforeUnmount(() => {
  pause();
  clearTimeout(shareTimer);
  window.removeEventListener("hashchange", restoreFromUrl);
  window.removeEventListener("popstate", restoreFromUrl);
});
</script>

<template>
  <div class="simulator">
    <header class="toolbar">
      <div class="toolbar-actions" role="group" aria-label="Execution controls">
        <button
          :disabled="
            running ||
            !!error ||
            !state ||
            !validLimit ||
            (atLimit && !state.done)
          "
          :aria-pressed="running"
          @click="run"
        >
          <ControlIcon name="run" />Run
        </button>
        <button
          :disabled="!running"
          :aria-pressed="phase === 'paused'"
          @click="pause"
        >
          <ControlIcon name="pause" />Pause
        </button>
        <button :disabled="phase === 'ready'" @click="reset">
          <ControlIcon name="reset" />Reset
        </button>
        <button :disabled="running || !history.length" @click="back">
          <ControlIcon name="back" />Step back
        </button>
        <button :disabled="running || !canStep" @click="step">
          <ControlIcon name="step" />Step
        </button>
      </div>
      <div class="toolbar-settings">
        <label class="speed-control" for="speed"
          >Run speed
          <input
            id="speed"
            v-model.number="speed"
            type="range"
            min="1"
            max="50"
            :aria-valuetext="`${speed} steps per second`"
            :title="`${speed} steps per second`"
          />
          <output for="speed" data-testid="speed-value"
            >{{ speed }} steps/s</output
          >
        </label>
        <label for="maximum-steps"
          >Maximum steps
          <input
            id="maximum-steps"
            v-model.number="maximumSteps"
            type="number"
            min="1"
            step="1"
            required
            :aria-invalid="!validLimit"
            :title="
              atLimit && validLimit
                ? 'Maximum steps reached; increase the limit to continue.'
                : undefined
            "
          />
        </label>
        <button
          class="theme-toggle"
          role="switch"
          aria-label="Dark mode"
          :aria-checked="darkMode"
          @click="darkMode = !darkMode"
        >
          <ControlIcon :name="darkMode ? 'sun' : 'moon'" />Dark mode
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="memory-pane" aria-label="Inputs and memory">
        <div v-if="!running" class="inputs">
          <label for="inputs">Inputs</label>
          <input
            id="inputs"
            v-model="inputs"
            placeholder="3, 5"
            autocomplete="off"
            spellcheck="false"
            aria-description="Natural numbers separated by commas. Values initialize x1, x2, and so on."
          />
        </div>
        <p v-if="error" class="error-message" role="alert">{{ error }}</p>
        <table aria-label="Memory">
          <thead>
            <tr>
              <th scope="col">Variable</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="[name, value] in memory"
              :key="changed === name ? `${name}:${revision}` : name"
              :class="{ changed: changed === name }"
            >
              <th scope="row">
                {{ name }}
                <span v-if="name === 'x0'" class="variable-label">output</span>
                <span
                  v-else-if="
                    !running && BigInt(name.slice(1)) <= BigInt(inputCount)
                  "
                  class="variable-label"
                  >input</span
                >
              </th>
              <td :data-testid="`value-${name}`">{{ value.toString() }}</td>
            </tr>
          </tbody>
        </table>
      </aside>
      <section class="editor-pane" aria-label="Program">
        <CodeEditor
          v-model="code"
          :active-line="activeLine"
          :annotation="executionAnnotation"
          :variable-values="variableValues"
          :read-only="phase !== 'ready'"
        />
      </section>
    </main>
  </div>
</template>
