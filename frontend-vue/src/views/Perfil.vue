<script setup>
import { ref, computed, onMounted } from 'vue'
import router from '../router'
import AppHeader from '../components/AppHeader.vue'
import BaseChart from '../components/BaseChart.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import { useAuthStore } from '../store/authStore'
import { useUploadStore, formatarDataHora } from '../store/uploadStore.js'

const auth = useAuthStore()
const upload = useUploadStore()

const nome = ref(auth.usuario?.nome || '')
const email = ref(auth.usuario?.email || '')
const mensagem = ref('')
const erroSalvar = ref('')
const salvando = ref(false)
const carregando = ref(true)
const perfilSincronizado = ref(false)
const sessaoExpirada = ref(false)

onMounted(async () => {
  try {
    const [resPerfil] = await Promise.all([
      auth.carregarPerfil(),
      upload.lotes.length ? Promise.resolve() : upload.carregarLotes(),
    ])
    perfilSincronizado.value = Boolean(resPerfil?.ok)
    sessaoExpirada.value = Boolean(resPerfil?.expirada)
    nome.value = auth.usuario?.nome || nome.value
    email.value = auth.usuario?.email || email.value
  } finally {
    carregando.value = false
  }
})

function irParaLogin() {
  auth.logout()
  router.push('/login')
}

const u = computed(() => auth.usuario || {})
const modoLocal = computed(() => auth.token === 'token-local')

const iniciais = computed(() =>
  (nome.value || email.value || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
)

const PERFIS = { ADMIN: 'Administrador', USER: 'Usuário' }
const STATUS = {
  APROVADO: { rotulo: 'Ativa', classe: 'bg-green-50 text-green-700' },
  PENDENTE: { rotulo: 'Pendente de aprovação', classe: 'bg-yellow-50 text-yellow-700' },
  BLOQUEADO: { rotulo: 'Bloqueada', classe: 'bg-red-50 text-red-600' },
}

const membroDesde = computed(() => {
  if (!u.value.criadoEm) return null
  const data = new Date(u.value.criadoEm)
  const dias = Math.floor((Date.now() - data.getTime()) / 86400000)
  return { data: data.toLocaleDateString('pt-BR'), dias }
})

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

const classeInput = 'w-full h-10 px-3 rounded-lg bg-palette-offwhite text-sm text-palette-chumbo border border-gray-200 outline-none focus:ring-2 focus:ring-palette-mid-green/50 focus:border-palette-mid-green transition'

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
      if (res.expirada) sessaoExpirada.value = true
      erroSalvar.value = res.erro
      return
    }
    nome.value = auth.usuario?.nome || nomeLimpo
    email.value = auth.usuario?.email || emailLimpo
    mensagem.value = res.local
      ? 'Alterações salvas apenas neste navegador.'
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
    <div class="mb-6">
      <h1 class="page-title">Meu <span class="text-palette-mid-green">Perfil</span></h1>
      <p class="page-subtitle">Gerencie suas informações pessoais e acompanhe sua atividade</p>
    </div>

    <LoadingSkeleton v-if="carregando" variant="perfil" />

    <template v-else>
      <div v-if="sessaoExpirada" class="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
        <span>Sua sessão expirou por segurança (tempo limite de 60 minutos). Faça login novamente para continuar alterando sua conta.</span>
        <button type="button" @click="irParaLogin"
          class="shrink-0 bg-amber-600 text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer">
          Fazer login novamente
        </button>
      </div>

      <p v-else-if="modoLocal" class="mb-5 text-xs sm:text-sm px-4 py-3 rounded-xl bg-palette-light-yellow/50 border border-palette-mid-yellow text-palette-brown">
        Você está no modo offline. Algumas informações da conta só aparecem quando conectado.
      </p>

      <section class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <!-- Cartão de identificação (leve e limpo) -->
        <div class="card overflow-hidden">
          <div class="h-16 bg-gradient-to-r from-palette-mid-green/25 via-palette-light-green/25 to-palette-offwhite"></div>
          <div class="px-6 pb-6 flex flex-col items-center text-center">
            <div class="-mt-10 w-20 h-20 rounded-full bg-palette-mid-green text-white text-2xl font-bold flex items-center justify-center border-4 border-white shadow-xs">{{ iniciais }}</div>
            <p class="mt-3 text-lg font-bold text-palette-chumbo break-words max-w-full">{{ nome || 'Usuário' }}</p>
            <p class="text-sm font-light text-gray-500 break-all">{{ email || 'e-mail não informado' }}</p>
            <div class="flex flex-wrap justify-center gap-2 mt-3">
              <span v-if="u.perfil" class="text-xs font-medium px-3 py-0.5 rounded-full bg-palette-mid-green/15 text-[#3f5f5a]">{{ PERFIS[u.perfil] || u.perfil }}</span>
              <span v-if="u.status" class="text-xs font-medium px-3 py-0.5 rounded-full" :class="STATUS[u.status]?.classe">{{ STATUS[u.status]?.rotulo || u.status }}</span>
            </div>
            <dl class="w-full mt-5 text-sm divide-y divide-gray-100 text-left">
              <div class="flex justify-between py-2"><dt class="text-gray-500 font-light">Conta</dt><dd class="font-semibold text-palette-chumbo">#{{ u.id ?? '—' }}</dd></div>
              <div class="flex justify-between py-2 gap-2"><dt class="text-gray-500 font-light">Membro desde</dt><dd class="font-semibold text-palette-chumbo text-right">{{ membroDesde ? `${membroDesde.data} (${membroDesde.dias} dias)` : '—' }}</dd></div>
              <div class="flex justify-between py-2"><dt class="text-gray-500 font-light">Sessão</dt><dd class="font-semibold" :class="modoLocal ? 'text-palette-brown' : 'text-green-700'">{{ modoLocal ? 'Offline' : (perfilSincronizado ? 'Conectada' : 'Ativa') }}</dd></div>
            </dl>
          </div>
        </div>

        <!-- Atividade -->
        <div class="lg:col-span-2 card p-5 sm:p-6">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 class="section-title">Minha atividade</h2>
              <p class="section-subtitle">Resumo das planilhas enviadas recentemente</p>
            </div>
            <RouterLink to="/historico" class="text-sm font-semibold text-[#3f5f5a] hover:text-palette-mid-green hover:underline shrink-0">Ver histórico →</RouterLink>
          </div>

          <div v-if="!atividade.total" class="text-sm font-light text-gray-500 py-10 text-center">
            Nenhum upload registrado ainda. <RouterLink to="/uploads" class="text-[#3f5f5a] font-semibold underline">Enviar planilha</RouterLink>
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-5 gap-5 items-center">
            <div class="sm:col-span-2">
              <BaseChart type="doughnut" :data="graficoAtividade" :options="opcoesAtividade" height="190px" aria-label="Uploads validados e recusados" />
            </div>
            <div class="sm:col-span-3 grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-palette-offwhite border border-gray-100 p-3"><p class="text-xs font-light text-gray-500">Arquivos enviados</p><p class="text-xl font-extrabold text-palette-chumbo mt-0.5">{{ atividade.total }}</p></div>
              <div class="rounded-xl bg-palette-offwhite border border-gray-100 p-3"><p class="text-xs font-light text-gray-500">Registros analisados</p><p class="text-xl font-extrabold text-palette-chumbo mt-0.5">{{ atividade.linhas.toLocaleString('pt-BR') }}</p></div>
              <div class="rounded-xl bg-palette-offwhite border border-gray-100 p-3"><p class="text-xs font-light text-gray-500">Registros válidos</p><p class="text-xl font-extrabold text-green-700 mt-0.5">{{ atividade.validas.toLocaleString('pt-BR') }}</p></div>
              <div class="rounded-xl bg-palette-offwhite border border-gray-100 p-3"><p class="text-xs font-light text-gray-500">Planilhas salvas</p><p class="text-xl font-extrabold text-palette-chumbo mt-0.5">{{ upload.lotes.length || '—' }}</p></div>
              <div class="col-span-2 rounded-xl bg-palette-offwhite border border-gray-100 p-3 min-w-0">
                <p class="text-xs font-light text-gray-500">Último arquivo</p>
                <p class="text-sm font-semibold text-palette-chumbo truncate">{{ atividade.ultimo.nome }}.{{ atividade.ultimo.extensao.toLowerCase() }}</p>
                <p class="text-xs font-light text-gray-500">{{ formatarDataHora(atividade.ultimo.dataUpload) }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Formulário de dados -->
      <form @submit.prevent="salvar" class="card p-5 sm:p-8 flex flex-col">
        <h2 class="section-title mb-1">Informações pessoais</h2>
        <p class="section-subtitle mb-6">
          {{ modoLocal ? 'Modo offline: as alterações ficam salvas apenas neste navegador.' : 'Alterações de nome e e-mail são salvas automaticamente na sua conta.' }}
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div>
            <label for="nome" class="block text-xs font-medium text-gray-600 mb-1.5">Nome completo</label>
            <input id="nome" v-model="nome" type="text" required :class="classeInput" />
          </div>
          <div>
            <label for="email" class="block text-xs font-medium text-gray-600 mb-1.5">E-mail</label>
            <input id="email" v-model="email" type="email" required :class="classeInput" />
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <button type="submit" :disabled="salvando"
            class="bg-palette-mid-green text-white font-semibold px-8 py-2.5 rounded-lg hover:bg-[#6ba88a] transition-colors disabled:opacity-60 disabled:cursor-wait cursor-pointer">
            {{ salvando ? 'Salvando...' : 'Salvar alterações' }}
          </button>
          <p v-if="erroSalvar" class="text-sm text-red-600 font-medium">{{ erroSalvar }}</p>
          <p v-if="mensagem" class="text-sm text-[#3f5f5a] font-medium">{{ mensagem }}</p>
        </div>
      </form>
    </template>
  </main>
</template>
