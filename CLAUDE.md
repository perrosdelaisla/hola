# VictorIA · Perros de la Isla

VictorIA es el chatbot virtual que responde los WhatsApp del negocio **Perros de la Isla** (adiestramiento canino en Mallorca). Convierte consultas en clientes: escucha el problema del dueño con su perro, identifica el protocolo correcto y agenda la primera clase con seña de 45€ por Bizum o transferencia.

Está alojada en **perrosdelaisla.github.io/hola** (GitHub Pages, repo `victoria`). El propietario es Carlos Acevedo (Charly), instructor canino profesional.

Es el "hermano" del proyecto Paseos Seguros (perrosdelaisla.github.io). Comparte identidad de marca, tono y reglas de lenguaje, pero la app es completamente distinta: aquí no hay pestañas — es un embudo conversacional lineal.

---

## 1. Stack

- **HTML + CSS + JS vanilla** (ES6 modules nativos en el navegador, `<script type="module">`).
- **Sin frameworks, sin bundler, sin TypeScript, sin build step.** El código que se escribe es el que se sirve.
- **Backend: Supabase** (PostgREST + Storage), accedido por `fetch` directo a `/rest/v1/...` y `/storage/v1/...`. No se usa el SDK `@supabase/supabase-js`.
- **Notificaciones push: [ntfy.sh](https://ntfy.sh/)** topic `perrosdelaisla-citas-2026` — Charly lo recibe en el móvil cuando se confirma una cita.
- **PWA admin**: el panel en `admin/` es instalable como app (manifest.json + service worker que NO cachea — estrategia network-only).
- **Charts**: el panel admin usa Chart.js 4.4.1 desde CDN (solo en la pestaña Estadísticas).
- **Tipografías**: Bebas Neue + DM Sans desde Google Fonts.
- **Hosting**: GitHub Pages bajo `/hola/`. La app pública vive en la raíz del repo, el panel privado en `admin/`.

Tablas Supabase usadas: `clientes`, `perros`, `citas`, `conversaciones`, `sesiones`, `slots`, `bloqueos`. Bucket de Storage: `pagos`.

---

## 2. Estructura de la app (módulos del bot, no pestañas)

El UI público es un chat de un solo "viewport": splash de bienvenida → barra de progreso → conversación → input fijo abajo. No hay pestañas ni rutas. Toda la lógica conversacional vive en módulos JS que se importan desde [victoria.js](victoria.js).

### Núcleo
- **[victoria.js](victoria.js)** · orquestador principal. Máquina de estados `s0 → s12` (zona, nombre, datos del perro, problema, gravedad mordida, protocolo, agenda, slot, datos cliente, pago, captura, confirmación). Renderiza burbujas en el DOM, gestiona typing indicator, inserta agenda y widget de pago como burbujas, persiste en Supabase, dispara la notificación a Carlos. Lee parámetros de URL: `?tema=` (preselección desde la app de Paseos), `?origen=` (canal de captación) y `?prueba=1` (sesión que no cuenta en stats).
- **[victoria-utils.js](victoria-utils.js)** · `normalizar()`, `expandirAbreviaturas()` (mapa WhatsApp: `tng→tengo`, `xq→porque`, etc.), `contieneKeyword()`, `filtrarHits()`. Toda comparación de texto pasa por aquí.

### Detección
- **[victoria-zones.js](victoria-zones.js)** · cobertura geográfica. Tres listas: `ZONA_PRESENCIAL` (triángulo Palma–Inca–Llucmajor–Calvià), `ZONA_FUERA` (resto de la isla → online o derivar) y la excepción interna `EXCEPCION_INTERNA = ["son gotleu"]`. `detectarZona()` devuelve `{zonaDetectada, modalidad, esSonGotleu, necesitaAclaracion}`.
- **[victoria-breeds.js](victoria-breeds.js)** · lista oficial de razas PPP (RD 287/2002), `clasificarTamano(peso_kg)`, `requiereEtologo({es_ppp, peso_kg, hay_senal_conductual, gravedad_mordida, descripcion_agresion})`.
- **[victoria-dictionaries.js](victoria-dictionaries.js)** · los 7 diccionarios de cuadros con niveles `n1` (alta confianza, dispara solo), `n2` (corroboradores) y `n3` (contexto): `separacion`, `generalizada`, `miedos`, `reactividad`, `posesion`, `basica`, `cachorros`. También `DICT_LATERALES` (paseos grupales, adopciones, guardería, peluquería, veterinaria) y `detectarLateral()`.
- **[victoria-matching.js](victoria-matching.js)** · `decidirRespuesta(contexto)`. Arquitectura simplificada v2.0: 4 filtros en orden — (1) seguridad/mordida, (2) lateral, (3) zona, (4) mensaje principal unificado. Devuelve una `Decision` con `accion: "responder"|"derivar"|"preguntar"|"fallback"`.

### Frases
- **[victoria-phrases.js](victoria-phrases.js)** · todas las frases hardcoded en español. Bloques: `FRASES_PRESENCIAL`, `FRASES_ONLINE`, `FRASES_ETOLOGO`, `FRASE_DERIVACION_ZONA`, `FRASES_SON_GOTLEU`, `FRASES_LATERALES`, `FRASES_APOYO`, y las constantes v2.0 `FRASE_MENSAJE_PRINCIPAL`, `FRASE_RAMIFICACION`, `FRASE_COMO_TRABAJAMOS_*`, `FRASE_CIERRE_METODOLOGIA`, `FRASE_DURACION_UNIFICADA`. La función `obtenerFrase({tipo, vars})` resuelve plantillas con sustitución de `{perro}`, `{cuadro}`, etc.

### Widgets que se insertan en el chat
- **[agenda.js](agenda.js)** · `renderAgenda(contenedor, onSeleccion, onVolver)`. Lee slots disponibles desde Supabase, filtra primer día visible a hoy+5, agrupa por fecha, renderiza grid clicable. Fallback de WhatsApp si Supabase falla.
- **[pagos.js](pagos.js)** · `renderPago(contenedor, datosCita, onPagoConfirmado, onVolver)`. Bizum o transferencia, sube comprobante al bucket `pagos`, comprime imágenes con Canvas API antes de subir, genera Signed URL de 30 días, retry 1 vez con fallback "envíalo por WhatsApp".

### Capa Supabase
- **[supabase.js](supabase.js)** · wrapper `supa(path, method, body)` con headers de la anon key. Funciones para slots, bloqueos, citas, sesiones de tracking. Es el ÚNICO lugar donde construimos peticiones a `/rest/v1/`. (Excepción: `victoria.js` y `pagos.js` también hacen `fetch` directo en sus flujos críticos — históricamente, no es ideal pero está estable; consultar antes de refactorizar).

### Panel admin (PWA, privado)
- **[admin/index.html](admin/index.html)** · login + 4 pestañas: Plantilla, Bloqueos, Citas, Estadísticas.
- **[admin/admin.js](admin/admin.js)** · lógica de cada pestaña, gráficos Chart.js para Estadísticas (KPIs, embudo, doughnuts por tema/modalidad/canal), swipe horizontal entre pestañas en móvil. La contraseña vive en una constante (`PASSWORD = 'Perotti01'`) — el panel no es un secreto de seguridad real, solo una barrera para que clientes que tropiecen con la URL no entren.
- **[admin/admin.css](admin/admin.css)** · estilos del panel (paleta oscura).
- **[admin/manifest.json](admin/manifest.json)** + **[admin/sw.js](admin/sw.js)** · permiten instalar el panel como app en Android/iOS. El service worker es deliberadamente network-only — los cambios se ven al instante sin invalidar caché.

### Otros
- **[index.html](index.html)** · estructura del splash + chat + input fijo. Importa `./victoria.js?v=18` (la query `?v=` se incrementa para invalidar caché en clientes).
- **[styles.css](styles.css)** · estilos del chat público.

---

## 3. Identidad de marca a RESPETAR

Mismos colores y reglas que Paseos Seguros — la marca es una.

### Paleta (definida en [styles.css](styles.css))
- **Rojo principal**: `#E8320A` (CTA, acentos)
- **Rojo oscuro**: `#bf2608` (hover)
- **Verde oliva**: `#9cb64b` (acción positiva, "Confirmar")
- **Verde oscuro**: `#7a9438`
- **Negro de fondo**: `#0c0c0b`
- **Grises**: `#161614`, `#1e1e1b`, `#272724`, `#363632`
- **Texto**: `#f2ede6` (principal), `#a09990` (secundario), `#5a534c` (terciario)

(El panel admin tiene su propia paleta en [admin/admin.css](admin/admin.css) con un rojo ligeramente distinto `#c53030` heredado del manifest PWA — coherente, no idéntico.)

### Tipografías
- **Bebas Neue** para títulos, marca, encabezados (`var(--fb)`).
- **DM Sans** para cuerpo y UI (`var(--fn)`).

### Iconografía
- Logo: `https://i.ibb.co/FkCVpG1j/icon.png`
- Avatar de Victoria en el chat: `https://i.ibb.co/1GXMwqzQ/victoria-cuadrada.jpg`

### Slogan central
**"Tu perro merece ser feliz, hoy"** — aparece en el splash, en el cierre del chat tras pago, y es el eje de toda la comunicación.

---

## 4. Idioma

**Español, siempre.** Toda la conversación con el cliente, todas las frases del bot, todos los textos UI están en español peninsular/mallorquín. El bot está pensado para detectar abreviaturas típicas de WhatsApp en español (`tng`, `xq`, `tb`, `i` por "y", etc.) — ver `expandirAbreviaturas()` en [victoria-utils.js](victoria-utils.js).

Cuando edites strings o añadas frases nuevas, escríbelas en el mismo registro: cercano, profesional, sin tecnicismos innecesarios. La voz de Victoria es **coordinadora**, no vendedora.

---

### Reglas de lenguaje y marca (CRÍTICAS — Victoria habla con clientes reales)

1. **Nunca usar las palabras "precio", "coste", "cuánto cuesta" o "tarifa"** — siempre **"valor"** o **"inversión"**. (Excepción: textos legales/facturación pueden usar terminología estándar.)
2. **Nunca usar lenguaje infantilizado**: nada de "peludito", "peludo", "colita feliz", "amigo peludo", "bolita de pelo". Siempre **"perro"** (a veces "perrito" está bien).
3. **Preferir "clase" sobre "sesión"** cuando el tono lo permita. "Sesión" no es incorrecto — no over-corregir si ya está escrito así en frases existentes.
4. **Slogan de marca**: *"Tu perro merece ser feliz hoy"* — eje central de la comunicación.
5. **Tono del embudo**: escuchar primero, empatizar, identificar el problema después. **Nunca abrir con la oferta.** El precio se muestra solo cuando el cliente ya ha visto el mensaje principal y ha pulsado "Ver precios" o ha preguntado explícitamente.

### Protocolos de negocio

- **Tarifa primera clase: 90€ presencial / 75€ online.** Pack de 4 clases: 300€ presencial / 240€ online (ahorro 60€).
- **Seña de reserva: 45€** (50% de la primera clase presencial), por **Bizum o transferencia**, con **captura/justificante**. El resto se paga en mano el día de la clase.
- **Dos números, dos roles distintos** — esto es crítico para el flujo de VictorIA:
  - **`622 922 173` — línea PÚBLICA del negocio.** Es la línea de captación y soporte general. **VictorIA la usa en TODO mensaje conversacional**, pre-pago y post-pago: derivaciones, fallbacks (`_fallbackHumano`), errores técnicos, y también en la confirmación final tras el pago ([victoria.js](victoria.js):1103). Es el único número que sale por boca de VictorIA en mensajes de chat.
  - **`653 591 301` — línea PRIVADA de Carlos (personal del adiestrador).** **VictorIA SOLO la expone en un único contexto: el widget de pago**, para que el cliente haga el Bizum del depósito de 45€ ([pagos.js](pagos.js):49). NUNCA aparece en mensajes conversacionales. Carlos también usa este número para conversar manualmente con clientes activos tras recibir la notificación ntfy de cita confirmada — pero ese **traspaso de canal lo ejecuta él desde su móvil**, no VictorIA. El bot no participa en ese paso.
  - **Reglas de uso (no negociables):**
    - **VictorIA solo expone el `653 591 301` dentro del widget de pago.** En cualquier otro contexto (mensajes, fallbacks, derivaciones, confirmación post-pago) usa el `622 922 173`.
    - **El cambio de canal post-pago es manual.** Cuando llega la notificación ntfy a Carlos, él decide cuándo y cómo escribir al cliente desde su `653 591 301`. Esto es deliberado: VictorIA cierra la cita y el ser humano toma el relevo.
- IBAN para transferencias: `ES27 0182 5319 7002 0055 6013` · Titular: Carlos Antonio Acevedo · confirmado en [pagos.js](pagos.js):63.
- **Cancelaciones**: sin problema con 48h de antelación.
- **Protocolos que VictorIA maneja** (todos en [victoria-phrases.js](victoria-phrases.js) y diccionarios en [victoria-dictionaries.js](victoria-dictionaries.js)):
  - Educación básica · 4 clases
  - Educación de cachorros · 4 clases
  - Reactividad · 4-12 clases (hasta 14 en casos graves)
  - Miedos / fobias · 8-12 clases (hasta 14)
  - Gestión de ansiedad (separación o generalizada) · 8-12 clases (hasta 14)
  - Posesión de recursos · 4-8 clases
- **Modalidad online**: solo válida para básica, cachorros, miedos y ansiedad. Reactividad, posesión y miedos severos requieren presencial. Ver `esCompatibleOnline()` en [victoria-zones.js](victoria-zones.js).
- **Cobertura presencial**: triángulo Palma–Inca–Llucmajor–Calvià + barrios. Fuera de esa zona → online (si el cuadro lo permite) o derivar.
- **Excepción Son Gotleu**: política interna — no se ofrece desplazamiento presencial allí ahora mismo. Si el cuadro es compatible online, se ofrece online; si no, se deriva.

### Reglas de derivación

- **Etólogo**: SOLO si el cliente lo pide directamente. Frase: *"Tomás Camps es el más conocido en la isla"*. **Nunca recomendar de oficio, nunca endorsar.**
- **Mordida grave + perro >10kg o PPP** → derivación obligatoria al etólogo veterinario antes de aceptar cualquier trabajo de adiestramiento. Lógica en `decidirRespuesta()` filtro 1 ([victoria-matching.js](victoria-matching.js)).
- **Desescalada tras derivación**: si el cliente matiza ("en realidad no muerde, solo gruñe"), se permite recalcular el cuadro con el contexto corregido. La gente exagera al describir al principio. Lógica en `_esDesescaladaTrasDerivacion()` ([victoria.js](victoria.js)).
- **VictorIA NUNCA expone el número personal de Carlos (`653 591 301`) en mensajes conversacionales** — solo aparece dentro del widget de pago para que el cliente haga el Bizum. En derivaciones, fallbacks y confirmación post-pago se usa siempre la línea pública del negocio (`622 922 173`). El traspaso al canal personal de Carlos lo gestiona él manualmente tras recibir la notificación ntfy.
- **Fallback cuando se atasca**: pedir el WhatsApp del cliente para *"nosotros le contactamos"*, nunca al revés. Ver botón "Dejar mi WhatsApp para que me contacten" en [victoria.js](victoria.js).
- **VictorIA siempre se refiere a "el adiestrador", nunca a "Carlos"** en la conversación con el cliente. (Carlos solo aparece en la firma del mensaje listo-para-enviar que se manda a la notificación interna y en el splash de bienvenida.)

### Servicios laterales (consultas que no son adiestramiento)

VictorIA tiene respuestas hardcoded en `FRASES_LATERALES` ([victoria-phrases.js](victoria-phrases.js)) para:
- **Paseos grupales** → derivar a Instagram (`@perrosdelaisla`)
- **Adopciones** → no es nuestro servicio, derivar amablemente
- **Guardería** → no recomendamos una concreta, "elige tú con calma"
- **Peluquería** → recomendamos **Dogma** en Palma
- **Veterinaria** → recomendamos **Veterinaria Sa Palla** (Plaça del Pes de Sa Palla 5, Palma)

---

## 5. Cómo trabajar en este proyecto

### Reglas técnicas

- **Consultar antes de cambios importantes**: refactors, ediciones que tocan varios archivos, eliminación de funcionalidad. Charly revisa antes de confirmar.
- **Mantener el estilo de código existente**. NO introducir TypeScript, NO introducir frameworks (React, Vue, etc.), NO introducir bundlers (Vite, webpack). El proyecto es vanilla ES6 modules y se sirve tal cual desde GitHub Pages.
- **Versionado de caché**: cuando edites HTML/CSS/JS que cargan los clientes, gestionar versiones para evitar caché viejo. El patrón actual es `import { start } from './victoria.js?v=18';` en [index.html](index.html) — incrementar el `?v=` cuando haya cambios sustanciales que el cliente deba refrescar inmediatamente. El service worker del admin es network-only por diseño y no necesita esto.
- **Imports relativos** con `./...js` (módulos ES6 nativos en navegador — la extensión `.js` es obligatoria).
- **No añadir dependencias** sin pedirlo. Si algo se puede hacer con la plataforma web (fetch, Canvas API, IntersectionObserver…), se hace así.
- **Comentarios**: el código actual tiene comentarios extensos en cabeceras de fichero y secciones — respetar ese estilo cuando edites archivos existentes. En código nuevo, solo comentar el "por qué" cuando no sea obvio.

### Reglas de Supabase (CRÍTICAS)

- **Antes de cualquier `DELETE` o `UPDATE/PATCH` en Supabase**: hacer `SELECT` primero con el mismo filtro, mostrarme los datos afectados, y esperar mi OK. **Nunca confiar en UUIDs copiados sin verificar.**
- La anon key vive en claro en [victoria.js](victoria.js):49, [pagos.js](pagos.js):16 y [supabase.js](supabase.js):7. Es la clave pública de Supabase — cualquier seguridad real debe venir de RLS en la base de datos, no de ocultar la key.
- Cuando añadas una tabla o columna nueva, asegúrate de que las políticas RLS la dejan accesible (o no) desde la anon key, según el caso.

### Despliegue

- Push a `main` → GitHub Pages publica automáticamente. No hay CI, no hay pasos de build. Lo que está en el repo es lo que se sirve.
- El panel admin se sirve bajo `perrosdelaisla.github.io/hola/admin/`.

### Testing

- No hay test suite. El bot se prueba "en caliente" — con `?prueba=1` en la URL para que la sesión NO cuente en estadísticas (`state.prueba` se mira en [victoria.js](victoria.js):149).
- Para probar UI: abrir [index.html](index.html) en el navegador (mejor con un servidor local que con `file://` para que los módulos ES6 carguen).

---

## 6. Datos de contacto del negocio

- **Negocio**: Perros de la Isla — Adiestramiento canino · Mallorca
- **Adiestrador / Propietario**: Carlos Acevedo (a.k.a. Charly), Instructor canino profesional
- **Web**: [perrosdelaisla.com](https://www.perrosdelaisla.com/)
- **Hola (este chatbot)**: [perrosdelaisla.github.io/hola](https://perrosdelaisla.github.io/hola/)
- **Instagram**: [@perrosdelaisla](https://www.instagram.com/perrosdelaisla/)
- **Línea PÚBLICA del negocio**: **`622 922 173`** — el número que VictorIA usa en TODO mensaje conversacional, pre y post-pago. Captación, fallbacks, derivaciones, errores técnicos, confirmación final tras el pago ([victoria.js](victoria.js):1103). Es el único número que sale por boca del bot.
- **Línea PRIVADA de Carlos**: **`653 591 301`** — el número personal del adiestrador. VictorIA SOLO lo expone dentro del widget de pago ([pagos.js](pagos.js):49) para recibir el Bizum del depósito de 45€. NUNCA en mensajes conversacionales. Carlos también lo usa para conversar manualmente con clientes activos tras la notificación ntfy de cita confirmada, pero ese traspaso lo ejecuta él desde su móvil — no es función del bot.
- **Resumen del flujo**: VictorIA habla → siempre `622`. Bizum → único contexto donde aparece `653`. Carlos toma el relevo manualmente post-pago desde su `653`.
- **IBAN**: `ES27 0182 5319 7002 0055 6013` · Titular: Carlos Antonio Acevedo · confirmado por Charly y verificado en [pagos.js](pagos.js):63.
- **Notificaciones internas**: ntfy.sh topic `perrosdelaisla-citas-2026` ([victoria.js](victoria.js):50) — confirmado por Charly en su móvil.

### Recomendaciones que VictorIA da cuando el cliente pregunta por servicios laterales

- **Etólogo** (solo si el cliente lo pide explícitamente): Tomás Camps.
- **Peluquería en Palma**: Dogma.
- **Veterinaria en Palma**: Veterinaria Sa Palla (Plaça del Pes de Sa Palla 5, casco antiguo).

---

> **Recordatorio para sesiones futuras de Claude**: este es el archivo de referencia. Si algo de aquí entra en conflicto con lo que ves en el código, **el código manda** — y avísale a Charly para actualizar este CLAUDE.md.
