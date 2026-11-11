/*
 * 「沉沦者的黑流树海」蛇杖杯 n16 赛道 · 计分规则数据（唯一数据源）
 * 依据：蛇杖杯明日方舟规则（黑字版）.docx（v2）、关卡层数表图片、基础.docx（分队/实托邦/乌托邦名单）
 * 版本：规则 v2 / 数据 2.4.0
 * 说明：实托邦/乌托邦倍率以本表为准（未给出的按 ×1）；「源石之城」倍率由选手手填。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CALC_RULES = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RULES = {
    meta: {
      title: '蛇杖杯',
      subtitle: '沉沦者的黑流树海 · n16 赛道 · 计分器',
      ruleVersion: 'v2',
      dataVersion: '2.4.0',
      updated: '2025-11-11',
      notice: [
        '本计算器依据「蛇杖杯」n16 赛道规则 v2 实现，最终成绩以裁判组核验为准。',
        '所有数据只保存在本机浏览器，不会上传到任何服务器。'
      ]
    },

    formula: {
      settleFactor: 0.5,
      // 最终得分 = floor((结算分×0.5 + 作战得分 + 结局得分 + 藏品得分 + 限制得分) × 分队系数)
      description: '最终得分 =（游戏内结算分数×0.5 + 作战得分 + 结局得分 + 藏品得分 + 分队、干员、游戏内容限制得分）× 分队系数，向下取整'
    },

    /* ---------- 分队 ---------- */
    teams: [
      { id: 'origin', name: '本源研修分队', coeff: 1 },
      { id: 'civil', name: '文明开化分队', coeff: 0.9, special: 'civil' },
      { id: 'pioneer', name: '开拓者分队', coeff: 1 },
      { id: 'trade', name: '多边贸易分队', coeff: 0.9, special: 'trade' },
      { id: 'geology', name: '地质调查分队', coeff: 1 },
      { id: 'command', name: '指挥分队', coeff: 1 },
      { id: 'special', name: '特勤分队', coeff: 1 },
      { id: 'logistics', name: '后勤分队', coeff: 1 },
      { id: 'spearhead', name: '矛头分队', coeff: 1 },
      { id: 'assault', name: '突击战术分队（近卫/先锋）', coeff: 1, classTeam: ['近卫', '先锋'] },
      { id: 'fortress', name: '堡垒战术分队（重装/辅助）', coeff: 1, classTeam: ['重装', '辅助'] },
      { id: 'ranged', name: '远程战术分队（医疗/狙击）', coeff: 1, classTeam: ['医疗', '狙击'] },
      { id: 'destruction', name: '破坏战术分队（术师/特种）', coeff: 1, classTeam: ['术师', '特种'] },
      { id: 'highground', name: '高台突破分队', coeff: 1 },
      { id: 'ground', name: '地面突破分队', coeff: 1 },
      { id: 'unity', name: '团结阵线分队', coeff: 1 },
      { id: 'traverse', name: '踏足遍历分队', coeff: 0.9, special: 'traverse' }
    ],

    /* ---------- 干员（每职业 3 名受限干员） ---------- */
    classes: [
      { name: '先锋', operators: ['可露希尔', '凛御银灰', '伊内丝'] },
      { name: '近卫', operators: ['塔露拉', '克莱门莎', '赤刃明霄陈'] },
      { name: '重装', operators: ['珊比', '斩业星熊', '余'] },
      { name: '狙击', operators: ['维什戴尔', '空弦（特限模组）', '焰狐龙梓兰'] },
      { name: '术师', operators: ['圣聆初雪', '真言', '妮芙'] },
      { name: '医疗', operators: ['凯尔希·思衡托', 'Mon3tr', '纯烬艾雅法拉'] },
      { name: '辅助', operators: ['冻河', '酒神', '灵知（特限模组）'] },
      { name: '特种', operators: ['结城理', '予愿安洁莉娜', '望'] }
    ],
    officerRules: [
      { count: 1, score: 0, detail: '招募 1 位：不扣分' },
      { count: 2, score: -200, detail: '招募 2 位：−200 分（对应职业队 2 位以内不减分）' },
      { count: 3, score: -500, detail: '招募 3 位：−500 分（对应职业队同样 −500）' }
    ],

    /* ---------- 紧急作战（普通作战&紧急作战栏，均取「紧急版本」） ---------- */
    emergency: {
      basePerLayer: 10,
      baseFormula: '10 × 所属层数 ÷ 通关时层数',
      lifeBlueprintMultiplier: 1.5,
      // 九、作战得分：未损失生命/护盾拿完整加分；损失 ≤3 点拿一半；更多则不计作战加分。
      // 表 9-1 标注的额外分与基础分、灵魂归宿敌人分一起按该比例结算。
      damage: {
        options: [
          { id: 'none', name: '未损失生命/护盾', factor: 1, detail: '完整加分' },
          { id: 'le3', name: '损失 ≤3 点', factor: 0.5, detail: '一半加分' },
          { id: 'over3', name: '损失 >3 点', factor: 0, detail: '不计作战加分' }
        ],
        escortMultiplier: 1.2,
        escortDetail: '熄日余径中成功保护探险者，额外 ×1.2'
      },
      stages: [
        { id: 'e1-hound', name: '猎犬病原', layer: 1 },
        { id: 'e1-forget', name: '遗忘时间', layer: 1 },
        { id: 'e1-impatient', name: '急不可耐', layer: 1 },
        { id: 'e1-sage', name: '灌水贤者', layer: 1 },

        { id: 'e2-arcade', name: '虫虫游戏厅', layer: 2 },
        { id: 'e2-terra', name: '无主地', layer: 2 },
        { id: 'e2-instinct', name: '本性难移', layer: 2 },
        { id: 'e2-hunt', name: '远北猎场', layer: 2 },
        { id: 'e2-trap', name: '枝头陷阱', layer: 2 },
        { id: 'e2-corn', name: '木本玉米', layer: 2 },

        { id: 'e3-budget', name: '预算否决', layer: 3 },
        { id: 'e3-habit', name: '生存习性', layer: 3 },
        { id: 'e3-path', name: '辟路行进', layer: 3 },
        { id: 'e3-loot', name: '趁火打劫', layer: 3 },
        { id: 'e3-scorch', name: '焦土之家', layer: 3 },
        { id: 'e3-reverse', name: '黑色逆流', layer: 3 },
        { id: 'e3-roundstone', name: '圆石技艺', layer: 3, extra: 100 },

        { id: 'e4-future', name: '未来见闻', layer: 4 },
        { id: 'e4-plantation', name: '种植园惊魂', layer: 4, extra: 50 },
        { id: 'e4-side', name: '选边站', layer: 4 },
        { id: 'e4-birth', name: '诞生礼', layer: 4 },
        { id: 'e4-escort', name: '暴力押运', layer: 4 },
        { id: 'e4-blade', name: '长刀寒夜', layer: 4 },
        { id: 'e4-home', name: '侵占家园', layer: 4 },
        { id: 'e4-view', name: '取景圣地', layer: 4, extra: 70 },
        { id: 'e4-revolt', name: '安魂节起义', layer: 4, extra: 70 },

        { id: 'e5-step', name: '一步之遥', layer: 5 },
        { id: 'e5-desire', name: '物欲遮天', layer: 5 },
        { id: 'e5-wage', name: '恶意讨薪', layer: 5 },
        { id: 'e5-farewell', name: '送别仪式', layer: 5 },
        { id: 'e5-wine', name: '彼处水如酒', layer: 5 },
        { id: 'e5-jungle', name: '丛林法则', layer: 5 },
        { id: 'e5-breed', name: '过度繁殖', layer: 5 },
        { id: 'e5-soul', name: '灵魂归宿', layer: 5, extra: 0, soulHome: true },
        { id: 'e5-thorn', name: '刺生灾害', layer: 5, extra: 70 },

        { id: 'e6-fate', name: '命运共享', layer: 6, extra: 50 },
        { id: 'e6-coexist', name: '同域共存', layer: 6, extra: 150 },
        { id: 'e6-barren', name: '贫瘠行军', layer: 6, extra: 70 },
        { id: 'e6-bond', name: '不解之缘', layer: 6, extra: 50 }
      ],
      // 9.2 紧急灵魂归宿：按「列」给出敌人加分
      soulHome: {
        name: '紧急灵魂归宿',
        layer: 5,
        columns: [
          { name: '医疗符文列', enemies: [{ name: '狂暴宿主组长', score: 30 }, { name: 'R-11a突击动力装甲', score: 30 }, { name: '马特奥的近卫', score: 20 }] },
          { name: '特种战术点列', enemies: [{ name: '乌顶巨角卢鲁', score: 20 }, { name: '水遁宗师', score: 15 }, { name: '弧光锋卫长', score: 10 }] },
          { name: '活性源石列', enemies: [{ name: '乌萨斯战争术师', score: 30 }, { name: '匪帮轰击者头目', score: 20 }] },
          { name: '地穴列', enemies: [{ name: '“逐日的树”', score: 30 }, { name: '“萨科塔昂首”', score: 10 }] },
          { name: '不可阻挡列', enemies: [{ name: '撼地遗众', score: 30 }, { name: '木裂战士', score: 30 }] }
        ]
      }
    },

    /* ---------- 特殊事件 / 特殊作战（有固定分，不走紧急基础分） ---------- */
    specialBattles: [
      { id: 'sp-noautopsy', name: '无效验尸', score: 70, firstOnly: true, detail: '仅首次挑战可获得分数奖励' },
      { id: 'sp-ashpit', name: '灰坑', layerScores: { 3: 150, 4: 100, 5: 50 }, firstOnly: true, needLayer: true, detail: '仅首次挑战；按通关层数 3/4/5 取 150/100/50' },
      { id: 'sp-lake', name: '湖中魇', score: 50, detail: '固定 +50' },
      { id: 'sp-lake-emergency', name: '紧急 湖中魇', score: 70, detail: '固定 +70' },
      { id: 'sp-partner', name: '合伙人会议', score: 30, detail: '固定 +30' },
      { id: 'sp-partner-emergency', name: '紧急 合伙人会议', score: 50, detail: '固定 +50' }
    ],

    /* ---------- 追猎作战 ---------- */
    hunts: {
      name: '追猎作战',
      items: [
        { id: 'h-flame', name: '易燃隐患', score: 30 },
        { id: 'h-fang', name: '外显尖牙', score: 50 },
        { id: 'h-wrath', name: '“纵怒”', score: 30 },
        { id: 'h-destroy', name: '“灭身”', score: 30 },
        { id: 'h-insect', name: '晶矿惊蝗', score: 30, altScore: 100, altDetail: '晶珑兽击杀的晶玲兽 ≤3 只时 +100' }
      ]
    },

    /* ---------- 结局 ---------- */
    endings: [
      { id: 'en-nowhere', name: '永无安宁', score: 0 },
      { id: 'en-pain', name: '痛苦将息', score: 50 },
      { id: 'en-chaos', name: '混沌源阶理论', score: 50 },
      { id: 'en-imbalance', name: '失衡常量', score: 200 },
      { id: 'en-aberrant', name: '畸症', score: 300 },
      { id: 'en-sunset', name: '熄日', score: 300, killBonus: 200, killName: '沉沦之人' }
    ],

    /* ---------- 藏品 ---------- */
    collectibles: {
      collectiblePoint: { per: 3, cap: 100, detail: '每拥有一个藏品 +3（超过 100 个不加分）' },
      sandbox: { alpha: 30, beta: 20, both: 30, detail: '沙盘α +30、沙盘β +20；同时持有额外 +30' },
      beacon: { name: '怦然信标', score: 30 },
      weak: {
        name: '三削弱藏',
        each: 30,
        fateBonus: 50,
        detail: '每件 +30；在「源流交汇处」层的命运所指若未上交上述任何藏品，每持有一个再 +50',
        items: [
          { id: 'god', name: '击坠“神明”' },
          { id: 'light', name: '湮没“光明”' },
          { id: 'civil', name: '焚毁“文明”' }
        ]
      },
      sunPact: { name: '祭日之契', perLayer: 150, maxLayers: 3, detail: '最多携带 3 层，每层 +150' },
      lifeBlueprint: { name: '生命蓝图', score: 200, multiplier: 1.5, detail: '+200；携带该藏品的紧急作战和 boss 战得分 ×1.5' },
      kibo: { name: '谒日之祈', score: 0, detail: '规则标注为 0 分' }
    },

    /* ---------- 险路恶敌（boss 战，享受单独分值，不吃熄日余径倍率） ---------- */
    bossMaps: [
      { id: 'b-iron', leader: '汉科', name: '铁腕迷思', normal: 20, sunset: 30 },
      { id: 'b-expedition', leader: '德莱昂', name: '光荣远征', normal: 30, sunset: 30, goldNormal: 50, goldSunset: 100, goldDetail: '赤金条进入目标点额外加分' },
      { id: 'b-zeal', leader: '埃尔伯特', name: '狂热敬虔', normal: 20, sunset: 50 },
      { id: 'b-gold', leader: '德莱昂', name: '赤金厄运', normal: 50, sunset: 50 },
      { id: 'b-mourn', leader: '汉科', name: '哀悼铁腕', normal: 50, sunset: 50 },
      { id: 'b-exile', leader: '埃尔伯特', name: '冰冷流亡', normal: 30, sunset: 50 }
    ],

    /* ---------- 实托邦（只保留「储藏室」商店加分；倍率作为紧急作战选项） ---------- */
    stoas: {
      note: '实托邦倍率作为「紧急作战」的选项参与计分；未给出的倍率按 ×1。',
      storage: { name: '“储藏室”', shops: 100, detail: '每进入一次受储藏室影响的商店节点 +100' },
      types: [
        { id: 'st-blackflow', name: '“黑流地脉”', multiplier: 1.5 },
        { id: 'st-dune', name: '“倾斜沙丘”', multiplier: 1 },
        { id: 'st-gowen', name: '“去温栏”', multiplier: 1.5 },
        { id: 'st-capsule', name: '“微型胶囊”', multiplier: 1.1 },
        { id: 'st-fragile', name: '“易碎同盟”', multiplier: 1.1 },
        { id: 'st-stop', name: '“停止点”', multiplier: 1.2 },
        { id: 'st-mist', name: '“弥散虚雾”', multiplier: 1 }
      ]
    },

    /* ---------- 乌托邦（特殊区域，不与实托邦/熄日余径同时出现） ---------- */
    utopias: {
      note: '乌托邦倍率作为「紧急作战」的选项参与计分；「源石之城」倍率由选手手填。',
      types: [
        { id: 'ut-cradle', name: '“巨人摇篮”', multiplier: 1.1 },
        { id: 'ut-disco', name: '“迪斯科狂热”', multiplier: 1 },
        { id: 'ut-havoc', name: '“已知浩劫”', multiplier: 1.1 },
        { id: 'ut-forest', name: '“孤立石林”', multiplier: 1 },
        { id: 'ut-blind', name: '“全知者盲区”', multiplier: 1 },
        { id: 'ut-grudge', name: '“未亡者遗怨”', multiplier: 1 },
        { id: 'ut-originium', name: '“源石之城”', multiplier: 1, manual: true },
        { id: 'ut-spiral', name: '“消耗螺旋”', multiplier: 1 },
        { id: 'ut-heart', name: '“换心联结”', multiplier: 1 }
      ]
    },

    /* ---------- 游戏内容限制（表2-1） ---------- */
    restrictions: {
      medTraining: { name: '使用医疗典训进阶诺威尔、乌啾', score: -500 },
      boardvine: { name: '板藤（获得当层或下层未丢弃/售出）', perNode: -200, detail: '每超出 1 节点 −200' },
      originium: {
        name: '结算后源石锭较入局前减少 >10',
        perUnit: -5,
        threshold: 10,
        detail: '只看「减少」方向；减少超过 10 时，超出部分每 1 个 −5'
      },
      kills: { name: '击杀鸭爵/高普尼克/流泪小子/圆仔（不含空植体）', per: 10, detail: '每个 +10' },
      errorRoom: { name: '触发错误房', score: 200, detail: '触发错误房 +200' },
      infant: { name: '培养种子产生「襁褓生灵」', per: 15, detail: '每个 +15' },
      spike: { name: '击杀刺箱', per: 7, detail: '每个 +7' },
      mimic: { name: '击杀宝箱怪', per: 10, detail: '每个 +10' },
      explorerDeath: { name: '探险者死亡', score: -150, detail: '每死亡 1 次 −150（原文未写单位）' },
      collectiblePoint: { name: '藏品数量', per: 3, cap: 100, detail: '每个藏品 +3，超过 100 个不加分' }
    },

    /* ---------- 分队附加限制与扣分 ---------- */
    teamRules: {
      civil: {
        name: '文明开化分队',
        coeff: 0.9,
        nonHuntEntry: { name: '1–4 层非追猎方式进入下一层', score: -300, detail: '每次 −300，最多 4 次' },
        pioneerExchange: { name: '「失与得」交换「探测先锋」', score: -200, detail: '每有一层 −200' },
        idealMissed: { name: '离开本层未清理「理想源」', score: -200, detail: '每次 −200' },
        forfeitStoa: true,
        huntOnlyCoeff: {
          enabled: true,
          coeff: 1,
          floors: [1, 2, 4],
          detail: '在 1、2、4 层全部通过「险路尽头/险路小径」选择离开黑池/自己找路后直接进入追猎时，最终系数改为 1'
        }
      },
      trade: {
        name: '多边贸易分队',
        coeff: 0.9,
        naturalOverNode: { name: '3 层及之后携带自然物 >5', score: -50, detail: '每经过 1 节点 −50' },
        note: '第 1 层行商不得售出「枯苔藓球」、开局立刻丢弃「种子」——违反即无法继续比赛，不进入计分。'
      },
      traverse: {
        name: '踏足遍历分队',
        coeff: 0.9,
        processedOverNode: { name: '携带加工品 >5', score: -50, detail: '每经过 1 节点 −50' }
      }
    }
  };

  return RULES;
});
