(() => {
  const button = document.querySelector('#extra-pages-toggle');
  const panel = document.querySelector('#extra-pages-panel');
  const form = panel.querySelector('form');
  const input = panel.querySelector('input');
  const links = panel.querySelector('nav');
  const error = panel.querySelector('[role="status"]');
  let unlocked = false;
  function close() {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    input.value = '';
    error.textContent = '';
  }
  button.addEventListener('click', () => {
    if (!panel.hidden) return close();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    (unlocked ? links.querySelector('a') : input).focus();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (input.value !== 'peepeepoopoo') {
      error.textContent = 'Incorrect passcode. Try again.';
      input.select();
      return;
    }
    unlocked = true;
    input.value = '';
    error.textContent = '';
    form.hidden = true;
    links.hidden = false;
    button.setAttribute('aria-label', 'Open extra pages');
    links.querySelector('a').focus();
  });
  document.addEventListener('pointerdown', event => {
    if (!panel.contains(event.target) && !button.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      close();
      button.focus();
    }
  });
})();
