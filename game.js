window.addEventListener('DOMContentLoaded', () => {
  // ── VERSION CHECK ───────────────────────────────────────────
  const GAME_VERSION   = '14';
  const VER_COOKIE     = 'lukle_version';
  const GUESSES_COOKIE = 'guesses';

  // simple cookie getter
  function getCookie(name) {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith(name + '='))
      ?.split('=')[1];
  }

  // in‑memory guesses must exist early
  let guesses = [];

  if (getCookie(VER_COOKIE) !== GAME_VERSION) {
    // 1) clear the saved cookie
    document.cookie = `${GUESSES_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    // 2) clear our internal array
    guesses = [];
    // 3) write the new version so we don't keep wiping
    document.cookie = `${VER_COOKIE}=${GAME_VERSION}; path=/; max-age=${60*60*24*365}; SameSite=Lax`;
  }
  // ────────────────────────────────────────────────────────────

  // now you can safely load guesses from cookie (it’s empty if version mismatched)
  function loadGuessesFromCookie() {
    const pairs = document.cookie.split('; ').map(c => c.split('='));
    const map = {};
    pairs.forEach(([k, ...v]) => map[k] = v.join('='));
    if (!map.guesses) return;
    try {
      const arr = JSON.parse(decodeURIComponent(map.guesses));
      if (Array.isArray(arr)) guesses = arr;
    } catch { /* ignore */ }
  }

  loadGuessesFromCookie();

  (async () => {
    // 1) Load game configuration
    let target, initialNumbers;
    try {
      const res = await fetch('game-config.json');
      if (!res.ok) throw new Error(`Config load error: ${res.status}`);
      const config = await res.json();
      target = config.target;
      initialNumbers = config.initialNumbers.slice().sort((a, b) => b - a);
    } catch (err) {
      console.error(err);
      alert('Could not load game configuration.');
      return;
    }

    // ----- Element references -----
    const operators        = document.querySelectorAll('.game__operator');
    const cardsContainer   = document.querySelector('.game__cards');
    const ctrlDecompose    = document.querySelector('.ctrl-decompose');
    const ctrlSubmit       = document.querySelector('.ctrl-submit');
    const ctrlReset        = document.querySelector('.ctrl-reset');
    const resultsContainer = document.querySelector('.game__results');
    const modal            = document.getElementById('share-modal');
    const shareBtn         = document.getElementById('share-btn');
    const closeBtn         = document.getElementById('close-btn');

    // ----- Game state -----
    let guesses        = [];
    let firstCard      = null;
    let chosenOperator = null;
    let idCounter      = 0;
    let gameOver       = false;

    // ----- Cookie persistence -----
    function saveGuessesToCookie() {
      const json = encodeURIComponent(JSON.stringify(guesses));
      document.cookie = `guesses=${json}; path=/; max-age=${60*60*24*7}; SameSite=Lax`;
    }
    function loadGuessesFromCookie() {
      const pairs = document.cookie.split('; ').map(c => c.split('='));
      const map = {};
      pairs.forEach(([k, ...v]) => map[k] = v.join('='));
      if (!map.guesses) return;
      try {
        const arr = JSON.parse(decodeURIComponent(map.guesses));
        if (Array.isArray(arr)) {
          arr.forEach(item => {
            if (typeof item.guess === 'number' && typeof item.rawDist === 'number') {
              guesses.push(item);
            }
          });
        }
      } catch (e) {
        console.warn('Failed to load guesses', e);
      }
    }
    loadGuessesFromCookie();

    // ----- UI helpers -----
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
      document
        .querySelectorAll('.game__card.selected, .game__operator.active')
        .forEach(e => e.classList.remove('selected','active'));
      firstCard = null;
      chosenOperator = null;
    }
    function updateControls() {
      ctrlSubmit.disabled    = !firstCard;
      ctrlDecompose.disabled = !(firstCard && firstCard.dataset.sources);
      ctrlReset.disabled     = document.querySelectorAll('.game__card[data-sources]').length === 0;
    }

    // ----- Core logic -----
    function handleCardClick(e) {
      if (gameOver) return;
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
      document.querySelectorAll('.game__card.selected')
        .forEach(c => c.classList.remove('selected'));
      const sources = [firstCard.dataset.id, card.dataset.id];
      clearSelections();
      const newCard = createCard(Math.round(result * 100) / 100, sources);
      firstCard = newCard;
      newCard.classList.add('selected');
      updateControls();
    }

    function renderResults() {
      const max = 6;
      let head = '', body = '';
      for (let i = 0; i < max; i++) {
        if (i < guesses.length) {
          const { guess, rawDist } = guesses[i];
          head += `<th style="padding:0.5rem;font-size:1.5rem;border:none;">${guess}</th>`;
          let disp;
          if      (rawDist > 100) disp = `±${Math.floor((rawDist - 1)/100)*100}–${Math.ceil(rawDist/100)*100}`;
          else if (rawDist > 10 ) disp = `±${Math.floor((rawDist - 1)/10)*10}–${Math.ceil(rawDist/10)*10}`;
          else                    disp = `±${rawDist}`;
          body += `<td style="padding:0.5rem;font-size:1.5rem;border:none;">${disp}</td>`;
        } else {
          head += `<th style="padding:0.5rem;font-size:1.5rem;border:none;">–</th>`;
          body += `<td style="padding:0.5rem;font-size:1.5rem;border:none;">–</td>`;
        }
      }
      resultsContainer.innerHTML = `
        <table style="width:100%;border-collapse:collapse;text-align:center;">
          <thead><tr>${head}</tr></thead>
          <tbody><tr>${body}</tr></tbody>
        </table>
      `;
    }

    // ----- Initialization -----
    initialNumbers.forEach(n => createCard(n));
    renderResults();
    updateControls();

    // ----- Event listeners -----
    // operators
    operators.forEach(op => {
      op.addEventListener('click', e => {
        if (gameOver || !firstCard) return;
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

    // reset
    ctrlReset.addEventListener('click', () => {
      if (gameOver) return;
      document.querySelectorAll('.game__card[data-sources]').forEach(card => {
        const [a,b] = JSON.parse(card.dataset.sources);
        [a,b].forEach(id => {
          const orig = cardsContainer.querySelector(`[data-id="${id}"]`);
          if (orig) { orig.classList.remove('used'); orig.disabled = false; }
        });
        card.remove();
      });
      clearSelections();
      updateControls();
    });

    // decompose
    ctrlDecompose.addEventListener('click', () => {
      if (gameOver) return;
      if (firstCard && firstCard.dataset.sources) {
        const [a,b] = JSON.parse(firstCard.dataset.sources);
        [a,b].forEach(id => {
          const orig = cardsContainer.querySelector(`[data-id="${id}"]`);
          if (orig) { orig.classList.remove('used'); orig.disabled = false; }
        });
        firstCard.remove();
        clearSelections();
        updateControls();
      }
    });

    // submit / guess
    ctrlSubmit.addEventListener('click', () => {
      if (gameOver || !firstCard) return;
      const guess   = parseFloat(firstCard.textContent);
      const rawDist = Math.abs(guess - target);

      if (rawDist === 0) {
        // 🎉 PERFECT WIN
        gameOver = true;

        // confetti
        confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });

        // grey‑out cards & operators
        document.querySelectorAll('.game__card, .game__operator')
          .forEach(btn => { btn.disabled = true; btn.classList.add('used'); });

        // grey‑out controls including Reset
        ctrlSubmit.disabled    = true;
        ctrlDecompose.disabled = true;
        ctrlReset.disabled     = true;

        // show share modal
        modal.classList.add('active');
        return;
      }

      // record guess
      if (guesses.length < initialNumbers.length) {
        guesses.push({ guess, rawDist });
        saveGuessesToCookie();
      }

      // cleanup
      firstCard.classList.remove('selected');
      firstCard      = null;
      chosenOperator = null;
      operators.forEach(o => o.classList.remove('active'));
      updateControls();
      renderResults();
    });

    // deselect on outside click
    document.addEventListener('click', e => {
      if (gameOver) return;
      if (!e.target.closest('.game__card, .game__operator, .game__control')) {
        clearSelections();
        updateControls();
      }
    });

    // share modal actions
    shareBtn.addEventListener('click', () => {
      const count   = guesses.length + 1; // include perfect guess
      const squares = guesses
        .map(({ rawDist }) =>
          rawDist === 0              ? '🟩' :
          rawDist >= 1 && rawDist < 10 ? `${rawDist}️⃣` :
          rawDist === 10             ? '🔟' :
          rawDist <= 100             ? '🟨' :
                                      '🟥'
        )
        .concat('🟩')
        .join('');
      const shareText = `Lukle 5 ${count}/6\n\n${squares}\n\nhttps://morgans42.github.io/Lukle/`;

      if (navigator.share) {
        navigator.share({ text: shareText }).catch(console.error);
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText)
          .then(() => alert('Copied to clipboard!'))
          .catch(console.error);
      } else {
        prompt('Copy your result:', shareText);
      }

      closeModalAndContinue();
    });

    closeBtn.addEventListener('click', closeModalAndContinue);
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModalAndContinue();
    });

    function closeModalAndContinue() {
      modal.classList.remove('active');
      // record the perfect guess
      guesses.push({ guess: target, rawDist: 0 });
      saveGuessesToCookie();
      clearSelections();
      operators.forEach(o => o.classList.remove('active'));
      updateControls();
      renderResults();
    }

  })();
});
