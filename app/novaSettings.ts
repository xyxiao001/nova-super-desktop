export type NovaTheme = "system"|"light"|"dark";
export type NovaWallpaper = "nova"|"harbor"|"dawn"|"grove"|"dusk"|"graphite"|"starport"|"rain"|"abyss";
export type NovaSettings = { theme:NovaTheme; wallpaper:NovaWallpaper; sound:boolean; volume:number };
export type NovaSound = "open"|"close"|"move"|"success"|"error";

export const DEFAULT_SETTINGS:NovaSettings={theme:"system",wallpaper:"nova",sound:true,volume:.45};
const SETTINGS_KEY="nova-settings";
export const CALENDAR_ALMANAC_KEY="nova-calendar-almanac-enabled";
const SETTINGS_EVENT="nova-settings-change";

export const readCalendarAlmanacEnabled=()=>typeof window!=="undefined"&&localStorage.getItem(CALENDAR_ALMANAC_KEY)==="true";
export const saveCalendarAlmanacEnabled=(enabled:boolean)=>localStorage.setItem(CALENDAR_ALMANAC_KEY,String(enabled));

export const readNovaSettings=():NovaSettings=>{
  if(typeof window==="undefined")return DEFAULT_SETTINGS;
  try{return{...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem(SETTINGS_KEY)??"{}")}}catch{return DEFAULT_SETTINGS}
};

export const saveNovaSettings=(settings:NovaSettings)=>{
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT,{detail:settings}));
};

export const subscribeNovaSettings=(listener:(settings:NovaSettings)=>void)=>{
  const handler=(event:Event)=>listener((event as CustomEvent<NovaSettings>).detail);
  window.addEventListener(SETTINGS_EVENT,handler);
  return()=>window.removeEventListener(SETTINGS_EVENT,handler);
};

export const playNovaSound=(sound:NovaSound)=>{
  const settings=readNovaSettings();
  if(!settings.sound||settings.volume<=0)return;
  const AudioContextClass=window.AudioContext;
  const context=new AudioContextClass(),oscillator=context.createOscillator(),gain=context.createGain();
  const frequencies:Record<NovaSound,[number,number]>={open:[420,560],close:[360,250],move:[520,620],success:[520,780],error:[240,170]};
  const [from,to]=frequencies[sound],now=context.currentTime,duration=sound==="success"?.18:.1;
  oscillator.type=sound==="error"?"sawtooth":"sine";
  oscillator.frequency.setValueAtTime(from,now);
  oscillator.frequency.exponentialRampToValueAtTime(to,now+duration);
  gain.gain.setValueAtTime(Math.max(.0001,settings.volume*.11),now);
  gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now+duration);
  oscillator.addEventListener("ended",()=>void context.close(),{once:true});
};
