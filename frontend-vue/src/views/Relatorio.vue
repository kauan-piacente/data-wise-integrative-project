<script setup>
import { computed, onMounted } from "vue";
import AppHeader from "../components/AppHeader.vue";
import { useUploadStore } from "../store/uploadStore.js";

const upload = useUploadStore();

onMounted(async () => {
    if (!upload.estatisticas) {
        await upload.carregarUltimoLote();
    }
});

const qualidadeEtl = computed(() => upload.estatisticas?.qualidade || null);
</script>

<template>
    <AppHeader />

    <main class="bg-[#f8fafc] min-h-screen px-6 py-12 md:px-[220px] xl:px-[360px]">
        <div class="flex justify-between items-end mb-8">
            <div>
                <h1 class="text-3xl font-extrabold text-palette-chumbo">Relatório de Validação e Qualidade</h1>
                <p class="text-sm text-gray-500 mt-1">
                    Arquivo analisado: <strong>{{ upload.nomeArquivo || 'Nenhum' }}</strong>
                    <span v-if="upload.dataUploadFormatada"> | Data de Upload: {{ upload.dataUploadFormatada }}</span>
                    <span v-if="upload.loteId"> | Lote #{{ upload.loteId }}</span>
                </p>
            </div>
            <RouterLink to="/uploads" class="text-sm font-semibold text-[#52796F] underline">
                Voltar para Upload
            </RouterLink>
        </div>

        <div v-if="!upload.temDados" class="bg-white p-8 rounded-xl border border-gray-200 text-center">
            <p class="text-gray-500">Nenhum dado para exibir. Volte e faça o upload de uma planilha.</p>
        </div>

        <template v-else>
            <!-- Resumo (Cards) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-center">
                    <p class="text-xs text-gray-500 uppercase tracking-wide">Total de Registros</p>
                    <p class="text-3xl font-bold text-palette-chumbo mt-1">{{ upload.totalRegistros }}</p>
                </div>
                <div class="bg-white p-5 rounded-xl border border-[#84A98C] shadow-sm text-center">
                    <p class="text-xs text-[#52796F] uppercase tracking-wide">Registros Válidos</p>
                    <p class="text-3xl font-bold text-[#52796F] mt-1">{{ upload.registrosValidos }}</p>
                </div>
                <div class="bg-white p-5 rounded-xl border border-red-200 shadow-sm text-center">
                    <p class="text-xs text-red-500 uppercase tracking-wide">Registros Recusados</p>
                    <p class="text-3xl font-bold text-red-600 mt-1">{{ upload.registrosComErro }}</p>
                </div>
            </div>

            <!-- Padronizações realizadas pelo ETL em Python -->
            <div v-if="qualidadeEtl" class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <h3 class="text-lg font-bold text-palette-chumbo mb-4">Padronizações Automáticas do ETL (Python):</h3>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div class="bg-[#f8fafc] p-4 rounded-lg border border-gray-100">
                        <p class="text-xs text-gray-500">Segmentos padronizados</p>
                        <p class="text-2xl font-bold text-[#52796F]">{{ qualidadeEtl.correcoesSegmento || 0 }}</p>
                    </div>
                    <div class="bg-[#f8fafc] p-4 rounded-lg border border-gray-100">
                        <p class="text-xs text-gray-500">Consultores padronizados</p>
                        <p class="text-2xl font-bold text-[#52796F]">{{ qualidadeEtl.correcoesConsultor || 0 }}</p>
                    </div>
                    <div class="bg-[#f8fafc] p-4 rounded-lg border border-gray-100">
                        <p class="text-xs text-gray-500">Níveis padronizados</p>
                        <p class="text-2xl font-bold text-[#52796F]">{{ qualidadeEtl.correcoesNivel || 0 }}</p>
                    </div>
                </div>
                <ul v-if="qualidadeEtl.avisos?.length" class="space-y-1 text-xs text-gray-600">
                    <li v-for="(aviso, i) in qualidadeEtl.avisos" :key="i">• {{ aviso }}</li>
                </ul>
            </div>

            <!-- Resumo de tipos de ocorrência -->
            <div v-if="upload.totalErros > 0" class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <h3 class="text-lg font-bold text-palette-chumbo mb-4">Quantidade por tipo de ocorrência:</h3>
                <ul class="space-y-2">
                    <li v-for="(quantidade, tipo) in upload.errosPorTipo" :key="tipo" class="flex justify-between text-sm border-b border-gray-100 pb-2">
                        <span class="text-gray-700">{{ tipo }}</span>
                        <span class="font-bold text-[#52796F]">{{ quantidade }} ocorrência(s)</span>
                    </li>
                </ul>
            </div>

            <!-- Tabela detalhada de ocorrências -->
            <div>
                <h3 class="text-lg font-bold text-palette-chumbo mb-4">Tabela Detalhada de Validação</h3>

                <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table class="w-full border-collapse text-left text-sm text-gray-700">
                        <thead class="bg-[#84A98C] text-white">
                            <tr>
                                <th class="px-4 py-3 font-semibold w-24">Linha</th>
                                <th class="px-4 py-3 font-semibold w-48">Campo</th>
                                <th class="px-4 py-3 font-semibold w-48">Tipo</th>
                                <th class="px-4 py-3 font-semibold">Descrição</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(erro, index) in upload.erros" :key="index" class="border-t border-gray-100 hover:bg-gray-50">
                                <td class="px-4 py-3 font-bold text-center">{{ erro.linha }}</td>
                                <td class="px-4 py-3">{{ erro.campo }}</td>
                                <td class="px-4 py-3 font-semibold" :class="erro.bloqueante === false ? 'text-amber-600' : 'text-red-600'">
                                    {{ erro.tipo }}
                                </td>
                                <td class="px-4 py-3 text-gray-600">{{ erro.descricao }}</td>
                            </tr>
                            <tr v-if="upload.erros.length === 0">
                                <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                                    Nenhum erro encontrado! A planilha está pronta e validada. 🎉
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
    </main>
</template>
