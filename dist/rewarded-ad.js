// A local promotional preview; no advertising network, tracking, or payments are connected.
export class RewardedAdSession {
 constructor(duration=6){if(!Number.isFinite(duration)||duration<=0)throw new RangeError('duration must be positive');this.duration=duration;this.elapsed=0;this.claimed=false;this.cancelled=false;}
 tick(dt,visible=true){if(!visible){this.skipNextTick=true;return this.remaining;}if(this.skipNextTick){this.skipNextTick=false;return this.remaining;}if(!this.cancelled&&!this.claimed&&Number.isFinite(dt)&&dt>0)this.elapsed=Math.min(this.duration,this.elapsed+Math.min(dt,.25));return this.remaining;}
 suspend(){this.skipNextTick=true;}
 get remaining(){return Math.max(0,Math.ceil(this.duration-this.elapsed-1e-9));}
 get ready(){return !this.cancelled&&!this.claimed&&this.elapsed+1e-9>=this.duration;}
 claim(){if(!this.ready)return false;this.claimed=true;return true;}
 cancel(){this.cancelled=true;}
}
