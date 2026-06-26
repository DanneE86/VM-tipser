const STAKE = 100;

const PARTICIPANTS = [
  {
    name: "William",
    top4: ["Spanien", "Frankrike", "Brasilien", "England"],
    quarter: ["Portugal", "Argentina", "Belgien", "Tyskland"],
    scorer: "Kylian Mbappé",
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
    scorer: "Kylian Mbappé",
  },
  {
    name: "Martin",
    top4: ["Portugal", "Frankrike", "Spanien", "Nederländerna"],
    quarter: ["Japan", "Turkiet", "Mexiko", "Argentina"],
    scorer: "Cristiano Ronaldo",
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

const POSITION_POINTS = [20, 10, 10, 5];

const STORAGE_KEY = "vm-tipset-results-v2";
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
  return VmResults.normalizeScorer(value);
}

function displayScorer(value) {
  return normalizeScorer(value);
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
      eliminatedTeams: data.eliminatedTeams || [],
      activeTeams: data.activeTeams || [],
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
    eliminatedTeams: [],
    activeTeams: [],
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
    eliminatedTeams: data.eliminatedTeams ?? current.eliminatedTeams ?? [],
    activeTeams: data.activeTeams ?? current.activeTeams ?? [],
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
    let data;

    try {
      const endpoint = force ? "/api/refresh" : "/api/results";
      const response = await fetch(endpoint);
      data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "API fel");
    } catch {
      data = await VmResults.fetchTournamentResults();
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
    setSyncStatus("error", error.message || "Kunde inte hämta resultat");
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
  const top4Slots = [];
  const quarterSlots = [];

  participant.top4.forEach((team, index) => {
    const predicted = normalizeTeam(team);
    if (!predicted) return;

    let slotPoints = 0;
    const actualIndex = actualNormalized.indexOf(predicted);

    if (actualIndex === -1) {
      breakdown.push({ team: predicted, points: 0, label: `${index + 1}: ${predicted}`, type: "miss" });
    } else if (actualIndex === index) {
      slotPoints = pointsForPosition(index);
      points += slotPoints;
      scoredTeams.add(predicted);
      breakdown.push({
        team: predicted,
        points: slotPoints,
        label: `${index + 1}: ${predicted} (${slotPoints} p)`,
        type: "exact",
      });
    } else {
      slotPoints = 5;
      points += slotPoints;
      scoredTeams.add(predicted);
      breakdown.push({
        team: predicted,
        points: 5,
        label: `${index + 1}: ${predicted} (fel plats, 5 p)`,
        type: "wrong",
      });
    }

    top4Slots.push({ team, points: slotPoints, index });
  });

  participant.quarter.forEach((team) => {
    const predicted = normalizeTeam(team);
    if (!predicted) return;

    let slotPoints = 0;

    if (!scoredTeams.has(predicted) && actualNormalized.includes(predicted)) {
      slotPoints = 5;
      points += slotPoints;
      scoredTeams.add(predicted);
      breakdown.push({
        team: predicted,
        points: 5,
        label: `Kvart: ${predicted} (5 p)`,
        type: "quarter",
      });
    } else if (!scoredTeams.has(predicted)) {
      breakdown.push({ team: predicted, points: 0, label: `Kvart: ${predicted}`, type: "miss" });
    }

    quarterSlots.push({ team, points: slotPoints });
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
    top4Slots,
    quarterSlots,
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

function getEliminatedSet(results) {
  return new Set((results.eliminatedTeams || []).map((t) => normalizeTeam(t)));
}

function getActiveSet(results) {
  return new Set((results.activeTeams || []).map((t) => normalizeTeam(t)));
}

function renderTeamTag(team, points, eliminatedSet, activeSet, position, options = {}) {
  const { coveredPoints = 0 } = options;
  const normalized = normalizeTeam(team);
  const effectivePoints = points > 0 ? points : coveredPoints;
  const hasSyncData = activeSet.size > 0 || eliminatedSet.size > 0;
  const isEliminated = eliminatedSet.has(normalized);
  const isStillIn = !isEliminated && (activeSet.has(normalized) || !hasSyncData);

  let cls = "team-tag";
  let liveIcon = "";

  if (effectivePoints > 0) {
    cls += " team-tag--scored";
  } else if (isEliminated) {
    cls += " team-tag--out";
  } else if (isStillIn) {
    cls += " team-tag--alive";
    liveIcon = `<span class="team-tag-live" title="Fortfarande kvar i turneringen" aria-label="Kvar i turneringen"></span>`;
  }

  const posHtml = position != null ? `<span class="pos">${position + 1}</span>` : "";
  const ptsHtml =
    points > 0
      ? `<span class="team-tag-pts">+${points} p</span>`
      : coveredPoints > 0
        ? `<span class="team-tag-pts">+${coveredPoints} p</span>`
        : isEliminated
          ? `<span class="team-tag-pts team-tag-pts--zero">0 p</span>`
          : "";

  return `<span class="${cls}">${liveIcon}${posHtml}<span class="team-tag-name">${team}</span>${ptsHtml}</span>`;
}

function countTeamsRemaining(participant, eliminatedSet, activeSet) {
  const hasSyncData = activeSet.size > 0 || eliminatedSet.size > 0;
  const teams = new Set();

  [...participant.top4, ...participant.quarter].forEach((team) => {
    const normalized = normalizeTeam(team);
    if (normalized) teams.add(normalized);
  });

  let remaining = 0;
  for (const team of teams) {
    const isEliminated = eliminatedSet.has(team);
    const isStillIn = !isEliminated && (activeSet.has(team) || !hasSyncData);
    if (isStillIn) remaining++;
  }

  return { total: teams.size, remaining };
}

function buildParticipantOverviewHtml(scored, eliminatedSet, activeSet) {
  if (!scored.length) {
    return `<p class="rules-loading">Inga deltagare hittades.</p>`;
  }

  return scored
    .map((p, i) => {
      const { remaining, total } = countTeamsRemaining(p, eliminatedSet, activeSet);
      return `
        <div class="rules-standing-row">
          <div class="rules-standing-left">
            <span class="rules-standing-rank">${i + 1}</span>
            <span class="rules-standing-name">${p.name}</span>
          </div>
          <div class="rules-standing-right">
            <span class="rules-standing-teams">${remaining} av ${total} lag kvar</span>
            <span class="rules-standing-points">${p.points} poäng</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderParticipantOverview(scored, eliminatedSet, activeSet) {
  const html = buildParticipantOverviewHtml(scored, eliminatedSet, activeSet);
  ["participant-overview", "rules-standings"].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.innerHTML = html;
  });
}

function formatPoints(points) {
  return `${points} p`;
}

function render() {
  const results = loadResults();
  const actualTop8 = getActualTop8(results);
  const hasTop8 = actualTop8.length > 0;
  const hasScorer = Boolean(normalizeScorer(results.topScorer));
  const eliminatedSet = getEliminatedSet(results);
  const activeSet = getActiveSet(results);

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
      const { remaining, total } = countTeamsRemaining(p, eliminatedSet, activeSet);
      const chips = p.breakdown
        .filter((b) => b.points > 0)
        .map((b) => `<span class="point-chip">${b.label}</span>`)
        .join("");

      const tieMeta = [
        `${remaining} av ${total} lag kvar`,
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

  renderParticipantOverview(scored, eliminatedSet, activeSet);

  const tipsGrid = document.getElementById("tips-grid");
  tipsGrid.innerHTML = scored
    .map((p, i) => {
    const top4PointsByTeam = new Map(
      p.top4Slots.map((slot) => [normalizeTeam(slot.team), slot.points])
    );

    const top4Tags = p.top4Slots
      .map((slot) => renderTeamTag(slot.team, slot.points, eliminatedSet, activeSet, slot.index))
      .join("");

    const quarterTags = p.quarterSlots
      .map((slot) => {
        const coveredPoints = top4PointsByTeam.get(normalizeTeam(slot.team)) || 0;
        return renderTeamTag(slot.team, slot.points, eliminatedSet, activeSet, null, { coveredPoints });
      })
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
          <p class="scorer-name ${scorerHit}">${displayScorer(p.scorer)}</p>
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

  if (topScorer !== document.activeElement) topScorer.value = displayScorer(results.topScorer);
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

function setupPublicLink() {
  const link = document.getElementById("public-url");
  if (!link) return;

  const url = window.location.origin + window.location.pathname.replace(/\/$/, "") + "/";
  const publicUrl =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "https://dannee86.github.io/VM-tipser/"
      : url;

  link.href = publicUrl;
  link.textContent = publicUrl;
}

bindAdmin();
setupAutoSync();
setupPublicLink();
render();
fetchLiveResults(false);
