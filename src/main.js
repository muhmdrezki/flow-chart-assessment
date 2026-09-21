import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import { createAppRouter } from './router'
import { queryClientConfig } from './config/queryClient'
import './assets/main.css'

createApp(App)
  .use(createPinia())
  .use(createAppRouter())
  .use(VueQueryPlugin, { queryClientConfig })
  .mount('#app')
