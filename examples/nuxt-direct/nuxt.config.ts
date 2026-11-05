import avatarBotNuxtModule from '@ai-avatar-bot/sdk/nuxt';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  css: [
    '@ai-avatar-bot/sdk/style.css'
  ],
  modules: [
    avatarBotNuxtModule
  ]
});
