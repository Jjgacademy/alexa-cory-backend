-- ============================
-- ESTRUCTURA INICIAL ALEXA CORY
-- ============================

-- USERS
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    reset_token TEXT,
    reset_token_expires TIMESTAMP,
    reset_code VARCHAR(6),
    reset_code_expires TIMESTAMP,
    plan VARCHAR(20) DEFAULT 'gratis',
    metodo_pago VARCHAR(20)
);

-- INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    tipo_comprobante VARCHAR(50),
    numero VARCHAR(50),
    ruc_proveedor VARCHAR(13),
    nombre_proveedor VARCHAR(150),
    fecha_emision DATE NOT NULL,
    base_iva NUMERIC(14,2) DEFAULT 0,
    base_cero NUMERIC(14,2) DEFAULT 0,
    iva NUMERIC(14,2) DEFAULT 0,
    retencion_iva NUMERIC(14,2) DEFAULT 0,
    retencion_renta NUMERIC(14,2) DEFAULT 0,
    total NUMERIC(14,2) NOT NULL,
    moneda VARCHAR(10) DEFAULT 'USD',
    creado_en TIMESTAMP DEFAULT now(),
    categoria VARCHAR(100) DEFAULT 'SIN CLASIFICAR',
    clave_acceso VARCHAR(64),
    texto_ocr TEXT,
    confianza_ocr NUMERIC(5,2) DEFAULT 0,
    estado_ocr VARCHAR(20) DEFAULT 'PENDIENTE',
    direccion_matriz TEXT,
    direccion_establecimiento TEXT,
    contribuyente_especial TEXT,
    obligado_contabilidad VARCHAR(2),
    direccion_cliente TEXT,
    placa_matricula VARCHAR(20),
    informacion_adicional JSONB
);

-- INVOICE DETAILS
CREATE TABLE IF NOT EXISTS public.invoice_details (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER,
    codigo_principal VARCHAR(50),
    codigo_auxiliar VARCHAR(50),
    cantidad NUMERIC(12,4),
    descripcion TEXT,
    precio_unitario NUMERIC(12,4),
    descuento NUMERIC(12,2),
    precio_total_sin_impuesto NUMERIC(12,2)
);

-- PAYMENT METHODS
CREATE TABLE IF NOT EXISTS public.payment_methods (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(150) NOT NULL
);

-- REMINDERS
CREATE TABLE IF NOT EXISTS public.reminders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    fecha_vencimiento DATE NOT NULL,
    enviado BOOLEAN DEFAULT false,
    creado_en TIMESTAMP DEFAULT now()
);

-- RUC RAZON SOCIAL
CREATE TABLE IF NOT EXISTS public.ruc_razon_social (
    id SERIAL PRIMARY KEY,
    ruc VARCHAR(13) NOT NULL UNIQUE,
    razon_social VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    CONSTRAINT chk_ruc_len CHECK (length(ruc) IN (10,13))
);

-- TAX INTEGRATIONS
CREATE TABLE IF NOT EXISTS public.tax_integrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    sistema VARCHAR(50) NOT NULL,
    identificador VARCHAR(50),
    token_acceso TEXT,
    creado_en TIMESTAMP DEFAULT now()
);
