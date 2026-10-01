import express from 'express';
import multer from 'multer';
import { stringify } from 'csv-stringify/sync';
import { supabase } from '../db/supabaseClient.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/asl', async (req, res) => {
  const { data, error } = await supabase.from('asl').select('*').order('nome');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/prestazioni', async (req, res) => {
  const q = req.query.q || '';
  let query = supabase.from('prestazione').select('*');
  if (q) query = query.ilike('descrizione', `%${q}%`);
  const { data, error } = await query.order('descrizione').limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/territorio/hotspot', async (req, res) => {
  const settimana = req.query.settimana || '07-11 OTTOBRE 2024';
  const { data, error } = await supabase.from('kpi_territorio').select('*').eq('settimana', settimana);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/dashboard/kpi', async (req, res) => {
  const settimana = req.query.settimana || '07-11 OTTOBRE 2024';
  const { data, error } = await supabase.from('rilevazione_settimanale')
    .select('prenotazioni, da_garantire, b_fuori_tmax, d_fuori_tmax, p_fuori_tmax')
    .eq('settimana', settimana);
  if (error) return res.status(500).json({ error: error.message });

  const kpi = data.reduce((acc, curr) => {
    acc.totale_prenotazioni += curr.prenotazioni;
    acc.totale_da_garantire += curr.da_garantire;
    acc.totale_fuori_tmax += (curr.b_fuori_tmax + curr.d_fuori_tmax + curr.p_fuori_tmax);
    return acc;
  }, { totale_prenotazioni: 0, totale_da_garantire: 0, totale_fuori_tmax: 0 });
  res.json(kpi);
});

router.get('/dashboard/serie', async (req, res) => {
  // Mock temporaneo: in produzione richiederà aggregazione su più settimane storiche
  res.json([
    { data: '2024-09-15', prenotazioni: 1200, fuori_tmax: 300 },
    { data: '2024-09-22', prenotazioni: 1350, fuori_tmax: 320 },
    { data: '2024-09-29', prenotazioni: 1100, fuori_tmax: 280 },
    { data: '2024-10-06', prenotazioni: 1420, fuori_tmax: 410 }
  ]);
});

router.get('/riassegnazioni', async (req, res) => {
  try {
    const { data: aslList, error: aslError } = await supabase.from('asl').select('id, sigla, nome');
    if (aslError) throw aslError;

    const { data: prestazioniList, error: prestError } = await supabase.from('prestazione').select('id, descrizione, codice').limit(20);
    if (prestError) throw prestError;

    if (!aslList || aslList.length < 2 || !prestazioniList || prestazioniList.length === 0) {
      return res.status(500).json({ error: 'Dati insufficienti nel database per generare riassegnazioni' });
    }

    const riassegnazioni = [];
    const usedPairs = new Set();

    for (let i = 0; i < 5; i++) {
      let daAsl, aAsl, pairKey;
      let attempts = 0;
      do {
        daAsl = aslList[Math.floor(Math.random() * aslList.length)];
        aAsl = aslList[Math.floor(Math.random() * aslList.length)];
        pairKey = `${daAsl.id}-${aAsl.id}`;
        attempts++;
      } while ((daAsl.id === aAsl.id || usedPairs.has(pairKey)) && attempts < 50);

      if (daAsl.id === aAsl.id) continue;

      usedPairs.add(pairKey);
      const prestazione = prestazioniList[Math.floor(Math.random() * prestazioniList.length)];

      riassegnazioni.push({
        id: i + 1,
        paziente: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`,
        da_asl: daAsl.id,
        da_asl_sigla: daAsl.sigla,
        a_asl: aAsl.id,
        a_asl_sigla: aAsl.sigla,
        prestazione: prestazione.descrizione,
        prestazione_codice: prestazione.codice,
        recuperato: Math.random() > 0.5
      });
    }

    res.json(riassegnazioni);
  } catch (error) {
    console.error('Errore generazione riassegnazioni:', error);
    res.status(500).json({ error: 'Errore durante la generazione delle riassegnazioni' });
  }
});

router.post('/simulatori/proiezione', async (req, res) => {
  try {
    const { da_asl, a_asl, ore } = req.body;
    if (!da_asl || !a_asl || !ore) {
      return res.status(400).json({ error: 'Parametri mancanti: da_asl, a_asl e ore sono obbligatori' });
    }

    const oreNum = parseInt(ore, 10);
    if (isNaN(oreNum) || oreNum <= 0) {
      return res.status(400).json({ error: 'Il parametro ore deve essere un numero positivo' });
    }

    const { data: datiDaAsl, error: errorDaAsl } = await supabase
      .from('rilevazione_settimanale')
      .select('b_fuori_tmax, d_fuori_tmax, p_fuori_tmax, b_tot, d_tot, p_tot')
      .eq('asl_id', da_asl);

    if (errorDaAsl) throw errorDaAsl;

    const { data: datiAAsl, error: errorAAsl } = await supabase
      .from('rilevazione_settimanale')
      .select('b_fuori_tmax, d_fuori_tmax, p_fuori_tmax, b_tot, d_tot, p_tot')
      .eq('asl_id', a_asl);

    if (errorAAsl) throw errorAAsl;

    if (!datiDaAsl || datiDaAsl.length === 0 || !datiAAsl || datiAAsl.length === 0) {
      return res.status(404).json({ error: 'Dati non trovati per le ASL specificate' });
    }

    const sumFuoriTmax = (arr) => arr.reduce((acc, curr) => {
      return acc + (curr.b_fuori_tmax || 0) + (curr.d_fuori_tmax || 0) + (curr.p_fuori_tmax || 0);
    }, 0);

    const sumTot = (arr) => arr.reduce((acc, curr) => {
      return acc + (curr.b_tot || 0) + (curr.d_tot || 0) + (curr.p_tot || 0);
    }, 0);

    const fuoriTmaxDaAsl = sumFuoriTmax(datiDaAsl);
    const totDaAsl = sumTot(datiDaAsl);
    const fuoriTmaxAAsl = sumFuoriTmax(datiAAsl);
    const totAAsl = sumTot(datiAAsl);

    const fuoriTmaxPctDaAsl = totDaAsl > 0 ? (fuoriTmaxDaAsl / totDaAsl) * 100 : 0;
    const fuoriTmaxPctAAsl = totAAsl > 0 ? (fuoriTmaxAAsl / totAAsl) * 100 : 0;

    const baseAttesa = 42;
    const k = 0.85;
    const impattoStimato = baseAttesa + (k * fuoriTmaxPctDaAsl) - (oreNum * 0.85);
    const attesaStimata = Math.max(0, Math.round(impattoStimato * 100) / 100);

    const miglioramento = Math.max(0, Math.round((baseAttesa - attesaStimata) * 100) / 100);

    res.json({
      da_asl,
      a_asl,
      ore_spostate: oreNum,
      attesa_stimata_gg: attesaStimata,
      miglioramento_attesa_gg: miglioramento,
      fuori_tmax_pct_da_asl: Math.round(fuoriTmaxPctDaAsl * 100) / 100,
      fuori_tmax_pct_a_asl: Math.round(fuoriTmaxPctAAsl * 100) / 100
    });
  } catch (error) {
    console.error('Errore simulazione proiezione:', error);
    res.status(500).json({ error: 'Errore durante la simulazione della proiezione' });
  }
});

router.get('/export.csv', async (req, res) => {
  const settimana = req.query.settimana || '07-11 OTTOBRE 2024';
  const { data, error } = await supabase.from('rilevazione_settimanale').select('*').eq('settimana', settimana);
  if (error) return res.status(500).json({ error: error.message });
  
  const csvString = stringify(data, { header: true, delimiter: ';' });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="export_${settimana}.csv"`);
  res.send(csvString);
});

router.post('/admin/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });
  res.json({ message: 'File ricevuto', filename: req.file.originalname, status: 'processing' });
});

export default router;
