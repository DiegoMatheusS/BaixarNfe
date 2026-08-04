export const metadata = {
  title: "Política de Cookies | Baixa NFe",
  description: "Entenda como cookies serão utilizados no site Baixa NFe.",
};

export default function CookiesPage() {
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
          <span>CONTROLE NAS SUAS MÃOS</span>
          <h1>Política de Cookies</h1>
          <p>Veja quais tecnologias podem ser utilizadas e como controlar suas preferências.</p>
          <small>Última atualização: 4 de agosto de 2026</small>
        </div>

        <article className="policy-card">
          <section>
            <h2>1. O que são cookies?</h2>
            <p>Cookies são pequenos arquivos armazenados no navegador para lembrar preferências, permitir funções técnicas, medir acessos ou personalizar publicidade.</p>
          </section>

          <section>
            <h2>2. Uso atual</h2>
            <p>As funções principais do Baixa NFe não precisam de cookies para ler o XML. O processamento do arquivo acontece localmente e o documento não é enviado ao site.</p>
          </section>

          <section>
            <h2>3. Cookies essenciais</h2>
            <p>A infraestrutura de hospedagem poderá utilizar tecnologias estritamente necessárias para segurança, entrega das páginas e prevenção de abuso. Esses recursos não são usados para ler o conteúdo do seu XML.</p>
          </section>

          <section>
            <h2>4. Cookies de publicidade</h2>
            <p>O site possui integração com o Google AdSense. O Google e seus parceiros poderão utilizar cookies ou identificadores para exibir, limitar e medir anúncios, de acordo com as configurações de privacidade da plataforma e a legislação aplicável.</p>
          </section>

          <section>
            <h2>5. Suas escolhas</h2>
            <p>Quando exigido, as opções de consentimento relacionadas à publicidade serão apresentadas por meio da solução de privacidade configurada no Google AdSense. Você também pode controlar ou apagar cookies nas configurações do navegador.</p>
          </section>

          <section>
            <h2>6. Configuração do navegador</h2>
            <p>Você pode apagar ou bloquear cookies nas configurações do navegador. O bloqueio de cookies essenciais poderá afetar recursos de segurança, mas não impedirá a leitura local do XML.</p>
          </section>

          <section>
            <h2>7. Alterações</h2>
            <p>Esta política poderá ser revisada quando os espaços publicitários forem alterados ou quando novas tecnologias forem adicionadas ao site.</p>
          </section>

          <aside className="policy-highlight">
            <strong>Integração do AdSense preparada</strong>
            <p>A exibição de anúncios depende da análise do site pelo Google e da configuração dos blocos ou dos anúncios automáticos.</p>
          </aside>
        </article>
      </div>

      <footer className="policy-footer">
        <p>Baixa NFe · Ferramenta independente</p>
        <div><a href="/privacidade">Privacidade</a><a href="/cookies" aria-current="page">Cookies</a></div>
      </footer>
    </main>
  );
}
