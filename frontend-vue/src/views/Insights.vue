<script setup>
import { computed, onMounted } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { useUploadStore } from '../store/uploadStore.js'

const store = useUploadStore()

onMounted(async () => {
  if (!store.estatisticas) {
    await store.carregarUltimoLote()
  }
})

// Combina os insights estatísticos gerados pelo Python (insights.py) com indicadores locais
const insights = computed(() => {
  const lista = []
  const est = store.estatisticas

  if (est?.insights?.length) {
    const titulosPadrao = [
      'Concentração por Segmento',
      'Distribuição de Faturamento (Média vs. Mediana)',
      'Participação da Carteira Nível A',
      'Liderança Comercial por Consultor',
      'Serviço de Maior Adesão',
      'Sazonalidade de Contratações',
      'Correlação Serviços × Faturamento',
    ]
    est.insights.forEach((frase, idx) => {
      const isAtencao = frase.toLowerCase().includes('puxam a média') || frase.toLowerCase().includes('negativa')
      lista.push({
        tipo: isAtencao ? 'atencao' : 'oportunidade',
        titulo: titulosPadrao[idx] || `Insight Estatístico #${idx + 1}`,
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
        titulo: 'Padronização Automática no ETL',
        texto: `O pipeline em Python padronizou automaticamente ${q.correcoesSegmento || 0} segmento(s), ${q.correcoesConsultor || 0} nome(s) de consultor e ${q.correcoesNivel || 0} nível(is).`,
      })
    }
  }

  if (lista.length > 0) {
    const errosBloqueantes = store.erros.filter((e) => e.bloqueante !== false).length
    lista.push(errosBloqueantes > 0
      ? { tipo: 'alerta', titulo: 'Qualidade dos dados', texto: `Foram encontrados ${errosBloqueantes} erro(s) bloqueante(s) na planilha. Consulte o Relatório de Validação.` }
      : { tipo: 'oportunidade', titulo: 'Dados consistentes e validados', texto: 'Todos os registros válidos foram processados e gravados com integridade.' })
  }

  return lista
})

const estilos = {
  oportunidade: { borda: 'border-palette-mid-green', badge: 'bg-palette-mid-green/15 text-palette-mid-green', rotulo: 'Análise / Oportunidade' },
  atencao: { borda: 'border-palette-mid-yellow', badge: 'bg-palette-light-yellow text-palette-brown', rotulo: 'Atenção' },
  alerta: { borda: 'border-red-400', badge: 'bg-red-50 text-red-500', rotulo: 'Alerta' },
}
</script>

<template>
  <AppHeader />

  <main class="bg-palette-offwhite min-h-screen px-page py-10">
    <h1 class="text-3xl font-extrabold text-palette-chumbo">
      <span class="text-palette-mid-green">Insights</span> Estratégicos
    </h1>
    <p class="text-palette-gray font-medium mt-1 mb-8">
      Padrões estatísticos e oportunidades identificados pelo pipeline de Ciência de Dados em Python.
    </p>

    <div v-if="!insights.length" class="bg-white rounded-2xl shadow-[0_10px_30px_rgba(38,53,31,0.09)] p-12 text-center">
      <p class="text-lg font-semibold text-palette-chumbo mb-2">Ainda não há insights</p>
      <p class="text-palette-gray mb-6">Importe uma planilha para gerarmos análises sobre seus clientes.</p>
      <RouterLink to="/uploads"
        class="inline-block bg-palette-mid-green text-white font-semibold px-8 py-3 rounded-lg hover:bg-[#6ba88a] transition-colors duration-300 shadow-sm">
        Importar planilha
      </RouterLink>
    </div>

    <section v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <article v-for="(insight, idx) in insights" :key="idx"
        class="bg-white rounded-2xl p-6 shadow-[0_10px_30px_rgba(38,53,31,0.09)] border-t-4" :class="estilos[insight.tipo].borda">
        <span class="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3" :class="estilos[insight.tipo].badge">
          {{ estilos[insight.tipo].rotulo }}
        </span>
        <h2 class="text-lg font-bold text-palette-chumbo mb-2">{{ insight.titulo }}</h2>
        <p class="text-sm text-palette-gray leading-relaxed">{{ insight.texto }}</p>
      </article>
    </section>
  </main>
</template>
