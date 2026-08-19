const MEUDANFE_BASE_URL = "https://api.meudanfe.com.br/v2";
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60_000;
const PROVIDER_TIMEOUT_MS = 28_000;
const STATUS_INTERVAL_MS = 1_100;
const STATUS_MAX_ATTEMPTS = 18;
const requestBuckets = new Map();
const activeKeys = new Set();
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Content-Security-Policy": "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; upgrade-insecure-requests",
};

function applySecurityHeaders(headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return headers;
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  const headers = applySecurityHeaders(new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    ...extraHeaders,
  }));
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    return originUrl.protocol === url.protocol && originUrl.host === url.host;
  } catch {
    return false;
  }
}

function consumeRateLimit(request) {
  const now = Date.now();
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  let bucket = requestBuckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
  }

  bucket.count += 1;
  requestBuckets.set(ip, bucket);

  if (requestBuckets.size > 2_000) {
    for (const [key, value] of requestBuckets) {
      if (now >= value.resetAt) requestBuckets.delete(key);
    }
  }

  return {
    allowed: bucket.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - bucket.count),
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  };
}

function isValidAccessKey(chave) {
  if (!/^\d{44}$/.test(chave) || /^(\d)\1{43}$/.test(chave)) return false;

  let sum = 0;
  let weight = 2;
  for (let index = 42; index >= 0; index -= 1) {
    sum += Number(chave[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const digit = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return digit === Number(chave[43]);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readProviderJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function providerError(status, retryAfter) {
  const headers = retryAfter ? { "Retry-After": retryAfter } : {};

  if (status === 400) {
    return jsonResponse(
      { error: "chave_invalida", message: "A chave foi recusada pelo serviço de consulta." },
      400,
    );
  }

  if (status === 401 || status === 403) {
    return jsonResponse(
      { error: "integracao_nao_configurada", message: "A consulta por chave precisa ser reconfigurada pelo administrador." },
      503,
    );
  }

  if (status === 402) {
    return jsonResponse(
      { error: "saldo_insuficiente", message: "O limite disponível para consultas foi atingido. Tente novamente mais tarde." },
      402,
    );
  }

  if (status === 404) {
    return jsonResponse(
      { error: "documento_nao_encontrado", message: "Documento não encontrado para esta chave." },
      404,
    );
  }

  if (status === 429) {
    return jsonResponse(
      { error: "muitas_solicitacoes", message: "O serviço está recebendo muitas consultas. Aguarde e tente novamente." },
      429,
      headers,
    );
  }

  return jsonResponse(
    { error: "servico_indisponivel", message: "O serviço de consulta está indisponível no momento." },
    502,
  );
}

async function consultarMeuDanfe(chave, apiKey, signal) {
  const encodedKey = encodeURIComponent(chave);
  const headers = new Headers({
    "Api-Key": apiKey,
    Accept: "application/json",
  });
  const addUrl = `${MEUDANFE_BASE_URL}/fd/add/${encodedKey}`;

  let searchData = {};
  for (let attempt = 0; attempt <= STATUS_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await delay(STATUS_INTERVAL_MS);

    const response = await fetch(addUrl, {
      method: "PUT",
      headers,
      signal,
    });

    if (!response.ok) {
      return {
        response: providerError(response.status, response.headers.get("Retry-After")),
      };
    }

    searchData = await readProviderJson(response);
    const status = String(searchData.status || "").toUpperCase();

    if (status === "OK") break;
    if (status === "NOT_FOUND") {
      return {
        response: jsonResponse(
          { error: "documento_nao_encontrado", message: "Documento não encontrado para esta chave." },
          404,
        ),
      };
    }
    if (status === "ERROR") {
      return {
        response: jsonResponse(
          { error: "falha_na_consulta", message: "Não foi possível localizar este documento." },
          502,
        ),
      };
    }
    if (status !== "WAITING" && status !== "SEARCHING") {
      return {
        response: jsonResponse(
          { error: "resposta_invalida", message: "O serviço retornou uma resposta inesperada." },
          502,
        ),
      };
    }

    if (attempt === STATUS_MAX_ATTEMPTS) {
      return {
        response: jsonResponse(
          { error: "consulta_em_processamento", message: "A consulta ainda está em processamento. Aguarde e tente novamente." },
          504,
          { "Retry-After": "5" },
        ),
      };
    }
  }

  const [pdfResponse, xmlResponse] = await Promise.all([
    fetch(`${MEUDANFE_BASE_URL}/fd/get/da/${encodedKey}`, { headers, signal }),
    fetch(`${MEUDANFE_BASE_URL}/fd/get/xml/${encodedKey}`, { headers, signal }),
  ]);

  if (!pdfResponse.ok) {
    return {
      response: providerError(pdfResponse.status, pdfResponse.headers.get("Retry-After")),
    };
  }
  if (!xmlResponse.ok) {
    return {
      response: providerError(xmlResponse.status, xmlResponse.headers.get("Retry-After")),
    };
  }

  const [pdfData, xmlData] = await Promise.all([
    readProviderJson(pdfResponse),
    readProviderJson(xmlResponse),
  ]);

  if (typeof pdfData.data !== "string" || typeof xmlData.data !== "string") {
    return {
      response: jsonResponse(
        { error: "documento_incompleto", message: "A consulta não retornou o DANFE/DACTE e o XML completos." },
        502,
      ),
    };
  }

  return {
    data: {
      chave,
      tipo: String(searchData.type || pdfData.type || xmlData.type || "").toUpperCase(),
      pdf_base64: pdfData.data,
      xml: xmlData.data,
    },
  };
}

async function consultarChave(request, env) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: "POST, OPTIONS",
        "Cache-Control": "no-store",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { error: "metodo_nao_permitido", message: "Use uma solicitação POST." },
      405,
      { Allow: "POST, OPTIONS" },
    );
  }

  if (!sameOrigin(request, url)) {
    return jsonResponse(
      { error: "origem_nao_autorizada", message: "Solicitação não autorizada." },
      403,
    );
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse(
      { error: "conteudo_invalido", message: "Envie os dados em formato JSON." },
      415,
    );
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 2_048) {
    return jsonResponse(
      { error: "solicitacao_muito_grande", message: "Solicitação acima do limite permitido." },
      413,
    );
  }

  let rawPayload;
  try {
    rawPayload = await request.text();
  } catch {
    return jsonResponse(
      { error: "json_invalido", message: "Não foi possível ler a solicitação." },
      400,
    );
  }

  if (new TextEncoder().encode(rawPayload).byteLength > 2_048) {
    return jsonResponse(
      { error: "solicitacao_muito_grande", message: "Solicitação acima do limite permitido." },
      413,
    );
  }

  let payload;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return jsonResponse(
      { error: "json_invalido", message: "Não foi possível ler a solicitação." },
      400,
    );
  }

  const chave = String(payload?.chave || "").replace(/\D/g, "");
  if (!isValidAccessKey(chave)) {
    return jsonResponse(
      { error: "chave_invalida", message: "Informe uma chave de acesso válida com 44 números." },
      400,
    );
  }

  const modelo = chave.slice(20, 22);
  if (modelo !== "55" && modelo !== "57") {
    return jsonResponse(
      { error: "modelo_nao_suportado", message: "A consulta aceita NF-e modelo 55 e CT-e modelo 57." },
      400,
    );
  }

  if (!env.MEUDANFE_API_KEY) {
    return jsonResponse(
      { error: "integracao_nao_configurada", message: "A consulta por chave ainda não foi ativada pelo administrador." },
      503,
    );
  }

  const rate = consumeRateLimit(request);
  if (!rate.allowed) {
    return jsonResponse(
      { error: "muitas_solicitacoes", message: "Limite de 3 consultas a cada 10 minutos. Aguarde e tente novamente." },
      429,
      { "Retry-After": String(rate.retryAfter) },
    );
  }

  if (activeKeys.has(chave)) {
    return jsonResponse(
      { error: "consulta_em_andamento", message: "Esta chave já está sendo consultada. Aguarde alguns segundos." },
      409,
      { "Retry-After": "3" },
    );
  }

  activeKeys.add(chave);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const result = await consultarMeuDanfe(chave, env.MEUDANFE_API_KEY, controller.signal);
    if (result.response) return result.response;

    return jsonResponse(result.data, 200, {
      "X-RateLimit-Remaining": String(rate.remaining),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return jsonResponse(
      {
        error: timedOut ? "tempo_esgotado" : "servico_indisponivel",
        message: timedOut
          ? "A consulta demorou mais que o esperado. Tente novamente."
          : "O serviço de consulta está indisponível no momento.",
      },
      timedOut ? 504 : 502,
    );
  } finally {
    clearTimeout(timeout);
    activeKeys.delete(chave);
  }
}


/* ProcurandoDashboardBI - checkout Pix isolado da página de DANFE/DACTE. */
const MP_ORDERS_BASE_URL = "https://api.mercadopago.com/v1/orders";
const DASHBOARD_PUBLIC_ORIGIN = "https://procurandodanfe.com.br";
const DASHBOARD_STATUS_TOKEN_TTL_MS = 24 * 60 * 60_000;
const DASHBOARD_DOWNLOAD_TTL_MS = 7 * 24 * 60 * 60_000;
const DASHBOARD_RATE_WINDOW_MS = 15 * 60_000;
const DASHBOARD_MAX_PER_IP = 5;
const DASHBOARD_MAX_PER_EMAIL = 4;
const DASHBOARD_MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;
let dashboardSchemaReadyPromise = null;

const DASHBOARD_PRODUCTS = Object.freeze({
  "financeiro-empresarial": Object.freeze({ name: "Financeiro Empresarial", priceCents: 3990, fileKey: "dashboards/financeiro-empresarial.pbip", fileName: "financeiro-empresarial.pbip" }),
  "contas-a-pagar": Object.freeze({ name: "Contas a Pagar", priceCents: 2990, fileKey: "dashboards/contas-a-pagar.pbip", fileName: "contas-a-pagar.pbip" }),
  "vendas-e-faturamento": Object.freeze({ name: "Vendas e Faturamento", priceCents: 3990, fileKey: "dashboards/comercial/Vendas_e_Faturamento.zip", fileName: "Vendas_e_Faturamento.zip" }),
  "controle-escolar": Object.freeze({ name: "Controle Escolar", priceCents: 2990, fileKey: "dashboards/controle-escolar.pbip", fileName: "controle-escolar.pbip" }),
  "arquitetura-e-obras": Object.freeze({ name: "Arquitetura e Obras", priceCents: 3990, fileKey: "dashboards/arquitetura-e-obras.pbip", fileName: "arquitetura-e-obras.pbip" }),
  "financas-pessoais-2": Object.freeze({ name: "Finanças Pessoais Pro", priceCents: 1990, fileKey: "dashboards/financas-pessoais-2.pbip", fileName: "financas-pessoais-2.pbip" }),
  "fluxo-de-caixa": Object.freeze({ name: "Fluxo de Caixa", priceCents: 2490, fileKey: "dashboards/fluxo-de-caixa.pbip", fileName: "fluxo-de-caixa.pbip" }),
  "gestao-de-estoque": Object.freeze({ name: "Gestão de Estoque", priceCents: 3490, fileKey: "dashboards/gestao-de-estoque.pbip", fileName: "gestao-de-estoque.pbip" }),
  "rh-indicadores": Object.freeze({ name: "Recursos Humanos", priceCents: 3990, fileKey: "dashboards/rh-indicadores.pbip", fileName: "rh-indicadores.pbip" }),
  "controle-de-projetos": Object.freeze({ name: "Projetos e Engenharia (PMO)", priceCents: 3490, fileKey: "dashboards/controle-de-projetos.pbip", fileName: "controle-de-projetos.pbip" }),
  "financeiro-bancario": Object.freeze({ name: "Financeiro Bancário", priceCents: 1990, fileKey: "dashboards/financeiro-bancario.pbip", fileName: "financeiro-bancario.pbip" }),
  "carteira-de-investimentos": Object.freeze({ name: "Carteira de Investimentos", priceCents: 2490, fileKey: "dashboards/carteira-de-investimentos.pbip", fileName: "carteira-de-investimentos.pbip" }),
  "dividendos-renda-passiva": Object.freeze({ name: "Dividendos e Renda Passiva", priceCents: 1990, fileKey: "dashboards/dividendos-renda-passiva.pbip", fileName: "dividendos-renda-passiva.pbip" }),
  "acoes-e-fiis": Object.freeze({ name: "Ações e FIIs", priceCents: 2490, fileKey: "dashboards/acoes-e-fiis.pbip", fileName: "acoes-e-fiis.pbip" }),
  "criptomoedas": Object.freeze({ name: "Criptomoedas", priceCents: 1990, fileKey: "dashboards/criptomoedas.pbip", fileName: "criptomoedas.pbip" }),
  "contas-a-receber": Object.freeze({ name: "Contas a Receber", priceCents: 2990, fileKey: "dashboards/contabilidade/Contas_a_Receber.zip", fileName: "Contas_a_Receber.zip" }),
  "dre-gerencial": Object.freeze({ name: "DRE Gerencial", priceCents: 3990, fileKey: "dashboards/dre-gerencial.pbip", fileName: "dre-gerencial.pbip" }),
  "orcamento-empresarial": Object.freeze({ name: "Orçamento Empresarial", priceCents: 3490, fileKey: "dashboards/orcamento-empresarial.pbip", fileName: "orcamento-empresarial.pbip" }),
  "ecommerce": Object.freeze({ name: "E-commerce", priceCents: 3990, fileKey: "dashboards/comercial/E-commerce.zip", fileName: "E-commerce.zip" }),
  "marketing-digital": Object.freeze({ name: "Marketing Digital e Growth", priceCents: 3490, fileKey: "dashboards/marketing-digital.pbip", fileName: "marketing-digital.pbip" }),
  "redes-sociais": Object.freeze({ name: "Redes Sociais", priceCents: 2990, fileKey: "dashboards/redes-sociais.pbip", fileName: "redes-sociais.pbip" }),
  "logistica-e-entregas": Object.freeze({ name: "Logística e Supply Chain", priceCents: 3990, fileKey: "dashboards/logistica-e-entregas.pbip", fileName: "logistica-e-entregas.pbip" }),
  "compras-e-fornecedores": Object.freeze({ name: "Compras e Gestão de Fornecedores", priceCents: 2990, fileKey: "dashboards/compras/Compras_e_Gestao_de_Fornecedores.zip", fileName: "Compras_e_Gestao_de_Fornecedores.zip" }),
  "gestao-imobiliaria": Object.freeze({ name: "Gestão Imobiliária", priceCents: 3990, fileKey: "dashboards/gestao-imobiliaria.pbip", fileName: "gestao-imobiliaria.pbip" }),
  "restaurante-e-delivery": Object.freeze({ name: "Restaurante e Delivery", priceCents: 3490, fileKey: "dashboards/alimentacao/Restaurante_e_Delivery.zip", fileName: "Restaurante_e_Delivery.zip" }),
  "academias-e-alunos": Object.freeze({ name: "Academias e Alunos", priceCents: 2990, fileKey: "dashboards/academias-e-alunos.pbip", fileName: "academias-e-alunos.pbip" }),
  "manutencao-de-veiculos": Object.freeze({ name: "Manutenção de Veículos", priceCents: 1490, fileKey: "dashboards/manutencao-de-veiculos.pbip", fileName: "manutencao-de-veiculos.pbip" }),
  "agronegocio": Object.freeze({ name: "Gestão do Agronegócio", priceCents: 4490, fileKey: "dashboards/agronegocio/Gestao_do_Agronegocio.zip", fileName: "Gestao_do_Agronegocio.zip" }),
  "controle-de-dividas": Object.freeze({ name: "Controle de Dívidas", priceCents: 1490, fileKey: "dashboards/controle-de-dividas.pbip", fileName: "controle-de-dividas.pbip" }),
  "planejamento-de-aposentadoria": Object.freeze({ name: "Planejamento de Aposentadoria", priceCents: 1990, fileKey: "dashboards/planejamento-de-aposentadoria.pbip", fileName: "planejamento-de-aposentadoria.pbip" }),
  "comparador-de-investimentos": Object.freeze({ name: "Comparador de Investimentos", priceCents: 2490, fileKey: "dashboards/comparador-de-investimentos.pbip", fileName: "comparador-de-investimentos.pbip" }),
  "controle-de-assinaturas": Object.freeze({ name: "Controle de Assinaturas", priceCents: 1490, fileKey: "dashboards/controle-de-assinaturas.pbip", fileName: "controle-de-assinaturas.pbip" }),
  "prestadores-de-servicos": Object.freeze({ name: "Prestadores de Serviços", priceCents: 2990, fileKey: "dashboards/prestadores-de-servicos.pbip", fileName: "prestadores-de-servicos.pbip" }),
  "clinica-e-consultorio": Object.freeze({ name: "Clínica e Consultório", priceCents: 3990, fileKey: "dashboards/clinica-e-consultorio.pbip", fileName: "clinica-e-consultorio.pbip" }),
  "gestao-para-advocacia": Object.freeze({ name: "Gestão para Advocacia", priceCents: 3490, fileKey: "dashboards/gestao-para-advocacia.pbip", fileName: "gestao-para-advocacia.pbip" }),
  "hotelaria-e-reservas": Object.freeze({ name: "Hotelaria e Reservas", priceCents: 3990, fileKey: "dashboards/hotelaria-e-reservas.pbip", fileName: "hotelaria-e-reservas.pbip" }),
  "construcao-civil": Object.freeze({ name: "Construção Civil", priceCents: 4490, fileKey: "dashboards/construcao-civil.pbip", fileName: "construcao-civil.pbip" }),
  "producao-industrial": Object.freeze({ name: "Produção Industrial", priceCents: 4990, fileKey: "dashboards/producao-industrial.pbip", fileName: "producao-industrial.pbip" }),
  "atendimento-e-suporte": Object.freeze({ name: "Atendimento e Sucesso do Cliente", priceCents: 3490, fileKey: "dashboards/atendimento-e-suporte.pbip", fileName: "atendimento-e-suporte.pbip" }),
  "prevencao-fraudes-risco": Object.freeze({ name: "Prevenção de Fraudes e Risco", priceCents: 5990, fileKey: "dashboards/prevencao-fraudes-risco.pbip", fileName: "prevencao-fraudes-risco.pbip" }),
  "saude-gestao-hospitalar": Object.freeze({ name: "Saúde e Gestão Hospitalar", priceCents: 5990, fileKey: "dashboards/saude-gestao-hospitalar.pbip", fileName: "saude-gestao-hospitalar.pbip" }),
  "dashboard-contabil": Object.freeze({ name: "Dashboard Contábil", priceCents: 4990, fileKey: "dashboards/dashboard-contabil.pbip", fileName: "dashboard-contabil.pbip" })
});

const DASHBOARD_PURCHASABLE_IDS = new Set([
  "agronegocio",
  "restaurante-e-delivery",
  "vendas-e-faturamento",
  "ecommerce",
  "compras-e-fornecedores",
  "contas-a-receber",
]);

function dashboardRequiredConfig(env) {
  return Boolean(
    env.DASHBOARD_DB &&
    env.DASHBOARD_FILES &&
    env.MP_ACCESS_TOKEN &&
    env.MP_WEBHOOK_SECRET &&
    env.RESEND_API_KEY &&
    env.DASHBOARD_EMAIL_FROM &&
    env.DASHBOARD_SALES_EMAIL &&
    env.DASHBOARD_SECURITY_SECRET &&
    env.DASHBOARD_DOWNLOAD_SECRET
  );
}

async function ensureDashboardStoreSchema(env) {
  if (!env.DASHBOARD_DB) throw new Error("DASHBOARD_DB não configurado");
  if (!dashboardSchemaReadyPromise) {
    dashboardSchemaReadyPromise = env.DASHBOARD_DB.batch([
      env.DASHBOARD_DB.prepare(`CREATE TABLE IF NOT EXISTS dashboard_purchases (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        dashboard_name TEXT NOT NULL,
        price_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'BRL',
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        email_hash TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        mp_order_id TEXT UNIQUE,
        mp_payment_id TEXT,
        mp_status TEXT,
        mp_status_detail TEXT,
        status_token_hash TEXT NOT NULL,
        status_token_expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        paid_at TEXT,
        buyer_email_sent_at TEXT,
        seller_email_sent_at TEXT
      )`),
      env.DASHBOARD_DB.prepare("CREATE INDEX IF NOT EXISTS idx_dashboard_purchases_ip_created ON dashboard_purchases(ip_hash, created_at)"),
      env.DASHBOARD_DB.prepare("CREATE INDEX IF NOT EXISTS idx_dashboard_purchases_email_created ON dashboard_purchases(email_hash, created_at)"),
      env.DASHBOARD_DB.prepare("CREATE INDEX IF NOT EXISTS idx_dashboard_purchases_mp_order ON dashboard_purchases(mp_order_id)"),
    ]).catch((error) => {
      dashboardSchemaReadyPromise = null;
      throw error;
    });
  }
  return dashboardSchemaReadyPromise;
}

function dashboardJson(body, status = 200, extraHeaders = {}) {
  return jsonResponse(body, status, {
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    ...extraHeaders,
  });
}

function dashboardSameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  if (origin) return sameOrigin(request, url);

  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      const parsed = new URL(referer);
      return parsed.protocol === url.protocol && parsed.host === url.host;
    } catch {
      return false;
    }
  }

  // Alguns navegadores móveis/modos de privacidade removem Origin e Referer.
  // Sec-Fetch-Site é um cabeçalho controlado pelo navegador e funciona como
  // fallback. Quando ele também não existe, o checkout ainda exige JSON e o
  // cabeçalho X-Dashboard-Checkout; uma origem externa não consegue enviá-los
  // por fetch sem passar por preflight CORS.
  const fetchSite = String(request.headers.get("Sec-Fetch-Site") || "").toLowerCase();
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
  return true;
}

function dashboardCustomHeaderValid(request) {
  return request.headers.get("X-Dashboard-Checkout") === "1";
}

function normalizeHumanName(value, maxLength) {
  const normalized = String(value || "").normalize("NFC").trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > maxLength) return "";
  if (/[<>\u0000-\u001f\u007f]/.test(normalized)) return "";
  return normalized;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return "";
  return digits;
}

function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, (value) => value.toString(16).padStart(2, "0")).join("");
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value))));
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(value))));
}

function constantTimeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

async function dashboardPrivateHash(env, prefix, value) {
  return hmacHex(env.DASHBOARD_SECURITY_SECRET, `${prefix}:${String(value || "")}`);
}

function centsToMoney(cents) {
  return (Number(cents) / 100).toFixed(2);
}

function moneyToCents(value) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}

function dashboardEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function safeDashboardFileName(value) {
  return String(value || "dashboard.pbip").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "dashboard.pbip";
}

async function dashboardFetch(input, init = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readSmallJsonBody(request, maxBytes = 8192) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) throw Object.assign(new Error("Envie os dados em JSON."), { status: 415 });
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > maxBytes) throw Object.assign(new Error("Solicitação acima do limite permitido."), { status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw Object.assign(new Error("Solicitação acima do limite permitido."), { status: 413 });
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Dados inválidos."), { status: 400 });
  }
}

async function dashboardRateAllowed(env, ipHash, emailHash) {
  const since = new Date(Date.now() - DASHBOARD_RATE_WINDOW_MS).toISOString();
  const [ipCount, emailCount] = await Promise.all([
    env.DASHBOARD_DB.prepare("SELECT COUNT(*) AS total FROM dashboard_purchases WHERE ip_hash = ? AND created_at >= ?").bind(ipHash, since).first(),
    env.DASHBOARD_DB.prepare("SELECT COUNT(*) AS total FROM dashboard_purchases WHERE email_hash = ? AND created_at >= ?").bind(emailHash, since).first(),
  ]);
  return Number(ipCount?.total || 0) < DASHBOARD_MAX_PER_IP && Number(emailCount?.total || 0) < DASHBOARD_MAX_PER_EMAIL;
}

async function createDashboardCheckout(request, env) {
  const url = new URL(request.url);
  if (request.method !== "POST") return dashboardJson({ error: "metodo_nao_permitido", message: "Use uma solicitação POST." }, 405, { Allow: "POST" });
  if (!dashboardSameOrigin(request, url) || !dashboardCustomHeaderValid(request)) return dashboardJson({ error: "origem_nao_autorizada", message: "Solicitação não autorizada." }, 403);
  if (!dashboardRequiredConfig(env)) return dashboardJson({ error: "pagamento_nao_configurado", message: "O pagamento por Pix ainda não foi ativado pelo administrador." }, 503);

  await ensureDashboardStoreSchema(env);
  let payload;
  try {
    payload = await readSmallJsonBody(request);
  } catch (error) {
    return dashboardJson({ error: "dados_invalidos", message: error instanceof Error ? error.message : "Dados inválidos." }, Number(error?.status || 400));
  }

  if (String(payload?.companyWebsite || "").trim()) return dashboardJson({ error: "solicitacao_recusada", message: "Não foi possível iniciar a compra." }, 400);
  const startedAt = Number(payload?.formStartedAt || 0);
  if (!Number.isFinite(startedAt) || startedAt <= 0 || Date.now() - startedAt < 900 || Date.now() - startedAt > 24 * 60 * 60_000) {
    return dashboardJson({ error: "formulario_expirado", message: "Atualize a página e tente novamente." }, 400);
  }

  const dashboardId = String(payload?.dashboardId || "").trim();
  if (!/^[a-z0-9-]{2,80}$/.test(dashboardId)) return dashboardJson({ error: "dashboard_invalido", message: "Dashboard inválido." }, 400);
  const product = DASHBOARD_PRODUCTS[dashboardId];
  if (!product || !DASHBOARD_PURCHASABLE_IDS.has(dashboardId)) return dashboardJson({ error: "dashboard_indisponivel", message: "Este dashboard ainda não está disponível para compra." }, 404);

  const firstName = normalizeHumanName(payload?.firstName, 60);
  const lastName = normalizeHumanName(payload?.lastName, 80);
  const phone = normalizePhone(payload?.phone);
  const email = normalizeEmail(payload?.email);
  if (!firstName || !lastName || !phone || !email) return dashboardJson({ error: "dados_invalidos", message: "Confira nome, sobrenome, telefone e e-mail." }, 400);

  const chargePriceCents = product.priceCents;

  const fileExists = await env.DASHBOARD_FILES.head(product.fileKey);
  if (!fileExists) return dashboardJson({ error: "arquivo_indisponivel", message: "Este dashboard ainda não está liberado para venda." }, 409);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const [ipHash, emailHash] = await Promise.all([
    dashboardPrivateHash(env, "ip", ip),
    dashboardPrivateHash(env, "email", email),
  ]);
  if (!(await dashboardRateAllowed(env, ipHash, emailHash))) {
    return dashboardJson({ error: "muitas_tentativas", message: "Muitas tentativas de compra em pouco tempo. Aguarde alguns minutos." }, 429, { "Retry-After": "900" });
  }

  const purchaseId = `DB-${crypto.randomUUID()}`;
  const statusToken = randomToken(32);
  const statusTokenHash = await sha256Hex(statusToken);
  const createdAt = new Date().toISOString();
  const statusTokenExpiresAt = new Date(Date.now() + DASHBOARD_STATUS_TOKEN_TTL_MS).toISOString();

  await env.DASHBOARD_DB.prepare(`INSERT INTO dashboard_purchases
    (id, dashboard_id, dashboard_name, price_cents, currency, first_name, last_name, phone, email, email_hash, ip_hash, status, status_token_hash, status_token_expires_at, created_at)
    VALUES (?, ?, ?, ?, 'BRL', ?, ?, ?, ?, ?, ?, 'CREATING', ?, ?, ?)`)
    .bind(purchaseId, dashboardId, product.name, chargePriceCents, firstName, lastName, phone, email, emailHash, ipHash, statusTokenHash, statusTokenExpiresAt, createdAt)
    .run();

  const orderBody = {
    type: "online",
    total_amount: centsToMoney(product.priceCents),
    external_reference: purchaseId,
    processing_mode: "automatic",
    transactions: {
      payments: [{
        amount: centsToMoney(product.priceCents),
        payment_method: { id: "pix", type: "bank_transfer" },
        expiration_time: "P30D",
      }],
    },
    payer: { email, first_name: firstName, last_name: lastName },
  };

  let mpResponse;
  try {
    mpResponse = await dashboardFetch(MP_ORDERS_BASE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
        "X-Idempotency-Key": purchaseId,
      },
      body: JSON.stringify(orderBody),
    });
  } catch {
    await env.DASHBOARD_DB.prepare("UPDATE dashboard_purchases SET status = 'FAILED_CREATE' WHERE id = ?").bind(purchaseId).run();
    return dashboardJson({ error: "mercado_pago_indisponivel", message: "Não foi possível conectar ao Mercado Pago. Tente novamente." }, 502);
  }

  let order = {};
  try { order = await mpResponse.json(); } catch { order = {}; }
  if (!mpResponse.ok || !order?.id) {
    await env.DASHBOARD_DB.prepare("UPDATE dashboard_purchases SET status = 'FAILED_CREATE', mp_status = ?, mp_status_detail = ? WHERE id = ?")
      .bind(String(order?.status || `HTTP_${mpResponse.status}`), String(order?.status_detail || "create_error"), purchaseId).run();
    const retryAfter = mpResponse.headers.get("Retry-After");
    return dashboardJson({ error: "pix_nao_gerado", message: mpResponse.status === 429 ? "O Mercado Pago está limitando novas cobranças. Aguarde e tente novamente." : "Não foi possível gerar o Pix agora." }, mpResponse.status === 429 ? 429 : 502, retryAfter ? { "Retry-After": retryAfter } : {});
  }

  const payment = order?.transactions?.payments?.[0] || {};
  const method = payment?.payment_method || {};
  const qrCode = String(method.qr_code || "");
  const qrCodeBase64 = String(method.qr_code_base64 || "");
  if (!qrCode || !qrCodeBase64) {
    await env.DASHBOARD_DB.prepare("UPDATE dashboard_purchases SET status = 'FAILED_CREATE', mp_order_id = ?, mp_status = ?, mp_status_detail = ? WHERE id = ?")
      .bind(String(order.id), String(order.status || ""), String(order.status_detail || "missing_qr"), purchaseId).run();
    return dashboardJson({ error: "pix_incompleto", message: "O Mercado Pago não retornou o QR Code do Pix." }, 502);
  }

  await env.DASHBOARD_DB.prepare("UPDATE dashboard_purchases SET status = 'PENDING', mp_order_id = ?, mp_payment_id = ?, mp_status = ?, mp_status_detail = ? WHERE id = ?")
    .bind(String(order.id), String(payment.id || ""), String(order.status || ""), String(order.status_detail || payment.status_detail || ""), purchaseId).run();

  return dashboardJson({
    purchaseId,
    statusToken,
    dashboardName: product.name,
    price: centsToMoney(chargePriceCents),
    currency: "BRL",
    qrCode,
    qrCodeBase64,
    ticketUrl: typeof method.ticket_url === "string" ? method.ticket_url : "",
    expiresInMinutes: 43200,
  }, 201);
}

function parseWebhookSignature(header) {
  let ts = "";
  let v1 = "";
  for (const part of String(header || "").split(",")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    const value = rest.join("=").trim();
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }
  return { ts, v1 };
}

async function verifyMercadoPagoWebhook(request, env, url) {
  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";
  const dataIdRaw = url.searchParams.get("data.id") || "";
  const { ts, v1 } = parseWebhookSignature(xSignature);
  if (!xRequestId || !dataIdRaw || !ts || !/^[a-f0-9]{64}$/i.test(v1)) return false;
  const dataId = /[a-z]/i.test(dataIdRaw) ? dataIdRaw.toLowerCase() : dataIdRaw;
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = await hmacHex(env.MP_WEBHOOK_SECRET, manifest);
  return constantTimeEqual(expected.toLowerCase(), v1.toLowerCase());
}

async function getMercadoPagoOrder(orderId, env) {
  const response = await dashboardFetch(`${MP_ORDERS_BASE_URL}/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
  });
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
}

function dashboardOrderIsPaid(order, purchase) {
  const payment = (order?.transactions?.payments || []).find((item) => item?.payment_method?.id === "pix" && item?.payment_method?.type === "bank_transfer");
  if (!payment) return false;
  const expectedCents = Number(purchase.price_cents);
  const orderCents = moneyToCents(order?.total_amount);
  const paymentCents = moneyToCents(payment?.paid_amount ?? payment?.amount);
  return order?.status === "processed" &&
    order?.status_detail === "accredited" &&
    payment?.status === "processed" &&
    payment?.status_detail === "accredited" &&
    orderCents === expectedCents &&
    paymentCents === expectedCents;
}

function dashboardPublicStatus(status) {
  const value = String(status || "").toUpperCase();
  if (value === "PAID") return "paid";
  if (["FAILED", "FAILED_CREATE"].includes(value)) return "failed";
  if (value === "CANCELED") return "canceled";
  if (value === "EXPIRED") return "expired";
  return "pending";
}

async function dashboardDownloadToken(env, purchaseId) {
  return hmacHex(env.DASHBOARD_DOWNLOAD_SECRET, `dashboard-download:${purchaseId}`);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

async function sendResendEmail(env, { to, subject, html, attachments, idempotencyKey }) {
  const body = { from: env.DASHBOARD_EMAIL_FROM, to: [to], subject, html };
  if (attachments?.length) body.attachments = attachments;
  const response = await dashboardFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  return response.ok;
}

async function deliverDashboardPurchase(env, purchaseId) {
  if (!dashboardRequiredConfig(env)) return;
  await ensureDashboardStoreSchema(env);
  const purchase = await env.DASHBOARD_DB.prepare("SELECT * FROM dashboard_purchases WHERE id = ? LIMIT 1").bind(purchaseId).first();
  if (!purchase || purchase.status !== "PAID") return;
  const product = DASHBOARD_PRODUCTS[purchase.dashboard_id];
  if (!product) return;

  const now = new Date().toISOString();
  const downloadToken = await dashboardDownloadToken(env, purchaseId);
  const downloadUrl = `${DASHBOARD_PUBLIC_ORIGIN}/api/dashboard-store/download/${encodeURIComponent(purchaseId)}?token=${downloadToken}`;
  // O e-mail sempre exibe o preço comercial do dashboard.
  // No sandbox do Mercado Pago a cobrança pode usar um valor técnico de teste (ex.: R$ 50,00).
  const amount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(product.priceCents) / 100);
  const buyerName = `${purchase.first_name} ${purchase.last_name}`;

  if (!purchase.buyer_email_sent_at) {
    let attachments = [];
    let attached = false;
    try {
      const object = await env.DASHBOARD_FILES.get(product.fileKey);
      if (object && Number(object.size || 0) > 0 && Number(object.size || 0) <= DASHBOARD_MAX_ATTACHMENT_BYTES) {
        const content = arrayBufferToBase64(await object.arrayBuffer());
        attachments = [{ filename: safeDashboardFileName(product.fileName), content }];
        attached = true;
      }
    } catch {
      attachments = [];
    }

    const buyerHtml = `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#24231f"><h2>Pagamento confirmado</h2><p>Olá, ${dashboardEscapeHtml(purchase.first_name)}.</p><p>Sua compra do <strong>${dashboardEscapeHtml(purchase.dashboard_name)}</strong> foi confirmada.</p><p><strong>Valor:</strong> ${dashboardEscapeHtml(amount)}<br><strong>Pedido:</strong> ${dashboardEscapeHtml(purchase.id)}</p>${attached ? `<p>O arquivo do dashboard está anexado a este e-mail.</p>` : `<p>O arquivo é maior que o limite seguro para anexo. Use o botão abaixo para baixar:</p>`}<p><a href="${dashboardEscapeHtml(downloadUrl)}" style="display:inline-block;background:#24231f;color:#f4c517;text-decoration:none;padding:12px 18px;border-radius:7px;font-weight:700">Baixar dashboard</a></p><p style="font-size:12px;color:#6d6758">O link de segurança fica disponível por 7 dias após a confirmação do pagamento.</p></div>`;
    const sent = await sendResendEmail(env, {
      to: purchase.email,
      subject: `Seu dashboard: ${purchase.dashboard_name}`,
      html: buyerHtml,
      attachments,
      idempotencyKey: `${purchase.id}-buyer-v1`,
    });
    if (sent) await env.DASHBOARD_DB.prepare("UPDATE dashboard_purchases SET buyer_email_sent_at = COALESCE(buyer_email_sent_at, ?) WHERE id = ?").bind(now, purchaseId).run();
  }

  if (!purchase.seller_email_sent_at) {
    const sellerHtml = `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#24231f"><h2>Nova venda de dashboard</h2><p><strong>Dashboard:</strong> ${dashboardEscapeHtml(purchase.dashboard_name)}<br><strong>Valor:</strong> ${dashboardEscapeHtml(amount)}<br><strong>Pedido:</strong> ${dashboardEscapeHtml(purchase.id)}<br><strong>Mercado Pago:</strong> ${dashboardEscapeHtml(purchase.mp_order_id || "—")}</p><p><strong>Cliente:</strong> ${dashboardEscapeHtml(buyerName)}<br><strong>Telefone:</strong> ${dashboardEscapeHtml(purchase.phone)}<br><strong>E-mail:</strong> ${dashboardEscapeHtml(purchase.email)}</p></div>`;
    const sent = await sendResendEmail(env, {
      to: env.DASHBOARD_SALES_EMAIL,
      subject: `Nova venda - ${purchase.dashboard_name}`,
      html: sellerHtml,
      attachments: [],
      idempotencyKey: `${purchase.id}-seller-v1`,
    });
    if (sent) await env.DASHBOARD_DB.prepare("UPDATE dashboard_purchases SET seller_email_sent_at = COALESCE(seller_email_sent_at, ?) WHERE id = ?").bind(now, purchaseId).run();
  }
}

function runDashboardBackground(ctx, promise) {
  if (ctx?.waitUntil) ctx.waitUntil(promise.catch(() => {}));
  else promise.catch(() => {});
}

async function handleMercadoPagoWebhook(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method !== "POST") return dashboardJson({ error: "metodo_nao_permitido" }, 405, { Allow: "POST" });
  if (!dashboardRequiredConfig(env)) return dashboardJson({ error: "integracao_nao_configurada" }, 503);
  if (!(await verifyMercadoPagoWebhook(request, env, url))) return dashboardJson({ error: "assinatura_invalida" }, 401);

  let body = {};
  try { body = await request.json(); } catch { return dashboardJson({ error: "json_invalido" }, 400); }
  const dataId = String(url.searchParams.get("data.id") || "");
  if (body?.type !== "order" || !body?.data?.id || String(body.data.id).toLowerCase() !== dataId.toLowerCase()) return dashboardJson({ error: "evento_invalido" }, 400);

  await ensureDashboardStoreSchema(env);
  const order = await getMercadoPagoOrder(String(body.data.id), env);
  if (!order?.id || !order?.external_reference) return dashboardJson({ received: true }, 200);
  const purchase = await env.DASHBOARD_DB.prepare("SELECT * FROM dashboard_purchases WHERE id = ? LIMIT 1").bind(String(order.external_reference)).first();
  if (!purchase || purchase.mp_order_id !== String(order.id)) return dashboardJson({ received: true }, 200);

  const payment = (order?.transactions?.payments || [])[0] || {};
  if (dashboardOrderIsPaid(order, purchase)) {
    const paidAt = new Date().toISOString();
    await env.DASHBOARD_DB.prepare("UPDATE dashboard_purchases SET status = 'PAID', mp_payment_id = ?, mp_status = ?, mp_status_detail = ?, paid_at = COALESCE(paid_at, ?) WHERE id = ?")
      .bind(String(payment.id || purchase.mp_payment_id || ""), String(order.status || ""), String(order.status_detail || ""), paidAt, purchase.id).run();
    runDashboardBackground(ctx, deliverDashboardPurchase(env, purchase.id));
  } else {
    const orderCents = moneyToCents(order?.total_amount);
    if (Number.isFinite(orderCents) && orderCents !== Number(purchase.price_cents)) return dashboardJson({ received: true }, 200);
    const nextStatus = order.status === "canceled" ? "CANCELED" : order.status === "expired" ? "EXPIRED" : order.status === "failed" ? "FAILED" : "PENDING";
    await env.DASHBOARD_DB.prepare("UPDATE dashboard_purchases SET status = ?, mp_status = ?, mp_status_detail = ? WHERE id = ? AND status <> 'PAID'")
      .bind(nextStatus, String(order.status || ""), String(order.status_detail || ""), purchase.id).run();
  }

  return dashboardJson({ received: true }, 200);
}

async function dashboardPurchaseStatus(request, env, ctx, purchaseId) {
  const url = new URL(request.url);
  if (request.method !== "GET") return dashboardJson({ error: "metodo_nao_permitido" }, 405, { Allow: "GET" });
  if (!dashboardSameOrigin(request, url) || !dashboardCustomHeaderValid(request)) return dashboardJson({ error: "origem_nao_autorizada" }, 403);
  if (!env.DASHBOARD_DB) return dashboardJson({ error: "integracao_nao_configurada" }, 503);
  await ensureDashboardStoreSchema(env);
  const token = request.headers.get("X-Purchase-Token") || "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return dashboardJson({ error: "nao_autorizado" }, 401);
  let purchase = await env.DASHBOARD_DB.prepare("SELECT * FROM dashboard_purchases WHERE id = ? LIMIT 1").bind(purchaseId).first();
  if (!purchase) return dashboardJson({ error: "nao_encontrado" }, 404);
  if (Date.parse(purchase.status_token_expires_at) < Date.now()) return dashboardJson({ error: "token_expirado" }, 401);
  const tokenHash = await sha256Hex(token);
  if (!constantTimeEqual(tokenHash, purchase.status_token_hash)) return dashboardJson({ error: "nao_autorizado" }, 401);

  // Fallback controlado: o Webhook continua sendo o caminho principal, mas a tela pode
  // pedir uma conferência direta da Order a cada alguns segundos enquanto estiver aberta.
  if (purchase.status !== "PAID" && url.searchParams.get("verify") === "1" && purchase.mp_order_id && env.MP_ACCESS_TOKEN) {
    const order = await getMercadoPagoOrder(String(purchase.mp_order_id), env);
    if (order?.id && String(order.id) === String(purchase.mp_order_id) && String(order.external_reference || "") === String(purchase.id)) {
      const payment = (order?.transactions?.payments || [])[0] || {};
      if (dashboardOrderIsPaid(order, purchase)) {
        const paidAt = new Date().toISOString();
        await env.DASHBOARD_DB.prepare("UPDATE dashboard_purchases SET status = 'PAID', mp_payment_id = ?, mp_status = ?, mp_status_detail = ?, paid_at = COALESCE(paid_at, ?) WHERE id = ?")
          .bind(String(payment.id || purchase.mp_payment_id || ""), String(order.status || ""), String(order.status_detail || ""), paidAt, purchase.id).run();
        purchase = { ...purchase, status: "PAID", mp_status: String(order.status || ""), mp_status_detail: String(order.status_detail || ""), paid_at: purchase.paid_at || paidAt };
        if (dashboardRequiredConfig(env)) runDashboardBackground(ctx, deliverDashboardPurchase(env, purchase.id));
      } else {
        const orderCents = moneyToCents(order?.total_amount);
        if (!Number.isFinite(orderCents) || orderCents === Number(purchase.price_cents)) {
          const nextStatus = order.status === "canceled" ? "CANCELED" : order.status === "expired" ? "EXPIRED" : order.status === "failed" ? "FAILED" : "PENDING";
          await env.DASHBOARD_DB.prepare("UPDATE dashboard_purchases SET status = ?, mp_status = ?, mp_status_detail = ? WHERE id = ? AND status <> 'PAID'")
            .bind(nextStatus, String(order.status || ""), String(order.status_detail || ""), purchase.id).run();
          purchase = { ...purchase, status: nextStatus, mp_status: String(order.status || ""), mp_status_detail: String(order.status_detail || "") };
        }
      }
    }
  }

  if (purchase.status === "PAID" && !purchase.buyer_email_sent_at && dashboardRequiredConfig(env)) runDashboardBackground(ctx, deliverDashboardPurchase(env, purchase.id));
  return dashboardJson({
    status: dashboardPublicStatus(purchase.status),
    dashboardName: purchase.dashboard_name,
    emailStatus: purchase.buyer_email_sent_at ? "sent" : purchase.status === "PAID" ? "sending" : "waiting",
  });
}

async function dashboardDownload(request, env, purchaseId) {
  if (request.method !== "GET") return new Response("Método não permitido", { status: 405, headers: applySecurityHeaders(new Headers({ Allow: "GET", "Cache-Control": "no-store" })) });
  if (!env.DASHBOARD_DB || !env.DASHBOARD_FILES || !env.DASHBOARD_DOWNLOAD_SECRET) return new Response("Indisponível", { status: 503 });
  await ensureDashboardStoreSchema(env);
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return new Response("Link inválido", { status: 401 });
  const expected = await dashboardDownloadToken(env, purchaseId);
  if (!constantTimeEqual(expected, token)) return new Response("Link inválido", { status: 401 });
  const purchase = await env.DASHBOARD_DB.prepare("SELECT dashboard_id, status, paid_at FROM dashboard_purchases WHERE id = ? LIMIT 1").bind(purchaseId).first();
  if (!purchase || purchase.status !== "PAID" || !purchase.paid_at) return new Response("Compra não localizada", { status: 404 });
  if (Date.now() - Date.parse(purchase.paid_at) > DASHBOARD_DOWNLOAD_TTL_MS) return new Response("Este link expirou", { status: 410 });
  const product = DASHBOARD_PRODUCTS[purchase.dashboard_id];
  if (!product) return new Response("Arquivo não localizado", { status: 404 });
  const object = await env.DASHBOARD_FILES.get(product.fileKey);
  if (!object) return new Response("Arquivo não localizado", { status: 404 });
  const headers = applySecurityHeaders(new Headers({
    "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${safeDashboardFileName(product.fileName)}"`,
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  }));
  if (object.size) headers.set("Content-Length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}

async function routeDashboardStore(request, env, ctx, url) {
  if (url.pathname === "/api/dashboard-store/checkout") return createDashboardCheckout(request, env);
  if (url.pathname === "/api/dashboard-store/webhooks/mercadopago") return handleMercadoPagoWebhook(request, env, ctx);
  const statusMatch = url.pathname.match(/^\/api\/dashboard-store\/purchases\/(DB-[a-f0-9-]{36})\/status$/i);
  if (statusMatch) return dashboardPurchaseStatus(request, env, ctx, statusMatch[1]);
  const downloadMatch = url.pathname.match(/^\/api\/dashboard-store\/download\/(DB-[a-f0-9-]{36})$/i);
  if (downloadMatch) return dashboardDownload(request, env, downloadMatch[1]);
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/dashboard-store/")) {
      const dashboardResponse = await routeDashboardStore(request, env, ctx, url);
      if (dashboardResponse) return dashboardResponse;
    }

    if (url.pathname === "/api/consultar-chave") {
      return consultarChave(request, env);
    }

    const response = await env.ASSETS.fetch(request);
    const headers = applySecurityHeaders(new Headers(response.headers));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
