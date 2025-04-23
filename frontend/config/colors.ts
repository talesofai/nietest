/**
 * 颜色字典配置
 * 定义常用的颜色名称及其对应的十六进制值
 */

export type ColorDictionary = {
  [key: string]: string;
};

/**
 * 基础颜色字典
 */
export const baseColors: ColorDictionary = {
  // 主要颜色
  xiangyehong: "#f07c82", // 香叶红
  putaojiangzi: "#5a1216", // 葡萄酱紫
  yanhong: "#82111f", // 殷红
  yuhong: "#c04851", // 玉红
  chahuahong: "#ee3f4d", // 茶花红
  gaolianghong: "#c02c38", // 高粱红
  manjianghong: "#a7535a", // 满江红
  shubihong: "#e3b4b8", // 鼠鼻红
  hehuanhong: "#f0a1a8", // 合欢红
  chunmeihong: "#f1939c", // 春梅红
  xiancaihong: "#a61b29", // 苋菜红
  meihong: "#c45a65", // 莓红
  eguanhong: "#d11a2d", // 鹅冠红
  fengyehong: "#c21f30", // 枫叶红
  tangchangpuhong: "#de1c31", // 唐菖蒲红
  zaohong: "#7c1823", // 枣红
  zhuganzi: "#541e24", // 猪肝紫
  putaozi: "#4c1f24", // 葡萄紫
  anziyuanhong: "#82202b", // 暗紫苑红
  caomolihong: "#ef475d", // 草茉莉红
  jiangzi: "#4d1018", // 酱紫
  shanchahong: "#ed556a", // 山茶红
  xinhui: "#7a7374", // 锌灰
  haitanghong: "#f03752", // 海棠红
  jifenhong: "#e6d2d5", // 蓟粉红
  shiruihong: "#f0c9cf", // 石蕊红
  danshuhong: "#ed4845", // 淡菽红
  shizhuhong: "#ee4863", // 石竹红
  danqianhong: "#e77c8e", // 淡茜红
  jinyuzi: "#500a16", // 金鱼紫
  shanlidouhong: "#c27c88", // 山黎豆红
  shubeihui: "#73575c", // 鼠背灰
  danruixianghong: "#ee4866", // 淡蕊香红
  ganzhezi: "#621624", // 甘蔗紫
  yuejihong: "#ce5777", // 月季红
  jianjingyuhong: "#cc163a", // 尖晶玉红
  shuihong: "#f1c4cd", // 水红
  jianghong: "#eeb8c3", // 姜红
  luhui: "#856d72", // 芦灰
  qiepizi: "#2d0c13", // 茄皮紫
  cangyinghui: "#36282b", // 苍蝇灰
  jinkuihong: "#bf3553", // 锦葵红
  fentuanhuahong: "#ec9bad", // 粉团花红
  shizhuzi: "#63071c", // 石竹紫
  luanshizi: "#30161c", // 卵石紫
  jinghong: "#eea6b7", // 晶红
  zhilanzi: "#e9ccd3", // 芝兰紫
  shaoyaogenghong: "#eba0b3", // 芍药耕红
  muyunhui: "#4f383e", // 暮云灰
  jiangdouhong: "#ed9db2", // 豇豆红
  baochunhong: "#ec8aa4", // 报春红
  danjianghong: "#ec7696", // 淡绛红
  fengxianhuahong: "#ea7293", // 凤仙花红
  xiaguanghong: "#ef82a0", // 霞光红
  xidanhong: "#ec2c64", // 喜蛋红
  jiazhutaohong: "#eb507e", // 夹竹桃红
  songyemudanhong: "#eb3c70", // 松叶牡丹红
  lianbanhong: "#ea517f", // 莲瓣红
  baijihong: "#de7897", // 白芨红
  yinhonghui: "#b598a1", // 隐红灰
  wenpohong: "#ed2f6a", // 榲桲红
  cujiangcaohong: "#c5708b", // 酢酱草红
  huoezi: "#33141e", // 火鹅紫
  yaoguanzi: "#621d34", // 鹞冠紫
  pinhong: "#ef3473", // 品红
  moshizi: "#382129", // 磨石紫
  mozi: "#310f1b", // 墨紫
  tanzi: "#381924", // 檀紫
  chuhehong: "#e16c96", // 初荷红
  caitouzi: "#951c48", // 菜头紫
  putaojiuhong: "#62102e", // 葡萄酒红
  danqingzi: "#e0c8d1", // 淡青紫
  bogenhong: "#d13c74", // 菠根红
  haixiangzi: "#4b1e2f", // 海象紫
  tuyanhong: "#ec4e8a", // 兔眼红
  nenlinghong: "#de3f7c", // 嫩菱红
  yangcongzi: "#a8456b", // 洋葱紫
  diaozhonghuahong: "#ce5e8a", // 吊钟花红
  ganzi: "#461629", // 绀紫
  zijinghong: "#ee2c79", // 紫荆红
  biandouhuahong: "#ef498b", // 扁豆花红
  mabiancaozi: "#ede3e7", // 马鞭草紫
  canghuahong: "#ec2d7a", // 藏花红
  banjiuhui: "#482936", // 斑鸠灰
  gutongzi: "#440e25", // 古铜紫
  danzihong: "#d2568c", // 丹紫红
  dingxiangdanzi: "#e9d7df", // 丁香淡紫
  meiguihong: "#d2357d", // 玫瑰红
  gudinghui: "#36292f", // 古鼎灰
  lingmenghong: "#d276a3", // 菱锰红
  yingcaozi: "#c06f98", // 樱草紫
  longxuhong: "#cc5595", // 龙须红
  dianqishihong: "#c35691", // 电气石红
  meiguizi: "#ba2f7b", // 玫瑰紫
  xiancaizi: "#9b1e64", // 苋菜紫
  zihui: "#5d3f51", // 紫灰
  longjingyuzi: "#4e2a40", // 龙睛鱼紫
  qinghakezi: "#bc84a8", // 青蛤壳紫
  luolanzi: "#c08eaf", // 萝兰紫
  biqizi: "#411c35", // 荸荠紫
  doukouzi: "#ad6598", // 豆蔻紫
  biandouzi: "#a35c8f", // 扁豆紫
  qianniuzi: "#681752", // 牵牛紫
  zizi: "#894276", // 芓紫
  gejinzi: "#7e2065", // 葛巾紫
  qinglian: "#8b2671", // 青莲
  jiehuazi: "#983680", // 芥花紫
  fengxinzi: "#c8adc4", // 凤信紫
  shenqianniuzi: "#1c0d1a", // 深牵牛紫
  weizi: "#7e1671", // 魏紫
  wumeizi: "#1e131d", // 乌梅紫
  jiegengzi: "#813c85", // 桔梗紫
  danqianniuzi: "#d1c2d3", // 淡牵牛紫
  jianfengzi: "#3e3841", // 剑锋紫
  xunzi: "#815c94", // 蕈紫
  jinzi: "#806d9e", // 槿紫
  qianshibai: "#e2e1e4", // 芡食白
  longkuizi: "#322f3b", // 龙葵紫
  tengluozi: "#8076a3", // 藤萝紫
  shayuhui: "#35333c", // 沙鱼灰
  anlongdanzi: "#22202e", // 暗龙胆紫
  anlanzi: "#131124", // 暗蓝紫
  yeputaozi: "#302f4b", // 野葡萄紫
  yejuzi: "#525288", // 野菊紫
  shuiniuhui: "#2f2f35", // 水牛灰
  yuanshanzi: "#ccccd6", // 远山紫
  luodianzi: "#74759b", // 螺甸紫
  jingshizi: "#1f2040", // 晶石紫
  mantianxingzi: "#2e317c", // 满天星紫
  danlanzi: "#a7a8bd", // 淡蓝紫
  shangengzi: "#61649f", // 山梗紫
  niujiaohui: "#2d2e36", // 牛角灰
  yuweihui: "#5e616d", // 鱼尾灰
  waguanhui: "#47484c", // 瓦罐灰
  ganglan: "#0f1423", // 钢蓝
  yanhanlan: "#131824", // 燕颔蓝
  jingyuhui: "#475164", // 鲸鱼灰
  qinghui: "#2b333e", // 青灰
  gelan: "#1c2938", // 鸽蓝
  anlan: "#101f30", // 暗蓝
  gangqing: "#142334", // 钢青
  haitaolan: "#15559a", // 海涛蓝
  feiyancaolan: "#0f59a4", // 飞燕草蓝
  dianqing: "#1661ab", // 靛青
  ananlan: "#3170a7", // 安安蓝
  haijunlan: "#346c9c", // 海军蓝
  jingtailan: "#2775b6", // 景泰蓝
  pinlan: "#2b73af", // 品蓝
  niluolan: "#2474b5", // 尼罗蓝
  diechilan: "#4e7ca1", // 蝶翅蓝
  huaqing: "#2376b7", // 花青
  yanlan: "#144a74", // 鷃蓝
  xinglan: "#93b5cf", // 星蓝
  honglan: "#2177b8", // 虹蓝
  bolinlan: "#126bae", // 柏林蓝
  qunqing: "#1772b4", // 群青
  yunshuilan: "#baccd9", // 云水蓝
  yushandoulan: "#619ac3", // 羽扇豆蓝
  zhanjianhui: "#495c69", // 战舰灰
  qingshanlan: "#8fb2c9", // 晴山蓝
  jinglan: "#5698c3", // 睛蓝
  tangcilan: "#11659a", // 搪磁蓝
  chaolan: "#2983bb", // 潮蓝
  tianlan: "#1677b3", // 天蓝
  dalishihui: "#c4cbcf", // 大理石灰
  qianniuhualan: "#1177b0", // 牵牛花蓝
  baoshilan: "#2486b9", // 宝石蓝
  danlanhui: "#5e7987", // 淡蓝灰
  nenhui: "#74787a", // 嫩灰
  yinyubai: "#cdd1d3", // 银鱼白
  youlan: "#1781b5", // 釉蓝
  jianshilan: "#66a9c9", // 涧石蓝
  yuantianlan: "#d0dfe6", // 远天蓝
  yunshanlan: "#2f90b9", // 云山蓝
  qiubolan: "#8abcd1", // 秋波蓝
  jingtianlan: "#c3d7df", // 井天蓝
  yuanweilan: "#158bb8", // 鸢尾蓝
  yunfengbai: "#d8e3e7", // 云峰白
  xinghui: "#b2bbbe", // 星灰
  gulan: "#1a94bc", // 钴蓝
  biqing: "#5cb3cc", // 碧青
  canglan: "#134857", // 苍蓝
  shenhuilan: "#132c33", // 深灰蓝
  huilan: "#21373d", // 灰蓝
  hushuilan: "#b0d5df", // 湖水蓝
  haiqing: "#22a2c3", // 海青
  huanghunhui: "#474b4c", // 黄昏灰
  jiqing: "#63bbd0", // 霁青
  yuqinlan: "#126e82", // 玉鈫蓝
  danfanlan: "#0f95b0", // 胆矾蓝
  jianniaolan: "#1491a8", // 樫鸟蓝
  oulan: "#c7d2d4", // 鸥蓝
  cuilan: "#1e9eb3", // 翠蓝
  qingtinglan: "#3b818c", // 蜻蜓蓝
  kongquelan: "#0eb0c9", // 孔雀蓝
  weilan: "#29b7cb", // 蔚蓝
  pubulan: "#51c4d3", // 瀑布蓝
  shanlan: "#7cabb1", // 闪蓝
  dianzilan: "#10aec2", // 甸子蓝
  wanbolan: "#648e93", // 晚波蓝
  qingshuilan: "#93d5dc", // 清水蓝
  xiayunhui: "#617172", // 夏云灰
  haitianlan: "#c6e6e8", // 海天蓝
  xiakeqing: "#869d9d", // 虾壳青
  shilv: "#57c3c2", // 石绿
  qionghui: "#c4d7d6", // 穹灰
  meidielv: "#12aa9c", // 美蝶绿
  ehui: "#737c7b", // 垩灰
  lanlv: "#12a182", // 蓝绿
  zhulv: "#1ba784", // 竹绿
  yadinglv: "#428675", // 亚丁绿
  yueyingbai: "#c0c4c3", // 月影白
  haiwanglv: "#248067", // 海王绿
  shenhailv: "#1a3b32", // 深海绿
  lvhui: "#314a43", // 绿灰
  qingfanlv: "#2c9678", // 青矾绿
  canglv: "#223e36", // 苍绿
  feiquanlv: "#497568", // 飞泉绿
  mangconglv: "#141e1b", // 莽丛绿
  wuzhilv: "#69a794", // 梧枝绿
  tonglv: "#2bae85", // 铜绿
  caoyuanyuanlv: "#9abeaf", // 草原远绿
  walv: "#45b787", // 蛙绿
  langhualv: "#92b3a5", // 浪花绿
  ganlanlv: "#5e5314", // 橄榄绿
  fenlv: "#83cbac", // 粉绿
  danlvhui: "#70887d", // 淡绿灰
  maimiaolv: "#55bb8a", // 麦苗绿
  cuilv: "#20a162", // 翠绿
  conglv: "#40a070", // 葱绿
  heyelv: "#1a6840", // 荷叶绿
  danlv: "#61ac85", // 淡绿
  tianyuanlv: "#68b88e", // 田园绿
  yuzanlv: "#a4cab6", // 玉簪绿
  chanlv: "#3c9566", // 蟾绿
  koushaolv: "#5dbe8a", // 蔻梢绿
  bohelv: "#207f4c", // 薄荷绿
  yuebai: "#eef7f2", // 月白
  danbaishilv: "#579572", // 蛋白石绿
  zhuhuanglv: "#b9dec9", // 竹篁绿
  kongquelv: "#229453", // 孔雀绿
  gongdianlv: "#20894d", // 宫殿绿
  yunshanlv: "#15231b", // 云杉绿
  maolv: "#66c18c", // 毛绿
  bingshanlan: "#a4aca7", // 冰山蓝
  minghui: "#8a988e", // 明灰
  minglv: "#9eccab", // 明绿
  songshuanglv: "#83a78d", // 松霜绿
  baiqucailv: "#485b4d", // 白屈菜绿
  langyanhui: "#5d655f", // 狼烟灰
  wasonglv: "#6e8b74", // 瓦松绿
  hujishenglv: "#2b312c", // 槲寄生绿
  dancuilv: "#c6dfc8", // 淡翠绿
  yusuilv: "#41b349", // 玉髓绿
  xianlv: "#43b244", // 鲜绿
  youlv: "#253d24", // 油绿
  baoshilv: "#41ae3c", // 宝石绿
  jialingshuilv: "#add5a2", // 嘉陵水绿
  tianluolv: "#5e665b", // 田螺绿
  shuilv: "#8cc269", // 水绿
  yingwulv: "#5bae23", // 鹦鹉绿
  aibeilv: "#dfecd5", // 艾背绿
  ailv: "#cad3c3", // 艾绿
  niehui: "#9fa39a", // 镍灰
  ganlanshilv: "#b2cf87", // 橄榄石绿
  yalv: "#96c24e", // 芽绿
  nenjulv: "#f0f5e5", // 嫩菊绿
  luweilv: "#b7d07a", // 芦苇绿
  yaohuang: "#d0deaa", // 姚黄
  enyoulv: "#373834", // 蒽油绿
  pingguolv: "#bacf65", // 苹果绿
  haimeilv: "#e2e7bf", // 海沬绿
  ganlanhuanglv: "#bec936", // 橄榄黄绿
  huaihuahuanglv: "#d2d97a", // 槐花黄绿
  diehuang: "#e2d849", // 蝶黄
  xiangyabai: "#fffef8", // 象牙白
  xuebai: "#fffef9", // 雪白
  danhuilv: "#ad9e5f", // 淡灰绿
  foshouhuang: "#fed71a", // 佛手黄
  rubai: "#f9f4dc", // 乳白
  xiangjiaohuang: "#e4bf11", // 香蕉黄
  xinhelv: "#d2b116", // 新禾绿
  youcaihuahuang: "#fbda41", // 油菜花黄
  qiukuihuang: "#eed045", // 秋葵黄
  youhuang: "#fcb70a", // 鼬黄
  caohuang: "#d2b42c", // 草黄
  liuhuahuang: "#f2ce2b", // 硫华黄
  jianghuang: "#e2c027", // 姜黄
  tanshuilv: "#645822", // 潭水绿
  jinguahuang: "#fcd217", // 金瓜黄
  maiganhuang: "#f8df70", // 麦秆黄
  haohuang: "#dfc243", // 蒿黄
  molihuang: "#f8df72", // 茉莉黄
  tenghuang: "#ffd111", // 藤黄
  mangguohuang: "#ddc871", // 芒果黄
  haishenhui: "#fffefa", // 海参灰
  biluochunlv: "#867018", // 碧螺春绿
  tailv: "#887322", // 苔绿
  ningmenghuang: "#fcd337", // 柠檬黄
  caohuilv: "#8e804b", // 草灰绿
  xiangrikuihuang: "#fecc11", // 向日葵黄
  suxinhuang: "#fccb16", // 素馨黄
  ruyahuang: "#ffc90c", // 乳鸭黄
  yuehui: "#b7ae8f", // 月灰
  kuishanhuang: "#f8d86a", // 葵扇黄
  dadouhuang: "#fbcd31", // 大豆黄
  jinzhanhuang: "#fcc307", // 金盏黄
  juleibai: "#e9ddb6", // 菊蕾白
  huanglianhuang: "#fcc515", // 黄连黄
  xingrenhuang: "#f7e8aa", // 杏仁黄
  guhuang: "#e8b004", // 谷黄
  muguahuang: "#f9c116", // 木瓜黄
  danjianhuang: "#f9d770", // 淡茧黄
  yalihuang: "#fbc82f", // 雅梨黄
  yinbai: "#f1f0ed", // 银白
  zonglvlv: "#5b4913", // 棕榈绿
  yingwuguanhuang: "#f6c430", // 鹦鹉冠黄
  kulv: "#b78d12", // 枯绿
  qianlaohuang: "#f9bd10", // 浅烙黄
  danmihuang: "#f9d367", // 淡密黄
  jiehuang: "#d9a40e", // 芥黄
  zhizihuang: "#ebb10d", // 栀子黄
  anhaishuilv: "#584717", // 暗海水绿
  miehuang: "#f7de98", // 篾黄
  bangroubai: "#f9f1db", // 蚌肉白
  chaomihuang: "#f4ce69", // 炒米黄
  hupohuang: "#feba07", // 琥珀黄
  huilv: "#8a6913", // 灰绿
  zongyelv: "#876818", // 粽叶绿
  chenhui: "#b6a476", // 尘灰
  xiangyahuang: "#f0d695", // 象牙黄
  jiaoqing: "#87723e", // 鲛青
  douzhihuang: "#f8e8c1", // 豆汁黄
  tuhuang: "#d6a01d", // 土黄
  xiangshuimeiguihuang: "#f7da94", // 香水玫瑰黄
  hupihuang: "#eaad1a", // 虎皮黄
  jidanhuang: "#fbb612", // 鸡蛋黄
  yinshuhui: "#b5aa90", // 银鼠灰
  yudubai: "#f7f4ed", // 鱼肚白
  chushuxinghuang: "#f8bc31", // 初熟杏黄
  shanjihuang: "#b78b26", // 山鸡黄
  lianzibai: "#e5d3aa", // 莲子白
  xiekehui: "#695e45", // 蟹壳灰
  shashihuang: "#e5b751", // 沙石黄
  gancaohuang: "#f3bf4c", // 甘草黄
  yanyuhui: "#685e48", // 燕羽灰
  ezhanghuang: "#fbb929", // 鹅掌黄
  maiyatanghuang: "#f9d27d", // 麦芽糖黄
  qiantuose: "#e2c17c", // 浅驼色
  bailingniaohui: "#b4a992", // 百灵鸟灰
  laohuang: "#f6dead", // 酪黄
  liroubai: "#f2e6ce", // 荔肉白
  danrouse: "#f8e0b0", // 淡肉色
  hetunhui: "#393733", // 河豚灰
  yililv: "#835e1d", // 蜴蜊绿
  hanbaiyu: "#f8f4ed", // 汉白玉
  chengpihuang: "#fca104", // 橙皮黄
  laiyanglihuang: "#815f25", // 莱阳梨黄
  pipahuang: "#fca106", // 枇杷黄
  jinyehuang: "#ffa60f", // 金叶黄
  canghuang: "#806332", // 苍黄
  fenbai: "#fbf2e3", // 粉白
  danjucheng: "#fba414", // 淡橘橙
  zhenzhuhui: "#e4dfd7", // 珍珠灰
  guibeihuang: "#826b48", // 龟背黄
  qianhui: "#bbb5ac", // 铅灰
  zhonghui: "#bbb5ac", // 中灰
  xionghuang: "#ff9900", // 雄黄
  mihuang: "#fbb957", // 蜜黄
  fengfanhuang: "#dc9123", // 风帆黄
  guipidanzong: "#c09351", // 桂皮淡棕
  jinyinghuang: "#f4a83a", // 金莺黄
  rouse: "#f7c173", // 肉色
  diaoyezong: "#e7a23f", // 凋叶棕
  gutonglv: "#533c1b", // 古铜绿
  luoyingdanfen: "#f9e8d0", // 落英淡粉
  ruanmuhuang: "#de9e44", // 软木黄
  guarangfen: "#f9cb8b", // 瓜瓤粉
  liuehuang: "#f9a633", // 榴萼黄
  daimaohuang: "#daa45a", // 玳瑁黄
  jiaochalv: "#553b18", // 焦茶绿
  xiekelv: "#513c20", // 蟹壳绿
  shanjihe: "#986524", // 山鸡褐
  houmaohui: "#97846c", // 猴毛灰
  lujiaozong: "#e3bd8d", // 鹿角棕
  dansongyan: "#4d4030", // 淡松烟
  wanshoujuhuang: "#fb8b05", // 万寿菊黄
  dankehuang: "#f8c387", // 蛋壳黄
  xinghuang: "#f28e16", // 杏黄
  ganlanhui: "#503e2a", // 橄榄灰
  hehui: "#4a4035", // 鹤灰
  manaohui: "#cfccc9", // 玛瑙灰
  danyinhui: "#c1b2a3", // 淡银灰
  wahui: "#867e76", // 瓦灰
  yehui: "#847c74", // 夜灰
  beiguahuang: "#fc8c23", // 北瓜黄
  hehuabai: "#fbecde", // 荷花白
  songshuhui: "#4f4032", // 松鼠灰
  danmifen: "#fbeee2", // 淡米粉
  shenhui: "#81776e", // 深灰
  haiouhui: "#9a8878", // 海鸥灰
  chahe: "#5d3d21", // 茶褐
  tuose: "#66462a", // 驼色
  yinhui: "#918072", // 银灰
  lupihe: "#d99156", // 鹿皮褐
  binglangzong: "#c1651a", // 槟榔综
  xiaohui: "#d4c4b7", // 晓灰
  danzhe: "#be7e4a", // 淡赭
  gutonghe: "#5c3719", // 古铜褐
  jizong: "#de7622", // 麂棕
  zuiguarou: "#db8540", // 醉瓜肉
  yanhui: "#80766e", // 雁灰
  guiyuhong: "#f09c5a", // 鲑鱼红
  jucheng: "#f97d1c", // 橘橙
  jinhuang: "#f26b1f", // 金黄
  meiguifen: "#f8b37f", // 玫瑰粉
  meirenjiaocheng: "#fa7e23", // 美人焦橙
  mise: "#f9e9cd", // 米色
  zhuwanghui: "#b7a091", // 蛛网灰
  dankafei: "#945833", // 淡咖啡
  hailuocheng: "#f0945d", // 海螺橙
  yanshizong: "#964d22", // 岩石棕
  mangguozong: "#954416", // 芒果棕
  taocihong: "#e16723", // 陶瓷红
  boluohong: "#fc7930", // 菠萝红
  yujinhong: "#cf7543", // 余烬红
  jinlianhuacheng: "#f86b1d", // 金莲花橙
  huozhuanhong: "#cd6227", // 火砖红
  chutaofenhong: "#f6dcce", // 初桃粉红
  tiezong: "#d85916", // 铁棕
  jieqiaodanfenhong: "#f7cfba", // 介壳淡粉红
  xiekehong: "#f27635", // 蟹壳红
  jintuo: "#e46828", // 金驼
  yanhanhong: "#fc6315", // 燕颔红
  dankekezong: "#b7511d", // 淡可可棕
  chenxihong: "#ea8958", // 晨曦红
  yufenhong: "#e8b49a", // 玉粉红
  yeqiangweihong: "#fb9968", // 野蔷薇红
  ouhe: "#edc3ae", // 藕荷
  changshihui: "#363433", // 长石灰
  zhonghonghui: "#8b614d", // 中红灰
  huonizong: "#aa6a4c", // 火泥棕
  ganhong: "#a6522c", // 绀红
  meijianghong: "#fa5d19", // 莓酱红
  dingxiangzong: "#71361d", // 丁香棕
  danmeiguihui: "#b89485", // 淡玫瑰灰
  guaranghong: "#f68c60", // 瓜瓤红
  dancanghuahong: "#f6ad8f", // 淡藏花红
  sunpizong: "#732e12", // 筍皮棕
  runhong: "#f7cdbc", // 润红
  longjingyuhong: "#ef632b", // 龙睛鱼红
  dantuhuang: "#8c4b31", // 淡土黄
  zhumuhui: "#64483d", // 珠母灰
  furonghong: "#f9723d", // 芙蓉红
  luoxiahong: "#cf4813", // 落霞红
  faluohong: "#ee8055", // 法螺红
  caozhuhong: "#f8ebe6", // 草珠红
  kafei: "#753117", // 咖啡
  zhonghuituo: "#603d30", // 中灰驼
  yekezong: "#883a1e", // 椰壳棕
  xiemaohong: "#b14b28", // 蟹蝥红
  dandousha: "#873d24", // 淡豆沙
  dantaohong: "#f6cec1", // 淡桃红
  dantiehui: "#5b423a", // 淡铁灰
  shibanhui: "#624941", // 石板灰
  danlizong: "#673424", // 淡栗棕
  yinzhu: "#f43e06", // 银朱
  caomeihong: "#ef6f48", // 草莓红
  yangshuixianhong: "#f4c7ba", // 洋水仙红
  zhuhong: "#ed5126", // 朱红
  liuhuahong: "#f34718", // 榴花红
  shihong: "#f2481b", // 柿红
  kekezong: "#652b1c", // 可可棕
  danyingsuhong: "#eea08c", // 淡罂粟红
  dahong: "#f04b22", // 大红
  zhayezong: "#692a1b", // 柞叶棕
  qingtinghong: "#f1441d", // 蜻蜓红
  xiangshuzong: "#773d31", // 橡树棕
  jiahong: "#eeaa9c", // 颊红
  taohong: "#f0ada0", // 桃红
  huoyanzong: "#863020", // 火岩棕
  dantengluozi: "#f2e7e5", // 淡藤萝紫
  zheshi: "#862617", // 赭石
  tieshuihong: "#f5391c", // 铁水红
  yanzhihong: "#f03f24", // 胭脂红
  jiguanghong: "#f33b1f", // 极光红
  honggonghong: "#f23e23", // 红汞红
  luobohong: "#f13c22", // 萝卜红
  quhong: "#f05a46", // 曲红
  guqiaohong: "#f17666", // 谷鞘红
  pingguohong: "#f15642", // 苹果红
  guihong: "#f25a47", // 桂红
  fenhong: "#f2b9b2", // 粉红
  antuozong: "#592620", // 暗驼棕
  xiyanghong: "#de2a18", // 夕阳红
  yingtaohong: "#ed3321", // 樱桃红
  shanhuhong: "#f04a3a", // 珊瑚红
  huoshanzong: "#482522", // 火山棕
  lizong: "#5c1e19", // 栗棕
  hedinghong: "#d42517", // 鹤顶红
  shehong: "#f19790", // 舌红
  exueshihong: "#ab372f", // 鹅血石红
  jiangzong: "#5a1f1b", // 酱棕
  yusaihong: "#ed3b2f", // 鱼鳃红
  lusuihui: "#bdaead", // 芦穗灰
  lichunhong: "#eb261a", // 丽春红
  fupenzihong: "#ac1f18", // 覆盆子红
  haibaohui: "#483332", // 海报灰
  dousha: "#481e1c", // 豆沙
  liuzihong: "#f1908c", // 榴子红
  qiuhaitanghong: "#ec2b24", // 秋海棠红
  wuhuaguohong: "#efafad", // 无花果红
  danfei: "#f2cac9", // 淡绯
  meiguihui: "#4b2e2b", // 玫瑰灰
  goushuhong: "#ed3333", // 枸枢红
  diaozi: "#5d3131", // 貂紫
};

/**
 * 获取所有颜色名称的数组
 */
export const getAllColorNames = (): string[] => {
  return Object.keys(baseColors);
};

/**
 * 获取随机颜色名称
 */
export const getRandomColorName = (): string => {
  const colorNames = getAllColorNames();

  return colorNames[Math.floor(Math.random() * colorNames.length)];
};

/**
 * 获取随机颜色值
 */
export const getRandomColorValue = (): string => {
  const randomColorName = getRandomColorName();

  return baseColors[randomColorName];
};

/**
 * 获取随机渐变色值对
 * 随机选择两种不同的颜色组合生成渐变色
 */
export const getRandomGradientColors = (): { from: string; to: string } => {
  // 获取所有颜色的数组（排除了一些不适合用于渐变的颜色）
  const colorValues = Object.entries(baseColors)
    .filter(
      ([name]) =>
        !name.startsWith("gray") && name !== "black" && name !== "white",
    )
    .map(([_, value]) => value);

  // 如果颜色数量小于2，返回默认值
  if (colorValues.length < 2) {
    return { from: "#3B82F6", to: "#EC4899" };
  }

  // 随机选择第一种颜色
  const fromIndex = Math.floor(Math.random() * colorValues.length);
  const fromColor = colorValues[fromIndex];

  // 从剩余颜色中随机选择第二种颜色（确保两种颜色不同）
  let toIndex;

  do {
    toIndex = Math.floor(Math.random() * colorValues.length);
  } while (toIndex === fromIndex);

  const toColor = colorValues[toIndex];

  return { from: fromColor, to: toColor };
};
