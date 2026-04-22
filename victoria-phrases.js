/**
 * victoria-phrases.js
 * Perros de la Isla — Embudo Victoria
 * Banco completo de frases — texto exacto de la especificación v1.0
 * Versión 1.0 · Abril 2026
 *
 * IMPORTANTE: estas frases son el texto final redactado en la spec.
 * No modificar sin revisar con Carlos. Las variables entre llaves
 * ({nombre_perro}, {cuadro_1}, etc.) se sustituyen en victoria.js
 * antes de enviar al cliente.
 */


// ─────────────────────────────────────────────────────────────────────────────
// 1. FRASES DE CUADROS — PRESENCIAL
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
// 2. FRASES DE CUADROS — ONLINE (Google Meet)
// Solo para cuadros compatibles: separacion, generalizada, basica, cachorros
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_ONLINE = {

  separacion: `Lo que me cuentas encaja con ansiedad por separación, y sé lo que supone en el día a día: no poder salir tranquilo, la tensión al volver a casa, a veces incluso quejas de los vecinos. Es de los casos que más trabajamos. Como estás fuera de nuestra zona de cobertura presencial, te propongo trabajarlo en modalidad online: sesiones por Google Meet, junto a los tutores, con pautas concretas que se trabajan entre semana. Con constancia se ven cambios rápido. No es magia, pero sí es un proceso estructurado que funciona.`,

  generalizada: `Lo que describes encaja con ansiedad generalizada — no es que reaccione a algo puntual, es que no consigue estar tranquilo. Y un perro que no descansa bien emocionalmente acaba afectando también al ambiente de casa. Es un cuadro que trabajamos con un protocolo específico. Como estás fuera de nuestra zona de cobertura presencial, te propongo hacerlo en modalidad online: sesiones por Google Meet, junto a los tutores, trabajando tanto la rutina del perro como el vínculo y las pautas de convivencia. Con constancia se ven cambios — no es magia, pero tampoco es un proceso eterno.`,

  basica: `Lo que me cuentas entra dentro de lo que trabajamos como educación básica — más que "obediencia" al uso, es construir una buena comunicación y convivencia entre el perro y la familia: paseos tranquilos, respuesta a la llamada, manejo de las situaciones del día a día. Como estás fuera de nuestra zona de cobertura presencial, te propongo trabajarlo en modalidad online: sesiones por Google Meet, junto a los tutores, con pautas concretas entre semana. Con constancia se ven cambios rápido. Si en la primera sesión el adiestrador detecta algo más específico (reactividad, miedos, ansiedad), lo comentaría y valoraríais juntos cómo continuar.`,

  cachorros: `Lo que me cuentas entra dentro de nuestro protocolo de educación de cachorros — una etapa que cubre bastante terreno: socialización, manejo de la mordida, elección del lugar adecuado para sus necesidades, pautas de descanso, gestión de la soledad, construcción de las primeras rutinas y del vínculo con vosotros. Como estás fuera de nuestra zona de cobertura presencial, te propongo trabajarlo en modalidad online: sesiones por Google Meet, junto a los tutores, con pautas concretas entre semana. Con constancia se ven cambios rápido, porque el cachorro aprende muy rápido cuando las pautas son claras. En la primera sesión el adiestrador hace una valoración general y define el plan según lo que vea.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 3. DERIVACIÓN AL ETÓLOGO
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_ETOLOGO = {

  // Frase principal — siempre
  principal: `Gracias por escribirme con tanto detalle. Por lo que describes, lo que tu perro necesita en este momento va más allá de un protocolo de adiestramiento — sería importante empezar por una valoración con un etólogo veterinario. Los etólogos tienen formación clínica en comportamiento canino y pueden valorar si hay algún componente médico o neurológico detrás del cuadro, además de definir un plan individualizado. No es un "no" a trabajar con vosotros — es que el orden importa, y empezar por ahí es lo que mejor le va a ir a tu perro. Una vez hecha esa evaluación, si el etólogo considera que hay terreno para un acompañamiento desde el adiestramiento, aquí estamos para retomar. Gracias de nuevo por la confianza.`,

  // Solo si el cliente pregunta explícitamente por recomendación de nombre
  complementaria: `En Mallorca hay varios profesionales. El más conocido es Tomás Camps, aunque te recomendaría mirar también qué perfil te queda más cerca de zona y con quién te sientes cómodo — es una decisión personal y es importante que el encaje sea bueno.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 4. DERIVACIÓN POR ZONA (fuera de cobertura + cuadro NO compatible con online)
// La variable {cuadro} se sustituye por "reactividad" / "posesión" / "los miedos"
// ─────────────────────────────────────────────────────────────────────────────

export const FRASE_DERIVACION_ZONA = `Gracias por escribirme. Por lo que me cuentas, el cuadro de tu perro es de los que trabajamos únicamente en modalidad presencial — {cuadro} necesita observación directa del perro en su contexto real para evaluar bien el caso y aplicar el protocolo con criterio. Por videollamada no daríamos el nivel de trabajo que el caso merece. Como estás fuera de nuestra zona de cobertura, te recomendaría buscar un profesional cerca de ti con enfoque cognitivo-emocional y sin métodos aversivos — es el perfil que mejor resultado da en estos cuadros. Si en algún momento te planteas desplazarte a Mallorca o cambias de zona, aquí seguimos.`;

// Etiquetas para sustituir {cuadro} según el cuadro detectado
// Todas en singular para concordar con "necesita" en la frase
export const ETIQUETAS_CUADRO_ZONA = {
  reactividad: "la reactividad",
  posesion: "la posesión de recursos",
  miedos: "el cuadro de miedos",
};


// ─────────────────────────────────────────────────────────────────────────────
// 5. EXCEPCIÓN SON GOTLEU (política interna)
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_SON_GOTLEU = {

  // Cuadro compatible con online → frase de política interna + frase diagnóstico sin modalidad
  compatible_online: `Por temas de agenda y organización, en esa zona no estamos ofreciendo desplazamiento presencial ahora mismo. Lo que sí podemos hacer es trabajarlo en modalidad online por Google Meet, junto a los tutores, con pautas concretas entre semana — funciona muy bien para este tipo de casos.`,

  // Cuadro NO compatible con online → solo derivación
  no_compatible_online: `Por temas de agenda y organización, en esa zona no estamos ofreciendo desplazamiento presencial ahora mismo, y este tipo de caso solo lo trabajamos presencialmente porque necesita observación directa del perro en su contexto. Te recomendaría buscar un profesional cerca de tu zona con enfoque cognitivo-emocional y sin métodos aversivos — es el perfil que mejor resultado da en estos cuadros.`,
};

// Versiones "solo diagnóstico" para concatenar con la frase de Son Gotleu compatible_online.
// No incluyen detalles de modalidad — así al concatenar no se repite información.
export const FRASES_DIAGNOSTICO_SIN_MODALIDAD = {

  separacion: `Lo que me cuentas encaja con ansiedad por separación, y sé lo que supone en el día a día: no poder salir tranquilo, la tensión al volver a casa, a veces incluso quejas de los vecinos. Es de los casos que más trabajamos. Con constancia se ven cambios rápido. No es magia, pero sí es un proceso estructurado que funciona.`,

  generalizada: `Lo que describes encaja con ansiedad generalizada — no es que reaccione a algo puntual, es que no consigue estar tranquilo. Y un perro que no descansa bien emocionalmente acaba afectando también al ambiente de casa. Con constancia se ven cambios — no es magia, pero tampoco es un proceso eterno.`,

  basica: `Lo que me cuentas entra dentro de lo que trabajamos como educación básica — más que "obediencia" al uso, es construir una buena comunicación y convivencia entre el perro y la familia: paseos tranquilos, respuesta a la llamada, manejo de las situaciones del día a día. Con constancia se ven cambios rápido. Si en la primera sesión el adiestrador detecta algo más específico (reactividad, miedos, ansiedad), lo comentaría y valoraríais juntos cómo continuar.`,

  cachorros: `Lo que me cuentas entra dentro de nuestro protocolo de educación de cachorros — una etapa que cubre bastante terreno: socialización, manejo de la mordida, elección del lugar adecuado para sus necesidades, pautas de descanso, gestión de la soledad, construcción de las primeras rutinas y del vínculo con vosotros. Con constancia se ven cambios rápido, porque el cachorro aprende muy rápido cuando las pautas son claras. En la primera sesión el adiestrador hace una valoración general y define el plan según lo que vea.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 6. CASO MIXTO
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_MIXTO = {

  // Plantilla general — sustituir {cuadro_1} y {cuadro_2}
  // Orden: primero cuadro emocional de fondo, luego cuadro de conducta externa
  plantilla: `Por lo que me cuentas parece haber dos componentes en lo que describes: por un lado, {cuadro_1}; por otro, {cuadro_2}. Son dos capas que se pueden trabajar en paralelo, con pautas diferenciadas — a veces se refuerzan entre ellas y abordarlas juntas da mejores resultados que tratar solo una. En la primera sesión el adiestrador valora en directo cuál prima y cómo priorizar el trabajo. Sesiones en el domicilio, junto a los tutores, con pautas concretas entre semana. Con constancia se ven cambios rápido.`,

  // Variante especial: separación + generalizada (formulación integrada)
  separacion_generalizada: `Por lo que me cuentas, hay un cuadro de ansiedad que se manifiesta tanto cuando estás con él como cuando se queda solo — un estado de tensión de base que se agrava en la soledad. Es una combinación frecuente y se trabaja con un protocolo integrado. Sesiones en el domicilio, junto a los tutores, con pautas concretas entre semana. Con constancia se ven cambios.`,
};

// Etiquetas para sustituir {cuadro_1} y {cuadro_2} en la plantilla mixta
// Nota: "basica" no está incluida — por diseño nunca entra en caso mixto.
// Si el motor llega aquí con "basica" es un bug de matching, no un caso válido.
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

  // Cuando no hay keywords claras (Paso 10 del árbol)
  pedir_especificacion: `Cuéntame algo más del día a día con tu perro — qué situaciones te gustaría mejorar, qué has notado que te preocupa, cómo es la convivencia. Con eso puedo orientarte mejor.`,

  // Filtro de mordida (Principio 13) — antes de proponer protocolo en posesión/reactividad
  filtro_mordida: `Para orientarte bien necesito saber una cosa: cuando ha habido episodios así, ¿ha llegado a haber contacto real con los dientes sobre alguien, o se queda en el aviso (gruñido, mostrar dientes, cuerpo rígido)? Si ha habido contacto, ¿qué consecuencia tuvo (marca leve, hematoma, herida con sangre, puntos)? Muchos perros lo que hacen es avisar con el gesto, es información útil para ver cómo abordamos el caso.`,

  // Si la respuesta al filtro de mordida no permite clasificar la gravedad
  filtro_mordida_repregunta: `Para poder orientarte bien, cuéntame con un poco más de detalle: ¿hubo contacto real de los dientes, y de haberlo, quedó alguna marca (enrojecimiento, hematoma, sangre)?`,

  // Pregunta de zona cuando no se detecta
  pedir_zona: `¿En qué zona de Mallorca estás? Con el municipio o barrio me vale para ver qué podemos ofrecerte.`,

  // Pregunta de edad cuando no se ha recogido
  pedir_edad: `¿Qué edad tiene tu perro? Con meses si aún es cachorro, o años si ya es adulto.`,

  // Pregunta de peso aproximado
  pedir_peso: `¿Qué peso aproximado tiene? No hace falta que sea exacto, un número aproximado me vale.`,

  // Pregunta de raza
  pedir_raza: `¿Qué raza es? Si es mestizo o no estás seguro, descríbeme cómo es de tamaño y complexión.`,

  // Pregunta de conducta cuando hay detonante pero falta descripción de respuesta
  pedir_conducta: `Cuando pasa eso, ¿cómo reacciona exactamente tu perro? ¿Se esconde, se queda paralizado, intenta salir corriendo? ¿O más bien ladra, se lanza, tira de la correa? La respuesta del perro es lo que me ayuda a orientarte bien.`,

  // Fallback al WhatsApp humano
  fallback_whatsapp: `Para poder orientarte bien, te paso directamente con el equipo de Perros de la Isla — pueden atenderte con más detalle. Puedes escribirnos por WhatsApp al 622 922 173.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// 8.5 DURACIÓN DE PROTOCOLOS — respuesta cuando el cliente pregunta cuántas clases
// Se usa solo si el cliente lo pregunta explícitamente, nunca proactivamente.
// ─────────────────────────────────────────────────────────────────────────────

export const FRASES_DURACION = {

  separacion: `Para un caso de ansiedad por separación, el protocolo suele durar entre 8 y 12 sesiones. En casos más complejos puede extenderse hasta 14. En la primera sesión el adiestrador valora el caso en directo y ajusta el número según lo que vea.`,

  generalizada: `Para un caso de ansiedad generalizada, el protocolo suele durar entre 8 y 12 sesiones. En casos más complejos puede extenderse hasta 14. En la primera sesión el adiestrador valora el caso en directo y ajusta el número según lo que vea.`,

  miedos: `En miedos el protocolo suele durar entre 8 y 12 sesiones. En casos más complejos puede extenderse hasta 14. Es un cuadro que a veces se combina con otros (reactividad, ansiedad), y eso también se valora en la primera sesión. El adiestrador ajusta el plan según lo que observe.`,

  reactividad: `En reactividad el número de sesiones depende mucho del caso. En casos leves pueden bastar 4 sesiones, y en los más graves se llega a 12 — en casos muy complejos hasta 14. En la primera sesión el adiestrador valora el nivel de activación y ajusta el plan.`,

  posesion: `En posesión de recursos el protocolo suele durar entre 4 y 8 sesiones. En casos más graves puede llegar a 12. En la primera sesión el adiestrador valora el caso en directo y ajusta el número según lo que vea.`,

  basica: `La educación básica es un protocolo corto: 4 sesiones. Si durante el trabajo el tutor quiere profundizar en algo concreto o necesita apoyo extra, se puede ampliar sin problema.`,

  cachorros: `El protocolo de cachorros es corto: 4 sesiones. Si queréis trabajar algo más en concreto o necesitáis apoyo extra, se puede ampliar sin problema.`,
};


// ─────────────────────────────────────────────────────────────────────────────
// FRASES DE PRECIO / VALOR
// Se responden cuando el cliente pregunta por el valor ANTES de que Victoria
// lo haya mencionado (en s4, s5 o s6 si aún no se presentó el protocolo).
// Tono de marca: "valor" no "precio", "clase" no "sesión".
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

// ─────────────────────────────────────────────────────────────────────────────
// FRASES DE PACK / DESCUENTO
// Se responden cuando el cliente pregunta específicamente por el pack o descuento.
// ─────────────────────────────────────────────────────────────────────────────
export const FRASES_PACK = {
  presencial:
    "El pack son 4 clases por 300€ en vez de 360€ (90€ × 4). Te ahorras 60€ y además aseguras la continuidad " +
    "del trabajo, que es lo que marca la diferencia en los resultados. La decisión la tomas en la primera sesión " +
    "sin compromiso — si después de conocer al adiestrador prefieres ir clase a clase, perfecto también.",
  online:
    "El pack online son 4 clases por 240€ en vez de 300€ (75€ × 4). Te ahorras 60€ y aseguras la continuidad. " +
    "Decides pack o clase suelta en la primera sesión, sin compromiso.",
};

// ─────────────────────────────────────────────────────────────────────────────
// FRASE PRECIO POR PERRO
// Pregunta típica cuando el cliente tiene más de un perro.
// ─────────────────────────────────────────────────────────────────────────────
export const FRASE_PRECIO_POR_PERRO =
  "El valor es por clase, no por perro. Si tienes más de un perro trabajamos con ellos en la misma clase — " +
  "muchas veces los casos van ligados entre sí y da mejores resultados abordarlos juntos.";


// ─────────────────────────────────────────────────────────────────────────────
// 9. UTILIDAD — obtenerFrase()
// Función central que victoria.js usa para recuperar frases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve la frase correcta según cuadro, modalidad y contexto.
 * Sustituye variables ({nombre_perro}, {cuadro_1}, {cuadro_2}, {cuadro}) si se pasan.
 *
 * @param {Object} params
 * @param {string} params.tipo         — 'cuadro' | 'lateral' | 'etologo' | 'zona' | 'son_gotleu' | 'mixto' | 'apoyo' | 'duracion'
 * @param {string} [params.cuadro]     — id del cuadro (separacion, miedos, etc.)
 * @param {string} [params.modalidad]  — 'presencial' | 'online'
 * @param {string} [params.subtipo]    — para lateral, apoyo, etologo, son_gotleu, mixto
 * @param {Object} [params.vars]       — variables a sustituir: { nombre_perro, cuadro_1, cuadro_2 }
 * @returns {string|null}
 */
export function obtenerFrase({ tipo, cuadro, modalidad, subtipo, vars = {} }) {
  let frase = null;

  switch (tipo) {
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
      frase = FRASES_SON_GOTLEU[subtipo] ?? null;
      // Si es compatible_online, concatenar la descripción del cuadro sin repetir modalidad
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

    case "duracion":
      frase = FRASES_DURACION[cuadro] ?? null;
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

  // Sustituir nombre del perro solo en frases que empiezan con apertura diagnóstica
  // ("Lo que me cuentas", "Eso que describes", "Lo que describes").
  // Es intencional que frases de etólogo, caso mixto, Son Gotleu, derivación por zona
  // y servicios laterales NO se personalicen con el nombre — leen forzado si se hace.
  if (frase && vars.nombre_perro) {
    // Solo sustituir en la primera frase del texto, y solo si encaja naturalmente
    // "Lo que me cuentas sobre {nombre_perro} encaja con..."
    frase = frase.replace(
      /^(Lo que me cuentas|Eso que describes|Lo que describes)/,
      (match) => `${match} sobre ${vars.nombre_perro}`
    );
  }

  return frase;
}
