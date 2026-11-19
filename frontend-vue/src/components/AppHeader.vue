<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import router from '../router'
import { useAuthStore } from '../store/authStore'

const auth = useAuthStore()
const route = useRoute()
const menuAberto = ref(false)

// Itens da navegação da área logada
const links = [
  { to: '/dashboard', rotulo: 'Dashboard' },
  { to: '/uploads', rotulo: 'Upload' },
  { to: '/historico', rotulo: 'Histórico' },
  { to: '/insights', rotulo: 'Insights' },
  { to: '/perfil', rotulo: 'Perfil' },
]

// Fecha o menu mobile ao trocar de página
watch(() => route.path, () => (menuAberto.value = false))

function sair() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-50 bg-palette-offwhite/90 backdrop-blur">
    <div class="flex items-center justify-between gap-3 h-18 px-page">
      <!-- Logo (ícone) -->
      <RouterLink to="/dashboard" aria-label="Ir para o Dashboard" class="flex-shrink-0">
        <svg class="h-9 w-auto" viewBox="0 0 34 36" aria-hidden="true">
          <rect x="0" y="22" width="8" height="14" fill="#82bfa0" />
          <rect x="13" y="12" width="8" height="24" fill="#5f9c7d" />
          <rect x="26" y="0" width="8" height="36" fill="#3f5f5a" />
        </svg>
      </RouterLink>

      <!-- Navegação em pílula (tablet/desktop) -->
      <nav class="hidden md:flex items-center gap-1 p-1 bg-white rounded-full shadow-[0_4px_14px_rgba(38,53,31,0.12)]">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to"
          class="px-3 lg:px-5 py-2 rounded-full text-sm lg:text-base font-medium text-palette-chumbo whitespace-nowrap hover:text-palette-mid-green transition-colors duration-300"
          active-class="!bg-palette-mid-green !text-white shadow-sm">
          {{ link.rotulo }}
        </RouterLink>
      </nav>

      <div class="flex items-center gap-2">
        <!-- Botão Sair -->
        <button type="button" @click="sair" aria-label="Sair"
          class="flex-shrink-0 flex items-center gap-2 px-3 sm:px-5 py-2.5 bg-white rounded-full shadow-[0_4px_14px_rgba(38,53,31,0.12)] text-palette-chumbo font-medium hover:text-red-500 transition-colors duration-300">
          <span class="hidden lg:inline">Sair</span>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H3" />
          </svg>
        </button>

        <!-- Botão do menu (celular) -->
        <button type="button" class="md:hidden p-2.5 bg-white rounded-full shadow-[0_4px_14px_rgba(38,53,31,0.12)] text-palette-chumbo"
          :aria-expanded="menuAberto" aria-controls="menu-mobile" aria-label="Abrir menu" @click="menuAberto = !menuAberto">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path v-if="!menuAberto" stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
            <path v-else stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Menu mobile -->
    <nav v-show="menuAberto" id="menu-mobile" class="md:hidden px-page pb-4">
      <div class="flex flex-col bg-white rounded-2xl shadow-[0_10px_30px_rgba(38,53,31,0.12)] p-2">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to"
          class="px-4 py-3 rounded-xl font-medium text-palette-chumbo hover:bg-palette-offwhite"
          active-class="!bg-palette-mid-green !text-white">
          {{ link.rotulo }}
        </RouterLink>
      </div>
    </nav>
  </header>
</template>
