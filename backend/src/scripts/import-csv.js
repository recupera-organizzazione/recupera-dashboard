import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { supabase } from '../db/supabaseClient.js';

const CSV_PATH = path.resolve(process.cwd(), '../data/monitoraggio-tempi-di-attesa-07_11-ottobre-2024.csv');

async function importCSV() {
  console.log(`Avvio importazione da: ${CSV_PATH}`);
  
  if (!fs.existsSync(CSV_PATH)) {
    console.error('File CSV non trovato.');
    process.exit(1);
  }

  const parser = fs.createReadStream(CSV_PATH, { encoding: 'latin1' })
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true
    }));

  const prestazioniMap = new Map();
  const rilevazioni = [];

  for await (const row of parser) {
    // Fix encoding bug noto
    let descrizione = row['DESC_PRESTAZIONE'].replace('', '’');
    
    prestazioniMap.set(row['ID_PRESTAZIONE'], {
      id: parseInt(row['ID_PRESTAZIONE'], 10),
      descrizione: descrizione,
      codice: row['COD_PRESTAZIONE']
    });

    rilevazioni.push({
      asl_id: row['ASL'],
      prestazione_id: parseInt(row['ID_PRESTAZIONE'], 10),
      anno: parseInt(row['ANNO'], 10),
      settimana: row['SETTIMANA_INDICE'],
      prenotazioni: parseInt(row['PRENOTAZIONI'] || '0', 10),
      da_garantire: parseInt(row['PRENOTAZIONI_DAGARANTIRE'] || '0', 10),
      b_tot: parseInt(row['PRENOTAZIONI_DAGARANTIRE_B'] || '0', 10),
      b_fuori_tmax: parseInt(row['PRENOTAZIONI_DAGARANTIRE_B_TMAX'] || '0', 10),
      d_tot: parseInt(row['PRENOTAZIONI_DAGARANTIRE_D'] || '0', 10),
      d_fuori_tmax: parseInt(row['PRENOTAZIONI_DAGARANTIRE_D_TMAX'] || '0', 10),
      p_tot: parseInt(row['PRENOTAZIONI_DAGARANTIRE_P'] || '0', 10),
      p_fuori_tmax: parseInt(row['PRENOTAZIONI_DAGARANTIRE_P_TMAX'] || '0', 10)
    });
  }

  const prestazioniArray = Array.from(prestazioniMap.values());
  
  console.log(`Trovate ${prestazioniArray.length} prestazioni univoche. Upsert in corso...`);
  const { error: errPrestazioni } = await supabase
    .from('prestazione')
    .upsert(prestazioniArray, { onConflict: 'id' });
    
  if (errPrestazioni) throw new Error(`Errore upsert prestazioni: ${errPrestazioni.message}`);

  console.log(`Trovate ${rilevazioni.length} rilevazioni. Upsert in corso...`);
  const { error: errRilevazioni } = await supabase
    .from('rilevazione_settimanale')
    .upsert(rilevazioni, { onConflict: 'asl_id, prestazione_id, settimana' });
    
  if (errRilevazioni) throw new Error(`Errore upsert rilevazioni: ${errRilevazioni.message}`);

  console.log('Importazione completata con successo.');
  process.exit(0);
}

importCSV().catch(err => {
  console.error(err);
  process.exit(1);
});
