export const metadata = {
  title: "Política de Privacidade | Baixa NFe",
  description: "Saiba como o Baixa NFe protege seus dados e processa arquivos XML.",
};

export default function PrivacyPage() {
  return (
    <main className="policy-page">
      <header className="policy-header">
        <a className="brand" href="/" aria-label="Baixa NFe — início">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span>Baixa<span>NFe</span></span>
        </a>
        <a className="policy-back" href="/">← Voltar ao site</a>
      </header>

      <div className="policy-shell">
        <div className="policy-intro">
          <span>TRANSPARÊNCIA E SEGURANÇA</span>
          <h1>Política de Privacidade</h1>
          <p>Esta política explica como o Baixa NFe trata informações durante o uso da ferramenta.</p>
          <small>Última atualização: 4 de agosto de 2026</small>
        </div>

        <article className="policy-card">
          <section>
            <h2>1. Processamento do XML</h2>
            <p>O arquivo XML selecionado é lido e processado localmente no seu navegador para permitir o download e a impressão do DANFE. O conteúdo da nota fiscal não é enviado nem armazenado nos servidores do Baixa NFe.</p>
          </section>

          <section>
            <h2>2. Informações técnicas</h2>
            <p>A infraestrutura de hospedagem pode registrar informações técnicas necessárias para segurança e funcionamento, como endereço IP, navegador, data, horário e páginas acessadas. Esses registros não incluem o conteúdo do XML escolhido por você.</p>
          </section>

          <section>
            <h2>3. Publicidade e terceiros</h2>
            <p>O site possui integração técnica com o Google AdSense. Enquanto a conta e os espaços publicitários passam pela configuração e aprovação, alguns anúncios exibidos podem continuar demonstrativos. O Google e seus parceiros poderão processar informações técnicas e usar cookies ou tecnologias semelhantes para disponibilizar e medir anúncios.</p>
            <p>Mais detalhes estão disponíveis na nossa <a href="/cookies">Política de Cookies</a>.</p>
          </section>

          <section>
            <h2>4. Finalidades e bases legais</h2>
            <p>Informações técnicas podem ser tratadas para manter o site seguro, disponível e protegido contra abusos. O tratamento relacionado a publicidade deve respeitar as escolhas do usuário e a legislação aplicável.</p>
          </section>

          <section>
            <h2>5. Retenção e segurança</h2>
            <p>O Baixa NFe não mantém cópias dos XMLs processados. Registros técnicos podem permanecer pelo período necessário à segurança e operação da hospedagem, conforme as regras do respectivo provedor.</p>
          </section>

          <section>
            <h2>6. Seus direitos</h2>
            <p>Você pode solicitar informações sobre tratamento, correção, exclusão ou revogação de consentimento, quando aplicável. O canal de privacidade será disponibilizado junto ao domínio oficial do site.</p>
          </section>

          <section>
            <h2>7. Atualizações desta política</h2>
            <p>Esta política poderá ser atualizada quando novas funções, parceiros de publicidade ou formas de tratamento forem adicionados. A data da versão mais recente será sempre informada nesta página.</p>
          </section>

          <aside className="policy-highlight">
            <strong>Resumo importante</strong>
            <p>Seu XML permanece no seu dispositivo. O Baixa NFe não envia nem armazena o conteúdo da nota fiscal.</p>
          </aside>
        </article>
      </div>

      <footer className="policy-footer">
        <p>Baixa NFe · Ferramenta independente</p>
        <div><a href="/privacidade" aria-current="page">Privacidade</a><a href="/cookies">Cookies</a></div>
      </footer>
    </main>
  );
}
