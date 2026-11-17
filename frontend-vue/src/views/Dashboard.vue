<script setup>
import { computed, onMounted } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { useAuthStore } from '../store/authStore'
import { useUploadStore, formatarMoeda } from '../store/uploadStore.js'

const auth = useAuthStore()
const store = useUploadStore()

onMounted(async () => {
  if (!store.estatisticas) {
    await store.carregarUltimoLote()
  }
})

const primeiroNome = computed(() => (auth.usuario?.nome || '').split(' ')[0])
const clientes = computed(() => store.dadosTratados)
const est = computed(() => store.estatisticas)

// Contagem de clientes por nível (A, B, C) — usa estatísticas do Python quando disponíveis
const listaNiveis = computed(() => {
  if (est.value?.porNivel?.length) {
    return est.value.porNivel.map((n) => ({
      nivel: n.nivel,
      clientes: n.clientes,
      percentual: Math.round(n.percentual),
      faturamentoTotal: n.faturamentoTotal,
      percentualFaturamento: n.percentualFaturamento,
    }))
  }
  const contagem = { A: 0, B: 0, C: 0 }
  clientes.value.forEach((c) => { if (contagem[c.nivel_cliente] !== undefined) contagem[c.nivel_cliente]++ })
  const total = clientes.value.length || 1
  return ['A', 'B', 'C'].map((nv) => ({
    nivel: nv,
    clientes: contagem[nv],
    percentual: Math.round((contagem[nv] / total) * 100),
    faturamentoTotal: null,
    percentualFaturamento: null,
  }))
})

const porSegmento = computed(() => est.value?.porSegmento || [])
const porServico = computed(() => est.value?.porServico || [])
const porConsultor = computed(() => est.value?.porConsultor || [])
const topClientes = computed(() => est.value?.topClientes || [])

// Top 5 cidades com mais clientes
const topCidades = computed(() => {
  if (est.value?.porCidade?.length) {
    return est.value.porCidade.slice(0, 5).map((c) => [c.cidade, c.clientes])
  }
  const contagem = {}
  clientes.value.forEach((c) => { if (c.cidade) contagem[c.cidade] = (contagem[c.cidade] || 0) + 1 })
  return Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 5)
})

const cards = computed(() => {
  if (est.value?.resumo) {
    const r = est.value.resumo
    const nivelA = est.value.porNivel?.find((n) => n.nivel === 'A')?.clientes ?? 0
    return [
      { rotulo: 'Total de clientes', valor: r.totalClientes, sub: `${r.consultores || 0} consultores ativos` },
      { rotulo: 'Faturamento total', valor: formatarMoeda(r.faturamentoTotal), sub: `Média: ${formatarMoeda(r.media)}` },
      { rotulo: 'Mediana da carteira', valor: formatarMoeda(r.mediana), sub: `Média de ${r.mediaServicosPorCliente ?? 0} serviços/cliente` },
      { rotulo: 'Clientes nível A', valor: nivelA, sub: `Segmento líder: ${r.segmentoMaisFrequente || '-'}` },
    ]
  }
  const qtdNivelA = listaNiveis.value.find((n) => n.nivel === 'A')?.clientes || 0
  return [
    { rotulo: 'Total de clientes', valor: clientes.value.length },
    { rotulo: 'Cidades atendidas', valor: new Set(clientes.value.map((c) => c.cidade).filter(Boolean)).size },
    { rotulo: 'Clientes nível A', valor: qtdNivelA },
    { rotulo: 'Avisos / problemas', valor: store.erros.length, alerta: store.erros.length > 0 },
  ]
})

const coresNivel = { A: 'bg-palette-mid-green', B: 'bg-palette-light-green', C: 'bg-palette-mid-yellow' }
</script>

<template>
  <AppHeader />

  <main class="bg-palette-offwhite min-h-screen px-6 py-10 md:px-[220px] xl:px-[360px]">
    <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-extrabold text-palette-chumbo">
          Olá<span v-if="primeiroNome">, <span class="text-palette-mid-green">{{ primeiroNome }}</span></span>!
        </h1>
        <p class="text-palette-gray font-medium mt-1">
          Aqui está um resumo da sua carteira de clientes
          <span v-if="store.nomeArquivo" class="text-xs text-[#52796F] font-semibold ml-1">
            ({{ store.nomeArquivo }}<span v-if="store.loteId"> • Lote #{{ store.loteId }}</span>)
          </span>
        </p>
      </div>
      <RouterLink to="/insights"
        class="text-sm font-semibold text-palette-mid-green bg-white px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50">
        Ver Insights do ETL →
      </RouterLink>
    </div>

    <!-- Estado vazio -->
    <div v-if="!store.temDados" class="bg-white rounded-2xl shadow-[0_10px_30px_rgba(38,53,31,0.09)] p-12 text-center">
      <p class="text-lg font-semibold text-palette-chumbo mb-2">Nenhum dado importado ainda</p>
      <p class="text-palette-gray mb-6">Envie sua planilha de clientes para visualizar os indicadores calculados pelo ETL.</p>
      <RouterLink to="/uploads"
        class="inline-block bg-palette-mid-green text-white font-semibold px-8 py-3 rounded-lg hover:bg-[#6ba88a] transition-colors duration-300 shadow-sm">
        Importar planilha
      </RouterLink>
    </div>

    <template v-else>
      <!-- Cards de indicadores -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div v-for="card in cards" :key="card.rotulo"
          class="bg-white rounded-2xl p-6 shadow-[0_10px_30px_rgba(38,53,31,0.09)] border-l-4"
          :class="card.alerta ? 'border-red-400' : 'border-palette-mid-green'">
          <p class="text-sm text-palette-gray font-medium">{{ card.rotulo }}</p>
          <p class="text-2xl font-extrabold mt-2 break-words" :class="card.alerta ? 'text-red-500' : 'text-palette-chumbo'">{{ card.valor }}</p>
          <p v-if="card.sub" class="text-xs text-palette-gray mt-1.5">{{ card.sub }}</p>
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <!-- Clientes por nível -->
        <div class="bg-white rounded-2xl p-6 shadow-[0_10px_30px_rgba(38,53,31,0.09)]">
          <h2 class="text-lg font-bold text-palette-chumbo mb-5">Clientes por nível</h2>
          <div v-for="item in listaNiveis" :key="item.nivel" class="mb-4">
            <div class="flex justify-between text-sm font-medium text-palette-gray mb-1">
              <span>Nível {{ item.nivel }}</span>
              <span>
                {{ item.clientes }} clientes ({{ item.percentual }}%)
                <template v-if="item.faturamentoTotal"> • {{ formatarMoeda(item.faturamentoTotal) }}</template>
              </span>
            </div>
            <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500" :class="coresNivel[item.nivel] || 'bg-palette-mid-green'" :style="{ width: item.percentual + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- Clientes por segmento (ETL Python) ou Top cidades -->
        <div v-if="porSegmento.length" class="bg-white rounded-2xl p-6 shadow-[0_10px_30px_rgba(38,53,31,0.09)]">
          <h2 class="text-lg font-bold text-palette-chumbo mb-5">Carteira por segmento</h2>
          <div v-for="seg in porSegmento" :key="seg.segmento" class="mb-3.5">
            <div class="flex justify-between text-sm font-medium text-palette-chumbo mb-1">
              <span>{{ seg.segmento }}</span>
              <span class="text-palette-gray">{{ seg.clientes }} ({{ seg.percentual }}%) • {{ formatarMoeda(seg.faturamentoTotal) }}</span>
            </div>
            <div class="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-palette-mid-green transition-all duration-500" :style="{ width: seg.percentual + '%' }"></div>
            </div>
          </div>
        </div>

        <div v-else class="bg-white rounded-2xl p-6 shadow-[0_10px_30px_rgba(38,53,31,0.09)]">
          <h2 class="text-lg font-bold text-palette-chumbo mb-5">Top 5 cidades</h2>
          <ol class="space-y-3">
            <li v-for="([cidade, qtd], i) in topCidades" :key="cidade" class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-full bg-palette-mid-green/15 text-palette-mid-green text-sm font-bold flex items-center justify-center">{{ i + 1 }}</span>
              <span class="flex-1 font-medium text-palette-chumbo">{{ cidade }}</span>
              <span class="text-sm text-palette-gray">{{ qtd }} clientes</span>
            </li>
          </ol>
        </div>
      </section>

      <!-- Segunda linha: Serviços mais contratados, Consultores e Top Clientes -->
      <section v-if="porServico.length || porConsultor.length" class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div class="bg-white rounded-2xl p-6 shadow-[0_10px_30px_rgba(38,53,31,0.09)]">
          <h2 class="text-lg font-bold text-palette-chumbo mb-4">Serviços contratados</h2>
          <ul class="space-y-3">
            <li v-for="srv in porServico" :key="srv.servico" class="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
              <span class="font-semibold text-palette-chumbo">{{ srv.servico }}</span>
              <span class="text-palette-gray">{{ srv.contratos }} clientes ({{ srv.percentual }}%) • Ticket médio {{ formatarMoeda(srv.faturamentoMedio) }}</span>
            </li>
          </ul>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-[0_10px_30px_rgba(38,53,31,0.09)]">
          <h2 class="text-lg font-bold text-palette-chumbo mb-4">Desempenho por consultor</h2>
          <ul class="space-y-3">
            <li v-for="cons in porConsultor" :key="cons.consultor" class="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
              <div>
                <p class="font-semibold text-palette-chumbo">{{ cons.consultor }}</p>
                <p class="text-xs text-palette-gray">{{ cons.clientes }} clientes ({{ cons.percentualFaturamento }}% da receita)</p>
              </div>
              <span class="font-bold text-palette-mid-green">{{ formatarMoeda(cons.faturamentoTotal) }}</span>
            </li>
          </ul>
        </div>
      </section>

      <section v-if="topClientes.length" class="bg-white rounded-2xl p-6 shadow-[0_10px_30px_rgba(38,53,31,0.09)]">
        <h2 class="text-lg font-bold text-palette-chumbo mb-4">Top 5 clientes por faturamento anual</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase text-palette-gray border-b border-gray-200">
              <tr>
                <th class="py-2 pr-4">Código</th>
                <th class="py-2 pr-4">Cliente</th>
                <th class="py-2 pr-4">Segmento</th>
                <th class="py-2 pr-4">Nível</th>
                <th class="py-2 text-right">Faturamento Anual</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cli in topClientes" :key="cli.codigo" class="border-b border-gray-100">
                <td class="py-2.5 pr-4 font-medium text-palette-chumbo">{{ cli.codigo }}</td>
                <td class="py-2.5 pr-4 text-palette-chumbo">{{ cli.nome }}</td>
                <td class="py-2.5 pr-4 text-palette-gray">{{ cli.segmento }}</td>
                <td class="py-2.5 pr-4 font-bold text-palette-mid-green">{{ cli.nivel }}</td>
                <td class="py-2.5 text-right font-semibold text-palette-chumbo">{{ formatarMoeda(cli.faturamento) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>
