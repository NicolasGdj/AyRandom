<script setup>
import { computed, ref } from 'vue';

const result = ref('');
const isFlipping = ref(false);
const flipCount = ref(0);

const coinFaces = {
  pile: {
    label: 'Pile',
    asset: '/assets/coin-pile-42.svg'
  },
  face: {
    label: 'Face',
    asset: '/assets/coin-face-orange-cat.svg'
  }
};

const activeFace = computed(() => (result.value === 'Face' ? coinFaces.face : coinFaces.pile));
const oppositeFace = computed(() => (activeFace.value.label === 'Face' ? coinFaces.pile : coinFaces.face));
const resultText = computed(() => result.value || 'Touchez la piece');

const flipCoin = () => {
  if (isFlipping.value) {
    return;
  }

  const nextResult = Math.random() < 0.5 ? 'Pile' : 'Face';

  result.value = '';
  isFlipping.value = true;
  flipCount.value += 1;

  window.setTimeout(() => {
    result.value = nextResult;
    isFlipping.value = false;
  }, 1500);
};
</script>

<template>
  <article class="module-layout coin-module">
    <header class="module-header compact-header">
      <p class="eyebrow">Pile ou face</p>
      <h2 id="coin-title">Touchez la piece</h2>
    </header>

    <section class="coin-stage" aria-live="polite">
      <button
        class="coin-touch-target"
        :class="{ flipping: isFlipping }"
        type="button"
        :disabled="isFlipping"
        :aria-label="isFlipping ? 'La piece tourne' : 'Lancer pile ou face'"
        @click="flipCoin"
      >
        <span
          class="coin-visual"
          :class="{ flipping: isFlipping }"
          :style="{ '--flip-run': flipCount }"
          aria-hidden="true"
        >
          <span class="coin-side coin-side-front">
            <img :src="activeFace.asset" alt="" draggable="false" />
          </span>
          <span class="coin-side coin-side-back">
            <img :src="oppositeFace.asset" alt="" draggable="false" />
          </span>
          <span class="coin-edge"></span>
        </span>
      </button>

      <div class="coin-result" :class="{ visible: result }">
        <span>Resultat</span>
        <strong>{{ isFlipping ? '...' : resultText }}</strong>
        <img v-if="result" :src="activeFace.asset" :alt="activeFace.label" />
      </div>
    </section>
  </article>
</template>
