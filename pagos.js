/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Embudo Victoria
   pagos.js — Flujo de seña Bizum
   ═══════════════════════════════════════════ */

const BIZUM_NUM = '653591301';
const BIZUM_IMPORTE = '45';
const BIZUM_CONCEPTO = 'Cita Perros de la Isla';

/**
 * Renderiza el widget de pago de seña
 * @param {Function} onPagado - callback cuando confirma el pago
 * @param {Function} onVolver - callback para botón atrás
 * @returns {HTMLElement}
 */
export function renderPagos(onPagado, onVolver) {
  const wrap = document.createElement('div');

  wrap.innerHTML = `
    <!-- Opciones de pago -->
    <div id="pay-opts">
      <div class="payopt" id="pay-bizum" onclick="elegirPago('bizum')">
        <span class="picon">📱</span>
        <div>
          <div class="pname">Bizum</div>
          <div class="pdetail">Al ${BIZUM_NUM} · la forma más rápida</div>
        </div>
      </div>
      <div class="payopt" id="pay-transferencia" onclick="elegirPago('transferencia')">
        <span class="picon">🏦</span>
        <div>
          <div class="pname">Transferencia bancaria</div>
          <div class="pdetail">Te mando los datos por WhatsApp ahora mismo</div>
        </div>
      </div>
    </div>

    <!-- Instrucciones Bizum (oculto hasta elegir) -->
    <div id="instrucciones-bizum" style="display:none">
      <div class="admin-card" style="margin-bottom:8px">
        <div class="admin-card-title" style="font-size:13px;margin-bottom:8px">Envía la seña por Bizum 📱</div>
        <div class="srow"><span class="sk">Número</span><span class="sv" style="font-family:monospace;letter-spacing:1px">${BIZUM_NUM}</span></div>
        <div class="srow"><span class="sk">Importe</span><span class="sv verde">${BIZUM_IMPORTE}€</span></div>
        <div class="srow"><span class="sk">Concepto</span><span class="sv">${BIZUM_CONCEPTO}</span></div>
      </div>
      <div class="chkw" id="chkw-bizum">
        <input type="checkbox" id="chk-bizum" onchange="toggleConfirmarPago()">
        <label for="chk-bizum">Ya he enviado los 45€ por Bizum y tengo el comprobante</label>
      </div>
      <div id="upload-bizum" style="display:none;margin-top:8px">
        <label class="flbl">Sube la captura del Bizum *</label>
        <input class="fin" type="file" id="comprobante-file" accept="image/*" style="padding:8px;cursor:pointer" onchange="validarComprobante()">
        <button class="bmain verde" id="btn-confirmar-pago" onclick="confirmarPago()" disabled>
          Confirmar pago y continuar →
        </button>
      </div>
      <button class="bsec" onclick="pagoVolver()">← Elegir otro método</button>
    </div>

    <!-- Instrucciones transferencia (oculto hasta elegir) -->
    <div id="instrucciones-transferencia" style="display:none">
      <div class="admin-card" style="margin-bottom:8px">
        <div class="admin-card-title" style="font-size:13px;margin-bottom:8px">Datos para la transferencia 🏦</div>
        <div class="srow"><span class="sk">Titular</span><span class="sv">Carlos Antonio Acevedo</span></div>
        <div class="srow"><span class="sk">IBAN</span><span class="sv" style="font-family:monospace;letter-spacing:1px;font-size:11.5px">ES27 0182 5319 7002 0055 6013</span></div>
        <div class="srow"><span class="sk">Importe</span><span class="sv verde">45€</span></div>
        <div class="srow"><span class="sk">Concepto</span><span class="sv">Cita Perros de la Isla</span></div>
      </div>
      <div class="chkw" id="chkw-transf">
          <input type="checkbox" id="chk-transf" onchange="toggleConfirmarTransf()">
          <label for="chk-transf">Ya he realizado la transferencia de 45€</label>
        </div>
        <div id="upload-transf" style="display:none;margin-top:8px">
          <label class="flbl">Sube el comprobante de la transferencia *</label>
          <input class="fin" type="file" id="comprobante-transf" accept="image/*,.pdf" 
                 style="padding:8px;cursor:pointer" onchange="validarComprobanteTransf()">
          <button class="bmain verde" id="btn-confirmar-transf" onclick="confirmarPagoTransf()" disabled>
            Confirmar pago y continuar →
          </button>
        </div>
      </div>
      <button class="bsec" onclick="pagoVolver()">← Elegir otro método</button>
    </div>
  `;

  // Estado interno
  let metodoPago = null;
  let archivoComprobante = null;

  // ── Elegir método ──
  window.elegirPago = (metodo) => {
    metodoPago = metodo;
    document.querySelectorAll('.payopt').forEach(p => p.classList.remove('on'));
    document.getElementById('pay-opts').style.display = 'none';

    if (metodo === 'bizum') {
      document.getElementById('instrucciones-bizum').style.display = 'block';
      document.getElementById('pay-bizum')?.classList.add('on');
    } else {
      document.getElementById('instrucciones-transferencia').style.display = 'block';
    }
  };

  // ── Bizum ──
  window.toggleConfirmarPago = () => {
    const checked = document.getElementById('chk-bizum').checked;
    document.getElementById('upload-bizum').style.display = checked ? 'block' : 'none';
    if (!checked) archivoComprobante = null;
  };

  window.validarComprobante = () => {
    const file = document.getElementById('comprobante-file').files[0];
    archivoComprobante = file || null;
    document.getElementById('btn-confirmar-pago').disabled = !file;
  };

  window.confirmarPago = () => {
    if (!archivoComprobante) return;
    onPagado({ metodo: 'Bizum', archivo: archivoComprobante });
  };

  // ── Transferencia ──
  window.toggleConfirmarTransf = () => {
    const checked = document.getElementById('chk-transf').checked;
    document.getElementById('upload-transf').style.display = checked ? 'block' : 'none';
  };

  window.validarComprobanteTransf = () => {
    const file = document.getElementById('comprobante-transf').files[0];
    document.getElementById('btn-confirmar-transf').disabled = !file;
    archivoComprobante = file || null;
  };

  window.confirmarPagoTransf = () => {
    if (!archivoComprobante) return;
    onPagado({ metodo: 'Transferencia', archivo: archivoComprobante });
  };

  // ── Volver ──
  window.pagoVolver = () => {
    metodoPago = null;
    archivoComprobante = null;
    document.getElementById('instrucciones-bizum').style.display = 'none';
    document.getElementById('instrucciones-transferencia').style.display = 'none';
    document.getElementById('pay-opts').style.display = 'block';
    if (onVolver) onVolver();
  };

  return wrap;
}

/**
 * Sube el comprobante a Supabase Storage
 * Devuelve la URL pública del archivo
 */
export async function subirComprobante(archivo, citaId) {
  const SUPA_URL = 'https://sydzfwwiruxqaxojymdz.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZHpmd3dpcnV4cWF4b2p5bWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjAwODAsImV4cCI6MjA5MjMzNjA4MH0.0SpunQTuSwYaAjzWEDQivZy7971-Tf3CX2KxAEo8Nuw';

  const ext = archivo.name.split('.').pop();
  const nombre = `comprobantes/${citaId}.${ext}`;

  const res = await fetch(`${SUPA_URL}/storage/v1/object/pagos/${nombre}`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': archivo.type,
    },
    body: archivo,
  });

  if (!res.ok) throw new Error('Error subiendo comprobante');

  return `${SUPA_URL}/storage/v1/object/public/pagos/${nombre}`;
}

/**
 * Construye el mensaje de WhatsApp para notificar a Carlos
 */
export function buildWhatsAppMsg({ cliente, perros, slot, metodo, protocolo }) {
  const perrosStr = perros.map(p =>
    `  • ${p.nombre}${p.raza ? ' (' + p.raza + ')' : ''}${p.edad ? ', ' + p.edad : ''}: ${p.problematica || p.descripcion || ''}`
  ).join('\n');

  return encodeURIComponent(
`🐾 NUEVA CITA — Perros de la Isla

👤 Cliente: ${cliente.nombre}
📱 Teléfono: ${cliente.telefono}${cliente.email ? '\n📧 Email: ' + cliente.email : ''}
📍 Dirección: ${cliente.direccion || 'pendiente'}
🗺️ Zona: ${cliente.zona || ''}

🐕 Perro/s:
${perrosStr}

📋 Protocolo sugerido: ${protocolo}

📅 Fecha: ${slot.label} · ${slot.hora}h
💰 Seña: 45€ · ${metodo} ✓

Notas adicionales: ${cliente.notas || '—'}`
  );
}
