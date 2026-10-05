// ============================================================
// componentes/useAcoesPesquisa.ts — SuperRH
// Ações de uma pesquisa/campanha compartilhadas pela lista e pela tela de resultados:
// editar, duplicar (cria uma cópia e abre o editor), encerrar agora e excluir (com a consequência).
// Regras de texto/payload moram em helpers/pesquisa.ts; aqui só rede, toast e navegação.
// ============================================================

import { useRouter } from 'expo-router';
import { deleteSurvey, duplicarPesquisa, encerrarPesquisaAgora } from '../conexoes/pesquisas';
import { useToast } from '../contextos/Toast';
import { confirmAction } from '../helpers/confirm';
import { getTodayString } from '../helpers/datas';
import { AREAS_PESQUISA, AreaPesquisa, textoExclusaoPesquisa } from '../helpers/pesquisa';
import type { PulseSurvey } from '../tipos/modelos';

type PesquisaResumo = Pick<PulseSurvey, 'id' | 'title' | 'response_count'>;

function mensagem(e: unknown, padrao: string): string {
  return e instanceof Error && e.message ? e.message : padrao;
}

/** `aposMudar` recarrega a tela depois de encerrar/excluir. */
export function useAcoesPesquisa(area: AreaPesquisa, aposMudar: () => void) {
  const cfg = AREAS_PESQUISA[area];
  const substantivo = area === 'nps' ? 'campanha' : 'pesquisa';
  const router = useRouter();
  const toast = useToast();

  function editar(s: PesquisaResumo) {
    router.push(cfg.rotaEditar(s.id) as never);
  }

  async function duplicar(s: PesquisaResumo) {
    try {
      const copia = await duplicarPesquisa(s.id);
      toast.success(`Cópia criada: "${copia.title}". Ajuste o que quiser e salve.`);
      router.push(cfg.rotaEditar(copia.id) as never);
    } catch (e: unknown) {
      toast.error(mensagem(e, `Não foi possível duplicar ${substantivo === 'campanha' ? 'a campanha' : 'a pesquisa'}.`));
    }
  }

  function encerrarAgora(s: PesquisaResumo) {
    confirmAction('Encerrar agora', `"${s.title}" deixa de receber respostas hoje. Deseja encerrar?`, async () => {
      try {
        await encerrarPesquisaAgora(s.id, getTodayString());
        toast.success(`${substantivo === 'campanha' ? 'Campanha encerrada' : 'Pesquisa encerrada'}.`);
        aposMudar();
      } catch (e: unknown) {
        toast.error(mensagem(e, 'Não foi possível encerrar.'));
      }
    });
  }

  function excluir(s: PesquisaResumo) {
    confirmAction(`Excluir "${s.title}"?`, textoExclusaoPesquisa(s.response_count ?? 0, substantivo), async () => {
      try {
        await deleteSurvey(s.id);
        aposMudar();
      } catch (e: unknown) {
        toast.error(mensagem(e, `Erro ao excluir ${cfg.singular}`));
      }
    });
  }

  return { editar, duplicar, encerrarAgora, excluir };
}
