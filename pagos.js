/**
 * pagos.js
 * Perros de la Isla — Embudo Victoria
 * Gestión del pago de seña (Bizum / Transferencia)
 * Versión 1.2 · Abril 2026
 *
 * Cambios v1.2:
 * 1. Botón único #btn-confirmar-pago (en vez de uno por método).
 * 2. _previsualizarArchivo sin parámetro btnId.
 * 3. confirmarPago usa errorId="pago-error" y btnId="btn-confirmar-pago".
 * 4. Nuevos helpers _marcarBotonActivo y _actualizarBotonConfirmar.
 * 5. Bloques HTML bizum/transf refactorizados (sin botón interno, upload-label mejorada).
 */

const SUPA_URL = "https://sydzfwwiruxqaxojymdz.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZHpmd3dpcnV4cWF4b2p5bWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjAwODAsImV4cCI6MjA5MjMzNjA4MH0.0SpunQTuSwYaAjzWEDQivZy7971-Tf3CX2KxAEo8Nuw";
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
        El resto (${precio}€) se paga presencialmente el día de la clase.
      </p>

      <div class="pay-opts">
        <button class="pay-btn" id="btn-bizum">💳 Bizum</button>
        <button class="pay-btn" id="btn-transf">🏦 Transferencia</button>
      </div>

      <div id="bloque-bizum" class="pay-block hidden">
        <p>Envía <strong>${precio}€</strong> por Bizum al número:</p>
        <p class="pay-number">653 591 301</p>
        <p class="pay-concepto">Concepto: <em>Cita ${datosCita.nombre ?? ""}</em></p>
        <label class="upload-label" for="input-captura-bizum">
          <span class="upload-label-text">📎 Toca aquí para subir la captura del Bizum</span>
          <input type="file" id="input-captura-bizum"
            accept="image/*" capture="environment"
            class="upload-input" />
        </label>
        <div id="preview-bizum" class="upload-preview hidden"></div>
      </div>

      <div id="bloque-transf" class="pay-block hidden">
        <p>Realiza una transferencia de <strong>${precio}€</strong> a:</p>
        <p class="pay-label">IBAN</p>
        <p class="pay-iban">ES27 0182 5319 7002 0055 6013</p>
        <p class="pay-titular">Titular: Carlos Antonio Acevedo</p>
        <p class="pay-concepto">Concepto: <em>Cita ${datosCita.nombre ?? ""}</em></p>
        <label class="upload-label" for="input-captura-transf">
          <span class="upload-label-text">📎 Toca aquí para subir el justificante</span>
          <input type="file" id="input-captura-transf"
            accept="image/*,application/pdf" capture="environment"
            class="upload-input" />
        </label>
        <div id="preview-transf" class="upload-preview hidden"></div>
      </div>

      <button class="pay-confirm-btn hidden" id="btn-confirmar-pago">
        Confirmar pago
      </button>
      <p id="pago-error" class="pay-error hidden"></p>

      <button class="back-btn" id="btn-volver-pago">← Volver</button>
    </div>
  `;

  // Estado interno del widget
  let metodoElegido = null;

  // Eventos
  contenedor.querySelector("#btn-bizum").addEventListener("click", () => {
    metodoElegido = "bizum";
    _mostrarBloque("bloque-bizum", "bloque-transf", contenedor);
    _marcarBotonActivo("btn-bizum", "btn-transf", contenedor);
    _actualizarBotonConfirmar(contenedor, metodoElegido);
  });

  contenedor.querySelector("#btn-transf").addEventListener("click", () => {
    metodoElegido = "transf";
    _mostrarBloque("bloque-transf", "bloque-bizum", contenedor);
    _marcarBotonActivo("btn-transf", "btn-bizum", contenedor);
    _actualizarBotonConfirmar(contenedor, metodoElegido);
  });

  contenedor.querySelector("#input-captura-bizum").addEventListener("change", (e) => {
    _previsualizarArchivo(e.target.files[0], "preview-bizum", contenedor);
  });

  contenedor.querySelector("#input-captura-transf").addEventListener("change", (e) => {
    _previsualizarArchivo(e.target.files[0], "preview-transf", contenedor);
  });

  contenedor.querySelector("#btn-confirmar-pago").addEventListener("click", () => {
    if (!metodoElegido) return;
    confirmarPago(metodoElegido, datosCita, contenedor, onPagoConfirmado);
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
  const errorId   = "pago-error";
  const btnId     = "btn-confirmar-pago";

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
        // Fallback a WhatsApp
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
// SUBIR COMPROBANTE — compresión + signed URL
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
  const esImagen = file.type.startsWith("image/");
  const blob = esImagen
    ? await _comprimirImagen(file, 1200, 0.8)
    : file; // PDFs no se comprimen

  const timestamp = Date.now();
  const nombre    = `cita_${datosCita.citaId ?? timestamp}_${timestamp}.jpg`;

  // Subir al bucket — sin x-upsert y sin Content-Type explícito
  // (Supabase detecta el MIME del Blob automáticamente y la anon key
  // acepta mejor el upload cuando no se fuerzan estos headers)
  const uploadRes = await fetch(
    `${SUPA_URL}/storage/v1/object/${BUCKET}/${nombre}`,
    {
      method: "POST",
      headers: {
        "apikey":        SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
      },
      body: blob,
    }
  );

  if (!uploadRes.ok) {
    throw new Error(`Error al subir comprobante: ${uploadRes.status}`);
  }

  // Signed URL con 30 días de expiración
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
 * Comprime una imagen con Canvas API nativo.
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

/** Marca visualmente el botón de método activo */
function _marcarBotonActivo(activoId, inactivoId, contenedor) {
  contenedor.querySelector(`#${activoId}`)?.classList.add("on");
  contenedor.querySelector(`#${inactivoId}`)?.classList.remove("on");
}

/** Muestra el botón único de confirmar con texto según el método elegido */
function _actualizarBotonConfirmar(contenedor, metodo) {
  const btn = contenedor.querySelector("#btn-confirmar-pago");
  if (!btn) return;
  btn.textContent = metodo === "bizum"
    ? "Confirmar pago por Bizum"
    : "Confirmar pago por transferencia";
  btn.classList.remove("hidden");
}

/** Previsualiza el archivo seleccionado */
function _previsualizarArchivo(file, previewId, contenedor) {
  if (!file) return;
  const preview = contenedor.querySelector(`#${previewId}`);
  if (!preview) return;

  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" alt="Vista previa" class="upload-thumb" />`;
  } else {
    preview.innerHTML = `<p class="upload-file-name">📎 ${file.name}</p>`;
  }
  preview.classList.remove("hidden");
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
