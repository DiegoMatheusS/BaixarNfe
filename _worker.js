const MEUDANFE_BASE_URL = "https://api.meudanfe.com.br/v2";
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60_000;
const PROVIDER_TIMEOUT_MS = 28_000;
const STATUS_INTERVAL_MS = 1_100;
const STATUS_MAX_ATTEMPTS = 18;
const requestBuckets = new Map();
const activeKeys = new Set();

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
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

  let payload;
  try {
    payload = await request.json();
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/consultar-chave") {
      return consultarChave(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
