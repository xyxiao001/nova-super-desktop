export type GameId = "mines"|"chess"|"gomoku"|"tower"|"youtd2";
export type GameResult = "win"|"loss"|"draw";
export type GameRecord = {
  played:number;
  wins:number;
  losses:number;
  draws:number;
  lastPlayed:number|null;
  lastResult:GameResult|null;
  hasProgress:boolean;
};
export type GameRecords = Record<GameId,GameRecord>;

const RECORDS_KEY="nova-game-records";
const PROGRESS_PREFIX="nova-game-progress:";
const CHANGE_EVENT="nova-game-records-change";
const RESET_EVENT="nova-game-reset";
const GAME_AUXILIARY_KEYS=["nova-mines-difficulty","nova-mines-best"];
const GAME_IDS:GameId[]=["mines","chess","gomoku","tower","youtd2"];
const emptyRecord=():GameRecord=>({played:0,wins:0,losses:0,draws:0,lastPlayed:null,lastResult:null,hasProgress:false});

export const readGameRecords=():GameRecords=>{
  const defaults=Object.fromEntries(GAME_IDS.map((id)=>[id,emptyRecord()])) as GameRecords;
  if(typeof window==="undefined")return defaults;
  try{
    const saved=JSON.parse(localStorage.getItem(RECORDS_KEY)??"{}") as Partial<GameRecords>;
    for(const id of GAME_IDS)defaults[id]={...defaults[id],...saved[id],hasProgress:localStorage.getItem(`${PROGRESS_PREFIX}${id}`)!==null};
  }catch{return defaults}
  return defaults;
};

const updateRecord=(id:GameId,update:(record:GameRecord)=>GameRecord)=>{
  const records=readGameRecords();
  records[id]=update(records[id]);
  localStorage.setItem(RECORDS_KEY,JSON.stringify(records));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

export const touchGame=(id:GameId)=>updateRecord(id,(record)=>({...record,lastPlayed:Date.now()}));
export const saveGameProgress=<T,>(id:GameId,value:T)=>{
  const hadProgress=localStorage.getItem(`${PROGRESS_PREFIX}${id}`)!==null;
  localStorage.setItem(`${PROGRESS_PREFIX}${id}`,JSON.stringify(value));
  if(!hadProgress)updateRecord(id,(record)=>({...record,hasProgress:true,lastPlayed:Date.now()}));
};
export const loadGameProgress=<T,>(id:GameId):T|null=>{
  if(typeof window==="undefined")return null;
  try{const saved=localStorage.getItem(`${PROGRESS_PREFIX}${id}`);return saved?JSON.parse(saved) as T:null}catch{return null}
};
export const clearGameProgress=(id:GameId)=>{
  localStorage.removeItem(`${PROGRESS_PREFIX}${id}`);
  updateRecord(id,(record)=>({...record,hasProgress:false}));
};
export const finishGame=(id:GameId,result:GameResult)=>{
  localStorage.removeItem(`${PROGRESS_PREFIX}${id}`);
  updateRecord(id,(record)=>({
    ...record,
    played:record.played+1,
    wins:record.wins+(result==="win"?1:0),
    losses:record.losses+(result==="loss"?1:0),
    draws:record.draws+(result==="draw"?1:0),
    lastPlayed:Date.now(),
    lastResult:result,
    hasProgress:false,
  }));
};
export const requestNewGame=(id:GameId)=>{
  clearGameProgress(id);
  window.dispatchEvent(new CustomEvent(RESET_EVENT,{detail:id}));
};
const clearStoredGameData=()=>{
  localStorage.removeItem(RECORDS_KEY);
  for(const key of GAME_AUXILIARY_KEYS)localStorage.removeItem(key);
  const progressKeys=Array.from({length:localStorage.length},(_,index)=>localStorage.key(index))
    .filter((key):key is string=>key?.startsWith(PROGRESS_PREFIX)??false);
  for(const key of progressKeys)localStorage.removeItem(key);
};
export const resetAllGameData=()=>{
  clearStoredGameData();
  for(const id of GAME_IDS)window.dispatchEvent(new CustomEvent(RESET_EVENT,{detail:id}));
  clearStoredGameData();
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};
export const subscribeGameRecords=(listener:()=>void)=>{
  window.addEventListener(CHANGE_EVENT,listener);
  return()=>window.removeEventListener(CHANGE_EVENT,listener);
};
export const subscribeGameReset=(id:GameId,listener:()=>void)=>{
  const handler=(event:Event)=>{if((event as CustomEvent<GameId>).detail===id)listener()};
  window.addEventListener(RESET_EVENT,handler);
  return()=>window.removeEventListener(RESET_EVENT,handler);
};
