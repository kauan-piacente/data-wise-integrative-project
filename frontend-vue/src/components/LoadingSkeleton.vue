<script setup>
defineProps({
  variant: {
    type: String,
    default: 'dashboard',
    validator: (v) => ['dashboard', 'insights', 'historico', 'perfil', 'relatorio'].includes(v),
  },
})
</script>

<template>
  <div role="status" aria-live="polite" aria-label="Carregando dados" class="animate-pulse space-y-6">
    <span class="sr-only">Carregando dados...</span>

    <!-- Dashboard -->
    <template v-if="variant === 'dashboard'">
      <div class="h-11 bg-white border border-gray-200 rounded-xl px-4 flex items-center gap-4">
        <div class="h-3.5 w-44 bg-gray-200 rounded"></div>
        <div class="h-3.5 w-24 bg-gray-100 rounded"></div>
        <div class="h-3.5 w-36 bg-gray-100 rounded hidden sm:block"></div>
      </div>

      <div class="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="card p-5 space-y-3">
          <div class="h-3 w-28 bg-gray-200 rounded"></div>
          <div class="h-7 w-24 bg-gray-200 rounded"></div>
          <div class="h-3 w-36 bg-gray-100 rounded"></div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div class="card p-6 lg:col-span-2 space-y-4">
          <div class="h-4 w-36 bg-gray-200 rounded"></div>
          <div class="h-3 w-48 bg-gray-100 rounded"></div>
          <div class="mx-auto my-4 w-44 h-44 rounded-full border-[18px] border-gray-100"></div>
        </div>
        <div class="card p-6 lg:col-span-3 space-y-4">
          <div class="h-4 w-44 bg-gray-200 rounded"></div>
          <div class="h-3 w-64 bg-gray-100 rounded"></div>
          <div class="h-52 flex items-end gap-3 pt-4">
            <div v-for="h in [45, 70, 55, 85, 65, 95, 75]" :key="h" class="flex-1 bg-gray-100 rounded-t-md" :style="{ height: h + '%' }"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Insights -->
    <template v-else-if="variant === 'insights'">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div v-for="i in 6" :key="i" class="card p-6 space-y-3">
          <div class="h-5 w-28 bg-gray-200 rounded-full"></div>
          <div class="h-5 w-3/4 bg-gray-200 rounded"></div>
          <div class="space-y-2 pt-1">
            <div class="h-3.5 w-full bg-gray-100 rounded"></div>
            <div class="h-3.5 w-5/6 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Histórico -->
    <template v-else-if="variant === 'historico'">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="card p-5 space-y-2.5">
          <div class="h-3 w-24 bg-gray-200 rounded"></div>
          <div class="h-7 w-16 bg-gray-200 rounded"></div>
          <div class="h-3 w-32 bg-gray-100 rounded"></div>
        </div>
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div v-for="i in 4" :key="i" class="card p-5 space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-gray-200"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-48 bg-gray-200 rounded"></div>
              <div class="h-3 w-32 bg-gray-100 rounded"></div>
            </div>
            <div class="h-6 w-20 bg-gray-100 rounded-full"></div>
          </div>
          <div class="h-2 w-full bg-gray-100 rounded-full"></div>
          <div class="grid grid-cols-4 gap-2">
            <div v-for="j in 4" :key="j" class="h-8 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Perfil -->
    <template v-else-if="variant === 'perfil'">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="card p-6 flex flex-col items-center space-y-3">
          <div class="w-20 h-20 rounded-full bg-gray-200"></div>
          <div class="h-5 w-36 bg-gray-200 rounded"></div>
          <div class="h-3.5 w-44 bg-gray-100 rounded"></div>
          <div class="w-full space-y-3 pt-4">
            <div v-for="i in 3" :key="i" class="h-4 bg-gray-100 rounded"></div>
          </div>
        </div>
        <div class="lg:col-span-2 card p-6 space-y-4">
          <div class="h-5 w-40 bg-gray-200 rounded"></div>
          <div class="grid grid-cols-2 gap-3 pt-2">
            <div v-for="i in 4" :key="i" class="h-20 bg-gray-100 rounded-xl"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Relatório -->
    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="card p-5 space-y-2 flex flex-col items-center">
          <div class="h-3 w-28 bg-gray-200 rounded"></div>
          <div class="h-8 w-16 bg-gray-200 rounded"></div>
        </div>
      </div>
      <div class="card p-6 space-y-3">
        <div class="h-5 w-52 bg-gray-200 rounded"></div>
        <div v-for="i in 5" :key="i" class="h-10 w-full bg-gray-100 rounded-lg"></div>
      </div>
    </template>
  </div>
</template>
