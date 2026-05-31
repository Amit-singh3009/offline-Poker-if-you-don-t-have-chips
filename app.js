const STORAGE_KEY = "offline-poker-chip-table-v1";

const setupScreen = document.querySelector("#setupScreen");
const tableScreen = document.querySelector("#tableScreen");
const setupForm = document.querySelector("#setupForm");
const playerCountInput = document.querySelector("#playerCount");
const startingStackInput = document.querySelector("#startingStack");
const smallBlindInput = document.querySelector("#smallBlind");
const bigBlindInput = document.querySelector("#bigBlind");
const namesGrid = document.querySelector("#namesGrid");
const loadSavedBtn = document.querySelector("#loadSavedBtn");

const playerGrid = document.querySelector("#playerGrid");
const activePlayerSelect = document.querySelector("#activePlayerSelect");
const activePlayerCard = document.querySelector("#activePlayerCard");
const actionAmount = document.querySelector("#actionAmount");
const winnerList = document.querySelector("#winnerList");
const eventLog = document.querySelector("#eventLog");

const potTotal = document.querySelector("#potTotal");
const toCall = document.querySelector("#toCall");
const blindSummary = document.querySelector("#blindSummary");
const dealerName = document.querySelector("#dealerName");
const handNumber = document.querySelector("#handNumber");

const state = {
  players: [],
  smallBlind: 10,
  bigBlind: 20,
  dealerIndex: 0,
  activeIndex: 0,
  hand: 1,
  currentBet: 0,
  pot: 0,
  log: [],
  history: [],
};

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function chips(value) {
  return Number(value || 0).toLocaleString();
}

function livePlayers() {
  return state.players.filter((player) => player.stack > 0 || player.bet > 0);
}

function activePlayers() {
  return state.players.filter((player) => !player.folded && (player.stack > 0 || player.bet > 0));
}

function nextLiveIndex(fromIndex, offset = 1) {
  if (!state.players.length) return 0;
  for (let step = offset; step <= state.players.length + offset; step += 1) {
    const index = (fromIndex + step) % state.players.length;
    if (state.players[index].stack > 0 || state.players[index].bet > 0) return index;
  }
  return fromIndex;
}

function remember() {
  state.history.push(
    JSON.stringify({
      players: state.players,
      smallBlind: state.smallBlind,
      bigBlind: state.bigBlind,
      dealerIndex: state.dealerIndex,
      activeIndex: state.activeIndex,
      hand: state.hand,
      currentBet: state.currentBet,
      pot: state.pot,
      log: state.log,
    }),
  );
  if (state.history.length > 40) state.history.shift();
}

function log(message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 60);
}

function saveTable() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, history: [] }));
  showToast("Table saved on this device.");
}

function loadTable(raw) {
  const parsed = JSON.parse(raw);
  Object.assign(state, parsed, { history: [] });
  showTable();
  render();
}

function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2200);
}

function renderNameFields() {
  const count = clamp(Number(playerCountInput.value || 2), 2, 13);
  playerCountInput.value = count;
  namesGrid.innerHTML = "";
  for (let index = 0; index < count; index += 1) {
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 22;
    input.placeholder = `Player ${index + 1}`;
    input.value = `Player ${index + 1}`;
    input.dataset.nameInput = String(index);
    namesGrid.append(input);
  }
}

function showTable() {
  setupScreen.classList.add("hidden");
  tableScreen.classList.remove("hidden");
}

function startGame(event) {
  event.preventDefault();
  const count = clamp(Number(playerCountInput.value || 2), 2, 13);
  const stack = Math.max(1, Number(startingStackInput.value || 1000));
  state.smallBlind = Math.max(1, Number(smallBlindInput.value || 10));
  state.bigBlind = Math.max(state.smallBlind, Number(bigBlindInput.value || state.smallBlind * 2));
  state.players = Array.from(namesGrid.querySelectorAll("[data-name-input]"))
    .slice(0, count)
    .map((input, index) => ({
      id: crypto.randomUUID(),
      name: input.value.trim() || `Player ${index + 1}`,
      stack,
      bet: 0,
      folded: false,
      acted: false,
    }));
  state.dealerIndex = 0;
  state.activeIndex = nextLiveIndex(state.dealerIndex);
  state.hand = 1;
  state.currentBet = 0;
  state.pot = 0;
  state.log = [`Table started with ${count} players.`];
  state.history = [];
  showTable();
  render();
}

function render() {
  const dealer = state.players[state.dealerIndex] || state.players[0];
  handNumber.textContent = String(state.hand);
  potTotal.textContent = chips(state.pot);
  toCall.textContent = chips(Math.max(0, state.currentBet - (state.players[state.activeIndex]?.bet || 0)));
  blindSummary.textContent = `${chips(state.smallBlind)} / ${chips(state.bigBlind)}`;
  dealerName.textContent = dealer?.name || "-";

  renderPlayers();
  renderControls();
  renderWinners();
  renderLog();
}

function renderPlayers() {
  playerGrid.innerHTML = "";
  state.players.forEach((player, index) => {
    const card = document.createElement("article");
    card.className = "player-card";
    if (index === state.activeIndex) card.classList.add("active");
    if (player.folded) card.classList.add("folded");
    if (player.stack <= 0 && player.bet <= 0) card.classList.add("busted");

    const badges = [];
    if (index === state.dealerIndex) badges.push(`<span class="badge">D</span>`);
    if (index === nextLiveIndex(state.dealerIndex)) badges.push(`<span class="badge blue">SB</span>`);
    if (index === nextLiveIndex(state.dealerIndex, 2)) badges.push(`<span class="badge blue">BB</span>`);
    if (player.folded) badges.push(`<span class="badge red">Fold</span>`);
    if (player.stack === 0 && player.bet > 0) badges.push(`<span class="badge red">All in</span>`);

    const chipCount = clamp(Math.ceil((player.stack + player.bet) / Math.max(state.bigBlind * 20, 1)), 1, 5);
    card.innerHTML = `
      <div class="player-head">
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="badges">${badges.join("")}</span>
      </div>
      <div class="stack-line"><span>Stack</span><strong>${chips(player.stack)}</strong></div>
      <div class="stack-line"><span>Bet this round</span><strong>${chips(player.bet)}</strong></div>
      <div class="chip-rail">${Array.from({ length: chipCount }, () => '<span class="chip"></span>').join("")}</div>
    `;
    card.addEventListener("click", () => {
      state.activeIndex = index;
      render();
    });
    playerGrid.append(card);
  });
}

function renderControls() {
  activePlayerSelect.innerHTML = "";
  state.players.forEach((player, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = player.name;
    option.selected = index === state.activeIndex;
    activePlayerSelect.append(option);
  });

  const player = state.players[state.activeIndex];
  if (!player) return;
  const callAmount = Math.max(0, state.currentBet - player.bet);
  activePlayerCard.innerHTML = `
    <strong>${escapeHtml(player.name)}</strong><br />
    Stack: ${chips(player.stack)}<br />
    In round: ${chips(player.bet)}<br />
    Needed to call: ${chips(callAmount)}
  `;
  document.querySelector("#undoBtn").disabled = state.history.length === 0;
}

function renderWinners() {
  winnerList.innerHTML = "";
  state.players.forEach((player, index) => {
    const label = document.createElement("label");
    label.className = "winner-option";
    label.innerHTML = `
      <input type="checkbox" value="${index}" />
      <span>${escapeHtml(player.name)} (${chips(player.stack)} chips)</span>
    `;
    winnerList.append(label);
  });
}

function renderLog() {
  eventLog.innerHTML = "";
  state.log.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    eventLog.append(item);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function moveToNextActive() {
  for (let step = 1; step <= state.players.length; step += 1) {
    const index = (state.activeIndex + step) % state.players.length;
    const player = state.players[index];
    if (!player.folded && player.stack > 0) {
      state.activeIndex = index;
      return;
    }
  }
}

function commitBet(index, amount, label = "bets") {
  const player = state.players[index];
  if (!player || player.folded || player.stack <= 0) return;
  const paid = Math.min(Math.max(0, amount), player.stack);
  if (paid <= 0) return;
  player.stack -= paid;
  player.bet += paid;
  player.acted = true;
  state.pot += paid;
  state.currentBet = Math.max(state.currentBet, player.bet);
  log(`${player.name} ${label} ${chips(paid)}.`);
}

function betSelected() {
  remember();
  const player = state.players[state.activeIndex];
  const entered = Math.max(0, Number(actionAmount.value || 0));
  const callAmount = Math.max(0, state.currentBet - player.bet);
  commitBet(state.activeIndex, Math.max(entered, callAmount));
  moveToNextActive();
  render();
}

function allInSelected() {
  remember();
  commitBet(state.activeIndex, state.players[state.activeIndex].stack, "goes all in for");
  moveToNextActive();
  render();
}

function checkSelected() {
  const player = state.players[state.activeIndex];
  if (player.bet < state.currentBet) {
    showToast(`${player.name} needs ${chips(state.currentBet - player.bet)} to call.`);
    return;
  }
  remember();
  player.acted = true;
  log(`${player.name} checks.`);
  moveToNextActive();
  render();
}

function foldSelected() {
  remember();
  const player = state.players[state.activeIndex];
  player.folded = true;
  player.acted = true;
  log(`${player.name} folds.`);
  const remaining = activePlayers();
  if (remaining.length === 1 && state.pot > 0) {
    remaining[0].stack += state.pot;
    log(`${remaining[0].name} wins ${chips(state.pot)} uncontested.`);
    state.pot = 0;
  }
  moveToNextActive();
  render();
}

function postBlinds() {
  if (state.players.some((player) => player.bet > 0)) {
    showToast("Blinds are already posted for this betting round.");
    return;
  }
  remember();
  const sbIndex = nextLiveIndex(state.dealerIndex);
  const bbIndex = nextLiveIndex(state.dealerIndex, 2);
  commitBet(sbIndex, state.smallBlind, "posts small blind");
  commitBet(bbIndex, state.bigBlind, "posts big blind");
  state.activeIndex = nextLiveIndex(bbIndex);
  render();
}

function nextStreet() {
  remember();
  state.players.forEach((player) => {
    player.bet = 0;
    player.acted = false;
  });
  state.currentBet = 0;
  state.activeIndex = nextLiveIndex(state.dealerIndex);
  log("Next betting round started.");
  render();
}

function newHand() {
  remember();
  state.players.forEach((player) => {
    player.bet = 0;
    player.folded = false;
    player.acted = false;
  });
  state.pot = 0;
  state.currentBet = 0;
  state.hand += 1;
  state.dealerIndex = nextLiveIndex(state.dealerIndex);
  state.activeIndex = nextLiveIndex(state.dealerIndex);
  log(`Hand ${state.hand} started.`);
  render();
}

function rebuySelected() {
  const player = state.players[state.activeIndex];
  const amount = Number(prompt(`How many chips should ${player.name} receive?`, String(state.bigBlind * 50)));
  if (!Number.isFinite(amount) || amount <= 0) return;
  remember();
  player.stack += Math.floor(amount);
  player.folded = false;
  log(`${player.name} rebuys ${chips(amount)}.`);
  render();
}

function awardPot() {
  const selected = Array.from(winnerList.querySelectorAll("input:checked")).map((input) => Number(input.value));
  if (!selected.length) {
    showToast("Select at least one winner.");
    return;
  }
  if (state.pot <= 0) {
    showToast("The pot is empty.");
    return;
  }
  remember();
  const share = Math.floor(state.pot / selected.length);
  let remainder = state.pot % selected.length;
  selected.forEach((index) => {
    const bonus = remainder > 0 ? 1 : 0;
    state.players[index].stack += share + bonus;
    remainder -= bonus;
  });
  const names = selected.map((index) => state.players[index].name).join(", ");
  log(`${names} won ${chips(state.pot)}.`);
  state.pot = 0;
  state.players.forEach((player) => {
    player.bet = 0;
    player.folded = false;
    player.acted = false;
  });
  state.currentBet = 0;
  render();
}

function undo() {
  const last = state.history.pop();
  if (!last) return;
  const restored = JSON.parse(last);
  Object.assign(state, restored, { history: state.history });
  render();
}

function exportTable() {
  const blob = new Blob([JSON.stringify({ ...state, history: [] }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `poker-table-hand-${state.hand}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetTable() {
  if (!confirm("Reset the table and return to setup?")) return;
  localStorage.removeItem(STORAGE_KEY);
  tableScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
}

playerCountInput.addEventListener("input", renderNameFields);
setupForm.addEventListener("submit", startGame);
loadSavedBtn.addEventListener("click", () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    showToast("No saved table found.");
    return;
  }
  loadTable(raw);
});

activePlayerSelect.addEventListener("change", (event) => {
  state.activeIndex = Number(event.target.value);
  render();
});

document.querySelector("#minusBlindBtn").addEventListener("click", () => {
  actionAmount.value = Math.max(0, Number(actionAmount.value || 0) - state.bigBlind);
});
document.querySelector("#plusBlindBtn").addEventListener("click", () => {
  actionAmount.value = Number(actionAmount.value || 0) + state.bigBlind;
});
document.querySelector("#betBtn").addEventListener("click", betSelected);
document.querySelector("#allInBtn").addEventListener("click", allInSelected);
document.querySelector("#checkBtn").addEventListener("click", checkSelected);
document.querySelector("#foldBtn").addEventListener("click", foldSelected);
document.querySelector("#postBlindsBtn").addEventListener("click", postBlinds);
document.querySelector("#nextStreetBtn").addEventListener("click", nextStreet);
document.querySelector("#newHandBtn").addEventListener("click", newHand);
document.querySelector("#rebuyBtn").addEventListener("click", rebuySelected);
document.querySelector("#awardBtn").addEventListener("click", awardPot);
document.querySelector("#undoBtn").addEventListener("click", undo);
document.querySelector("#saveBtn").addEventListener("click", saveTable);
document.querySelector("#exportBtn").addEventListener("click", exportTable);
document.querySelector("#resetBtn").addEventListener("click", resetTable);
document.querySelector("#importInput").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  loadTable(await file.text());
  showToast("Table imported.");
  event.target.value = "";
});

renderNameFields();
