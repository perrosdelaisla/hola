/**
 * victoria-phrases.js
 * Perros de la Isla — Embudo Victoria
 * Versión 2.0 · Abril 2026
 *
 * CAMBIOS v2.0:
 * - Añadidas constantes de mensaje unificado (FRASE_MENSAJE_PRINCIPAL,
 *   FRASE_RAMIFICACION, FRASE_COMO_TRABAJAMOS_*, FRASE_CIERRE_METODOLOGIA,
 *   FRASE_DURACION_UNIFICADA).
 * - Eliminado FRASES_DURACION (mapa por cuadro) → sustituido por FRASE_DURACION_UNIFICADA.
 * - obtenerFrase reconoce los nuevos tipos.
 */


// ─────────────────────────────────────────────────────────────────────────────
// 1. FRASES DE CUADROS — PRESENCIAL
// (Conservadas para compatibilidad — ya no las usa el matching principal)
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_PRESENCIAL = {

  separacion: `Lo que me cuentas encaja con ansiedad por separación, y sé lo que supone en el día a día: no poder salir tranquilo, la tensión al volver a casa, a veces incluso quejas de los vecinos. Es de los casos que más trabajamos. Contamos con un protocolo específico, con sesiones en el domicilio y pautas concretas que se trabajan entre semana — con constancia se ven cambios rápido. No es magia, pero sí es un proceso estructurado que funciona.`,

  generalizada: `Lo que describes encaja con ansiedad generalizada — no es que reaccione a algo puntual, es que no consigue estar tranquilo. Y un perro que no descansa bien emocionalmente acaba afectando también al ambiente de casa. Es un cuadro que trabajamos con un protocolo específico: sesiones en el domicilio, junto a los tutores, trabajando tanto la rutina del perro como el vínculo y las pautas de convivencia. Con constancia se ven cambios — no es magia, pero tampoco es un proceso eterno.`,

  miedos: `Lo que me cuentas encaja con un cuadro de miedos. Cuando un perro vive con miedo a algo concreto, lo que más le ayuda no es confrontarlo, sino reconstruir la sensación de seguridad — y para eso el vínculo con los tutores es clave. Trabajamos con un protocolo específico, en el domicilio y junto a vosotros, con pautas para ir exponiéndolo al estímulo de forma controlada y acompañada. Con constancia se ven cambios, aunque en miedos es especialmente importante respetar los tiempos del perro.`,

  reactividad: `Eso que describes encaja con un cuadro de reactividad — el perro entra en activación alta ante ciertos estímulos (otros perros, bicicletas, personas) y descarga con ladridos, tirones o lanzándose. Y sé lo que supone en el día a día: dejar de disfrutar los paseos, cruzar de acera, volver tenso a casa. Pero más allá del desgaste, un perro reactivo también lo pasa mal — vive el paseo en tensión constante. Es uno de los motivos más frecuentes por los que nos escriben. Trabajamos con un protocolo específico, en el domicilio y en paseo, junto a los tutores, con pautas para ir regulando la respuesta emocional y reconstruir un paseo donde ambos puedan estar tranquilos. Con constancia se ven cambios, aunque en reactividad es especialmente importante trabajar de forma gradual.`,

  posesion: `Eso que describes encaja con un cuadro de posesión de recursos — el perro protege comida, espacio u objetos con señales de tensión (gruñido, mostrar dientes, cuerpo rígido). Lo que hay debajo no es "mal carácter" ni rebeldía, sino inseguridad: el perro teme perder algo que valora y defiende desde el miedo, no desde la agresividad gratuita. Para orientarte bien necesito saber una cosa: ¿ha llegado a morder a alguien, o el comportamiento se queda en el aviso? En función de eso valoramos el abordaje. Si el caso entra dentro de lo que trabajamos, es con sesiones en el domicilio, junto a los tutores, con pautas concretas para reconstruir la seguridad emocional del perro alrededor de los recursos.`,

  basica: `Lo que me cuentas entra dentro de lo que trabajamos como educación básica — más que "obediencia" al uso, es construir una buena comunicación y convivencia entre el perro y la familia: paseos tranquilos, respuesta a la llamada, manejo de las situaciones del día a día. Contamos con un protocolo específico, con sesiones en el domicilio, junto a los tutores, y pautas concretas entre semana. Con constancia se ven cambios rápido. Si en la primera sesión el adiestrador detecta algo más específico (reactividad, miedos, ansiedad), lo comentaría y se adaptaría el protocolo.`,

  cachorros: `Lo que me cuentas entra dentro de nuestro protocolo de educación de cachorros — una etapa que cubre bastante terreno: socialización, manejo de la mordida, elección del lugar adecuado para sus necesidades, pautas de descanso, gestión de la soledad, construcción de las primeras rutinas y del vínculo con vosotros. Son sesiones en el domicilio, junto a los tutores, con pautas concretas entre semana. Con constancia se ven cambios rápido, porque el cachorro aprende muy rápido cuando las pautas son claras. En la primera sesión el adiestrador hace una valoración general y define el plan según lo que vea.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 2. FRASES DE CUADROS — ONLINE
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_ONLINE = {

  separacion: `Lo que me cuentas encaja con ansiedad por separación, y sé lo que supone en el día a día: no poder salir tranquilo, la tensión al volver a casa, a veces incluso quejas de los vecinos. Es de los casos que más trabajamos. Como estás fuera de nuestra zona de cobertura presencial, te propongo trabajarlo en modalidad online: sesiones por Google Meet, junto a los tutores, con pautas concretas que se trabajan entre semana. Con constancia se ven cambios rápido. No es magia, pero sí es un proceso estructurado que funciona.`,

  generalizada: `Lo que describes encaja con ansiedad generalizada — no es que reaccione a algo puntual, es que no consigue estar tranquilo. Y un perro que no descansa bien emocionalmente acaba afectando también al ambiente de casa. Es un cuadro que trabajamos con un protocolo específico. Como estás fuera de nuestra zona de cobertura presencial, te propongo hacerlo en modalidad online: sesiones por Google Meet, junto a los tutores, trabajando tanto la rutina del perro como el vínculo y las pautas de convivencia. Con constancia se ven cambios — no es magia, pero tampoco es un proceso eterno.`,

  basica: `Lo que me cuentas entra dentro de lo que trabajamos como educación básica — más que "obediencia" al uso, es construir una buena comunicación y convivencia entre el perro y la familia: paseos tranquilos, respuesta a la llamada, manejo de las situaciones del día a día. Como estás fuera de nuestra zona de cobertura presencial, te propongo trabajarlo en modalidad online: sesiones por Google Meet, junto a los tutores, con pautas concretas entre semana. Con constancia se ven cambios rápido. Si en la primera sesión el adiestrador detecta algo más específico (reactividad, miedos, ansiedad), lo comentaría y valoraríais juntos cómo continuar.`,

  cachorros: `Lo que me cuentas entra dentro de nuestro protocolo de educación de cachorros — una etapa que cubre bastante terreno: socialización, manejo de la mordida, elección del lugar adecuado para sus necesidades, pautas de descanso, gestión de la soledad, construcción de las primeras rutinas y del vínculo con vosotros. Como estás fuera de nuestra zona de cobertura presencial, te propongo trabajarlo en modalidad online: sesiones por Google Meet, junto a los tutores, con pautas concretas entre semana. Con constancia se ven cambios rápido, porque el cachorro aprende muy rápido cuando las pautas son claras. En la primera sesión el adiestrador hace una valoración general y define el plan según lo que vea.`,

  miedos: `Lo que me cuentas encaja con un cuadro de miedos. Cuando un perro vive con miedo a algo concreto, lo que más le ayuda no es confrontarlo, sino reconstruir la sensación de seguridad — y para eso el vínculo con los tutores es clave. Como estás fuera de nuestra zona de cobertura presencial, te propongo trabajarlo en modalidad online: sesiones por Google Meet, junto a vosotros, con pautas para ir exponiéndolo al estímulo de forma controlada y acompañada. Con constancia se ven cambios, aunque en miedos es especialmente importante respetar los tiempos del perro.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 3. DERIVACIÓN AL ETÓLOGO
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_ETOLOGO = {

  principal: `Gracias por escribirme con tanto detalle. Por lo que describes, lo que tu perro necesita en este momento va más allá de un protocolo de adiestramiento — sería importante empezar por una valoración con un etólogo veterinario. Los etólogos tienen formación clínica en comportamiento canino y pueden valorar si hay algún componente médico o neurológico detrás del cuadro, además de definir un plan individualizado. No es un "no" a trabajar con vosotros — es que el orden importa, y empezar por ahí es lo que mejor le va a ir a tu perro. Si en un futuro, una vez hecha esa evaluación, quieres plantearte un acompañamiento desde el adiestramiento, podéis escribirnos y lo valoramos. Gracias de nuevo por la confianza.`,

  complementaria: `En Mallorca hay varios profesionales. El más conocido es Tomás Camps, aunque te recomendaría mirar también qué perfil te queda más cerca de zona y con quién te sientes cómodo — es una decisión personal y es importante que el encaje sea bueno.`,

  mordida_personas: `Gracias por contármelo con tanta claridad. Por lo que describes, este caso necesita la valoración previa de un etólogo veterinario antes de empezar cualquier trabajo de adiestramiento — cuando hay mordida a personas, es imprescindible una evaluación clínica para garantizar la seguridad de todos, incluido tu perro. En Perros de la Isla no aceptamos casos así sin esa valoración previa, es un criterio firme que mantenemos por responsabilidad profesional. Te recomiendo buscar un etólogo veterinario colegiado en tu zona. Si en un futuro, una vez hecha esa evaluación, queréis plantear un acompañamiento desde el adiestramiento, podéis escribirnos y lo valoramos. Mucho ánimo con el proceso.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 4. DERIVACIÓN POR ZONA
// ─────────────────────────────────────────────────────────────────────────────

export const FRASE_DERIVACION_ZONA = `Gracias por escribirme. Por lo que me cuentas, el cuadro de tu perro es de los que trabajamos únicamente en modalidad presencial — {cuadro} necesita observación directa del perro en su contexto real para evaluar bien el caso y aplicar el protocolo con criterio. Por videollamada no daríamos el nivel de trabajo que el caso merece. Como estás fuera de nuestra zona de cobertura, te recomendaría buscar un profesional cerca de ti con enfoque cognitivo-emocional y sin métodos aversivos — es el perfil que mejor resultado da en estos cuadros. Si en algún momento te planteas desplazarte a Mallorca o cambias de zona, aquí seguimos.`;

export const ETIQUETAS_CUADRO_ZONA = {
  reactividad: "la reactividad",
  posesion: "la posesión de recursos",
  miedos: "el cuadro de miedos",
};


// ─────────────────────────────────────────────────────────────────────────────
// 5. SON GOTLEU
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_SON_GOTLEU = {

  compatible_online: `Por temas de agenda y organización, en esa zona no estamos ofreciendo desplazamiento presencial ahora mismo. Lo que sí podemos hacer es trabajarlo en modalidad online por Google Meet, junto a los tutores, con pautas concretas entre semana — funciona muy bien para este tipo de casos.`,

  no_compatible_online: `Por temas de agenda y organización, en esa zona no estamos ofreciendo desplazamiento presencial ahora mismo, y este tipo de caso solo lo trabajamos presencialmente porque necesita observación directa del perro en su contexto. Te recomendaría buscar un profesional cerca de tu zona con enfoque cognitivo-emocional y sin métodos aversivos — es el perfil que mejor resultado da en estos cuadros.`,
};

export const FRASES_DIAGNOSTICO_SIN_MODALIDAD = {

  separacion: `Lo que me cuentas encaja con ansiedad por separación, y sé lo que supone en el día a día: no poder salir tranquilo, la tensión al volver a casa, a veces incluso quejas de los vecinos. Es de los casos que más trabajamos. Con constancia se ven cambios rápido. No es magia, pero sí es un proceso estructurado que funciona.`,

  generalizada: `Lo que describes encaja con ansiedad generalizada — no es que reaccione a algo puntual, es que no consigue estar tranquilo. Y un perro que no descansa bien emocionalmente acaba afectando también al ambiente de casa. Con constancia se ven cambios — no es magia, pero tampoco es un proceso eterno.`,

  basica: `Lo que me cuentas entra dentro de lo que trabajamos como educación básica — más que "obediencia" al uso, es construir una buena comunicación y convivencia entre el perro y la familia: paseos tranquilos, respuesta a la llamada, manejo de las situaciones del día a día. Con constancia se ven cambios rápido. Si en la primera sesión el adiestrador detecta algo más específico (reactividad, miedos, ansiedad), lo comentaría y valoraríais juntos cómo continuar.`,

  cachorros: `Lo que me cuentas entra dentro de nuestro protocolo de educación de cachorros — una etapa que cubre bastante terreno: socialización, manejo de la mordida, elección del lugar adecuado para sus necesidades, pautas de descanso, gestión de la soledad, construcción de las primeras rutinas y del vínculo con vosotros. Con constancia se ven cambios rápido, porque el cachorro aprende muy rápido cuando las pautas son claras. En la primera sesión el adiestrador hace una valoración general y define el plan según lo que vea.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 6. CASO MIXTO (conservado para compatibilidad)
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_MIXTO = {

  plantilla: `Por lo que me cuentas parece haber dos componentes en lo que describes: por un lado, {cuadro_1}; por otro, {cuadro_2}. Son dos capas que se pueden trabajar en paralelo, con pautas diferenciadas — a veces se refuerzan entre ellas y abordarlas juntas da mejores resultados que tratar solo una. En la primera sesión el adiestrador valora en directo cuál prima y cómo priorizar el trabajo. Sesiones en el domicilio, junto a los tutores, con pautas concretas entre semana. Con constancia se ven cambios rápido.`,

  separacion_generalizada: `Por lo que me cuentas, hay un cuadro de ansiedad que se manifiesta tanto cuando estás con él como cuando se queda solo — un estado de tensión de base que se agrava en la soledad. Es una combinación frecuente y se trabaja con un protocolo integrado. Sesiones en el domicilio, junto a los tutores, con pautas concretas entre semana. Con constancia se ven cambios.`,
};

export const ETIQUETAS_MIXTO = {
  separacion: "ansiedad por separación",
  generalizada: "ansiedad generalizada de fondo",
  miedos: "un cuadro de miedos",
  reactividad: "reactividad ante estímulos externos",
  posesion: "posesión de recursos",
  cachorros: "la gestión propia de la etapa de cachorro",
};


// ─────────────────────────────────────────────────────────────────────────────
// 7. SERVICIOS LATERALES
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_LATERALES = {

  paseos_grupales: `Gracias por el interés. Los paseos grupales no son un servicio fijo en agenda — los organizamos de forma puntual según época del año, disponibilidad y tiempo. Te recomendaría seguirnos en Instagram (@perrosdelaisla), que es donde avisamos cuándo abrimos fechas, condiciones y cómo apuntarse. Si mientras tanto hay algo concreto del día a día con tu perro que te gustaría trabajar (paseo, convivencia, socialización, alguna conducta que quieras mejorar), cuéntame y lo vemos.`,

  adopciones: `Gracias por escribir. No nos dedicamos a adopciones — somos una empresa de adiestramiento canino especializada en perros de familia. Si en algún momento adoptas y necesitas apoyo para educarlo o integrarlo bien en casa, aquí estamos.`,

  guarderia: `Para guardería canina, lo mejor es que mires opciones en tu zona y visites las instalaciones antes de decidir — es importante que veas cómo manejan a los perros, qué espacio tienen, cómo es el personal. No tenemos una recomendación concreta que darte con la que nos sintamos cómodos al cien por cien, así que preferimos que elijas tú con calma después de verlo en persona.`,

  peluqueria: `Para peluquería canina en Palma, la más conocida y con la que hemos tenido buena experiencia es Dogma. Te recomendaría buscarlos y ver disponibilidad. Si estás fuera de Palma, lo mejor es preguntar en tu veterinario de referencia qué peluquería recomienda en tu zona — ellos suelen saber quiénes trabajan con trato cuidadoso.`,

  veterinaria: `Para veterinaria, si estás en Palma te recomendaría Veterinaria Sa Palla, en Plaça del Pes de Sa Palla 5 (casco antiguo). Es la que usamos nosotros, muy cuidadosa con el trato y con buena atención. Si estás fuera de Palma, lo mejor es buscar un veterinario de zona con buenas referencias y consulta sin prisas.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 8. FRASES DE APOYO — flujo conversacional
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_APOYO = {

  pedir_especificacion: `Cuéntame algo más del día a día con tu perro — qué situaciones te gustaría mejorar, qué has notado que te preocupa, cómo es la convivencia. Con eso puedo orientarte mejor.`,

  filtro_mordida: `Para orientarte bien necesito saber una cosa: cuando ha habido episodios así, ¿ha llegado a haber contacto real con los dientes sobre alguien, o se queda en el aviso (gruñido, mostrar dientes, cuerpo rígido)? Si ha habido contacto, ¿qué consecuencia tuvo (marca leve, hematoma, herida con sangre, puntos)? Muchos perros lo que hacen es avisar con el gesto, es información útil para ver cómo abordamos el caso.`,

  filtro_mordida_repregunta: `Para poder orientarte bien, cuéntame con un poco más de detalle: ¿hubo contacto real de los dientes, y de haberlo, quedó alguna marca (enrojecimiento, hematoma, sangre)?`,

  pedir_zona: `¿En qué zona de Mallorca estás? Con el municipio o barrio me vale para ver qué podemos ofrecerte.`,

  pedir_edad: `¿Qué edad tiene tu perro? Con meses si aún es cachorro, o años si ya es adulto.`,

  pedir_peso: `¿Qué peso aproximado tiene? No hace falta que sea exacto, un número aproximado me vale.`,

  pedir_raza: `¿Qué raza es? Si es mestizo o no estás seguro, descríbeme cómo es de tamaño y complexión.`,

  pedir_conducta: `Cuando pasa eso, ¿cómo reacciona exactamente tu perro? ¿Se esconde, se queda paralizado, intenta salir corriendo? ¿O más bien ladra, se lanza, tira de la correa? La respuesta del perro es lo que me ayuda a orientarte bien.`,

  fallback_whatsapp: `Para poder orientarte bien, te paso directamente con el equipo de Perros de la Isla — pueden atenderte con más detalle. Puedes escribirnos por WhatsApp al 622 922 173.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 9. NUEVAS CONSTANTES — mensaje principal unificado (v2.0)
// ─────────────────────────────────────────────────────────────────────────────

export const FRASE_MENSAJE_PRINCIPAL = `Lo que me cuentas sobre {perro} está dentro de lo que trabajamos. En Perros de la Isla tenemos protocolos específicos para educación básica, cachorros, reactividad, miedos, ansiedad y posesión de recursos. El adiestrador concreta el protocolo exacto en la primera clase, tras conocer a {perro} en su contexto real. Así la primera clase no es una más: es donde se afina el plan según lo que realmente necesite tu perro.`;

export const FRASE_MENSAJE_PRINCIPAL_ONLINE = `Lo que me cuentas sobre {perro} está dentro de lo que trabajamos. En Perros de la Isla tenemos protocolos específicos para educación básica, cachorros, miedos y gestión de ansiedad, que sí trabajamos en modalidad online por Google Meet para zonas fuera de nuestra cobertura presencial. El adiestrador concreta el protocolo exacto en la primera clase, tras conocer a {perro} y ver cómo se desenvuelve contigo en su entorno real. Así la primera clase no es una más: es donde se afina el plan según lo que realmente necesite tu perro.`;

export const FRASE_RAMIFICACION = `¿Quieres que te cuente un poco cómo son nuestras clases, o prefieres que te pase la información de precios directamente?`;

export const FRASE_COMO_TRABAJAMOS_PRESENCIAL = `El adiestrador se desplaza a tu domicilio — donde {perro} vive su día a día, que es donde mejor se observa su comportamiento real. Cada clase dura una hora, aunque puede extenderse un poco si hace falta — priorizamos que entiendas todo lo que vemos y puedas resolver todas tus dudas, no cerrar a toque de reloj.

Entre clases tienes consulta por WhatsApp con el adiestrador. Te enviamos videos de apoyo para que practiques los ejercicios correctamente, y puedes mandarnos videos tuyos entrenando para que te vayamos corrigiendo. Así cada clase avanza sobre la anterior y aprovechamos al máximo el trabajo.`;

export const FRASE_COMO_TRABAJAMOS_ONLINE = `Las clases son por Google Meet — solo necesitas un móvil o un ordenador con cámara, y que {perro} esté contigo en casa para que el adiestrador pueda verlo durante la sesión. Cada clase dura una hora, aunque puede extenderse un poco si hace falta — priorizamos que entiendas todo lo que vemos y puedas resolver todas tus dudas, no cerrar a toque de reloj.

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
// FRASES DE PRECIO / VALOR
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
    "del trabajo, que es lo que marca la diferencia en los resultados. La decisión la tomas en la primera sesión " +
    "sin compromiso — si después de conocer al adiestrador prefieres ir clase a clase, perfecto también.",
  online:
    "El pack online son 4 clases por 240€ en vez de 300€ (75€ × 4). Te ahorras 60€ y aseguras la continuidad. " +
    "Decides pack o clase suelta en la primera sesión, sin compromiso.",
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

    case "mensaje_principal":
      // Elegir variante según modalidad: online para zonas fuera, default para presencial
      if (vars.modalidad === "online") {
        frase = FRASE_MENSAJE_PRINCIPAL_ONLINE;
      } else {
        frase = FRASE_MENSAJE_PRINCIPAL;
      }
      if (vars.perro) {
        frase = frase.replace(/\{perro\}/g, vars.perro);
      } else {
        frase = frase.replace(/\{perro\}/g, "tu perro");
      }
      break;

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

    case "cuadro":
      if (modalidad === "online") {
        frase = FRASES_ONLINE[cuadro] ?? null;
      } else {
        frase = FRASES_PRESENCIAL[cuadro] ?? null;
      }
      break;

    case "lateral":
      frase = FRASES_LATERALES[subtipo] ?? null;
      break;

    case "etologo":
      frase = FRASES_ETOLOGO[subtipo ?? "principal"] ?? null;
      break;

    case "zona":
      frase = FRASE_DERIVACION_ZONA;
      if (vars.cuadro) {
        const etiqueta = ETIQUETAS_CUADRO_ZONA[vars.cuadro] ?? vars.cuadro;
        frase = frase.replace("{cuadro}", etiqueta);
      }
      break;

    case "son_gotleu":
      frase = FRASES_SON_GOTLEU[subtipo ?? "no_compatible_online"] ?? null;
      if (subtipo === "compatible_online" && cuadro && FRASES_DIAGNOSTICO_SIN_MODALIDAD[cuadro]) {
        frase = frase + " " + FRASES_DIAGNOSTICO_SIN_MODALIDAD[cuadro];
      }
      break;

    case "mixto":
      if (subtipo === "separacion_generalizada") {
        frase = FRASES_MIXTO.separacion_generalizada;
      } else {
        frase = FRASES_MIXTO.plantilla;
        if (vars.cuadro_1) {
          frase = frase.replace("{cuadro_1}", ETIQUETAS_MIXTO[vars.cuadro_1] ?? vars.cuadro_1);
        }
        if (vars.cuadro_2) {
          frase = frase.replace("{cuadro_2}", ETIQUETAS_MIXTO[vars.cuadro_2] ?? vars.cuadro_2);
        }
      }
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
