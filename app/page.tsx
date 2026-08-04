"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";

type AddressData = {
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
};

type PartyData = {
  name: string;
  fantasy: string;
  document: string;
  stateRegistration: string;
  address: AddressData;
};

type ProductData = {
  code: string;
  description: string;
  ncm: string;
  cst: string;
  cfop: string;
  unit: string;
  quantity: string;
  unitValue: string;
  total: string;
  taxBase: string;
  icms: string;
  ipi: string;
  icmsRate: string;
  ipiRate: string;
};

type InvoiceData = {
  accessKey: string;
  number: string;
  series: string;
  model: string;
  issuedAt: string;
  operation: string;
  invoiceType: string;
  protocol: string;
  protocolDate: string;
  emitter: string;
  emitterDocument: string;
  recipient: string;
  total: string;
  items: number;
  emitterParty: PartyData;
  recipientParty: PartyData;
  products: ProductData[];
  totals: {
    taxBase: string;
    icms: string;
    stBase: string;
    st: string;
    products: string;
    freight: string;
    insurance: string;
    discount: string;
    ipi: string;
    other: string;
    invoice: string;
  };
  transport: {
    freightMode: string;
    carrier: string;
    document: string;
    stateRegistration: string;
    address: string;
    city: string;
    state: string;
    plate: string;
    plateState: string;
    quantity: string;
    species: string;
    grossWeight: string;
    netWeight: string;
  };
  billing: { number: string; original: string; discount: string; net: string };
  payment: string;
  additionalInfo: string;
  fiscalInfo: string;
};

const xmlSteps = [
  ["01", "Envie o arquivo", "Arraste ou selecione o XML autorizado da sua NFe."],
  ["02", "Confira os dados", "Revise emitente, destinatário, valor e itens encontrados."],
  ["03", "Imprima o DANFE", "Abra a impressão no formato A4 ou salve o documento em PDF."],
];

const paymentNames: Record<string, string> = {
  "01": "Dinheiro", "02": "Cheque", "03": "Cartão de crédito", "04": "Cartão de débito",
  "05": "Crédito loja", "10": "Vale alimentação", "11": "Vale refeição", "12": "Vale presente",
  "13": "Vale combustível", "15": "Boleto bancário", "16": "Depósito bancário", "17": "PIX",
  "18": "Transferência", "19": "Programa de fidelidade", "90": "Sem pagamento", "99": "Outros",
};

const freightNames: Record<string, string> = {
  "0": "0 - Contratação do frete por conta do remetente (CIF)",
  "1": "1 - Contratação do frete por conta do destinatário (FOB)",
  "2": "2 - Contratação do frete por conta de terceiros",
  "3": "3 - Transporte próprio por conta do remetente",
  "4": "4 - Transporte próprio por conta do destinatário",
  "9": "9 - Sem ocorrência de transporte",
};

function descendants(root: Document | Element, tag: string) {
  return Array.from(root.getElementsByTagNameNS("*", tag));
}

function textFrom(root: Document | Element | undefined, tag: string) {
  return root ? descendants(root, tag)[0]?.textContent?.trim() ?? "" : "";
}

function formatDecimal(value: string, maximumFractionDigits = 2) {
  const number = Number((value || "0").replace(",", "."));
  return Number.isFinite(number)
    ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits }).format(number)
    : "0,00";
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatDocument(value: string) {
  if (value.length === 14) return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (value.length === 11) return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return value || "—";
}

function formatZip(value: string) {
  return value.length === 8 ? value.replace(/^(\d{5})(\d{3})$/, "$1-$2") : value || "—";
}

function formatKey(value: string) {
  return value.match(/.{1,4}/g)?.join(" ") ?? value;
}

function parseAddress(party: Element | undefined, addressTag: string): AddressData {
  const address = party ? descendants(party, addressTag)[0] : undefined;
  return {
    street: textFrom(address, "xLgr"),
    number: textFrom(address, "nro"),
    complement: textFrom(address, "xCpl"),
    district: textFrom(address, "xBairro"),
    city: textFrom(address, "xMun"),
    state: textFrom(address, "UF"),
    zip: textFrom(address, "CEP"),
    phone: textFrom(address, "fone"),
  };
}

function parseParty(party: Element | undefined, addressTag: string): PartyData {
  return {
    name: textFrom(party, "xNome") || "Não informado",
    fantasy: textFrom(party, "xFant"),
    document: textFrom(party, "CNPJ") || textFrom(party, "CPF"),
    stateRegistration: textFrom(party, "IE") || "ISENTO",
    address: parseAddress(party, addressTag),
  };
}

function addressLine(address: AddressData) {
  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.complement,
    address.district,
    [address.city, address.state].filter(Boolean).join(" - "),
    address.zip ? `CEP ${formatZip(address.zip)}` : "",
  ].filter(Boolean).join(" · ") || "Não informado";
}

function parseInvoice(xml: string): InvoiceData {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("O arquivo não contém um XML válido.");

  const info = descendants(document, "infNFe")[0];
  const emitter = descendants(document, "emit")[0];
  const recipient = descendants(document, "dest")[0];
  const identification = descendants(document, "ide")[0];
  const totals = descendants(document, "ICMSTot")[0];
  const protocol = descendants(document, "infProt")[0];
  const transport = descendants(document, "transp")[0];
  const carrier = transport ? descendants(transport, "transporta")[0] : undefined;
  const vehicle = transport ? descendants(transport, "veicTransp")[0] : undefined;
  const volume = transport ? descendants(transport, "vol")[0] : undefined;
  const billing = descendants(document, "fat")[0];
  const payment = descendants(document, "detPag")[0];
  const additional = descendants(document, "infAdic")[0];
  if (!info || !emitter || !identification) throw new Error("Este XML não parece ser de uma NFe autorizada.");

  const emitterParty = parseParty(emitter, "enderEmit");
  const recipientParty = parseParty(recipient, "enderDest");
  const products = descendants(info, "det").map((detail) => {
    const product = descendants(detail, "prod")[0];
    const tax = descendants(detail, "imposto")[0];
    return {
      code: textFrom(product, "cProd"),
      description: textFrom(product, "xProd"),
      ncm: textFrom(product, "NCM"),
      cst: textFrom(tax, "CST") || textFrom(tax, "CSOSN"),
      cfop: textFrom(product, "CFOP"),
      unit: textFrom(product, "uCom"),
      quantity: textFrom(product, "qCom"),
      unitValue: textFrom(product, "vUnCom"),
      total: textFrom(product, "vProd"),
      taxBase: textFrom(tax, "vBC"),
      icms: textFrom(tax, "vICMS"),
      ipi: textFrom(tax, "vIPI"),
      icmsRate: textFrom(tax, "pICMS"),
      ipiRate: textFrom(tax, "pIPI"),
    };
  });

  const invoiceTotal = textFrom(totals, "vNF");
  const freightMode = textFrom(transport, "modFrete");
  const paymentCode = textFrom(payment, "tPag");

  return {
    accessKey: info.getAttribute("Id")?.replace(/^NFe/, "") ?? textFrom(protocol, "chNFe"),
    number: textFrom(identification, "nNF") || "—",
    series: textFrom(identification, "serie") || "—",
    model: textFrom(identification, "mod") || "55",
    issuedAt: textFrom(identification, "dhEmi") || textFrom(identification, "dEmi"),
    operation: textFrom(identification, "natOp") || "Operação não informada",
    invoiceType: textFrom(identification, "tpNF") === "0" ? "0 - ENTRADA" : "1 - SAÍDA",
    protocol: textFrom(protocol, "nProt"),
    protocolDate: textFrom(protocol, "dhRecbto"),
    emitter: emitterParty.name,
    emitterDocument: emitterParty.document,
    recipient: recipientParty.name,
    total: invoiceTotal,
    items: products.length,
    emitterParty,
    recipientParty,
    products,
    totals: {
      taxBase: textFrom(totals, "vBC"),
      icms: textFrom(totals, "vICMS"),
      stBase: textFrom(totals, "vBCST"),
      st: textFrom(totals, "vST"),
      products: textFrom(totals, "vProd"),
      freight: textFrom(totals, "vFrete"),
      insurance: textFrom(totals, "vSeg"),
      discount: textFrom(totals, "vDesc"),
      ipi: textFrom(totals, "vIPI"),
      other: textFrom(totals, "vOutro"),
      invoice: invoiceTotal,
    },
    transport: {
      freightMode: freightNames[freightMode] || freightMode || "Não informado",
      carrier: textFrom(carrier, "xNome"),
      document: textFrom(carrier, "CNPJ") || textFrom(carrier, "CPF"),
      stateRegistration: textFrom(carrier, "IE"),
      address: textFrom(carrier, "xEnder"),
      city: textFrom(carrier, "xMun"),
      state: textFrom(carrier, "UF"),
      plate: textFrom(vehicle, "placa"),
      plateState: textFrom(vehicle, "UF"),
      quantity: textFrom(volume, "qVol"),
      species: textFrom(volume, "esp"),
      grossWeight: textFrom(volume, "pesoB"),
      netWeight: textFrom(volume, "pesoL"),
    },
    billing: {
      number: textFrom(billing, "nFat"),
      original: textFrom(billing, "vOrig"),
      discount: textFrom(billing, "vDesc"),
      net: textFrom(billing, "vLiq"),
    },
    payment: paymentNames[paymentCode] || paymentCode || "Não informado",
    additionalInfo: textFrom(additional, "infCpl"),
    fiscalInfo: textFrom(additional, "infAdFisco"),
  };
}

function triggerDownload(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`danfe-field ${className}`}><span>{label}</span><b>{children || "—"}</b></div>;
}

function Danfe({ invoice }: { invoice: InvoiceData }) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!barcodeRef.current || !invoice.accessKey) return;
    JsBarcode(barcodeRef.current, invoice.accessKey, {
      format: "CODE128",
      displayValue: false,
      height: 44,
      width: 1.18,
      margin: 0,
      background: "#ffffff",
      lineColor: "#000000",
    });
  }, [invoice.accessKey]);

  return (
    <section className="danfe-print" aria-label="DANFE para impressão">
      <div className="danfe-sheet">
        <div className="danfe-receipt">
          <div>
            <p>RECEBEMOS DE <strong>{invoice.emitterParty.name}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.</p>
            <div className="receipt-lines"><span>DATA DE RECEBIMENTO</span><span>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span></div>
          </div>
          <div><strong>NF-e</strong><b>Nº {invoice.number}</b><b>SÉRIE {invoice.series}</b></div>
        </div>
        <div className="danfe-cut">CORTE NA LINHA PONTILHADA</div>

        <div className="danfe-header-grid">
          <div className="danfe-emitter">
            <strong>{invoice.emitterParty.name}</strong>
            {invoice.emitterParty.fantasy && <b>{invoice.emitterParty.fantasy}</b>}
            <p>{addressLine(invoice.emitterParty.address)}</p>
            {invoice.emitterParty.address.phone && <small>Fone: {invoice.emitterParty.address.phone}</small>}
          </div>
          <div className="danfe-identity">
            <strong>DANFE</strong>
            <span>DOCUMENTO AUXILIAR DA<br />NOTA FISCAL ELETRÔNICA</span>
            <b>{invoice.invoiceType}</b>
            <h1>Nº {invoice.number}</h1>
            <h2>SÉRIE {invoice.series}</h2>
            <small>FOLHA 1</small>
          </div>
          <div className="danfe-access">
            {invoice.accessKey ? <svg ref={barcodeRef} aria-label="Código de barras da chave de acesso" /> : <div className="barcode-missing">CHAVE NÃO LOCALIZADA</div>}
            <span>CHAVE DE ACESSO</span>
            <strong>{formatKey(invoice.accessKey) || "—"}</strong>
            <p>Consulta de autenticidade no portal nacional da NF-e</p>
          </div>
        </div>

        <div className="danfe-row danfe-row-2">
          <Field label="NATUREZA DA OPERAÇÃO">{invoice.operation}</Field>
          <Field label="PROTOCOLO DE AUTORIZAÇÃO DE USO">{invoice.protocol ? `${invoice.protocol} · ${formatDateTime(invoice.protocolDate)}` : "Não localizado no XML"}</Field>
        </div>
        <div className="danfe-row danfe-row-3">
          <Field label="INSCRIÇÃO ESTADUAL">{invoice.emitterParty.stateRegistration}</Field>
          <Field label="INSCRIÇÃO ESTADUAL DO SUBST. TRIBUTÁRIO">—</Field>
          <Field label="CNPJ / CPF">{formatDocument(invoice.emitterParty.document)}</Field>
        </div>

        <h3 className="danfe-section-title">DESTINATÁRIO / REMETENTE</h3>
        <div className="danfe-destination">
          <Field label="NOME / RAZÃO SOCIAL" className="span-6">{invoice.recipientParty.name}</Field>
          <Field label="CNPJ / CPF" className="span-3">{formatDocument(invoice.recipientParty.document)}</Field>
          <Field label="DATA DA EMISSÃO" className="span-3">{formatDate(invoice.issuedAt)}</Field>
          <Field label="ENDEREÇO" className="span-5">{[invoice.recipientParty.address.street, invoice.recipientParty.address.number].filter(Boolean).join(", ")}</Field>
          <Field label="BAIRRO / DISTRITO" className="span-3">{invoice.recipientParty.address.district}</Field>
          <Field label="CEP" className="span-2">{formatZip(invoice.recipientParty.address.zip)}</Field>
          <Field label="DATA DA SAÍDA" className="span-2">{formatDate(invoice.issuedAt)}</Field>
          <Field label="MUNICÍPIO" className="span-4">{invoice.recipientParty.address.city}</Field>
          <Field label="FONE / FAX" className="span-2">{invoice.recipientParty.address.phone}</Field>
          <Field label="UF" className="span-1">{invoice.recipientParty.address.state}</Field>
          <Field label="INSCRIÇÃO ESTADUAL" className="span-3">{invoice.recipientParty.stateRegistration}</Field>
          <Field label="HORA DA SAÍDA" className="span-2">{formatDateTime(invoice.issuedAt).split(" ").slice(-1).join(" ")}</Field>
        </div>

        {(invoice.billing.number || invoice.billing.net) && (
          <>
            <h3 className="danfe-section-title">FATURA</h3>
            <div className="danfe-row danfe-row-4">
              <Field label="NÚMERO">{invoice.billing.number}</Field>
              <Field label="VALOR ORIGINAL">{formatDecimal(invoice.billing.original)}</Field>
              <Field label="VALOR DO DESCONTO">{formatDecimal(invoice.billing.discount)}</Field>
              <Field label="VALOR LÍQUIDO">{formatDecimal(invoice.billing.net)}</Field>
            </div>
          </>
        )}

        <h3 className="danfe-section-title">CÁLCULO DO IMPOSTO</h3>
        <div className="danfe-row danfe-row-5">
          <Field label="BASE DE CÁLCULO DO ICMS">{formatDecimal(invoice.totals.taxBase)}</Field>
          <Field label="VALOR DO ICMS">{formatDecimal(invoice.totals.icms)}</Field>
          <Field label="BASE DE CÁLCULO ICMS ST">{formatDecimal(invoice.totals.stBase)}</Field>
          <Field label="VALOR DO ICMS ST">{formatDecimal(invoice.totals.st)}</Field>
          <Field label="VALOR TOTAL DOS PRODUTOS">{formatDecimal(invoice.totals.products)}</Field>
          <Field label="VALOR DO FRETE">{formatDecimal(invoice.totals.freight)}</Field>
          <Field label="VALOR DO SEGURO">{formatDecimal(invoice.totals.insurance)}</Field>
          <Field label="DESCONTO">{formatDecimal(invoice.totals.discount)}</Field>
          <Field label="OUTRAS DESPESAS">{formatDecimal(invoice.totals.other)}</Field>
          <Field label="VALOR DO IPI">{formatDecimal(invoice.totals.ipi)}</Field>
          <Field label="VALOR TOTAL DA NOTA" className="danfe-total">{formatDecimal(invoice.totals.invoice)}</Field>
        </div>

        <h3 className="danfe-section-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</h3>
        <div className="danfe-transport">
          <Field label="RAZÃO SOCIAL" className="span-4">{invoice.transport.carrier}</Field>
          <Field label="FRETE POR CONTA" className="span-4">{invoice.transport.freightMode}</Field>
          <Field label="CÓDIGO ANTT" className="span-1">—</Field>
          <Field label="PLACA DO VEÍCULO" className="span-2">{invoice.transport.plate}</Field>
          <Field label="UF" className="span-1">{invoice.transport.plateState}</Field>
          <Field label="CNPJ / CPF" className="span-3">{formatDocument(invoice.transport.document)}</Field>
          <Field label="ENDEREÇO" className="span-4">{invoice.transport.address}</Field>
          <Field label="MUNICÍPIO" className="span-2">{invoice.transport.city}</Field>
          <Field label="UF" className="span-1">{invoice.transport.state}</Field>
          <Field label="INSCRIÇÃO ESTADUAL" className="span-2">{invoice.transport.stateRegistration}</Field>
          <Field label="QUANTIDADE" className="span-2">{invoice.transport.quantity}</Field>
          <Field label="ESPÉCIE" className="span-3">{invoice.transport.species}</Field>
          <Field label="PESO BRUTO" className="span-2">{formatDecimal(invoice.transport.grossWeight, 3)}</Field>
          <Field label="PESO LÍQUIDO" className="span-2">{formatDecimal(invoice.transport.netWeight, 3)}</Field>
        </div>

        <div className="danfe-products-area">
          <h3 className="danfe-section-title">DADOS DOS PRODUTOS / SERVIÇOS</h3>
          <table className="danfe-products">
            <thead><tr><th>CÓDIGO</th><th>DESCRIÇÃO DOS PRODUTOS / SERVIÇOS</th><th>NCM/SH</th><th>CST</th><th>CFOP</th><th>UN</th><th>QTD.</th><th>V. UNIT.</th><th>V. TOTAL</th><th>BC ICMS</th><th>V. ICMS</th><th>V. IPI</th><th>ALÍQ. ICMS</th><th>ALÍQ. IPI</th></tr></thead>
            <tbody>
              {invoice.products.length ? invoice.products.map((product, index) => (
                <tr key={`${product.code}-${index}`}>
                  <td>{product.code}</td><td>{product.description}</td><td>{product.ncm}</td><td>{product.cst}</td><td>{product.cfop}</td><td>{product.unit}</td>
                  <td>{formatDecimal(product.quantity, 4)}</td><td>{formatDecimal(product.unitValue, 6)}</td><td>{formatDecimal(product.total)}</td><td>{formatDecimal(product.taxBase)}</td>
                  <td>{formatDecimal(product.icms)}</td><td>{formatDecimal(product.ipi)}</td><td>{formatDecimal(product.icmsRate)}</td><td>{formatDecimal(product.ipiRate)}</td>
                </tr>
              )) : <tr><td colSpan={14}>Nenhum item localizado no XML.</td></tr>}
              <tr className="danfe-products-fill" aria-hidden="true"><td colSpan={14}>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="danfe-section-title">DADOS ADICIONAIS</h3>
        <div className="danfe-additional">
          <Field label="INFORMAÇÕES COMPLEMENTARES" className="span-8">{invoice.additionalInfo}</Field>
          <Field label="RESERVADO AO FISCO" className="span-4">{invoice.fiscalInfo}</Field>
        </div>
        <div className="danfe-footer-note">DANFE gerado localmente a partir do XML da NF-e · Forma de pagamento: {invoice.payment}</div>
      </div>
    </section>
  );
}

export default function Home() {
  const [dragging, setDragging] = useState(false);
  const [xmlText, setXmlText] = useState("");
  const [fileName, setFileName] = useState("");
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [xmlError, setXmlError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function processFile(file?: File) {
    setXmlError("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      setXmlError("Selecione um arquivo no formato .XML.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setXmlError("O arquivo ultrapassa o limite de 10 MB.");
      return;
    }
    try {
      const content = await file.text();
      const parsed = parseInvoice(content);
      setXmlText(content);
      setFileName(file.name);
      setInvoice(parsed);
    } catch (error) {
      setInvoice(null);
      setXmlError(error instanceof Error ? error.message : "Não foi possível ler este XML.");
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void processFile(event.dataTransfer.files[0]);
  }

  function resetXml() {
    setInvoice(null);
    setXmlText("");
    setFileName("");
    setXmlError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main>
      <div className="site-content">
        <header className="site-header">
          <a className="brand" href="#top" aria-label="Baixa NFe — início"><span className="brand-mark" aria-hidden="true">N</span><span>Baixa<span>NFe</span></span></a>
          <nav aria-label="Navegação principal"><a href="#como-funciona">Como funciona</a><a href="#seguranca">Segurança</a><a href="#duvidas">Dúvidas</a></nav>
          <span className="header-badge"><i /> Ambiente seguro</span>
        </header>

        <section className="hero" id="top">
          <div className="eyebrow"><span>✓</span> Simples, rápido e direto</div>
          <h1>Sua nota fiscal,<br /><em>sem complicação.</em></h1>
          <p>Envie o XML para consultar, organizar e imprimir o DANFE da sua NFe em poucos segundos, sem cadastro ou armazenamento.</p>
        </section>

        <section className="workspace" aria-label="Área para consultar NFe">
          <div className="tool-column">
            <div className="tool-card">
              <div className="tabs" role="tablist" aria-label="Forma de consulta">
                <button type="button" role="tab" aria-selected="true" className="active"><span className="tab-icon">⇧</span> Enviar XML</button>
                <button type="button" role="tab" aria-selected="false" aria-disabled="true" disabled title="Consulta por chave disponível em breve"><span className="tab-icon">⌗</span> Chave de acesso <small className="soon-badge">Em breve</small></button>
              </div>

              <div className="tool-body">
                <div className="tool-panel" role="tabpanel">
                  {!invoice ? (
                    <>
                      <div className="panel-heading"><span className="panel-number">1</span><div><h2>Envie o XML da nota</h2><p>Selecione o arquivo recebido do emissor da NFe.</p></div></div>
                      <input ref={inputRef} className="file-input" type="file" accept=".xml,text/xml,application/xml" onChange={(event) => void processFile(event.target.files?.[0])} />
                      <div className={`dropzone ${dragging ? "dragging" : ""}`} role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
                        <span className="upload-glyph">⇧</span><strong>Arraste seu XML para cá</strong><span>ou clique para selecionar o arquivo</span><b>Selecionar XML</b><small>Formato .XML • Máximo de 10 MB</small>
                      </div>
                      {xmlError && <p className="error-message" role="alert">{xmlError}</p>}
                    </>
                  ) : (
                    <section className="invoice-result invoice-ready" aria-live="polite">
                      <span className="ready-check" aria-hidden="true">✓</span>
                      <small>XML VALIDADO</small>
                      <h2>Arquivo pronto para usar</h2>
                      <p title={fileName}>{fileName}</p>
                      <div className="result-actions result-actions-simple">
                        <button type="button" className="primary-button result-primary" onClick={() => triggerDownload(xmlText, fileName || `nfe-${invoice.number}.xml`, "application/xml")}>Baixar XML <span>↓</span></button>
                        <button type="button" className="print-button" onClick={() => window.print()}>Imprimir DANFE</button>
                      </div>
                      <button type="button" className="change-xml-button" onClick={resetXml}>Usar outro arquivo</button>
                    </section>
                  )}
                </div>
              </div>
              <div className="privacy-bar"><span className="shield">◇</span><p><strong>Seus dados ficam protegidos</strong><br />O XML é processado localmente e não fica armazenado.</p><span className="status-pill">Privado</span></div>
            </div>

          </div>
        </section>

        <section className="trust-row" id="seguranca" aria-label="Benefícios"><div><span>⌁</span><p><strong>Sem cadastro</strong><small>Use na hora, sem criar conta</small></p></div><div><span>⚡</span><p><strong>Processamento rápido</strong><small>Resultado em poucos segundos</small></p></div><div><span>◎</span><p><strong>Privacidade primeiro</strong><small>Seu XML não fica armazenado</small></p></div></section>
        <section className="how" id="como-funciona"><div className="section-heading"><span>PASSO A PASSO</span><h2>Do XML ao DANFE<br />em três passos.</h2></div><div className="steps">{xmlSteps.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
        <footer id="duvidas"><a className="brand brand-footer" href="#top"><span className="brand-mark">N</span><span>Baixa<span>NFe</span></span></a><p>Ferramenta independente. Não possui vínculo com a Receita Federal ou Secretarias da Fazenda.</p><div><a href="/privacidade">Privacidade</a><a href="/cookies">Cookies</a></div></footer>
      </div>
      {invoice && <Danfe invoice={invoice} />}
    </main>
  );
}
