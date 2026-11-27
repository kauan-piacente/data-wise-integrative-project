<script setup>
import AppHeader from "../components/AppHeader.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import uploadIcon from "../assets/upload_images/upload_icon.png";
import { ref } from "vue";
import { useUploadStore, formatarTamanho, formatarDataHora } from "../store/uploadStore.js";

const upload = useUploadStore();
const fileInput = ref(null);
const removendoId = ref(null);
const arquivoParaRemover = ref(null);

function abrirSeletor() {
    if (!upload.carregando) fileInput.value?.click();
}

async function aoSelecionaArquivo(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // limpa o input para permitir reenviar o mesmo arquivo
    if (file) {
        await upload.processarPlanilha(file);
    }
}

function pedirRemocao(arq) {
    arquivoParaRemover.value = arq;
}

async function confirmarRemocao() {
    const arq = arquivoParaRemover.value;
    if (!arq) return;

    removendoId.value = arq.id;
    try {
        if (arq.loteId) {
            const ok = await upload.removerLote(arq.loteId);
            if (!ok) upload.removerArquivoLocal(arq.id);
        } else {
            upload.removerArquivoLocal(arq.id);
        }
    } finally {
        removendoId.value = null;
        arquivoParaRemover.value = null;
    }
}
</script>

<template>
    <AppHeader />

    <main class="bg-[#f8fafc] min-h-screen px-page pb-12">
        <!-- Section para importar arquivos -->
        <section class="py-8 sm:py-10">
            <input ref="fileInput" type="file" class="hidden" accept=".xlsx, .xls, .csv" @change="aoSelecionaArquivo" />
            <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                    <h1 class="page-title">Upload de <span class="text-palette-mid-green">planilha</span></h1>
                    <p class="page-subtitle">
                        Envie sua planilha de clientes para atualizar seus indicadores e gráficos automaticamente
                    </p>
                </div>
                <a href="/planilha-modelo-clientes.csv" download="planilha-modelo-clientes.csv"
                    title="Arquivo de exemplo com as colunas esperadas para você preencher antes de importar"
                    class="inline-flex items-center gap-2 text-sm font-semibold text-[#3f5f5a] bg-white border border-gray-200 hover:border-palette-mid-green/60 hover:bg-palette-mid-green/5 px-4 py-2 rounded-lg transition-colors">
                    Baixar modelo de exemplo (.csv)
                </a>
            </div>

            <div class="flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-palette-mid-green/70 cursor-pointer py-12 hover:bg-palette-mid-green/5 transition-colors"
                :class="{ 'opacity-50 cursor-wait': upload.carregando }" @click="abrirSeletor">
                <img :src="uploadIcon" alt="Imagem de Upload" class="mb-4">
                <p class="font-light text-palette-chumbo">
                    <span class="text-[#3f5f5a] font-semibold underline">Escolha um arquivo</span> ou clique aqui para enviar
                </p>
                <p class="text-xs text-gray-500 mt-2">Formatos aceitos: XLSX, XLS e CSV</p>
            </div>

            <p v-if="upload.mensagemErro" class="mt-4 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 text-sm">
                {{ upload.mensagemErro }}
            </p>

            <p v-if="upload.mensagemSucesso" class="mt-4 text-[#2f5e4e] bg-[#e6f4ee] p-3 rounded-lg border border-[#84A98C] text-sm font-medium">
                ✓ {{ upload.mensagemSucesso }}
            </p>

            <!-- Barra de Progresso -->
            <div v-if="(upload.progresso > 0 && upload.progresso < 100) && upload.carregando" class="mt-8">
                <div class="flex justify-between text-sm text-palette-chumbo mb-1">
                    <span>Processando {{ upload.nomeArquivo }}...</span>
                    <span>{{ upload.progresso }}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div class="bg-[#84A98C] h-2.5 rounded-full transition-all duration-300" :style="{ width: upload.progresso + '%' }"></div>
                </div>
            </div>

            <!-- Cards de Histórico de Arquivos -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8" v-if="upload.historicoArquivos.length > 0">
                <div v-for="arq in upload.historicoArquivos.slice(0, 4)" :key="arq.id" class="card p-4 flex items-center gap-4">
                    <div class="bg-palette-mid-green/15 text-[#3f5f5a] text-[10px] font-bold rounded-lg flex items-center justify-center w-10 h-10 uppercase shrink-0">
                        {{ arq.extensao }}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-palette-chumbo truncate">{{ arq.nome }}</p>
                        <div class="flex flex-wrap items-center text-xs text-gray-500 mt-1 gap-2">
                            <span v-if="arq.status === 'Completo'">
                                {{ formatarTamanho(arq.tamanhoBytes) }}
                            </span>
                            <span v-else>
                                {{ formatarTamanho(arq.tamanhoBytes * (arq.progresso / 100)) }} de {{ formatarTamanho(arq.tamanhoBytes) }}
                            </span>

                            <span class="flex items-center gap-1 font-medium" :class="arq.status === 'Completo' ? 'text-green-700' : (arq.status === 'Erro' ? 'text-red-500' : 'text-gray-500')">
                                <template v-if="arq.status === 'Carregando'">
                                    <span class="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></span>
                                    Carregando
                                </template>
                                <template v-else-if="arq.status === 'Completo'">
                                    <span class="inline-flex items-center justify-center w-3.5 h-3.5 bg-palette-mid-green text-white rounded-full text-[9px]">✓</span>
                                    Enviado
                                </template>
                                <template v-else>
                                    Erro
                                </template>
                            </span>

                            <span v-if="arq.dataUpload">· {{ formatarDataHora(arq.dataUpload) }}</span>
                        </div>
                        <p v-if="arq.status === 'Erro' && arq.mensagemErro" class="text-xs text-red-500 mt-1">
                            {{ arq.mensagemErro }}
                        </p>
                    </div>
                    <button type="button" @click="pedirRemocao(arq)" :disabled="removendoId === arq.id"
                        :aria-label="`Remover ${arq.nome}`" title="Remover planilha"
                        class="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-40 cursor-pointer">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
            <RouterLink v-if="upload.historicoArquivos.length > 0" to="/historico" class="inline-block mt-4 text-sm font-semibold text-[#52796F] hover:underline">Ver histórico completo →</RouterLink>
        </section>

        <!-- Tabela de Apresentação de Dados -->
        <section v-if="upload.dadosTratados.length > 0">
            <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h3 class="text-xl font-bold text-palette-chumbo">Dados Importados</h3>
                <div class="flex flex-wrap items-center gap-3">
                    <RouterLink to="/dashboard" class="bg-palette-mid-green text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#6ba88a]">
                        Ir para Dashboard
                    </RouterLink>
                    <RouterLink to="/relatorio" class="bg-[#52796F] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#3f5f57]">
                        Ver Relatório de Qualidade
                    </RouterLink>
                </div>
            </div>

            <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table class="w-full border-collapse text-left text-sm text-gray-700">
                    <thead class="bg-[#84A98C] text-white">
                        <tr>
                            <th class="px-4 py-3 font-semibold">Código</th>
                            <th class="px-4 py-3 font-semibold">Nome</th>
                            <th class="px-4 py-3 font-semibold">Consultor</th>
                            <th class="px-4 py-3 font-semibold">Segmento</th>
                            <th class="px-4 py-3 font-semibold">Nível</th>
                            <th class="px-4 py-3 font-semibold">Faturamento</th>
                            <th class="px-4 py-3 font-semibold">Cidade / UF</th>
                            <th class="px-4 py-3 font-semibold">Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(cliente, index) in upload.dadosTratados.slice(0, 10)" :key="index"
                            class="border-t border-gray-100 hover:bg-gray-50">
                            <td class="px-4 py-3 font-medium">{{ cliente.codigo_cliente || '-' }}</td>
                            <td class="px-4 py-3">{{ cliente.nome_cliente || '-' }}</td>
                            <td class="px-4 py-3">{{ cliente.consultor || '-' }}</td>
                            <td class="px-4 py-3">{{ cliente.segmento || '-' }}</td>
                            <td class="px-4 py-3 font-semibold">{{ cliente.nivel_cliente || '-' }}</td>
                            <td class="px-4 py-3">{{ cliente.faturamento_anual || '-' }}</td>
                            <td class="px-4 py-3">{{ [cliente.cidade, cliente.uf].filter(Boolean).join(' / ') || '-' }}</td>
                            <td class="px-4 py-3">{{ cliente.data_contratacao || '-' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="text-xs text-gray-500 mt-2 text-right">Mostrando amostra dos dados (até 10 linhas).</p>
        </section>
    </main>

    <ConfirmModal
        :aberto="!!arquivoParaRemover"
        titulo="Remover planilha"
        :mensagem="arquivoParaRemover?.loteId
            ? `Tem certeza de que deseja remover '${arquivoParaRemover.nome}.${arquivoParaRemover.extensao.toLowerCase()}'? Os dados e indicadores desta planilha também serão excluídos.`
            : `Remover '${arquivoParaRemover?.nome}.${arquivoParaRemover?.extensao?.toLowerCase()}' da lista de envios recentes?`"
        texto-confirmar="Remover"
        variante="danger"
        :carregando="!!removendoId"
        @confirmar="confirmarRemocao"
        @cancelar="arquivoParaRemover = null"
    />
</template>

<style scoped></style>
