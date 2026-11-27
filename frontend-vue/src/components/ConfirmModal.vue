<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  aberto: { type: Boolean, default: false },
  titulo: { type: String, required: true },
  mensagem: { type: String, required: true },
  textoConfirmar: { type: String, default: 'Confirmar' },
  textoCancelar: { type: String, default: 'Cancelar' },
  variante: { type: String, default: 'danger', validator: (v) => ['danger', 'primary'].includes(v) },
  carregando: { type: Boolean, default: false },
})

const emit = defineEmits(['confirmar', 'cancelar'])

function aoTeclar(e) {
  if (e.key === 'Escape' && props.aberto && !props.carregando) {
    emit('cancelar')
  }
}

onMounted(() => window.addEventListener('keydown', aoTeclar))
onUnmounted(() => window.removeEventListener('keydown', aoTeclar))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="aberto" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[2px]"
        role="dialog" aria-modal="true" :aria-labelledby="'modal-titulo'"
        @click.self="!carregando && emit('cancelar')">
        <div class="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
          <div class="flex items-start gap-3.5">
            <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              :class="variante === 'danger' ? 'bg-red-50 text-red-600' : 'bg-palette-mid-green/15 text-[#3f5f5a]'">
              <svg v-if="variante === 'danger'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H3" />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <h2 id="modal-titulo" class="text-base font-bold text-palette-chumbo">{{ titulo }}</h2>
              <p class="text-sm font-light text-gray-600 mt-1 leading-relaxed">{{ mensagem }}</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2.5 mt-6">
            <button type="button" :disabled="carregando" @click="emit('cancelar')"
              class="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer">
              {{ textoCancelar }}
            </button>
            <button type="button" :disabled="carregando" @click="emit('confirmar')"
              class="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-wait cursor-pointer"
              :class="variante === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-palette-mid-green hover:bg-[#6ba88a]'">
              {{ carregando ? 'Aguarde...' : textoConfirmar }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
