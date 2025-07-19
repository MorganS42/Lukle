window.addEventListener('DOMContentLoaded', () => {
  const operators = document.querySelectorAll('.game__operator');
  const cardsContainer = document.querySelector('.game__cards');
  const ctrlDecompose = document.querySelector('.ctrl-decompose');
  const ctrlSubmit = document.querySelector('.ctrl-submit');
  const ctrlReset = document.querySelector('.ctrl-reset');
  const resultsContainer = document.querySelector('.game__results');

  let firstCard = null;
  let chosenOperator = null;
  let idCounter = 0;
  const guesses = [];
  // hidden target and initial numbers
  const target = 880;
  const initialNumbers = [50, 75, 2, 4, 7, 1].sort((a, b) => b - a);

  // ----- Cookie helpers -----
  function saveGuessesToCookie() {
    const json = encodeURIComponent(JSON.stringify(guesses));
    document.cookie = `guesses=${json}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
  }

  function loadGuessesFromCookie() {
    const match = document.cookie.match(/(?:^|; )guesses=([^;]+)/);
    if (!match) return;
    try {
      const arr = JSON.parse(decodeURIComponent(match[1]));
      if (Array.isArray(arr)) {
        arr.forEach(item => {
          if (typeof item.guess === 'number' && typeof item.rawDist === 'number') {
            guesses.push(item);
          }
        });
      }
    } catch (e) {
      console.warn('Could not parse saved guesses cookie', e);
    }
  }

  // load persisted guesses
  loadGuessesFromCookie();

  // ----- Card and control functions -----
  function createCard(value, sources = null) {
    const btn = document.createElement('button');
    btn.className = 'game__card';
    btn.textContent = value;
    btn.dataset.id = idCounter++;
    if (sources) btn.dataset.sources = JSON.stringify(sources);
    btn.addEventListener('click', handleCardClick);
    if (btn.textContent.length > 2) btn.classList.add('small-text');
    cardsContainer.appendChild(btn);
    return btn;
  }

  function markUsed(el) {
    el.classList.add('used');
    el.disabled = true;
  }

  function clearSelections() {
    document.querySelectorAll('.game__card.selected, .game__operator.active')
      .forEach(e => e.classList.remove('selected', 'active'));
    firstCard = null;
    chosenOperator = null;
  }

  function updateControls() {
    ctrlSubmit.disabled    = !firstCard;
    ctrlDecompose.disabled = !(firstCard && firstCard.dataset.sources);
    ctrlReset.disabled     = document.querySelectorAll('.game__card[data-sources]').length === 0;
  }

  function handleCardClick(e) {
    const card = e.target;
    if (!firstCard) {
      clearSelections();
      firstCard = card;
      card.classList.add('selected');
      updateControls();
      return;
    }
    if (!chosenOperator) {
      if (card !== firstCard) {
        firstCard.classList.remove('selected');
        firstCard = card;
        card.classList.add('selected');
      }
      updateControls();
      return;
    }
    if (card === firstCard) return;
    card.classList.add('selected');
    const a = parseFloat(firstCard.textContent);
    const b = parseFloat(card.textContent);
    if (chosenOperator === '÷' && a % b !== 0) {
      card.classList.remove('selected');
      return;
    }
    let result;
    switch (chosenOperator) {
      case '+': result = a + b; break;
      case '−': result = a - b; break;
      case '×': result = a * b; break;
      case '÷': result = a / b; break;
    }
    markUsed(firstCard);
    markUsed(card);
    operators.forEach(o => o.classList.remove('active'));
    document.querySelectorAll('.game__card.selected').forEach(c => c.classList.remove('selected'));
    const sources = [firstCard.dataset.id, card.dataset.id];
    clearSelections();
    const newCard = createCard(Math.round(result * 100) / 100, sources);
    firstCard = newCard;
    newCard.classList.add('selected');
    updateControls();
  }

  function renderResults() {
    const max = 6;
    let head = '';
    let body = '';
    for (let i = 0; i < max; i++) {
      if (i < guesses.length) {
        const { guess, rawDist } = guesses[i];
        head += `<th style=\"padding:0.5rem; font-size:1.5rem; border:none;\">${guess}</th>`;
        let disp;
        if      (rawDist > 100) disp = `<= ${Math.ceil(rawDist / 100) * 100}`;
        else if (rawDist > 10)  disp = `<= ${Math.ceil(rawDist / 10) * 10}`;
        else                     disp = `${rawDist}`;
        body += `<td style=\"padding:0.5rem; font-size:1.5rem; border:none;\">${disp}</td>`;
      } else {
        head += `<th style=\"padding:0.5rem; font-size:1.5rem; border:none;\">&ndash;</th>`;
        body += `<td style=\"padding:0.5rem; font-size:1.5rem; border:none;\">&ndash;</td>`;
      }
    }
    resultsContainer.innerHTML = `
      <table style=\"border:none; width:100%; border-collapse:collapse;\">
        <thead><tr>${head}</tr></thead>
        <tbody><tr>${body}</tr></tbody>
      </table>
    `;
  }

  // Setup initial cards
  initialNumbers.forEach(n => createCard(n));

  // Operator handlers
  operators.forEach(op => {
    op.addEventListener('click', e => {
      if (!firstCard) return;
      if (e.target.classList.contains('active')) {
        e.target.classList.remove('active');
        chosenOperator = null;
      } else {
        operators.forEach(o => o.classList.remove('active'));
        e.target.classList.add('active');
        chosenOperator = e.target.textContent;
      }
      updateControls();
    });
  });

  // Control handlers
  ctrlReset.addEventListener('click', () => {
    document.querySelectorAll('.game__card[data-sources]').forEach(card => {
      const [a,b] = JSON.parse(card.dataset.sources);
      [a,b].forEach(id => {
        const orig = cardsContainer.querySelector(`[data-id=\"${id}\"]`);
        if (orig) { orig.classList.remove('used'); orig.disabled = false; }
      });
      card.remove();
    });
    clearSelections();
    updateControls();
  });

  ctrlDecompose.addEventListener('click', () => {
    if (firstCard && firstCard.dataset.sources) {
      const [a,b] = JSON.parse(firstCard.dataset.sources);
      [a,b].forEach(id => {
        const orig = cardsContainer.querySelector(`[data-id=\"${id}\"]`);
        if (orig) { orig.classList.remove('used'); orig.disabled = false; }
      });
      firstCard.remove();
      clearSelections();
      updateControls();
    }
  });

  ctrlSubmit.addEventListener('click', () => {
    if (!firstCard) return;
    const guess = parseFloat(firstCard.textContent);
    const rawDist = Math.abs(guess - target);
    if (guesses.length < 6) {
      guesses.push({ guess, rawDist });
      saveGuessesToCookie();
    }
    firstCard.classList.remove('selected');
    firstCard = null;
    chosenOperator = null;
    operators.forEach(o => o.classList.remove('active'));
    updateControls();
    renderResults();
  });

  // Initial state
  updateControls();
  renderResults();
});
