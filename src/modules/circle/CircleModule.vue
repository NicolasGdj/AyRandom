<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const emit = defineEmits(['back-to-menu']);

const activePointers = ref([]);
const winnerId = ref(null);
const countdownStarted = ref(false);
const countdownValue = ref(3);
const selectionLocked = ref(false);
const canRestartAfterRelease = ref(false);
const isFullscreen = ref(false);
const isDesktop = ref(false);
const touchSurface = ref(null);
const gradientCanvas = ref(null);
let selectionTimer = null;
let countdownTimer = null;
let gradientFrame = null;
let gradientDrawPending = false;
let gradientTimeout = null;
let lastGradientDraw = 0;
let simulatedId = 1;
let desktopQuery = null;

const playerColors = ['#2f6fed', '#ef4444', '#ffb703', '#06a77d', '#7c3aed'];
const maxPlayers = 5;
const selectionDelay = 3000;

const pointerCount = computed(() => activePointers.value.length);
const colorForPlayer = (index, total) => {
  const palette = playerColors.slice(0, Math.min(total, maxPlayers));
  return palette[index % palette.length];
};
const coloredPointers = computed(() =>
  activePointers.value.map((pointer, index) => ({
    ...pointer,
    color: colorForPlayer(index, activePointers.value.length)
  }))
);
const winner = computed(() => coloredPointers.value.find((pointer) => pointer.id === winnerId.value));
const visiblePointers = computed(() => {
  if (winnerId.value === null) {
    return coloredPointers.value;
  }

  return coloredPointers.value.filter((pointer) => pointer.id === winnerId.value);
});
const statusText = computed(() => {
  if (winnerId.value !== null) {
    return canRestartAfterRelease.value ? 'Touch again to restart' : 'Winner selected';
  }

  if (pointerCount.value >= maxPlayers) {
    return countdownStarted.value ? 'Choosing after 3 stable seconds' : 'Maximum players reached';
  }

  if (pointerCount.value > 1) {
    return countdownStarted.value ? 'Choosing after 3 stable seconds' : 'Multiple fingers detected';
  }

  if (pointerCount.value === 1) {
    return 'Hold another finger to start';
  }

  return 'Touch the surface';
});

const hexToRgb = (hex) => {
  const value = hex.replace('#', '');
  const number = Number.parseInt(value, 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
};

const smoothstep = (edge0, edge1, value) => {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return x * x * (3 - 2 * x);
};

const blurImageData = (data, width, height, radius) => {
  const temp = new Uint8ClampedArray(data.length);
  const windowSize = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    let red = 0;
    let green = 0;
    let blue = 0;

    for (let offset = -radius; offset <= radius; offset += 1) {
      const sampleX = Math.min(Math.max(offset, 0), width - 1);
      const index = (y * width + sampleX) * 4;
      red += data[index];
      green += data[index + 1];
      blue += data[index + 2];
    }

    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      temp[index] = Math.round(red / windowSize);
      temp[index + 1] = Math.round(green / windowSize);
      temp[index + 2] = Math.round(blue / windowSize);
      temp[index + 3] = 255;

      const removedX = Math.min(Math.max(x - radius, 0), width - 1);
      const addedX = Math.min(Math.max(x + radius + 1, 0), width - 1);
      const removedIndex = (y * width + removedX) * 4;
      const addedIndex = (y * width + addedX) * 4;
      red += data[addedIndex] - data[removedIndex];
      green += data[addedIndex + 1] - data[removedIndex + 1];
      blue += data[addedIndex + 2] - data[removedIndex + 2];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let red = 0;
    let green = 0;
    let blue = 0;

    for (let offset = -radius; offset <= radius; offset += 1) {
      const sampleY = Math.min(Math.max(offset, 0), height - 1);
      const index = (sampleY * width + x) * 4;
      red += temp[index];
      green += temp[index + 1];
      blue += temp[index + 2];
    }

    for (let y = 0; y < height; y += 1) {
      const index = (y * width + x) * 4;
      data[index] = Math.round(red / windowSize);
      data[index + 1] = Math.round(green / windowSize);
      data[index + 2] = Math.round(blue / windowSize);
      data[index + 3] = 255;

      const removedY = Math.min(Math.max(y - radius, 0), height - 1);
      const addedY = Math.min(Math.max(y + radius + 1, 0), height - 1);
      const removedIndex = (removedY * width + x) * 4;
      const addedIndex = (addedY * width + x) * 4;
      red += temp[addedIndex] - temp[removedIndex];
      green += temp[addedIndex + 1] - temp[removedIndex + 1];
      blue += temp[addedIndex + 2] - temp[removedIndex + 2];
    }
  }
};

const drawGradientField = () => {
  const canvas = gradientCanvas.value;
  const surface = touchSurface.value;
  if (!canvas || !surface || coloredPointers.value.length <= 1 || winner.value) {
    return;
  }

  const bounds = surface.getBoundingClientRect();
  const width = Math.min(520, Math.max(170, Math.round(bounds.width * 0.28)));
  const height = Math.min(320, Math.max(110, Math.round(bounds.height * 0.28)));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  const points = coloredPointers.value.map((pointer) => {
    const [red, green, blue] = hexToRgb(pointer.color);
    return {
      blue,
      green,
      red,
      x: (pointer.x / bounds.width) * width,
      y: (pointer.y / bounds.height) * height
    };
  });
  const image = context.createImageData(width, height);
  const blurRadius = Math.max(18, Math.round(Math.min(width, height) * 0.14));
  const anchorRadius = Math.max(12, Math.min(width, height) * 0.045);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let nearest = points[0];
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const point of points) {
        const distance = Math.hypot(x - point.x, y - point.y);
        if (distance < nearestDistance) {
          nearest = point;
          nearestDistance = distance;
        }
      }

      const index = (y * width + x) * 4;
      image.data[index] = nearest.red;
      image.data[index + 1] = nearest.green;
      image.data[index + 2] = nearest.blue;
      image.data[index + 3] = 255;
    }
  }

  blurImageData(image.data, width, height, blurRadius);
  blurImageData(image.data, width, height, Math.max(8, Math.round(blurRadius * 0.45)));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (const point of points) {
        const distance = Math.hypot(x - point.x, y - point.y);
        if (distance <= anchorRadius) {
          const strength = 1 - smoothstep(0, anchorRadius, distance);
          const index = (y * width + x) * 4;
          image.data[index] = Math.round(image.data[index] * (1 - strength) + point.red * strength);
          image.data[index + 1] = Math.round(image.data[index + 1] * (1 - strength) + point.green * strength);
          image.data[index + 2] = Math.round(image.data[index + 2] * (1 - strength) + point.blue * strength);
        }
      }
    }
  }

  context.putImageData(image, 0, 0);
};

const scheduleGradientDraw = () => {
  if (gradientDrawPending) {
    return;
  }

  gradientDrawPending = true;
  nextTick(() => {
    if (gradientFrame) {
      window.cancelAnimationFrame(gradientFrame);
    }

    gradientFrame = window.requestAnimationFrame(() => {
      const now = performance.now();
      const elapsed = now - lastGradientDraw;
      if (elapsed < 34) {
        gradientTimeout = window.setTimeout(() => {
          gradientDrawPending = false;
          gradientTimeout = null;
          scheduleGradientDraw();
        }, 34 - elapsed);
        gradientFrame = null;
        return;
      }

      gradientDrawPending = false;
      gradientFrame = null;
      lastGradientDraw = now;
      drawGradientField();
    });
  });
};

const updatePointer = (event) => {
  const target = event.currentTarget.getBoundingClientRect();
  const existingIndex = activePointers.value.findIndex((item) => item.id === event.pointerId);
  if (existingIndex < 0 && activePointers.value.length >= maxPlayers) {
    return;
  }

  const pointer = {
    id: event.pointerId,
    x: event.clientX - target.left,
    y: event.clientY - target.top,
    simulated: false
  };

  if (existingIndex >= 0) {
    activePointers.value.splice(existingIndex, 1, pointer);
  } else {
    activePointers.value.push(pointer);
  }
};

const clearSelectionTimer = () => {
  if (selectionTimer) {
    window.clearTimeout(selectionTimer);
    selectionTimer = null;
  }
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdownStarted.value = false;
  countdownValue.value = 3;
};

const scheduleSelection = () => {
  clearSelectionTimer();

  if (activePointers.value.length <= 1 || selectionLocked.value) {
    return;
  }

  countdownStarted.value = true;
  countdownValue.value = Math.ceil(selectionDelay / 1000);
  const countdownStartedAt = performance.now();
  countdownTimer = window.setInterval(() => {
    const remaining = selectionDelay - (performance.now() - countdownStartedAt);
    countdownValue.value = Math.max(1, Math.ceil(remaining / 1000));
  }, 100);
  selectionTimer = window.setTimeout(() => {
    if (activePointers.value.length > 1) {
      const winner = activePointers.value[Math.floor(Math.random() * activePointers.value.length)];
      winnerId.value = winner.id;
      selectionLocked.value = true;
    }
    if (countdownTimer) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
    countdownStarted.value = false;
  }, selectionDelay);
};

const unlockSelection = () => {
  winnerId.value = null;
  selectionLocked.value = false;
  canRestartAfterRelease.value = false;
};

const handlePointerDown = (event) => {
  event.currentTarget.setPointerCapture(event.pointerId);
  if (selectionLocked.value && !canRestartAfterRelease.value) {
    return;
  }

  if (selectionLocked.value) {
    unlockSelection();
  }

  updatePointer(event);
  scheduleSelection();
};

const handlePointerMove = (event) => {
  if (selectionLocked.value) {
    return;
  }

  updatePointer(event);
};

const removePointer = (event) => {
  activePointers.value = activePointers.value.filter((pointer) => pointer.id !== event.pointerId);
  if (selectionLocked.value) {
    canRestartAfterRelease.value = true;
  }

  if (activePointers.value.length <= 1) {
    clearSelectionTimer();
  } else {
    scheduleSelection();
  }
};

const addTestTouch = () => {
  const bounds = touchSurface.value?.getBoundingClientRect();
  if (
    !bounds ||
    !isDesktop.value ||
    activePointers.value.length >= maxPlayers ||
    (selectionLocked.value && !canRestartAfterRelease.value)
  ) {
    return;
  }

  if (selectionLocked.value) {
    unlockSelection();
  }

  const margin = 110;
  const width = Math.max(bounds.width - margin * 2, 1);
  const height = Math.max(bounds.height - margin * 2, 1);
  activePointers.value.push({
    id: `test-${simulatedId}`,
    x: margin + Math.random() * width,
    y: margin + Math.random() * height,
    simulated: true
  });
  simulatedId += 1;
  scheduleSelection();
};

const clearTestTouches = () => {
  const hadSimulatedTouch = activePointers.value.some((pointer) => pointer.simulated);
  activePointers.value = activePointers.value.filter((pointer) => !pointer.simulated);
  if (selectionLocked.value && hadSimulatedTouch) {
    canRestartAfterRelease.value = true;
  }

  if (activePointers.value.length <= 1) {
    clearSelectionTimer();
  } else {
    scheduleSelection();
  }
};

const resetSurface = () => {
  activePointers.value = [];
  unlockSelection();
  clearSelectionTimer();
};

const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    await touchSurface.value?.requestFullscreen();
    return;
  }

  await document.exitFullscreen();
};

const syncFullscreen = () => {
  isFullscreen.value = document.fullscreenElement === touchSurface.value;
  scheduleGradientDraw();
};

const syncDesktopMode = () => {
  isDesktop.value = Boolean(desktopQuery?.matches);
};

onMounted(() => {
  desktopQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  syncDesktopMode();
  desktopQuery.addEventListener('change', syncDesktopMode);
  document.addEventListener('fullscreenchange', syncFullscreen);
  window.addEventListener('resize', scheduleGradientDraw);
});

onBeforeUnmount(() => {
  clearSelectionTimer();
  if (gradientFrame) {
    window.cancelAnimationFrame(gradientFrame);
  }
  if (gradientTimeout) {
    window.clearTimeout(gradientTimeout);
  }
  gradientDrawPending = false;
  desktopQuery?.removeEventListener('change', syncDesktopMode);
  document.removeEventListener('fullscreenchange', syncFullscreen);
  window.removeEventListener('resize', scheduleGradientDraw);
});

watch(coloredPointers, scheduleGradientDraw, { deep: true });
watch(winner, scheduleGradientDraw);
</script>

<template>
  <article class="module-layout circle-module">
    <header class="module-header compact-header">
      <p class="eyebrow">Finger picker</p>
      <h2 id="circle-title">Let one touch point win</h2>
    </header>

    <section class="circle-stage">
      <div class="circle-actions" aria-label="Circle actions">
        <button class="secondary-button" type="button" @click="toggleFullscreen">
          {{ isFullscreen ? 'Exit fullscreen' : 'Fullscreen' }}
        </button>
        <template v-if="isDesktop">
          <button class="secondary-button desktop-only-control" type="button" @click="addTestTouch">Add test touch</button>
          <button class="secondary-button desktop-only-control" type="button" @click="clearTestTouches">Clear test touches</button>
        </template>
        <button class="secondary-button" type="button" @click="resetSurface">Reset</button>
      </div>

      <div
        ref="touchSurface"
        class="touch-surface"
        :class="{ choosing: countdownStarted, locked: selectionLocked }"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="removePointer"
        @pointercancel="removePointer"
        @pointerleave="removePointer"
      >
        <button
          v-if="isFullscreen"
          class="surface-exit-button"
          type="button"
          @pointerdown.stop
          @click.stop="toggleFullscreen"
        >
          Exit fullscreen
        </button>

        <button
          class="surface-back-button"
          type="button"
          aria-label="Back to menu"
          @pointerdown.stop
          @pointermove.stop
          @click.stop="emit('back-to-menu')"
        />

        <canvas v-if="pointerCount > 1 && !winner" ref="gradientCanvas" class="gradient-canvas" aria-hidden="true"></canvas>

        <div class="surface-copy">
          <span>{{ statusText }}</span>
          <strong>{{ pointerCount }} active {{ pointerCount === 1 ? 'touch' : 'touches' }}</strong>
        </div>

        <div v-if="countdownStarted && !winner" class="countdown-display" aria-live="polite">
          <span :key="countdownValue">{{ countdownValue }}</span>
        </div>

        <div
          v-if="winner"
          class="winner-fill"
          :style="{
            '--winner-x': `${winner.x}px`,
            '--winner-y': `${winner.y}px`,
            '--winner-color': winner.color
          }"
        />

        <span
          v-for="pointer in visiblePointers"
          :key="pointer.id"
          class="finger-circle"
          :class="{
            winner: pointer.id === winnerId,
            simulated: pointer.simulated
          }"
          :style="{
            left: `${pointer.x}px`,
            top: `${pointer.y}px`
          }"
        />
      </div>
    </section>
  </article>
</template>
