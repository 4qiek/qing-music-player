/**
 * cityPoem.js — 城市诗句卡片
 * 根据当前城市（跟随天气模块），随机展示与该城市相关的诗句 / 文学描写。
 * 点击"换一句"重新随机。
 */
import { store } from './store.js';

/** 城市 → 诗句库（text 诗句 / 描写，from 出处） */
const CITY_POEMS = {
  扬州: [
    { text: '故人西辞黄鹤楼，烟花三月下扬州。', from: '李白《黄鹤楼送孟浩然之广陵》' },
    { text: '天下三分明月夜，二分无赖是扬州。', from: '徐凝《忆扬州》' },
    { text: '二十四桥明月夜，玉人何处教吹箫。', from: '杜牧《寄扬州韩绰判官》' },
    { text: '春风十里扬州路，卷上珠帘总不如。', from: '杜牧《赠别》' },
    { text: '十年一觉扬州梦，赢得青楼薄幸名。', from: '杜牧《遣怀》' },
    { text: '淮左名都，竹西佳处，解鞍少驻初程。', from: '姜夔《扬州慢》' },
    { text: '夹岸垂杨三百里，只应图画最相宜。', from: '杜牧《隋堤柳》' }
  ],
  北京: [
    { text: '前不见古人，后不见来者。念天地之悠悠，独怆然而涕下。', from: '陈子昂《登幽州台歌》' },
    { text: '燕山雪花大如席，片片吹落轩辕台。', from: '李白《北风行》' },
    { text: '望长城内外，惟余莽莽；大河上下，顿失滔滔。', from: '毛泽东《沁园春·雪》' }
  ],
  上海: [
    { text: '春申江水连天碧，十里洋场万国灯。', from: '沪上旧句' },
    { text: '夜上海，夜上海，你是个不夜城。', from: '歌曲《夜上海》' }
  ],
  南京: [
    { text: '烟笼寒水月笼沙，夜泊秦淮近酒家。', from: '杜牧《泊秦淮》' },
    { text: '旧时王谢堂前燕，飞入寻常百姓家。', from: '刘禹锡《乌衣巷》' },
    { text: '朱雀桥边野草花，乌衣巷口夕阳斜。', from: '刘禹锡《乌衣巷》' },
    { text: '山围故国周遭在，潮打空城寂寞回。', from: '刘禹锡《石头城》' }
  ],
  杭州: [
    { text: '欲把西湖比西子，淡妆浓抹总相宜。', from: '苏轼《饮湖上初晴后雨》' },
    { text: '最爱湖东行不足，绿杨阴里白沙堤。', from: '白居易《钱塘湖春行》' },
    { text: '接天莲叶无穷碧，映日荷花别样红。', from: '杨万里《晓出净慈寺送林子方》' },
    { text: '山外青山楼外楼，西湖歌舞几时休。', from: '林升《题临安邸》' }
  ],
  苏州: [
    { text: '月落乌啼霜满天，江枫渔火对愁眠。', from: '张继《枫桥夜泊》' },
    { text: '姑苏城外寒山寺，夜半钟声到客船。', from: '张继《枫桥夜泊》' },
    { text: '君到姑苏见，人家尽枕河。', from: '杜荀鹤《送人游吴》' },
    { text: '姑苏台上乌栖时，吴王宫里醉西施。', from: '李白《乌栖曲》' }
  ],
  成都: [
    { text: '晓看红湿处，花重锦官城。', from: '杜甫《春夜喜雨》' },
    { text: '丞相祠堂何处寻？锦官城外柏森森。', from: '杜甫《蜀相》' },
    { text: '锦城丝管日纷纷，半入江风半入云。', from: '杜甫《赠花卿》' }
  ],
  西安: [
    { text: '春风得意马蹄疾，一日看尽长安花。', from: '孟郊《登科后》' },
    { text: '长安一片月，万户捣衣声。', from: '李白《子夜吴歌》' },
    { text: '总为浮云能蔽日，长安不见使人愁。', from: '李白《登金陵凤凰台》' }
  ],
  洛阳: [
    { text: '洛阳亲友如相问，一片冰心在玉壶。', from: '王昌龄《芙蓉楼送辛渐》' },
    { text: '谁家玉笛暗飞声，散入春风满洛城。', from: '李白《春夜洛城闻笛》' }
  ],
  武汉: [
    { text: '故人西辞黄鹤楼，烟花三月下扬州。', from: '李白《黄鹤楼送孟浩然之广陵》' },
    { text: '晴川历历汉阳树，芳草萋萋鹦鹉洲。', from: '崔颢《黄鹤楼》' },
    { text: '黄鹤一去不复返，白云千载空悠悠。', from: '崔颢《黄鹤楼》' }
  ],
  长沙: [
    { text: '独立寒秋，湘江北去，橘子洲头。', from: '毛泽东《沁园春·长沙》' },
    { text: '鹰击长空，鱼翔浅底，万类霜天竞自由。', from: '毛泽东《沁园春·长沙》' }
  ],
  广州: [
    { text: '日啖荔枝三百颗，不辞长作岭南人。', from: '苏轼《惠州一绝》' },
    { text: '明月松间照，清泉石上流。', from: '王维《山居秋暝》· 岭南风物' }
  ],
  重庆: [
    { text: '朝辞白帝彩云间，千里江陵一日还。', from: '李白《早发白帝城》' },
    { text: '曾经沧海难为水，除却巫山不是云。', from: '元稹《离思》' }
  ],
  桂林: [
    { text: '桂林山水甲天下，绝妙漓江秋泛图。', from: '清·金武祥' },
    { text: '江作青罗带，山如碧玉篸。', from: '韩愈《送桂州严大夫》' }
  ],
  天津: [
    { text: '津桥春水浸红霞，烟柳风丝拂岸斜。', from: '雍陶《天津桥春望》' }
  ],
  黄山: [
    { text: '五岳归来不看山，黄山归来不看岳。', from: '明·徐霞客' }
  ],
  庐山: [
    { text: '不识庐山真面目，只缘身在此山中。', from: '苏轼《题西林壁》' },
    { text: '飞流直下三千尺，疑是银河落九天。', from: '李白《望庐山瀑布》' }
  ],
  岳阳: [
    { text: '先天下之忧而忧，后天下之乐而乐。', from: '范仲淹《岳阳楼记》' },
    { text: '气蒸云梦泽，波撼岳阳城。', from: '孟浩然《望洞庭湖赠张丞相》' }
  ],
  南昌: [
    { text: '落霞与孤鹜齐飞，秋水共长天一色。', from: '王勃《滕王阁序》' }
  ],
  兰州: [
    { text: '黄河远上白云间，一片孤城万仞山。', from: '王之涣《凉州词》' }
  ],
  呼和浩特: [
    { text: '天苍苍，野茫茫，风吹草低见牛羊。', from: '北朝民歌《敕勒歌》' }
  ],
  乌鲁木齐: [
    { text: '大漠孤烟直，长河落日圆。', from: '王维《使至塞上》' }
  ],
  拉萨: [
    { text: '住进布达拉宫，我是雪域最大的王。', from: '仓央嘉措诗传' }
  ],
  昆明: [
    { text: '四季看花花不老，一江春月是昆明。', from: '明·杨慎' }
  ],
  厦门: [
    { text: '城在海上，海在城中，白鹭低飞，浪声入梦。', from: '闽南记游' }
  ],
  青岛: [
    { text: '红瓦绿树，碧海蓝天。', from: '康有为咏青岛' }
  ],
  大连: [
    { text: '山与海在这里相遇，风里都是自由的味道。', from: '辽东海岸记' }
  ]
};

/** 兜底诗句（城市不在表中） */
const DEFAULT_POEMS = [
  { text: '此城此景，自有诗意；一街一巷，皆是文章。', from: '《城市随笔》' },
  { text: '你站在桥上看风景，看风景的人在楼上看你。', from: '卞之琳《断章》' },
  { text: '山川是不卷收的文章，日月为你掌灯伴读。', from: '简媜《空灵》' },
  { text: '世界那么大，去远方看看；城市那么美，停下来听听。', from: '《行者手记》' }
];

function getCity() {
  const w = store.get('currentWeather');
  return (w && w.city) || '扬州';
}

/** 取一句诗句；有 lastText 时尽量不与上一次重复 */
function pickPoem(city, lastText) {
  const list = CITY_POEMS[city] || DEFAULT_POEMS;
  if (list.length === 1) return list[0];
  let pick = list[Math.floor(Math.random() * list.length)];
  if (lastText && pick.text === lastText) {
    const others = list.filter((p) => p.text !== lastText);
    if (others.length) pick = others[Math.floor(Math.random() * others.length)];
  }
  return pick;
}

export function initCityPoem() {
  const el = document.getElementById('cityPoem');
  if (!el) return;
  const cityEl = el.querySelector('.cp-city');
  const textEl = el.querySelector('.cp-text');
  const fromEl = el.querySelector('.cp-from');
  const shuffleBtn = el.querySelector('.cp-shuffle');
  let lastText = '';

  function render() {
    const city = getCity();
    const poem = pickPoem(city, lastText);
    lastText = poem.text;
    cityEl.textContent = city;
    textEl.textContent = poem.text;
    fromEl.textContent = poem.from;
  }

  render();
  if (shuffleBtn) shuffleBtn.addEventListener('click', render);
  // 天气城市变化时同步
  store.subscribe('currentWeather', render);
}

export default { initCityPoem, CITY_POEMS };
