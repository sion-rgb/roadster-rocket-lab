export class SynthAudio {
  context?:AudioContext;enabled=false;private master?:GainNode;private engine?:OscillatorNode;private engineGain?:GainNode;private rocket?:AudioBufferSourceNode;private rocketGain?:GainNode;
  async toggle(){
    if(!this.context){
      const ctx=this.context=new AudioContext();this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
      this.engine=ctx.createOscillator();this.engine.type='sine';this.engineGain=ctx.createGain();this.engineGain.gain.value=.06;this.engine.connect(this.engineGain).connect(this.master);this.engine.start();
      const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);let previous=0;
      for(let i=0;i<data.length;i++){previous=(previous+Math.random()*.1-.05)/1.02;data[i]=previous*3;}
      this.rocket=ctx.createBufferSource();this.rocket.buffer=buffer;this.rocket.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1400;
      this.rocketGain=ctx.createGain();this.rocketGain.gain.value=0;this.rocket.connect(filter).connect(this.rocketGain).connect(this.master);this.rocket.start();
    }
    await this.context.resume();this.enabled=!this.enabled;this.master!.gain.setTargetAtTime(this.enabled?.45:0,this.context.currentTime,.1);return this.enabled;
  }
  update(speed:number,thrust:number,paused:boolean){if(!this.context)return;const t=this.context.currentTime;this.engine!.frequency.setTargetAtTime(45+speed*3,t,.1);this.engineGain!.gain.setTargetAtTime(paused?0:.025+Math.min(.055,speed*.002),t,.12);this.rocketGain!.gain.setTargetAtTime(paused?0:thrust*.6,t,.12);}
  chime(){if(!this.context||!this.enabled)return;const t=this.context.currentTime,osc=this.context.createOscillator(),gain=this.context.createGain();osc.frequency.setValueAtTime(520,t);osc.frequency.exponentialRampToValueAtTime(780,t+.16);gain.gain.setValueAtTime(.06,t);gain.gain.exponentialRampToValueAtTime(.001,t+.35);osc.connect(gain).connect(this.master!);osc.start(t);osc.stop(t+.4);}
}
