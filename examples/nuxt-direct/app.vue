<script setup lang="ts">
// Nuxt 3 Root App with ClientOnly SSR guard
</script>

<template>
  <div class="nuxt-example-layout">
    <header class="nuxt-example-layout__header">
      <h1 class="nuxt-example-layout__title">AI Avatar Bot - Nuxt 3 Direct Example</h1>
      <p class="nuxt-example-layout__subtitle">
        Nuxt 3 Nitro Module Integration & ClientOnly SSR Protection
      </p>
    </header>

    <main class="nuxt-example-layout__main">
      <ClientOnly>
        <AvatarBotDirect />
        <template #fallback>
          <div class="nuxt-example-layout__loading">
            Loading AI Avatar Bot inside Nuxt 3 ClientOnly...
          </div>
        </template>
      </ClientOnly>
    </main>
  </div>
</template>

<style>
:root {
  --bg-gradient-start: #0f172a;
  --bg-gradient-end: #1e1b4b;
  --panel-bg: rgba(30, 41, 59, 0.7);
  --panel-border: rgba(255, 255, 255, 0.1);
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --accent-cyan: #38bdf8;
  --accent-blue: #6366f1;
  --accent-purple: #a855f7;
  --status-ready: #22c55e;
  --status-loading: #eab308;
  --status-error: #ef4444;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: radial-gradient(circle at top right, var(--bg-gradient-end), var(--bg-gradient-start));
  color: var(--text-primary);
  min-height: 100vh;
  overflow-x: hidden;
}

.nuxt-example-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
  gap: 2rem;
}

.nuxt-example-layout__header {
  text-align: center;
}

.nuxt-example-layout__title {
  font-size: 2.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}

.nuxt-example-layout__subtitle {
  color: var(--text-secondary);
  font-size: 1rem;
}

.nuxt-example-layout__main {
  width: 100%;
}

.nuxt-example-layout__loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
  background: var(--panel-bg);
  border-radius: 1rem;
  border: 1px solid var(--panel-border);
}
</style>
