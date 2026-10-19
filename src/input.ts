export interface Intent { throttle:number; steer:number; lift:number; pitch:number; roll:number; brake:boolean; boost:boolean }
export class Input {
  keys = new Set<string>();
  touch = new Set<string>();
  gamepad = false;
  constructor(public action:(code:string)=>void) {
    window.addEventListener('keydown', e => {
      if ((e.target as HTMLElement).matches('input,select,textarea')) return;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.action(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.clear());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
    document.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach(button=>{
      const code=button.dataset.hold!;
      button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);this.touch.add(code);button.classList.add('held');});
      const release=()=>{this.touch.delete(code);button.classList.remove('held');};
      button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    });
  }
  clear(){this.keys.clear();this.touch.clear();document.querySelectorAll('.held').forEach(e=>e.classList.remove('held'));}
  read():Intent {
    const down=(...codes:string[])=>codes.some(c=>this.keys.has(c)||this.touch.has(c));
    const value=(pos:string[],neg:string[])=>Number(down(...pos))-Number(down(...neg));
    const out:Intent={throttle:value(['KeyW','ArrowUp'],['KeyS','ArrowDown']),steer:value(['KeyD','ArrowRight'],['KeyA','ArrowLeft']),lift:value(['Space'],['ControlLeft','ControlRight']),pitch:value(['KeyI'],['KeyK']),roll:value(['KeyE'],['KeyQ']),brake:down('KeyB'),boost:down('ShiftLeft','ShiftRight')};
    const pad=navigator.getGamepads?.().find(p=>p?.connected);
    this.gamepad=!!pad;
    if(pad){const dead=(n:number)=>Math.abs(n)>.12?n:0;out.steer+=dead(pad.axes[0]??0);out.pitch+=dead(pad.axes[3]??0);out.roll+=dead(pad.axes[2]??0);out.throttle+=(pad.buttons[7]?.value??0)-(pad.buttons[6]?.value??0);out.lift+=Number(!!pad.buttons[0]?.pressed)-Number(!!pad.buttons[1]?.pressed);out.boost||=!!pad.buttons[4]?.pressed;out.brake||=!!pad.buttons[2]?.pressed;}
    for(const k of ['throttle','steer','lift','pitch','roll'] as const)out[k]=Math.max(-1,Math.min(1,out[k]));
    return out;
  }
}
