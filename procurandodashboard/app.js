const config = window.PROCURANDO_DASHBOARD_CONFIG || {};
const grid = document.querySelector("#templates-grid");
const status = document.querySelector("#catalog-status");
const planFilters = document.querySelector("#catalog-plan-filters");
const categoryFilter = document.querySelector("#catalog-category-filter");
const moreButton = document.querySelector("#catalog-more");
const modelsModal = document.querySelector("#models-modal");
const modelsModalTitle = document.querySelector("#models-modal-title");
const modelsModalDescription = document.querySelector("#models-modal-description");
const modelsModalEyebrow = document.querySelector("#models-modal-eyebrow");
const modelsModalPreview = document.querySelector("#models-modal-preview");
const modelsModalMeta = document.querySelector("#models-modal-meta");
const modelsModalFeatures = document.querySelector("#models-modal-features");
const modelsModalList = document.querySelector("#models-modal-list");
const modelsModalPrice = document.querySelector("#models-modal-price");
const modelsModalAction = document.querySelector("#models-modal-action");
const scrollTopButton = document.querySelector("#scroll-top");
const purchaseModal = document.querySelector("#purchase-modal");
const purchaseForm = document.querySelector("#purchase-form");
const purchaseTitle = document.querySelector("#purchase-title");
const purchaseDashboardName = document.querySelector("#purchase-dashboard-name");
const purchaseDashboardPrice = document.querySelector("#purchase-dashboard-price");
const purchaseMessage = document.querySelector("#purchase-message");
const purchaseSubmit = document.querySelector("#purchase-submit");
const purchasePixArea = document.querySelector("#purchase-pix-area");
const purchaseQr = document.querySelector("#purchase-qr");
const purchasePixCode = document.querySelector("#purchase-pix-code");
const purchaseCopy = document.querySelector("#purchase-copy");
const purchaseSuccess = document.querySelector("#purchase-success");
const dashboardMenuToggle = document.querySelector("#dashboard-menu-toggle");
const dashboardMobileMenu = document.querySelector("#dashboard-mobile-menu");
let modalTrigger = null;
let purchaseTrigger = null;
let activePurchaseTemplate = null;
let purchasePollTimer = null;
let purchasePollBusy = false;
let purchasePollCount = 0;

const catalogTemplates = [
  {
    id: "financas-pessoais-1",
    categoria: "Finanças pessoais",
    nome: "Orçamento Pessoal Básico",
    descricao: "Acompanhe receitas, despesas e o saldo mensal de forma simples.",
    destaque: "Saldo e despesas",
    cor: "yellow",
    tipo: "gratuito",
    preco: 0,
    status: "em_breve",
    arquivoUrl: ""
  },
  {
    id: "financeiro-empresarial",
    categoria: "Contabilidade",
    nome: "Financeiro Empresarial",
    descricao: "Visão de receitas, custos, resultado e evolução financeira do negócio.",
    destaque: "Resultado mensal",
    cor: "navy",
    tipo: "profissional",
    preco: 39.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "contas-a-pagar",
    categoria: "Contabilidade",
    nome: "Contas a Pagar",
    descricao: "Organize vencimentos, pagamentos, atrasos e valores por fornecedor.",
    destaque: "Próximos vencimentos",
    cor: "red",
    tipo: "profissional",
    preco: 29.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "vendas-e-faturamento",
    categoria: "Comercial",
    nome: "Vendas e Faturamento",
    descricao: "Compare metas, vendas, produtos, vendedores e faturamento por período.",
    destaque: "Vendas por período",
    cor: "green",
    tipo: "profissional",
    preco: 39.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "controle-escolar",
    categoria: "Educação",
    nome: "Controle Escolar",
    descricao: "Visualize presença, notas, turmas e evolução dos alunos.",
    destaque: "Desempenho das turmas",
    cor: "blue",
    tipo: "profissional",
    preco: 29.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "arquitetura-e-obras",
    categoria: "Projetos",
    nome: "Arquitetura e Obras",
    descricao: "Acompanhe etapas, custos previstos, despesas e avanço do projeto.",
    destaque: "Custo e progresso",
    cor: "orange",
    tipo: "profissional",
    preco: 39.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "financas-pessoais-2",
    categoria: "Finanças pessoais",
    nome: "Finanças Pessoais Pro",
    descricao: "Planeje o orçamento com mais páginas, indicadores, metas e comparações mensais.",
    destaque: "Metas e orçamento",
    cor: "green",
    tipo: "pessoal_pro",
    preco: 19.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "fluxo-de-caixa",
    categoria: "Contabilidade",
    nome: "Fluxo de Caixa",
    descricao: "Controle entradas, saídas, saldo projetado e movimentações por conta.",
    destaque: "Saldo projetado",
    cor: "blue",
    tipo: "profissional",
    preco: 24.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "gestao-de-estoque",
    categoria: "Operações",
    nome: "Gestão de Estoque",
    descricao: "Monitore níveis de estoque, giro, rupturas e produtos mais movimentados.",
    destaque: "Giro de estoque",
    cor: "orange",
    tipo: "profissional",
    preco: 34.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "rh-indicadores",
    categoria: "Recursos humanos",
    nome: "Recursos Humanos",
    descricao: "Acompanhe colaboradores, admissões, desligamentos, absenteísmo, férias, folha e indicadores por setor.",
    destaque: "Pessoas e desempenho",
    cor: "red",
    tipo: "profissional",
    preco: 39.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "controle-de-projetos",
    categoria: "Projetos",
    nome: "Projetos e Engenharia (PMO)",
    descricao: "Analise cronograma, custos, horas, tarefas, responsáveis e desvios de prazo e orçamento.",
    destaque: "Prazo e orçamento",
    cor: "navy",
    tipo: "profissional",
    preco: 34.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "financeiro-bancario",
    categoria: "Financeiro",
    nome: "Financeiro Bancário",
    descricao: "Consolide contas, movimentações, saldos e despesas bancárias.",
    destaque: "Contas e saldos",
    cor: "yellow",
    tipo: "pessoal_pro",
    preco: 19.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "carteira-de-investimentos",
    categoria: "Investimentos",
    nome: "Carteira de Investimentos",
    descricao: "Acompanhe patrimônio, aportes, rentabilidade e distribuição dos ativos.",
    destaque: "Evolução patrimonial",
    cor: "navy",
    tipo: "pessoal_pro",
    preco: 24.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "dividendos-renda-passiva",
    categoria: "Investimentos",
    nome: "Dividendos e Renda Passiva",
    descricao: "Controle proventos recebidos, calendário e crescimento da renda mensal.",
    destaque: "Renda passiva",
    cor: "green",
    tipo: "pessoal_pro",
    preco: 19.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "acoes-e-fiis",
    categoria: "Investimentos",
    nome: "Ações e FIIs",
    descricao: "Compare ativos, preço médio, valorização, dividendos e participação na carteira.",
    destaque: "Ações e fundos",
    cor: "blue",
    tipo: "pessoal_pro",
    preco: 24.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "criptomoedas",
    categoria: "Investimentos",
    nome: "Criptomoedas",
    descricao: "Organize compras, vendas, preço médio e evolução dos criptoativos.",
    destaque: "Carteira cripto",
    cor: "orange",
    tipo: "pessoal_pro",
    preco: 19.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "metas-de-investimento",
    categoria: "Investimentos",
    nome: "Metas de Investimento",
    descricao: "Defina objetivos, registre aportes e acompanhe o avanço das suas metas.",
    destaque: "Objetivos financeiros",
    cor: "yellow",
    tipo: "gratuito",
    preco: 0,
    status: "em_breve",
    arquivoUrl: ""
  },
  {
    id: "contas-a-receber",
    categoria: "Contabilidade",
    nome: "Contas a Receber",
    descricao: "Acompanhe cobranças, recebimentos, atrasos e valores por cliente.",
    destaque: "Recebimentos",
    cor: "green",
    tipo: "profissional",
    preco: 29.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "dre-gerencial",
    categoria: "Contabilidade",
    nome: "DRE Gerencial",
    descricao: "Analise receitas, custos, despesas, margens e resultado operacional.",
    destaque: "Resultado gerencial",
    cor: "navy",
    tipo: "profissional",
    preco: 39.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "orcamento-empresarial",
    categoria: "Empresas",
    nome: "Orçamento Empresarial",
    descricao: "Compare valores planejados e realizados por área, conta e período.",
    destaque: "Planejado x realizado",
    cor: "yellow",
    tipo: "profissional",
    preco: 34.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "ecommerce",
    categoria: "Comercial",
    nome: "E-commerce",
    descricao: "Monitore pedidos, ticket médio, produtos, faturamento e canais de venda.",
    destaque: "Desempenho da loja",
    cor: "blue",
    tipo: "profissional",
    preco: 39.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "marketing-digital",
    categoria: "Marketing",
    nome: "Marketing Digital e Growth",
    descricao: "Acompanhe aquisição, campanhas, leads, conversão, CAC, ROAS, retenção e crescimento por canal.",
    destaque: "Aquisição e growth",
    cor: "red",
    tipo: "profissional",
    preco: 34.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "redes-sociais",
    categoria: "Marketing",
    nome: "Redes Sociais",
    descricao: "Visualize alcance, interações, seguidores e desempenho das publicações.",
    destaque: "Alcance e engajamento",
    cor: "orange",
    tipo: "profissional",
    preco: 29.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "logistica-e-entregas",
    categoria: "Operações",
    nome: "Logística e Supply Chain",
    descricao: "Controle estoque, fornecedores, lead time, frete, rotas, rupturas, entregas e nível de serviço.",
    destaque: "Cadeia de suprimentos",
    cor: "green",
    tipo: "profissional",
    preco: 39.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "compras-e-fornecedores",
    categoria: "Compras",
    nome: "Compras e Gestão de Fornecedores",
    descricao: "Compare saving, gastos, contratos, cotações, atrasos e concentração por fornecedor.",
    destaque: "Saving e fornecedores",
    cor: "navy",
    tipo: "profissional",
    preco: 29.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "gestao-imobiliaria",
    categoria: "Imobiliário",
    nome: "Gestão Imobiliária",
    descricao: "Acompanhe imóveis, contratos, aluguéis, vacância e rentabilidade.",
    destaque: "Ocupação e receita",
    cor: "blue",
    tipo: "profissional",
    preco: 39.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "restaurante-e-delivery",
    categoria: "Alimentação",
    nome: "Restaurante e Delivery",
    descricao: "Analise pedidos, pratos, ticket médio, custos e horários de maior movimento.",
    destaque: "Pedidos e faturamento",
    cor: "red",
    tipo: "profissional",
    preco: 34.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "academias-e-alunos",
    categoria: "Serviços",
    nome: "Academias e Alunos",
    descricao: "Controle matrículas, planos, frequência, pagamentos e retenção de alunos.",
    destaque: "Alunos ativos",
    cor: "green",
    tipo: "profissional",
    preco: 29.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "manutencao-de-veiculos",
    categoria: "Finanças pessoais",
    nome: "Manutenção de Veículos",
    descricao: "Registre serviços, peças, custos, quilometragem e próximas manutenções.",
    destaque: "Custos de manutenção",
    cor: "orange",
    tipo: "pessoal_pro",
    preco: 14.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "agronegocio",
    categoria: "Agronegócio",
    nome: "Gestão do Agronegócio",
    descricao: "Acompanhe produção, custos, safras, áreas e resultado das atividades rurais.",
    destaque: "Produção e custos",
    cor: "yellow",
    tipo: "profissional",
    preco: 44.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "orcamento-familiar-basico",
    categoria: "Finanças pessoais",
    nome: "Orçamento Familiar Básico",
    descricao: "Registre receitas e despesas da família em uma visão mensal simples.",
    destaque: "Orçamento da família",
    cor: "green",
    tipo: "gratuito",
    preco: 0,
    status: "em_breve",
    arquivoUrl: ""
  },
  {
    id: "controle-de-dividas",
    categoria: "Finanças pessoais",
    nome: "Controle de Dívidas",
    descricao: "Organize parcelas, juros, vencimentos e acompanhe a redução das dívidas.",
    destaque: "Dívidas e parcelas",
    cor: "red",
    tipo: "pessoal_pro",
    preco: 14.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "planejamento-de-aposentadoria",
    categoria: "Investimentos",
    nome: "Planejamento de Aposentadoria",
    descricao: "Projete aportes, patrimônio desejado e evolução até a aposentadoria.",
    destaque: "Projeção patrimonial",
    cor: "navy",
    tipo: "pessoal_pro",
    preco: 19.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "comparador-de-investimentos",
    categoria: "Investimentos",
    nome: "Comparador de Investimentos",
    descricao: "Compare rentabilidade, risco, liquidez e evolução de diferentes aplicações.",
    destaque: "Comparação de ativos",
    cor: "blue",
    tipo: "pessoal_pro",
    preco: 24.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "controle-de-assinaturas",
    categoria: "Finanças pessoais",
    nome: "Controle de Assinaturas",
    descricao: "Acompanhe serviços recorrentes, datas de cobrança e custo mensal total.",
    destaque: "Gastos recorrentes",
    cor: "yellow",
    tipo: "pessoal_pro",
    preco: 14.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "prestadores-de-servicos",
    categoria: "Serviços",
    nome: "Prestadores de Serviços",
    descricao: "Controle clientes, serviços realizados, recebimentos e produtividade.",
    destaque: "Serviços e clientes",
    cor: "green",
    tipo: "profissional",
    preco: 29.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "clinica-e-consultorio",
    categoria: "Saúde",
    nome: "Clínica e Consultório",
    descricao: "Visualize atendimentos, pacientes, convênios, receitas e ocupação da agenda.",
    destaque: "Atendimentos",
    cor: "blue",
    tipo: "profissional",
    preco: 39.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "gestao-para-advocacia",
    categoria: "Serviços",
    nome: "Gestão para Advocacia",
    descricao: "Acompanhe processos, clientes, prazos, honorários e atividades jurídicas.",
    destaque: "Processos e prazos",
    cor: "navy",
    tipo: "profissional",
    preco: 34.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "hotelaria-e-reservas",
    categoria: "Turismo",
    nome: "Hotelaria e Reservas",
    descricao: "Monitore ocupação, reservas, diária média, cancelamentos e faturamento.",
    destaque: "Ocupação e reservas",
    cor: "orange",
    tipo: "profissional",
    preco: 39.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "construcao-civil",
    categoria: "Projetos",
    nome: "Construção Civil",
    descricao: "Controle obras, etapas, orçamento, medições, custos e cronograma físico.",
    destaque: "Obras e medições",
    cor: "yellow",
    tipo: "profissional",
    preco: 44.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "producao-industrial",
    categoria: "Indústria",
    nome: "Produção Industrial",
    descricao: "Acompanhe produção, eficiência, perdas, paradas e desempenho das linhas.",
    destaque: "Eficiência produtiva",
    cor: "red",
    tipo: "profissional",
    preco: 49.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "atendimento-e-suporte",
    categoria: "Serviços",
    nome: "Atendimento e Sucesso do Cliente",
    descricao: "Analise chamados, SLA, primeira resposta, NPS, churn, retenção e satisfação dos clientes.",
    destaque: "NPS, churn e SLA",
    cor: "green",
    tipo: "profissional",
    preco: 34.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "prevencao-fraudes-risco",
    categoria: "Risco e compliance",
    nome: "Prevenção de Fraudes e Risco",
    descricao: "Investigue chargebacks, transações suspeitas, falsos positivos, bloqueios e tempo de análise.",
    destaque: "Fraudes e anomalias",
    cor: "red",
    tipo: "profissional",
    preco: 59.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "saude-gestao-hospitalar",
    categoria: "Saúde",
    nome: "Saúde e Gestão Hospitalar",
    descricao: "Monitore ocupação de leitos, espera, triagem, readmissões, procedimentos e custos assistenciais.",
    destaque: "Ocupação e atendimento",
    cor: "blue",
    tipo: "profissional",
    preco: 59.9,
    status: "em_breve",
    checkoutUrl: ""
  },
  {
    id: "vendas-por-plataforma",
    categoria: "Vendas",
    nome: "Dashboard de Vendas",
    descricao: "Escolha entre modelos para canais de venda, produtos e controle financeiro comercial.",
    destaque: "Modelos de vendas",
    cor: "green",
    tipo: "gratuito",
    preco: 0,
    status: "modelos",
    arquivoUrl: "",
    modelos: [
      {
        nome: "Modelo 1 — Vendas Multicanal",
        descricao: "Compare Amazon, Mercado Livre, Magalu, Shopee e loja própria por quantidade, receita, custos, taxas, débitos e lucro.",
        campos: ["Plataforma", "Data", "Quantidade", "Receita", "Custos", "Taxas/Débitos"]
      },
      {
        nome: "Modelo 2 — Produtos e Pedidos",
        descricao: "Acompanhe produtos mais vendidos, pedidos, ticket médio, descontos, cancelamentos e margem.",
        campos: ["Pedido", "Produto", "Categoria", "Quantidade", "Valor", "Desconto", "Status"]
      },
      {
        nome: "Modelo 3 — Financeiro de Vendas",
        descricao: "Analise receitas, custos, despesas, débitos, valores a receber e resultado líquido por período.",
        campos: ["Data", "Tipo", "Categoria", "Descrição", "Conta", "Valor", "Situação"]
      }
    ]
  },
  {
    id: "dashboard-contabil",
    categoria: "Contabilidade",
    nome: "Dashboard Contábil",
    descricao: "Acompanhe lançamentos, receitas, despesas, contas, resultado, DRE e evolução contábil por período.",
    destaque: "Visão contábil",
    cor: "navy",
    tipo: "profissional",
    preco: 49.9,
    status: "em_breve",
    checkoutUrl: ""
  }
];

const catalogState = {
  templates: [],
  plan: "todos",
  category: "todos",
  visibleCount: Number(config.initialVisibleTemplates) || 6,
  initialLimit: Number(config.initialVisibleTemplates) || 6,
  currency: "BRL"
};

function dashboardBars(seed = 0) {
  const sets = [
    [39, 63, 48, 81, 58, 92],
    [73, 46, 65, 52, 87, 71],
    [50, 82, 57, 68, 42, 76]
  ];
  return sets[seed % sets.length]
    .map((height) => `<i style="height:${height}%"></i>`)
    .join("");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

function safeUrl(value = "") {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function formatPrice(template) {
  if (template.tipo === "gratuito") return "Grátis";
  const price = Number(template.preco);
  if (!Number.isFinite(price)) return "Preço em breve";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: catalogState.currency
  }).format(price);
}

const PURCHASABLE_DASHBOARD_IDS = new Set([
  "agronegocio",
  "restaurante-e-delivery",
  "vendas-e-faturamento",
  "ecommerce",
  "compras-e-fornecedores",
  "contas-a-receber"
]);

function finalAction(template) {
  const paid = template.tipo !== "gratuito";
  const available = template.status === "disponivel";
  const targetUrl = safeUrl(paid ? template.checkoutUrl : template.arquivoUrl);

  if (paid && PURCHASABLE_DASHBOARD_IDS.has(template.id)) {
    return `<button class="template-action professional detail-action" type="button" data-buy-id="${escapeHtml(template.id)}" aria-label="Comprar ${escapeHtml(template.nome)} com Pix">Comprar</button>`;
  }

  if (paid) {
    return `<button class="template-action detail-action" type="button" disabled aria-disabled="true">Comprar<small>Em breve</small></button>`;
  }

  if (available && targetUrl) {
    const label = paid ? "Comprar" : "Baixar";
    const download = paid ? "" : " download";
    return `<a class="template-action ${paid ? "professional" : "free"} detail-action" href="${escapeHtml(targetUrl)}"${download}>${label}</a>`;
  }

  return `<button class="template-action detail-action" type="button" disabled aria-disabled="true">${paid ? "Comprar" : "Baixar"}<small>Em breve</small></button>`;
}

function detailsButton(template) {
  return `<button class="template-action details" type="button" data-details-id="${escapeHtml(template.id)}" aria-label="Ver detalhes de ${escapeHtml(template.nome)}">Ver mais</button>`;
}

function planInfo(type) {
  if (type === "pessoal_pro") return { label: "PESSOAL PRO", className: "personal-pro" };
  if (type === "profissional") return { label: "PROFISSIONAL", className: "professional" };
  return { label: "GRATUITO", className: "free" };
}

function templateCard(template, index) {
  const article = document.createElement("article");
  const plan = planInfo(template.tipo);
  article.className = `template-card template-${template.cor || "yellow"} template-${plan.className}`;
  article.innerHTML = `
    <div class="template-preview" aria-hidden="true">
      <div class="template-preview-top"><span></span><b>${escapeHtml(template.destaque || "Visão geral")}</b></div>
      <div class="template-preview-kpis"><i></i><i></i><i></i></div>
      <div class="template-preview-body">
        <div class="template-preview-bars">${dashboardBars(index)}</div>
        <div class="template-preview-donut"></div>
      </div>
      <span class="template-plan-badge">${plan.label}</span>
    </div>
    <div class="template-card-copy">
      <div class="template-card-meta"><small>${escapeHtml(template.categoria || "Dashboard")}</small><span>Excel + JSON</span></div>
      <h3>${escapeHtml(template.nome)}</h3>
      <p>${escapeHtml(template.descricao)}</p>
      <div class="template-card-footer">
        <strong class="template-price">${escapeHtml(formatPrice(template))}</strong>
        ${detailsButton(template)}
      </div>
    </div>
  `;
  return article;
}

function filteredTemplates() {
  return catalogState.templates.filter((template) => {
    const planMatches = catalogState.plan === "todos" || template.tipo === catalogState.plan;
    const categoryMatches = catalogState.category === "todos" || template.categoria === catalogState.category;
    return planMatches && categoryMatches;
  });
}

function renderCatalog() {
  if (!grid) return;
  const filtered = filteredTemplates();
  const visible = filtered.slice(0, catalogState.visibleCount);

  grid.replaceChildren(...visible.map(templateCard));
  if (status) {
    status.textContent = `${filtered.length} ${filtered.length === 1 ? "modelo encontrado" : "modelos encontrados"}`;
  }

  if (moreButton) {
    const remaining = Math.max(0, filtered.length - catalogState.visibleCount);
    moreButton.hidden = remaining === 0;
    moreButton.textContent = "Ver mais";
  }
}

function fillCategories() {
  if (!categoryFilter) return;
  const categories = [...new Set(catalogState.templates.map((template) => template.categoria).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
  const options = categories.map((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    return option;
  });
  categoryFilter.append(...options);
}

planFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-plan]");
  if (!button) return;
  catalogState.plan = button.dataset.plan;
  catalogState.visibleCount = catalogState.initialLimit;
  for (const item of planFilters.querySelectorAll("button")) {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  }
  renderCatalog();
});

categoryFilter?.addEventListener("change", () => {
  catalogState.category = categoryFilter.value;
  catalogState.visibleCount = catalogState.initialLimit;
  renderCatalog();
});

moreButton?.addEventListener("click", () => {
  catalogState.visibleCount += catalogState.initialLimit;
  renderCatalog();
});

function closeModelsModal() {
  if (!modelsModal) return;
  modelsModal.hidden = true;
  document.body.classList.remove("models-modal-open");
  modalTrigger?.focus();
  modalTrigger = null;
}

function templateFeatures(template) {
  if (Array.isArray(template.recursos) && template.recursos.length) return template.recursos;
  if (Array.isArray(template.modelos) && template.modelos.length) {
    return [
      `${template.modelos.length} modelos de painel`,
      "Indicadores comerciais e financeiros",
      "Filtros por plataforma e período",
      "Estrutura compatível com Excel e JSON"
    ];
  }

  const descriptionParts = String(template.descricao || "")
    .replace(/[.]+$/g, "")
    .split(/,| e /)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  return [
    template.destaque || "Visão geral",
    ...descriptionParts,
    "Filtros por período e categoria",
    "Estrutura compatível com Excel e JSON"
  ].filter((item, index, array) => array.indexOf(item) === index).slice(0, 6);
}

function modalDashboardPreview(template) {
  const seed = catalogTemplates.findIndex((item) => item.id === template.id);
  const plan = planInfo(template.tipo);
  const imageUrl = safeUrl(template.previewUrl);
  if (imageUrl) {
    return `<img src="${escapeHtml(imageUrl)}" alt="Exemplo visual do dashboard ${escapeHtml(template.nome)}" loading="lazy" />`;
  }

  return `
    <div class="detail-dashboard template-${escapeHtml(template.cor || "yellow")}" aria-hidden="true">
      <div class="detail-dashboard-bar"><span>${escapeHtml(template.nome)}</span><b>${escapeHtml(plan.label)}</b></div>
      <div class="detail-dashboard-content">
        <div class="detail-dashboard-kpis"><article><small>INDICADOR PRINCIPAL</small><strong>R$ 128,4 mil</strong><i>+12,8%</i></article><article><small>RESULTADO</small><strong>R$ 43,7 mil</strong><i>+8,3%</i></article><article><small>VOLUME</small><strong>1.284</strong><i>Atualizado</i></article></div>
        <div class="detail-dashboard-visuals">
          <div class="detail-dashboard-chart"><span>${escapeHtml(template.destaque || "Evolução por período")}</span><div class="detail-dashboard-bars">${dashboardBars(Math.max(0, seed))}</div></div>
          <div class="detail-dashboard-donut"><span>Distribuição</span><i></i></div>
        </div>
        <div class="detail-dashboard-table"><span></span><span></span><span></span><span></span></div>
      </div>
    </div>`;
}

function openModelsModal(template, trigger) {
  if (!modelsModal || !modelsModalTitle || !modelsModalList || !modelsModalPreview || !modelsModalFeatures || !modelsModalAction) return;
  modalTrigger = trigger || document.activeElement;
  const plan = planInfo(template.tipo);
  modelsModalTitle.textContent = template.nome;
  if (modelsModalDescription) modelsModalDescription.textContent = template.descricao;
  if (modelsModalEyebrow) modelsModalEyebrow.textContent = `${template.categoria} • ${plan.label}`;
  modelsModalPreview.innerHTML = modalDashboardPreview(template);
  if (modelsModalMeta) {
    modelsModalMeta.innerHTML = `<span>Power BI</span><span>Excel</span><span>JSON</span><span>${escapeHtml(template.categoria)}</span>`;
  }
  modelsModalFeatures.replaceChildren(...templateFeatures(template).map((feature) => {
    const item = document.createElement("li");
    item.textContent = feature;
    return item;
  }));

  const models = Array.isArray(template.modelos) ? template.modelos : [];
  modelsModalList.replaceChildren(...models.map((model) => {
    const article = document.createElement("article");
    const fields = Array.isArray(model.campos)
      ? `<div class="model-fields">${model.campos.map((field) => `<span>${escapeHtml(field)}</span>`).join("")}</div>`
      : "";
    article.innerHTML = `
      <div><strong>${escapeHtml(model.nome)}</strong><p>${escapeHtml(model.descricao)}</p>${fields}</div>
    `;
    return article;
  }));
  modelsModalList.hidden = models.length === 0;
  if (modelsModalPrice) modelsModalPrice.textContent = formatPrice(template);
  modelsModalAction.innerHTML = finalAction(template);
  modelsModal.hidden = false;
  document.body.classList.add("models-modal-open");
  modelsModal.querySelector("[data-close-models]")?.focus();
}

grid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-details-id]");
  if (!button) return;
  const template = catalogTemplates.find((item) => item.id === button.dataset.detailsId);
  if (template) openModelsModal(template, button);
});

modelsModal?.addEventListener("click", (event) => {
  if (event.target === modelsModal || event.target.closest("[data-close-models]")) closeModelsModal();
});

function closeDashboardMobileMenu() {
  if (!dashboardMenuToggle || !dashboardMobileMenu) return;
  dashboardMobileMenu.hidden = true;
  dashboardMenuToggle.setAttribute("aria-expanded", "false");
  dashboardMenuToggle.setAttribute("aria-label", "Abrir menu");
}

function toggleDashboardMobileMenu() {
  if (!dashboardMenuToggle || !dashboardMobileMenu) return;
  const willOpen = dashboardMobileMenu.hidden;
  dashboardMobileMenu.hidden = !willOpen;
  dashboardMenuToggle.setAttribute("aria-expanded", String(willOpen));
  dashboardMenuToggle.setAttribute("aria-label", willOpen ? "Fechar menu" : "Abrir menu");
}

dashboardMenuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDashboardMobileMenu();
});

dashboardMobileMenu?.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeDashboardMobileMenu();
});

document.addEventListener("click", (event) => {
  if (!dashboardMobileMenu || dashboardMobileMenu.hidden) return;
  if (event.target.closest("#dashboard-mobile-menu") || event.target.closest("#dashboard-menu-toggle")) return;
  closeDashboardMobileMenu();
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 900) closeDashboardMobileMenu();
}, { passive: true });

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (dashboardMobileMenu && !dashboardMobileMenu.hidden) {
    closeDashboardMobileMenu();
    dashboardMenuToggle?.focus();
    return;
  }
  if (purchaseModal && !purchaseModal.hidden) {
    closePurchaseModal();
    return;
  }
  if (!modelsModal?.hidden) closeModelsModal();
});

function clearPurchasePolling() {
  if (purchasePollTimer) window.clearInterval(purchasePollTimer);
  purchasePollTimer = null;
  purchasePollBusy = false;
  purchasePollCount = 0;
}

function setPurchaseMessage(text = "", type = "") {
  if (!purchaseMessage) return;
  purchaseMessage.textContent = text;
  purchaseMessage.className = `purchase-message${type ? ` ${type}` : ""}`;
  purchaseMessage.hidden = !text;
}

function resetPurchaseModal() {
  clearPurchasePolling();
  purchaseForm?.reset();
  if (purchasePixArea) purchasePixArea.hidden = true;
  if (purchaseSuccess) purchaseSuccess.hidden = true;
  if (purchaseQr) purchaseQr.removeAttribute("src");
  if (purchasePixCode) purchasePixCode.value = "";
  if (purchaseSubmit) {
    purchaseSubmit.disabled = false;
    purchaseSubmit.textContent = "Gerar Pix";
  }
  setPurchaseMessage();
}

function openPurchaseModal(template, trigger) {
  if (!purchaseModal || !purchaseForm) return;
  activePurchaseTemplate = template;
  purchaseTrigger = trigger || document.activeElement;
  resetPurchaseModal();
  if (purchaseTitle) purchaseTitle.textContent = "Comprar com Pix";
  if (purchaseDashboardName) purchaseDashboardName.textContent = template.nome;
  if (purchaseDashboardPrice) purchaseDashboardPrice.textContent = formatPrice(template);
  purchaseForm.elements.dashboardId.value = template.id;
  purchaseForm.elements.formStartedAt.value = String(Date.now());
  purchaseModal.hidden = false;
  document.body.classList.add("purchase-modal-open");
  window.setTimeout(() => purchaseForm.elements.firstName?.focus(), 0);
}

function closePurchaseModal() {
  if (!purchaseModal) return;
  clearPurchasePolling();
  purchaseModal.hidden = true;
  document.body.classList.remove("purchase-modal-open");
  purchaseTrigger?.focus();
  purchaseTrigger = null;
  activePurchaseTemplate = null;
}

async function parseApiResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function pollPurchaseStatus(purchaseId, token) {
  if (purchasePollBusy) return;
  purchasePollBusy = true;
  purchasePollCount += 1;
  const verifyWithMercadoPago = purchasePollCount >= 3 && purchasePollCount % 4 === 3;
  try {
    const verifyQuery = verifyWithMercadoPago ? "?verify=1" : "";
    const response = await fetch(`/api/dashboard-store/purchases/${encodeURIComponent(purchaseId)}/status${verifyQuery}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Purchase-Token": token,
        "X-Dashboard-Checkout": "1"
      }
    });
    if (!response.ok) return;
    const data = await parseApiResponse(response);
    if (data.status === "paid") {
      clearPurchasePolling();
      if (purchaseSuccess) {
        purchaseSuccess.hidden = false;
        const delivery = data.emailStatus === "sent"
          ? "O arquivo foi enviado para o seu e-mail."
          : "Pagamento confirmado. O arquivo está sendo enviado para o seu e-mail.";
        purchaseSuccess.innerHTML = `<strong>Compra realizada com sucesso!</strong><span>${escapeHtml(delivery)}</span>`;
      }
      if (purchasePixArea) purchasePixArea.classList.add("purchase-paid");
      setPurchaseMessage();
    } else if (["failed", "canceled", "expired"].includes(data.status)) {
      clearPurchasePolling();
      setPurchaseMessage("Este Pix não foi concluído. Gere uma nova cobrança para tentar novamente.", "error");
    }
  } finally {
    purchasePollBusy = false;
  }
}

function startPurchasePolling(purchaseId, token) {
  clearPurchasePolling();
  pollPurchaseStatus(purchaseId, token);
  purchasePollTimer = window.setInterval(() => pollPurchaseStatus(purchaseId, token), 2500);
}

purchaseForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activePurchaseTemplate || !purchaseSubmit) return;
  const formData = new FormData(purchaseForm);
  const payload = {
    dashboardId: String(formData.get("dashboardId") || ""),
    firstName: String(formData.get("firstName") || ""),
    lastName: String(formData.get("lastName") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    companyWebsite: String(formData.get("companyWebsite") || ""),
    formStartedAt: Number(formData.get("formStartedAt") || 0)
  };

  purchaseSubmit.disabled = true;
  purchaseSubmit.textContent = "Gerando Pix...";
  setPurchaseMessage("Criando cobrança segura no Mercado Pago...", "info");

  try {
    const response = await fetch(config.checkoutEndpoint || "/api/dashboard-store/checkout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Dashboard-Checkout": "1"
      },
      body: JSON.stringify(payload)
    });
    const data = await parseApiResponse(response);
    if (!response.ok) throw new Error(data.message || "Não foi possível gerar o Pix.");

    if (purchaseQr && data.qrCodeBase64) {
      purchaseQr.src = `data:image/png;base64,${data.qrCodeBase64}`;
    }
    if (purchasePixCode) purchasePixCode.value = data.qrCode || "";
    if (purchasePixArea) {
      purchasePixArea.hidden = false;
      purchasePixArea.classList.remove("purchase-paid");
    }
    purchaseSubmit.textContent = "Pix gerado";
    setPurchaseMessage("Aguardando o pagamento. A confirmação é automática.", "info");
    startPurchasePolling(data.purchaseId, data.statusToken);
  } catch (error) {
    purchaseSubmit.disabled = false;
    purchaseSubmit.textContent = "Gerar Pix";
    setPurchaseMessage(error instanceof Error ? error.message : "Não foi possível gerar o Pix.", "error");
  }
});

purchaseCopy?.addEventListener("click", async () => {
  const value = purchasePixCode?.value || "";
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    purchaseCopy.textContent = "Copiado!";
    window.setTimeout(() => { purchaseCopy.textContent = "Copiar Pix"; }, 1600);
  } catch {
    purchasePixCode?.select();
    document.execCommand("copy");
  }
});

modelsModalAction?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-buy-id]");
  if (!button) return;
  const template = catalogTemplates.find((item) => item.id === button.dataset.buyId);
  if (!template) return;

  // No celular, dois modais fixos sobrepostos podem bloquear toque/rolagem.
  // Fecha a prévia antes de abrir o checkout e preserva o botão como origem.
  const trigger = button;
  if (modelsModal) {
    modelsModal.hidden = true;
    document.body.classList.remove("models-modal-open");
    modalTrigger = null;
  }
  openPurchaseModal(template, trigger);
});

purchaseModal?.addEventListener("click", (event) => {
  if (event.target === purchaseModal || event.target.closest("[data-close-purchase]")) closePurchaseModal();
});

function updateScrollTopButton() {
  scrollTopButton?.classList.toggle("visible", window.scrollY > 480);
}

scrollTopButton?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", updateScrollTopButton, { passive: true });
updateScrollTopButton();

function loadCatalog() {
  if (!grid) return;
  catalogState.templates = catalogTemplates;
  fillCategories();
  renderCatalog();
}

loadCatalog();
