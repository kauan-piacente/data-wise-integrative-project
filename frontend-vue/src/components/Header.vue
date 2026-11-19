<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const menuAberto = ref(false)
watch(() => route.fullPath, () => (menuAberto.value = false))

const FEATURES_HASH = '#funcionalidades'
const HEADER_HEIGHT = 72

const linkClass = 'hover:text-palette-mid-green transition-colors pb-1'
const activeClass = 'border-b-2 border-palette-mid-green text-palette-mid-green'

// Home e Funcionalidades ficam na mesma rota ("/"), então o estado ativo é decidido pelo hash
const isHomeActive = computed(() => route.path === '/' && route.hash !== FEATURES_HASH)
const isFeaturesActive = computed(() => route.path === '/' && route.hash === FEATURES_HASH)

// Se a URL já tiver o hash, o router não navega de novo: rola manualmente até a section
function scrollToFeatures(event) {
  if (!isFeaturesActive.value) return
  const section = document.querySelector(FEATURES_HASH)
  if (!section) return
  event.preventDefault()
  const top = section.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT
  window.scrollTo({ top, behavior: 'smooth' })
}
</script>

<template>
  <header class="sticky top-0 z-50 flex flex-wrap justify-between items-center min-h-18 px-page bg-[#fff] border-[#fff] shadow-[0_10px_30px_rgba(38,53,31,0.09)]">

    <!-- Logo -->
    <RouterLink to="/" class="flex-shrink-0">
      <img src="../assets/Logo/Logo-white.png" alt="Logo DataWise" class="h-7 w-auto">
    </RouterLink>

    <!-- Navegação Central -->
    <nav class="hidden md:flex space-x-12 text-black font-medium">
      <RouterLink
        to="/"
        :class="[linkClass, isHomeActive && 'border-b-2 border-palette-mid-green']"
        :aria-current="isHomeActive ? 'page' : undefined"
      >
        Home
      </RouterLink>

      <RouterLink
        :to="{ path: '/', hash: FEATURES_HASH }"
        :class="[linkClass, isFeaturesActive && activeClass]"
        :aria-current="isFeaturesActive ? 'location' : undefined"
        @click="scrollToFeatures"
      >
        Funcionalidades
      </RouterLink>

      <RouterLink
        to="/contact"
        :class="linkClass"
        :exact-active-class="activeClass"
      >
        Contato
      </RouterLink>
    </nav>

    <!-- Botão de Login -->
    <RouterLink
      to="/login"
      class="ml-auto md:ml-0 mr-3 md:mr-0 text-sm sm:text-base bg-palette-mid-green text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-[#6ba88a] transition-colors duration-300 shadow-sm"
    >
      Acessar Sistema
    </RouterLink>

    <!-- Menu mobile -->
    <button type="button" class="md:hidden p-2 -mr-2 text-palette-chumbo" :aria-expanded="menuAberto" aria-label="Abrir menu" @click="menuAberto = !menuAberto">
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path v-if="!menuAberto" stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
        <path v-else stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
    <nav v-show="menuAberto" class="md:hidden basis-full flex flex-col pb-4 font-medium text-black">
      <RouterLink to="/" class="py-3 border-b border-gray-100">Home</RouterLink>
      <RouterLink :to="{ path: '/', hash: FEATURES_HASH }" class="py-3 border-b border-gray-100" @click="scrollToFeatures">Funcionalidades</RouterLink>
      <RouterLink to="/contact" class="py-3">Contato</RouterLink>
    </nav>

  </header>
</template>