-- ============================================================
-- ReCUPera - Dashboard Regionale CUP
-- Migrazione 00001: Schema iniziale
-- ============================================================

-- Estensioni necessarie
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- Tabella: asl
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asl (
    id          CHAR(6) PRIMARY KEY,
    sigla       VARCHAR(10) NOT NULL UNIQUE,
    nome        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed ASL Regione Puglia
INSERT INTO public.asl (id, sigla, nome) VALUES
    ('160114', 'BA', 'ASL Bari'),
    ('160115', 'FG', 'ASL Foggia'),
    ('160116', 'LE', 'ASL Lecce'),
    ('160112', 'TA', 'ASL Taranto'),
    ('160113', 'BT', 'ASL Barletta-Andria-Trani'),
    ('160106', 'BR', 'ASL Brindisi')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Tabella: prestazione
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prestazione (
    id              SERIAL PRIMARY KEY,
    codice          VARCHAR(50) NOT NULL UNIQUE,
    descrizione     TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Tabella: rilevazione_settimanale
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rilevazione_settimanale (
    id                  BIGSERIAL PRIMARY KEY,
    asl_id              CHAR(6) NOT NULL REFERENCES public.asl(id) ON DELETE CASCADE,
    prestazione_id      INTEGER NOT NULL REFERENCES public.prestazione(id) ON DELETE CASCADE,
    anno                INTEGER NOT NULL,
    settimana           INTEGER NOT NULL CHECK (settimana BETWEEN 1 AND 53),
    prenotazioni        INTEGER DEFAULT 0,
    da_garantire        INTEGER DEFAULT 0,
    b_tot               INTEGER DEFAULT 0,
    b_fuori_tmax        INTEGER DEFAULT 0,
    d_tot               INTEGER DEFAULT 0,
    d_fuori_tmax        INTEGER DEFAULT 0,
    p_tot               INTEGER DEFAULT 0,
    p_fuori_tmax        INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (asl_id, prestazione_id, settimana)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_rilevazione_asl ON public.rilevazione_settimanale(asl_id);
CREATE INDEX IF NOT EXISTS idx_rilevazione_prestazione ON public.rilevazione_settimanale(prestazione_id);
CREATE INDEX IF NOT EXISTS idx_rilevazione_settimana ON public.rilevazione_settimanale(settimana);
CREATE INDEX IF NOT EXISTS idx_rilevazione_anno_settimana ON public.rilevazione_settimanale(anno, settimana);

-- ------------------------------------------------------------
-- Vista: kpi_territorio
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.kpi_territorio AS
SELECT
    a.id AS asl_id,
    a.sigla AS asl_sigla,
    a.nome AS asl_nome,
    r.anno,
    r.settimana,
    SUM(r.prenotazioni) AS totale_prenotazioni,
    SUM(r.da_garantire) AS totale_da_garantire,
    SUM(r.b_tot) AS totale_b_tot,
    SUM(r.b_fuori_tmax) AS totale_b_fuori_tmax,
    SUM(r.d_tot) AS totale_d_tot,
    SUM(r.d_fuori_tmax) AS totale_d_fuori_tmax,
    SUM(r.p_tot) AS totale_p_tot,
    SUM(r.p_fuori_tmax) AS totale_p_fuori_tmax,
    CASE
        WHEN SUM(r.b_tot) > 0
        THEN ROUND((SUM(r.b_fuori_tmax)::NUMERIC / SUM(r.b_tot)) * 100, 2)
        ELSE 0
    END AS percentuale_b_fuori_soglia,
    CASE
        WHEN SUM(r.d_tot) > 0
        THEN ROUND((SUM(r.d_fuori_tmax)::NUMERIC / SUM(r.d_tot)) * 100, 2)
        ELSE 0
    END AS percentuale_d_fuori_soglia,
    CASE
        WHEN SUM(r.p_tot) > 0
        THEN ROUND((SUM(r.p_fuori_tmax)::NUMERIC / SUM(r.p_tot)) * 100, 2)
        ELSE 0
    END AS percentuale_p_fuori_soglia
FROM public.rilevazione_settimanale r
JOIN public.asl a ON r.asl_id = a.id
GROUP BY a.id, a.sigla, a.nome, r.anno, r.settimana;

-- ------------------------------------------------------------
-- Row Level Security (RLS)
-- ------------------------------------------------------------

-- Abilitazione RLS su tutte le tabelle
ALTER TABLE public.asl ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestazione ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rilevazione_settimanale ENABLE ROW LEVEL SECURITY;

-- Policy: lettura pubblica/anon per tabelle
CREATE POLICY "Lettura pubblica ASL"
    ON public.asl FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Lettura pubblica Prestazioni"
    ON public.prestazione FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Lettura pubblica Rilevazioni"
    ON public.rilevazione_settimanale FOR SELECT
    TO anon, authenticated
    USING (true);

-- Policy: scrittura solo service_role
CREATE POLICY "Scrittura service_role ASL"
    ON public.asl FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Scrittura service_role Prestazioni"
    ON public.prestazione FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Scrittura service_role Rilevazioni"
    ON public.rilevazione_settimanale FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------
-- Funzione: trigger per updated_at automatico
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rilevazione_updated_at
    BEFORE UPDATE ON public.rilevazione_settimanale
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
