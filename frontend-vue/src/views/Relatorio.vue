<script setup>
import { computed, onMounted, ref } from "vue";
import AppHeader from "../components/AppHeader.vue";
import LoadingSkeleton from "../components/LoadingSkeleton.vue";
import { useUploadStore } from "../store/uploadStore.js";

const upload = useUploadStore();
const carregando = ref(false);

onMounted(async () => {
    if (!upload.estatisticas) {
        carregando.value = true;
        await upload.carregarUltimoLote();
        carregando.value = false;
    }
});

const qualidadeEtl = computed(() => upload.estatisticas?.qualidade || null);
</script>

<template>
    <AppHeader />

    <main class="bg-palette-offwhite min-h-screen px-page py-8 sm:py-10">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
            <div>
                <h1 class="page-title">Relatório de <span class="text-palette-mid-green">Validação</span></h1>
                <p class="page-subtitle">
                    Arquivo: <strong class="font-medium text-palette-chumbo">{{ upload.nomeArquivo || 'Nenhum' }}</strong>
                    <span v-if="upload.dataUploadFormatada"> · {{ upload.dataUploadFormatada }}</span>
                </p>
            </div>
            <RouterLink to="/uploads" class="text-sm font-semibold text-[#3f5f5a] hover:text-palette-mid-green hover:underline">
                ← Voltar para Upload
            </RouterLink>
        </div>

        <LoadingSkeleton v-if="carregando" variant="relatorio" />

        <div v-else-if="!upload.temDados" class="card p-10 text-center">
            <p class="text-sm font-light text-gray-500">Nenhum dado para exibir. Volte e envie uma planilha.</p>
        </div>

        <template v-else>
            <!-- Resumo (Cards) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="card p-5 text-center">
                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Total de Registros</p>
                    <p class="text-3xl font-extrabold text-palette-chumbo mt-1">{{ upload.totalRegistros }}</p>
                </div>
                <div class="card p-5 text-center">
                    <p class="text-xs font-medium text-[#3f5f5a] uppercase tracking-wide">Registros Válidos</p>
                    <p class="text-3xl font-extrabold text-palette-mid-green mt-1">{{ upload.registrosValidos }}</p>
                </div>
                <div class="card p-5 text-center">
                    <p class="text-xs font-medium text-red-500 uppercase tracking-wide">Registros Recusados</p>
                    <p class="text-3xl font-extrabold text-red-600 mt-1">{{ upload.registrosComErro }}</p>
                </div>
            </div>

            <!-- Padronizações automáticas realizadas -->
            <div v-if="qualidadeEtl" class="card p-6 mb-6">
                <h2 class="section-title mb-4">Ajustes automáticos realizados na importação</h2>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div class="bg-palette-offwhite p-4 rounded-xl border border-gray-100">
                        <p class="text-xs font-light text-gray-500">Segmentos padronizados</p>
                        <p class="text-2xl font-extrabold text-[#3f5f5a]">{{ qualidadeEtl.correcoesSegmento || 0 }}</p>
                    </div>
                    <div class="bg-palette-offwhite p-4 rounded-xl border border-gray-100">
                        <p class="text-xs font-light text-gray-500">Consultores padronizados</p>
                        <p class="text-2xl font-extrabold text-[#3f5f5a]">{{ qualidadeEtl.correcoesConsultor || 0 }}</p>
                    </div>
                    <div class="bg-palette-offwhite p-4 rounded-xl border border-gray-100">
                        <p class="text-xs font-light text-gray-500">Níveis padronizados</p>
                        <p class="text-2xl font-extrabold text-[#3f5f5a]">{{ qualidadeEtl.correcoesNivel || 0 }}</p>
                    </div>
                </div>
                <ul v-if="qualidadeEtl.avisos?.length" class="space-y-1 text-xs font-light text-gray-600">
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
