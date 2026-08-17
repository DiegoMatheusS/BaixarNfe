const MODAL_NAMES = {
  "01": "RODOVIÁRIO",
  "02": "AÉREO",
  "03": "AQUAVIÁRIO",
  "04": "FERROVIÁRIO",
  "05": "DUTOVIÁRIO",
  "06": "MULTIMODAL",
};

const CTE_TYPES = {
  "0": "NORMAL",
  "1": "COMPLEMENTO DE VALORES",
  "2": "ANULAÇÃO DE VALORES",
  "3": "SUBSTITUIÇÃO",
};

const SERVICE_TYPES = {
  "0": "NORMAL",
  "1": "SUBCONTRATAÇÃO",
  "2": "REDESPACHO",
  "3": "REDESPACHO INTERMEDIÁRIO",
  "4": "SERVIÇO VINCULADO A MULTIMODAL",
};

const FREIGHT_TYPES = {
  "0": "0 - REMETENTE (CIF)",
  "1": "1 - DESTINATÁRIO (FOB)",
  "2": "2 - TERCEIROS",
  "3": "3 - TRANSPORTE PRÓPRIO/REMETENTE",
  "4": "4 - TRANSPORTE PRÓPRIO/DESTINATÁRIO",
  "9": "9 - SEM FRETE",
};

const CARGO_UNITS = {
  "00": "M³",
  "01": "KG",
  "02": "TON",
  "03": "UN",
  "04": "L",
  "05": "MMBTU",
};

function elements(node, name) {
  if (!node) return [];
  return Array.from(node.getElementsByTagNameNS("*", name)).length
    ? Array.from(node.getElementsByTagNameNS("*", name))
    : Array.from(node.getElementsByTagName(name));
}

function element(node, name) {
  return elements(node, name)[0] || null;
}

function text(node, name) {
  return element(node, name)?.textContent?.trim() || "";
}

function directElement(node, name) {
  if (!node) return null;
  return Array.from(node.children || []).find((child) => child.localName === name || child.nodeName === name) || null;
}

function directText(node, name) {
  return directElement(node, name)?.textContent?.trim() || "";
}

function cleanKey(value) {
  return String(value || "").replace(/\D/g, "");
}

function keyGroups(value) {
  return String(value || "").match(/.{1,4}/g)?.join(" ") || value || "—";
}

function formatDocument(value) {
  const digits = cleanKey(value);
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return value || "—";
}

function formatZip(value) {
  const digits = cleanKey(value);
  return digits.length === 8 ? digits.replace(/^(\d{5})(\d{3})$/, "$1-$2") : value || "—";
}

function formatNumber(value, decimals = 2) {
  const number = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(number)
    ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(number)
    : "0,00";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function address(node, tag) {
  const value = element(node, tag);
  return {
    street: text(value, "xLgr"),
    number: text(value, "nro"),
    complement: text(value, "xCpl"),
    district: text(value, "xBairro"),
    city: text(value, "xMun"),
    state: text(value, "UF"),
    zip: text(value, "CEP"),
    country: text(value, "xPais"),
    phone: text(value, "fone"),
  };
}

function party(node, addressTag) {
  if (!node) return null;
  return {
    name: directText(node, "xNome") || text(node, "xNome") || "NÃO INFORMADO",
    fantasy: directText(node, "xFant") || text(node, "xFant"),
    document: directText(node, "CNPJ") || directText(node, "CPF") || text(node, "idEstrangeiro"),
    ie: directText(node, "IE") || "ISENTO",
    iesT: directText(node, "IEST"),
    im: directText(node, "IM"),
    sufRama: directText(node, "ISUF"),
    address: address(node, addressTag),
  };
}

function fullAddress(value) {
  if (!value) return "NÃO INFORMADO";
  const first = [value.street, value.number].filter(Boolean).join(", ");
  const city = [value.city, value.state].filter(Boolean).join(" - ");
  return [first, value.complement, value.district, city, value.zip ? `CEP ${formatZip(value.zip)}` : ""]
    .filter(Boolean)
    .join(" · ") || "NÃO INFORMADO";
}

function parseNfe(documentNode) {
  const info = element(documentNode, "infNFe");
  const ide = element(info, "ide");
  const emitterNode = element(info, "emit");
  const recipientNode = element(info, "dest");
  const totalsNode = element(info, "ICMSTot");
  const protocol = element(documentNode, "infProt");
  const transportNode = element(info, "transp");
  const carrierNode = element(transportNode, "transporta");
  const vehicleNode = element(transportNode, "veicTransp");
  const volumeNode = element(transportNode, "vol");
  const invoiceNode = element(info, "fat");
  const additionalNode = element(info, "infAdic");
  const ibsCbsTotals = element(info, "IBSCBSTot");
  const issqnTotals = element(info, "ISSQNtot");

  if (!info || !ide || !emitterNode) throw new Error("Este XML não possui os dados mínimos de uma NF-e.");
  const model = text(ide, "mod") || "55";
  if (model !== "55") throw new Error(`O modelo ${model} não é uma NF-e modelo 55.`);

  const items = elements(info, "det").map((detail) => {
    const product = element(detail, "prod");
    const tax = element(detail, "imposto");
    return {
      number: detail.getAttribute("nItem") || "",
      code: text(product, "cProd"),
      description: [text(product, "xProd"), text(detail, "infAdProd")].filter(Boolean).join(" · "),
      ncm: text(product, "NCM"),
      cst: text(tax, "CST") || text(tax, "CSOSN"),
      cfop: text(product, "CFOP"),
      unit: text(product, "uCom"),
      quantity: text(product, "qCom"),
      unitValue: text(product, "vUnCom"),
      total: text(product, "vProd"),
      taxBase: text(tax, "vBC"),
      icms: text(tax, "vICMS"),
      ipi: text(tax, "vIPI"),
      icmsRate: text(tax, "pICMS"),
      ipiRate: text(tax, "pIPI"),
    };
  });

  const duplicates = elements(info, "dup").map((dup) => ({
    number: text(dup, "nDup"),
    dueDate: text(dup, "dVenc"),
    value: text(dup, "vDup"),
  }));

  const accessKey = cleanKey(info.getAttribute("Id")?.replace(/^NFe/i, "") || text(protocol, "chNFe"));
  const issueDate = text(ide, "dhEmi") || text(ide, "dEmi");
  const exitDate = text(ide, "dhSaiEnt") || text(ide, "dSaiEnt");

  return {
    kind: "nfe",
    accessKey,
    number: text(ide, "nNF") || "—",
    series: text(ide, "serie") || "—",
    model,
    printType: text(ide, "tpImp") || "1",
    issueDate,
    exitDate,
    exitTime: text(ide, "dhSaiEnt") || text(ide, "hSaiEnt"),
    operation: text(ide, "natOp") || "NÃO INFORMADA",
    invoiceType: text(ide, "tpNF") === "0" ? "0 - ENTRADA" : "1 - SAÍDA",
    destinationOperation: text(ide, "idDest"),
    purpose: text(ide, "finNFe"),
    environment: text(ide, "tpAmb") === "2" ? "HOMOLOGAÇÃO" : "PRODUÇÃO",
    issueType: text(ide, "tpEmis") || "1",
    contingencyDate: text(ide, "dhCont"),
    contingencyReason: text(ide, "xJust"),
    protocol: text(protocol, "nProt"),
    protocolDate: text(protocol, "dhRecbto"),
    emitter: party(emitterNode, "enderEmit"),
    recipient: party(recipientNode, "enderDest"),
    items,
    totals: {
      taxBase: text(totalsNode, "vBC"),
      icms: text(totalsNode, "vICMS"),
      icmsDeson: text(totalsNode, "vICMSDeson"),
      fcp: text(totalsNode, "vFCP"),
      stBase: text(totalsNode, "vBCST"),
      st: text(totalsNode, "vST"),
      fcpSt: text(totalsNode, "vFCPST"),
      products: text(totalsNode, "vProd"),
      freight: text(totalsNode, "vFrete"),
      insurance: text(totalsNode, "vSeg"),
      discount: text(totalsNode, "vDesc"),
      importTax: text(totalsNode, "vII"),
      ipi: text(totalsNode, "vIPI"),
      returnedIpi: text(totalsNode, "vIPIDevol"),
      pis: text(totalsNode, "vPIS"),
      cofins: text(totalsNode, "vCOFINS"),
      other: text(totalsNode, "vOutro"),
      estimatedTaxes: text(totalsNode, "vTotTrib"),
      invoice: text(totalsNode, "vNF"),
      reform: ibsCbsTotals ? {
        base: directText(ibsCbsTotals, "vBCIBSCBS"),
        ibsState: text(element(ibsCbsTotals, "gIBSUF"), "vIBSUF"),
        ibsCity: text(element(ibsCbsTotals, "gIBSMun"), "vIBSMun"),
        ibs: text(element(ibsCbsTotals, "gIBS"), "vIBS"),
        cbs: text(element(ibsCbsTotals, "gCBS"), "vCBS"),
      } : null,
    },
    serviceTaxes: {
      municipalRegistration: text(emitterNode, "IM"),
      services: text(issqnTotals, "vServ"),
      taxBase: text(issqnTotals, "vBC"),
      issqn: text(issqnTotals, "vISS"),
    },
    transport: {
      freightMode: FREIGHT_TYPES[text(transportNode, "modFrete")] || text(transportNode, "modFrete") || "NÃO INFORMADO",
      carrier: text(carrierNode, "xNome"),
      document: directText(carrierNode, "CNPJ") || directText(carrierNode, "CPF"),
      ie: text(carrierNode, "IE"),
      address: text(carrierNode, "xEnder"),
      city: text(carrierNode, "xMun"),
      state: text(carrierNode, "UF"),
      plate: text(vehicleNode, "placa"),
      plateState: text(vehicleNode, "UF"),
      rntc: text(vehicleNode, "RNTC"),
      quantity: text(volumeNode, "qVol"),
      species: text(volumeNode, "esp"),
      brand: text(volumeNode, "marca"),
      numbering: text(volumeNode, "nVol"),
      grossWeight: text(volumeNode, "pesoB"),
      netWeight: text(volumeNode, "pesoL"),
    },
    billing: {
      number: text(invoiceNode, "nFat"),
      original: text(invoiceNode, "vOrig"),
      discount: text(invoiceNode, "vDesc"),
      net: text(invoiceNode, "vLiq"),
      duplicates,
    },
    additionalInfo: text(additionalNode, "infCpl"),
    fiscalInfo: text(additionalNode, "infAdFisco"),
  };
}

function cteParty(info, tag, addressTag) {
  return party(element(info, tag), addressTag);
}

function modalDetails(info, modalCode) {
  const details = [];
  const push = (label, value) => { if (value) details.push({ label, value }); };

  if (modalCode === "01") {
    const road = element(info, "rodo");
    push("RNTRC", text(road, "RNTRC"));
  } else if (modalCode === "02") {
    const air = element(info, "aereo");
    push("NÚMERO OPERACIONAL", text(air, "nOCA"));
    push("CLASSE DA TARIFA", text(air, "CL"));
    push("CÓDIGO DA TARIFA", text(air, "cTar"));
    push("VALOR DA TARIFA", text(air, "vTar"));
    push("NÚMERO DA MINUTA", text(air, "nMinu"));
    push("RETIRA", text(air, "xDime"));
    push("PREVISÃO AÉREA", formatDate(text(air, "dPrevAereo")));
  } else if (modalCode === "03") {
    const water = element(info, "aquav");
    push("PORTO DE EMBARQUE", text(water, "prtEmb"));
    push("PORTO DE DESTINO", text(water, "prtDest"));
    push("NAVIO / REBOCADOR", text(water, "xNavio"));
    push("AFRMM", text(water, "vAFRMM") ? formatNumber(text(water, "vAFRMM")) : "");
    elements(water, "balsa").forEach((node, index) => push(`BALSA ${index + 1}`, text(node, "xBalsa")));
    elements(water, "detCont").forEach((node, index) => {
      push(`CONTÊINER ${index + 1}`, text(node, "nCont"));
      push(`LACRE ${index + 1}`, elements(node, "nLacre").map((lacre) => lacre.textContent?.trim()).filter(Boolean).join(", "));
    });
  } else if (modalCode === "04") {
    const rail = element(info, "ferrov");
    push("TIPO DE TRÁFEGO", text(rail, "tpTraf"));
    push("FLUXO FERROVIÁRIO", text(rail, "fluxo"));
    push("RESPONSÁVEL PELO FATURAMENTO", text(rail, "respFat"));
    push("EMISSOR DO CT-e", text(rail, "ferrEmi"));
    push("VALOR DO FRETE", text(rail, "vFrete") ? formatNumber(text(rail, "vFrete")) : "");
  } else if (modalCode === "05") {
    const pipe = element(info, "duto");
    push("VALOR DA TARIFA", text(pipe, "vTar"));
    push("DATA INICIAL", formatDate(text(pipe, "dIni")));
    push("DATA FINAL", formatDate(text(pipe, "dFim")));
  } else if (modalCode === "06") {
    const multimodal = element(info, "multimodal");
    push("COTM", text(multimodal, "COTM"));
    push("NEGOCIÁVEL", text(multimodal, "indNegociavel") === "1" ? "SIM" : text(multimodal, "indNegociavel") ? "NÃO" : "");
    const insurance = element(multimodal, "seg");
    push("SEGURADORA", text(insurance, "xSeg"));
    push("CNPJ DA SEGURADORA", formatDocument(text(insurance, "CNPJ")));
    push("APÓLICE", text(insurance, "nApol"));
    push("AVERBAÇÃO", elements(insurance, "nAver").map((node) => node.textContent?.trim()).filter(Boolean).join(", "));
  }

  return details;
}

function parseCte(documentNode) {
  const info = element(documentNode, "infCte");
  const ide = element(info, "ide");
  const emitterNode = element(info, "emit");
  const protocol = element(documentNode, "infProt");
  const values = element(info, "vPrest");
  const taxNode = element(info, "ICMS");
  const cargoNode = element(info, "infCarga");
  const normalNode = element(info, "infCTeNorm");
  const documentsNode = element(normalNode || info, "infDoc");
  const complementNode = element(info, "compl");
  const reformTaxNode = element(element(info, "imp"), "IBSCBS");

  if (!info || !ide || !emitterNode) throw new Error("Este XML não possui os dados mínimos de um CT-e.");
  const model = text(ide, "mod") || "57";
  if (model !== "57") throw new Error(`O modelo ${model} não é um CT-e de cargas modelo 57.`);

  const sender = cteParty(info, "rem", "enderReme");
  const recipient = cteParty(info, "dest", "enderDest");
  const dispatcher = cteParty(info, "exped", "enderExped");
  const receiver = cteParty(info, "receb", "enderReceb");
  const toma3 = element(ide, "toma3");
  const toma4 = element(ide, "toma4");
  const takerCode = text(toma3 || toma4, "toma");
  const knownTakers = { "0": sender, "1": dispatcher, "2": receiver, "3": recipient };
  const taker = toma4 && (text(toma4, "xNome") || text(toma4, "CNPJ") || text(toma4, "CPF"))
    ? party(toma4, "enderToma")
    : knownTakers[takerCode] || sender;

  const sourceDocuments = [
    ...elements(documentsNode || normalNode || info, "infNFe").map((node) => ({ type: "NF-e", value: text(node, "chNFe") })),
    ...elements(documentsNode || normalNode || info, "infNF").map((node) => ({
      type: text(node, "mod") || "NF",
      value: [text(node, "serie"), text(node, "nDoc"), text(node, "dEmi")].filter(Boolean).join(" / "),
    })),
    ...elements(documentsNode || normalNode || info, "infOutros").map((node) => ({
      type: text(node, "tpDoc") || "OUTRO",
      value: [text(node, "descOutros"), text(node, "nDoc"), text(node, "dEmi")].filter(Boolean).join(" / "),
    })),
  ].filter((item) => item.value);

  const quantities = elements(cargoNode, "infQ").map((node) => ({
    measure: text(node, "tpMed") || "QUANTIDADE",
    unit: CARGO_UNITS[text(node, "cUnid")] || text(node, "cUnid") || "—",
    quantity: text(node, "qCarga"),
  }));

  const components = elements(values, "Comp").map((node) => ({
    name: text(node, "xNome") || "COMPONENTE",
    value: text(node, "vComp"),
  }));

  const observations = elements(complementNode || info, "xObs")
    .map((node) => node.textContent?.trim()).filter(Boolean).join(" · ");
  const emitterUse = elements(info, "ObsCont").map((node) =>
    [text(node, "xCampo"), text(node, "xTexto")].filter(Boolean).join(": ")).filter(Boolean).join(" · ");
  const fiscalUse = elements(info, "ObsFisco").map((node) =>
    [text(node, "xCampo"), text(node, "xTexto")].filter(Boolean).join(": ")).filter(Boolean).join(" · ");
  const modalCode = text(ide, "modal");
  const accessKey = cleanKey(info.getAttribute("Id")?.replace(/^CTe/i, "") || text(protocol, "chCTe"));

  return {
    kind: "cte",
    accessKey,
    number: text(ide, "nCT") || "—",
    series: text(ide, "serie") || "—",
    model,
    issueDate: text(ide, "dhEmi"),
    environment: text(ide, "tpAmb") === "2" ? "HOMOLOGAÇÃO — SEM VALOR FISCAL" : "PRODUÇÃO",
    issueType: text(ide, "tpEmis") || "1",
    protocol: text(protocol, "nProt"),
    protocolDate: text(protocol, "dhRecbto"),
    qrCode: text(documentNode, "qrCodCTe"),
    emitter: party(emitterNode, "enderEmit"),
    sender,
    recipient,
    dispatcher,
    receiver,
    taker,
    takerCode,
    cfop: text(ide, "CFOP"),
    operation: text(ide, "natOp") || "PRESTAÇÃO DE SERVIÇO DE TRANSPORTE",
    origin: [text(ide, "xMunIni"), text(ide, "UFIni")].filter(Boolean).join(" - "),
    destination: [text(ide, "xMunFim"), text(ide, "UFFim")].filter(Boolean).join(" - "),
    route: elements(ide, "infPercurso").map((node) => text(node, "UFPer")).filter(Boolean),
    modalCode,
    modal: MODAL_NAMES[modalCode] || modalCode || "NÃO INFORMADO",
    cteType: CTE_TYPES[text(ide, "tpCTe")] || text(ide, "tpCTe") || "NÃO INFORMADO",
    serviceType: SERVICE_TYPES[text(ide, "tpServ")] || text(ide, "tpServ") || "NÃO INFORMADO",
    globalized: text(ide, "indGlobalizado") === "1",
    pickup: text(ide, "retira") === "1",
    pickupDetails: text(ide, "xDetRetira"),
    totalService: text(values, "vTPrest"),
    amountReceivable: text(values, "vRec"),
    components,
    tax: {
      cst: text(taxNode, "CST"),
      taxBase: text(taxNode, "vBC") || text(taxNode, "vBCSTRet") || text(taxNode, "vBCOutraUF"),
      rate: text(taxNode, "pICMS") || text(taxNode, "pICMSSTRet") || text(taxNode, "pICMSOutraUF"),
      value: text(taxNode, "vICMS") || text(taxNode, "vICMSSTRet") || text(taxNode, "vICMSOutraUF"),
      reduction: text(taxNode, "pRedBC") || text(taxNode, "pRedBCOutraUF"),
      totalTaxes: text(element(info, "imp"), "vTotTrib"),
      reform: reformTaxNode ? {
        cst: directText(reformTaxNode, "CST"),
        classification: directText(reformTaxNode, "cClassTrib"),
        base: text(element(reformTaxNode, "gIBSCBS"), "vBC"),
        ibsStateRate: text(element(reformTaxNode, "gIBSUF"), "pIBSUF"),
        ibsState: text(element(reformTaxNode, "gIBSUF"), "vIBSUF"),
        ibsCityRate: text(element(reformTaxNode, "gIBSMun"), "pIBSMun"),
        ibsCity: text(element(reformTaxNode, "gIBSMun"), "vIBSMun"),
        ibs: text(element(reformTaxNode, "gIBSCBS"), "vIBS"),
        cbsRate: text(element(reformTaxNode, "gCBS"), "pCBS"),
        cbs: text(element(reformTaxNode, "gCBS"), "vCBS"),
      } : null,
    },
    cargo: {
      predominantProduct: text(cargoNode, "proPred"),
      otherCharacteristics: text(cargoNode, "xOutCat"),
      value: text(cargoNode, "vCarga"),
      quantities,
    },
    sourceDocuments,
    modalDetails: modalDetails(info, modalCode),
    observations,
    emitterUse,
    fiscalUse,
  };
}

export function parseFiscalXml(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("O XML contém uma declaração não permitida.");
  const documentNode = new DOMParser().parseFromString(xml, "application/xml");
  if (documentNode.querySelector("parsererror")) throw new Error("O conteúdo do XML está inválido.");
  if (element(documentNode, "infCte")) return parseCte(documentNode);
  if (element(documentNode, "infNFe")) return parseNfe(documentNode);
  throw new Error("O arquivo não foi reconhecido como NF-e ou CT-e.");
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shown(value) {
  return value === 0 || value ? value : "—";
}

function formatNfeNumber(value) {
  const digits = cleanKey(value);
  if (!digits) return shown(value);
  const padded = digits.slice(-9).padStart(9, "0");
  return `${padded.slice(0, 3)}.${padded.slice(3, 6)}.${padded.slice(6, 9)}`;
}

function field(label, value, className = "") {
  const ieClass = String(label || "").startsWith("INSCRIÇÃO ESTADUAL") ? " fiscal-field-ie" : "";
  return `<div class="fiscal-field ${esc(className)}${ieClass}"><span>${esc(label)}</span><b>${esc(shown(value))}</b></div>`;
}

function barcodeMarkup(rendered, selector) {
  const barcode = rendered?.querySelector(selector);
  return barcode?.outerHTML || '<div class="fiscal-barcode-missing">CHAVE NÃO LOCALIZADA</div>';
}

function nfeHeader(data, rendered, page, totalPages) {
  return `
    <div class="official-header official-nfe-header">
      <div class="official-emitter">
        <span class="official-emitter-label">IDENTIFICAÇÃO DO EMITENTE</span>
        <div class="official-emitter-body">
          <div class="official-emitter-logo" aria-hidden="true"></div>
          <div class="official-emitter-data">
            <strong>${esc(data.emitter.name)}</strong>
            ${data.emitter.fantasy ? `<b>${esc(data.emitter.fantasy)}</b>` : ""}
            <p>${esc(fullAddress(data.emitter.address))}</p>
            ${data.emitter.address.phone ? `<small>FONE: ${esc(data.emitter.address.phone)}</small>` : ""}
          </div>
        </div>
      </div>
      <div class="official-identity">
        <strong>DANFE</strong>
        <span>DOCUMENTO AUXILIAR DA<br>NOTA FISCAL ELETRÔNICA</span>
        <div class="official-identity-direction">
          <div><b>0 - ENTRADA</b><b>1 - SAÍDA</b></div>
          <strong>${esc(String(data.invoiceType || "1").trim().startsWith("0") ? "0" : "1")}</strong>
        </div>
        <h1>Nº. ${esc(formatNfeNumber(data.number))}</h1>
        <div class="official-identity-meta">
          <h2>SÉRIE ${esc(data.series)}</h2>
          <small>FOLHA ${page}/${totalPages}</small>
        </div>
      </div>
      <div class="official-access danfe-access">
        ${barcodeMarkup(rendered, ".danfe-access svg")}
        <span>CHAVE DE ACESSO</span>
        <strong>${esc(keyGroups(data.accessKey))}</strong>
        <p>Consulta de autenticidade no portal nacional da NF-e</p>
      </div>
    </div>
    <div class="fiscal-grid columns-12">
      ${field("NATUREZA DA OPERAÇÃO", data.operation, "span-7")}
      ${field("PROTOCOLO DE AUTORIZAÇÃO DE USO", data.protocol ? `${data.protocol} · ${formatDateTime(data.protocolDate)}` : "NÃO LOCALIZADO", "span-5")}
      ${field("INSCRIÇÃO ESTADUAL", data.emitter.ie, "span-4")}
      ${field("INSCRIÇÃO ESTADUAL DO SUBST. TRIBUTÁRIO", data.emitter.iesT, "span-4")}
      ${field("CNPJ / CPF", formatDocument(data.emitter.document), "span-4")}
    </div>`;
}

function receipt(data) {
  return `
    <div class="official-receipt">
      <div>
        <p>RECEBEMOS DE <strong>${esc(data.emitter.name)}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.</p>
        <div><span>DATA DE RECEBIMENTO</span><span>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span></div>
      </div>
      <aside><strong>NF-e</strong><b>Nº. ${esc(formatNfeNumber(data.number))}</b><b>SÉRIE ${esc(data.series)}</b></aside>
    </div>
    <div class="official-cut" aria-hidden="true"></div>`;
}

function destination(data) {
  const recipient = data.recipient || party(null, "");
  return `
    <h3 class="official-section-title">DESTINATÁRIO / REMETENTE</h3>
    <div class="fiscal-grid columns-12">
      ${field("NOME / RAZÃO SOCIAL", recipient?.name, "span-6")}
      ${field("CNPJ / CPF", formatDocument(recipient?.document), "span-3")}
      ${field("DATA DA EMISSÃO", formatDate(data.issueDate), "span-3")}
      ${field("ENDEREÇO", [recipient?.address?.street, recipient?.address?.number].filter(Boolean).join(", "), "span-5")}
      ${field("BAIRRO / DISTRITO", recipient?.address?.district, "span-3")}
      ${field("CEP", formatZip(recipient?.address?.zip), "span-2")}
      ${field("DATA DA SAÍDA / ENTRADA", formatDate(data.exitDate), "span-2")}
      ${field("MUNICÍPIO", recipient?.address?.city, "span-4")}
      ${field("FONE / FAX", recipient?.address?.phone, "span-2")}
      ${field("UF", recipient?.address?.state, "span-1")}
      ${field("INSCRIÇÃO ESTADUAL", recipient?.ie, "span-3")}
      ${field("HORA DA SAÍDA / ENTRADA", formatTime(data.exitTime), "span-2")}
    </div>`;
}

function billing(data) {
  if (!data.billing.number && !data.billing.duplicates.length) return "";
  const duplicates = data.billing.duplicates.map((duplicate) =>
    `<div><span>${esc(duplicate.number || "DUPLICATA")}</span><b>${esc(formatDate(duplicate.dueDate))}</b><strong>${esc(formatNumber(duplicate.value))}</strong></div>`).join("");
  return `
    <h3 class="official-section-title">FATURA / DUPLICATAS</h3>
    <div class="official-billing">
      ${data.billing.number ? `<div><span>FATURA</span><b>${esc(data.billing.number)}</b><strong>${esc(formatNumber(data.billing.net))}</strong></div>` : ""}
      ${duplicates}
    </div>`;
}

function nfeTaxes(data) {
  const firstRow = [
    ["BASE DE CÁLCULO DO ICMS", data.totals.taxBase],
    ["VALOR DO ICMS", data.totals.icms],
    ["BASE DE CÁLCULO DO ICMS ST", data.totals.stBase],
    ["VALOR DO ICMS SUBSTITUIÇÃO", data.totals.st],
    ["VALOR TOTAL DOS PRODUTOS", data.totals.products],
  ];
  const secondRow = [
    ["VALOR DO FRETE", data.totals.freight],
    ["VALOR DO SEGURO", data.totals.insurance],
    ["DESCONTO", data.totals.discount],
    ["OUTRAS DESPESAS ACESSÓRIAS", data.totals.other],
    ["VALOR TOTAL DO IPI", data.totals.ipi],
    ["VALOR TOTAL DA NOTA", data.totals.invoice],
  ];
  return `
    <h3 class="official-section-title">CÁLCULO DO IMPOSTO</h3>
    <div class="official-tax-grid">
      ${firstRow.map(([label, value]) => field(label, formatNumber(value), "tax-first-row")).join("")}
      ${secondRow.map(([label, value], index) => field(label, formatNumber(value), `tax-second-row${index === secondRow.length - 1 ? " official-total" : ""}`)).join("")}
    </div>`;
}

function transport(data) {
  const value = data.transport;
  return `
    <h3 class="official-section-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</h3>
    <div class="fiscal-grid columns-12">
      ${field("NOME / RAZÃO SOCIAL", value.carrier, "span-4")}
      ${field("FRETE POR CONTA", value.freightMode, "span-3")}
      ${field("CÓDIGO ANTT", value.rntc, "span-2")}
      ${field("PLACA DO VEÍCULO", value.plate, "span-2")}
      ${field("UF", value.plateState, "span-1")}
      ${field("CNPJ / CPF", formatDocument(value.document), "span-3")}
      ${field("ENDEREÇO", value.address, "span-4")}
      ${field("MUNICÍPIO", value.city, "span-3")}
      ${field("UF", value.state, "span-1")}
      ${field("INSCRIÇÃO ESTADUAL", value.ie, "span-1")}
      ${field("QUANTIDADE", value.quantity, "span-2")}
      ${field("ESPÉCIE", value.species, "span-2")}
      ${field("MARCA", value.brand, "span-2")}
      ${field("NUMERAÇÃO", value.numbering, "span-2")}
      ${field("PESO BRUTO", value.grossWeight ? formatNumber(value.grossWeight, 3) : "", "span-2")}
      ${field("PESO LÍQUIDO", value.netWeight ? formatNumber(value.netWeight, 3) : "", "span-2")}
    </div>`;
}

function productsTable(items) {
  const rows = items.map((item) => `
    <tr>
      <td>${esc(item.code)}</td><td>${esc(item.description)}</td><td>${esc(item.ncm)}</td><td>${esc(item.cst)}</td>
      <td>${esc(item.cfop)}</td><td>${esc(item.unit)}</td><td>${esc(formatNumber(item.quantity, 4))}</td>
      <td>${esc(formatNumber(item.unitValue, 4))}</td><td>${esc(formatNumber(item.total))}</td>
      <td>${esc(formatNumber(item.taxBase))}</td><td>${esc(formatNumber(item.icms))}</td><td>${esc(formatNumber(item.ipi))}</td>
      <td>${esc(formatNumber(item.icmsRate))}</td><td>${esc(formatNumber(item.ipiRate))}</td>
    </tr>`).join("");
  return `
    <h3 class="official-section-title">DADOS DOS PRODUTOS / SERVIÇOS</h3>
    <table class="official-products">
      <thead><tr><th>CÓDIGO</th><th>DESCRIÇÃO DOS PRODUTOS / SERVIÇOS</th><th>NCM/SH</th><th>CST</th><th>CFOP</th><th>UN.</th><th>QUANT.</th><th>V. UNITÁRIO</th><th>V. TOTAL</th><th>BC ICMS</th><th>V. ICMS</th><th>V. IPI</th><th>ALÍQ. ICMS</th><th>ALÍQ. IPI</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="14">NENHUM ITEM LOCALIZADO NO XML.</td></tr>'}</tbody>
    </table>`;
}

function nfeServiceTaxes(data) {
  const service = data.serviceTaxes || {};
  return `
    <h3 class="official-section-title">CÁLCULO DO ISSQN</h3>
    <div class="official-service-tax-grid">
      ${field("INSCRIÇÃO MUNICIPAL", service.municipalRegistration)}
      ${field("VALOR TOTAL DOS SERVIÇOS", formatNumber(service.services))}
      ${field("BASE DE CÁLCULO DO ISSQN", formatNumber(service.taxBase))}
      ${field("VALOR DO ISSQN", formatNumber(service.issqn))}
    </div>`;
}

function nfeReformTaxes(data) {
  const reform = data.totals.reform || {};
  return `
    <h3 class="official-section-title">CÁLCULO DO IBS / CBS</h3>
    <div class="official-reform-tax-grid">
      ${field("BASE DE CÁLCULO IBS/CBS", formatNumber(reform.base))}
      ${field("VALOR DO IBS UF", formatNumber(reform.ibsState))}
      ${field("VALOR DO IBS MUNICIPAL", formatNumber(reform.ibsCity))}
      ${field("VALOR TOTAL DO IBS", formatNumber(reform.ibs))}
      ${field("VALOR TOTAL DA CBS", formatNumber(reform.cbs))}
    </div>`;
}

function nfeAdditional(data) {
  return `
    <h3 class="official-section-title">DADOS ADICIONAIS</h3>
    <div class="official-additional">
      ${field("INFORMAÇÕES COMPLEMENTARES", data.additionalInfo, "span-8")}
      ${field("RESERVADO AO FISCO", data.fiscalInfo, "span-4")}
    </div>`;
}

function contingency(data) {
  if (data.issueType === "1") return "";
  return `<div class="official-contingency"><strong>DANFE EMITIDO EM CONTINGÊNCIA</strong><span>Tipo de emissão: ${esc(data.issueType)}${data.contingencyDate ? ` · ${esc(formatDateTime(data.contingencyDate))}` : ""}${data.contingencyReason ? ` · ${esc(data.contingencyReason)}` : ""}</span></div>`;
}

function landscapeReceipt(data, firstPage) {
  if (!firstPage) {
    return `<aside class="official-landscape-receipt official-landscape-page-id"><strong>NF-e</strong><b>Nº. ${esc(formatNfeNumber(data.number))}</b><b>SÉRIE ${esc(data.series)}</b></aside>`;
  }
  return `<aside class="official-landscape-receipt">
    <div class="official-landscape-nfe"><strong>NOTA FISCAL</strong><b>Nº. ${esc(formatNfeNumber(data.number))}</b><b>SÉRIE ${esc(data.series)}</b></div>
    <div class="official-landscape-receipt-text">RECEBEMOS DE ${esc(data.emitter.name)} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA. DATA DE RECEBIMENTO · IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
  </aside>`;
}

function buildDanfe(data, rendered) {
  const landscape = data.printType === "2";
  const firstPageSize = landscape ? 7 : 10;
  const followingPageSize = landscape ? 18 : 24;
  const chunks = [];
  let cursor = 0;
  chunks.push(data.items.slice(0, firstPageSize));
  cursor = firstPageSize;
  while (cursor < data.items.length) {
    chunks.push(data.items.slice(cursor, cursor + followingPageSize));
    cursor += followingPageSize;
  }
  if (!chunks.length) chunks.push([]);
  const totalPages = chunks.length;

  const pages = chunks.map((items, index) => {
    const page = index + 1;
    const first = index === 0;
    const last = index === totalPages - 1;
    const main = `
      ${!landscape && first ? receipt(data) : ""}
      ${data.environment === "HOMOLOGAÇÃO" ? '<div class="official-homologation">SEM VALOR FISCAL — AMBIENTE DE HOMOLOGAÇÃO</div>' : ""}
      ${contingency(data)}
      ${nfeHeader(data, rendered, page, totalPages)}
      ${first ? `${destination(data)}${billing(data)}${nfeTaxes(data)}${transport(data)}` : ""}
      <div class="official-products-area">${productsTable(items)}</div>
      ${last ? `${nfeServiceTaxes(data)}${nfeReformTaxes(data)}${nfeAdditional(data)}` : ""}
      <footer class="official-document-footer">procurandodanfe.com.br</footer>`;
    return landscape
      ? `<article class="danfe-sheet fiscal-sheet official-danfe-sheet fiscal-landscape">${landscapeReceipt(data, first)}<div class="official-landscape-main">${main}</div></article>`
      : `<article class="danfe-sheet fiscal-sheet official-danfe-sheet fiscal-portrait">${main}</article>`;
  }).join("");

  const wrapper = document.createElement("section");
  wrapper.className = `danfe-print fiscal-standard-print ${landscape ? "fiscal-landscape-print" : "fiscal-portrait-print"}`;
  wrapper.setAttribute("aria-label", "DANFE padrão para impressão");
  wrapper.dataset.accessKey = data.accessKey;
  wrapper.innerHTML = pages;
  return wrapper;
}

function cteSetText(root, key, value) {
  const node = root.querySelector(`[data-cte="${key}"]`);
  if (node) node.textContent = value || "—";
}

function cteFillParty(root, key, value) {
  const block = root.querySelector(`[data-cte-party="${key}"]`);
  if (!block) return;
  const addr = value?.address || {};
  const values = {
    name: value?.name || "",
    street: [addr.street, addr.number].filter(Boolean).join(", ") || "—",
    district: addr.district || "—",
    city: addr.city || "—",
    zip: addr.zip ? formatZip(addr.zip) : "—",
    state: addr.state || "—",
    document: value?.document ? formatDocument(value.document) : "—",
    ie: value?.ie || "—",
    phone: addr.phone || "—",
    country: addr.country || "BRASIL",
  };
  Object.entries(values).forEach(([field, textValue]) => {
    const target = block.querySelector(`[data-party="${field}"]`);
    if (target) target.textContent = textValue;
  });
}

function cteAppendTableRow(tbody, cells) {
  const row = document.createElement("tr");
  cells.forEach((value) => {
    const cell = document.createElement("td");
    cell.textContent = value || "—";
    row.append(cell);
  });
  tbody.append(row);
}

function fillCteTemplate(wrapper, data, rendered) {
  const sheet = wrapper.querySelector(".cte-sheet");
  if (!sheet) throw new Error("O template fixo do CT-e não foi localizado.");

  const emitterDisplay = data.emitter.fantasy || data.emitter.name || "—";
  const emitterLegal = data.emitter.fantasy ? data.emitter.name : "";
  const protocolText = data.protocol ? `${data.protocol} · ${formatDateTime(data.protocolDate)}` : "NÃO LOCALIZADO";
  const firstQuantity = data.cargo?.quantities?.[0] || {};
  const grossWeight = (data.cargo?.quantities || []).find((item) => /peso\s*bruto/i.test(item.measure || ""))
    || (data.cargo?.quantities || []).find((item) => /kg|t/i.test(item.unit || ""))
    || {};

  const fields = {
    "emitter-display-name": emitterDisplay,
    "emitter-legal-name": emitterLegal,
    "emitter-address": fullAddress(data.emitter.address),
    "emitter-document": formatDocument(data.emitter.document),
    "emitter-ie": data.emitter.ie || "—",
    "cte-type": data.cteType || "—",
    "service-type": data.serviceType || "—",
    modal: data.modal || "—",
    model: data.model || "—",
    series: data.series || "—",
    number: data.number || "—",
    "issued-at": formatDateTime(data.issueDate) || "—",
    "access-key": keyGroups(data.accessKey),
    "global-info": data.globalized ? "CT-e Globalizado" : "—",
    protocol: protocolText,
    "cfop-operation": [data.cfop, data.operation].filter(Boolean).join(" — ") || "—",
    "recipient-suframa": data.recipient?.sufRama || "—",
    origin: data.origin || "—",
    destination: data.destination || "—",
    "cargo-product": data.cargo?.predominantProduct || "—",
    "cargo-other": data.cargo?.otherCharacteristics || "—",
    "cargo-value": formatNumber(data.cargo?.value || 0),
    "cargo-quantity": firstQuantity.quantity ? formatNumber(firstQuantity.quantity, 4) : "—",
    "cargo-gross-weight": grossWeight.quantity ? `${formatNumber(grossWeight.quantity, 4)} ${grossWeight.unit || ""}`.trim() : "—",
    "total-service": formatNumber(data.totalService || 0),
    "amount-receivable": formatNumber(data.amountReceivable || 0),
    "tax-cst": data.tax?.cst || "—",
    "tax-base": formatNumber(data.tax?.taxBase || 0),
    "tax-rate": `${formatNumber(data.tax?.rate || 0)}%`,
    "tax-value": formatNumber(data.tax?.value || 0),
    "tax-reduction": `${formatNumber(data.tax?.reduction || 0)}%`,
    "tax-total": formatNumber(data.tax?.totalTaxes || 0),
    observations: data.observations || "—",
    "emitter-use": data.emitterUse || "—",
    "fiscal-use": data.fiscalUse || "—",
    "receipt-number": data.number || "—",
  };
  Object.entries(fields).forEach(([key, value]) => cteSetText(wrapper, key, value));

  const homolog = wrapper.querySelector('[data-cte-show="homolog"]');
  if (homolog) homolog.hidden = !String(data.environment || "").startsWith("HOMOLOGAÇÃO");

  const yesBox = wrapper.querySelector('[data-cte-check="global-yes"]');
  const noBox = wrapper.querySelector('[data-cte-check="global-no"]');
  if (yesBox) yesBox.textContent = data.globalized ? "X" : "";
  if (noBox) noBox.textContent = data.globalized ? "" : "X";

  cteFillParty(wrapper, "sender", data.sender);
  cteFillParty(wrapper, "recipient", data.recipient);
  cteFillParty(wrapper, "dispatcher", data.dispatcher);
  cteFillParty(wrapper, "receiver", data.receiver);
  cteFillParty(wrapper, "taker", data.taker);

  const barcodeSlot = wrapper.querySelector('[data-cte-slot="barcode"]');
  const barcodeSource = rendered?.querySelector(".dacte-access svg");
  if (barcodeSlot) barcodeSlot.innerHTML = barcodeSource?.outerHTML || "";

  const qrSlot = wrapper.querySelector('[data-cte-slot="qr"]');
  const qrSource = rendered?.querySelector(".dacte-qr img");
  if (qrSlot && qrSource) qrSlot.innerHTML = qrSource.outerHTML;

  const componentSlots = [1, 2, 3].map((index) => wrapper.querySelector(`[data-cte-slot="components-${index}"]`));
  const components = data.components?.length ? data.components.slice() : [{ name: "VALOR DA PRESTAÇÃO", value: data.totalService || 0 }];
  const groups = [components.slice(0, 3), [], []];
  const remaining = components.slice(3);
  if (Number(String(data.tax?.value || "0").replace(",", ".")) > 0) {
    groups[1].push({ name: "ICMS", value: data.tax.value });
  }
  remaining.forEach((item) => {
    const target = groups[1].length < 3 ? groups[1] : groups[2];
    if (target.length < 3) target.push(item);
  });

  const appendComponentRow = (slot, item) => {
    const row = document.createElement("div");
    row.className = `cte-component-row${item ? "" : " cte-component-row-empty"}`;
    const name = document.createElement("span");
    name.textContent = item?.name || "";
    const value = document.createElement("b");
    value.textContent = item ? formatNumber(item.value) : "";
    row.append(name, value);
    slot?.append(row);
  };

  groups.forEach((items, groupIndex) => {
    const slot = componentSlots[groupIndex];
    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) appendComponentRow(slot, items[rowIndex]);
  });

  const documentsLeft = wrapper.querySelector('[data-cte-slot="documents-left"]');
  const documentsRight = wrapper.querySelector('[data-cte-slot="documents-right"]');
  const allDocuments = data.sourceDocuments || [];
  const leftDocs = allDocuments.filter((_, index) => index % 2 === 0);
  const rightDocs = allDocuments.filter((_, index) => index % 2 === 1);
  const appendDocItem = (slot, item) => {
    if (!slot) return;
    const row = document.createElement('div');
    row.className = 'cte-doc-item';
    const values = item ? [
      item.type || '—',
      '—',
      /^\d{44}$/.test(item.value || '') ? keyGroups(item.value) : (item.value || '—'),
      '—',
    ] : [' ', ' ', ' ', ' '];
    values.forEach((value) => {
      const span = document.createElement('span');
      span.textContent = value;
      row.append(span);
    });
    slot.append(row);
  };
  if (documentsLeft || documentsRight) {
    if (leftDocs.length || rightDocs.length) {
      const count = Math.max(leftDocs.length, rightDocs.length, 1);
      for (let index = 0; index < count; index += 1) {
        if (documentsLeft) appendDocItem(documentsLeft, leftDocs[index]);
        if (documentsRight) appendDocItem(documentsRight, rightDocs[index]);
      }
    } else {
      if (documentsLeft) appendDocItem(documentsLeft, { type: 'NENHUM DOCUMENTO ORIGINÁRIO LOCALIZADO NO XML.', value: '', });
      if (documentsRight) appendDocItem(documentsRight, null);
    }
  }

  const modalTitle = wrapper.querySelector('[data-cte="modal-title"]');
  if (modalTitle) modalTitle.textContent = `INFORMAÇÕES ESPECÍFICAS DO MODAL ${(data.modal || "").toUpperCase()}`;
  const modalDetails = wrapper.querySelector('[data-cte-slot="modal-details"]');
  if (modalDetails) {
    const details = data.modalDetails || [];
    const normalized = details.length ? details : [{ label: "MODAL", value: data.modal || "—" }];
    const filled = normalized.slice(0, 5);
    while (filled.length < 5) filled.push({ label: " ", value: " " });
    filled.forEach((item) => {
      const field = document.createElement("div");
      field.className = "cte-field";
      if (!item.label || !item.value || item.label === " ") field.classList.add("cte-field-empty");
      const label = document.createElement("span");
      label.textContent = item.label || " ";
      const value = document.createElement("b");
      value.textContent = item.value || " ";
      field.append(label, value);
      modalDetails.append(field);
    });
  }

  wrapper.dataset.accessKey = data.accessKey;
  sheet.dataset.accessKey = data.accessKey;
}

function buildCteDocument(data, rendered) {
  const template = document.querySelector("#cte-layout-template");
  if (!(template instanceof HTMLTemplateElement)) throw new Error("Template do CT-e não encontrado.");
  const fragment = template.content.cloneNode(true);
  const wrapper = fragment.querySelector(".cte-print");
  if (!wrapper) throw new Error("Layout fixo do CT-e não encontrado.");
  fillCteTemplate(wrapper, data, rendered);
  return wrapper;
}

export function buildOfficialDocument(data, renderedDocument) {
  return data.kind === "cte" ? buildCteDocument(data, renderedDocument) : buildDanfe(data, renderedDocument);
}
