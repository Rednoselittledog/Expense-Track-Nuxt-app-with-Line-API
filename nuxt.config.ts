import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' }
      ],
      script: [
        {
          key: 'palette-init',
          innerHTML: "try{var p=localStorage.getItem('palette');if(p)document.documentElement.dataset.palette=p}catch(e){}"
        }
      ]
    }
  },
  css: ['~/assets/css/tailwind.css'],
  modules: ['@nuxtjs/color-mode', '@nuxtjs/i18n'],
  components: {
    dirs: [
      {
        path: '~/components',
        ignore: ['**/ui/**']
      }
    ]
  },
  colorMode: {
    classSuffix: ''
  },
  i18n: {
    langDir: 'locales',
    lazy: true,
    defaultLocale: 'th',
    locales: [
      { code: 'th', name: 'ไทย', file: 'th.json' },
      { code: 'en', name: 'English', file: 'en.json' }
    ]
  },
  runtimeConfig: {
    groqApiKey: process.env.GROQ_API,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
})
