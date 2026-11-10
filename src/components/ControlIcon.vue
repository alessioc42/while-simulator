<script setup lang="ts">
defineProps<{
  name: "run" | "pause" | "step" | "back" | "reset" | "sun" | "moon";
}>();
const paths = {
  run: "M6 3 21 12 6 21Z",
  pause: "M8 4v16M16 4v16",
  step: "M18 4v16M4 4l12 8-12 8Z",
  back: "M6 4v16M20 4 8 12l12 8Z",
  moon: "M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  reset: "M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6",
};
</script>

<template>
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="paths[name]" />
  </svg>
</template>
