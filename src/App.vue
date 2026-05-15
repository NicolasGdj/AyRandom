<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { modules } from './modules/registry';

const route = ref(window.location.hash.replace('#/', '') || 'menu');

const activeModule = computed(() => modules.find((module) => module.id === route.value));

const syncRoute = () => {
  route.value = window.location.hash.replace('#/', '') || 'menu';
};

const openModule = (moduleId) => {
  window.location.hash = `/${moduleId}`;
};

const openMenu = () => {
  window.location.hash = '/';
};

onMounted(() => {
  window.addEventListener('hashchange', syncRoute);
  syncRoute();
});

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncRoute);
});
</script>

<template>
  <main class="app-shell">
    <section v-if="!activeModule" class="menu-page" aria-labelledby="menu-title">
      <div class="brand-block menu-brand">
        <span class="brand-mark">AR</span>
        <div>
          <h1 id="menu-title">AyRandom</h1>
          <p>Simple decision tools</p>
        </div>
      </div>

      <nav class="module-menu" aria-label="Decision modules">
        <button
          v-for="module in modules"
          :key="module.id"
          class="module-card"
          type="button"
          @click="openModule(module.id)"
        >
          <span>{{ module.name }}</span>
          <small>{{ module.description }}</small>
        </button>
      </nav>
    </section>

    <section
      v-else
      class="module-page"
      :class="`${activeModule.id}-page`"
      :aria-labelledby="`${activeModule.id}-title`"
    >
      <button class="back-button" type="button" @click="openMenu">Back to menu</button>
      <component :is="activeModule.component" @back-to-menu="openMenu" />
    </section>
  </main>
</template>
