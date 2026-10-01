import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getAsl,
  getHotspot,
  getPrestazioni,
  getRiassegnazioni,
  getSerie,
  postProiezione,
} from '../lib/api.js';

// Hook pronti per Parti 3-6. Tutti con loading/error/empty (obbligo AGENTS.md §5.3).
// Nessuna UI qui: solo queryKey + fetcher. La UI arriva nelle rispettive parti.

export function useAsl() {
  return useQuery({ queryKey: ['asl'], queryFn: getAsl });
}

export function usePrestazioni(q) {
  return useQuery({
    queryKey: ['prestazioni', q || ''],
    queryFn: () => getPrestazioni(q),
  });
}

export function useHotspot(settimana) {
  return useQuery({
    queryKey: ['hotspot', settimana || 'default'],
    queryFn: () => getHotspot(settimana),
  });
}

export function useSerie({ giorni = 30, asl = '', prestazione = '' } = {}) {
  return useQuery({
    // Nota dataset: 1 sola settimana → la UI (Parte 3) deve mostrare
    // 1 punto + nota dati insufficienti, mai inventare 30 punti.
    queryKey: ['serie', giorni, asl, prestazione],
    queryFn: () => getSerie({ giorni, asl, prestazione }),
  });
}

export function useRiassegnazioni(limit = 10) {
  return useQuery({
    queryKey: ['riassegnazioni', limit],
    queryFn: () => getRiassegnazioni(limit),
  });
}

export function useProiezione() {
  // POST /simulatori/proiezione { da_asl, a_asl, ore } — validazione in api.js (2..20, da!=a)
  return useMutation({
    mutationFn: postProiezione,
  });
}
