/* Shared rules for live play and imported scorebooks. */
(() => {
  "use strict";

  const KEY = "nba2k.series-scorebook.v1";
  const VERSION = 4;
  const FORMATS = [3, 5, 7];
  const OPENER = Object.freeze({
    reportId: "2026-11-26-g01",
    players: ["jesse", "Buerchener"],
    teams: ["火箭", "湖人"],
    scores: [99, 109],
    // Time the result was entered for publication; the screenshots have no game clock/date.
    recordedAt: "2026-11-26T15:02:04.000Z"
  });

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function playerNames(players) {
    if (!Array.isArray(players) || players.length !== 2) {
      throw new Error("请填写双方昵称。");
    }
    return Array.from(players, name => {
      if (typeof name !== "string" || !name.trim()) {
        throw new Error("双方昵称都不能为空。");
      }
      return name.trim();
    });
  }

  function format(bestOf) {
    const value = typeof bestOf === "string" && /^[357]$/.test(bestOf) ? Number(bestOf) : bestOf;
    if (!FORMATS.includes(value)) throw new Error("请选择 BO3、BO5 或 BO7。");
    return value;
  }

  function score(value) {
    const number = typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : value;
    if (!Number.isSafeInteger(number) || number < 0) {
      throw new Error("请为双方各填一个非负整数比分。");
    }
    return number;
  }

  function scorePair(a, b) {
    const scores = [score(a), score(b)];
    if (scores[0] === scores[1]) throw new Error("平局请先打加时，再录入最终比分。");
    return scores;
  }

  function validatedTeams(teams) {
    if (!Array.isArray(teams) || teams.length !== 2 || !Array.from(teams).every(team => typeof team === "string")) {
      throw new Error("请按红方、蓝方顺序填写两支球队，未选球队可以留空。");
    }
    return teams.map(team => team.trim());
  }

  function validatedSchedule(schedule, bestOf) {
    if (schedule === undefined) return {};
    if (!isObject(schedule)) throw new Error("备份中的球队安排无效。");
    const result = {};
    for (const [key, value] of Object.entries(schedule)) {
      if (!/^[0-6]$/.test(key) || Number(key) >= bestOf) throw new Error("备份中的球队场次超出赛程。");
      const teams = validatedTeams(value);
      if (teams.some(Boolean)) result[key] = teams;
    }
    return result;
  }

  function gameTeams(series, gameIndex) {
    if (!Number.isInteger(gameIndex) || gameIndex < 0 || gameIndex >= series.bestOf) return ["", ""];
    return series.teamsByGame?.[gameIndex]?.slice() ?? ["", ""];
  }

  function setGameTeams(state, gameIndex, teams) {
    const current = state.active;
    if (!Number.isInteger(gameIndex) || gameIndex < 0 || gameIndex >= current.bestOf ||
        gameIndex > current.games.length || (gameIndex === current.games.length && stats(current).champion !== null)) {
      throw new Error("请选择本轮已打的场次或即将开始的一场。");
    }
    const pair = validatedTeams(teams);
    const teamsByGame = {...current.teamsByGame};
    if (pair.some(Boolean)) teamsByGame[gameIndex] = pair;
    else delete teamsByGame[gameIndex];
    return {...state, active:{...current, teamsByGame}};
  }

  function newSeries(players, bestOf, teamsByGame = {}) {
    const id = globalThis.crypto?.randomUUID?.() ||
      Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    return {
      id,
      players: playerNames(players),
      bestOf: format(bestOf),
      teamsByGame,
      games: [],
      homeRoll: null,
      startedAt: new Date().toISOString()
    };
  }

  function samePair(a, b) {
    return a[0] === b[0] && a[1] === b[1];
  }

  function openerMatchup(series) {
    return series.bestOf === 7 &&
      series.players.every((name, side) => name.toLowerCase() === OPENER.players[side].toLowerCase()) &&
      samePair(gameTeams(series, 0), OPENER.teams);
  }

  function openerResult(game) {
    return game && gameHomeSide(game) === 0 && samePair(game.scores, OPENER.scores);
  }

  function isPublishedOpener(series, gameIndex) {
    if (gameIndex !== 0 || series.games[0]?.reportId !== OPENER.reportId) return false;
    return openerMatchup(series) && openerResult(series.games[0]);
  }

  function canApplyPublishedOpener(state) {
    const series = state.active;
    return !state.history.length && !series.games.length && openerMatchup(series) &&
      (!series.homeRoll || rolledSide(series.homeRoll) === 0);
  }

  function applyPublishedOpener(state) {
    if (!canApplyPublishedOpener(state)) throw new Error("这一轮的赛程与已公布的首场比赛不符。");
    const series = state.active;
    const game = {scores: [...OPENER.scores], playedAt: OPENER.recordedAt, homeSide: 0,
      homeRoll: series.homeRoll, reportId: OPENER.reportId};
    return {...state, active: {...series, games: [game], homeRoll: null}};
  }

  function create(players, bestOf = 7) {
    if (players !== undefined) return {version: VERSION, active: newSeries(players, bestOf), history: []};
    const active = newSeries(OPENER.players, bestOf, {0:[...OPENER.teams]});
    if (active.bestOf === 7) active.startedAt = OPENER.recordedAt;
    const state = {version: VERSION, active, history: []};
    return canApplyPublishedOpener(state) ? applyPublishedOpener(state) : state;
  }

  function gameWinner(scores) {
    return scores[0] > scores[1] ? 0 : 1;
  }

  function stats(series) {
    const target = (series.bestOf + 1) / 2;
    const wins = [0, 0];
    for (const game of series.games) wins[gameWinner(game.scores)] += 1;
    const winner = wins.findIndex(count => count >= target);
    return { wins, target, champion: winner === -1 ? null : winner };
  }

  function configure(state, players, bestOf) {
    const current = state.active;
    const value = format(bestOf);
    if (current.games.length && value !== current.bestOf) {
      throw new Error("本轮已有比分，重置本轮后可以更改赛制。");
    }
    const teamsByGame = Object.fromEntries(Object.entries(current.teamsByGame ?? {}).filter(([index]) => Number(index) < value));
    return { ...state, active: { ...current, players: playerNames(players), bestOf: value, teamsByGame } };
  }

  function rollDie() {
    const random = globalThis.crypto;
    if (!random?.getRandomValues) throw new Error("此浏览器无法掷骰，请使用支持随机数生成的浏览器。");
    const byte = new Uint8Array(1);
    // Discard four values so each die face has exactly 42 possible bytes.
    do { random.getRandomValues(byte); } while (byte[0] >= 252);
    return 1 + byte[0] % 6;
  }

  function rolledSide(roll) {
    return !roll || roll.dice[0] === roll.dice[1] ? null : gameWinner(roll.dice);
  }

  function gameHomeSide(game) {
    return game?.homeSide ?? 0;
  }

  function homeSide(series) {
    return rolledSide(series.homeRoll) ?? gameHomeSide(series.games[series.games.length - 1]);
  }

  function rollHome(state) {
    const current = state.active;
    if (stats(current).champion !== null) throw new Error("本轮已决出冠军。");
    if (rolledSide(current.homeRoll) !== null) throw new Error("本场的主场已经确定。");
    const dice = [rollDie(), rollDie()];
    return { ...state, active: { ...current, homeRoll: { dice } } };
  }

  function record(state, a, b) {
    const current = state.active;
    if (stats(current).champion !== null) throw new Error("本轮已决出冠军。");
    if (current.homeRoll && rolledSide(current.homeRoll) === null) {
      throw new Error("双方掷出相同点数，请重新掷骰确定主场。");
    }
    // Scores and dice use the original player order throughout the series.
    const game = { scores: scorePair(a, b), playedAt: new Date().toISOString(),
      homeSide: homeSide(current), homeRoll: current.homeRoll ?? null };
    return { ...state, active: { ...current, games: [...current.games, game], homeRoll: null } };
  }

  function undo(state) {
    const current = state.active;
    if (!current.games.length) throw new Error("本轮还没有可以撤销的比分。");
    const lastGame = current.games[current.games.length - 1];
    return { ...state, active: { ...current, games: current.games.slice(0, -1), homeRoll: lastGame.homeRoll ?? null } };
  }

  function reset(state) {
    const current = state.active;
    const opener = gameTeams(current, 0);
    return { ...state, active: newSeries(current.players, current.bestOf, opener.some(Boolean) ? {0:opener} : {}) };
  }

  function completed(state) {
    return stats(state.active).champion === null
      ? [...state.history]
      : [state.active, ...state.history];
  }

  function next(state, players = state.active.players, bestOf = state.active.bestOf) {
    if (state.active.games.length && stats(state.active).champion === null) {
      throw new Error("本轮尚未结束。要放弃比分，请先重置本轮。");
    }
    return { version: VERSION, active: newSeries(players, bestOf), history: completed(state) };
  }

  function timestamp(value) {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString() !== value) {
      throw new Error("备份中的比赛时间无效。");
    }
    return value;
  }

  function validateRoll(value) {
    if (value == null) return null;
    const dice = value.dice;
    if (!isObject(value) || !Array.isArray(dice) || dice.length !== 2 ||
        !Array.from(dice).every(n => Number.isInteger(n) && n >= 1 && n <= 6)) {
      throw new Error("备份中的主场掷骰记录无效。");
    }
    return { dice: dice.slice() };
  }

  function validateSeries(value, archived) {
    if (!isObject(value) || typeof value.id !== "string" || !value.id.trim() ||
        !FORMATS.includes(value.bestOf) || !Array.isArray(value.games) ||
        value.games.length > value.bestOf) {
      throw new Error("备份中的系列赛记录无效。");
    }
    const players = playerNames(value.players);
    const startedAt = timestamp(value.startedAt);
    const homeRoll = validateRoll(value.homeRoll);
    const wins = [0, 0];
    const target = (value.bestOf + 1) / 2;
    let previousHome = 0;
    const games = value.games.map(game => {
      if (wins.includes(target)) throw new Error("备份中包含决出冠军之后的多余场次。");
      if (!isObject(game) || !Array.isArray(game.scores) || game.scores.length !== 2 ||
          !game.scores.every(Number.isSafeInteger)) {
        throw new Error("备份中的单场比分无效。");
      }
      const scores = scorePair(...game.scores);
      wins[gameWinner(scores)] += 1;
      const roll = validateRoll(game.homeRoll);
      const winner = rolledSide(roll);
      if (roll && winner === null) throw new Error("已完赛场次仍包含平局掷骰记录。");
      const side = winner ?? previousHome;
      if (game.homeSide !== undefined && game.homeSide !== side) {
        throw new Error("备份中的主场归属和掷骰记录不一致。");
      }
      previousHome = side;
      const validated = {scores, playedAt: timestamp(game.playedAt), homeSide: side, homeRoll: roll};
      if (game.reportId === OPENER.reportId) validated.reportId = OPENER.reportId;
      return validated;
    });
    if (archived && !wins.includes(target)) throw new Error("历史系列赛缺少决胜场次。");
    if (homeRoll && wins.includes(target)) throw new Error("已结束的系列赛包含多余的待赛掷骰记录。");
    const teamsByGame = validatedSchedule(value.teamsByGame, value.bestOf);
    return { id: value.id, players, bestOf: value.bestOf, games, homeRoll, startedAt, teamsByGame };
  }

  function validateState(value) {
    // Prior formats use the same player order. Missing team selections stay blank.
    if (!isObject(value) || ![1, 2, 3, VERSION].includes(value.version) || !Array.isArray(value.history)) {
      throw new Error("请选择本计分板导出的受支持版本 JSON 备份。");
    }
    const active = validateSeries(value.active, false);
    const ids = new Set([active.id]);
    const history = value.history.map(item => {
      const series = validateSeries(item, true);
      if (ids.has(series.id)) throw new Error("备份中包含重复的系列赛。");
      ids.add(series.id);
      return series;
    });
    return { version: VERSION, active, history };
  }

  function encode(state) {
    return JSON.stringify(validateState(state), null, 2);
  }

  function parseFile(text) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("文件内容不是有效的 JSON。");
    }
  }

  function decodeStored(text) {
    const value = parseFile(text);
    const original = validateState(value);
    const series = original.active;
    const first = series.games[0];
    // Empty v4 rounds can be deliberate undo/reset/imports. Only explicit recovery
    // may add a score there. An identical, already recorded result can gain its link.
    if (value.version < 4 && canApplyPublishedOpener(original)) {
      return {state: applyPublishedOpener(original), migrated: true};
    }
    if (!original.history.length && first && first.reportId !== OPENER.reportId &&
        openerMatchup(series) && openerResult(first)) {
      const games = [{...first, reportId: OPENER.reportId}, ...series.games.slice(1)];
      return {state: {...original, active: {...series, games}}, migrated: true};
    }
    return {state: original, migrated: false};
  }

  function decode(text, {publishOpener = false} = {}) {
    return publishOpener ? decodeStored(text).state : validateState(parseFile(text));
  }

  globalThis.SeriesEngine = Object.freeze({
    KEY, create, configure, gameTeams, setGameTeams, isPublishedOpener, canApplyPublishedOpener,
    applyPublishedOpener, rollHome, homeSide, gameHomeSide, record, undo, reset, next, completed,
    stats, encode, decode, decodeStored
  });
})();
