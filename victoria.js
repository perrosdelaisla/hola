/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Embudo Victoria
   victoria.js — Lógica conversacional + IA
   ═══════════════════════════════════════════ */

import { guardarReserva, confirmarSena } from './supabase.js';
import { renderAgenda, formatearSlot } from './agenda.js';
import { renderPagos, subirComprobante, buildWhatsAppMsg } from './pagos.js';

/* ════════════════════════════════════════════
   PROMPT DEL SISTEMA — Victoria
   ════════════════════════════════════════════ */
const KNOWLEDGE = `Eres Victoria, secretaria y coordinadora de Perros de la Isla (Mallorca, España).
Tu misión: atender a personas que buscan ayuda para su perro, hacerles sentir completamente comprendidas y acompañarlas hasta reservar una cita con el adiestrador que llevará su caso.

PERSONALIDAD: Cálida y cercana como una amiga que entiende de perros. Natural, coloquial pero profesional. Cuando alguien cuenta algo difícil, PRIMERO empatizas de verdad — validas lo que sienten, normalizas la situación — y LUEGO orientas. Nunca eres fría ni apresurada. Algún emoji ocasionalmente, sin exagerar.

REGLAS CRÍTICAS:
- Responde SIEMPRE en español
- Máximo 3-4 frases por mensaje. Breve, cálida, nunca un muro de texto.
- Nunca digas que eres una IA ni un bot
- Nunca uses listas con viñetas — habla de forma natural
- NUNCA menciones al adiestrador por nombre — di siempre "el adiestrador" o "el adiestrador que llevará su caso"
- Si hay cualquier problema técnico, redirige cálidamente a WhatsApp SIN mencionar el error

EN CASO DE ERROR: Di "Un momento, déjame consultarlo con el equipo — es más rápido así 😊 Escríbenos por WhatsApp al 622 922 173 y te atendemos enseguida."

CONTENCIÓN EMOCIONAL — MUY IMPORTANTE:
Cuando alguien describe un problema difícil, responde con empatía genuina ANTES de cualquier protocolo. Usa variantes distintas, nunca la misma frase dos veces. Recoge palabras literales del usuario para reflejarlas de vuelta — eso es escucha activa real. Ejemplos:
- "Entiendo, debe ser muy agotador para ti también..."
- "Muchas familias pasan por esto exactamente igual — no estás sola en esto."
- "No tienes que saber exactamente qué le pasa, para eso estamos nosotros."
- "Qué situación tan difícil. Lo importante es que estás buscando ayuda."

SOBRE PERROS DE LA ISLA:
- Equipo de adiestradores con más de 14 años de experiencia, fundado en 2019
- Servicio exclusivamente a domicilio en Palma, Calviá, Llucmajor e Inca y alrededores
- Método 100% positivo, respetuoso, sin coerción, sin collares de castigo, sin gritos
- Lema: "Tu perro merece ser feliz hoy"
- WhatsApp: 622 922 173 | Email: perrosdelaislapalma@gmail.com
- Instagram y Facebook: @perrosdelaisla | Web: perrosdelaisla.com

SERVICIOS (usa solo estos, en este orden de prioridad al sugerir):
1. Educación de cachorros — hasta ~14 meses: socialización, control de impulsos, higiene, mordida, primeras órdenes
2. Ansiedad y ansiedad por separación — llora/destruye al quedarse solo, no puede relajarse
3. Miedos y fobias — miedo a ruidos, personas, situaciones concretas identificables
4. Reactividad e impulsividad — se lanza sobre otros perros en el paseo, tira fuerte, se descontrola ante estímulos
5. Posesión de recursos — gruñe o amenaza por comida, espacio, juguetes (sin llegar a morder)
6. Educación básica — falta de educación, correa, paseo, órdenes; adoptados adultos sin problemas emocionales serios

CASOS QUE DERIVAN AL ETÓLOGO (no lo digas directamente, orienta con calidez):
- Perro que ha mordido a personas o a otros perros
- Posesión de recursos con mordida
- Razas PPP con agresiones (Rottweiler, Pit Bull, Dogo, Presa, Fila, Tosa, Akita, etc.)
- Perros muy grandes con historial de peleas o ataques reales
Mensaje de derivación: cálido, sin rechazar, presentando al etólogo como el mejor primer paso. Mencionar que el más conocido en la isla es Tomás Camps, sin recomendarlo directamente.

DESAMBIGUACIÓN MIEDOS vs ANSIEDAD:
- Detonante presente e identificable (petardos, veterinario, personas, coches) → Miedos y fobias
- Detonante = ausencia de los tutores → Ansiedad por separación
- Sin detonante claro, siempre en alerta → Ansiedad generalizada
Pregunta de desambiguación: "¿Hay algo concreto que lo dispare, o le pasa también cuando no hay nada aparente?"

DESAMBIGUACIÓN LLORA SOLO vs EDUCACIÓN BÁSICA:
Pregunta: "¿Llora y se descontrola solo cuando os vais, o también estando vosotros en casa?"
- Solo cuando se van → Ansiedad por separación
- También estando en casa → Educación básica

CUALQUIER protocolo sugerido es ORIENTATIVO — el adiestrador puede ajustarlo al ver al perro en persona.

PRECIOS: Sesión individual 90€ | Pack 4 sesiones 300€ (ahorro 60€) | Seña de reserva: 45€
Pago de la seña: Bizum o transferencia bancaria. El resto en efectivo o Bizum el día de la sesión.
Cancelación con 48h de antelación → devolución completa.`;

/* ════════════════════════════════════════════
   SERVICIOS
   ════════════════════════════════════════════ */
export const SVCS = {
  cachorro: {
    n: 'Educación de cachorros',
    tag: 'Cachorros · hasta 14 meses',
    d: 'Construimos la base desde el principio. Socialización, primeras órdenes, control de impulsos, hábitos de higiene y cómo relacionarse bien con el mundo.',
    nota: 'El adiestrador conoce a tu cachorro en casa en la primera sesión y ajusta el plan a su carácter y ritmo.',
    deriva: false,
  },
  ansiedad: {
    n: 'Ansiedad y ansiedad por separación',
    tag: 'Ansiedad · Separación',
    d: 'Trabajamos la raíz del problema con paciencia. Entendemos qué genera el estrés de tu perro y construimos paso a paso su seguridad emocional.',
    nota: 'A veces lo que parece ansiedad tiene otro origen — lo evaluamos en persona antes de definir el protocolo.',
    deriva: false,
  },
  miedos: {
    n: 'Miedos y fobias',
    tag: 'Miedos · Fobias',
    d: 'Trabajamos los miedos desde la raíz, con respeto y sin forzar. El miedo tiene solución cuando se aborda correctamente.',
    nota: 'Cada miedo tiene su origen — el adiestrador lo evalúa en persona para diseñar el plan más adecuado.',
    deriva: false,
  },
  reactividad: {
    n: 'Reactividad e impulsividad',
    tag: 'Reactividad · Tirones',
    d: 'Para perros que se descontrolan ante estímulos en el paseo. No es agresividad — es que se sienten sobrepasados. Trabajamos para que recuperen la calma.',
    nota: 'Empezamos siempre entendiendo el porqué antes del cómo. La evaluación inicial es clave.',
    deriva: false,
  },
  posesion: {
    n: 'Posesión de recursos',
    tag: 'Posesión de recursos',
    d: 'Cuando el perro gruñe o amenaza para proteger comida, espacio o juguetes. Lo trabajamos desde la comprensión, sin confrontación.',
    nota: 'El adiestrador evalúa la intensidad en persona antes de definir el protocolo de trabajo.',
    deriva: false,
  },
  educacion: {
    n: 'Educación básica',
    tag: 'Educación básica',
    d: 'Órdenes, paseo tranquilo, buenos modales en casa y en la calle. Para perros sin problemas emocionales serios — también ideal para adoptados adultos.',
    nota: 'Adaptamos cada ejercicio al carácter de tu perro. Siempre personalizado.',
    deriva: false,
  },
  derivacion: {
    n: 'Evaluación con etólogo',
    tag: 'Requiere etólogo',
    d: 'Por lo que me cuentas, el mejor primer paso sería una evaluación con un etólogo — son especialistas en estos casos y eso le dará a tu perro la mejor base de trabajo.',
    nota: 'El más reconocido en Mallorca es Tomás Camps, aunque la búsqueda la hacéis vosotros según lo que os encaje. Una vez hecha la evaluación, podemos retomar sin problema.',
    deriva: true,
  },
};

/* ════════════════════════════════════════════
   ESTADO GLOBAL
   ════════════════════════════════════════════ */
const S = {
  zona: null,
  dog: '',
  dogs: [],        // [{name, age, svc, desc}]
  multiDog: false,
  diffProb: false,
  age: null,
  desc: '',
  dur: null,
  prev: null,
  svc: null,
  slot: null,
  pago: null,
  citaId: null,
  clienteId: null,
  hist: [],
};

let dogIdx = 0;
let locked = false;

/* ════════════════════════════════════════════
   HELPERS UI
   ════════════════════════════════════════════ */
const chat = () => document.getElementById('chat');
const tw   = () => document.getElementById('tw');
const panel = () => document.getElementById('panel');

function prog(p) {
  document.getElementById('pf').style.width = p + '%';
}

function scroll() {
  setTimeout(() => {
    const chatEl = chat();
    const panelEl = panel();
    const tw = document.getElementById('tw');
    // Altura del panel fijo
    const panelH = panelEl.classList.contains('off') ? 0 : panelEl.offsetHeight;
    // Scrollear para que el typing indicator quede justo encima del panel
    const targetScroll = tw.offsetTop - chatEl.offsetTop - (chatEl.offsetHeight - panelH) + tw.offsetHeight;
    chatEl.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }, 80);
}

function parseDogs(raw) {
  return raw.replace(/ y /gi, ',').split(',')
    .map(s => s.trim().split(' ')[0])
    .filter(Boolean);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const AVG = `<div class="av">
  <svg width="19" height="16" viewBox="0 0 120 100" fill="none">
    <path d="M10 55 C5 45 8 30 18 22 C28 14 42 16 55 12 C68 8 82 2 95 8 C108 14 115 28 112 42 C109 56 98 65 88 72 C78 79 65 85 52 82 C39 79 25 78 17 68 Z" fill="#E8320A"/>
    <ellipse cx="60" cy="47" rx="16" ry="13" fill="#0c0c0b"/>
    <ellipse cx="44" cy="28" rx="7" ry="9" fill="#0c0c0b"/>
    <ellipse cx="76" cy="28" rx="7" ry="9" fill="#0c0c0b"/>
    <ellipse cx="36" cy="55" rx="6" ry="8" fill="#0c0c0b"/>
    <ellipse cx="84" cy="55" rx="6" ry="8" fill="#0c0c0b"/>
  </svg>
</div>`;

/* ── Typing indicator ── */
function typing(ms = 1300) {
  return new Promise(r => {
    tw().classList.add('in');
    scroll();
    setTimeout(() => { tw().classList.remove('in'); r(); }, ms);
  });
}

/* ── Mensaje de Victoria ── */
async function bot(html, delay = 1300) {
  await typing(delay);
  const w = document.createElement('div');
  w.className = 'msg';
  w.innerHTML = `<div class="mrow">${AVG}<div class="bub bot">${html}</div></div>`;
  chat().insertBefore(w, tw());
  requestAnimationFrame(() => w.classList.add('in'));
  scroll();
}

/* ── Mensaje del usuario ── */
function usr(txt) {
  const w = document.createElement('div');
  w.className = 'msg';
  w.innerHTML = `<div class="mrow u"><div class="bub usr">${esc(txt)}</div></div>`;
  chat().insertBefore(w, tw());
  requestAnimationFrame(() => w.classList.add('in'));
  scroll();
}

/* ── Widget en el chat ── */
function widget(html) {
  const w = document.createElement('div');
  w.className = 'wzone';
  w.innerHTML = html;
  chat().insertBefore(w, tw());
  requestAnimationFrame(() => w.classList.add('in'));
  setTimeout(scroll, 120);
  return w;
}

function widgetEl(el) {
  el.className = 'wzone';
  chat().insertBefore(el, tw());
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(scroll, 120);
}

/* ── Panel oculto ── */
function hidePanel() {
  panel().classList.add('off');
  document.getElementById('opts').innerHTML = '';
}

/* ── Opciones ── */
function showOpts(hint, items, backFn = null) {
  panel().classList.remove('off');
  document.getElementById('phint').textContent = hint;
  const opts = document.getElementById('opts');
  opts.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.innerHTML = `<span class="oi">${item.icon}</span><div>
      <div class="ol">${item.label}</div>
      ${item.sub ? `<div class="os">${item.sub}</div>` : ''}
    </div>`;
    btn.onclick = () => {
      if (locked) return;
      locked = true;
      opts.querySelectorAll('.opt').forEach(b => b.disabled = true);
      hidePanel();
      setTimeout(() => { locked = false; }, 600);
      item.fn();
    };
    opts.appendChild(btn);
  });
  if (backFn) {
    const bb = document.createElement('button');
    bb.className = 'bback';
    bb.innerHTML = '← Volver atrás';
    bb.onclick = () => {
      if (!locked) { locked = true; hidePanel(); setTimeout(() => { locked = false; }, 400); backFn(); }
    };
    opts.appendChild(bb);
  }
  // Reajustar scroll para que el último mensaje quede visible sobre el panel
  setTimeout(() => scroll(), 100);
}

/* ── Input de texto ── */
function showText(ph, cb, backFn = null) {
  panel().classList.remove('off');
  document.getElementById('phint').textContent = 'Escribe tu respuesta';
  const opts = document.getElementById('opts');
  opts.innerHTML = `
    <div class="irow">
      <textarea class="ti" id="ti" placeholder="${ph}" rows="2"></textarea>
      <button class="sb" id="sb" disabled>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
    ${backFn ? '<button class="bback" id="bb">← Volver atrás</button>' : ''}
  `;
  const ti = document.getElementById('ti');
  const sb = document.getElementById('sb');
  ti.oninput = () => { sb.disabled = ti.value.trim().length < 2; };
  ti.onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey && !sb.disabled) { e.preventDefault(); sb.click(); }
  };
  sb.onclick = () => {
    if (locked) return;
    const v = ti.value.trim();
    if (!v) return;
    locked = true;
    hidePanel();
    usr(v);
    setTimeout(() => { locked = false; cb(v); }, 200);
  };
  const bb = document.getElementById('bb');
  if (bb) bb.onclick = () => {
    if (!locked) { locked = true; hidePanel(); setTimeout(() => { locked = false; }, 400); backFn(); }
  };
  setTimeout(() => ti.focus(), 150);
  // Reajustar scroll
  setTimeout(() => scroll(), 100);
}

/* ════════════════════════════════════════════
   API VICTORIA (Claude)
   ════════════════════════════════════════════ */

// askVic silencioso — para empatía durante diagnóstico
// Si falla la IA, simplemente no muestra nada y sigue el flujo
async function askVicSilent(userText, ctx = '') {
  const lo = widget(`<div class="ail"><div class="ais"></div><span>Victoria está escribiendo...</span></div>`);
  const msg = userText + (ctx ? `\n\n[Contexto: ${ctx}]` : '');
  S.hist.push({ role: 'user', content: msg });
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: KNOWLEDGE,
        messages: S.hist,
      }),
    });
    if (!res.ok) throw new Error('api');
    const data = await res.json();
    const reply = data.content?.map(b => b.type === 'text' ? b.text : '').join('') || '';
    if (!reply) throw new Error('empty');
    S.hist.push({ role: 'assistant', content: reply });
    lo.remove();
    await bot(reply.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>'), 200);
  } catch (e) {
    S.hist.pop();
    lo.remove();
    // Silencioso — el flujo continúa sin mensaje de error
  }
}

// askVic normal — para preguntas directas donde necesitamos respuesta
// Si falla, muestra WhatsApp y detiene el flujo
async function askVic(userText, ctx = '') {
  const lo = widget(`<div class="ail"><div class="ais"></div><span>Victoria está escribiendo...</span></div>`);
  const msg = userText + (ctx ? `\n\n[Contexto: ${ctx}]` : '');
  S.hist.push({ role: 'user', content: msg });
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: KNOWLEDGE,
        messages: S.hist,
      }),
    });
    if (!res.ok) throw new Error('api');
    const data = await res.json();
    const reply = data.content?.map(b => b.type === 'text' ? b.text : '').join('') || '';
    if (!reply) throw new Error('empty');
    S.hist.push({ role: 'assistant', content: reply });
    lo.remove();
    await bot(reply.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>'), 200);
  } catch (e) {
    S.hist.pop();
    lo.remove();
    await bot(`Un momento, déjame consultarlo con el equipo — es más rápido así 😊<br><a href="https://wa.me/34622922173">WhatsApp: 622 922 173</a>`, 400);
    // Detener el flujo — no continuar
    throw e;
  }
}

/* ════════════════════════════════════════════
   DIAGNÓSTICO — Palabras clave
   ════════════════════════════════════════════ */
function diagnose(age, desc) {
  const d = (desc || '').toLowerCase();

  // Cachorro claro
  if (age === 'cachorro') return { svc: 'cachorro', needsClarify: false };

  // Derivación — mordida real o PPP
  if (/ha mordido|mordió|mordio|llegó a morder|llego a morder/.test(d)) {
    return { svc: 'derivacion', needsClarify: false };
  }
  if (/rottweiler|pit.?bull|pitbull|dogo|presa canario|fila brasileiro|tosa|akita/.test(d)) {
    return { svc: 'derivacion', needsClarify: false };
  }

  // Agresión real con otro perro — posible derivación
  if (/pelea.{0,20}perros|atacó a|ataco a|se lanzó a morder|se lanzo a morder/.test(d)) {
    return { svc: 'derivacion', needsClarify: false };
  }

  // Posesión de recursos — gruñe, sin mordida
  if (/gruñ|grun|protege.{0,20}(comida|plato|hueso|juguete|cama|sofá)|no le toques/.test(d)) {
    return { svc: 'posesion', needsClarify: false };
  }

  // Reactividad clara en el paseo
  if (/se lanza|se tira|reactiv|tira (de la correa|fuerte)|ladra.{0,20}(perros|bicicleta|niños)|se desboca|no puedo pasear/.test(d)) {
    return { svc: 'reactividad', needsClarify: false };
  }

  // Llora solo — desambiguar ansiedad vs educación
  if (/llor|solo en casa|cuando (nos |me )?v(amos|oy)|se queda solo|destruy|rompe/.test(d)) {
    return {
      svc: null, needsClarify: true,
      clarifyQ: 'Para entenderlo mejor — ¿llora y se descontrola <strong>solo cuando os vais</strong>, o también cuando estáis en casa pero no le hacéis caso?',
      clarifyOpts: [
        { icon: '🚪', label: 'Solo cuando nos vamos — en cuanto salimos empieza', fn: 'ansiedad' },
        { icon: '🏠', label: 'También estando nosotros en casa', fn: 'educacion' },
        { icon: '🔀', label: 'Las dos cosas', fn: 'ansiedad' },
      ],
    };
  }

  // Miedo con detonante claro — desambiguar con ansiedad
  if (/miedo.{0,20}(petardo|ruido|tormenta|veterinario|hombre|personas|coche|moto|niño)|fobia|terror/.test(d)) {
    return {
      svc: null, needsClarify: true,
      clarifyQ: '¿Hay algo concreto que lo dispare — un ruido, una situación, un tipo de persona — o le pasa también cuando no hay nada aparente?',
      clarifyOpts: [
        { icon: '🎯', label: 'Sí, hay algo concreto que lo dispara', fn: 'miedos' },
        { icon: '😰', label: 'Le pasa aunque no haya nada aparente', fn: 'ansiedad' },
        { icon: '🔀', label: 'Las dos cosas', fn: 'miedos' },
      ],
    };
  }

  // Ansiedad sin detonante claro
  if (/ansied|estr[eé]s|pánico|pànico|tiembla|jadea|nervios|asust|no se relaja|siempre alerta/.test(d)) {
    return { svc: 'ansiedad', needsClarify: false };
  }

  // Educación básica — incluye casos ambiguos de falta de atención y vínculo
  if (/no hace caso|no obedece|no me hace caso|sordo|como sordo|ignora|no atiende|falta.{0,20}vinculo|vinculo|sin vinculo|no conecta|no me escucha|orden|obedien|salta encima|tira.{0,15}correa|paseo.{0,20}(mal|imposible)|educac|básic|adoptado|tira cuando|no se queda quieto|no para/.test(d)) {
    return { svc: 'educacion', needsClarify: false };
  }

  // Ambiguo — en lugar de derivar al WhatsApp, orientamos hacia educación básica
  // que es el punto de partida más neutral para una evaluación
  return { svc: 'educacion', needsClarify: false };
}

/* ════════════════════════════════════════════
   FLUJO PRINCIPAL
   ════════════════════════════════════════════ */

export async function start() {
  prog(0);
  await new Promise(r => setTimeout(r, 600));
  await bot(`¡Hola! Soy Victoria, coordinadora de <em>Perros de la Isla</em> 🐾<br><br>Estoy aquí para ayudarte a encontrar la mejor solución para tu compañero y conectarte con el adiestrador que llevará su caso. ¿Empezamos?`, 1900);
  setTimeout(s1, 400);
}

/* ── S1: Zona ── */
async function s1() {
  prog(8);
  await bot(`Lo primero — trabajamos a domicilio, así que necesito saber si llegamos hasta vosotros. ¿En qué zona de Mallorca estáis?`, 1200);
  showOpts('¿Dónde estáis?', [
    { icon: '📍', label: 'Palma y alrededores', fn: () => { S.zona = 'Palma'; usr('Palma y alrededores'); s2(); } },
    { icon: '📍', label: 'Calviá y zona oeste', fn: () => { S.zona = 'Calviá'; usr('Calviá y zona oeste'); s2(); } },
    { icon: '📍', label: 'Llucmajor y zona este', fn: () => { S.zona = 'Llucmajor'; usr('Llucmajor y zona este'); s2(); } },
    { icon: '📍', label: 'Inca y zona norte', fn: () => { S.zona = 'Inca'; usr('Inca y zona norte'); s2(); } },
    { icon: '🗺️', label: 'Otra zona de la isla', sub: 'Pollença, Manacor, Felanitx...', fn: () => { S.zona = 'Otra'; usr('Otra zona'); sFuera(); } },
  ]);
}

async function sFuera() {
  await bot(`Ay, de momento no llegamos hasta esa zona 😕 Cubrimos principalmente Palma, Calviá, Llucmajor e Inca y sus alrededores.<br><br>Si estás cerca de alguna de esas áreas, escríbenos y miramos si es posible.`, 1700);
  widget(`<div class="warn">📱 <strong>622 922 173</strong> (WhatsApp)<br>📧 perrosdelaislapalma@gmail.com</div>`);
}

/* ── S2: Nombre del perro ── */
async function s2() {
  prog(16);
  await bot(`¡Perfecto, llegamos hasta vosotros! 🙌 ¿Cómo se llama tu perro? Si tienes varios, dime todos.`, 1100);
  showText('Ej: Max, Luna y Coco...', async v => {
    S.dog = v;
    const names = parseDogs(v);
    if (names.length > 1) {
      S.dogs = names.map(n => ({ name: n, age: null, svc: null, desc: '' }));
      S.multiDog = true;
      s2b(names);
    } else {
      S.dogs = [{ name: names[0], age: null, svc: null, desc: '' }];
      S.multiDog = false;
      dogIdx = 0;
      s3();
    }
  }, s1);
}

async function s2b(names) {
  const lista = names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1];
  await bot(`¡Qué pandilla! 🐾 <em>${lista}</em> — apuntados. ¿Todos tienen el mismo tipo de problema o cada uno tiene el suyo?`, 1400);
  showOpts('¿Mismo problema o diferente?', [
    { icon: '🔄', label: 'Todos tienen el mismo problema', fn: () => { S.diffProb = false; usr('Todos tienen el mismo problema'); dogIdx = 0; s3(); } },
    { icon: '🔀', label: 'Cada perro tiene su problemática', fn: () => { S.diffProb = true; usr('Cada uno tiene el suyo'); dogIdx = 0; s3(); } },
  ], s2);
}

/* ── S3: Edad ── */
async function s3() {
  prog(24);
  const n = S.dogs[dogIdx]?.name || S.dogs[0]?.name;
  const plural = S.multiDog && !S.diffProb;
  await bot(plural
    ? `¡Qué pandilla! ¿Cuántos años tienen más o menos? Si son edades distintas, dime la del mayor.`
    : `¡Qué nombre tan bonito! 🐾 ¿Cuántos años tiene <em>${n}</em> más o menos?`, 1000);
  showOpts(plural ? 'Edad aproximada' : 'Edad de ' + n, [
    { icon: '🐶', label: 'Cachorro · menos de 1 año', sub: 'Todavía descubriendo el mundo', fn: () => { setAge('cachorro'); usr('Cachorro'); s4(); } },
    { icon: '🐕', label: 'Joven · 1 a 3 años', sub: 'La adolescencia puede ser intensa', fn: () => { setAge('joven'); usr('Joven, 1-3 años'); s4(); } },
    { icon: '🐕‍🦺', label: 'Adulto · 3 a 8 años', sub: 'Nunca es tarde para aprender', fn: () => { setAge('adulto'); usr('Adulto'); s4(); } },
    { icon: '🦮', label: 'Senior · más de 8 años', sub: 'Los mayores también mejoran', fn: () => { setAge('senior'); usr('Mayor de 8 años'); s4(); } },
  ], s2);
}

function setAge(age) {
  S.age = age;
  if (S.diffProb) S.dogs[dogIdx].age = age;
  else S.dogs.forEach(d => d.age = age);
}

/* ── S4: Descripción libre + diagnóstico ── */
async function s4() {
  prog(34);
  const d = S.dogs[dogIdx] || S.dogs[0];
  const plural = S.multiDog && !S.diffProb;
  await bot(plural
    ? `Cuéntame — ¿qué está pasando con el grupo? No hace falta que sea preciso, cuéntamelo como se lo contarías a un amigo.`
    : `Cuéntame — ¿qué está pasando con <em>${d.name}</em>? No hace falta que sepas exactamente qué es.`,
    1300);
  showText('Cuéntame qué está pasando...', async v => {
    S.desc = v;
    if (S.diffProb) {
      S.dogs[dogIdx].desc = v;
      await s4_diagnose(dogIdx, v, true);
    } else {
      S.dogs.forEach(d2 => d2.desc = v);
      await s4_diagnose(0, v, false);
    }
  }, s3);
}

async function s4_diagnose(idx, desc, perDog) {
  const d = S.dogs[idx];
  const age = perDog ? d.age : S.age;
  const result = diagnose(age, desc);
  const n = d.name;

  // Empatía primero — silenciosa, si falla la IA el flujo continúa igual
  await askVicSilent(
    `El tutor describe esta situación con su perro${perDog ? ' ' + n : ''}: "${desc}". Responde con empatía genuina — valida, normaliza, acompaña en 2-3 frases. No des protocolos todavía. Usa palabras literales de su descripción para reflejar que escuchaste de verdad.`,
    `Perro: ${n}, ${age}. Zona: ${S.zona}.`
  );

  if (result.svc === 'derivacion') {
    // Caso de derivación
    if (perDog) d.svc = 'derivacion';
    else S.dogs.forEach(d2 => d2.svc = 'derivacion');
    S.svc = 'derivacion';
    await s4_mostrar_derivacion(n);
    return;
  }

  if (result.needsClarify) {
    await bot(result.clarifyQ, 1200);
    showOpts('Una pregunta más', result.clarifyOpts.map(o => ({
      icon: o.icon, label: o.label,
      fn: () => {
        usr(o.label);
        if (perDog) d.svc = o.fn;
        else { S.svc = o.fn; S.dogs.forEach(d2 => d2.svc = o.fn); }
        s4_confirm(idx, o.fn, perDog);
      },
    })));
  } else {
    if (perDog) d.svc = result.svc;
    else { S.svc = result.svc; S.dogs.forEach(d2 => d2.svc = result.svc); }
    await s4_confirm(idx, result.svc, perDog);
  }
}

async function s4_confirm(idx, svcKey, perDog) {
  const svc = SVCS[svcKey] || SVCS.orientacion;
  const n = S.dogs[idx]?.name;
  const plural = S.multiDog && !S.diffProb;

  await bot(
    `Por lo que me cuentas, lo que ${plural ? 'vuestros perros necesitan' : 'necesita <em>' + n + '</em>'} parece estar relacionado con <strong>${svc.n}</strong>. Esto es orientativo — el adiestrador puede ver algo diferente cuando lo conozca en persona. ¿Seguimos?`,
    1400
  );

  if (perDog) {
    // Multi-dog diferente — siguiente perro
    setTimeout(() => s4_multi_next(), 400);
  } else {
    setTimeout(s5, 400);
  }
}

async function s4_mostrar_derivacion(nombre) {
  const svc = SVCS.derivacion;
  await bot(`Por lo que me cuentas sobre <em>${nombre}</em>, creo que el primer paso ideal sería una evaluación con un etólogo. Son especialistas en estos casos y eso le dará la mejor base de trabajo. 🙏`, 1600);
  widget(`
    <div class="deriv-box">
      <div class="stag">Recomendación</div>
      <div class="sname titulo-bebas" style="margin-top:6px">${svc.n}</div>
      <div class="sdesc" style="margin-top:6px">${svc.d}</div>
      <div class="snote">💡 ${svc.nota}</div>
    </div>
    <div class="warn" style="margin-top:8px">
      📱 Si en algún momento necesitáis más orientación, estamos aquí.<br>
      <a href="https://wa.me/34622922173">WhatsApp: 622 922 173</a>
    </div>
  `);
}

async function s4_multi_next() {
  dogIdx++;
  if (dogIdx < S.dogs.length) {
    await bot(`Perfecto 👍 Ahora cuéntame sobre <em>${S.dogs[dogIdx].name}</em>.`, 900);
    setTimeout(s4, 400);
  } else {
    // Todos los perros diagnosticados
    S.svc = S.dogs[0].svc || 'orientacion';
    S.age = S.dogs[0].age;
    S.desc = S.dogs.map(d => `${d.name}: ${d.desc}`).join(' | ');
    setTimeout(s5, 400);
  }
}

/* ── S5: Más detalles ── */
async function s5() {
  prog(45);
  if (S.svc === 'derivacion') return; // No seguir si es derivación
  const n = S.dogs[0]?.name;
  const plural = S.multiDog && !S.diffProb;
  await bot(plural
    ? `Para que el adiestrador llegue bien preparado — ¿puedes contarme algo más? Si hay diferencias entre ellos, menciónalo.`
    : `Para que el adiestrador llegue bien preparado — ¿puedes contarme algo más sobre <em>${n}</em>? Cuándo ocurre, cómo reacciona...`,
    1400);
  showText('Cualquier detalle ayuda...', async v => {
    S.desc += ' ' + v;
    S.dogs.forEach(d => { d.desc += ' ' + v; });
    setTimeout(s6, 400);
  }, s4);
}

/* ── S6: Duración ── */
async function s6() {
  prog(55);
  await bot(`¿Cuánto tiempo lleváis con esta situación?`, 900);
  showOpts('¿Desde cuándo?', [
    { icon: '🌱', label: 'Hace poco · menos de 3 meses', fn: () => { S.dur = 'menos de 3 meses'; usr('Hace poco'); s7(); } },
    { icon: '📅', label: 'Varios meses · 3 a 12 meses', fn: () => { S.dur = '3-12 meses'; usr('Varios meses'); s7(); } },
    { icon: '📆', label: 'Más de un año', fn: () => { S.dur = 'más de un año'; usr('Más de un año'); s7(); } },
    { icon: '🤷', label: 'Siempre ha sido así', fn: () => { S.dur = 'siempre'; usr('Siempre ha sido así'); s7(); } },
  ], s5);
}

/* ── S7: Experiencia previa ── */
async function s7() {
  prog(63);
  await bot(`¿Habéis trabajado antes con algún adiestrador, o probado algo por vuestra cuenta?`, 1000);
  showOpts('Experiencia previa', [
    { icon: '🙅', label: 'No, primera vez', fn: () => { S.prev = 'primera vez'; usr('Primera vez'); s8(); } },
    { icon: '✅', label: 'Sí, con adiestrador · método positivo', fn: () => { S.prev = 'positivo'; usr('Sí, método positivo'); s8(); } },
    { icon: '⚙️', label: 'Sí, con adiestrador · método coercitivo', sub: 'Correcciones, collares de pinchos...', fn: () => { S.prev = 'coercitivo'; usr('Sí, método coercitivo'); s8(); } },
    { icon: '📱', label: 'Sí, por mi cuenta / internet', fn: () => { S.prev = 'cuenta propia'; usr('Sí, por mi cuenta'); s8(); } },
    { icon: '🔀', label: 'Varias cosas distintas', fn: () => { S.prev = 'varios intentos'; usr('Varias cosas'); s8(); } },
  ], s6);
}

/* ── S8: Resumen y propuesta ── */
async function s8() {
  prog(72);
  if (!S.svc) S.svc = 'orientacion';
  S.dogs.forEach(d => { if (!d.svc) d.svc = S.svc; });

  const n = S.dogs[0]?.name;
  const plural = S.multiDog;
  const ctx = S.diffProb
    ? S.dogs.map(d => `${d.name} (${d.age}): ${SVCS[d.svc || 'orientacion'].n} — ${d.desc}`).join(' | ')
    : `Perros: ${S.dog}, ${S.age}. Zona: ${S.zona}. Problema: ${S.desc}. Duración: ${S.dur}. Experiencia: ${S.prev}. Servicio: ${SVCS[S.svc].n}.`;

  await askVic(
    plural
      ? `Con todo lo que me has contado sobre mis perros (${S.dogs.map(d => d.name).join(', ')}), ¿qué recomiendas y qué puedo esperar de la primera sesión con el adiestrador?`
      : `Con todo lo que me has contado, ¿qué le recomiendas a ${n} y qué puedo esperar de la primera sesión con el adiestrador?`,
    ctx
  );

  // Cards de servicio
  let cardsHtml = '';
  if (S.diffProb) {
    cardsHtml = S.dogs.map(d => {
      const sv = SVCS[d.svc || 'orientacion'];
      return `
        <div style="margin-bottom:6px">
          <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">🐾 ${d.name}</div>
          <div class="scard on">
            <div class="stag">${sv.tag}</div>
            <div class="sname titulo-bebas">${sv.n}</div>
            <div class="sdesc">${sv.d}</div>
            <div class="snote">💡 ${sv.nota}</div>
          </div>
        </div>`;
    }).join('');
  } else {
    const sv = SVCS[S.svc];
    cardsHtml = `
      <div class="scard on">
        <div class="stag">${sv.tag}</div>
        <div class="sname titulo-bebas">${sv.n}</div>
        <div class="sdesc">${sv.d}</div>
        <div class="snote">💡 ${sv.nota}</div>
      </div>`;
  }

  await bot(plural ? `Esta sería mi propuesta para el grupo 👇` : `Esta sería mi propuesta para <em>${n}</em> 👇`, 700);
  widget(`
    <div>
      ${cardsHtml}
      <div class="prow">
        <div class="pcard">
          <div class="pamt">90€</div>
          <div class="plbl">Sesión individual</div>
          <div class="plbl">a domicilio</div>
        </div>
        <div class="pcard hi">
          <div class="pamt">300€</div>
          <div class="plbl">Pack 4 sesiones</div>
          <div class="psave">Ahorras 60€</div>
        </div>
      </div>
      <button class="bmain" onclick="irAgendar()">Quiero reservar una cita →</button>
      <button class="bsec" onclick="irDuda()">Tengo una pregunta antes</button>
      <button class="bsec" onclick="irS7()">← Ajustar mis respuestas</button>
    </div>
  `);

  window.irAgendar = s9;
  window.irDuda = sDuda;
  window.irS7 = s7;
}

async function sDuda() {
  if (locked) return;
  locked = true; setTimeout(() => { locked = false; }, 500);
  await bot(`Claro, dime — ¿qué te ronda por la cabeza?`, 900);
  showText('Tu pregunta...', async v => {
    await askVic(v, `Duda antes de reservar. Servicio: ${SVCS[S.svc || 'orientacion'].n}. Perro: ${S.dog}.`);
    widget(`<button class="bmain" onclick="irAgendar()">Ver horarios disponibles →</button>`);
  });
}

/* ── S9: Agenda ── */
async function s9() {
  prog(80);
  if (locked) return; locked = true; setTimeout(() => { locked = false; }, 600);
  await bot(`¡Vamos a por ello! Déjame ver los huecos disponibles 📅`, 1100);

  const agendaEl = await renderAgenda(
    (slot) => {
      S.slot = slot;
      usr(`${slot.label} · ${slot.hora}h`);
      s10();
    },
    s8
  );
  widgetEl(agendaEl);
}

/* ── S10: Pago ── */
async function s10() {
  prog(87);
  await bot(`Anotado 📌 Para confirmar la cita necesito una seña de <em>45€</em> — el 50% de la primera sesión. El resto lo pagas en mano el día de la sesión.<br><br>Si la cancelas con <strong>48h de antelación</strong>, te la devolvemos sin problema. ¿Cómo prefieres pagar?`, 1800);

  const pagosEl = renderPagos(
    async ({ metodo, archivo }) => {
      S.pago = metodo;
      usr('He pagado por ' + metodo);
      s11(archivo);
    },
    s9
  );
  widgetEl(pagosEl);
}

/* ── S11: Formulario de datos ── */
async function s11(archivoComprobante) {
  prog(93);
  await bot(`¡Perfecto! Ya casi estamos 🙌 Solo necesito tus datos para que el adiestrador llegue bien preparado.`, 1200);
  widget(`
    <div>
      <div class="frow">
        <div><label class="flbl">Tu nombre completo *</label><input class="fin" id="fN" type="text" placeholder="Nombre y apellidos" oninput="chkF()"></div>
        <div><label class="flbl">WhatsApp *</label><input class="fin" id="fT" type="tel" placeholder="+34 6XX XXX XXX" oninput="chkF()"></div>
      </div>
      <label class="flbl">Email (para la confirmación)</label>
      <input class="fin" id="fE" type="email" placeholder="tu@email.com">
      <label class="flbl">Dirección completa *</label>
      <input class="fin" id="fD" type="text" placeholder="Calle, número, piso · municipio" oninput="chkF()">
      <div class="frow">
        <div><label class="flbl">Nombre del perro *</label><input class="fin" id="fP" type="text" value="${esc(S.dog)}" oninput="chkF()"></div>
        <div><label class="flbl">Raza</label><input class="fin" id="fRz" type="text" placeholder="Ej: Labrador"></div>
      </div>
      <label class="flbl">Edad exacta del perro</label>
      <input class="fin" id="fAe" type="text" placeholder="Ej: 2 años y 3 meses">
      <label class="flbl">Experiencia previa con adiestradores y método</label>
      <input class="fin" id="fAd" type="text" placeholder="Ej: No / Sí, positivo / Sí, collar de pinchos...">
      <label class="flbl">Describe el problema con el máximo detalle *</label>
      <textarea class="fin" id="fRes" placeholder="Cuándo empezó, qué lo desencadena, cómo reacciona... El adiestrador leerá esto antes de llegar." oninput="chkF()"></textarea>
      <button class="bmain verde" id="benv" onclick="enviarFormulario()" disabled>Confirmar mi cita 🐾</button>
      <button class="bsec" onclick="irS10()">← Volver al pago</button>
    </div>
  `);

  window.chkF = () => {
    const ok = ['fN', 'fT', 'fD', 'fP', 'fRes'].every(id => document.getElementById(id)?.value.trim().length > 0);
    const b = document.getElementById('benv');
    if (b) b.disabled = !ok;
  };

  window.irS10 = () => s10();

  window.enviarFormulario = async () => {
    if (locked) return; locked = true;
    await s12(archivoComprobante);
  };
}

/* ── S12: Confirmación final ── */
async function s12(archivoComprobante) {
  prog(100);
  const nombre = document.getElementById('fN')?.value || '';
  const telefono = document.getElementById('fT')?.value || '';
  const email = document.getElementById('fE')?.value || '';
  const direccion = document.getElementById('fD')?.value || '';
  const perro = document.getElementById('fP')?.value || S.dog;
  const raza = document.getElementById('fRz')?.value || '';
  const edad = document.getElementById('fAe')?.value || '';
  const metodoPrevio = document.getElementById('fAd')?.value || '';
  const resumen = document.getElementById('fRes')?.value || '';

  usr('¡Enviado!');

  try {
    // Guardar en Supabase
    const { citaId, clienteId } = await guardarReserva({
      cliente: { nombre, telefono, email, direccion, zona: S.zona, notas: resumen },
      perros: S.dogs.map(d => ({
        nombre: d.name || perro,
        raza, edad,
        problematica: SVCS[d.svc || 'orientacion']?.n,
        descripcion: d.desc || resumen,
        metodoPrevio,
      })),
      cita: {
        fecha: S.slot.fecha,
        hora: S.slot.hora,
        metodoPago: S.pago,
        protocolo: SVCS[S.svc || 'orientacion']?.n,
        notas: resumen,
      },
    });

    S.citaId = citaId;
    S.clienteId = clienteId;

    // Subir comprobante si existe
    if (archivoComprobante) {
      try {
        const url = await subirComprobante(archivoComprobante, citaId);
        await confirmarSena(citaId, S.pago, url);
      } catch (e) {
        await confirmarSena(citaId, S.pago, null);
      }
    }

  } catch (e) {
    console.error('Error guardando reserva:', e);
    // Continuar aunque falle Supabase — al menos llega el WhatsApp
  }

  // Checkmark
  widget(`<div class="sicon"><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><polyline points="4,14 10,20 22,7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`);

  await bot(`¡Todo listo, <em>${esc(nombre.split(' ')[0])}</em>! 🎉 He recibido tu solicitud. Revisamos el comprobante y te confirmo la cita en menos de 24h por WhatsApp.`, 1900);

  // Resumen
  const svcLabel = S.diffProb
    ? S.dogs.map(d => `${d.name}: ${SVCS[d.svc || 'orientacion'].n}`).join('<br>')
    : SVCS[S.svc || 'orientacion'].n;

  widget(`
    <div style="background:var(--s2);border:1px solid var(--s3);border-radius:var(--r16);padding:14px 15px">
      <div class="srow"><span class="sk">Servicio</span><span class="sv" style="font-size:12px">${svcLabel}</span></div>
      <div class="srow"><span class="sk">Perro/s</span><span class="sv">${esc(perro)}${raza ? ' · ' + esc(raza) : ''}</span></div>
      <div class="srow"><span class="sk">Fecha y hora</span><span class="sv">${S.slot.label} · ${S.slot.hora}h</span></div>
      <div class="srow"><span class="sk">Zona</span><span class="sv">${S.zona}</span></div>
      <div class="srow"><span class="sk">Seña abonada</span><span class="sv verde">45€ · ${S.pago}</span></div>
      <div class="srow"><span class="sk">Cancelación</span><span class="sv">Con 48h → devolución completa</span></div>
    </div>
  `);

  // Notificación WhatsApp a Carlos
  const waMsg = buildWhatsAppMsg({
    cliente: { nombre, telefono, email, direccion, zona: S.zona, notas: resumen },
    perros: S.dogs.map(d => ({ nombre: d.name || perro, raza, edad, problematica: SVCS[d.svc || 'orientacion']?.n, descripcion: d.desc })),
    slot: S.slot,
    metodo: S.pago,
    protocolo: SVCS[S.svc || 'orientacion']?.n,
  });

  widget(`
    <a href="https://wa.me/34653591301?text=${waMsg}" target="_blank" 
       class="bmain" style="display:block;text-align:center;text-decoration:none;background:var(--verde)">
      📱 Notificar al equipo por WhatsApp
    </a>
  `);

  await askVic(
    'La reserva está confirmada. ¿Hay algo que deba preparar antes de la primera sesión con el adiestrador?',
    `Cliente: ${nombre}. Perros: ${perro}. Cita: ${S.slot.label} ${S.slot.hora}h. Servicio: ${SVCS[S.svc || 'orientacion']?.n}. Zona: ${S.zona}.`
  );
}
