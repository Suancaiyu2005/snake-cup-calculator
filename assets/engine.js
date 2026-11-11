/*
 * 「沉沦者的黑流树海」计分引擎（纯函数，无 DOM 依赖）
 * 依赖：全局 CALC_RULES 或同目录 rules.js
 * 公式：floor((结算分×0.5 + 作战得分 + 结局得分 + 藏品得分 + 限制得分) × 分队系数)
 *
 * 数据版本 2.4.0（蛇杖杯规则 v2）：
 *  - 作战得分按「九、作战得分」：未损失生命/护盾拿完整、损失 ≤3 点拿一半、更多 0 分；
 *    熄日余径中成功保护探险者额外 ×1.2
 *  - 表2-1 新增：襁褓生灵 +15/个、刺箱 +7、宝箱怪 +10、探险者死亡 −150；源石锭只看「减少」
 *  - 沙盘 α+β 同时持有额外 +30；删除「破碎噩兆 −150」
 *  - 文明开化追猎豁免层数改为 1、2、4 层
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./rules.js'));
  } else {
    root.CalcEngine = factory(root.CALC_RULES);
  }
})(typeof self !== 'undefined' ? self : this, function (RULES) {
  'use strict';

  var GROUPS = [
    { key: 'base', label: '基础分' },
    { key: 'combat', label: '作战得分' },
    { key: 'ending', label: '结局得分' },
    { key: 'collect', label: '藏品得分' },
    { key: 'restrict', label: '限制得分' }
  ];

  function toInt(v, fallback) {
    if (v === null || v === undefined || v === '') return fallback;
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.trunc(n);
  }

  function toNum(v, fallback) {
    if (v === null || v === undefined || v === '') return fallback;
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return n;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function teamByName(name) {
    for (var i = 0; i < RULES.teams.length; i++) {
      if (RULES.teams[i].name === name || RULES.teams[i].id === name) return RULES.teams[i];
    }
    return RULES.teams[0];
  }

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function stageById(id) { return findById(RULES.emergency.stages, id); }
  function specialById(id) { return findById(RULES.specialBattles, id); }
  function huntById(id) { return findById(RULES.hunts.items, id); }
  function endingById(id) { return findById(RULES.endings, id); }
  function stoaById(id) { return findById(RULES.stoas.types, id); }
  function utopiaById(id) { return findById(RULES.utopias.types, id); }
  function bossById(id) { return findById(RULES.bossMaps, id); }

  var ALL_SOUL_ENEMIES = (function () {
    var map = {};
    RULES.emergency.soulHome.columns.forEach(function (col) {
      col.enemies.forEach(function (e) { map[col.name + '|' + e.name] = e.score; });
    });
    return map;
  })();

  function emptyOfficers() {
    var o = {};
    RULES.classes.forEach(function (c) { o[c.name] = 0; });
    return o;
  }

  function createState() {
    return {
      team: RULES.teams[0].name,
      settleScore: null,
      battles: [],
      specials: {
        noAutopsy: false,
        ashPit: false,
        ashPitLayer: null,
        lake: false,
        lakeEmergency: false,
        partner: false,
        partnerEmergency: false
      },
      hunts: [],
      huntInsectAlt: false,
      boss: { id: null, mode: 'normal', gold: false },
      ending: null,
      endingKill: false,
      collect: {
        alpha: false,
        beta: false,
        beacon: false,
        weak: { god: false, light: false, civil: false },
        fateNotHanded: false,
        sunPactLayers: 0,
        lifeBlueprint: false,
        kibo: false
      },
      stoaStorageShops: 0,
      restrictions: {
        medTraining: false,
        errorRoom: false,
        boardvineExcess: 0,
        originiumBefore: null,
        originiumAfter: null,
        kills: 0,
        infants: 0,
        spikeChests: 0,
        mimicChests: 0,
        explorerDeaths: 0,
        collectibleCount: null
      },
      civil: { nonHuntEntries: 0, pioneerLayers: 0, idealMissed: 0, huntOnly: false },
      trade: { naturalOverNodes: 0 },
      traverse: { processedOverNodes: 0 },
      officers: emptyOfficers()
    };
  }

  function damageKey(v) {
    if (v === 'le3' || v === 'over3') return v;
    return 'none';
  }

  function normalizeBattle(b) {
    if (!b) return null;
    var id = typeof b === 'string' ? b : b.stage || b.id;
    var stage = stageById(id);
    if (!stage) return null;
    var clear = clamp(toInt(b.clearLayer, stage.layer), 1, 6);
    var enemies = [];
    if (stage.soulHome && Array.isArray(b.enemies)) {
      enemies = b.enemies.filter(function (k) { return ALL_SOUL_ENEMIES[k] !== undefined; });
    }
    return {
      stage: stage.id,
      clearLayer: clear,
      damage: damageKey(b.damage),
      sunset: Boolean(b.sunset),
      escort: Boolean(b.escort),
      stoa: stoaById(b.stoa) ? b.stoa : null,
      utopia: utopiaById(b.utopia) ? b.utopia : null,
      utopiaManual: b.utopiaManual === null || b.utopiaManual === undefined || b.utopiaManual === ''
        ? null
        : clamp(toNum(b.utopiaManual, 1), 0.1, 5),
      enemies: enemies
    };
  }

  function normalizeState(s) {
    var out = createState();
    if (!s || typeof s !== 'object') return out;

    var team = teamByName(s.team);
    out.team = team.name;
    out.settleScore = toInt(s.settleScore, null);

    if (Array.isArray(s.battles)) {
      out.battles = s.battles.map(normalizeBattle).filter(Boolean);
    }

    if (s.specials && typeof s.specials === 'object') {
      out.specials = {
        noAutopsy: Boolean(s.specials.noAutopsy),
        ashPit: Boolean(s.specials.ashPit),
        ashPitLayer: s.specials.ashPitLayer === null || s.specials.ashPitLayer === undefined
          ? null
          : clamp(toInt(s.specials.ashPitLayer, 3), 3, 5),
        lake: Boolean(s.specials.lake),
        lakeEmergency: Boolean(s.specials.lakeEmergency),
        partner: Boolean(s.specials.partner),
        partnerEmergency: Boolean(s.specials.partnerEmergency)
      };
    }

    if (Array.isArray(s.hunts)) {
      out.hunts = s.hunts.filter(function (id) { return Boolean(huntById(id)); });
    }
    out.huntInsectAlt = Boolean(s.huntInsectAlt);

    if (s.boss && typeof s.boss === 'object') {
      var boss = bossById(s.boss.id);
      out.boss = {
        id: boss ? boss.id : null,
        mode: s.boss.mode === 'sunset' ? 'sunset' : 'normal',
        gold: Boolean(s.boss.gold)
      };
    }

    var ending = endingById(s.ending);
    out.ending = ending ? ending.id : null;
    out.endingKill = Boolean(s.endingKill);

    if (s.collect && typeof s.collect === 'object') {
      out.collect = {
        alpha: Boolean(s.collect.alpha),
        beta: Boolean(s.collect.beta),
        beacon: Boolean(s.collect.beacon),
        weak: {
          god: Boolean(s.collect.weak && s.collect.weak.god),
          light: Boolean(s.collect.weak && s.collect.weak.light),
          civil: Boolean(s.collect.weak && s.collect.weak.civil)
        },
        fateNotHanded: Boolean(s.collect.fateNotHanded),
        sunPactLayers: clamp(toInt(s.collect.sunPactLayers, 0), 0, RULES.collectibles.sunPact.maxLayers),
        lifeBlueprint: Boolean(s.collect.lifeBlueprint),
        kibo: Boolean(s.collect.kibo)
      };
    }

    out.stoaStorageShops = clamp(toInt(s.stoaStorageShops, 0), 0, 99);

    if (s.restrictions && typeof s.restrictions === 'object') {
      var originiumBefore = toInt(s.restrictions.originiumBefore, null);
      var originiumAfter = toInt(s.restrictions.originiumAfter, null);
      var collectibleCount = toInt(s.restrictions.collectibleCount, null);
      out.restrictions = {
        medTraining: Boolean(s.restrictions.medTraining),
        errorRoom: Boolean(s.restrictions.errorRoom),
        boardvineExcess: clamp(toInt(s.restrictions.boardvineExcess, 0), 0, 99),
        originiumBefore: originiumBefore === null ? null : clamp(originiumBefore, 0, 9999),
        originiumAfter: originiumAfter === null ? null : clamp(originiumAfter, 0, 9999),
        kills: clamp(toInt(s.restrictions.kills, 0), 0, 999),
        infants: clamp(toInt(s.restrictions.infants, 0), 0, 999),
        spikeChests: clamp(toInt(s.restrictions.spikeChests, 0), 0, 999),
        mimicChests: clamp(toInt(s.restrictions.mimicChests, 0), 0, 999),
        explorerDeaths: clamp(toInt(s.restrictions.explorerDeaths, 0), 0, 999),
        collectibleCount: collectibleCount === null ? null : clamp(collectibleCount, 0, 9999)
      };
    }

    if (s.civil && typeof s.civil === 'object') {
      out.civil = {
        nonHuntEntries: clamp(toInt(s.civil.nonHuntEntries, 0), 0, 4),
        pioneerLayers: clamp(toInt(s.civil.pioneerLayers, 0), 0, 4),
        idealMissed: clamp(toInt(s.civil.idealMissed, 0), 0, 99),
        huntOnly: Boolean(s.civil.huntOnly)
      };
    }
    if (s.trade && typeof s.trade === 'object') {
      out.trade = { naturalOverNodes: clamp(toInt(s.trade.naturalOverNodes, 0), 0, 99) };
    }
    if (s.traverse && typeof s.traverse === 'object') {
      out.traverse = { processedOverNodes: clamp(toInt(s.traverse.processedOverNodes, 0), 0, 99) };
    }

    if (s.officers && typeof s.officers === 'object') {
      RULES.classes.forEach(function (c) {
        out.officers[c.name] = clamp(toInt(s.officers[c.name], 0), 0, 3);
      });
    }

    return out;
  }

  /** 乌托邦倍率；未选择返回 null；规则未给出倍率按 1；“源石之城”用玩家手填倍率 */
  function utopiaMultiplier(utopiaId, manual) {
    var ut = utopiaById(utopiaId);
    if (!ut) return null;
    if (ut.manual) {
      var m = toNum(manual, 1);
      return clamp(m, 0.1, 5);
    }
    return ut.multiplier === null || ut.multiplier === undefined ? 1 : ut.multiplier;
  }

  /** 实托邦倍率；未选择返回 null；规则未给出倍率按 1 */
  function stoaMultiplier(stoaId) {
    var st = stoaById(stoaId);
    if (!st) return null;
    return st.multiplier === null || st.multiplier === undefined ? 1 : st.multiplier;
  }

  function soulEnemyTotal(stage, enemies) {
    if (!stage || !stage.soulHome || !enemies || !enemies.length) return 0;
    var total = 0;
    enemies.forEach(function (key) {
      var score = ALL_SOUL_ENEMIES[key];
      if (score !== undefined) total += score;
    });
    return total;
  }

  function soulEnemyNames(enemies) {
    return (enemies || []).map(function (key) {
      var parts = key.split('|');
      return parts[1] + '+' + ALL_SOUL_ENEMIES[key];
    });
  }

  /** 单条紧急作战得分（含倍率链），供引擎与界面复用 */
  function computeBattleScore(state, battle) {
    var s = state;
    var b = battle;
    var stage = stageById(b.stage);
    if (!stage) return { score: 0, detail: '' };
    var team = teamByName(s.team);

    var basePart = RULES.emergency.basePerLayer * stage.layer / b.clearLayer;
    var extra = stage.extra || 0;
    var enemyPart = soulEnemyTotal(stage, b.enemies);
    var raw = basePart + extra + enemyPart;

    /* 九、作战得分：完整 / 一半 / 0 分 */
    var dmg = null;
    RULES.emergency.damage.options.forEach(function (o) {
      if (o.id === b.damage) dmg = o;
    });
    if (!dmg) dmg = RULES.emergency.damage.options[0];
    var score = raw * dmg.factor;

    var detailParts = [];
    if (stage.soulHome) {
      detailParts.push('基础 10×5÷' + b.clearLayer + ' = ' + round2(basePart));
      if (enemyPart) detailParts.push('敌人加分 ' + soulEnemyNames(b.enemies).join('、'));
    } else {
      detailParts.push('基础 10×' + stage.layer + '÷' + b.clearLayer + ' = ' + round2(basePart));
      if (extra) detailParts.push('额外分 +' + extra);
    }
    if (dmg.factor !== 1) detailParts.push(dmg.detail);

    if (b.sunset && b.escort) {
      score *= RULES.emergency.damage.escortMultiplier;
      detailParts.push(RULES.emergency.damage.escortDetail);
    } else if (b.sunset) {
      detailParts.push('熄日余径：未勾选成功保护探险者，不计 ×1.2');
    }

    if (s.collect.lifeBlueprint) {
      score *= RULES.emergency.lifeBlueprintMultiplier;
      detailParts.push('生命蓝图×' + RULES.emergency.lifeBlueprintMultiplier);
    }

    var stoaMult = stoaMultiplier(b.stoa);
    if (stoaMult !== null) {
      if (team.special === 'civil') {
        detailParts.push('文明开化不享受实托邦倍率');
      } else {
        score *= stoaMult;
        if (stoaMult !== 1) detailParts.push(stoaById(b.stoa).name + '×' + stoaMult);
      }
    }

    var utopiaMult = utopiaMultiplier(b.utopia, b.utopiaManual);
    if (utopiaMult !== null) {
      score *= utopiaMult;
      if (utopiaMult !== 1) detailParts.push(utopiaById(b.utopia).name + '×' + round2(utopiaMult));
    }

    return { score: score, detail: detailParts.join('；') };
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function officerDeduction(state, team) {
    var total = 0;
    var items = [];
    RULES.classes.forEach(function (c) {
      var n = state.officers[c.name] || 0;
      if (n <= 1) return;
      var score;
      if (n === 2) {
        var isClassTeam = team.classTeam && team.classTeam.indexOf(c.name) >= 0;
        score = isClassTeam ? 0 : -200;
      } else {
        score = -500;
      }
      if (score !== 0) {
        total += score;
        items.push({
          label: c.name + '受限干员 ' + n + ' 位',
          score: score,
          detail: n === 2 ? '招募 2 位 −200' : '招募 3 位 −500'
        });
      }
    });
    return { total: total, items: items };
  }

  function computeBossScore(state) {
    var s = state;
    if (!s.boss.id) return null;
    var map = bossById(s.boss.id);
    if (!map) return null;
    var sunset = s.boss.mode === 'sunset';
    var score = sunset ? map.sunset : map.normal;
    var parts = [map.name + ' · ' + (sunset ? '熄日余径 +' : '普通 +') + score];
    if (s.boss.gold && (map.goldNormal || map.goldSunset)) {
      var gold = sunset ? map.goldSunset : map.goldNormal;
      score += gold;
      parts.push('赤金条 +' + gold);
    }
    if (s.collect.lifeBlueprint) {
      score *= RULES.emergency.lifeBlueprintMultiplier;
      parts.push('生命蓝图×' + RULES.emergency.lifeBlueprintMultiplier);
    }
    return { map: map, score: score, detail: parts.join('；') };
  }

  function compute(rawState) {
    var s = normalizeState(rawState);
    var team = teamByName(s.team);
    var warnings = [];
    var groups = {};
    GROUPS.forEach(function (g) { groups[g.key] = { key: g.key, label: g.label, items: [], subtotal: 0 }; });

    function add(groupKey, label, score, detail) {
      if (!score) return;
      groups[groupKey].items.push({ group: groupKey, label: label, score: score, detail: detail || '' });
      groups[groupKey].subtotal += score;
    }

    /* ---------- 基础分 ---------- */
    var settle = s.settleScore === null ? 0 : s.settleScore;
    var baseScore = settle * RULES.formula.settleFactor;
    if (settle !== 0) {
      add('base', '游戏内结算分 ×0.5', baseScore, '结算分 ' + settle + ' × 0.5 = ' + baseScore);
    }

    /* ---------- 作战得分：紧急作战 ---------- */
    if (s.collect.lifeBlueprint) warnings.push('已携带生命蓝图：紧急作战与险路恶敌得分 ×1.5');

    s.battles.forEach(function (b) {
      var stage = stageById(b.stage);
      if (!stage) return;
      var result = computeBattleScore(s, b);
      add('combat', '紧急 · ' + stage.name, result.score, result.detail);
    });

    /* 实托邦：储藏室商店节点 */
    if (s.stoaStorageShops > 0) {
      if (team.special === 'civil') {
        warnings.push('文明开化分队不获得实托邦得分（含储藏室商店）');
      } else {
        add('combat', '「储藏室」商店节点',
          s.stoaStorageShops * RULES.stoas.storage.shops,
          s.stoaStorageShops + ' 次 × +100');
      }
    }

    /* 特殊事件作战 */
    var sp = s.specials;
    var spNoAutopsy = specialById('sp-noautopsy');
    var spLake = specialById('sp-lake');
    var spLakeEm = specialById('sp-lake-emergency');
    var spPartner = specialById('sp-partner');
    var spPartnerEm = specialById('sp-partner-emergency');
    if (sp.noAutopsy) add('combat', spNoAutopsy.name, spNoAutopsy.score, '仅首次挑战 +' + spNoAutopsy.score);
    if (sp.lake) add('combat', spLake.name, spLake.score, '固定 +' + spLake.score);
    if (sp.lakeEmergency) add('combat', spLakeEm.name, spLakeEm.score, '固定 +' + spLakeEm.score);
    if (sp.partner) add('combat', spPartner.name, spPartner.score, '固定 +' + spPartner.score);
    if (sp.partnerEmergency) add('combat', spPartnerEm.name, spPartnerEm.score, '固定 +' + spPartnerEm.score);
    if (sp.ashPit) {
      var ashRule = specialById('sp-ashpit');
      var ashScore = sp.ashPitLayer ? ashRule.layerScores[sp.ashPitLayer] : 0;
      if (!ashScore) {
        warnings.push('灰坑已勾选，但未选择通关层数，暂不计分');
      } else {
        add('combat', '灰坑', ashScore, sp.ashPitLayer + ' 层通关 +' + ashScore);
      }
    }

    /* 追猎作战 */
    s.hunts.forEach(function (id) {
      var h = huntById(id);
      if (!h) return;
      var val = h.score;
      if (id === 'h-insect' && s.huntInsectAlt) val = h.altScore;
      add('combat', '追猎 · ' + h.name, val, '');
    });

    /* 险路恶敌（每局仅一张图、一种状态） */
    var bossResult = computeBossScore(s);
    if (bossResult) add('combat', '险路恶敌 · ' + bossResult.map.name, bossResult.score, bossResult.detail);

    /* ---------- 结局得分 ---------- */
    var ending = endingById(s.ending);
    if (ending) {
      add('ending', '结局 · ' + ending.name, ending.score, '');
      if (ending.killBonus && s.endingKill) {
        add('ending', '结局 · ' + (ending.killName || '') + ' 击杀', ending.killBonus, '');
      }
    }

    /* ---------- 藏品得分 ---------- */
    var col = s.collect;
    if (s.restrictions.collectibleCount !== null) {
      var cnt = Math.min(s.restrictions.collectibleCount, RULES.collectibles.collectiblePoint.cap);
      add('collect', '藏品数量 ×3', cnt * RULES.collectibles.collectiblePoint.per,
        '拥有 ' + s.restrictions.collectibleCount + ' 个，计入 ' + cnt + ' 个');
    }
    if (col.alpha) add('collect', '沙盘α', RULES.collectibles.sandbox.alpha, '');
    if (col.beta) add('collect', '沙盘β', RULES.collectibles.sandbox.beta, '');
    if (col.alpha && col.beta) add('collect', '沙盘α+β 额外', RULES.collectibles.sandbox.both, '同时持有额外 +' + RULES.collectibles.sandbox.both);
    if (col.beacon) add('collect', '怦然信标', RULES.collectibles.beacon.score, '');

    RULES.collectibles.weak.items.forEach(function (item) {
      if (!col.weak[item.id]) return;
      add('collect', '三削弱藏 · ' + item.name, RULES.collectibles.weak.each, '每件 +30');
      if (col.fateNotHanded) {
        add('collect', '三削弱藏 · ' + item.name + '（命运所指未上交）', RULES.collectibles.weak.fateBonus, '每持有一件 +50');
      }
    });

    if (col.sunPactLayers > 0) {
      add('collect', '祭日之契', col.sunPactLayers * RULES.collectibles.sunPact.perLayer,
        '携带进入 ' + col.sunPactLayers + ' 层 ×150');
    }
    if (col.lifeBlueprint) add('collect', '生命蓝图', RULES.collectibles.lifeBlueprint.score, '+200（并启用作战 ×1.5）');
    if (col.kibo) add('collect', '谒日之祈', RULES.collectibles.kibo.score, '');

    /* ---------- 限制得分 ---------- */
    var res = s.restrictions;
    if (res.medTraining) add('restrict', RULES.restrictions.medTraining.name, RULES.restrictions.medTraining.score, '');
    if (res.errorRoom) add('restrict', RULES.restrictions.errorRoom.name, RULES.restrictions.errorRoom.score, '+' + RULES.restrictions.errorRoom.score);
    if (res.boardvineExcess > 0) {
      add('restrict', '板藤超出节点', res.boardvineExcess * RULES.restrictions.boardvine.perNode,
        '超出 ' + res.boardvineExcess + ' 节点 × −200');
    }
    if (res.originiumBefore !== null && res.originiumAfter !== null) {
      var decrease = res.originiumBefore - res.originiumAfter;
      var threshold = RULES.restrictions.originium.threshold;
      if (decrease > threshold) {
        add('restrict', RULES.restrictions.originium.name, (decrease - threshold) * RULES.restrictions.originium.perUnit,
          '减少 ' + decrease + '，超出 ' + threshold + ' 的 ' + (decrease - threshold) + ' × −5');
      }
    }
    if (res.kills > 0) add('restrict', RULES.restrictions.kills.name, res.kills * RULES.restrictions.kills.per, res.kills + ' 个 × +10');
    if (res.infants > 0) add('restrict', RULES.restrictions.infant.name, res.infants * RULES.restrictions.infant.per, res.infants + ' 个 × +15');
    if (res.spikeChests > 0) add('restrict', RULES.restrictions.spike.name, res.spikeChests * RULES.restrictions.spike.per, res.spikeChests + ' 个 × +7');
    if (res.mimicChests > 0) add('restrict', RULES.restrictions.mimic.name, res.mimicChests * RULES.restrictions.mimic.per, res.mimicChests + ' 个 × +10');
    if (res.explorerDeaths > 0) add('restrict', RULES.restrictions.explorerDeath.name, res.explorerDeaths * RULES.restrictions.explorerDeath.score, res.explorerDeaths + ' 次 × −150');

    if (team.special === 'civil') {
      if (s.civil.nonHuntEntries > 0) {
        add('restrict', RULES.teamRules.civil.nonHuntEntry.name, s.civil.nonHuntEntries * RULES.teamRules.civil.nonHuntEntry.score,
          s.civil.nonHuntEntries + ' 次 × −300');
      }
      if (s.civil.pioneerLayers > 0) {
        add('restrict', RULES.teamRules.civil.pioneerExchange.name, s.civil.pioneerLayers * RULES.teamRules.civil.pioneerExchange.score,
          s.civil.pioneerLayers + ' 层 × −200');
      }
      if (s.civil.idealMissed > 0) {
        add('restrict', RULES.teamRules.civil.idealMissed.name, s.civil.idealMissed * RULES.teamRules.civil.idealMissed.score,
          s.civil.idealMissed + ' 次 × −200');
      }
    }
    if (team.special === 'trade' && s.trade.naturalOverNodes > 0) {
      add('restrict', RULES.teamRules.trade.naturalOverNode.name, s.trade.naturalOverNodes * RULES.teamRules.trade.naturalOverNode.score,
        s.trade.naturalOverNodes + ' 节点 × −50');
    }
    if (team.special === 'traverse' && s.traverse.processedOverNodes > 0) {
      add('restrict', RULES.teamRules.traverse.processedOverNode.name, s.traverse.processedOverNodes * RULES.teamRules.traverse.processedOverNode.score,
        s.traverse.processedOverNodes + ' 节点 × −50');
    }

    var off = officerDeduction(s, team);
    off.items.forEach(function (it) { add('restrict', it.label, it.score, it.detail); });
    if (off.total !== 0) warnings.push('干员限制共 ' + off.total + ' 分');

    /* ---------- 合计 ---------- */
    var rawTotal = 0;
    GROUPS.forEach(function (g) { rawTotal += groups[g.key].subtotal; });

    var coeff = team.coeff;
    if (team.special === 'civil' && s.civil.huntOnly) {
      coeff = RULES.teamRules.civil.huntOnlyCoeff.coeff;
      warnings.push('文明开化：第 1、2、4 层均经追猎直接进入，分队系数按 1.0 计算');
    }
    var total = Math.floor(rawTotal * coeff);

    var hasAnyInput = Boolean(
      settle !== 0 || s.battles.length || s.hunts.length || s.ending || s.boss.id ||
      col.alpha || col.beta || col.beacon || col.lifeBlueprint ||
      col.weak.god || col.weak.light || col.weak.civil
    );

    var groupList = GROUPS.map(function (g) {
      return { key: g.key, label: g.label, subtotal: groups[g.key].subtotal, items: groups[g.key].items };
    });

    return {
      state: s,
      team: team,
      coeff: coeff,
      base: baseScore,
      groups: groupList,
      items: groupList.reduce(function (arr, g) { return arr.concat(g.items); }, []),
      rawTotal: rawTotal,
      total: total,
      hasAnyInput: hasAnyInput,
      warnings: warnings
    };
  }

  return {
    RULES: RULES,
    GROUPS: GROUPS,
    createState: createState,
    normalizeState: normalizeState,
    compute: compute,
    computeBattleScore: computeBattleScore,
    computeBossScore: computeBossScore,
    teamByName: teamByName,
    stageById: stageById,
    specialById: specialById,
    huntById: huntById,
    endingById: endingById,
    stoaById: stoaById,
    utopiaById: utopiaById,
    bossById: bossById,
    stoaMultiplier: stoaMultiplier,
    utopiaMultiplier: utopiaMultiplier,
    soulEnemyTotal: soulEnemyTotal,
    soulEnemyNames: soulEnemyNames,
    officerDeduction: officerDeduction
  };
});
