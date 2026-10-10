export type RadioStation = {
  id: string;
  name: string;
  category: "音乐" | "新闻" | "生活";
  location: string;
  description: string;
  url: string;
  format: "mp3" | "hls";
};

// Public HTTPS radio streams; requested only when the user starts playback.
export const RADIO_STATIONS: RadioStation[] = [
  { id: "cnr1", name: "央广中国之声", category: "新闻", location: "北京", description: "听见新闻，也听见此刻的世界。", format: "mp3", url: "https://lhttp.qtfm.cn/live/15318317/64k.mp3" },
  { id: "guangdong", name: "广东音乐之声", category: "音乐", location: "广东 · 广州", description: "让音乐陪你度过平凡而美好的一天。", format: "mp3", url: "https://lhttp.qtfm.cn/live/1260/64k.mp3" },
  { id: "jiangsu", name: "江苏经典流行音乐广播", category: "音乐", location: "江苏 · 南京", description: "一首熟悉的歌，一段刚刚好的时光。", format: "mp3", url: "https://lhttp.qtfm.cn/live/4938/64k.mp3" },
  { id: "shanghai", name: "上海经典金曲广播", category: "音乐", location: "上海", description: "那些旋律，总有一个属于你的故事。", format: "mp3", url: "https://lhttp-hw.qtfm.cn/live/273/64k.mp3" },
  { id: "beijing", name: "北京新闻广播", category: "新闻", location: "北京", description: "城市的声音，就在你的耳边。", format: "mp3", url: "https://lhttp.qtfm.cn/live/339/64k.mp3" },
  { id: "story", name: "安徽小说评书广播", category: "生活", location: "安徽 · 合肥", description: "慢下来，听一个好故事。", format: "mp3", url: "https://lhttp.qtfm.cn/live/1951/64k.mp3" },
  { id: "wuhan-music", name: "武汉经典音乐广播", category: "音乐", location: "湖北 · 武汉 FM101.8", description: "经典1018，岁月悠长，听见好时光。", format: "mp3", url: "https://lhttp.qtfm.cn/live/1297/64k.mp3" },
  { id: "hubei-music", name: "湖北经典音乐广播", category: "音乐", location: "湖北 · 武汉 FM103.8", description: "熟悉的旋律，陪伴荆楚的日常。", format: "mp3", url: "https://lhttp.qtfm.cn/live/1296/64k.mp3" },
  { id: "hubei-economy", name: "湖北经济广播", category: "新闻", location: "湖北 · 武汉 FM99.8", description: "关注湖北经济，也关注身边的生活。", format: "mp3", url: "https://lhttp.qtfm.cn/live/1295/64k.mp3" },
  { id: "cnr2", name: "央广经济之声", category: "新闻", location: "中国 · 央广", description: "经济资讯与财经观察，听懂经济生活。", format: "hls", url: "https://satellitepull.cnr.cn/live/wxjjzs/playlist.m3u8" },
  { id: "cnr3", name: "央广音乐之声", category: "音乐", location: "中国 · 央广", description: "华语流行的旋律，陪你找回青春记忆。", format: "hls", url: "https://satellitepull.cnr.cn/live/wxyyzs/playlist.m3u8" },
  { id: "cnr4", name: "央广经典音乐广播", category: "音乐", location: "中国 · 央广", description: "经典旋律与古典音乐，给此刻一份安静。", format: "hls", url: "https://satellitepull.cnr.cn/live/wxdszs/playlist.m3u8" },
  { id: "cri-news", name: "环球资讯广播", category: "新闻", location: "中国 · 总台", description: "打开国际视野，听见世界的声音。", format: "hls", url: "https://sk.cri.cn/905.m3u8" },
  { id: "npr", name: "NPR Program Stream", category: "新闻", location: "美国 · 英语", description: "NPR 新闻与节目串流，以英语收听世界。", format: "mp3", url: "https://npr-ice.streamguys1.com/live.mp3" },
  { id: "chutian-traffic", name: "楚天交通广播", category: "生活", location: "湖北 · 武汉 FM92.7", description: "荆楚路上，交通资讯与你相伴。", format: "mp3", url: "https://lhttp.qtfm.cn/live/1291/64k.mp3" },
  { id: "wuhan-traffic", name: "武汉交通广播", category: "生活", location: "湖北 · 武汉 FM89.6", description: "听江城路况，让每一程从容一些。", format: "mp3", url: "https://lhttp.qtfm.cn/live/4665/64k.mp3" },
  { id: "beijing-traffic", name: "北京交通广播", category: "生活", location: "北京 · FM103.9", description: "关注北京交通，陪你畅行京城。", format: "mp3", url: "https://lhttp.qingting.fm/live/336/64k.mp3" },
  { id: "shanghai-traffic", name: "上海交通广播", category: "生活", location: "上海 · FM105.7", description: "听见申城路况，陪伴城市出行。", format: "mp3", url: "https://lhttp-hw.qtfm.cn/live/266/64k.mp3" },
  { id: "hangzhou-traffic", name: "杭州交通经济广播", category: "生活", location: "浙江 · 杭州 FM91.8", description: "交通91.8，陪伴杭城的每一段路。", format: "mp3", url: "https://lhttp.qtfm.cn/live/1133/64k.mp3" },
  { id: "cnr15", name: "中国交通广播", category: "生活", location: "中国 · 京津冀 FM99.6", description: "关注交通、天气与出行，让旅途多一份陪伴。", format: "hls", url: "https://satellitepull.cnr.cn/live/wxzgjtgb/playlist.m3u8" },
  { id: "bbc-world-service", name: "BBC World Service", category: "新闻", location: "英国 · 伦敦", description: "以英语收听国际新闻、时事访谈与世界故事。", format: "mp3", url: "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service" },
  { id: "kexp", name: "KEXP 90.3", category: "音乐", location: "美国 · 西雅图", description: "独立音乐与多元选曲，在熟悉之外发现新声音。", format: "mp3", url: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3" },
  { id: "swiss-jazz", name: "Radio Swiss Jazz", category: "音乐", location: "瑞士 · 爵士", description: "爵士、灵魂与蓝调，让旋律慢慢流动。", format: "mp3", url: "https://stream.srg-ssr.ch/srgssr/rsj/mp3/128" },
  { id: "abc-classic", name: "ABC Classic", category: "音乐", location: "澳大利亚 · 古典", description: "来自澳洲的古典音乐与音乐会，安静聆听每个乐章。", format: "hls", url: "https://mediaserviceslive.akamaized.net/hls/live/2038316/classicfmnsw/index.m3u8" },
  { id: "radio-paradise", name: "Radio Paradise", category: "音乐", location: "美国 · 加利福尼亚", description: "摇滚、流行与世界音乐，在不期而遇的旋律里漫游。", format: "mp3", url: "https://stream.radioparadise.com/mp3-192" },
];
