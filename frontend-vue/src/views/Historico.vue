<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import BaseChart from '../components/BaseChart.vue'
import { useUploadStore, formatarDataHora, formatarTamanho } from '../store/uploadStore.js'

const store = useUploadStore()
const router = useRouter()
const aba = ref('banco')
const busca = ref('')
const filtroStatus = ref('TODOS')
const abrindo = ref(null)
const erroAbrir = ref('')

onMounted(() => store.carregarLotes())

const STATUS = {
  PROCESSADO: { rotulo: 'Processado', classe: 'bg-green-50 text-green-700 border-green-200' },
  PROCESSANDO: { rotulo: 'Processando', classe: 'bg-blue-50 text-blue-700 border-blue-200' },
  ERRO: { rotulo: 'Erro', classe: 'bg-red-50 text-red-600 border-red-200' },
  Completo: { rotulo: 'Validado', classe: 'bg-green-50 text-green-700 border-green-200' },
  Carregando: { rotulo: 'Carregando', classe: 'bg-blue-50 text-blue-700 border-blue-200' },
  Erro: { rotulo: 'Erro', classe: 'bg-red-50 text-red-600 border-red-200' },
}
const DESTINO = { java: 'Backend Java → ETL Python', python: 'API Python (ETL)', local: 'Somente validação local', null: 'Sem linhas válidas para enviar' }

const lotesFiltrados = computed(() => store.lotes.filter((l) =>
  (filtroStatus.value === 'TODOS' || l.status === filtroStatus.value) &&
  (l.arquivoNome || '').toLowerCase().includes(busca.value.trim().toLowerCase())
))
const locaisFiltrados = computed(() => store.historicoArquivos.filter((a) =>
  `${a.nome}.${a.extensao}`.toLowerCase().includes(busca.value.trim().toLowerCase())
))

const taxa = (v, t) => (t ? Math.round((v / t) * 1000) / 10 : 0)

// Indicadores agregados dos lotes gravados no banco
const resumo = computed(() => {
  const lotes = store.lotes
  const total = lotes.reduce((s, l) => s + (l.totalLinhas || 0), 0)
  const validas = lotes.reduce((s, l) => s + (l.linhasValidas || 0), 0)
  return {
    lotes: lotes.length,
    processados: lotes.filter((l) => l.status === 'PROCESSADO').length,
    comErro: lotes.filter((l) => l.status === 'ERRO').length,
    linhas: total,
    validas,
    taxa: taxa(validas, total),
    ultimo: lotes[0]?.enviadoEm,
  }
})

// Gráfico: qualidade de cada lote (do mais antigo para o mais recente)
const graficoQualidade = computed(() => {
  const lotes = [...store.lotes].slice(0, 12).reverse()
  return {
    labels: lotes.map((l) => `#${l.id}`),
    datasets: [
      { label: 'Válidas', data: lotes.map((l) => l.linhasValidas), backgroundColor: '#5f9c7d', borderRadius: 4, nomes: lotes.map((l) => l.arquivoNome) },
      { label: 'Inválidas', data: lotes.map((l) => l.linhasInvalidas), backgroundColor: '#f87171', borderRadius: 4 },
    ],
  }
})
const opcoesQualidade = {
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'bottom' },
    tooltip: { callbacks: { title: (itens) => `Lote ${itens[0].label} — ${itens[0].chart.data.datasets[0].nomes[itens[0].dataIndex] || ''}` } },
  },
  scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } } },
}

async function abrir(lote) {
  erroAbrir.value = ''
  abrindo.value = lote.id
  const ok = await store.abrirLote(lote.id)
  abrindo.value = null
  if (ok) router.push('/dashboard')
  else erroAbrir.value = `Não foi possível abrir o lote #${lote.id}: estatísticas indisponíveis ou serviço fora do ar.`
}

function limparLocal() {
  if (confirm('Remover o histórico de arquivos salvo neste navegador? Os lotes gravados no banco não serão afetados.')) store.limparHistoricoLocal()
}
</script>

<template>
  <AppHeader />

  <main class="bg-palette-offwhite min-h-screen px-page py-8 sm:py-10">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-palette-chumbo">Histórico de <span class="text-palette-mid-green">arquivos</span></h1>
        <p class="text-palette-gray font-medium mt-1 text-sm sm:text-base">Planilhas enviadas, resultado da validação e lotes gravados pelo ETL</p>
      </div>
      <RouterLink to="/uploads" class="self-start sm:self-auto text-sm font-semibold text-white bg-palette-mid-green px-4 py-2 rounded-lg shadow-sm hover:bg-[#6ba88a]">+ Novo upload</RouterLink>
    </div>

    <!-- Abas -->
    <div class="flex gap-1 p-1 bg-white rounded-full shadow-sm w-full sm:w-fit mb-6 text-sm">
      <button type="button" @click="aba = 'banco'" class="flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-full font-semibold transition"
        :class="aba === 'banco' ? 'bg-palette-mid-green text-white' : 'text-palette-chumbo'">Lotes no banco ({{ store.lotes.length }})</button>
      <button type="button" @click="aba = 'local'" class="flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-full font-semibold transition"
        :class="aba === 'local' ? 'bg-palette-mid-green text-white' : 'text-palette-chumbo'">Neste navegador ({{ store.historicoArquivos.length }})</button>
    </div>

    <!-- Filtros -->
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <input v-model="busca" type="search" placeholder="Buscar por nome do arquivo..."
        class="flex-1 h-10 px-4 rounded-lg bg-white text-sm shadow-sm border border-gray-200 outline-none focus:ring-2 focus:ring-palette-mid-green" />
      <select v-if="aba === 'banco'" v-model="filtroStatus" class="h-10 px-3 rounded-lg bg-white text-sm shadow-sm border border-gray-200 outline-none focus:ring-2 focus:ring-palette-mid-green">
        <option value="TODOS">Todos os status</option>
        <option value="PROCESSADO">Processado</option>
        <option value="PROCESSANDO">Processando</option>
        <option value="ERRO">Erro</option>
      </select>
    </div>

    <!-- ================= LOTES NO BANCO ================= -->
    <template v-if="aba === 'banco'">
      <div v-if="store.lotesCarregando" class="card p-10 text-center text-palette-gray">Carregando lotes...</div>

      <div v-else-if="store.lotesErro" class="card p-6 sm:p-8 text-center">
        <p class="font-semibold text-palette-chumbo mb-1">Serviços indisponíveis</p>
        <p class="text-sm text-palette-gray mb-4">{{ store.lotesErro }}</p>
        <button type="button" @click="store.carregarLotes()" class="text-sm font-semibold text-palette-mid-green underline">Tentar novamente</button>
      </div>

      <template v-else>
        <section class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div class="card p-4 sm:p-5"><p class="text-xs text-palette-gray">Lotes registrados</p><p class="text-2xl font-extrabold text-palette-chumbo mt-1">{{ resumo.lotes }}</p><p class="text-xs text-palette-gray mt-1">{{ resumo.processados }} processados • {{ resumo.comErro }} com erro</p></div>
          <div class="card p-4 sm:p-5"><p class="text-xs text-palette-gray">Linhas recebidas</p><p class="text-2xl font-extrabold text-palette-chumbo mt-1">{{ resumo.linhas.toLocaleString('pt-BR') }}</p><p class="text-xs text-palette-gray mt-1">{{ resumo.validas.toLocaleString('pt-BR') }} válidas</p></div>
          <div class="card p-4 sm:p-5"><p class="text-xs text-palette-gray">Taxa de aproveitamento</p><p class="text-2xl font-extrabold mt-1" :class="resumo.taxa >= 90 ? 'text-palette-mid-green' : 'text-palette-brown'">{{ resumo.taxa.toLocaleString('pt-BR') }}%</p><p class="text-xs text-palette-gray mt-1">linhas válidas / recebidas</p></div>
          <div class="card p-4 sm:p-5"><p class="text-xs text-palette-gray">Último envio</p><p class="text-sm sm:text-base font-bold text-palette-chumbo mt-2">{{ resumo.ultimo ? formatarDataHora(resumo.ultimo) : '—' }}</p></div>
        </section>

        <section v-if="store.lotes.length" class="card p-5 sm:p-6 mb-5">
          <h2 class="text-base sm:text-lg font-bold text-palette-chumbo">Qualidade dos últimos lotes</h2>
          <p class="text-xs text-palette-gray mb-3">Linhas válidas e inválidas por lote (até 12 mais recentes)</p>
          <BaseChart type="bar" :data="graficoQualidade" :options="opcoesQualidade" height="240px" aria-label="Gráfico de linhas válidas e inválidas por lote" />
        </section>

        <p v-if="erroAbrir" class="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{{ erroAbrir }}</p>

        <div v-if="!lotesFiltrados.length" class="card p-10 text-center text-palette-gray">Nenhum lote encontrado.</div>

        <ul v-else class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <li v-for="lote in lotesFiltrados" :key="lote.id" class="card p-4 sm:p-5 flex flex-col gap-3">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 shrink-0 rounded-lg bg-palette-mid-green/15 text-palette-mid-green font-bold text-xs flex items-center justify-center">#{{ lote.id }}</div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-palette-chumbo truncate" :title="lote.arquivoNome">{{ lote.arquivoNome }}</p>
                <p class="text-xs text-palette-gray">{{ formatarDataHora(lote.enviadoEm) }}</p>
              </div>
              <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border" :class="STATUS[lote.status]?.classe">{{ STATUS[lote.status]?.rotulo || lote.status }}</span>
            </div>
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden flex" :title="`${taxa(lote.linhasValidas, lote.totalLinhas)}% válidas`">
              <div class="bg-palette-mid-green" :style="{ width: taxa(lote.linhasValidas, lote.totalLinhas) + '%' }"></div>
              <div class="bg-red-400" :style="{ width: taxa(lote.linhasInvalidas, lote.totalLinhas) + '%' }"></div>
            </div>
            <dl class="grid grid-cols-4 text-center text-xs">
              <div><dt class="text-palette-gray">Total</dt><dd class="font-bold text-palette-chumbo">{{ lote.totalLinhas }}</dd></div>
              <div><dt class="text-palette-gray">Válidas</dt><dd class="font-bold text-green-700">{{ lote.linhasValidas }}</dd></div>
              <div><dt class="text-palette-gray">Inválidas</dt><dd class="font-bold text-red-500">{{ lote.linhasInvalidas }}</dd></div>
              <div><dt class="text-palette-gray">Avisos</dt><dd class="font-bold text-palette-brown">{{ lote.linhasComAviso }}</dd></div>
            </dl>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p class="text-xs text-palette-gray">{{ lote.mensagem }}</p>
              <button v-if="lote.status === 'PROCESSADO'" type="button" @click="abrir(lote)" :disabled="abrindo === lote.id"
                class="shrink-0 text-sm font-semibold text-palette-mid-green hover:underline disabled:opacity-50">
                {{ abrindo === lote.id ? 'Abrindo...' : 'Abrir no Dashboard →' }}
              </button>
            </div>
          </li>
        </ul>
      </template>
    </template>

    <!-- ================= HISTÓRICO LOCAL ================= -->
    <template v-else>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <p class="text-xs text-palette-gray">Registro das tentativas de upload feitas neste navegador, incluindo arquivos recusados na validação.</p>
        <button v-if="store.historicoArquivos.length" type="button" @click="limparLocal" class="self-start text-xs font-semibold text-red-500 hover:underline">Limpar histórico local</button>
      </div>

      <div v-if="!locaisFiltrados.length" class="card p-10 text-center text-palette-gray">Nenhum arquivo registrado neste navegador.</div>

      <ul v-else class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <li v-for="arq in locaisFiltrados" :key="arq.id" class="card p-4 sm:p-5 flex flex-col gap-3">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 shrink-0 rounded-lg bg-[#1FB35B] text-white text-[10px] font-bold flex items-center justify-center uppercase">{{ arq.extensao }}</div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-palette-chumbo truncate">{{ arq.nome }}.{{ arq.extensao.toLowerCase() }}</p>
              <p class="text-xs text-palette-gray">{{ formatarDataHora(arq.dataUpload) }} • {{ formatarTamanho(arq.tamanhoBytes) }}</p>
            </div>
            <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border" :class="STATUS[arq.status]?.classe">{{ STATUS[arq.status]?.rotulo || arq.status }}</span>
          </div>
          <dl v-if="arq.totalLinhas != null" class="grid grid-cols-4 text-center text-xs">
            <div><dt class="text-palette-gray">Linhas</dt><dd class="font-bold text-palette-chumbo">{{ arq.totalLinhas }}</dd></div>
            <div><dt class="text-palette-gray">Válidas</dt><dd class="font-bold text-green-700">{{ arq.linhasValidas }}</dd></div>
            <div><dt class="text-palette-gray">Com erro</dt><dd class="font-bold text-red-500">{{ arq.linhasComErro }}</dd></div>
            <div><dt class="text-palette-gray">Avisos</dt><dd class="font-bold text-palette-brown">{{ arq.avisos }}</dd></div>
          </dl>
          <p v-if="arq.status === 'Erro'" class="text-xs text-red-500">{{ arq.mensagemErro }}</p>
          <p v-else-if="arq.status === 'Completo'" class="text-xs text-palette-gray">
            Destino: {{ DESTINO[arq.destino] ?? '—' }}<span v-if="arq.loteId"> • Lote #{{ arq.loteId }}</span>
          </p>
        </li>
      </ul>
    </template>
  </main>
</template>
