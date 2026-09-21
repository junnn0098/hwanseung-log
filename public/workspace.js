export const PERSONAL_STORAGE='hwanseung-log-v1';
export const DEMO_STORAGE='hwanseung-log-demo-v1';
export const MODE_STORAGE='hwanseung-log-mode-v1';

// Demo changes have their own journal, bookmarks and current itinerary.
export function createWorkspaceStore(storage){
 const memory=new Map();
 const read=key=>{if(memory.has(key))return memory.get(key);try{return storage?.getItem(key)||null;}catch{return null;}};
 const record=key=>{try{const value=JSON.parse(read(key)||'null');return value&&value.version===1&&typeof value==='object'?value:{};}catch{return {};}};
 const key=mode=>mode==='demo'?DEMO_STORAGE:PERSONAL_STORAGE;
 return {
  read(mode){return record(key(mode));},
  mode(hash=''){
   if(hash.split('?')[0]==='#demo')return 'demo';
   if(!hash||hash.split('?')[0]==='#home')return 'personal';
   const preferred=read(MODE_STORAGE);if(preferred==='personal'||preferred==='demo')return preferred;
   return 'personal';
  },
  write(mode,value){
   const raw=JSON.stringify(value);memory.set(key(mode),raw);memory.set(MODE_STORAGE,mode);
   try{if(!storage)return false;storage.setItem(key(mode),raw);storage.setItem(MODE_STORAGE,mode);return true;}catch{return false;}
  },
  clear(){for(const name of [PERSONAL_STORAGE,DEMO_STORAGE,MODE_STORAGE]){memory.delete(name);storage?.removeItem(name);}}
 };
}
