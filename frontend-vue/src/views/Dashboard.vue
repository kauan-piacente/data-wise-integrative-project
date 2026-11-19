<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import BaseChart from '../components/BaseChart.vue'
import { useAuthStore } from '../store/authStore'
import { useUploadStore, formatarMoeda, formatarMoedaCompacta, formatarMes, formatarDataHora } from '../store/uploadStore.js'

const auth = useAuthStore()
const store = useUploadStore()
const carregando = ref(false)

onMounted(async () => {
  if (!store.estatisticasAtivas) {
    carregando.value = true
    await store.carregarUltimoLote()
    carregando.value = false
  }
})

const primeiroNome = computed(() => (auth.usuario?.nome || '').split(' ')[0])
const est = computed(() => store.estatisticasAtivas)
const r = computed(() => est.value?.resumo || {})
const origemLocal = computed(() => est.value?.origem === 'local')

// Paleta da identidade visual (verde DataWise) usada em todos os gráficos
const VERDES = ['#3f5f5a', '#5f9c7d', '#82bfa0', '#a8d5bd', '#c6d1a6', '#efe8b2', '#7a6f5d', '#52796F']
const CORES_NIVEL = { A: '#3f5f5a', B: '#82bfa0', C: '#efe8b2' }

const nivelA = computed(() => est.value?.porNivel?.find((n) => n.nivel === 'A'))

const cards = computed(() => [
  { rotulo: 'Clientes válidos', valor: r.value.totalClientes ?? 0, sub: `${r.value.cidadesAtendidas ?? 0} cidades • ${r.value.consultores ?? 0} consultores` },
  { rotulo: 'Faturamento anual da carteira', valor: formatarMoedaCompacta(r.value.faturamentoTotal), titulo: formatarMoeda(r.value.faturamentoTotal), sub: `Ticket médio: ${formatarMoeda(r.value.media)}` },
  { rotulo: 'Mediana de faturamento', valor: formatarMoedaCompacta(r.value.mediana), titulo: formatarMoeda(r.value.mediana), sub: r.value.media && r.value.mediana ? (r.value.media > r.value.mediana * 1.15 ? 'Média acima da mediana: poucos clientes grandes puxam a média' : 'Faturamento distribuído de forma equilibrada') : '' },
  { rotulo: 'Clientes nível A', valor: nivelA.value?.clientes ?? 0, sub: nivelA.value?.percentualFaturamento != null ? `${nivelA.value.percentual}% da base • ${nivelA.value.percentualFaturamento}% da receita` : `${nivelA.value?.percentual ?? 0}% da base` },
])

const moedaTick = { callback: (v) => formatarMoedaCompacta(v) }
const tooltipMoeda = { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatarMoeda(ctx.parsed.x ?? ctx.parsed.y ?? ctx.parsed)}` } }

// 1) Níveis: alterna entre quantidade de clientes e participação na receita
const metricaNivel = ref('clientes')
const temFatNivel = computed(() => est.value?.porNivel?.some((n) => n.faturamentoTotal != null))
const graficoNivel = computed(() => {
  const niveis = est.value?.porNivel || []
  const usarFat = metricaNivel.value === 'faturamento' && temFatNivel.value
  return {
    labels: niveis.map((n) => `Nível ${n.nivel}`),
    datasets: [{
      label: usarFat ? 'Faturamento' : 'Clientes',
      data: niveis.map((n) => (usarFat ? n.faturamentoTotal || 0 : n.clientes)),
      backgroundColor: niveis.map((n, i) => CORES_NIVEL[n.nivel] || VERDES[i % VERDES.length]),
      borderColor: '#fff', borderWidth: 3,
    }],
  }
})
const opcoesNivel = computed(() => ({
  cutout: '62%',
  plugins: {
    legend: { position: 'bottom' },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1
          const p = ((ctx.parsed / total) * 100).toFixed(1).replace('.', ',')
          return metricaNivel.value === 'faturamento' ? ` ${formatarMoeda(ctx.parsed)} (${p}%)` : ` ${ctx.parsed} clientes (${p}%)`
        },
      },
    },
  },
}))

// 2) Segmentos: faturamento total por segmento (barra horizontal ordenada)
const graficoSegmento = computed(() => {
  const segs = [...(est.value?.porSegmento || [])].sort((a, b) => (b.faturamentoTotal || 0) - (a.faturamentoTotal || 0))
  return {
    labels: segs.map((s) => s.segmento),
    datasets: [{ label: 'Faturamento', data: segs.map((s) => s.faturamentoTotal || 0), backgroundColor: '#5f9c7d', borderRadius: 6, clientes: segs.map((s) => s.clientes) }],
  }
})
const opcoesSegmento = {
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx) => ` ${formatarMoeda(ctx.parsed.x)} • ${ctx.dataset.clientes[ctx.dataIndex]} cliente(s)` } },
  },
  scales: { x: { ticks: moedaTick, grid: { color: '#f1f5f9' } }, y: { grid: { display: false } } },
}

// 3) Evolução mensal: novas contratações (barras) e base acumulada (linha)
const graficoMes = computed(() => {
  const meses = est.value?.porMes || []
  return {
    labels: meses.map((m) => formatarMes(m.mes)),
    datasets: [
      { type: 'line', label: 'Base acumulada', data: meses.map((m) => m.acumulado), borderColor: '#3f5f5a', backgroundColor: '#3f5f5a', tension: 0.3, yAxisID: 'y1', pointRadius: 3 },
      { type: 'bar', label: 'Novos clientes no mês', data: meses.map((m) => m.clientes), backgroundColor: '#a8d5bd', borderRadius: 6, yAxisID: 'y' },
    ],
  }
})
const opcoesMes = {
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { position: 'bottom' } },
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Novos' }, grid: { color: '#f1f5f9' } },
    y1: { beginAtZero: true, position: 'right', ticks: { precision: 0 }, title: { display: true, text: 'Acumulado' }, grid: { display: false } },
    x: { grid: { display: false } },
  },
}

// 4) Serviços: % de clientes que contratam cada serviço
const graficoServico = computed(() => {
  const srv = est.value?.porServico || []
  return {
    labels: srv.map((s) => s.servico),
    datasets: [{ label: '% dos clientes', data: srv.map((s) => s.percentual), backgroundColor: '#82bfa0', borderRadius: 6, contratos: srv.map((s) => s.contratos), ticket: srv.map((s) => s.faturamentoMedio) }],
  }
})
const opcoesServico = {
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.parsed.x}% (${ctx.dataset.contratos[ctx.dataIndex]} clientes)`,
        afterLabel: (ctx) => ctx.dataset.ticket[ctx.dataIndex] != null ? ` Ticket médio: ${formatarMoeda(ctx.dataset.ticket[ctx.dataIndex])}` : '',
      },
    },
  },
  scales: { x: { min: 0, max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: '#f1f5f9' } }, y: { grid: { display: false } } },
}

// 5) Consultores: clientes x faturamento
const graficoConsultor = computed(() => {
  const cons = est.value?.porConsultor || []
  return {
    labels: cons.map((c) => c.consultor),
    datasets: [
      { label: 'Faturamento', data: cons.map((c) => c.faturamentoTotal || 0), backgroundColor: '#3f5f5a', borderRadius: 6, yAxisID: 'y' },
      { label: 'Clientes', data: cons.map((c) => c.clientes), backgroundColor: '#c6d1a6', borderRadius: 6, yAxisID: 'y1' },
    ],
  }
})
const opcoesConsultor = {
  plugins: {
    legend: { position: 'bottom' },
    tooltip: { callbacks: { label: (ctx) => ctx.dataset.yAxisID === 'y' ? ` Faturamento: ${formatarMoeda(ctx.parsed.y)}` : ` Clientes: ${ctx.parsed.y}` } },
  },
  scales: {
    y: { beginAtZero: true, ticks: moedaTick, grid: { color: '#f1f5f9' } },
    y1: { beginAtZero: true, position: 'right', ticks: { precision: 0 }, grid: { display: false } },
    x: { grid: { display: false } },
  },
}

// 6) Cidades: top 8 por número de clientes
const graficoCidade = computed(() => {
  const cid = (est.value?.porCidade || []).slice(0, 8)
  return {
    labels: cid.map((c) => c.cidade),
    datasets: [{ label: 'Clientes', data: cid.map((c) => c.clientes), backgroundColor: VERDES, borderRadius: 6 }],
  }
})
const opcoesCidade = {
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } },
}

const topClientes = computed(() => est.value?.topClientes || [])
const alturaBarras = (n) => `${Math.max(200, n * 42 + 40)}px`
</script>

<template>
  <AppHeader />

  <main class="bg-palette-offwhite min-h-screen px-page py-8 sm:py-10">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div class="min-w-0">
        <h1 class="text-2xl sm:text-3xl font-extrabold text-palette-chumbo">
          Olá<span v-if="primeiroNome">, <span class="text-palette-mid-green">{{ primeiroNome }}</span></span>!
        </h1>
        <p class="text-palette-gray font-medium mt-1 text-sm sm:text-base">Resumo da carteira de clientes do último arquivo analisado</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink to="/historico" class="text-sm font-semibold text-palette-chumbo bg-white px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50">Histórico</RouterLink>
        <RouterLink to="/insights" class="text-sm font-semibold text-white bg-palette-mid-green px-4 py-2 rounded-lg shadow-sm hover:bg-[#6ba88a]">Ver Insights →</RouterLink>
      </div>
    </div>

    <div v-if="carregando" class="card p-12 text-center text-palette-gray">Buscando o último lote processado...</div>

    <!-- Estado vazio -->
    <div v-else-if="!est" class="card p-8 sm:p-12 text-center">
      <p class="text-lg font-semibold text-palette-chumbo mb-2">Nenhum dado importado ainda</p>
      <p class="text-palette-gray mb-6">Envie sua planilha de clientes para visualizar os indicadores e gráficos da carteira.</p>
      <RouterLink to="/uploads" class="inline-block bg-palette-mid-green text-white font-semibold px-8 py-3 rounded-lg hover:bg-[#6ba88a] transition-colors shadow-sm">Importar planilha</RouterLink>
    </div>

    <template v-else>
      <!-- Origem dos dados -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm mb-6 px-4 py-3 rounded-xl border"
        :class="origemLocal ? 'bg-palette-light-yellow/60 border-palette-mid-yellow text-palette-brown' : 'bg-white border-gray-200 text-palette-gray'">
        <span class="font-semibold truncate max-w-full">📄 {{ store.nomeArquivo || 'Arquivo' }}</span>
        <span v-if="store.loteId">Lote #{{ store.loteId }}</span>
        <span v-if="store.dataUpload">{{ formatarDataHora(store.dataUpload) }}</span>
        <span v-if="origemLocal">⚠ Indicadores calculados no navegador (serviços de ETL indisponíveis). Os dados não foram gravados no banco.</span>
        <span v-else>Indicadores calculados pelo ETL em Python</span>
      </div>

      <!-- Cards de indicadores -->
      <section class="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div v-for="card in cards" :key="card.rotulo" class="card p-5 border-l-4 border-palette-mid-green min-w-0">
          <p class="text-xs sm:text-sm text-palette-gray font-medium">{{ card.rotulo }}</p>
          <p class="text-2xl font-extrabold mt-2 text-palette-chumbo truncate" :title="card.titulo">{{ card.valor }}</p>
          <p v-if="card.sub" class="text-xs text-palette-gray mt-1.5">{{ card.sub }}</p>
        </div>
      </section>
      <p v-if="r.clientesSemFaturamento" class="text-xs text-palette-brown -mt-3 mb-6">
        {{ r.clientesSemFaturamento }} cliente(s) sem faturamento informado na planilha não entram nos cálculos financeiros.
      </p>

      <section class="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">
        <div class="card p-5 sm:p-6 lg:col-span-2">
          <div class="flex items-start justify-between gap-3 mb-1">
            <div>
              <h2 class="text-base sm:text-lg font-bold text-palette-chumbo">Clientes por nível</h2>
              <p class="text-xs text-palette-gray">Classificação A, B e C da carteira</p>
            </div>
            <div v-if="temFatNivel" class="flex text-xs bg-gray-100 rounded-full p-0.5 shrink-0">
              <button v-for="m in [['clientes', 'Qtd'], ['faturamento', 'Receita']]" :key="m[0]" type="button" @click="metricaNivel = m[0]"
                class="px-3 py-1 rounded-full font-semibold transition" :class="metricaNivel === m[0] ? 'bg-white shadow text-palette-chumbo' : 'text-palette-gray'">{{ m[1] }}</button>
            </div>
          </div>
          <BaseChart type="doughnut" :data="graficoNivel" :options="opcoesNivel" height="260px" aria-label="Gráfico de rosca de clientes por nível" />
        </div>

        <div class="card p-5 sm:p-6 lg:col-span-3">
          <h2 class="text-base sm:text-lg font-bold text-palette-chumbo">Evolução da carteira</h2>
          <p class="text-xs text-palette-gray mb-3">Novos clientes por mês de contratação e crescimento acumulado da base</p>
          <BaseChart v-if="est.porMes?.length" type="bar" :data="graficoMes" :options="opcoesMes" height="260px" aria-label="Gráfico de contratações por mês" />
          <p v-else class="text-sm text-palette-gray py-16 text-center">Sem datas de contratação válidas para montar a série mensal.</p>
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div v-if="est.porSegmento?.length" class="card p-5 sm:p-6">
          <h2 class="text-base sm:text-lg font-bold text-palette-chumbo">Faturamento por segmento</h2>
          <p class="text-xs text-palette-gray mb-3">Quais setores concentram a receita anual</p>
          <BaseChart type="bar" :data="graficoSegmento" :options="opcoesSegmento" :height="alturaBarras(est.porSegmento.length)" aria-label="Gráfico de faturamento por segmento" />
        </div>
        <div v-if="est.porServico?.length" class="card p-5 sm:p-6">
          <h2 class="text-base sm:text-lg font-bold text-palette-chumbo">Adesão aos serviços</h2>
          <p class="text-xs text-palette-gray mb-3">Percentual de clientes que contratam cada serviço</p>
          <BaseChart type="bar" :data="graficoServico" :options="opcoesServico" :height="alturaBarras(est.porServico.length)" aria-label="Gráfico de adesão aos serviços" />
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div v-if="est.porConsultor?.length" class="card p-5 sm:p-6">
          <h2 class="text-base sm:text-lg font-bold text-palette-chumbo">Desempenho por consultor</h2>
          <p class="text-xs text-palette-gray mb-3">Receita da carteira e número de clientes atendidos</p>
          <BaseChart type="bar" :data="graficoConsultor" :options="opcoesConsultor" height="280px" aria-label="Gráfico de desempenho por consultor" />
        </div>
        <div v-if="est.porCidade?.length" class="card p-5 sm:p-6">
          <h2 class="text-base sm:text-lg font-bold text-palette-chumbo">Principais cidades</h2>
          <p class="text-xs text-palette-gray mb-3">Cidades com mais clientes (até 8)</p>
          <BaseChart type="bar" :data="graficoCidade" :options="opcoesCidade" height="280px" aria-label="Gráfico de clientes por cidade" />
        </div>
      </section>

      <section v-if="topClientes.length" class="card p-5 sm:p-6">
        <h2 class="text-base sm:text-lg font-bold text-palette-chumbo mb-4">Top 5 clientes por faturamento anual</h2>
        <!-- Tabela em telas médias/grandes -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase text-palette-gray border-b border-gray-200">
              <tr><th class="py-2 pr-4">Código</th><th class="py-2 pr-4">Cliente</th><th class="py-2 pr-4">Segmento</th><th class="py-2 pr-4">Cidade</th><th class="py-2 pr-4">Nível</th><th class="py-2 text-right">Faturamento</th></tr>
            </thead>
            <tbody>
              <tr v-for="cli in topClientes" :key="cli.codigo" class="border-b border-gray-100">
                <td class="py-2.5 pr-4 font-medium text-palette-chumbo">{{ cli.codigo }}</td>
                <td class="py-2.5 pr-4 text-palette-chumbo">{{ cli.nome }}</td>
                <td class="py-2.5 pr-4 text-palette-gray">{{ cli.segmento || '—' }}</td>
                <td class="py-2.5 pr-4 text-palette-gray">{{ [cli.cidade, cli.uf].filter(Boolean).join(' / ') || '—' }}</td>
                <td class="py-2.5 pr-4 font-bold text-palette-mid-green">{{ cli.nivel }}</td>
                <td class="py-2.5 text-right font-semibold text-palette-chumbo">{{ formatarMoeda(cli.faturamento) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Lista em celulares -->
        <ul class="md:hidden divide-y divide-gray-100">
          <li v-for="(cli, i) in topClientes" :key="cli.codigo" class="py-3 flex items-center gap-3">
            <span class="w-7 h-7 shrink-0 rounded-full bg-palette-mid-green/15 text-palette-mid-green text-sm font-bold flex items-center justify-center">{{ i + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-sm text-palette-chumbo truncate">{{ cli.nome }}</p>
              <p class="text-xs text-palette-gray">{{ cli.codigo }} • Nível {{ cli.nivel }} • {{ cli.segmento || '—' }}</p>
            </div>
            <span class="text-sm font-bold text-palette-chumbo whitespace-nowrap">{{ formatarMoedaCompacta(cli.faturamento) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>
