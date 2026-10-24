const RESET_KEYS=new Set(['KeyR','KeyU','KeyO']);

export function createResetInput(trigger){
 const held=new Set();let latched=false;
 return {
  keyDown(event){
   if(!RESET_KEYS.has(event.code))return false;
   if(event.repeat)return true;
   held.add(event.code);
   if(held.size===3&&!latched){latched=true;trigger();}
   return true;
  },
  keyUp(event){
   if(!RESET_KEYS.has(event.code))return false;
   held.delete(event.code);latched=false;return true;
  },
  clear(){held.clear();latched=false;}
 };
}
