(() => {
  'use strict';
  const header = document.querySelector('.content-page .site-header');
  const nav = header?.querySelector('nav');
  if (!header || !nav || header.querySelector('.content-menu-toggle')) return;

  // Os mesmos tópicos e a mesma ordem em todas as páginas internas.
  const items = [
    ['/', 'ProcurandoDanfe'],
    ['/#como-funciona', 'Como funciona'],
    ['/ferramentas/', 'Ferramentas'],
    ['/guias/', 'Guias'],
    ['/perguntas-frequentes/', 'Dúvidas'],
    ['/contato/', 'Contato'],
    ['/procurandodashboard/', 'ProcurandoDashboard'],
  ];
  const path = window.location.pathname;
  const isCurrent = (href) => (
    href === '/' ? path === '/' :
    href === '/ferramentas/' || href === '/guias/'
      ? path.startsWith(href)
      : path === href
  );
  nav.replaceChildren(...items.map(([href, label]) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (href === '/procurandodashboard/') link.classList.add('dashboard-nav-link');
    if (isCurrent(href)) link.setAttribute('aria-current', 'page');
    return link;
  }));

  // O antigo CTA duplicava a ferramenta e deslocava o menu em cada seção.
  header.querySelector('.content-cta')?.remove();

  // Mantém a marca igual à página inicial.
  const brandTitle = header.querySelector('.brand > span:last-child');
  if (brandTitle) brandTitle.innerHTML = 'Procurando<span>NFe</span>';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'content-menu-toggle';
  button.setAttribute('aria-label', 'Abrir menu');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<span></span><span></span><span></span>';

  const panel = document.createElement('div');
  panel.className = 'content-mobile-menu';
  panel.setAttribute('aria-hidden', 'true');
  [...nav.querySelectorAll('a')].forEach((link) => panel.append(link.cloneNode(true)));
  const close = () => {
    button.classList.remove('is-open');
    panel.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Abrir menu');
    panel.setAttribute('aria-hidden', 'true');
  };
  const open = () => {
    button.classList.add('is-open');
    panel.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', 'Fechar menu');
    panel.setAttribute('aria-hidden', 'false');
  };

  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    panel.classList.contains('is-open') ? close() : open();
  });
  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) close();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) close();
  });

  header.append(button, panel);
})();
