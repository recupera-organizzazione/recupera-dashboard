// Uso: ADMIN_USER=admin ADMIN_PASSWORD='<password-forte>' npm run create:admin
// Crea/aggiorna l'account admin singolo: salva SOLO l'hash scrypt in
// public.admin_users (upsert per username). La password non viene mai
// stampata né scritta in repo. Richiede SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
import 'dotenv/config';
import { hashPassword } from '../auth.js';
import { hasServiceRole, supabase } from '../db/supabaseClient.js';

const username = process.env.ADMIN_USER || 'admin';
const password = process.env.ADMIN_PASSWORD;

if (!password || password.length < 12) {
  console.error('ADMIN_PASSWORD assente o < 12 caratteri: esportala nel shell (mai in repo, mai in history).');
  process.exit(1);
}
if (!hasServiceRole) {
  console.error('SUPABASE_URL/SERVICE_ROLE assenti: impossibile scrivere su admin_users.');
  process.exit(1);
}

const { error } = await supabase
  .from('admin_users')
  .upsert({ username, password_hash: hashPassword(password) }, { onConflict: 'username' });
if (error) {
  console.error('Errore scrittura admin_users:', error.message);
  process.exit(1);
}
console.log(`Account admin '${username}' creato/aggiornato (solo hash archiviato).`);
