const config = window.PROCURANDO_DASHBOARD_CONFIG || {};
const grid = document.querySelector("#templates-grid");
const status = document.querySelector("#catalog-status");
const planFilters = document.querySelector("#catalog-plan-filters");
const categoryFilter = document.querySelector("#catalog-category-filter");
const moreButton = document.querySelector("#catalog-more");
const modelsModal = document.querySelector("#models-modal");
const modelsModalTitle = document.querySelector("#models-modal-title");
const modelsModalList = document.querySelector("#models-modal-list");
const scrollTopButton = document.querySelector("#scroll-top");

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

function cardAction(template) {
  if (Array.isArray(template.modelos) && template.modelos.length) {
    return `<button class="template-action models" type="button" data-models-id="${escapeHtml(template.id)}">Ver modelos</button>`;
  }

  const paid = template.tipo !== "gratuito";
  const available = template.status === "disponivel";
  const targetUrl = safeUrl(paid ? template.checkoutUrl : template.arquivoUrl);

  if (available && targetUrl) {
    const label = paid ? "Comprar agora" : "Baixar grátis";
    return `<a class="template-action ${paid ? "professional" : "free"}" href="${escapeHtml(targetUrl)}">${label}</a>`;
  }

  return `<button type="button" disabled aria-disabled="true">${paid ? "Comprar em breve" : "Download em breve"}</button>`;
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
        ${cardAction(template)}
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
}

function openModelsModal(template) {
  if (!modelsModal || !modelsModalTitle || !modelsModalList) return;
  modelsModalTitle.textContent = template.nome;
  modelsModalList.replaceChildren(...template.modelos.map((model) => {
    const article = document.createElement("article");
    const fields = Array.isArray(model.campos)
      ? `<div class="model-fields">${model.campos.map((field) => `<span>${escapeHtml(field)}</span>`).join("")}</div>`
      : "";
    article.innerHTML = `
      <div><strong>${escapeHtml(model.nome)}</strong><p>${escapeHtml(model.descricao)}</p>${fields}</div>
      <button type="button" disabled aria-disabled="true">Em breve</button>
    `;
    return article;
  }));
  modelsModal.hidden = false;
  document.body.classList.add("models-modal-open");
  modelsModal.querySelector("[data-close-models]")?.focus();
}

grid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-models-id]");
  if (!button) return;
  const template = catalogTemplates.find((item) => item.id === button.dataset.modelsId);
  if (template) openModelsModal(template);
});

modelsModal?.addEventListener("click", (event) => {
  if (event.target === modelsModal || event.target.closest("[data-close-models]")) closeModelsModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modelsModal?.hidden) closeModelsModal();
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
