(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.VmResults = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const WC_JSON_URL =
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

  const TEAM_EN_TO_SV = {
    Spain: "Spanien",
    France: "Frankrike",
    Brazil: "Brasilien",
    England: "England",
    Portugal: "Portugal",
    Argentina: "Argentina",
    Belgium: "Belgien",
    Germany: "Tyskland",
    Netherlands: "Nederländerna",
    Japan: "Japan",
    Senegal: "Senegal",
    USA: "USA",
    "United States": "USA",
    Norway: "Norge",
    Sweden: "Sverige",
    Switzerland: "Schweiz",
    Turkey: "Turkiet",
    Türkiye: "Turkiet",
    Mexico: "Mexiko",
    Ghana: "Ghana",
    Austria: "Österrike",
    "Ivory Coast": "Elfenbenskusten",
    "Côte d'Ivoire": "Elfenbenskusten",
    Paraguay: "Paraguay",
    Uruguay: "Uruguay",
    Morocco: "Marocko",
    Canada: "Kanada",
    Colombia: "Colombia",
    Croatia: "Kroatien",
    "South Korea": "Sydkorea",
    "Czech Republic": "Tjeckien",
    "South Africa": "Sydafrika",
    Australia: "Australien",
    Poland: "Polen",
    Egypt: "Egypten",
    Iran: "Iran",
    Ecuador: "Ecuador",
    Tunisia: "Tunisien",
    Algeria: "Algeriet",
    Jordan: "Jordanien",
    Uzbekistan: "Uzbekistan",
    Haiti: "Haiti",
    Scotland: "Skottland",
    Qatar: "Qatar",
    Panama: "Panama",
    "New Zealand": "Nya Zeeland",
    "Costa Rica": "Costa Rica",
    "Saudi Arabia": "Saudiarabien",
    Cameroon: "Kamerun",
    "DR Congo": "DR Kongo",
    Curacao: "Curaçao",
    "Curaçao": "Curaçao",
  };

  const SCORER_ALIASES = {
    mbappe: "Kylian Mbappé",
    mbappé: "Kylian Mbappé",
    kylianmbappe: "Kylian Mbappé",
    kylianmbappé: "Kylian Mbappé",
    cr7: "Cristiano Ronaldo",
    cristianoronaldo: "Cristiano Ronaldo",
    ronaldo: "Cristiano Ronaldo",
    harrykane: "Harry Kane",
    kane: "Harry Kane",
    erlinghaaland: "Erling Haaland",
    haaland: "Erling Haaland",
    jordanayew: "Jordan Ayew",
    ayew: "Jordan Ayew",
    lionelmessi: "Lionel Messi",
    messi: "Lionel Messi",
    viniciusjunior: "Vinícius Júnior",
    viníciusjúnior: "Vinícius Júnior",
    juliánquiñones: "Julián Quiñones",
    julianquinones: "Julián Quiñones",
    jonathanavid: "Jonathan David",
    matheuscunha: "Matheus Cunha",
  };

  function normalizeKey(value) {
    return (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizeScorer(value) {
    if (!value || !value.trim()) return "";
    const trimmed = value.trim().replace(/\s+/g, " ");
    const key = normalizeKey(trimmed);
    if (SCORER_ALIASES[key]) return SCORER_ALIASES[key];

    const parts = trimmed.split(" ");
    if (parts.length >= 2) {
      return parts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
        .replace(/Mc/g, "Mc")
        .replace(/Mbappé/i, "Mbappé")
        .replace(/Júnior/i, "Júnior")
        .replace(/Vinícius/i, "Vinícius");
    }

    return trimmed;
  }

  function toSwedishTeam(name) {
    if (!name) return "";
    return TEAM_EN_TO_SV[name] || name;
  }

  function parseScore(match) {
    if (!match.score?.ft) return null;
    const [a, b] = match.score.ft;
    if (a == null || b == null) return null;
    return { home: a, away: b };
  }

  function winnerLoser(match, team1, team2) {
    const score = parseScore(match);
    if (!score) return null;
    if (score.home > score.away) return { winner: team1, loser: team2 };
    if (score.away > score.home) return { winner: team2, loser: team1 };
    if (match.score?.pen) {
      const [p1, p2] = match.score.pen;
      if (p1 > p2) return { winner: team1, loser: team2 };
      if (p2 > p1) return { winner: team2, loser: team1 };
    }
    return null;
  }

  function computeGroupStandings(matches) {
    const groups = {};

    for (const match of matches) {
      if (!match.group || !match.score?.ft) continue;
      const [g1, g2] = match.score.ft;
      const t1 = match.team1;
      const t2 = match.team2;
      if (!t1 || !t2 || t1.includes("/") || t2.includes("/")) continue;

      for (const team of [t1, t2]) {
        groups[match.group] ??= {};
        groups[match.group][team] ??= { team, pts: 0, gf: 0, ga: 0, gd: 0, played: 0 };
      }

      const a = groups[match.group][t1];
      const b = groups[match.group][t2];
      a.played++;
      b.played++;
      a.gf += g1;
      a.ga += g2;
      b.gf += g2;
      b.ga += g1;
      a.gd = a.gf - a.ga;
      b.gd = b.gf - b.ga;

      if (g1 > g2) a.pts += 3;
      else if (g2 > g1) b.pts += 3;
      else {
        a.pts += 1;
        b.pts += 1;
      }
    }

    const ranked = {};
    for (const [group, teams] of Object.entries(groups)) {
      ranked[group] = Object.values(teams).sort((x, y) => {
        if (y.pts !== x.pts) return y.pts - x.pts;
        if (y.gd !== x.gd) return y.gd - x.gd;
        return y.gf - x.gf;
      });
    }
    return ranked;
  }

  function resolveToken(token, matchByNum, standings, cache = new Map()) {
    if (!token) return "";
    if (cache.has(token)) return cache.get(token);

    if (!/^[WL]?\d/.test(token) && !/^\d/.test(token)) {
      cache.set(token, token);
      return token;
    }

    if (/^3([A-L]\/){4,5}[A-L]$/.test(token)) {
      cache.set(token, "");
      return "";
    }

    const posGroup = token.match(/^(\d)([A-L])$/);
    if (posGroup) {
      const pos = Number(posGroup[1]) - 1;
      const group = posGroup[2];
      const team = standings[group]?.[pos]?.team || "";
      cache.set(token, team);
      return team;
    }

    const wlMatch = token.match(/^([WL])(\d+)$/);
    if (wlMatch) {
      const side = wlMatch[1];
      const num = Number(wlMatch[2]);
      const match = matchByNum.get(num);
      if (!match) {
        cache.set(token, "");
        return "";
      }
      const t1 = resolveToken(match.team1, matchByNum, standings, cache);
      const t2 = resolveToken(match.team2, matchByNum, standings, cache);
      const result = winnerLoser(match, t1, t2);
      const team = result ? (side === "W" ? result.winner : result.loser) : "";
      cache.set(token, team);
      return team;
    }

    cache.set(token, token);
    return token;
  }

  function buildTop8(matches, standings) {
    const matchByNum = new Map();
    for (const m of matches) {
      if (m.num != null) matchByNum.set(m.num, m);
    }

    const cache = new Map();
    const resolve = (token) => resolveToken(token, matchByNum, standings, cache);

    const final = matches.find((m) => m.round === "Final");
    const third = matches.find((m) => m.round === "Match for third place");
    const quarters = matches.filter((m) => m.round === "Quarter-final");

    const top8 = Array(8).fill("");

    if (final && parseScore(final)) {
      const t1 = resolve(final.team1);
      const t2 = resolve(final.team2);
      const result = winnerLoser(final, t1, t2);
      if (result) {
        top8[0] = toSwedishTeam(result.winner);
        top8[1] = toSwedishTeam(result.loser);
      }
    }

    if (third && parseScore(third)) {
      const t1 = resolve(third.team1);
      const t2 = resolve(third.team2);
      const result = winnerLoser(third, t1, t2);
      if (result) {
        top8[2] = toSwedishTeam(result.winner);
        top8[3] = toSwedishTeam(result.loser);
      }
    }

    const qfLosers = [];
    for (const match of quarters) {
      if (!parseScore(match)) continue;
      const t1 = resolve(match.team1);
      const t2 = resolve(match.team2);
      const result = winnerLoser(match, t1, t2);
      if (result?.loser) qfLosers.push(toSwedishTeam(result.loser));
    }

    qfLosers.slice(0, 4).forEach((team, i) => {
      if (team) top8[4 + i] = team;
    });

    return top8;
  }

  function computeTopScorer(matches) {
    const counts = new Map();

    for (const match of matches) {
      if (!match.score) continue;
      for (const side of ["goals1", "goals2"]) {
        for (const goal of match[side] || []) {
          if (goal.owngoal) continue;
          const canonical = normalizeScorer(goal.name);
          counts.set(canonical, (counts.get(canonical) || 0) + 1);
        }
      }
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return { name: "", goals: 0 };

    const [name, goals] = sorted[0];
    return { name, goals };
  }

  function getTournamentPhase(matches) {
    const final = matches.find((m) => m.round === "Final");
    if (final && parseScore(final)) return "complete";

    const quarters = matches.filter((m) => m.round === "Quarter-final");
    if (quarters.some((m) => parseScore(m))) return "knockout";

    const groupPlayed = matches.filter((m) => m.group && parseScore(m)).length;
    if (groupPlayed > 0) return "group_stage";

    return "upcoming";
  }

  function isPlaceholderTeam(team) {
    if (!team) return true;
    if (/^[WL]\d+$/.test(team)) return true;
    if (/^\d[A-L]$/.test(team)) return true;
    if (team.includes("/")) return true;
    return false;
  }

  function getEliminatedTeams(matches) {
    const eliminated = new Set();
    const standings = computeGroupStandings(matches);
    const matchByNum = new Map();
    for (const m of matches) {
      if (m.num != null) matchByNum.set(m.num, m);
    }

    const koRounds = new Set([
      "Round of 32",
      "Round of 16",
      "Quarter-final",
      "Semi-final",
      "Final",
      "Match for third place",
    ]);

    const cache = new Map();

    for (const match of matches) {
      if (!koRounds.has(match.round) || !parseScore(match)) continue;
      const t1 = resolveToken(match.team1, matchByNum, standings, cache);
      const t2 = resolveToken(match.team2, matchByNum, standings, cache);
      if (isPlaceholderTeam(t1) || isPlaceholderTeam(t2)) continue;
      const result = winnerLoser(match, t1, t2);
      if (result?.loser) eliminated.add(toSwedishTeam(result.loser));
    }

    const r32Teams = new Set();
    for (const match of matches.filter((m) => m.round === "Round of 32")) {
      for (const raw of [match.team1, match.team2]) {
        if (!isPlaceholderTeam(raw)) r32Teams.add(toSwedishTeam(raw));
        const resolved = resolveToken(raw, matchByNum, standings, new Map());
        if (!isPlaceholderTeam(resolved)) r32Teams.add(toSwedishTeam(resolved));
      }
    }

    for (const [group, teams] of Object.entries(standings)) {
      const groupMatches = matches.filter((m) => m.group === group);
      if (groupMatches.filter((m) => parseScore(m)).length < 6) continue;

      const groupInR32 = teams.some((row) => r32Teams.has(toSwedishTeam(row.team)));

      teams.forEach((row, rank) => {
        const sv = toSwedishTeam(row.team);
        if (rank === 3) eliminated.add(sv);
        if (groupInR32 && !r32Teams.has(sv)) eliminated.add(sv);
      });
    }

    return [...eliminated];
  }

  function getActiveTeams(matches) {
    const all = new Set();

    for (const match of matches) {
      for (const raw of [match.team1, match.team2]) {
        if (!isPlaceholderTeam(raw)) all.add(toSwedishTeam(raw));
      }
    }

    const eliminated = new Set(getEliminatedTeams(matches));
    return [...all].filter((team) => !eliminated.has(team));
  }

  async function fetchTournamentResults() {
    const response = await fetch(WC_JSON_URL);
    if (!response.ok) throw new Error(`Kunde inte hämta VM-data (${response.status})`);

    const data = await response.json();
    const matches = data.matches || [];
    const standings = computeGroupStandings(matches);
    const top8 = buildTop8(matches, standings);
    const scorer = computeTopScorer(matches);
    const phase = getTournamentPhase(matches);
    const filledSlots = top8.filter(Boolean).length;
    const eliminatedTeams = getEliminatedTeams(matches);
    const activeTeams = getActiveTeams(matches);

    return {
      ok: true,
      top8,
      champion: top8[0] || "",
      topScorer: scorer.name,
      topScorerGoals: scorer.goals,
      eliminatedTeams,
      activeTeams,
      phase,
      filledSlots,
      updatedAt: new Date().toISOString(),
      source: "openfootball/worldcup.json",
    };
  }

  return {
    WC_JSON_URL,
    normalizeScorer,
    getEliminatedTeams,
    getActiveTeams,
    fetchTournamentResults,
  };
});
