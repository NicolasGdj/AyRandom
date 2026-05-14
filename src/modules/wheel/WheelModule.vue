<script setup>
import { computed, ref } from 'vue';

const choicesText = ref('');
const rotation = ref(0);
const selectedIndex = ref(null);
const isSpinning = ref(false);
const wheelStage = ref(null);

const colors = ['#2f6fed', '#ef476f', '#06a77d', '#ffb703', '#7c3aed', '#f97316', '#0891b2', '#84cc16'];
const wheelSize = 520;
const wheelCenter = wheelSize / 2;
const wheelRadius = 248;

const choices = computed(() =>
  choicesText.value
    .split('\n')
    .map((choice) => choice.trim())
    .filter(Boolean)
);

const selectedChoice = computed(() => {
  if (selectedIndex.value === null) {
    return '';
  }

  return choices.value[selectedIndex.value] ?? '';
});

const selectedColor = computed(() => {
  if (selectedIndex.value === null) {
    return '#d7dde8';
  }

  return colors[selectedIndex.value % colors.length];
});

const canSpin = computed(() => choices.value.length >= 2 && !isSpinning.value);

const polarPoint = (angle, radius = wheelRadius) => {
  const radians = (angle * Math.PI) / 180;
  return {
    x: wheelCenter + radius * Math.cos(radians),
    y: wheelCenter + radius * Math.sin(radians)
  };
};

const slicePath = (index) => {
  const angle = 360 / choices.value.length;
  const startAngle = -90 + index * angle;
  const endAngle = startAngle + angle;
  const start = polarPoint(startAngle);
  const end = polarPoint(endAngle);
  const largeArc = angle > 180 ? 1 : 0;

  return `M ${wheelCenter} ${wheelCenter} L ${start.x} ${start.y} A ${wheelRadius} ${wheelRadius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
};

const labelPosition = (index) => {
  const angle = 360 / choices.value.length;
  const midpoint = -90 + index * angle + angle / 2;
  const point = polarPoint(midpoint, wheelRadius * 0.66);
  return {
    x: point.x,
    y: point.y,
    rotation: midpoint + 90
  };
};

const spinWheel = () => {
  if (!canSpin.value) {
    return;
  }

  wheelStage.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const total = choices.value.length;
  const winnerIndex = Math.floor(Math.random() * total);
  const sliceAngle = 360 / total;
  const sliceCenter = -90 + winnerIndex * sliceAngle + sliceAngle / 2;
  const currentRotation = ((rotation.value % 360) + 360) % 360;
  const fullTurns = 6 + Math.floor(Math.random() * 3);
  const finalOffset = (-90 - sliceCenter - currentRotation + 360) % 360;

  selectedIndex.value = null;
  isSpinning.value = true;
  rotation.value += fullTurns * 360 + finalOffset;

  window.setTimeout(() => {
    selectedIndex.value = winnerIndex;
    isSpinning.value = false;
  }, 4200);
};
</script>

<template>
  <article class="module-layout wheel-module">
    <header class="module-header compact-header">
      <p class="eyebrow">Decision wheel</p>
      <h2 id="wheel-title">Spin one clear result</h2>
    </header>

    <div class="wheel-page-grid">
      <section class="control-panel" aria-label="Wheel choices">
        <label for="wheel-choices">Choices</label>
        <textarea
          id="wheel-choices"
          v-model="choicesText"
          rows="9"
          spellcheck="false"
          placeholder="One choice per line"
        />
        <div class="control-row">
          <span>{{ choices.length }} choices</span>
          <button class="primary-button" type="button" :disabled="!canSpin" @click="spinWheel">
            {{ isSpinning ? 'Spinning...' : 'Spin wheel' }}
          </button>
        </div>
      </section>

      <section ref="wheelStage" class="wheel-stage" aria-live="polite">
        <div class="wheel-pointer" aria-hidden="true"></div>

        <div class="wheel-shell">
          <svg
            class="wheel-svg"
            :class="{ spinning: isSpinning }"
            :viewBox="`0 0 ${wheelSize} ${wheelSize}`"
            :style="{ transform: `rotate(${rotation}deg)` }"
            role="img"
            aria-label="Decision wheel"
          >
            <g>
              <path
                v-for="(choice, index) in choices"
                :key="`${choice}-${index}`"
                class="wheel-slice"
                :class="{ selected: selectedIndex === index }"
                :d="slicePath(index)"
                :fill="colors[index % colors.length]"
                stroke="#ffffff"
                stroke-width="4"
              />
            </g>
            <g>
              <text
                v-for="(choice, index) in choices"
                :key="`${choice}-${index}-label`"
                class="wheel-text"
                :x="labelPosition(index).x"
                :y="labelPosition(index).y"
                :transform="`rotate(${labelPosition(index).rotation} ${labelPosition(index).x} ${labelPosition(index).y})`"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                {{ choice }}
              </text>
            </g>
          </svg>
        </div>

        <div class="wheel-center" aria-hidden="true"></div>

        <div class="wheel-result" :class="{ visible: selectedChoice }">
          <span class="result-swatch" :style="{ background: selectedColor }"></span>
          <p class="result">
            <span>Selected</span>
            <strong>{{ selectedChoice || 'Waiting for the spin' }}</strong>
          </p>
        </div>
      </section>

      <section class="choice-legend" aria-label="Wheel color legend">
        <div
          v-for="(choice, index) in choices"
          :key="`${choice}-${index}-legend`"
          class="legend-item"
          :class="{ selected: selectedIndex === index }"
        >
          <span :style="{ background: colors[index % colors.length] }"></span>
          <strong>{{ choice }}</strong>
        </div>
      </section>
    </div>
  </article>
</template>
