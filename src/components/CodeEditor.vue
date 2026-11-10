<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import {
  EditorView,
  Decoration,
  WidgetType,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  type DecorationSet,
} from "@codemirror/view";
import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { basicSetup } from "codemirror";
import {
  StreamLanguage,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
const props = defineProps<{
  modelValue: string;
  activeLine: number | null;
  annotation?: string | null;
  variableValues?: { position: number; variable: string; value: string }[];
  readOnly?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const host = ref<HTMLDivElement>();
let view: EditorView | undefined;
class ExecutionNote extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: ExecutionNote) {
    return this.text === other.text;
  }
  toDOM() {
    const note = document.createElement("span");
    note.className = "execution-annotation";
    note.textContent = this.text;
    note.contentEditable = "false";
    note.setAttribute("role", "note");
    note.setAttribute("aria-label", `Next instruction: ${this.text}`);
    note.title = "Next instruction evaluation (not code)";
    return note;
  }
}
class VariableNote extends ExecutionNote {
  constructor(
    readonly variable: string,
    text: string,
  ) {
    super(text);
  }
  eq(other: VariableNote) {
    return this.variable === other.variable && this.text === other.text;
  }
  toDOM() {
    const note = super.toDOM();
    note.className = "execution-annotation variable-value-annotation";
    note.dataset.variable = this.variable;
    note.setAttribute(
      "aria-label",
      `${this.variable} current value: ${this.text}`,
    );
    note.title = `Current value of ${this.variable} (not code)`;
    return note;
  }
}
const valuesEffect =
  StateEffect.define<NonNullable<typeof props.variableValues>>();
const values = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(previous, transaction) {
    let decorations = transaction.docChanged ? Decoration.none : previous;
    for (const effect of transaction.effects)
      if (effect.is(valuesEffect)) {
        decorations = Decoration.set(
          effect.value
            .filter((item) => item.position <= transaction.state.doc.length)
            .map((item) =>
              Decoration.widget({
                widget: new VariableNote(item.variable, item.value),
                side: -1,
              }).range(item.position),
            ),
          true,
        );
      }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});
const editability = new Compartment();
function editingExtensions() {
  return [
    EditorState.readOnly.of(!!props.readOnly),
    EditorView.editable.of(!props.readOnly),
    EditorView.contentAttributes.of({
      "aria-readonly": String(!!props.readOnly),
    }),
  ];
}
const activeEffect = StateEffect.define<{
  line: number | null;
  annotation: string | null;
}>();
const execution = StateField.define<{
  line: number | null;
  annotation: string | null;
  decorations: DecorationSet;
}>({
  create: () => ({
    line: null,
    annotation: null,
    decorations: Decoration.none,
  }),
  update(value, transaction) {
    let { line, annotation } = value;
    if (transaction.docChanged) {
      line = null;
      annotation = null;
    }
    for (const effect of transaction.effects) {
      if (effect.is(activeEffect)) ({ line, annotation } = effect.value);
    }
    const ranges = [];
    if (line && line <= transaction.state.doc.lines) {
      const current = transaction.state.doc.line(line);
      ranges.push(
        Decoration.line({
          class: "executing-line",
          attributes: { "data-executing": "true" },
        }).range(current.from),
      );
      if (annotation)
        ranges.push(
          Decoration.widget({
            widget: new ExecutionNote(annotation),
            side: 1,
          }).range(current.to),
        );
    }
    return { line, annotation, decorations: Decoration.set(ranges, true) };
  },
  provide: (field) =>
    EditorView.decorations.from(field, (value) => value.decorations),
});
const language = StreamLanguage.define({
  startState: () => ({ comment: false }),
  token(stream, state) {
    if (state.comment) {
      if (stream.skipTo("}")) {
        stream.next();
        state.comment = false;
      } else stream.skipToEnd();
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//") || stream.match("#")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.eat("{")) {
      state.comment = true;
      return "comment";
    }
    if (stream.match(/\b(while|do|end)\b/)) return "keyword";
    if (stream.match(/x\d+\b/)) return "variableName";
    if (stream.match(/\d+/)) return "number";
    if (stream.match(/:=|[+−-]/)) return "operator";
    stream.next();
    return null;
  },
});
onMounted(() => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        lineNumbers(),
        highlightActiveLineGutter(),
        language,
        execution,
        values,
        editability.of(editingExtensions()),
        syntaxHighlighting(
          HighlightStyle.define([
            {
              tag: tags.keyword,
              color: "var(--syntax-keyword)",
              fontWeight: "600",
            },
            { tag: tags.variableName, color: "var(--syntax-variable)" },
            { tag: tags.number, color: "var(--syntax-number)" },
            { tag: tags.operator, color: "var(--syntax-operator)" },
            {
              tag: tags.comment,
              color: "var(--syntax-comment)",
              fontStyle: "italic",
            },
          ]),
        ),
        EditorView.contentAttributes.of({
          "aria-label": "WHILE program editor",
          role: "textbox",
          tabindex: "0",
          spellcheck: "false",
        }),
        keymap.of([
          {
            key: "Tab",
            run(editor) {
              if (editor.state.readOnly) return false;
              editor.dispatch(editor.state.replaceSelection("  "));
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            emit("update:modelValue", update.state.doc.toString());
        }),
      ],
    }),
  });
  syncEditor();
});
function syncEditor() {
  if (!view) return;
  const effects: StateEffect<unknown>[] = [
    activeEffect.of({
      line: props.activeLine,
      annotation: props.annotation ?? null,
    }),
    valuesEffect.of(props.variableValues ?? []),
  ];
  if (view.state.readOnly !== !!props.readOnly)
    effects.push(editability.reconfigure(editingExtensions()));
  const changes =
    props.modelValue !== view.state.doc.toString()
      ? { from: 0, to: view.state.doc.length, insert: props.modelValue }
      : undefined;
  view.dispatch({ changes, effects });
  if (props.activeLine && props.activeLine <= view.state.doc.lines)
    view.dispatch({
      effects: EditorView.scrollIntoView(
        view.state.doc.line(props.activeLine).from,
        { y: "nearest" },
      ),
    });
}
watch(
  () => [
    props.modelValue,
    props.activeLine,
    props.annotation,
    props.variableValues,
    props.readOnly,
  ],
  syncEditor,
);
onBeforeUnmount(() => view?.destroy());
</script>
<template><div ref="host" class="code-editor" /></template>
