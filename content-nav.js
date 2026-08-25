(() => {
  'use strict';
  const header = document.querySelector('.content-page .site-header');
  const nav = header?.querySelector('nav');
  if (!header || !nav || header.querySelector('.content-menu-toggle')) return;

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
  const cta = header.querySelector('.content-cta');
  if (cta) {
    const clone = cta.cloneNode(true);
    clone.classList.add('content-mobile-cta');
    panel.append(clone);
  }

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
    if (window.innerWidth > 720) close();
  });

  header.append(button, panel);
})();
