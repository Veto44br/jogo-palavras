/* Jogo tipo “organize as letras” */

const WORDS = [
  { word: 'ABACAXI', img: '🍍' },
  { word: 'BANANA', img: '🍌' },
  { word: 'MORANGO', img: '🍓' },
  { word: 'LARANJA', img: '🍊' },
  { word: 'UVA', img: '🍇' }
];

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeWord(w) {
  return String(w)
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function $(sel) {
  return document.querySelector(sel);
}

let current = null;
let dragTileEl = null;
let slotsByIndex = [];

function setupRemoveZone() {
  const zone = $('#letterDropZone');
  if (!zone) return;

  zone.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    zone.classList.add('over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('over');
  });

  zone.addEventListener('drop', (ev) => {
    ev.preventDefault();
    zone.classList.remove('over');
    if (!dragTileEl) return;

    // Voltar para o banco (debaixo)
    if (dragTileEl.parentElement) {
      dragTileEl.parentElement.removeChild(dragTileEl);
    }
    $('#letterBank').appendChild(dragTileEl);

    // Se o tile estava em algum slot, valida progresso e status
    validateAll();
  });

}


function setView(view) {
  if (view === 'auth') {
    $('#authPage').classList.remove('hidden');
    $('#gamePage').classList.add('hidden');
  } else {
    $('#authPage').classList.add('hidden');
    $('#gamePage').classList.remove('hidden');
  }
}

function authMockSubmit(e) {
  e.preventDefault();
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value.trim();

  if (!email || !password) {
    $('#authMsg').textContent = 'Preencha email e senha.';
    $('#authMsg').className = 'msg show err';
    return;
  }

  // Salvar informações de login no navegador (mock de autenticação).
  const namePart = email.split('@')[0] || 'Jogador';

  // “persistência” simples (sem banco por enquanto)
  const profile = {
    email,
    name: namePart.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'Jogador'
  };

  localStorage.setItem('jp_user', JSON.stringify(profile));

  // manter pontuação por usuário (opcional)
  const key = 'jp_score_' + profile.email;
  if (localStorage.getItem(key) == null) {
    localStorage.setItem(key, JSON.stringify({ score: 0, roundsWon: 0 }));
  }

  setView('game');
  startRound();

}

function renderWordPuzzle({ word, img }) {
  const answerRow = $('#answerRow');
  const letterBank = $('#letterBank');

  answerRow.innerHTML = '';
  letterBank.innerHTML = '';
  slotsByIndex = [];

  const normalized = normalizeWord(word);
  const letters = normalized.split('');
  const scrambled = shuffle(letters);

  $('#heroEmoji').textContent = img;

  letters.forEach((ch, idx) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.index = String(idx);
    slot.dataset.expected = ch;
    slot.addEventListener('dragover', (ev) => {
      ev.preventDefault();
    });
    slot.addEventListener('drop', (ev) => {
      ev.preventDefault();
      if (!dragTileEl) return;

      const fromSlot = dragTileEl.closest('.slot');
      const toExisting = slot.querySelector('.tile');

      // Se o slot de destino já tem uma letra, só permite troca se a letra destino NÃO estiver correta.
      if (toExisting && toExisting !== dragTileEl) {
        const expectedDest = slot.dataset.expected;
        const destIsCorrect = toExisting.textContent === expectedDest;
        if (destIsCorrect) {
          // Caixa correta não pode ser trocada
          return;
        }
      }

      // Se existe uma letra no slot destino (errada), jogamos ela de volta no banco
      if (toExisting && toExisting !== dragTileEl) {
        toExisting.remove();
        $('#letterBank').appendChild(toExisting);
      }

      // Remove do lugar antigo
      if (dragTileEl.parentElement) {
        dragTileEl.parentElement.removeChild(dragTileEl);
      }

      // Coloca na caixa
      slot.appendChild(dragTileEl);
      validateSlot(slot);
      validateAll();
    });






    answerRow.appendChild(slot);
    slotsByIndex[idx] = slot;
  });

  scrambled.forEach((ch, tileIdx) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.textContent = ch;
    tile.draggable = true;
    tile.dataset.tileId = String(tileIdx);

    tile.addEventListener('dragstart', () => {
      dragTileEl = tile;
      tile.classList.add('dragging');
    });

    tile.addEventListener('dragend', () => {
      dragTileEl = null;
      tile.classList.remove('dragging');
    });

    letterBank.appendChild(tile);
  });

  $('#hintText').textContent = 'Arraste as letras para montar a palavra.';

  $('#scoreValue').textContent = '0';
  $('#statusText').textContent = 'Em jogo';
}

function validateSlot(slot) {
  if (!slot) return;

  // Se tem tile dentro, compara com esperado
  const tile = slot.querySelector('.tile');
  const expected = slot.dataset.expected;

  // Limpa estados
  slot.classList.remove('correct');
  const tileEl = slot.querySelector('.tile');
  if (tileEl) tileEl.classList.remove('correct');

  if (!tile) return;

  if (tile.textContent === expected) {
    slot.classList.add('correct');
    tileEl.classList.add('correct');
  }
}

function validateAll() {
  const slots = slotsByIndex;
  const total = slots.length;
  const correctCount = slots.reduce((acc, s) => {
    const tile = s.querySelector('.tile');
    return acc + (tile && tile.textContent === s.dataset.expected ? 1 : 0);
  }, 0);

  const percent = total ? Math.round((correctCount / total) * 100) : 0;
  const el = $('#progressPercent');
  if (el) el.textContent = percent + '%';

  const filled = slots.every((s) => !!s.querySelector('.tile'));
  if (!filled) {
    $('#statusText').textContent = 'Em jogo';
    return;
  }

  const ok = correctCount === total;

  if (ok) {
    $('#statusText').textContent = 'Você acertou!';
    $('#nextBtn').disabled = false;
    // só pontua quando acertar (evita múltiplas pontuações)
    if (!$('#statusText').dataset.scored) {
      $('#statusText').dataset.scored = '1';
      incrementScore();
    }
  } else {
    $('#statusText').textContent = 'Quase lá...';
    delete $('#statusText').dataset.scored;
  }
}


function incrementScore() {
  const cur = Number($('#scoreValue').textContent || '0');
  const next = cur + 1;
  $('#scoreValue').textContent = String(next);

  // Persistir score por usuário (mock sem banco)
  const user = JSON.parse(localStorage.getItem('jp_user') || 'null');
  if (user && user.email) {
    const key = 'jp_score_' + user.email;
    const profileScore = JSON.parse(localStorage.getItem(key) || '{"score":0,"roundsWon":0}');
    profileScore.score = next;
    profileScore.roundsWon = (profileScore.roundsWon || 0) + 1;
    localStorage.setItem(key, JSON.stringify(profileScore));
  }
}


function startRound() {
  $('#nextBtn').disabled = true;

  const pick = WORDS[Math.floor(Math.random() * WORDS.length)];
  current = pick;
  renderWordPuzzle(pick);

  // Restaurar score do usuário (mock sem banco)
  const user = JSON.parse(localStorage.getItem('jp_user') || 'null');
  if (user && user.email) {
    const key = 'jp_score_' + user.email;
    const profileScore = JSON.parse(localStorage.getItem(key) || '{"score":0,"roundsWon":0}');
    $('#scoreValue').textContent = String(profileScore.score || 0);
  }

  // Ajuste: valida rapidamente se houver queda indevida
  slotsByIndex.forEach((s) => validateSlot(s));
}


function logout() {
  localStorage.removeItem('jp_user');
  setView('auth');
  $('#authMsg').textContent = '';
}

function init() {
  // Auth
  const form = $('#authForm');
  form.addEventListener('submit', authMockSubmit);

  $('#logoutBtn').addEventListener('click', logout);

  // Game
  $('#nextBtn').addEventListener('click', startRound);

  setupRemoveZone();

  const userRaw = localStorage.getItem('jp_user');
  if (userRaw) {
    setView('game');
    $('#welcomeName').textContent = JSON.parse(userRaw).name || 'Jogador';
    startRound();
  } else {
    setView('auth');
  }
}

document.addEventListener('DOMContentLoaded', init);


