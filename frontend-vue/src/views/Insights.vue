<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import { useUploadStore } from '../store/uploadStore.js'

const store = useUploadStore()
const carregando = ref(false)

onMounted(async () => {
  if (!store.estatisticas) {
    carregando.value = true
    await store.carregarUltimoLote()
    carregando.value = false
  }
})

// Combina os insights gerados a partir da carteira analisada
const insights = computed(() => {
  const lista = []
  const est = store.estatisticas

  if (est?.insights?.length) {
    const titulosPadrao = [
      'Concentração por segmento',
      'Distribuição de faturamento',
      'Participação da carteira nível A',
      'Liderança comercial por consultor',
      'Serviço de maior adesão',
      'Sazonalidade de contratações',
      'Relação entre serviços e faturamento',
    ]
    est.insights.forEach((frase, idx) => {
      const isAtencao = frase.toLowerCase().includes('puxam a média') || frase.toLowerCase().includes('negativa')
      lista.push({
        tipo: isAtencao ? 'atencao' : 'oportunidade',
        titulo: titulosPadrao[idx] || `Destaque #${idx + 1}`,
        texto: frase,
      })
    })
  } else if (store.dadosTratados.length) {
    const clientes = store.dadosTratados
    const total = clientes.length

    const cidades = {}
    clientes.forEach((c) => { if (c.cidade) cidades[c.cidade] = (cidades[c.cidade] || 0) + 1 })
    const [cidadeTop, qtdTop] = Object.entries(cidades).sort((a, b) => b[1] - a[1])[0] || []
    if (cidadeTop) {
      lista.push({
        tipo: 'oportunidade',
        titulo: `${cidadeTop} é seu principal mercado`,
        texto: `${qtdTop} clientes (${Math.round((qtdTop / total) * 100)}% da carteira) estão em ${cidadeTop}. Considere ações regionais de fidelização.`,
      })
    }

    const nivelC = clientes.filter((c) => c.nivel_cliente === 'C').length
    if (nivelC / total >= 0.3) {
      lista.push({
        tipo: 'atencao',
        titulo: 'Muitos clientes no nível C',
        texto: `${nivelC} clientes (${Math.round((nivelC / total) * 100)}%) estão no nível C. Há espaço para campanhas de upgrade.`,
      })
    }
  }

  if (est?.qualidade) {
    const q = est.qualidade
    const totalPadronizacoes = (q.correcoesSegmento || 0) + (q.correcoesConsultor || 0) + (q.correcoesNivel || 0)
    if (totalPadronizacoes > 0) {
      lista.push({
        tipo: 'atencao',
        titulo: 'Padronização automática dos dados',
        texto: `Ajustamos automaticamente ${q.correcoesSegmento || 0} segmento(s), ${q.correcoesConsultor || 0} nome(s) de consultor e ${q.correcoesNivel || 0} nível(is) para manter seus relatórios consistentes.`,
      })
    }
  }

  if (lista.length > 0) {
    const errosBloqueantes = store.erros.filter((e) => e.bloqueante !== false).length
    lista.push(errosBloqueantes > 0
      ? { tipo: 'alerta', titulo: 'Qualidade dos dados', texto: `Foram encontrados ${errosBloqueantes} problema(s) na planilha. Consulte o Relatório de Validação para ver os detalhes.` }
      : { tipo: 'oportunidade', titulo: 'Dados consistentes e validados', texto: 'Todos os registros válidos foram analisados e salvos com segurança.' })
  }

  return lista
})

const estilos = {
  oportunidade: { badge: 'bg-palette-mid-green/15 text-[#3f5f5a]', dot: 'bg-palette-mid-green', rotulo: 'Oportunidade' },
  atencao: { badge: 'bg-palette-light-yellow text-palette-brown', dot: 'bg-amber-400', rotulo: 'Ponto de atenção' },
  alerta: { badge: 'bg-red-50 text-red-600', dot: 'bg-red-400', rotulo: 'Alerta' },
}
</script>

<template>
  <AppHeader />

  <main class="bg-palette-offwhite min-h-screen px-page py-8 sm:py-10">
    <div class="mb-6">
      <h1 class="page-title">
        <span class="text-palette-mid-green">Insights</span> Estratégicos
      </h1>
      <p class="page-subtitle">
        Padrões e oportunidades identificados automaticamente a partir da sua carteira de clientes
      </p>
    </div>

    <LoadingSkeleton v-if="carregando" variant="insights" />

    <div v-else-if="!insights.length" class="card p-8 sm:p-12 text-center">
      <p class="text-lg font-semibold text-palette-chumbo mb-2">Ainda não há insights disponíveis</p>
      <p class="text-sm font-light text-gray-500 mb-6">Importe uma planilha de clientes para gerarmos análises sobre a sua carteira.</p>
      <RouterLink to="/uploads"
        class="inline-block bg-palette-mid-green text-white font-semibold px-8 py-3 rounded-lg hover:bg-[#6ba88a] transition-colors">
        Importar planilha
      </RouterLink>
    </div>

    <section v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <article v-for="(insight, idx) in insights" :key="idx"
        class="card p-6 hover:border-palette-mid-green/50 transition-colors">
        <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3" :class="estilos[insight.tipo].badge">
          <span class="w-1.5 h-1.5 rounded-full" :class="estilos[insight.tipo].dot"></span>
          {{ estilos[insight.tipo].rotulo }}
        </span>
        <h2 class="section-title mb-2">{{ insight.titulo }}</h2>
        <p class="text-sm font-light text-gray-600 leading-relaxed">{{ insight.texto }}</p>
      </article>
    </section>
  </main>
</template>
