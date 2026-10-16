// Animation presets. Each preset becomes a CSS @keyframes "cx-<name>" in the exported style.css.
// kind: 'in' (entrance), 'loop' (continuous), 'once' (attention seekers / exits, mainly for the Animation blocks)
export const ANIMS = {
  fadeIn: { kind: 'in', ja: 'フェードイン', en: 'Fade in', css: 'from { opacity: 0 } to { opacity: 1 }' },
  slideUp: { kind: 'in', ja: '下からスライド', en: 'Slide up', css: 'from { opacity: 0; transform: translateY(32px) } to { opacity: 1; transform: none }' },
  slideDown: { kind: 'in', ja: '上からスライド', en: 'Slide down', css: 'from { opacity: 0; transform: translateY(-32px) } to { opacity: 1; transform: none }' },
  slideLeft: { kind: 'in', ja: '右からスライド', en: 'Slide from right', css: 'from { opacity: 0; transform: translateX(40px) } to { opacity: 1; transform: none }' },
  slideRight: { kind: 'in', ja: '左からスライド', en: 'Slide from left', css: 'from { opacity: 0; transform: translateX(-40px) } to { opacity: 1; transform: none }' },
  zoomIn: { kind: 'in', ja: 'ズームイン', en: 'Zoom in', css: 'from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: none }' },
  bounceIn: { kind: 'in', ja: 'バウンドして登場', en: 'Bounce in', css: '0% { opacity: 0; transform: scale(.3) } 50% { opacity: 1; transform: scale(1.08) } 70% { transform: scale(.95) } 100% { transform: scale(1) }' },
  dropIn: { kind: 'in', ja: '落ちてくる', en: 'Drop in', css: '0% { opacity: 0; transform: translateY(-80px) } 60% { opacity: 1; transform: translateY(8px) } 80% { transform: translateY(-4px) } 100% { transform: none }' },
  flipIn: { kind: 'in', ja: 'フリップ', en: 'Flip in', css: 'from { opacity: 0; transform: perspective(500px) rotateX(-90deg) } to { opacity: 1; transform: perspective(500px) rotateX(0) }' },
  rotateIn: { kind: 'in', ja: '回転して登場', en: 'Rotate in', css: 'from { opacity: 0; transform: rotate(-200deg) scale(.4) } to { opacity: 1; transform: none }' },
  blurIn: { kind: 'in', ja: 'ぼかしから出現', en: 'Blur in', css: 'from { opacity: 0; filter: blur(12px) } to { opacity: 1; filter: blur(0) }' },

  pulse: { kind: 'loop', ja: '脈動(パルス)', en: 'Pulse', css: '0%, 100% { transform: scale(1) } 50% { transform: scale(1.07) }' },
  heartbeat: { kind: 'loop', ja: '鼓動', en: 'Heartbeat', css: '0%, 40%, 80%, 100% { transform: scale(1) } 20%, 60% { transform: scale(1.15) }' },
  float: { kind: 'loop', ja: 'ふわふわ浮く', en: 'Float', css: '0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8px) }' },
  bounce: { kind: 'loop', ja: 'バウンド', en: 'Bounce', css: '0%, 100% { transform: translateY(0) } 40% { transform: translateY(-18px) } 60% { transform: translateY(-9px) }' },
  spin: { kind: 'loop', ja: '回転', en: 'Spin', css: 'from { transform: rotate(0) } to { transform: rotate(360deg) }' },
  swing: { kind: 'loop', ja: '揺れる(スイング)', en: 'Swing', css: '0%, 100% { transform: rotate(0) } 25% { transform: rotate(8deg) } 75% { transform: rotate(-8deg) }' },
  blink: { kind: 'loop', ja: '点滅', en: 'Blink', css: '0%, 100% { opacity: 1 } 50% { opacity: .15 }' },
  wiggle: { kind: 'loop', ja: 'ぶるぶる', en: 'Wiggle', css: '0%, 100% { transform: translateX(0) } 20% { transform: translateX(-3px) } 40% { transform: translateX(3px) } 60% { transform: translateX(-2px) } 80% { transform: translateX(2px) }' },

  fadeOut: { kind: 'once', ja: 'フェードアウト', en: 'Fade out', css: 'from { opacity: 1 } to { opacity: 0 }' },
  zoomOut: { kind: 'once', ja: 'ズームアウト', en: 'Zoom out', css: 'from { opacity: 1; transform: none } to { opacity: 0; transform: scale(.5) }' },
  slideOutUp: { kind: 'once', ja: '上へ消える', en: 'Slide out up', css: 'from { opacity: 1; transform: none } to { opacity: 0; transform: translateY(-40px) }' },
  shake: { kind: 'once', ja: 'シェイク', en: 'Shake', css: '0%, 100% { transform: translateX(0) } 15%, 45%, 75% { transform: translateX(-10px) } 30%, 60%, 90% { transform: translateX(10px) }' },
  tada: { kind: 'once', ja: 'ジャーン(強調)', en: 'Tada', css: '0% { transform: scale(1) } 10%, 20% { transform: scale(.9) rotate(-3deg) } 30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg) } 40%, 60%, 80% { transform: scale(1.1) rotate(-3deg) } 100% { transform: scale(1) }' },
  rubber: { kind: 'once', ja: 'ゴムのように伸びる', en: 'Rubber band', css: '0% { transform: scale(1) } 30% { transform: scale(1.25, .75) } 40% { transform: scale(.75, 1.25) } 65% { transform: scale(1.15, .85) } 100% { transform: scale(1) }' },
  flash: { kind: 'once', ja: 'フラッシュ', en: 'Flash', css: '0%, 50%, 100% { opacity: 1 } 25%, 75% { opacity: 0 }' },
  jello: { kind: 'once', ja: 'ぷるん', en: 'Jello', css: '0%, 100% { transform: none } 30% { transform: skew(-12deg, -12deg) } 50% { transform: skew(6deg, 6deg) } 70% { transform: skew(-3deg, -3deg) }' },
};

export const EASINGS = ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'];

export const HOVERS = {
  grow: { ja: '拡大', en: 'Grow', css: 'transform: scale(1.08)' },
  shrink: { ja: '縮小', en: 'Shrink', css: 'transform: scale(.94)' },
  lift: { ja: '浮き上がり(影)', en: 'Lift', css: 'transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,.22)' },
  glow: { ja: '発光', en: 'Glow', css: 'box-shadow: 0 0 14px 3px rgba(37,99,235,.55)' },
  rotate: { ja: '傾く', en: 'Tilt', css: 'transform: rotate(4deg)' },
  fade: { ja: '半透明', en: 'Fade', css: 'opacity: .7' },
  bright: { ja: '明るく', en: 'Brighten', css: 'filter: brightness(1.15)' },
};

export const names = (kind) => Object.keys(ANIMS).filter((k) => !kind || ANIMS[k].kind === kind);

export function keyframesCss() {
  return Object.entries(ANIMS).map(([k, a]) => `@keyframes cx-${k} { ${a.css} }`).join('\n');
}

/** `animation:` value for a node's declarative settings (entrance + loop), or ''. */
export function animationDecl(props) {
  const parts = [];
  const dur = Number(props.animDur) || 600, delay = Number(props.animDelay) || 0;
  if (props.anim && ANIMS[props.anim]) parts.push(`cx-${props.anim} ${dur}ms ${props.animEase || 'ease'} ${delay}ms backwards`);
  if (props.animLoop && ANIMS[props.animLoop]) parts.push(`cx-${props.animLoop} ${Number(props.animLoopDur) || 1500}ms ease-in-out ${props.anim ? dur + delay : 0}ms infinite`);
  return parts.join(', ');
}

/** CSS rules (without selector) for a node: [{ suffix:'', decls:[] }, { suffix:':hover', decls:[] }] */
export function animationRules(props) {
  const rules = [];
  const a = animationDecl(props);
  const h = HOVERS[props.hover];
  const base = [];
  if (a) base.push(`animation: ${a}`);
  if (h) base.push('transition: transform .2s ease, box-shadow .2s ease, opacity .2s ease, filter .2s ease');
  if (base.length) rules.push({ suffix: '', decls: base });
  if (h) rules.push({ suffix: ':hover', decls: h.css.split(';').map((s) => s.trim()).filter(Boolean) });
  return rules;
}
