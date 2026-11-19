<script setup>
import { ref, computed, onMounted } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import BaseChart from '../components/BaseChart.vue'
import { useAuthStore } from '../store/authStore'
import { useUploadStore, formatarDataHora } from '../store/uploadStore.js'

const auth = useAuthStore()
const upload = useUploadStore()

const nome = ref(auth.usuario?.nome || '')
const email = ref(auth.usuario?.email || '')
const mensagem = ref('')
const erroSalvar = ref('')
const salvando = ref(false)
const perfilSincronizado = ref(false)

onMounted(async () => {
  perfilSincronizado.value = await auth.carregarPerfil()
  nome.value = auth.usuario?.nome || nome.value
  email.value = auth.usuario?.email || email.value
  if (!upload.lotes.length) upload.carregarLotes()
})

const u = computed(() => auth.usuario || {})
const modoLocal = computed(() => auth.token === 'token-local')

const iniciais = computed(() =>
  (nome.value || email.value || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
)

const PERFIS = { ADMIN: 'Administrador', USER: 'Usuário' }
const STATUS = {
  APROVADO: { rotulo: 'Aprovado', classe: 'bg-green-50 text-green-700' },
  PENDENTE: { rotulo: 'Pendente de aprovação', classe: 'bg-yellow-50 text-yellow-700' },
  BLOQUEADO: { rotulo: 'Bloqueado', classe: 'bg-red-50 text-red-600' },
}

const membroDesde = computed(() => {
  if (!u.value.criadoEm) return null
  const data = new Date(u.value.criadoEm)
  const dias = Math.floor((Date.now() - data.getTime()) / 86400000)
  return { data: data.toLocaleDateString('pt-BR'), dias }
})

// Atividade registrada neste navegador (histórico local de uploads)
const atividade = computed(() => {
  const h = upload.historicoArquivos
  const concluidos = h.filter((a) => a.status === 'Completo')
  return {
    total: h.length,
    concluidos: concluidos.length,
    erros: h.filter((a) => a.status === 'Erro').length,
    linhas: concluidos.reduce((s, a) => s + (a.totalLinhas || 0), 0),
    validas: concluidos.reduce((s, a) => s + (a.linhasValidas || 0), 0),
    ultimo: h[0],
  }
})

const graficoAtividade = computed(() => ({
  labels: ['Validados', 'Recusados'],
  datasets: [{ data: [atividade.value.concluidos, atividade.value.erros], backgroundColor: ['#5f9c7d', '#f87171'], borderColor: '#fff', borderWidth: 3 }],
}))
const opcoesAtividade = { cutout: '65%', plugins: { legend: { position: 'bottom' } } }

const classeInput = 'w-full h-10 px-3 rounded-lg bg-palette-offwhite text-sm text-palette-chumbo shadow-[0_2px_6px_rgba(0,0,0,0.12)] outline-none focus:ring-2 focus:ring-palette-mid-green transition'

async function salvar() {
  mensagem.value = ''
  erroSalvar.value = ''

  const nomeLimpo = nome.value.trim()
  const emailLimpo = email.value.trim().toLowerCase()
  if (!nomeLimpo) {
    erroSalvar.value = 'Informe seu nome completo.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
    erroSalvar.value = 'Informe um e-mail válido.'
    return
  }

  salvando.value = true
  try {
    const res = await auth.atualizarPerfil(nomeLimpo, emailLimpo)
    if (!res.ok) {
      erroSalvar.value = res.erro
      return
    }
    nome.value = auth.usuario?.nome || nomeLimpo
    email.value = auth.usuario?.email || emailLimpo
    mensagem.value = res.local
      ? 'Backend indisponível ou sessão local: alterações salvas apenas neste navegador.'
      : 'Perfil atualizado com sucesso!'
    setTimeout(() => (mensagem.value = ''), 4000)
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <AppHeader />

  <main class="bg-palette-offwhite min-h-screen px-page py-8 sm:py-10">
    <h1 class="text-2xl sm:text-3xl font-extrabold text-palette-chumbo mb-6">Meu <span class="text-palette-mid-green">Perfil</span></h1>

    <p v-if="modoLocal" class="mb-5 text-xs sm:text-sm px-4 py-3 rounded-xl bg-palette-light-yellow/60 border border-palette-mid-yellow text-palette-brown">
      Sessão em modo local (backend Java indisponível no login). Perfil, status e data de cadastro só aparecem com o backend ativo.
    </p>

    <section class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
      <!-- Cartão de identificação -->
      <div class="bg-palette-chumbo rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(38,53,31,0.09)]">
        <div class="h-20"></div>
        <div class="bg-white rounded-tl-[60px] px-6 pb-6 flex flex-col items-center text-center h-full">
          <div class="-mt-10 w-20 h-20 rounded-full bg-palette-mid-green text-white text-2xl font-bold flex items-center justify-center border-4 border-white">{{ iniciais }}</div>
          <p class="mt-3 text-lg font-bold text-palette-chumbo break-words max-w-full">{{ nome || 'Usuário' }}</p>
          <p class="text-sm text-palette-gray break-all">{{ email || 'e-mail não informado' }}</p>
          <div class="flex flex-wrap justify-center gap-2 mt-3">
            <span v-if="u.perfil" class="text-xs font-semibold px-3 py-1 rounded-full bg-palette-mid-green/15 text-[#3f5f5a]">{{ PERFIS[u.perfil] || u.perfil }}</span>
            <span v-if="u.status" class="text-xs font-semibold px-3 py-1 rounded-full" :class="STATUS[u.status]?.classe">{{ STATUS[u.status]?.rotulo || u.status }}</span>
          </div>
          <dl class="w-full mt-5 text-sm divide-y divide-gray-100 text-left">
            <div class="flex justify-between py-2"><dt class="text-palette-gray">ID da conta</dt><dd class="font-semibold text-palette-chumbo">{{ u.id ?? '—' }}</dd></div>
            <div class="flex justify-between py-2 gap-2"><dt class="text-palette-gray">Membro desde</dt><dd class="font-semibold text-palette-chumbo text-right">{{ membroDesde ? `${membroDesde.data} (${membroDesde.dias} dias)` : '—' }}</dd></div>
            <div class="flex justify-between py-2"><dt class="text-palette-gray">Sessão</dt><dd class="font-semibold" :class="modoLocal ? 'text-palette-brown' : 'text-green-700'">{{ modoLocal ? 'Local' : (perfilSincronizado ? 'Autenticada (JWT)' : 'Autenticada') }}</dd></div>
          </dl>
        </div>
      </div>

      <!-- Atividade -->
      <div class="lg:col-span-2 card p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 class="text-base sm:text-lg font-bold text-palette-chumbo">Minha atividade</h2>
            <p class="text-xs text-palette-gray">Uploads realizados neste navegador</p>
          </div>
          <RouterLink to="/historico" class="text-sm font-semibold text-palette-mid-green hover:underline shrink-0">Ver histórico →</RouterLink>
        </div>

        <div v-if="!atividade.total" class="text-sm text-palette-gray py-10 text-center">
          Nenhum upload registrado ainda. <RouterLink to="/uploads" class="text-palette-mid-green font-semibold underline">Enviar planilha</RouterLink>
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-5 gap-5 items-center">
          <div class="sm:col-span-2">
            <BaseChart type="doughnut" :data="graficoAtividade" :options="opcoesAtividade" height="190px" aria-label="Uploads validados e recusados" />
          </div>
          <div class="sm:col-span-3 grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-palette-offwhite p-3"><p class="text-xs text-palette-gray">Arquivos enviados</p><p class="text-xl font-extrabold text-palette-chumbo">{{ atividade.total }}</p></div>
            <div class="rounded-xl bg-palette-offwhite p-3"><p class="text-xs text-palette-gray">Linhas analisadas</p><p class="text-xl font-extrabold text-palette-chumbo">{{ atividade.linhas.toLocaleString('pt-BR') }}</p></div>
            <div class="rounded-xl bg-palette-offwhite p-3"><p class="text-xs text-palette-gray">Linhas válidas</p><p class="text-xl font-extrabold text-green-700">{{ atividade.validas.toLocaleString('pt-BR') }}</p></div>
            <div class="rounded-xl bg-palette-offwhite p-3"><p class="text-xs text-palette-gray">Lotes no banco (sistema)</p><p class="text-xl font-extrabold text-palette-chumbo">{{ upload.lotes.length || '—' }}</p></div>
            <div class="col-span-2 rounded-xl bg-palette-offwhite p-3 min-w-0">
              <p class="text-xs text-palette-gray">Último arquivo</p>
              <p class="text-sm font-semibold text-palette-chumbo truncate">{{ atividade.ultimo.nome }}.{{ atividade.ultimo.extensao.toLowerCase() }}</p>
              <p class="text-xs text-palette-gray">{{ formatarDataHora(atividade.ultimo.dataUpload) }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Formulário de dados -->
    <form @submit.prevent="salvar" class="card p-5 sm:p-8 flex flex-col">
      <h2 class="text-base sm:text-lg font-bold text-palette-chumbo mb-1">Informações pessoais</h2>
      <p class="text-xs text-palette-gray mb-6">
        {{ modoLocal ? 'Sessão local: as alterações ficam salvas apenas neste navegador.' : 'Alterações de nome e e-mail são salvas na sua conta e renovam sua sessão automaticamente.' }}
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div>
          <label for="nome" class="block text-xs font-medium text-palette-gray mb-1.5">Nome completo</label>
          <input id="nome" v-model="nome" type="text" required :class="classeInput" />
        </div>
        <div>
          <label for="email" class="block text-xs font-medium text-palette-gray mb-1.5">E-mail</label>
          <input id="email" v-model="email" type="email" required :class="classeInput" />
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <button type="submit" :disabled="salvando"
          class="bg-palette-mid-green text-white font-semibold px-8 py-2.5 rounded-lg hover:bg-[#6ba88a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-wait">
          {{ salvando ? 'Salvando...' : 'Salvar alterações' }}
        </button>
        <p v-if="erroSalvar" class="text-sm text-red-600 font-medium">{{ erroSalvar }}</p>
        <p v-if="mensagem" class="text-sm text-palette-mid-green font-medium">{{ mensagem }}</p>
      </div>
    </form>
  </main>
</template>
