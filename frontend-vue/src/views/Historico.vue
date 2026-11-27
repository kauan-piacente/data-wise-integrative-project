<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import BaseChart from '../components/BaseChart.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import { useUploadStore, formatarDataHora, formatarTamanho } from '../store/uploadStore.js'

const store = useUploadStore()
const router = useRouter()
const aba = ref('banco')
const busca = ref('')
const filtroStatus = ref('TODOS')
const abrindo = ref(null)
const removendo = ref(null)
const erroAcao = ref('')
const modalConfirmacao = ref(null) // { tipo: 'lote' | 'local' | 'limpar', item?, titulo, mensagem, textoConfirmar }

onMounted(() => store.carregarLotes())

const STATUS = {
  PROCESSADO: { rotulo: 'Concluído', classe: 'bg-green-50 text-green-700 border-green-200' },
  PROCESSANDO: { rotulo: 'Processando', classe: 'bg-blue-50 text-blue-700 border-blue-200' },
  ERRO: { rotulo: 'Erro', classe: 'bg-red-50 text-red-600 border-red-200' },
  Completo: { rotulo: 'Validado', classe: 'bg-green-50 text-green-700 border-green-200' },
  Carregando: { rotulo: 'Carregando', classe: 'bg-blue-50 text-blue-700 border-blue-200' },
  Erro: { rotulo: 'Erro', classe: 'bg-red-50 text-red-600 border-red-200' },
}
const DESTINO = {
  java: 'Salvo na nuvem',
  python: 'Salvo na nuvem',
  local: 'Salvo apenas neste navegador',
  null: 'Sem registros válidos para salvar',
}

const lotesFiltrados = computed(() => store.lotes.filter((l) =>
  (filtroStatus.value === 'TODOS' || l.status === filtroStatus.value) &&
  (l.arquivoNome || '').toLowerCase().includes(busca.value.trim().toLowerCase())
))
const locaisFiltrados = computed(() => store.historicoArquivos.filter((a) =>
  `${a.nome}.${a.extensao}`.toLowerCase().includes(busca.value.trim().toLowerCase())
))

const taxa = (v, t) => (t ? Math.round((v / t) * 1000) / 10 : 0)

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
    tooltip: { callbacks: { title: (itens) => `Envio ${itens[0].label} — ${itens[0].chart.data.datasets[0].nomes[itens[0].dataIndex] || ''}` } },
  },
  scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } } },
}

async function abrir(lote) {
  erroAcao.value = ''
  abrindo.value = lote.id
  const ok = await store.abrirLote(lote.id)
  abrindo.value = null
  if (ok) router.push('/dashboard')
  else erroAcao.value = `Não foi possível abrir "${lote.arquivoNome}". Tente novamente em instantes.`
}

function remover(lote) {
  modalConfirmacao.value = {
    tipo: 'lote',
    item: lote,
    titulo: 'Remover planilha',
    mensagem: `Tem certeza de que deseja remover "${lote.arquivoNome}"? Todos os indicadores e dados vinculados a ela serão excluídos.`,
    textoConfirmar: 'Remover',
  }
}

function removerLocal(arq) {
  modalConfirmacao.value = {
    tipo: 'local',
    item: arq,
    titulo: 'Remover registro',
    mensagem: `Remover "${arq.nome}.${arq.extensao.toLowerCase()}" do histórico deste navegador?`,
    textoConfirmar: 'Remover',
  }
}

function limparLocal() {
  modalConfirmacao.value = {
    tipo: 'limpar',
    titulo: 'Limpar histórico local',
    mensagem: 'Deseja limpar o histórico salvo neste navegador? As planilhas salvas na nuvem não serão afetadas.',
    textoConfirmar: 'Limpar tudo',
  }
}

async function executarConfirmacao() {
  const acao = modalConfirmacao.value
  if (!acao) return

  if (acao.tipo === 'lote') {
    erroAcao.value = ''
    removendo.value = acao.item.id
    const ok = await store.removerLote(acao.item.id)
    removendo.value = null
    if (!ok) {
      erroAcao.value = `Não foi possível remover "${acao.item.arquivoNome}". Verifique sua conexão e tente novamente.`
    }
  } else if (acao.tipo === 'local') {
    store.removerArquivoLocal(acao.item.id)
  } else if (acao.tipo === 'limpar') {
    store.limparHistoricoLocal()
  }
  modalConfirmacao.value = null
}
</script>

<template>
  <AppHeader />

  <main class="bg-palette-offwhite min-h-screen px-page py-8 sm:py-10">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 class="page-title">Histórico de <span class="text-palette-mid-green">arquivos</span></h1>
        <p class="page-subtitle">Acompanhe as planilhas enviadas, a qualidade dos dados e os arquivos salvos</p>
      </div>
      <RouterLink to="/uploads" class="self-start sm:self-auto text-sm font-semibold text-white bg-palette-mid-green px-4 py-2 rounded-lg hover:bg-[#6ba88a] transition-colors">+ Novo upload</RouterLink>
    </div>

    <!-- Abas -->
    <div class="flex gap-1 p-1 bg-white border border-gray-200/80 rounded-full w-full sm:w-fit mb-6 text-sm">
      <button type="button" @click="aba = 'banco'" class="flex-1 sm:flex-none px-4 sm:px-5 py-1.5 rounded-full font-medium transition cursor-pointer"
        :class="aba === 'banco' ? 'bg-palette-mid-green text-white' : 'text-gray-600 hover:text-palette-chumbo'">Planilhas salvas ({{ store.lotes.length }})</button>
      <button type="button" @click="aba = 'local'" class="flex-1 sm:flex-none px-4 sm:px-5 py-1.5 rounded-full font-medium transition cursor-pointer"
        :class="aba === 'local' ? 'bg-palette-mid-green text-white' : 'text-gray-600 hover:text-palette-chumbo'">Neste navegador ({{ store.historicoArquivos.length }})</button>
    </div>

    <!-- Filtros -->
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <input v-model="busca" type="search" placeholder="Buscar por nome do arquivo..."
        class="flex-1 h-10 px-4 rounded-lg bg-white text-sm border border-gray-200 outline-none focus:ring-2 focus:ring-palette-mid-green/50 focus:border-palette-mid-green transition" />
      <select v-if="aba === 'banco'" v-model="filtroStatus" class="h-10 px-3 rounded-lg bg-white text-sm border border-gray-200 outline-none focus:ring-2 focus:ring-palette-mid-green/50 focus:border-palette-mid-green transition">
        <option value="TODOS">Todos os status</option>
        <option value="PROCESSADO">Concluído</option>
        <option value="PROCESSANDO">Processando</option>
        <option value="ERRO">Erro</option>
      </select>
    </div>

    <!-- ================= PLANILHAS SALVAS ================= -->
    <template v-if="aba === 'banco'">
      <LoadingSkeleton v-if="store.lotesCarregando" variant="historico" />

      <div v-else-if="store.lotesErro" class="card p-6 sm:p-8 text-center">
        <p class="font-semibold text-palette-chumbo mb-1">Não foi possível carregar o histórico</p>
        <p class="text-sm font-light text-gray-500 mb-4">{{ store.lotesErro }}</p>
        <button type="button" @click="store.carregarLotes()" class="text-sm font-semibold text-palette-mid-green hover:underline cursor-pointer">Tentar novamente</button>
      </div>

      <template v-else>
        <section class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div class="card p-4 sm:p-5"><p class="text-xs font-medium text-gray-500">Planilhas salvas</p><p class="text-2xl font-extrabold text-palette-chumbo mt-1">{{ resumo.lotes }}</p><p class="text-xs font-light text-gray-500 mt-1">{{ resumo.processados }} concluídas · {{ resumo.comErro }} com erro</p></div>
          <div class="card p-4 sm:p-5"><p class="text-xs font-medium text-gray-500">Registros enviados</p><p class="text-2xl font-extrabold text-palette-chumbo mt-1">{{ resumo.linhas.toLocaleString('pt-BR') }}</p><p class="text-xs font-light text-gray-500 mt-1">{{ resumo.validas.toLocaleString('pt-BR') }} válidos</p></div>
          <div class="card p-4 sm:p-5"><p class="text-xs font-medium text-gray-500">Taxa de aproveitamento</p><p class="text-2xl font-extrabold mt-1" :class="resumo.taxa >= 90 ? 'text-palette-mid-green' : 'text-palette-brown'">{{ resumo.taxa.toLocaleString('pt-BR') }}%</p><p class="text-xs font-light text-gray-500 mt-1">registros válidos</p></div>
          <div class="card p-4 sm:p-5"><p class="text-xs font-medium text-gray-500">Último envio</p><p class="text-sm sm:text-base font-bold text-palette-chumbo mt-2">{{ resumo.ultimo ? formatarDataHora(resumo.ultimo) : '—' }}</p></div>
        </section>

        <section v-if="store.lotes.length" class="card p-5 sm:p-6 mb-5">
          <h2 class="section-title">Qualidade das últimas planilhas</h2>
          <p class="section-subtitle mb-3">Comparativo de registros válidos e inválidos (até 12 envios recentes)</p>
          <BaseChart type="bar" :data="graficoQualidade" :options="opcoesQualidade" height="240px" aria-label="Gráfico de registros válidos e inválidos por planilha" />
        </section>

        <p v-if="erroAcao" class="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{{ erroAcao }}</p>

        <div v-if="!lotesFiltrados.length" class="card p-10 text-center text-sm font-light text-gray-500">Nenhuma planilha encontrada.</div>

        <ul v-else class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <li v-for="lote in lotesFiltrados" :key="lote.id" class="card p-4 sm:p-5 flex flex-col gap-3 hover:border-palette-mid-green/50 transition-colors">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 shrink-0 rounded-lg bg-palette-mid-green/15 text-[#3f5f5a] font-bold text-xs flex items-center justify-center">#{{ lote.id }}</div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-palette-chumbo truncate" :title="lote.arquivoNome">{{ lote.arquivoNome }}</p>
                <p class="text-xs font-light text-gray-500">{{ formatarDataHora(lote.enviadoEm) }}</p>
              </div>
              <span class="shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full border" :class="STATUS[lote.status]?.classe">{{ STATUS[lote.status]?.rotulo || lote.status }}</span>
              <button type="button" @click="remover(lote)" :disabled="removendo === lote.id"
                :aria-label="`Remover ${lote.arquivoNome}`" title="Remover planilha"
                class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-40 cursor-pointer">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden flex" :title="`${taxa(lote.linhasValidas, lote.totalLinhas)}% válidas`">
              <div class="bg-palette-mid-green" :style="{ width: taxa(lote.linhasValidas, lote.totalLinhas) + '%' }"></div>
              <div class="bg-red-400" :style="{ width: taxa(lote.linhasInvalidas, lote.totalLinhas) + '%' }"></div>
            </div>
            <dl class="grid grid-cols-4 text-center text-xs">
              <div><dt class="text-gray-500 font-light">Total</dt><dd class="font-bold text-palette-chumbo">{{ lote.totalLinhas }}</dd></div>
              <div><dt class="text-gray-500 font-light">Válidas</dt><dd class="font-bold text-green-700">{{ lote.linhasValidas }}</dd></div>
              <div><dt class="text-gray-500 font-light">Inválidas</dt><dd class="font-bold text-red-500">{{ lote.linhasInvalidas }}</dd></div>
              <div><dt class="text-gray-500 font-light">Avisos</dt><dd class="font-bold text-palette-brown">{{ lote.linhasComAviso }}</dd></div>
            </dl>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-gray-100">
              <p class="text-xs font-light text-gray-500">{{ lote.mensagem }}</p>
              <button v-if="lote.status === 'PROCESSADO'" type="button" @click="abrir(lote)" :disabled="abrindo === lote.id"
                class="shrink-0 text-sm font-semibold text-[#3f5f5a] hover:text-palette-mid-green hover:underline disabled:opacity-50 cursor-pointer">
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
        <p class="text-xs font-light text-gray-500">Registro das tentativas de envio feitas neste navegador, incluindo arquivos recusados na validação.</p>
        <button v-if="store.historicoArquivos.length" type="button" @click="limparLocal" class="self-start text-xs font-semibold text-red-500 hover:underline cursor-pointer">Limpar histórico local</button>
      </div>

      <div v-if="!locaisFiltrados.length" class="card p-10 text-center text-sm font-light text-gray-500">Nenhum arquivo registrado neste navegador.</div>

      <ul v-else class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <li v-for="arq in locaisFiltrados" :key="arq.id" class="card p-4 sm:p-5 flex flex-col gap-3">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 shrink-0 rounded-lg bg-palette-mid-green/15 text-[#3f5f5a] text-[10px] font-bold flex items-center justify-center uppercase">{{ arq.extensao }}</div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-palette-chumbo truncate">{{ arq.nome }}.{{ arq.extensao.toLowerCase() }}</p>
              <p class="text-xs font-light text-gray-500">{{ formatarDataHora(arq.dataUpload) }} · {{ formatarTamanho(arq.tamanhoBytes) }}</p>
            </div>
            <span class="shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full border" :class="STATUS[arq.status]?.classe">{{ STATUS[arq.status]?.rotulo || arq.status }}</span>
            <button type="button" @click="removerLocal(arq)"
              :aria-label="`Remover ${arq.nome}`" title="Remover registro"
              class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          <dl v-if="arq.totalLinhas != null" class="grid grid-cols-4 text-center text-xs">
            <div><dt class="text-gray-500 font-light">Linhas</dt><dd class="font-bold text-palette-chumbo">{{ arq.totalLinhas }}</dd></div>
            <div><dt class="text-gray-500 font-light">Válidas</dt><dd class="font-bold text-green-700">{{ arq.linhasValidas }}</dd></div>
            <div><dt class="text-gray-500 font-light">Erros</dt><dd class="font-bold text-red-500">{{ arq.linhasComErro }}</dd></div>
            <div><dt class="text-gray-500 font-light">Avisos</dt><dd class="font-bold text-palette-brown">{{ arq.avisos ?? 0 }}</dd></div>
          </dl>
          <p v-if="arq.mensagemErro" class="text-xs text-red-500">{{ arq.mensagemErro }}</p>
          <p v-else-if="arq.destino !== undefined" class="text-xs font-light text-gray-500">
            {{ DESTINO[arq.destino] || arq.destino }}
          </p>
        </li>
      </ul>
    </template>
  </main>

  <ConfirmModal
    :aberto="!!modalConfirmacao"
    :titulo="modalConfirmacao?.titulo || ''"
    :mensagem="modalConfirmacao?.mensagem || ''"
    :texto-confirmar="modalConfirmacao?.textoConfirmar || 'Confirmar'"
    variante="danger"
    :carregando="!!removendo"
    @confirmar="executarConfirmacao"
    @cancelar="modalConfirmacao = null"
  />
</template>
