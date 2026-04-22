/**
 * pagos.js
 * Perros de la Isla — Embudo Victoria
 * Gestión del pago de seña (Bizum / Transferencia)
 * Versión 1.1 · Abril 2026
 *
 * Correcciones v1.1:
 * 1. HTML mal cerrado en bloque transferencia — </div> añadido.
 * 2. subirComprobante ahora comprime antes de subir (Canvas API, 1200px, 0.8).
 * 3. subirComprobante devuelve signed URL (30 días) en vez de URL pública.
 * 4. confirmarPago / confirmarPagoTransf con try/catch, retry y fallback WhatsApp.
 */

const SUPA_URL = "https://sydzfwwiruxqaxojymdz.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZHpmd3dpcnV4cWF4b2p5bWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2ODMzNDcsImV4cCI6MjA1OTI1OTM0N30.ixjBBHMsEu5ANxl4MXodVdYFhnlEi9MBnj0TxmPHxe0";
const BUCKET  = "pagos";

// ─────────────────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL — muestra las opciones de pago al cliente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza el bloque de pago en el contenedor dado.
 *
 * @param {HTMLElement} contenedor
 * @param {Object} datosCita — { nombre, telefono, slot, modalidad, precio }
 * @param {Function} onPagoConfirmado — callback cuando el pago se completa
 * @param {Function} onVolver — callback para volver al paso anterior
 */
export function renderPago(contenedor, datosCita, onPagoConfirmado, onVolver) {
  const precio = datosCita.precio ?? 45;

  contenedor.innerHTML = `
    <div class="pago-wrap">
      <h3>Reserva tu cita — seña de ${precio}€</h3>
      <p class="pago-info">
        Para confirmar la cita, abona la seña de <strong>${precio}€</strong>.
        El resto (${precio}€) se paga presencialmente el día de la sesión.
      </p>

      <div class="pay-opts">
        <button class="pay-btn" id="btn-bizum">💳 Bizum</button>
        <button class="pay-btn" id="btn-transf">🏦 Transferencia</button>
      </div>

      <div id="bloque-bizum" class="pay-block hidden">
        <p>Envía <strong>${precio}€</strong> por Bizum al número:</p>
        <p class="pay-number">653 591 301</p>
        <p class="pay-concepto">Concepto: <em>Cita ${datosCita.nombre ?? ""}</em></p>
        <label class="upload-label">
          Sube la captura del Bizum:
          <input type="file" id="input-captura-bizum"
            accept="image/*" capture="environment"
            class="upload-input" />
        </label>
        <div id="preview-bizum" class="upload-preview hidden"></div>
        <button class="pay-confirm-btn hidden" id="btn-confirmar-bizum">
          Confirmar pago
        </button>
        <p id="error-bizum" class="pay-error hidden"></p>
      </div>

      <div id="bloque-transf" class="pay-block hidden">
        <p>Realiza una transferencia de <strong>${precio}€</strong> a:</p>
        <p class="pay-iban">IBAN: ES27 0182 5319 7002 0055 6013</p>
        <p class="pay-titular">Titular: Carlos Antonio Acevedo</p>
        <p class="pay-concepto">Concepto: <em>Cita ${datosCita.nombre ?? ""}</em></p>
        <label class="upload-label">
          Sube el justificante de transferencia:
          <input type="file" id="input-captura-transf"
            accept="image/*,application/pdf" capture="environment"
            class="upload-input" />
        </label>
        <div id="preview-transf" class="upload-preview hidden"></div>
        <button class="pay-confirm-btn hidden" id="btn-confirmar-transf">
          Confirmar pago
        </button>
        <p id="error-transf" class="pay-error hidden"></p>
      </div>

      <button class="back-btn" id="btn-volver-pago">← Volver</button>
    </div>
  `;

  // Eventos
  contenedor.querySelector("#btn-bizum").addEventListener("click", () => {
    _mostrarBloque("bloque-bizum", "bloque-transf", contenedor);
  });

  contenedor.querySelector("#btn-transf").addEventListener("click", () => {
    _mostrarBloque("bloque-transf", "bloque-bizum", contenedor);
  });

  contenedor.querySelector("#input-captura-bizum").addEventListener("change", (e) => {
    _previsualizarArchivo(e.target.files[0], "preview-bizum", "btn-confirmar-bizum", contenedor);
  });

  contenedor.querySelector("#input-captura-transf").addEventListener("change", (e) => {
    _previsualizarArchivo(e.target.files[0], "preview-transf", "btn-confirmar-transf", contenedor);
  });

  contenedor.querySelector("#btn-confirmar-bizum").addEventListener("click", () => {
    confirmarPago("bizum", datosCita, contenedor, onPagoConfirmado);
  });

  contenedor.querySelector("#btn-confirmar-transf").addEventListener("click", () => {
    confirmarPago("transf", datosCita, contenedor, onPagoConfirmado);
  });

  contenedor.querySelector("#btn-volver-pago").addEventListener("click", onVolver);
}


// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMAR PAGO — con retry y fallback WhatsApp (Fix 4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gestiona la subida del comprobante y la confirmación del pago.
 * Reintenta una vez si falla. Si falla dos veces, ofrece fallback a WhatsApp.
 *
 * @param {'bizum'|'transf'} metodo
 * @param {Object} datosCita
 * @param {HTMLElement} contenedor
 * @param {Function} onPagoConfirmado
 */
export async function confirmarPago(metodo, datosCita, contenedor, onPagoConfirmado) {
  const inputId   = metodo === "bizum" ? "input-captura-bizum" : "input-captura-transf";
  const errorId   = metodo === "bizum" ? "error-bizum" : "error-transf";
  const btnId     = metodo === "bizum" ? "btn-confirmar-bizum" : "btn-confirmar-transf";

  const input   = contenedor.querySelector(`#${inputId}`);
  const errorEl = contenedor.querySelector(`#${errorId}`);
  const btnEl   = contenedor.querySelector(`#${btnId}`);

  if (!input?.files?.[0]) {
    _mostrarError(errorEl, "Por favor, sube la captura del pago antes de confirmar.");
    return;
  }

  btnEl.disabled = true;
  btnEl.textContent = "Subiendo…";
  _ocultarError(errorEl);

  let signedUrl = null;
  let intentos  = 0;

  while (intentos < 2) {
    try {
      signedUrl = await subirComprobante(input.files[0], datosCita);
      break; // éxito
    } catch (err) {
      intentos++;
      if (intentos >= 2) {
        // Fallback a WhatsApp — Fix 4
        _mostrarError(errorEl,
          "Ha habido un problema al subir la captura. Envíala por WhatsApp al 622 922 173 " +
          "y Carlos verificará el pago manualmente."
        );
        btnEl.disabled = false;
        btnEl.textContent = "Reintentar";

        // Marcar cita como pendiente de verificar pago
        await _marcarPagoPendiente(datosCita).catch(() => {});
        return;
      }
      // Espera breve antes de reintentar
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Pago confirmado — llamar callback con la URL firmada
  onPagoConfirmado({ metodo, signedUrl, pendienteVerificar: false });
}


// ─────────────────────────────────────────────────────────────────────────────
// SUBIR COMPROBANTE — compresión + signed URL (Fixes 2 y 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Comprime la imagen y la sube a Supabase Storage.
 * Devuelve una signed URL con 30 días de expiración (no URL pública).
 *
 * @param {File} file
 * @param {Object} datosCita — para construir el nombre del archivo
 * @returns {Promise<string>} signed URL
 */
export async function subirComprobante(file, datosCita) {
  // Fix 2: comprimir antes de subir
  const esImagen = file.type.startsWith("image/");
  const blob = esImagen
    ? await _comprimirImagen(file, 1200, 0.8)
    : file; // PDFs no se comprimen

  const timestamp = Date.now();
  const nombre    = `cita_${datosCita.citaId ?? timestamp}_${timestamp}.jpg`;

  // Subir al bucket
  const uploadRes = await fetch(
    `${SUPA_URL}/storage/v1/object/${BUCKET}/${nombre}`,
    {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": esImagen ? "image/jpeg" : file.type,
        "x-upsert": "false",
      },
      body: blob,
    }
  );

  if (!uploadRes.ok) {
    throw new Error(`Error al subir comprobante: ${uploadRes.status}`);
  }

  // Fix 3: signed URL con 30 días de expiración
  const signRes = await fetch(
    `${SUPA_URL}/storage/v1/object/sign/${BUCKET}/${nombre}`,
    {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 2592000 }), // 30 días en segundos
    }
  );

  if (!signRes.ok) {
    throw new Error(`Error al generar URL firmada: ${signRes.status}`);
  }

  const { signedURL } = await signRes.json();
  return `${SUPA_URL}${signedURL}`;
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fix 2: Comprime una imagen con Canvas API nativo.
 * Sin dependencias externas.
 *
 * @param {File} file
 * @param {number} maxWidth — ancho máximo en px
 * @param {number} quality — calidad JPEG (0-1)
 * @returns {Promise<Blob>}
 */
async function _comprimirImagen(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen para comprimir"));
    };

    img.onload = () => {
      const ratio  = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error("Canvas toBlob devolvió null"));
          else resolve(blob);
        },
        "image/jpeg",
        quality
      );
    };

    img.src = url;
  });
}

/**
 * Marca una cita como pendiente de verificar pago en Supabase.
 * Se llama cuando la subida del comprobante falla dos veces.
 */
async function _marcarPagoPendiente(datosCita) {
  if (!datosCita.citaId) return;
  await fetch(`${SUPA_URL}/rest/v1/citas?id=eq.${datosCita.citaId}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({ pago_pendiente_verificar: true }),
  });
}

/** Muestra un bloque de pago y oculta el otro */
function _mostrarBloque(mostrarId, ocultarId, contenedor) {
  contenedor.querySelector(`#${mostrarId}`)?.classList.remove("hidden");
  contenedor.querySelector(`#${ocultarId}`)?.classList.add("hidden");
}

/** Previsualiza el archivo seleccionado y muestra el botón de confirmar */
function _previsualizarArchivo(file, previewId, btnId, contenedor) {
  if (!file) return;
  const preview = contenedor.querySelector(`#${previewId}`);
  const btn     = contenedor.querySelector(`#${btnId}`);
  if (!preview || !btn) return;

  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" alt="Vista previa" class="upload-thumb" />`;
    preview.classList.remove("hidden");
  } else {
    preview.innerHTML = `<p class="upload-file-name">📎 ${file.name}</p>`;
    preview.classList.remove("hidden");
  }

  btn.classList.remove("hidden");
}

function _mostrarError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function _ocultarError(el) {
  if (!el) return;
  el.classList.add("hidden");
  el.textContent = "";
}
