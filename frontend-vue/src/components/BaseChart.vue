<script setup>
// Wrapper simples do Chart.js para Vue 3: recria o gráfico quando tipo/dados/opções mudam
// e destrói a instância ao desmontar (evita vazamento de memória).
import { onMounted, onBeforeUnmount, ref, watch, toRaw } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  type: { type: String, required: true },
  data: { type: Object, required: true },
  options: { type: Object, default: () => ({}) },
  height: { type: String, default: '280px' },
  ariaLabel: { type: String, default: 'Gráfico' },
})

const canvas = ref(null)
let chart = null

Chart.defaults.font.family = '"Montserrat", sans-serif'
Chart.defaults.color = '#4b5563'
Chart.defaults.plugins.legend.labels.usePointStyle = true
Chart.defaults.plugins.tooltip.backgroundColor = '#212121'
Chart.defaults.plugins.tooltip.padding = 10

function render() {
  if (chart) chart.destroy()
  if (!canvas.value) return
  chart = new Chart(canvas.value, {
    type: props.type,
    data: JSON.parse(JSON.stringify(toRaw(props.data))),
    options: { responsive: true, maintainAspectRatio: false, ...props.options },
  })
}

onMounted(render)
watch(() => [props.type, props.data, props.options], render, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="relative w-full" :style="{ height }">
    <canvas ref="canvas" role="img" :aria-label="ariaLabel"></canvas>
  </div>
</template>
