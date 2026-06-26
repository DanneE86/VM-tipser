const STAKE = 100;

const PARTICIPANTS = [
  {
    name: "William",
    top4: ["Spanien", "Frankrike", "Brasilien", "England"],
    quarter: ["Portugal", "Argentina", "Belgien", "Tyskland"],
    scorer: "Mbappé",
  },
  {
    name: "Daniel",
    top4: ["Spanien", "England", "Brasilien", "Frankrike"],
    quarter: ["Belgien", "Japan", "Tyskland", "Senegal"],
    scorer: "Kylian Mbappé",
  },
  {
    name: "Kristian",
    top4: ["England", "Brasilien", "Tyskland", "USA"],
    quarter: ["Belgien", "Holland", "Spanien", "Argentina"],
    scorer: "Harry Kane",
  },
  {
    name: "Richard",
    top4: ["Frankrike", "Spanien", "Argentina", "England"],
    quarter: ["Portugal", "Tyskland", "Brasilien", "Nederländerna"],
    scorer: "Mbappé",
  },
  {
    name: "Martin",
    top4: ["Portugal", "Frankrike", "Spanien", "Nederländerna"],
    quarter: ["Japan", "Turkiet", "Mexiko", "Argentina"],
    scorer: "CR7",
  },
  {
    name: "Jonny",
    top4: ["Spanien", "Tyskland", "Frankrike", "Brasilien"],
    quarter: ["Norge", "Belgien", "USA", "England"],
    scorer: "Erling Haaland",
  },
  {
    name: "Ljudmila",
    top4: ["Japan", "Schweiz", "Ghana", "Österrike"],
    quarter: ["Paraguay", "Elfenbenskusten", "Uruguay", "Frankrike"],
    scorer: "Jordan Ayew",
  },
  {
    name: "Hans",
    top4: ["USA", "Tyskland", "Sverige", "Japan"],
    quarter: ["Norge", "Frankrike", "Brasilien", "Schweiz"],
    scorer: "Erling Haaland",
  },
];

const TEAM_ALIASES = {
  usa: "USA",
  "u.s.a.": "USA",
  "u.s.a": "USA",
  holland: "Nederländerna",
  nederland: "Nederländerna",
  "nederländerna": "Nederländerna",
  netherlands: "Nederländerna",
  elfenbenskusten: "Elfenbenskusten",
  "côte d'ivoire": "Elfenbenskusten",
  "cote d'ivoire": "Elfenbenskusten",
  ivorycoast: "Elfenbenskusten",
  osterrike: "Österrike",
  "österrike": "Österrike",
  austria: "Österrike",
  schweiz: "Schweiz",
  switzerland: "Schweiz",
  tyskland: "Tyskland",
  germany: "Tyskland",
  england: "England",
  spanien: "Spanien",
  spain: "Spanien",
  frankrike: "Frankrike",
  france: "Frankrike",
  brasilien: "Brasilien",
  brazil: "Brasilien",
  portugal: "Portugal",
  argentina: "Argentina",
  belgien: "Belgien",
  belgium: "Belgien",
  japan: "Japan",
  senegal: "Senegal",
  norge: "Norge",
  norway: "Norge",
  sverige: "Sverige",
  sweden: "Sverige",
  mexiko: "Mexiko",
  mexico: "Mexiko",
  turkiet: "Turkiet",
  turkey: "Turkiet",
  turkiye: "Turkiet",
  ghana: "Ghana",
  paraguay: "Paraguay",
  uruguay: "Uruguay",
};

const SCORER_ALIASES = {
  mbappe: "Kylian Mbappé",
  "mbappé": "Kylian Mbappé",
  "kylian mbappe": "Kylian Mbappé",
  "kylian mbappé": "Kylian Mbappé",
  cr7: "Cristiano Ronaldo",
  "cristiano ronaldo": "Cristiano Ronaldo",
  "harry kane": "Harry Kane",
  kane: "Harry Kane",
  "erling haaland": "Erling Haaland",
  haaland: "Erling Haaland",
  "jordan ayew": "Jordan Ayew",
  ayew: "Jordan Ayew",
};

const POSITION_POINTS = [20, 10, 10, 5];

const STORAGE_KEY = "vm-tipset-results-v1";
const AUTO_SYNC_KEY = "vm-tipset-auto-sync";
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

let syncTimer = null;
let isSyncing = false;

function normalizeKey(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeTeam(value) {
  if (!value || !value.trim()) return "";
  const key = normalizeKey(value);
  return TEAM_ALIASES[key] || value.trim().replace(/\s+/g, " ");
}

function normalizeScorer(value) {
  if (!value || !value.trim()) return "";
  const key = normalizeKey(value);
  return SCORER_ALIASES[key] || value.trim().replace(/\s+/g, " ");
}

function loadResults() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultResults();
    const data = JSON.parse(raw);
    return {
      top8: Array.from({ length: 8 }, (_, i) => data.top8?.[i] || ""),
      topScorer: data.topScorer || "",
      topScorerGoals: data.topScorerGoals ?? "",
      champion: data.champion || "",
    };
  } catch {
    return defaultResults();
  }
}

function defaultResults() {
  return {
    top8: Array(8).fill(""),
    topScorer: "",
    topScorerGoals: "",
    champion: "",
  };
}

function saveResults(results) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
}

function isAutoSyncEnabled() {
  const stored = localStorage.getItem(AUTO_SYNC_KEY);
  return stored !== "false";
}

function setAutoSyncEnabled(enabled) {
  localStorage.setItem(AUTO_SYNC_KEY, enabled ? "true" : "false");
}

function phaseLabel(phase, filledSlots) {
  if (phase === "complete") return "Turneringen avslutad";
  if (phase === "knockout") return `Slutspel · ${filledSlots}/8 platser klara`;
  if (phase === "group_stage") return "Gruppspel pågår";
  return "Turneringen har inte börjat";
}

function setSyncStatus(state, text) {
  const dot = document.getElementById("sync-dot");
  const label = document.getElementById("sync-text");
  dot.className = `sync-dot ${state}`;
  label.textContent = text;
}

function applyFetchedResults(data) {
  const current = loadResults();
  const merged = {
    top8: Array.from({ length: 8 }, (_, i) => data.top8?.[i] || current.top8[i] || ""),
    topScorer: data.topScorer || current.topScorer || "",
    topScorerGoals: data.topScorerGoals ?? current.topScorerGoals ?? "",
    champion: data.champion || current.champion || "",
    lastSyncedAt: data.updatedAt,
    phase: data.phase,
  };
  saveResults(merged);
  return merged;
}

async function fetchLiveResults(force = false) {
  if (isSyncing) return null;
  isSyncing = true;

  const btn = document.getElementById("sync-now");
  if (btn) btn.disabled = true;
  setSyncStatus("loading", "Hämtar resultat…");

  try {
    const endpoint = force ? "/api/refresh" : "/api/results";
    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Kunde inte hämta resultat");
    }

    applyFetchedResults(data);

    const updated = new Date(data.updatedAt);
    const time = updated.toLocaleString("sv-SE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    setSyncStatus("live", `Uppdaterad ${time} · ${phaseLabel(data.phase, data.filledSlots)}`);
    render();
    return data;
  } catch (error) {
    const manual = loadResults().lastSyncedAt;
    const fallback = manual
      ? "Server ej tillgänglig — kör npm start för automatisk hämtning"
      : "Öppna via npm start (localhost:8765) för automatisk hämtning";
    setSyncStatus("error", error.message.includes("fetch") ? fallback : error.message);
    return null;
  } finally {
    isSyncing = false;
    if (btn) btn.disabled = false;
  }
}

function setupAutoSync() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;

  const checkbox = document.getElementById("auto-sync");
  if (checkbox) checkbox.checked = isAutoSyncEnabled();

  if (!isAutoSyncEnabled()) return;

  syncTimer = setInterval(() => {
    fetchLiveResults(false);
  }, SYNC_INTERVAL_MS);
}

function getActualTop8(results) {
  return results.top8.map(normalizeTeam).filter(Boolean);
}

function pointsForPosition(index) {
  if (index === 0) return 20;
  if (index <= 2) return 10;
  return 5;
}

function scoreParticipant(participant, results) {
  const actualTop8 = getActualTop8(results);
  const actualNormalized = actualTop8.map(normalizeTeam);
  const breakdown = [];
  let points = 0;
  const scoredTeams = new Set();

  participant.top4.forEach((team, index) => {
    const predicted = normalizeTeam(team);
    if (!predicted) return;

    const actualIndex = actualNormalized.indexOf(predicted);
    if (actualIndex === -1) {
      breakdown.push({ team: predicted, points: 0, label: `${index + 1}: ${predicted}`, type: "miss" });
      return;
    }

    if (actualIndex === index) {
      const pts = pointsForPosition(index);
      points += pts;
      scoredTeams.add(predicted);
      breakdown.push({
        team: predicted,
        points: pts,
        label: `${index + 1}: ${predicted} (${pts} p)`,
        type: "exact",
      });
    } else {
      points += 5;
      scoredTeams.add(predicted);
      breakdown.push({
        team: predicted,
        points: 5,
        label: `${index + 1}: ${predicted} (fel plats, 5 p)`,
        type: "wrong",
      });
    }
  });

  participant.quarter.forEach((team) => {
    const predicted = normalizeTeam(team);
    if (!predicted || scoredTeams.has(predicted)) return;

    if (actualNormalized.includes(predicted)) {
      points += 5;
      scoredTeams.add(predicted);
      breakdown.push({
        team: predicted,
        points: 5,
        label: `Kvart: ${predicted} (5 p)`,
        type: "quarter",
      });
    } else {
      breakdown.push({ team: predicted, points: 0, label: `Kvart: ${predicted}`, type: "miss" });
    }
  });

  const champion = normalizeTeam(results.champion);
  const predictedChampion = normalizeTeam(participant.top4[0]);
  const championCorrect = champion && predictedChampion === champion;

  const actualScorer = normalizeScorer(results.topScorer);
  const predictedScorer = normalizeScorer(participant.scorer);
  const scorerCorrect = actualScorer && predictedScorer === actualScorer;

  const top8Hits = [...scoredTeams].filter((t) => actualNormalized.includes(t)).length;

  return {
    points,
    breakdown,
    championCorrect,
    scorerCorrect,
    top8Hits,
    predictedScorer,
    actualScorer,
  };
}

function compareParticipants(a, b, results) {
  if (b.points !== a.points) return b.points - a.points;

  const actualScorer = normalizeScorer(results.topScorer);
  const aScorer = a.scorerCorrect && actualScorer === a.predictedScorer;
  const bScorer = b.scorerCorrect && actualScorer === b.predictedScorer;
  if (aScorer !== bScorer) return bScorer - aScorer;

  if (a.championCorrect !== b.championCorrect) return b.championCorrect - a.championCorrect;

  return b.top8Hits - a.top8Hits;
}

function allTeams() {
  const teams = new Set();
  PARTICIPANTS.forEach((p) => {
    [...p.top4, ...p.quarter].forEach((t) => teams.add(normalizeTeam(t)));
  });
  return [...teams].sort((a, b) => a.localeCompare(b, "sv"));
}

function allScorers() {
  const scorers = new Set();
  PARTICIPANTS.forEach((p) => scorers.add(normalizeScorer(p.scorer)));
  return [...scorers].sort((a, b) => a.localeCompare(b, "sv"));
}

function teamHitClass(team, slot, actualTop8, type) {
  if (!actualTop8.length) return "";
  const predicted = normalizeTeam(team);
  const actualNormalized = actualTop8.map(normalizeTeam);
  const idx = actualNormalized.indexOf(predicted);
  if (idx === -1) return "miss";

  if (type === "top4" && idx === slot) return "hit-exact";
  if (type === "top4" && idx !== slot) return "hit-wrong";
  if (type === "quarter" && idx >= 0) return "hit-exact";
  return "";
}

function formatPoints(points) {
  return `${points} p`;
}

function render() {
  const results = loadResults();
  const actualTop8 = getActualTop8(results);
  const hasTop8 = actualTop8.length > 0;
  const hasScorer = Boolean(normalizeScorer(results.topScorer));

  document.getElementById("pot-amount").textContent = `${PARTICIPANTS.length * STAKE} kr`;
  document.getElementById("pot-meta").textContent = `${PARTICIPANTS.length} deltagare`;

  const scored = PARTICIPANTS.map((p) => ({
    ...p,
    ...scoreParticipant(p, results),
  })).sort((a, b) => compareParticipants(a, b, results));

  const leader = scored[0];
  const leaderNote = hasTop8 && leader.points > 0
    ? `Ledare: ${leader.name} med ${formatPoints(leader.points)}`
    : hasScorer
      ? "Poäng räknas när slutspelsplatserna fylls i"
      : "Väntar på resultat från turneringen";

  const leaderboard = document.getElementById("leaderboard-list");
  leaderboard.innerHTML = `
    <p class="leader-note">${leaderNote}</p>
    ${scored
    .map((p, i) => {
      const isLeader = hasTop8 && i === 0 && p.points > 0;
      const chips = p.breakdown
        .filter((b) => b.points > 0)
        .map((b) => `<span class="point-chip">${b.label}</span>`)
        .join("");

      const tieMeta = [
        hasTop8 ? `${p.top8Hits} lag i topp 8` : null,
        p.scorerCorrect ? "rätt skytteliga" : null,
        p.championCorrect ? "rätt VM-vinnare" : null,
      ]
        .filter(Boolean)
        .join(" · ") || (hasTop8 ? "Inga rätta placeringar än" : "Slutspel ej avgjort");

      return `
        <div class="lb-row${isLeader ? " leader" : ""}">
          <span class="lb-rank">${i + 1}</span>
          <div>
            <div class="lb-name">${p.name}</div>
            <div class="lb-meta">${tieMeta}</div>
            ${chips ? `<div class="lb-breakdown">${chips}</div>` : ""}
          </div>
          <div class="lb-score">
            <span class="lb-points">${p.points}</span>
            <span class="lb-points-label">poäng</span>
          </div>
        </div>
      `;
    })
    .join("")}
  `;

  const tipsGrid = document.getElementById("tips-grid");
  tipsGrid.innerHTML = scored
    .map((p, i) => {
    const top4Tags = p.top4
      .map(
        (t, pos) =>
          `<span class="team-tag ${teamHitClass(t, pos, actualTop8, "top4")}"><span class="pos">${pos + 1}</span>${t}</span>`
      )
      .join("");

    const quarterTags = p.quarter
      .map((t) => `<span class="team-tag ${teamHitClass(t, -1, actualTop8, "quarter")}">${t}</span>`)
      .join("");

    const scorerHit =
      hasScorer && normalizeScorer(p.scorer) === normalizeScorer(results.topScorer) ? "hit" : "";

    const pointChips = p.breakdown
      .filter((b) => b.points > 0)
      .map((b) => `<span class="point-chip">${b.label}</span>`)
      .join("");

    return `
      <article class="tip-card">
        <div class="tip-card-head">
          <h3>${p.name}</h3>
          <div class="tip-score">
            <span class="tip-score-value">${p.points}</span>
            <span class="tip-score-label">poäng</span>
            <span class="tip-rank">#${i + 1}</span>
          </div>
        </div>
        ${pointChips ? `<div class="lb-breakdown tip-breakdown">${pointChips}</div>` : ""}
        <div class="tip-section">
          <div class="tip-label">Topp 4</div>
          <div class="tip-teams">${top4Tags}</div>
        </div>
        <div class="tip-section">
          <div class="tip-label">Kvartsfinal</div>
          <div class="tip-teams">${quarterTags}</div>
        </div>
        <div class="tip-section">
          <div class="tip-label">Skytteliga</div>
          <span class="scorer-tag ${scorerHit}">${p.scorer}</span>
        </div>
      </article>
    `;
  }).join("");

  const teamList = document.getElementById("team-list");
  teamList.innerHTML = allTeams().map((t) => `<option value="${t}">`).join("");

  const playerList = document.getElementById("player-list");
  playerList.innerHTML = allScorers().map((s) => `<option value="${s}">`).join("");

  const slots = document.getElementById("result-slots");
  if (!slots.dataset.built) {
    slots.innerHTML = Array.from({ length: 8 }, (_, i) => {
      const label = i < 4 ? `${i + 1}:a` : `Kvart ${i - 3}`;
      return `
        <div class="result-slot">
          <span class="slot-pos">${label}</span>
          <input type="text" data-slot="${i}" list="team-list" placeholder="Lag">
        </div>
      `;
    }).join("");
    slots.dataset.built = "1";

    slots.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => {
        const r = readFormResults();
        saveResults(r);
        render();
      });
    });
  }

  results.top8.forEach((val, i) => {
    const input = slots.querySelector(`[data-slot="${i}"]`);
    if (input && input !== document.activeElement) input.value = val;
  });

  const topScorer = document.getElementById("top-scorer");
  const topScorerGoals = document.getElementById("top-scorer-goals");
  const champion = document.getElementById("champion");

  if (topScorer !== document.activeElement) topScorer.value = results.topScorer;
  if (topScorerGoals !== document.activeElement) topScorerGoals.value = results.topScorerGoals;
  if (champion !== document.activeElement) champion.value = results.champion;
}

function readFormResults() {
  const slots = document.getElementById("result-slots");
  const top8 = Array.from({ length: 8 }, (_, i) => {
    const input = slots.querySelector(`[data-slot="${i}"]`);
    return input ? input.value : "";
  });

  return {
    top8,
    topScorer: document.getElementById("top-scorer").value,
    topScorerGoals: document.getElementById("top-scorer-goals").value,
    champion: document.getElementById("champion").value,
  };
}

function bindAdmin() {
  ["top-scorer", "top-scorer-goals", "champion"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      saveResults(readFormResults());
      render();
    });
  });

  document.getElementById("reset-results").addEventListener("click", () => {
    if (!confirm("Återställa alla resultat? Tipsen behålls.")) return;
    saveResults(defaultResults());
    render();
  });

  document.getElementById("sync-now").addEventListener("click", () => {
    fetchLiveResults(true);
  });

  document.getElementById("auto-sync").addEventListener("change", (event) => {
    setAutoSyncEnabled(event.target.checked);
    setupAutoSync();
    if (event.target.checked) fetchLiveResults(true);
  });
}

bindAdmin();
setupAutoSync();
render();
fetchLiveResults(false);
