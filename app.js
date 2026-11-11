/*
 * 「沉沦者的黑流树海」计分器 · 界面逻辑
 * 依赖：rules.js（CALC_RULES）、engine.js（CalcEngine）
 * 结构：左侧分区表单，右侧实时汇总；窄屏底部固定总分条 + 明细抽屉。
 */
(function () {
  'use strict';

  var R = CalcEngine.RULES;
  var Engine = CalcEngine;
  var SAVE_KEY = 'chenglun-blackflow-calc-v2';

  var formEl = document.getElementById('form');
  var summaryEl = document.getElementById('summary-card');
  var sheetEl = document.getElementById('sheet');
  var sheetBodyEl = document.getElementById('sheet-body');
  var helpEl = document.getElementById('help-modal');
  var helpBodyEl = document.getElementById('help-body');
  var toastEl = document.getElementById('toast');
  var mobileTotalEl = document.getElementById('mobile-total-value');
  var mobileCoeffEl = document.getElementById('mobile-coeff');

  /* ---------------- 状态 ---------------- */

  var state = loadState();
  var draft = {
    stage: R.emergency.stages[0].id,
    clearLayer: null,
    damage: 'none',
    sunset: false,
    escort: false,
    stoa: null,
    utopia: null,
    utopiaManual: null,
    enemies: []
  };

  function emptyState() {
    return Engine.createState();
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return emptyState();
      return Engine.normalizeState(JSON.parse(raw));
    } catch (e) {
      return emptyState();
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  function team() { return Engine.teamByName(state.team); }

  /* ---------------- 小工具 ---------------- */

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function num(v) {
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return 0;
    return Number(v);
  }

  function fmt(v) {
    var n = Math.round(Number(v) * 100) / 100;
    if (Object.is(n, -0)) n = 0;
    return String(n);
  }

  /* 把分组小计拼成「(a + b − c)」形式，负数用减号 */
  function sumExpr(parts) {
    var out = '';
    parts.forEach(function (v, i) {
      var n = Math.round(Number(v) * 100) / 100;
      if (i === 0) out += fmt(n);
      else out += (n < 0 ? ' − ' : ' + ') + fmt(Math.abs(n));
    });
    return '(' + out + ')';
  }

  function signed(v) {
    var n = Math.round(Number(v) * 100) / 100;
    if (n > 0) return '+' + fmt(n);
    return fmt(n);
  }

  function getPath(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setPath(obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function field(label, control, hint) {
    return '<label class="field">' +
      '<span class="field-label">' + esc(label) + '</span>' +
      control +
      (hint ? '<span class="field-hint">' + hint + '</span>' : '') +
      '</label>';
  }

  function numInput(path, value, opts) {
    opts = opts || {};
    var min = opts.min !== undefined ? ' min="' + opts.min + '"' : '';
    var max = opts.max !== undefined ? ' max="' + opts.max + '"' : '';
    var ph = opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '';
    return '<input class="input" type="number" inputmode="numeric" step="1"' + min + max +
      ' data-path="' + path + '" value="' + (value === null || value === undefined ? '' : esc(value)) + '"' + ph + '>';
  }

  function selectEl(path, options, current, extra) {
    var html = '<select class="input" data-path="' + path + '"' + (extra || '') + '>';
    options.forEach(function (o) {
      var val = o.value === undefined ? o : o.value;
      var label = o.label === undefined ? o : o.label;
      html += '<option value="' + esc(val) + '"' + (String(val) === String(current) ? ' selected' : '') + '>' + esc(label) + '</option>';
    });
    html += '</select>';
    return html;
  }

  function check(label, active, attrs, opts) {
    opts = opts || {};
    var type = opts.radio ? 'radio' : 'checkbox';
    var cls = 'check' + (active ? ' is-on' : '') + (opts.cls ? ' ' + opts.cls : '');
    var name = opts.name ? ' name="' + esc(opts.name) + '"' : '';
    return '<label class="' + cls + '">' +
      '<input type="' + type + '"' + name + (active ? ' checked' : '') + ' ' + (attrs || '') + '>' +
      '<span class="check-label">' + label + '</span></label>';
  }

  /* 勾选项纵向列表 */
  function checkList(items, inline) {
    return '<div class="check-list' + (inline ? ' is-inline' : '') + '">' + items.join('') + '</div>';
  }

  /* ---------------- 选项数据 ---------------- */

  var TEAM_OPTIONS = R.teams.map(function (t) {
    return { value: t.name, label: t.name + '（×' + t.coeff + '）' };
  });

  function stageOptions(current) {
    var layers = {};
    R.emergency.stages.forEach(function (s) {
      if (!layers[s.layer]) layers[s.layer] = [];
      layers[s.layer].push(s);
    });
    var html = '';
    Object.keys(layers).forEach(function (l) {
      html += '<optgroup label="' + l + ' 层">';
      layers[l].forEach(function (s) {
        var label = s.name + (s.soulHome ? '（紧急灵魂归宿）' : '') +
          (s.extra ? '（额外 +' + s.extra + '）' : '');
        html += '<option value="' + s.id + '"' + (s.id === current ? ' selected' : '') + '>' +
          esc(label) + '</option>';
      });
      html += '</optgroup>';
    });
    return html;
  }

  var STOA_OPTIONS = [{ value: '', label: '无' }].concat(R.stoas.types.map(function (s) {
    var m = Engine.stoaMultiplier(s.id);
    return { value: s.id, label: s.name + '（×' + m + '）' };
  }));

  var UTOPIA_OPTIONS = [{ value: '', label: '无' }].concat(R.utopias.types.map(function (u) {
    var label;
    if (u.manual) label = u.name + '（倍率手填）';
    else label = u.name + '（×' + Engine.utopiaMultiplier(u.id, null) + '）';
    return { value: u.id, label: label };
  }));

  var CLEAR_OPTIONS = [1, 2, 3, 4, 5, 6].map(function (n) {
    return { value: n, label: n + ' 层' };
  });

  var BOSS_OPTIONS = [{ value: '', label: '未挑战' }].concat(R.bossMaps.map(function (b) {
    return { value: b.id, label: b.name + '（' + b.leader + '）普通 +' + b.normal + ' / 熄日 +' + b.sunset };
  }));

  var ENDING_OPTIONS = [{ value: '', label: '未选择' }].concat(R.endings.map(function (e) {
    return { value: e.id, label: e.name + '（+' + e.score + '）' };
  }));

  var DAMAGE_OPTIONS = R.emergency.damage.options;

  /* 战斗结果单选：完整 / 一半 / 不计 */
  function damageList(current, attr, groupName) {
    return checkList(DAMAGE_OPTIONS.map(function (o) {
      return check(o.name, current === o.id, attr + '="' + o.id + '"', { radio: true, name: groupName });
    }));
  }

  /* ---------------- 表单：基础信息 ---------------- */

  function sectionBase() {
    return '<section class="section section-base">' +
      '<header class="section-head"><h2>基础信息</h2></header>' +
      '<div class="section-body">' +
      '<div class="grid grid-2">' +
      field('开局分队', selectEl('team', TEAM_OPTIONS, state.team), '分队系数 ×' + team().coeff + '，最终得分向下取整。') +
      field('游戏内结算分数', numInput('settleScore', state.settleScore, { placeholder: '例如 1200' }), '结算分 ×0.5 计入基础分。') +
      '</div></div></section>';
  }

  /* ---------------- 表单：作战得分 ---------------- */

  function stageById(id) { return Engine.stageById(id); }

  function soulPicker(attrs) {
    var html = '<div class="soul-block">';
    R.emergency.soulHome.columns.forEach(function (col) {
      html += '<div class="soul-col"><span class="soul-col-name">' + esc(col.name) + '</span>';
      var items = col.enemies.map(function (e) {
        var key = col.name + '|' + e.name;
        var active = false;
        if (attrs.activeList) active = attrs.activeList.indexOf(key) >= 0;
        return check(esc(e.name) + ' +' + e.score, active, 'data-enemy="' + esc(key) + '" ' + attrs.attrs, { cls: 'is-compact' });
      });
      html += checkList(items) + '</div>';
    });
    html += '</div>';
    return html;
  }

  function addBattleForm() {
    var stage = stageById(draft.stage) || R.emergency.stages[0];
    var clear = draft.clearLayer || stage.layer;
    var html = '<div class="add-box">' +
      '<div class="grid grid-2">' +
      field('关卡', '<select class="input" data-add="stage">' + stageOptions(draft.stage) + '</select>') +
      field('通关时层数', '<select class="input" data-add="clearLayer">' +
        CLEAR_OPTIONS.map(function (o) {
          return '<option value="' + o.value + '"' + (o.value === clear ? ' selected' : '') + '>' + o.label + '</option>';
        }).join('') + '</select>') +
      '</div>' +
      '<div class="grid grid-2">' +
      field('战斗结果', damageList(draft.damage, 'data-add-damage', 'damage-add'),
        '未损失生命/护盾拿完整；损失 ≤3 点拿一半；更多不计作战加分。') +
      '<div class="field"><span class="field-label">加成</span>' +
      checkList([
        check('熄日余径', draft.sunset, 'data-add="sunset"'),
        check('成功保护探险者（熄日余径额外 ×1.2）', draft.escort, 'data-add="escort"')
      ]) +
      '</div>' +
      '</div>' +
      '<div class="grid grid-2">' +
      field('实托邦', '<select class="input" data-add="stoa">' +
        STOA_OPTIONS.map(function (o) {
          return '<option value="' + esc(o.value) + '"' + (o.value === (draft.stoa || '') ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('') + '</select>') +
      field('乌托邦', '<select class="input" data-add="utopia">' +
        UTOPIA_OPTIONS.map(function (o) {
          return '<option value="' + esc(o.value) + '"' + (o.value === (draft.utopia || '') ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('') + '</select>') +
      '</div>';
    if (draft.utopia === 'ut-originium') {
      html += field('「源石之城」倍率（手填）',
        '<input class="input" type="number" inputmode="decimal" step="0.1" min="0.1" max="5" data-add="utopiaManual" value="' +
        (draft.utopiaManual === null || draft.utopiaManual === undefined ? '1' : esc(draft.utopiaManual)) + '">',
        '按你自己的判断填写倍率，默认 1。');
    }
    if (stage.soulHome) {
      html += '<div class="add-soul"><p class="hint">灵魂归宿：勾选该局出现的敌人（可多选）</p>' +
        soulPicker({ attrs: 'data-add-enemy="1"', activeList: draft.enemies }) + '</div>';
    }
    html += '<button type="button" class="btn btn-primary btn-add" data-add-action="battle">添加到作战列表</button>';
    html += '</div>';
    return html;
  }

  function battleCard(b, idx, norm) {
    var stage = stageById(b.stage);
    var nb = norm.battles[idx];
    var preview = Engine.computeBattleScore(norm, nb);
    var html = '<article class="battle-card">' +
      '<div class="battle-head">' +
      '<strong>' + esc(stage.name) + (stage.soulHome ? '（紧急灵魂归宿）' : '') + '</strong>' +
      '<span class="battle-score">' + (preview.score ? signed(preview.score) : '0') + '</span>' +
      '<button type="button" class="icon-btn" data-remove-battle="' + idx + '" aria-label="删除">✕</button>' +
      '</div>' +
      '<div class="grid grid-2 battle-fields">' +
      field('通关时层数', '<select class="input" data-battle="' + idx + '" data-field="clearLayer">' +
        CLEAR_OPTIONS.map(function (o) {
          return '<option value="' + o.value + '"' + (o.value === b.clearLayer ? ' selected' : '') + '>' + o.label + '</option>';
        }).join('') + '</select>') +
      '<div class="field"><span class="field-label">战斗结果</span>' +
      damageList(b.damage, 'data-battle="' + idx + '" data-field-damage', 'damage-' + idx) +
      '</div>' +
      '</div>' +
      '<div class="field"><span class="field-label">加成</span>' +
      checkList([
        check('熄日余径', b.sunset, 'data-battle="' + idx + '" data-field="sunset"'),
        check('成功保护探险者（熄日余径额外 ×1.2）', b.escort, 'data-battle="' + idx + '" data-field="escort"')
      ]) +
      '</div>' +
      '<div class="grid grid-2 battle-fields">' +
      field('实托邦', '<select class="input" data-battle="' + idx + '" data-field="stoa">' +
        STOA_OPTIONS.map(function (o) {
          return '<option value="' + esc(o.value) + '"' + (o.value === (b.stoa || '') ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('') + '</select>') +
      field('乌托邦', '<select class="input" data-battle="' + idx + '" data-field="utopia">' +
        UTOPIA_OPTIONS.map(function (o) {
          return '<option value="' + esc(o.value) + '"' + (o.value === (b.utopia || '') ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('') + '</select>') +
      '</div>' +
      (b.utopia === 'ut-originium'
        ? field('「源石之城」倍率（手填）',
          '<input class="input" type="number" inputmode="decimal" step="0.1" min="0.1" max="5" data-battle="' + idx + '" data-field="utopiaManual" value="' +
          (b.utopiaManual === null || b.utopiaManual === undefined ? '1' : esc(b.utopiaManual)) + '">')
        : '') +
      (stage.soulHome ? soulPicker({ attrs: 'data-battle-enemy="' + idx + '"', activeList: b.enemies }) : '') +
      (preview.detail ? '<p class="battle-detail">' + esc(preview.detail) + '</p>' : '') +
      '</article>';
    return html;
  }

  function sectionCombat() {
    var norm = Engine.normalizeState(state);
    var html = '<section class="section section-combat">' +
      '<header class="section-head"><h2>作战得分</h2></header>' +
      '<div class="section-body">';

    /* 紧急作战 */
    html += '<div class="sub-block">' +
      '<h3 class="sub-title">紧急作战</h3>' +
      addBattleForm();

    if (state.battles.length) {
      html += '<div class="battle-list">';
      state.battles.forEach(function (b, idx) {
        html += battleCard(b, idx, norm);
      });
      html += '</div>';
    } else {
      html += '<p class="empty-hint">还没有添加作战。选好关卡与选项后点「添加到作战列表」，可添加多条。</p>';
    }
    html += '</div>';

    /* 特殊事件 */
    html += '<div class="sub-block">' +
      '<h3 class="sub-title">特殊事件作战</h3>' +
      checkList([
        check('无效验尸 +70（仅一次）', state.specials.noAutopsy, 'data-toggle="specials.noAutopsy"'),
        check('湖中魇 +50', state.specials.lake, 'data-toggle="specials.lake"'),
        check('紧急 湖中魇 +70', state.specials.lakeEmergency, 'data-toggle="specials.lakeEmergency"'),
        check('合伙人会议 +30', state.specials.partner, 'data-toggle="specials.partner"'),
        check('紧急 合伙人会议 +50', state.specials.partnerEmergency, 'data-toggle="specials.partnerEmergency"'),
        check('灰坑（按通关层数计分）', state.specials.ashPit, 'data-toggle="specials.ashPit"')
      ]) +
      (state.specials.ashPit
        ? '<div class="inline-field">' + field('灰坑通关层数',
          '<select class="input" data-path="specials.ashPitLayer">' +
          [3, 4, 5].map(function (l) {
            var s = Engine.specialById('sp-ashpit').layerScores[l];
            return '<option value="' + l + '"' + (l === state.specials.ashPitLayer ? ' selected' : '') + '>' + l + ' 层（+' + s + '）</option>';
          }).join('') + '</select>') + '</div>'
        : '') +
      '</div>';

    /* 追猎 */
    var huntChecks = [];
    R.hunts.items.forEach(function (h) {
      if (h.altScore) {
        huntChecks.push(check(h.name + ' +' + h.score + '（击杀 >3）',
          state.hunts.indexOf(h.id) >= 0 && !state.huntInsectAlt, 'data-hunt="' + h.id + '"'));
        huntChecks.push(check(h.name + ' +' + h.altScore + '（击杀 ≤3）',
          state.hunts.indexOf(h.id) >= 0 && state.huntInsectAlt, 'data-hunt-alt="' + h.id + '"'));
      } else {
        huntChecks.push(check(h.name + ' +' + h.score, state.hunts.indexOf(h.id) >= 0, 'data-hunt="' + h.id + '"'));
      }
    });
    html += '<div class="sub-block"><h3 class="sub-title">追猎作战</h3>' + checkList(huntChecks) + '</div>';

    /* 险路恶敌 */
    var bossMap = state.boss.id ? Engine.bossById(state.boss.id) : null;
    html += '<div class="sub-block">' +
      '<h3 class="sub-title">险路恶敌</h3>' +
      '<p class="hint">每局只记一张图、一种状态；赤金条仅「光荣远征」可选。</p>' +
      '<div class="grid grid-2">' +
      field('作战', selectEl('boss.id', BOSS_OPTIONS, state.boss.id || '')) +
      '<div class="field"><span class="field-label">状态</span>' +
      checkList([
        check('普通', state.boss.mode === 'normal', 'data-boss-mode="normal"',
          { radio: true, name: 'boss-mode' }),
        check('熄日余径', state.boss.mode === 'sunset', 'data-boss-mode="sunset"',
          { radio: true, name: 'boss-mode' })
      ]) +
      '</div>' +
      '</div>' +
      (bossMap
        ? checkList([
          bossMap.goldNormal
            ? check('赤金条 +' + (state.boss.mode === 'sunset' ? bossMap.goldSunset : bossMap.goldNormal),
              state.boss.gold, 'data-toggle="boss.gold"')
            : ''
        ].filter(Boolean))
        : '') +
      '</div>';

    /* 实托邦 / 乌托邦 独立加分 */
    html += '<div class="sub-block">' +
      '<h3 class="sub-title">实托邦与乌托邦 · 独立加分</h3>' +
      field('「储藏室」商店节点次数', numInput('stoaStorageShops', state.stoaStorageShops, { min: 0, max: 99 }),
        '每次 +100；仅在实托邦为「储藏室」时填写。倍率在每条紧急作战里选择。') +
      '</div>';

    html += '</div></section>';
    return html;
  }

  /* ---------------- 表单：结局 ---------------- */

  function sectionEnding() {
    var ending = state.ending ? Engine.endingById(state.ending) : null;
    return '<section class="section section-ending">' +
      '<header class="section-head"><h2>结局得分</h2></header>' +
      '<div class="section-body">' +
      '<div class="grid grid-2">' +
      field('结局', selectEl('ending', ENDING_OPTIONS, state.ending || '')) +
      (ending && ending.killBonus
        ? '<div class="field"><span class="field-label">附加</span>' +
        checkList([check('击杀' + ending.killName + ' +' + ending.killBonus, state.endingKill, 'data-toggle="endingKill"')]) +
        '</div>'
        : '') +
      '</div>' +
      '<p class="hint">结局关卡只结算结局得分，不再叠加险路恶敌得分。</p>' +
      '</div></section>';
  }

  /* ---------------- 表单：藏品 ---------------- */

  function sectionCollect() {
    var c = state.collect;
    return '<section class="section section-collect">' +
      '<header class="section-head"><h2>藏品得分</h2></header>' +
      '<div class="section-body">' +
      '<div class="grid grid-2">' +
      field('藏品总数', numInput('restrictions.collectibleCount', state.restrictions.collectibleCount, { min: 0, max: 9999 }),
        '每个 +3，最多计 100 个。') +
      field('祭日之契携带层数', '<select class="input" data-path="collect.sunPactLayers">' +
        [0, 1, 2, 3].map(function (n) {
          return '<option value="' + n + '"' + (n === c.sunPactLayers ? ' selected' : '') + '>' + n + ' 层（+' + n * 150 + '）</option>';
        }).join('') + '</select>', '最多携带 3 层，每层 +150。') +
      '</div>' +
      checkList([
        check('沙盘α +30', c.alpha, 'data-toggle="collect.alpha"'),
        check('沙盘β +20', c.beta, 'data-toggle="collect.beta"'),
        check('怦然信标 +30', c.beacon, 'data-toggle="collect.beacon"'),
        check('生命蓝图 +200（作战 ×1.5）', c.lifeBlueprint, 'data-toggle="collect.lifeBlueprint"'),
        check('谒日之祈 0', c.kibo, 'data-toggle="collect.kibo"')
      ]) +
      '<div class="sub-inner">' +
      '<h4 class="sub-title small">三削弱藏</h4>' +
      '<p class="hint">持有即每件 +30；若在「源流交汇处」层未上交任何一件，每件再 +50。</p>' +
      checkList(
        R.collectibles.weak.items.map(function (item) {
          return check(item.name + ' +30', c.weak[item.id], 'data-toggle="collect.weak.' + item.id + '"');
        }).concat([
          check('命运所指未上交（每件再 +50）', c.fateNotHanded, 'data-toggle="collect.fateNotHanded"')
        ])
      ) +
      '</div>' +
      '<p class="hint">「沙盘α」「沙盘β」同时持有时额外 +30。</p>' +
      '</div></section>';
  }

  /* ---------------- 表单：限制 ---------------- */

  function sectionRestrict() {
    var t = team();
    var html = '<section class="section section-restrict">' +
      '<header class="section-head"><h2>限制得分</h2></header>' +
      '<div class="section-body">';

    html += '<div class="grid grid-2">' +
      field('板藤超出节点数', numInput('restrictions.boardvineExcess', state.restrictions.boardvineExcess, { min: 0, max: 99 }), '每超出 1 节点 −200。') +
      field('击杀鸭爵 / 高普尼克 / 流泪小子 / 圆仔（不含空植体）', numInput('restrictions.kills', state.restrictions.kills, { min: 0, max: 999 }), '每个 +10。') +
      field('襁褓生灵数', numInput('restrictions.infants', state.restrictions.infants, { min: 0, max: 999 }), '每个 +15。') +
      field('击杀刺箱数', numInput('restrictions.spikeChests', state.restrictions.spikeChests, { min: 0, max: 999 }), '每个 +7。') +
      field('击杀宝箱怪数', numInput('restrictions.mimicChests', state.restrictions.mimicChests, { min: 0, max: 999 }), '每个 +10。') +
      field('探险者死亡次数', numInput('restrictions.explorerDeaths', state.restrictions.explorerDeaths, { min: 0, max: 99 }), '每次 −150。') +
      field('入局前源石锭', numInput('restrictions.originiumBefore', state.restrictions.originiumBefore, { min: 0, max: 9999, placeholder: '留空不计' })) +
      field('结算后源石锭', numInput('restrictions.originiumAfter', state.restrictions.originiumAfter, { min: 0, max: 9999, placeholder: '留空不计' }), '只看减少方向：比入局前少 10 个以上时，超出 10 的部分每 1 个 −5。') +
      '</div>' +
      checkList([
        check('使用医疗典训进阶诺威尔、乌啾 −500', state.restrictions.medTraining, 'data-toggle="restrictions.medTraining"'),
        check('触发错误房 +200', state.restrictions.errorRoom, 'data-toggle="restrictions.errorRoom"')
      ]);

    /* 干员限制 */
    html += '<div class="sub-inner"><h4 class="sub-title small">受限干员</h4>' +
      '<p class="hint">按每个职业分别判定：单个职业招募 2 位受限干员 −200、3 位 −500；对应职业队（近卫/先锋、重装/辅助、医疗/狙击、术师/特种）招募 2 位以内不扣分。包括临时招募；未使用「特限模组」的干员不计入。</p>' +
      '<div class="officer-grid">';
    R.classes.forEach(function (cls) {
      var val = state.officers[cls.name] || 0;
      var top = cls.operators.map(function (o) { return o; }).join(' / ');
      html += '<label class="officer-item" title="' + esc(top) + '">' +
        '<span class="officer-name">' + esc(cls.name) + '</span>' +
        '<select class="input officer-select" data-path="officers.' + esc(cls.name) + '">' +
        [0, 1, 2, 3].map(function (n) {
          return '<option value="' + n + '"' + (n === val ? ' selected' : '') + '>' + n + ' 位</option>';
        }).join('') +
        '</select></label>';
    });
    html += '</div></div>';

    /* 分队附加限制：仅选中该分队时出现 */
    if (t.special === 'civil') {
      html += '<div class="sub-inner team-panel"><h4 class="sub-title small">' + esc(R.teamRules.civil.name) + ' · 附加限制</h4>' +
        '<div class="grid grid-2">' +
        field('1–4 层非追猎方式进入下一层次数', numInput('civil.nonHuntEntries', state.civil.nonHuntEntries, { min: 0, max: 4 }), '每次 −300，最多 4 次。') +
        field('「探测先锋」交换过的层数', numInput('civil.pioneerLayers', state.civil.pioneerLayers, { min: 0, max: 4 }), '每有一层 −200。') +
        field('离开本层未清理「理想源」次数', numInput('civil.idealMissed', state.civil.idealMissed, { min: 0, max: 99 }), '每次 −200。') +
        '</div>' +
        checkList([
          check('第 1、2、4 层全部经追猎直接进入（分队系数按 1.0）', state.civil.huntOnly, 'data-toggle="civil.huntOnly"')
        ]) + '</div>';
    }
    if (t.special === 'trade') {
      html += '<div class="sub-inner team-panel"><h4 class="sub-title small">' + esc(R.teamRules.trade.name) + ' · 附加限制</h4>' +
        '<div class="grid grid-2">' +
        field('3 层及之后携带自然物超过 5 后经过的节点数', numInput('trade.naturalOverNodes', state.trade.naturalOverNodes, { min: 0, max: 99 }), '每经过 1 节点 −50。') +
        '</div></div>';
    }
    if (t.special === 'traverse') {
      html += '<div class="sub-inner team-panel"><h4 class="sub-title small">' + esc(R.teamRules.traverse.name) + ' · 附加限制</h4>' +
        '<div class="grid grid-2">' +
        field('携带加工品超过 5 后经过的节点数', numInput('traverse.processedOverNodes', state.traverse.processedOverNodes, { min: 0, max: 99 }), '每经过 1 节点 −50。') +
        '</div></div>';
    }

    html += '</div></section>';
    return html;
  }

  /* ---------------- 渲染 ---------------- */

  function renderForm() {
    formEl.innerHTML =
      sectionBase() +
      sectionCombat() +
      sectionEnding() +
      sectionCollect() +
      sectionRestrict();
    document.body.setAttribute('data-team', team().id || 'origin');
    renderSummary();
  }

  /* 总积分框：每条「分值 · 来源」 */
  function scoreBoard(res) {
    var rows = '';
    res.groups.forEach(function (g) {
      g.items.forEach(function (it) {
        var neg = Math.round(it.score * 100) / 100 < 0;
        rows += '<div class="score-line' + (neg ? ' is-neg' : '') + '">' +
          '<span class="score-val">' + signed(it.score) + '</span>' +
          '<span class="score-src">' + esc(g.label) + ' · ' + esc(it.label) + '</span></div>';
      });
    });
    if (!rows) rows = '<p class="score-empty">还没有计分项，先在左侧填写。</p>';
    return '<div class="score-board">' +
      '<div class="score-board-head"><span>总积分</span><span>分值 · 来源</span></div>' +
      '<div class="score-board-body">' + rows + '</div>' +
      '<div class="score-board-foot"><span>合计（未乘系数）</span><b>' + signed(res.rawTotal) + '</b></div>' +
      '</div>';
  }

  function renderSummary() {
    var res = Engine.compute(state);
    var parts = res.groups.map(function (g) { return g.subtotal; });
    var formula = sumExpr(parts) + ' × ' + fmt(res.coeff) + ' = ' + res.total;

    var breakdown = res.groups.map(function (g) {
      return '<div class="sum-row' + (g.subtotal ? '' : ' is-zero') + '">' +
        '<span>' + esc(g.label) + '</span>' +
        '<b>' + (g.subtotal ? signed(g.subtotal) : '0') + '</b></div>';
    }).join('');

    var warnings = '';
    if (res.warnings.length) {
      warnings = '<div class="sum-warnings">' + res.warnings.map(function (w) {
        return '<p>· ' + esc(w) + '</p>';
      }).join('') + '</div>';
    }

    summaryEl.innerHTML =
      '<div class="summary-head">' +
      '<span class="summary-label">最终得分</span>' +
      '<span class="summary-team">' + esc(res.team.name) + ' ×' + fmt(res.coeff) + '</span>' +
      '</div>' +
      '<div class="summary-total">' + res.total + '</div>' +
      '<p class="summary-formula">' + esc(formula) + '</p>' +
      scoreBoard(res) +
      '<div class="summary-breakdown">' + breakdown + '</div>' +
      warnings +
      '<div class="summary-actions">' +
      '<button type="button" class="btn btn-primary" data-action="export">导出明细</button>' +
      '<button type="button" class="btn btn-ghost" data-action="copy">复制结果</button>' +
      '</div>' +
      '<p class="summary-note">数据仅保存在本机浏览器，不会上传。</p>';

    mobileTotalEl.textContent = String(res.total);
    mobileCoeffEl.textContent = '×' + fmt(res.coeff);
  }

  function renderSheet() {
    var res = Engine.compute(state);
    var html = '<div class="sheet-summary">' +
      '<p class="sheet-formula">' + sumExpr(res.groups.map(function (g) { return g.subtotal; })) +
      ' × ' + fmt(res.coeff) + ' = ' + res.total + '</p>' +
      '<p class="sheet-meta">' + esc(res.team.name) + ' · 分队系数 ×' + fmt(res.coeff) + '</p></div>' +
      scoreBoard(res);

    res.groups.forEach(function (g) {
      if (!g.items.length) return;
      html += '<section class="sheet-group"><h3>' + esc(g.label) +
        '<span>' + signed(g.subtotal) + '</span></h3><ul>';
      g.items.forEach(function (it) {
        html += '<li><div><strong>' + esc(it.label) + '</strong>' +
          (it.detail ? '<em>' + esc(it.detail) + '</em>' : '') +
          '</div><b>' + signed(it.score) + '</b></li>';
      });
      html += '</ul></section>';
    });
    if (!res.items.length) html += '<p class="empty-hint">还没有填写任何数据。</p>';
    if (res.warnings.length) {
      html += '<div class="sum-warnings">' + res.warnings.map(function (w) { return '<p>· ' + esc(w) + '</p>'; }).join('') + '</div>';
    }
    sheetBodyEl.innerHTML = html;
  }

  /* ---------------- 规则速览 ---------------- */

  function renderHelp() {
    helpBodyEl.innerHTML =
      '<h3>计分公式</h3>' +
      '<p>' + esc(R.formula.description) + '</p>' +
      '<h3>要点</h3>' +
      '<ul>' +
      '<li>紧急作战基础分 = 10 × 所属层数 ÷ 通关时层数；表 9-1 的额外分看「战斗结果」：未损失生命/护盾拿完整分，损失 ≤3 点拿一半，更多则不计作战加分。</li>' +
      '<li>熄日余径中成功保护探险者，该关额外 ×1.2；生命蓝图：作战与险路恶敌得分 ×1.5。</li>' +
      '<li>实托邦、乌托邦倍率只乘对应作战得分，多个倍率相乘；「源石之城」的倍率由你自己填写。</li>' +
      '<li>险路恶敌使用单独分值，不吃熄日余径倍率；结局关卡只结算结局分。</li>' +
      '<li>三削弱藏：持有每件 +30，命运所指未上交时每件再 +50。</li>' +
      '<li>扣分项同样乘分队系数（最后统一乘）。</li>' +
      '</ul>' +
      '<p class="hint">数据版本 ' + esc(R.meta.dataVersion) + ' · 最终成绩以裁判组核验为准。</p>';
  }

  /* ---------------- 导出 / 复制 ---------------- */

  function buildReport() {
    var res = Engine.compute(state);
    var lines = [];
    lines.push('蛇杖杯 · 沉沦者的黑流树海 · 计分明细');
    lines.push('分队：' + res.team.name + '（系数 ×' + fmt(res.coeff) + '）');
    lines.push('');
    res.groups.forEach(function (g) {
      lines.push('【' + g.label + '】' + signed(g.subtotal));
      g.items.forEach(function (it) {
        lines.push('  ' + it.label + '  ' + signed(it.score) + (it.detail ? '  （' + it.detail + '）' : ''));
      });
    });
    lines.push('');
    lines.push('合计：' + signed(res.rawTotal));
    lines.push(sumExpr(res.groups.map(function (g) { return g.subtotal; })) + ' × ' + fmt(res.coeff) + ' = ' + res.total);
    lines.push('最终得分：' + res.total);
    if (res.warnings.length) {
      lines.push('');
      res.warnings.forEach(function (w) { lines.push('提示：' + w); });
    }
    lines.push('');
    lines.push('数据版本 ' + R.meta.dataVersion + ' · 最终成绩以裁判组核验为准。');
    return lines.join('\n');
  }

  function exportReport() {
    var text = buildReport();
    var blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    a.href = url;
    a.download = '蛇杖杯-计分-' + stamp + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('已导出明细');
  }

  function copyReport() {
    var text = buildReport();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制到剪贴板'); }, function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制到剪贴板'); } catch (e) { toast('复制失败，请手动选择文本'); }
    document.body.removeChild(ta);
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.hidden = true; }, 1800);
  }

  /* ---------------- 交互 ---------------- */

  function touch() {
    saveState();
    renderSummary();
  }

  function afterStructuralChange() {
    saveState();
    renderForm();
  }

  formEl.addEventListener('change', function (ev) {
    var el = ev.target;

    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
      handleCheck(el);
      return;
    }

    /* 添加区的下拉 */
    if (el.dataset && el.dataset.add) {
      var key = el.dataset.add;
      if (key === 'stage') {
        draft.stage = el.value;
        draft.enemies = [];
        var st = stageById(el.value);
        draft.clearLayer = st ? st.layer : draft.clearLayer;
      } else if (key === 'clearLayer') {
        draft.clearLayer = Number(el.value);
      } else if (key === 'stoa') {
        draft.stoa = el.value || null;
      } else if (key === 'utopia') {
        draft.utopia = el.value || null;
      } else if (key === 'utopiaManual') {
        draft.utopiaManual = el.value === '' ? null : Number(el.value);
      }
      renderForm();
      return;
    }

    /* 作战卡片里的控件 */
    if (el.dataset && el.dataset.battle !== undefined) {
      var idx = Number(el.dataset.battle);
      var fieldName = el.dataset.field;
      if (!state.battles[idx]) return;
      if (fieldName === 'clearLayer') state.battles[idx].clearLayer = Number(el.value);
      if (fieldName === 'stoa') state.battles[idx].stoa = el.value || null;
      if (fieldName === 'utopia') state.battles[idx].utopia = el.value || null;
      if (fieldName === 'utopiaManual') state.battles[idx].utopiaManual = el.value === '' ? null : Number(el.value);
      afterStructuralChange();
      return;
    }

    /* 普通 data-path 控件 */
    if (el.dataset && el.dataset.path) {
      var path = el.dataset.path;
      var raw = el.value;
      var isNumberField = el.type === 'number';
      if (isNumberField) {
        setPath(state, path, raw === '' ? null : Number(raw));
      } else if (path === 'specials.ashPitLayer' || path === 'collect.sunPactLayers') {
        setPath(state, path, Number(raw));
      } else {
        setPath(state, path, raw === '' ? null : (raw === 'null' ? null : raw));
      }
      if (path === 'team' || path === 'boss.id' || path === 'ending' || path === 'endingKill') {
        if (path === 'boss.id' && !raw) state.boss.gold = false;
        afterStructuralChange();
      } else {
        touch();
      }
    }
  });

  formEl.addEventListener('input', function (ev) {
    var el = ev.target;
    if (!el.dataset) return;
    if (el.dataset.battle !== undefined && el.dataset.field === 'utopiaManual') {
      var bi = Number(el.dataset.battle);
      if (!state.battles[bi]) return;
      state.battles[bi].utopiaManual = el.value === '' ? null : Number(el.value);
      saveState();
      renderSummary();
      return;
    }
    if (!el.dataset.path) return;
    if (el.type !== 'number') return;
    var path = el.dataset.path;
    setPath(state, path, el.value === '' ? null : Number(el.value));
    saveState();
    renderSummary();
  });

  formEl.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button');
    if (!btn) return;

    /* 添加紧急作战 */
    if (btn.dataset.addAction === 'battle') {
      addBattle();
      return;
    }
    /* 删除 */
    if (btn.dataset.removeBattle !== undefined) {
      state.battles.splice(Number(btn.dataset.removeBattle), 1);
      afterStructuralChange();
      return;
    }
  });

  function toggleInArray(arr, value) {
    var i = arr.indexOf(value);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(value);
  }

  function setInArray(arr, value, on) {
    var i = arr.indexOf(value);
    if (on && i < 0) arr.push(value);
    if (!on && i >= 0) arr.splice(i, 1);
  }

  /* 勾选 / 单选控件 */
  function handleCheck(el) {
    var d = el.dataset || {};

    if (d.addDamage !== undefined) {
      draft.damage = d.addDamage;
      renderForm();
      return;
    }
    if (d.add === 'sunset' || d.add === 'escort') {
      draft[d.add] = el.checked;
      renderForm();
      return;
    }
    if (d.addEnemy !== undefined) {
      setInArray(draft.enemies, d.enemy, el.checked);
      renderForm();
      return;
    }
    if (d.battle !== undefined && d.fieldDamage !== undefined) {
      var bi = Number(d.battle);
      if (!state.battles[bi]) return;
      state.battles[bi].damage = d.fieldDamage;
      afterStructuralChange();
      return;
    }
    if (d.battle !== undefined && d.field) {
      var bi2 = Number(d.battle);
      if (!state.battles[bi2]) return;
      if (d.field === 'sunset' || d.field === 'escort') {
        state.battles[bi2][d.field] = el.checked;
        afterStructuralChange();
      }
      return;
    }
    if (d.battleEnemy !== undefined) {
      var idx = Number(d.battleEnemy);
      if (!state.battles[idx]) return;
      setInArray(state.battles[idx].enemies, d.enemy, el.checked);
      afterStructuralChange();
      return;
    }
    if (d.hunt) {
      setInArray(state.hunts, d.hunt, el.checked);
      if (!el.checked) state.huntInsectAlt = false;
      afterStructuralChange();
      return;
    }
    if (d.huntAlt) {
      setInArray(state.hunts, d.huntAlt, el.checked);
      state.huntInsectAlt = el.checked;
      afterStructuralChange();
      return;
    }
    if (d.bossMode) {
      if (!state.boss.id) { renderForm(); return; }
      state.boss.mode = d.bossMode;
      afterStructuralChange();
      return;
    }
    if (d.toggle) {
      setPath(state, d.toggle, el.checked);
      if (d.toggle === 'specials.ashPit' && el.checked && state.specials.ashPitLayer === null) {
        state.specials.ashPitLayer = 3;
      }
      afterStructuralChange();
    }
  }

  function addBattle() {
    var stage = stageById(draft.stage);
    if (!stage) return;
    var clear = draft.clearLayer || stage.layer;
    var battle = {
      stage: stage.id,
      clearLayer: clear,
      damage: draft.damage || 'none',
      sunset: Boolean(draft.sunset),
      escort: Boolean(draft.escort),
      stoa: draft.stoa || null,
      utopia: draft.utopia || null,
      utopiaManual: draft.utopiaManual === null || draft.utopiaManual === undefined ? null : Number(draft.utopiaManual),
      enemies: stage.soulHome ? draft.enemies.slice() : []
    };
    state.battles.push(battle);
    draft = {
      stage: draft.stage,
      clearLayer: stage.layer,
      damage: 'none',
      sunset: false,
      escort: false,
      stoa: null,
      utopia: null,
      utopiaManual: null,
      enemies: []
    };
    afterStructuralChange();
    toast('已添加：' + stage.name);
  }

  /* ---------------- 弹层 / 顶栏 ---------------- */

  function openSheet() {
    renderSheet();
    sheetEl.hidden = false;
    document.body.classList.add('is-locked');
  }

  function closeSheet() {
    sheetEl.hidden = true;
    document.body.classList.remove('is-locked');
  }

  function openHelp() {
    renderHelp();
    helpEl.hidden = false;
    document.body.classList.add('is-locked');
  }

  function closeHelp() {
    helpEl.hidden = true;
    document.body.classList.remove('is-locked');
  }

  document.getElementById('btn-help').addEventListener('click', openHelp);
  document.getElementById('btn-help-close').addEventListener('click', closeHelp);
  document.getElementById('btn-sheet-close').addEventListener('click', closeSheet);
  document.getElementById('btn-mobile-detail').addEventListener('click', openSheet);
  document.getElementById('btn-reset').addEventListener('click', function () {
    if (!window.confirm('确定清空全部填写内容吗？')) return;
    state = emptyState();
    draft = {
      stage: R.emergency.stages[0].id, clearLayer: null, damage: 'none',
      sunset: false, escort: false, stoa: null, utopia: null, utopiaManual: null, enemies: []
    };
    afterStructuralChange();
    toast('已重置');
  });

  [sheetEl, helpEl].forEach(function (overlay) {
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) {
        if (overlay === sheetEl) closeSheet();
        else closeHelp();
      }
    });
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (!sheetEl.hidden) closeSheet();
    if (!helpEl.hidden) closeHelp();
  });

  summaryEl.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.dataset.action === 'export') exportReport();
    if (btn.dataset.action === 'copy') copyReport();
  });

  /* ---------------- 启动 ---------------- */

  document.title = R.meta.title + ' · 计分器';
  renderForm();
})();
