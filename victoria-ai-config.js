/**
 * victoria-ai-config.js
 * Perros de la Isla — Embudo Victoria
 * Configuración del fallback IA (Claude vía Supabase Edge Function)
 * Versión 1.0 · Mayo 2026
 *
 * Define el comportamiento del fallback inteligente que toma el control
 * cuando el árbol de decisiones de Victoria no encuentra match. La IA
 * intenta reconducir o pide WhatsApp del cliente. Si la IA falla por
 * cualquier motivo (timeout, error HTTP, kill-switch), el código vuelve
 * automáticamente al _fallbackHumano original.
 *
 * Para desactivar la IA en caliente sin redeploy: poner activa=false,
 * commitear, push. La caché del cliente se invalida con ?v=N en index.html.
 */

export const IA_FALLBACK_CONFIG = {
  /**
   * Kill-switch global. false = la IA nunca se activa, siempre _fallbackHumano.
   * Cambiar a false ante cualquier incidente (factura disparada, respuesta
   * inadecuada, etc.) y commitear.
   */
  activa: true,

  /**
   * true  = la IA solo se activa para sesiones con ?prueba=1 en la URL
   * false = la IA se activa para todos los clientes (prueba y reales)
   * Kill-switch para volver a "solo prueba" sin redeploy si hay incidencia.
   */
  soloPrueba: false,

  /**
   * URL del Edge Function desplegado en Supabase.
   * Acepta body { messages: [...] } y devuelve { reply, model, stop_reason, usage }.
   */
  proxyUrl: "https://sydzfwwiruxqaxojymdz.supabase.co/functions/v1/claude-proxy",

  /**
   * Timeout para la petición fetch al proxy. Si se supera, AbortController
   * cancela la petición y se cae a _fallbackHumano.
   */
  timeoutMs: 8000,

  /**
   * Tope de turnos IA por sesión. Al llegar a este número se devuelve
   * una frase fija de cierre y se marca state.fallback_ia_cerrado=true
   * para que ninguna reentrada use la IA.
   */
  maxTurnos: 3,
};
