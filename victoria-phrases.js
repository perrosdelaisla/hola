/**
 * victoria-phrases.js
 * Perros de la Isla — Embudo Victoria
 * Versión 2.1 · Mayo 2026
 *
 * Frases hardcoded en español que renderiza Victoria al cliente. Cada frase
 * se obtiene mediante obtenerFrase({tipo, vars}), que resuelve plantillas
 * con sustitución de {perro} según el contexto.
 *
 * Limpieza post-v2.0 (mayo 2026):
 * - Eliminadas constantes legacy del v1.0 que ya no invocaba el flujo:
 *   FRASES_PRESENCIAL, FRASES_ONLINE, FRASE_DERIVACION_ZONA,
 *   ETIQUETAS_CUADRO_ZONA, FRASES_DIAGNOSTICO_SIN_MODALIDAD,
 *   FRASES_MIXTO, ETIQUETAS_MIXTO.
 * - Eliminados los cases muertos del switch obtenerFrase: "cuadro",
 *   "zona", "mixto", y la rama "compatible_online" del case "son_gotleu".
 */


// ─────────────────────────────────────────────────────────────────────────────
// 1. DERIVACIÓN AL ETÓLOGO
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_ETOLOGO = {

  principal: `Gracias por escribirme con tanto detalle. Por lo que describes, lo que tu perro necesita en este momento va más allá de un protocolo de adiestramiento — sería importante empezar por una valoración con un etólogo veterinario. Los etólogos tienen formación clínica en comportamiento canino y pueden valorar si hay algún componente médico o neurológico detrás del cuadro, además de definir un plan individualizado. No es un "no" a trabajar con vosotros — es que el orden importa, y empezar por ahí es lo que mejor le va a ir a tu perro. Si en un futuro, una vez hecha esa evaluación, quieres plantearte un acompañamiento desde el adiestramiento, podéis escribirnos y lo valoramos. Gracias de nuevo por la confianza.`,

  complementaria: `En Mallorca hay varios profesionales. El más conocido es Tomás Camps, aunque te recomendaría mirar también qué perfil te queda más cerca de zona y con quién te sientes cómodo — es una decisión personal y es importante que el encaje sea bueno.`,

  mordida_personas: `Gracias por contármelo con tanta claridad. Por lo que describes, este caso necesita la valoración previa de un etólogo veterinario antes de empezar cualquier trabajo de adiestramiento — cuando hay mordida a personas, es imprescindible una evaluación clínica para garantizar la seguridad de todos, incluido tu perro. En Perros de la Isla no aceptamos casos así sin esa valoración previa, es un criterio firme que mantenemos por responsabilidad profesional. Te recomiendo buscar un etólogo veterinario colegiado en tu zona. Si en un futuro, una vez hecha esa evaluación, queréis plantear un acompañamiento desde el adiestramiento, podéis escribirnos y lo valoramos. Mucho ánimo con el proceso.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 2. SON GOTLEU
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_SON_GOTLEU = {

  compatible_online: `Por temas de agenda y organización, en esa zona no estamos ofreciendo desplazamiento presencial ahora mismo. Lo que sí podemos hacer es trabajarlo en modalidad online por Google Meet, junto a los tutores, con pautas concretas entre semana — funciona muy bien para este tipo de casos.`,

  no_compatible_online: `Por temas de agenda y organización, en esa zona no estamos ofreciendo desplazamiento presencial ahora mismo, y este tipo de caso solo lo trabajamos presencialmente porque necesita observación directa del perro en su contexto. Te recomendaría buscar un profesional cerca de tu zona con enfoque cognitivo-emocional y sin métodos aversivos — es el perfil que mejor resultado da en estos cuadros.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. SERVICIOS LATERALES
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_LATERALES = {

  paseos_grupales: `Gracias por el interés. Los paseos grupales no son un servicio fijo en agenda — los organizamos de forma puntual según época del año, disponibilidad y tiempo. Te recomendaría seguirnos en Instagram (@perrosdelaisla), que es donde avisamos cuándo abrimos fechas, condiciones y cómo apuntarse. Si mientras tanto hay algo concreto del día a día con tu perro que te gustaría trabajar (paseo, convivencia, socialización, alguna conducta que quieras mejorar), cuéntame y lo vemos.`,

  adopciones: `Gracias por escribir. No nos dedicamos a adopciones — somos una empresa de adiestramiento canino especializada en perros de familia. Si en algún momento adoptas y necesitas apoyo para educarlo o integrarlo bien en casa, aquí estamos.`,

  guarderia: `Para guardería canina, lo mejor es que mires opciones en tu zona y visites las instalaciones antes de decidir — es importante que veas cómo manejan a los perros, qué espacio tienen, cómo es el personal. No tenemos una recomendación concreta que darte con la que nos sintamos cómodos al cien por cien, así que preferimos que elijas tú con calma después de verlo en persona.`,

  peluqueria: `Para peluquería canina en Palma, la más conocida y con la que hemos tenido buena experiencia es Dogma. Te recomendaría buscarlos y ver disponibilidad. Si estás fuera de Palma, lo mejor es preguntar en tu veterinario de referencia qué peluquería recomienda en tu zona — ellos suelen saber quiénes trabajan con trato cuidadoso.`,

  veterinaria: `Para veterinaria, si estás en Palma te recomendaría Veterinaria Sa Palla, en Plaça del Pes de Sa Palla 5 (casco antiguo). Es la que usamos nosotros, muy cuidadosa con el trato y con buena atención. Si estás fuera de Palma, lo mejor es buscar un veterinario de zona con buenas referencias y consulta sin prisas.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 4. FRASES DE APOYO — flujo conversacional
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_APOYO = {

  pedir_especificacion: `Cuéntame algo más del día a día con tu perro — qué situaciones te gustaría mejorar, qué has notado que te preocupa, cómo es la convivencia. Con eso puedo orientarte mejor.`,

  filtro_mordida: `Para orientarte bien, ¿con quién o con qué pasa? ¿Con personas, con otros perros, o con cosas (muebles, ropa, juguetes)? Cuéntame cómo es el último episodio que recuerdes.`,

  filtro_mordida_repregunta: `Para poder orientarte bien, cuéntame con un poco más de detalle: ¿hubo contacto real de los dientes, y de haberlo, quedó alguna marca (enrojecimiento, hematoma, sangre)?`,

  pedir_zona: `¿En qué zona de Mallorca estás? Con el municipio o barrio me vale para ver qué podemos ofrecerte.`,

  pedir_edad: `¿Qué edad tiene tu perro? Con meses si aún es cachorro, o años si ya es adulto.`,

  pedir_peso: `¿Qué peso aproximado tiene? No hace falta que sea exacto, un número aproximado me vale.`,

  pedir_raza: `¿Qué raza es? Si es mestizo o no estás seguro, descríbeme cómo es de tamaño y complexión.`,

  pedir_conducta: `Cuando pasa eso, ¿cómo reacciona exactamente tu perro? ¿Se esconde, se queda paralizado, intenta salir corriendo? ¿O más bien ladra, se lanza, tira de la correa? La respuesta del perro es lo que me ayuda a orientarte bien.`,

  fallback_whatsapp: `Para poder orientarte bien, te paso directamente con el equipo de Perros de la Isla — pueden atenderte con más detalle. Puedes escribirnos por WhatsApp al 622 922 173.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 5. FLUJO PRINCIPAL — mensaje principal y metodología
// ─────────────────────────────────────────────────────────────────────────────

export const FRASE_MENSAJE_PRINCIPAL = [
  `Entiendo. Lo que cuentas es de lo que trabajamos a diario, así que podemos ayudarte. Contamos con protocolos específicos para abordar ese tipo de problema, y la primera clase es justo para esto: el adiestrador conoce a {perro} en su entorno y elige y aplica el protocolo más adecuado según lo que de verdad necesite.`,

  `Te escucho. Lo que describes lo trabajamos habitualmente, no te preocupes. Cada perro es un mundo, por eso aplicamos un proceso de aprendizaje estructurado y la primera clase es la base de todo: el adiestrador conoce a {perro} en su contexto y a partir de ahí se arma el plan contigo.`,

  `Vale. Lo que cuentas entra dentro de nuestro trabajo, así que tranquilo. Tenemos protocolos específicos para casos como el de {perro}, y la primera clase es donde el adiestrador le conoce de verdad y elige y aplica el protocolo más adecuado. Es lo que nos diferencia.`,
];

export const FRASE_MENSAJE_PRINCIPAL_ONLINE = [
  `Entiendo. Lo que cuentas es de lo que trabajamos a diario, así que podemos ayudarte. Contamos con protocolos específicos para abordar ese tipo de problema, y para tu zona lo hacemos online: la primera clase es justo para esto, el adiestrador conoce a {perro} y elige y aplica el protocolo más adecuado según lo que de verdad necesite.`,

  `Te escucho. Lo que describes lo trabajamos habitualmente, no te preocupes. Trabajamos contigo online y, aunque sea por videollamada, aplicamos un proceso de aprendizaje estructurado: la primera clase es la base de todo, el adiestrador conoce a {perro} en su contexto y a partir de ahí se arma el plan contigo.`,

  `Vale. Lo que cuentas entra dentro de nuestro trabajo, así que tranquilo. Tenemos protocolos específicos para casos como el de {perro}, y trabajamos contigo online. La primera clase es donde el adiestrador le conoce y elige y aplica el protocolo más adecuado. Es lo que nos diferencia.`,
];

export const FRASE_RAMIFICACION = `¿Quieres que te cuente un poco cómo son nuestras clases, o prefieres que te pase la información de precios directamente?`;

export const FRASE_COMO_TRABAJAMOS_PRESENCIAL = `El adiestrador se desplaza a tu domicilio — donde {perro} vive su día a día, que es donde mejor se observa su comportamiento real. Cada clase dura una hora, aunque puede extenderse un poco si hace falta — priorizamos que entiendas todo lo que vemos y puedas resolver todas tus dudas, no cerrar a toque de reloj.

Entre clases tienes consulta por WhatsApp con el adiestrador. Te enviamos videos de apoyo para que practiques los ejercicios correctamente, y puedes mandarnos videos tuyos entrenando para que te vayamos corrigiendo. Así cada clase avanza sobre la anterior y aprovechamos al máximo el trabajo.`;

export const FRASE_COMO_TRABAJAMOS_ONLINE = `Las clases son por Google Meet — solo necesitas un móvil o un ordenador con cámara, y que {perro} esté contigo en casa para que el adiestrador pueda verlo durante la clase. Cada clase dura una hora, aunque puede extenderse un poco si hace falta — priorizamos que entiendas todo lo que vemos y puedas resolver todas tus dudas, no cerrar a toque de reloj.

Entre clases tienes consulta por WhatsApp con el adiestrador. Te enviamos videos de apoyo para que practiques los ejercicios correctamente, y puedes mandarnos videos tuyos entrenando para que te vayamos corrigiendo. Así cada clase avanza sobre la anterior y aprovechamos al máximo el trabajo.`;

export const FRASE_CIERRE_METODOLOGIA = `¿Quieres que te pase la información de precios y los horarios disponibles?`;

export const FRASE_DURACION_UNIFICADA = `La duración depende del protocolo:

• Educación básica: 4 clases (ampliables si quieres seguir avanzando tras terminar).
• Cachorros: 4 clases (ampliables si más adelante quieres trabajar alguna cosa más o necesitas apoyo en algún área puntual).
• Posesión de recursos: 4-8 clases.
• Reactividad: 4-12 clases según severidad (ampliables hasta 14 en casos muy graves).
• Miedos y fobias: 8-12 clases (ampliables hasta 14 en casos muy graves).
• Gestión de ansiedad (separación o generalizada): 8-12 clases (ampliables hasta 14 en casos muy graves).

En la primera clase el adiestrador te dice el rango concreto para {perro} tras evaluarlo.`;


// ─────────────────────────────────────────────────────────────────────────────
// 6. FRASES DE PRECIO / VALOR
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_PRECIO = {
  presencial:
    "El valor de la clase presencial es de 90€. También tenemos un pack de 4 clases por 300€ (ahorras 60€). " +
    "La seña para reservar es de 45€ y se descuenta del total.",
  online:
    "El valor de la clase online es de 75€. También tenemos un pack de 4 clases por 240€ (ahorras 60€). " +
    "La seña para reservar es de 45€ y se descuenta del total.",
  sin_modalidad:
    "Las clases presenciales son a 90€ y las online a 75€. Tenemos pack de 4 clases con 60€ de ahorro " +
    "(300€ presencial, 240€ online). La seña para reservar es de 45€ y se descuenta del total. " +
    "Si seguimos, ahora mismo miramos cuál de las dos modalidades encaja mejor con el caso de tu perro.",
};

export const FRASES_PACK = {
  presencial:
    "El pack son 4 clases por 300€ en vez de 360€ (90€ × 4). Te ahorras 60€ y además aseguras la continuidad " +
    "del trabajo, que es lo que marca la diferencia en los resultados. La decisión la tomas en la primera clase " +
    "sin compromiso — si después de conocer al adiestrador prefieres ir clase a clase, perfecto también.",
  online:
    "El pack online son 4 clases por 240€ en vez de 300€ (75€ × 4). Te ahorras 60€ y aseguras la continuidad. " +
    "Decides pack o clase suelta cuando conozcas al adiestrador, sin compromiso.",
};

export const FRASE_PRECIO_POR_PERRO =
  "El valor es por clase, no por perro. Si tienes más de un perro trabajamos con ellos en la misma clase — " +
  "muchas veces los casos van ligados entre sí y da mejores resultados abordarlos juntos.";


// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD — obtenerFrase()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve la frase correcta según tipo y parámetros.
 * Sustituye variables ({perro}, {cuadro_1}, etc.) si se pasan en vars.
 */
export function obtenerFrase({ tipo, cuadro, modalidad, subtipo, vars = {} }) {
  let frase = null;

  switch (tipo) {

    // ── Nuevos tipos v2.0 ──────────────────────────────────────────────────

    case "mensaje_principal": {
      // Selección por modalidad + rotación aleatoria entre las 3 variantes.
      // Las constantes son arrays de strings; Math.random elige una en cada
      // turno para que la apertura no suene rutinaria.
      const variantes = vars.modalidad === "online"
        ? FRASE_MENSAJE_PRINCIPAL_ONLINE
        : FRASE_MENSAJE_PRINCIPAL;
      frase = variantes[Math.floor(Math.random() * variantes.length)];
      frase = frase.replace(/\{perro\}/g, vars.perro || "tu perro");
      break;
    }

    case "ramificacion":
      frase = FRASE_RAMIFICACION;
      break;

    case "como_trabajamos":
      if (vars.modalidad === "online") {
        frase = FRASE_COMO_TRABAJAMOS_ONLINE;
      } else {
        frase = FRASE_COMO_TRABAJAMOS_PRESENCIAL;
      }
      if (vars.perro) {
        frase = frase.replace(/\{perro\}/g, vars.perro);
      } else {
        frase = frase.replace(/\{perro\}/g, "tu perro");
      }
      break;

    case "cierre_metodologia":
      frase = FRASE_CIERRE_METODOLOGIA;
      break;

    case "duracion":
      frase = FRASE_DURACION_UNIFICADA;
      if (vars.perro) {
        frase = frase.replace(/\{perro\}/g, vars.perro);
      } else {
        frase = frase.replace(/\{perro\}/g, "tu perro");
      }
      break;

    // ── Tipos existentes ───────────────────────────────────────────────────

    case "lateral":
      frase = FRASES_LATERALES[subtipo] ?? null;
      break;

    case "etologo":
      frase = FRASES_ETOLOGO[subtipo ?? "principal"] ?? null;
      break;

    case "son_gotleu":
      frase = FRASES_SON_GOTLEU[subtipo ?? "no_compatible_online"] ?? null;
      break;

    case "apoyo":
      if (subtipo === "pedir_especificacion") {
        switch (vars?.subtipo_afinado) {
          case "contexto_temporal":
            frase = "¿Y en qué momentos pasa eso? ¿en casa, en el paseo, cuando estás tú, o cuando te vas?";
            break;
          case "respuesta_detonante":
            frase = "¿Y qué hace cuando pasa eso? ¿se esconde, ladra, se lanza, se queda paralizado?";
            break;
          case "detonante_ladridos":
            frase = "¿Y a qué le ladra más? ¿a gente en la calle, a otros perros, al timbre, a ruidos en casa?";
            break;
          case "contexto_mordida":
            frase = "¿Cuándo muerde exactamente? ¿mientras juega, si le tocas la comida, al acercarte a su sitio?";
            break;
          default:
            frase = FRASES_APOYO[subtipo] ?? null;
        }
      } else {
        frase = FRASES_APOYO[subtipo] ?? null;
      }
      break;

    default:
      frase = null;
  }

  return frase;
}
