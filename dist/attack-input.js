const controllerStates=new WeakMap();

// Time is supplied by the game's simulation, so pausing never leaves a browser timer running.
export function createAttackInput(onAttack,{interval=.3,enabled=()=>true}={}){
  if(typeof onAttack!=='function'||typeof enabled!=='function')throw new TypeError('Attack callbacks must be functions');
  if(!Number.isFinite(interval)||interval<=0)throw new RangeError('Attack interval must be positive seconds');
  const state={sources:new Set(),elapsed:0,pointerOwner:null,cancellations:new Set(),handled:new WeakSet()};
  const clear=()=>{
    state.sources.clear();state.elapsed=0;state.pointerOwner=null;
    for(const cancel of [...state.cancellations])cancel();
  };
  const trigger=()=>{
    if(!enabled()){clear();return false;}
    state.elapsed=0;onAttack();return true;
  };
  const controller={
    trigger,
    press(source){
      if(!enabled()){clear();return false;}
      if(state.sources.has(source))return false;
      state.sources.add(source);return trigger();
    },
    release(source){
      state.sources.delete(source);if(!state.sources.size)state.elapsed=0;
    },
    clear,
    tick(dt){
      if(!Number.isFinite(dt)||dt<0)throw new RangeError('Attack tick must be nonnegative seconds');
      if(!enabled()){clear();return 0;}
      if(!state.sources.size)return 0;
      state.elapsed+=dt;let count=0;
      while(state.sources.size&&state.elapsed+1e-9>=interval){
        state.elapsed=Math.max(0,state.elapsed-interval);
        if(!enabled()){clear();break;}
        onAttack();count++;
      }
      return count;
    },
    get holding(){return state.sources.size>0;}
  };
  controllerStates.set(controller,state);return controller;
}

export function bindAttackButton(button,input){
  // Preserve the original callback form for consumers that only need single clicks.
  if(typeof input==='function'){
    const click=event=>{if(event.button!==undefined&&event.button!==0)return;event.preventDefault();input();};
    button.addEventListener('click',click);return ()=>button.removeEventListener('click',click);
  }
  const state=controllerStates.get(input);
  if(!state)throw new TypeError('Pass an attack controller or callback');
  const source=Symbol('attack pointer'),doc=button.ownerDocument,view=doc?.defaultView;
  let pointer=null,suppressClick=false;
  const endPointer=event=>{
    if(pointer===null||event?.pointerId!==undefined&&event.pointerId!==pointer)return;
    const id=pointer;pointer=null;
    if(state.pointerOwner===source)state.pointerOwner=null;
    input.release(source);
    try{if(button.hasPointerCapture?.(id))button.releasePointerCapture(id);}catch{}
  };
  const cancel=()=>{if(pointer!==null)suppressClick=true;endPointer();};
  const down=event=>{
    if(event.button!==undefined&&event.button!==0||event.isPrimary===false&&event.pointerType!=='touch'||state.handled.has(event)||pointer!==null||state.pointerOwner!==null)return;
    state.handled.add(event);event.preventDefault();
    pointer=event.pointerId??'primary';suppressClick=true;state.pointerOwner=source;
    try{if(event.pointerId!==undefined)button.setPointerCapture?.(event.pointerId);}catch{}
    input.press(source);
  };
  const click=event=>{
    if(event.button!==undefined&&event.button!==0||event.isPrimary===false&&event.pointerType!=='touch'||state.handled.has(event))return;
    state.handled.add(event);event.preventDefault();
    // Modern pointer clicks are the compatibility event for pointerdown, including
    // rejected secondary gestures. Keyboard activation has pointerId -1 (or no ID).
    const fromPointer=Boolean(event.pointerType)||Number.isFinite(event.pointerId)&&event.pointerId>=0;
    if(fromPointer){suppressClick=false;return;}
    if(event.detail===0){suppressClick=false;input.trigger();return;}
    if(suppressClick){suppressClick=false;return;}
    input.trigger();
  };
  const hidden=()=>{if(doc.hidden)input.clear();};
  const blur=()=>input.clear();
  const listeners=[['pointerdown',down],['pointerup',endPointer],['pointercancel',endPointer],['lostpointercapture',endPointer],['pointerleave',endPointer],['click',click]];
  for(const [type,listener]of listeners)button.addEventListener(type,listener);
  view?.addEventListener('pointerup',endPointer);view?.addEventListener('pointercancel',endPointer);view?.addEventListener('blur',blur);doc?.addEventListener('visibilitychange',hidden);
  state.cancellations.add(cancel);
  return ()=>{
    cancel();state.cancellations.delete(cancel);
    for(const [type,listener]of listeners)button.removeEventListener(type,listener);
    view?.removeEventListener('pointerup',endPointer);view?.removeEventListener('pointercancel',endPointer);view?.removeEventListener('blur',blur);doc?.removeEventListener('visibilitychange',hidden);
  };
}

export function handleAttackKey(event,input){
  if(event.code!=='KeyF'&&event.code!=='KeyJ')return false;
  event.preventDefault();
  if(typeof input==='function'){
    if(event.type!=='keyup'&&!event.repeat)input();return true;
  }
  if(!controllerStates.has(input))throw new TypeError('Pass an attack controller or callback');
  if(event.type==='keyup')input.release(`key:${event.code}`);
  else if(!event.repeat)input.press(`key:${event.code}`);
  return true;
}
