# E1 — Reacondicionamiento de ajustes del coach

Fecha: 2026-10-31. Desarrollo inicial: c1c383f179c6f687b91bab49572b78215cadc4c1.
Candidata inicial: beta@81f42886ef73e421db68f001ef704606d3b3450e.
Este bloque continúa el lanzamiento urgente. No rehace los módulos cerrados.

## Cambios entregados

- Seis pestañas existentes presentadas como tarjetas con iconos y descripciones,
  navegación con flechas/Home/End y asociaciones tab/tabpanel accesibles.
- Preferencias es la entrada inicial útil en los tres planes; identidad visual
  tiene una sola ubicación. Ignición/Evolución ven explicación y acceso real a
  licencia, sin un formulario de marca borroso que se pudiera enfocar.
- Carga incompleta muestra error y Reintentar, en vez de listas vacías engañosas.
  El efecto descarta respuestas de una carga desmontada o reemplazada.
- Guardados de marca/preferencias solicitan la fila devuelta; no se confirma éxito
  si no hay fila autorizada. Marca filtra id + user_id. Formularios bloquean
  edición durante su guardado; se conservan entradas al fallar.
- La marca ya no reescribe communication_mode desde un formulario ajeno.
- Hallazgo: Chat.jsx no usa communication_mode; el selector anterior prometía
  desactivar canales sin hacerlo. Se retira ese control. La pestaña muestra los
  canales reales por plan y abre /chat. No se borra la preferencia histórica ni
  se cambia el contrato de permisos del chat.
- Hallazgo: RegisterCoach.jsx no procesa ref. Invitaciones copia el enlace real
  /register/coach, espera al portapapeles y ofrece selección manual si falla.
  No promete registrar referidos o comisiones. La lista histórica se conserva.
- Avisos de guardado/error accesibles en la propia pantalla, textos ES/EN,
  controles etiquetados y colores claros/oscuros revisados.

## Verificación realizada

- ESLint de CoachSettings, GenesisTabs, coachSettingsService y su verificador: PASS.
- node scripts/verify-coach-settings.mjs: PASS. Sesión ausente no consulta datos;
  perfil ausente y errores secundarios no pasan como éxito; consultas de atletas
  y preferencias mantienen sus filtros de titular.
- Prueba DOM temporal del componente real compilado con adaptadores ficticios:
  seis escenarios PASS (Ignición/Evolución/Élite, teclado y marca restringida;
  carga fallida/reintento; guardado fallido/exitoso, copia denegada y aislamiento
  de campos de marca; inglés). Los adaptadores no se incorporan al código beta.
- Navegador: revisión local del componente real, claramente rotulada con datos
  ficticios. Escritorio oscuro, tema claro/inglés y móvil de 390px (375px útiles
  por scrollbar; scrollWidth=clientWidth=375, sin desbordamiento horizontal).
- npm run build: PASS, Vite 8.2.1, 2096 módulos. Advertencia de bundle grande
  preexistente registrada; no bloquea por sí sola la candidata.
- Sin paquetes/lockfile nuevos, migraciones, purgas ni operaciones en datos reales.
  Los valores públicos ficticios usados para build local no se publican.

## Estado de aceptación y continuidad

Las 15 filas afectadas de la matriz pasan a EN_REVISION, no APROBADO. Hace falta
validar sesión real, RLS, reapertura y persistencia en Supabase, subida real de logo,
solicitud administrativa y apertura del chat por plan. Esta revisión de pantalla
no acepta la totalidad de los tres perfiles coach ni los siete perfiles beta.

La publicación de este cambio en beta es una actualización de la candidata de
revisión. main permanece sin cambios. Registrar el resultado real de Netlify;
un push por sí solo no verifica el despliegue.

Próximo bloque: E1 Super Admin y panel/detalle de atleta (controles y gráficas
con fuentes reales); después A2.5, Women's Performance, Disciplina e historial.
Running/Ironman permanecen visibles En desarrollo. R2 sigue excluido.

## Registro de trabajo

Primera marca de reloj verificable de este bloque: 2026-10-31T15:09:10Z
(11:09:10 America/New_York). Es una marca de ejecución del asistente, no una hora
de inicio declarada por Diego. No se convierten los minutos de herramientas en
horas humanas ni se recalcula la fecha de beta a partir de esta muestra.
