export const icons={sound:'◖))',camera:'◉',reset:'↻',help:'?',pause:'Ⅱ'};
export function mountUI(){
  document.querySelector('#app')!.innerHTML=`
  <main id="sim" aria-label="Roadster Rocket 概念模擬器">
    <div id="viewport" aria-label="3D 沿海城市及跑車"></div>
    <div class="vignette"></div>
    <header class="topbar">
      <a class="wordmark" href="#" aria-label="Roadster Rocket 首頁">ROADSTER<span class="slash">/</span><span class="light">ROCKET</span><sup>LAB</sup></a>
      <nav class="mode-switch" aria-label="模擬模式">
        <button data-mode="showcase" class="active">展示<span>01</span></button><button data-mode="drive">道路<span>02</span></button><button data-mode="flight">飛行<span>03</span></button>
      </nav>
      <div class="tools"><button id="sound" aria-label="開啟音效" title="音效">◖))<i class="muted-line"></i></button><button id="pause" aria-label="暫停" title="暫停 / Esc">Ⅱ</button><button id="help" aria-label="操作說明" title="操作說明 / H">?</button></div>
    </header>
    <section class="intro" id="intro">
      <p class="eyebrow"><span class="tiny-dot"></span> THE COASTAL TEST PROGRAM</p>
      <h1>DEFY<br><em>GRAVITY.</em></h1>
      <p class="intro-sub">從海岸公路，到無界天空。<br>你的下一段旅程，由此起飛。</p>
      <button class="primary" id="start">進入駕駛席 <span>↗</span></button>
      <div class="spec-line"><span>全電動概念跑車</span><span>虛構推進系統</span></div>
    </section>
    <div class="location"><span class="cross">+</span><div>PACIFIC COAST<span>概念測試場 · 16:42 LST</span></div><span class="weather">☀ 24°<small>SIMULATED</small></span></div>
    <aside class="camera-switch" aria-label="攝影機視角"><span class="side-label">CAMERA VIEW</span>
      <button data-camera="cockpit" aria-label="駕駛艙第一身"><b>01</b><span>駕駛艙<small>COCKPIT</small></span></button>
      <button data-camera="chase" class="active" aria-label="車尾追蹤第三身"><b>02</b><span>車尾追蹤<small>CHASE</small></span></button>
      <button data-camera="spectator" aria-label="自由觀眾視點"><b>03</b><span>自由視點<small>FREE ORBIT</small></span></button>
    </aside>
    <div class="flight-reticle" id="reticle"><div class="horizon" id="horizon"><span>− 10 −</span><b>─── ───</b><span>− 10 −</span></div><span class="reticle-center">┴</span></div>
    <div class="toast" id="toast" role="status" aria-live="polite">展示模式 · 拖曳旋轉，滾輪縮放</div>
    <section class="telemetry" aria-label="即時儀表板">
      <div class="speed"><span class="metric-label" id="speed-label">GROUND SPEED</span><div><strong id="speed">000</strong><span>km/h</span></div><div class="speed-ticks" id="speed-ticks"></div></div>
      <div class="metric altitude"><span class="metric-label">ALTITUDE <small>AGL · SIM</small></span><div><strong id="altitude">0.0</strong><span>m</span></div><span class="submetric">垂直速度 <b id="vertical">+0.0</b> m/s</span></div>
      <div class="metric attitude"><span class="metric-label">ATTITUDE</span><div class="angles"><span>PITCH <b id="pitch">0°</b></span><span>ROLL <b id="roll">0°</b></span></div><span class="submetric">航向 <b id="heading">000</b>° <span id="contact">● GROUND</span></span></div>
      <div class="metric energy"><span class="metric-label">THRUSTER ENERGY <small>SIM</small></span><div><strong id="energy">100</strong><span>%</span></div><div class="energy-track"><i id="energy-fill"></i></div></div>
      <div class="launch-block"><span id="system"><i class="tiny-dot"></i> SYSTEM READY</span><button id="launch" class="primary">啟動 ROCKET <span>↑</span></button><button id="land" class="sub-button">L · 降落輔助</button></div>
    </section>
    <footer class="bottomline"><span class="disclaimer">UNOFFICIAL CONCEPT<span>非官方概念 · 所有飛行性能均為模擬數值</span></span><span class="keyboard-hint" id="keyhint"><kbd>W A S D</kbd> 駕駛 <kbd>SPACE</kbd> 上升 <kbd>C</kbd> 視角 <kbd>H</kbd> 操作</span><span class="performance" id="performance">60 FPS</span></footer>
    <div class="touch-controls" aria-label="觸控操作"><div class="touch-steer"><button data-hold="KeyA" aria-label="向左">←</button><div><button data-hold="KeyW" aria-label="加速">↑</button><button data-hold="KeyS" aria-label="倒車或減速">↓</button></div><button data-hold="KeyD" aria-label="向右">→</button></div><div class="touch-flight"><button data-hold="KeyQ" aria-label="向左翻滾">↶</button><button data-hold="KeyE" aria-label="向右翻滾">↷</button><button data-hold="KeyI" aria-label="向上俯仰">P+</button><button data-hold="KeyK" aria-label="向下俯仰">P−</button><button data-hold="Space" aria-label="上升">升 ↑</button><button data-hold="ControlLeft" aria-label="下降">降 ↓</button><button data-hold="KeyB" aria-label="煞車">煞車</button><button data-hold="ShiftLeft" aria-label="推進加速">BOOST</button></div></div>
    <button class="reset-float" id="reset" aria-label="重置車輛" title="R · 重置">↻</button>
    <div class="overlay" id="help-panel" hidden><section class="dialog"><button class="close" id="help-close" aria-label="關閉說明">×</button><p class="eyebrow">FLIGHT MANUAL / 01</p><h2>準備，離開地面。</h2><p>非官方 Tesla Roadster Rocket Edition 風格概念。車輛比例接近真實尺度，飛行、能量、推力、速度上限及操控全部屬虛構模擬，並非 Tesla 官方性能。</p><div class="help-grid"><div><h3>道路駕駛</h3><p><kbd>W / S</kbd> 加速 / 倒車<br><kbd>A / D</kbd> 轉向　<kbd>B</kbd> 煞車<br><kbd>SHIFT</kbd> 推進加速</p><h3>攝影機</h3><p><kbd>1 / 2 / 3</kbd> 三種視角<br><kbd>C</kbd> 循環切換<br>滑鼠拖曳環繞 / 駕駛艙環視<br>滾輪縮放自由視點</p></div><div><h3>Rocket 飛行</h3><p><kbd>F</kbd> 飛行 / 道路模式<br><kbd>SPACE / CTRL</kbd> 升高 / 下降<br><kbd>W / S</kbd> 前進 / 後退<br><kbd>A / D</kbd> 偏航　<kbd>I / K</kbd> 俯仰<br><kbd>Q / E</kbd> 翻滾<br><kbd>L</kbd> 降落輔助 / 解除</p></div></div><p class="help-note">平穩降落：放開上升、煞停水平移動，保持車身回正，再按 CTRL 下降；或按 L 啟動輔助。接地垂直速度超過 4 m/s 為模擬硬著陸。能量落地充電，耗盡時自動緊急下降。<br>Gamepad 預設：左搖桿轉向、右搖桿姿態，RT / LT 油門，A / B 升降，X 煞車，LB 加速（實體裝置待驗證）。</p><div class="help-actions"><span><kbd>R</kbd> 重置　<kbd>ESC</kbd> 暫停</span><button class="primary" id="help-ready">開始探索 <span>↗</span></button></div><details><summary>模型授權及聲明</summary><p>車輛：metarex.4d — Tesla Roadster 2020，CC BY 4.0。車身比例調整及推進器屬本專案修改。<a href="./assets/car/ATTRIBUTION.md" target="_blank" rel="noopener">Tesla Roadster 2020 — metarex.4d · CC BY 4.0 · 完整來源</a>。場景為原創程序幾何，音效為 Web Audio 合成。Tesla 商標及產品名稱歸原權利人，本專案沒有官方關聯或認可。</p></details></section></div>
    <div class="overlay" id="pause-panel" hidden><section class="dialog compact"><p class="eyebrow">SIMULATION PAUSED</p><h2>暫停一下。</h2><button id="resume" class="primary">繼續旅程 <span>→</span></button></section></div>
    <div class="loading" id="loading"><span class="wordmark">ROADSTER / ROCKET</span><span class="loader-line"></span><p id="loading-status">正在初始化物理與測試場…</p></div>
  </main>`;
  document.querySelector('#speed-ticks')!.innerHTML=Array.from({length:32},()=>'<i></i>').join('');
}
