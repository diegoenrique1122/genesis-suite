# Genesis — Protocolo de lanzamiento urgente de beta

Fecha: 31 octubre 2026, America/New_York.
Baseline inicial: 49dd61bcb805095796457c1e6e994d0f5b20693e.
Rama de desarrollo: rebuild/core-architecture.
Rama candidata/revisión: beta.
Estado: preparación y primer cambio implementados; beta pública NO aceptada aún.

## Instrucción vigente del usuario

Lanzar en Netlify cuanto antes, revisar todas las pestañas/ventanas de Super Admin,
Coach Ignición/Evolución/Élite y Atleta Ignición/Evolución/Élite, con visual
profesional, gráficas útiles y controles reales. Women's Performance y Disciplina
deben quedar completas en el contrato beta. Running e Ironman pasan después de
beta y aparecen como “En desarrollo” al pulsar sus tarjetas.

Esta petición cambia la dependencia de release: Running/Ironman ya no bloquean
beta. No elimina los compromisos anteriores de nutrición, TrainerPro, historial
numérico, privacidad, sincronización o interfaces.

## Dentro / después de beta

Dentro:
- Siete familias de perfil revisadas en escritorio y móvil.
- Jerarquía visual y pestañas/configuración coherentes; Apariencia única.
- Cada botón visible tiene resultado real y estados de carga/error/recuperación.
- Gráficas canónicas con unidades, fecha, cobertura y comparación.
- TrainerPro y Arquitecto completos según contrato visible beta.
- Disciplina: check-in, comidas/evidencia separadas, agua, sueño, pasos manuales,
  entrenamiento, peso/fotos, objetivos/rachas/insignias prometidas y monitoreo coach.
- Women's Performance: consentimiento y revocación, registros privados e historial,
  síntomas/recuperación, contexto de planes aprobados, acceso coach autorizado,
  propuestas revisadas y sin promesas de modificación automática inexistente.
- Resumen Visual e Historial numérico con los seis análisis ya acordados.
- Roles, planes, modos, estados de cuenta/programa y aislamiento comprobados.
- Tarjetas Running y Triatlón/Ironman con aviso funcional de estado, sin aparentar
  planes, sesiones o integraciones disponibles.

Después:
- Implementación operativa de Running/Ironman.
- Conectores reales de wearables y otras ampliaciones comerciales previamente
  post-beta. Disciplina beta usa datos manuales trazables como ya estaba acordado.
- Nueva compresión/retención diferenciada de fotos según su documento; no activar
  purgas en esta preparación.
- R2 sigue excluido.

La excepción de vista futura se limita a las tarjetas expresamente solicitadas.
No permite presentar botones de guardar/aprobar, métricas o diagnósticos ficticios.

## Dos momentos de publicación

1. Candidata de revisión en Netlify: permite revisar la versión en desarrollo.
   No se llama “beta lista”. Los hallazgos y datos de prueba quedan identificados.
2. Beta aceptada: habilitada para usuarios piloto después de cerrar criterios de
   los siete perfiles, Women's/Disciplina y bloqueos funcionales/de seguridad.

La rama beta recibe únicamente commits seleccionados, con build y evidencia.
rebuild/core-architecture continúa desarrollo posterior. main no se cambia por
este protocolo. No hacer pulls/merges automáticos de desarrollo hacia beta.
La rama de frontend no crea aislamiento de base de datos: desarrollo y fixtures
siguen en el laboratorio local; las migraciones beta son compatibles y no borran
datos reales. Una publicación frontend no autoriza un reset de Supabase.

## Matriz de perfiles

| Perfil | Apps/acceso esperado en beta |
| --- | --- |
| Super Admin | Consola admin, solicitudes/gestión autorizada, ajustes, modos inmersivos canónicos. |
| Coach Ignición | Capacidad de hasta 5; lectura/gestión permitida por contrato; sin overrides, white-label ni modo atleta Elite. |
| Coach Evolución | Hasta 50; overrides de entrenamiento/nutrición; sin funciones exclusivas de coach Elite. |
| Coach Élite | Funciones Elite, monitoreo, comunidad/branding y modo atleta según reglas existentes. |
| Atleta Ignición | Una app contratada; probar TRAINING y la variante de nutrición por separado. |
| Atleta Evolución | TrainerPro y Arquitecto; permisos y UI coherentes. |
| Atleta Élite | TrainerPro, Arquitecto, Disciplina; Women's solo con elegibilidad y consentimiento. |

Modo inmersivo no concede por sí solo acceso a datos sensibles de terceros.
La revisión incluye planes cruzados coach/atleta permitidos por el motor actual,
sin inventar una equivalencia entre el plan B2B y el B2C.
Probar mujer/hombre/género ausente donde afecte elegibilidad; no forzar perfiles.

El archivo GENESIS_BETA_PROFILE_REVIEW.csv contiene la lista inicial por pantalla.
“PENDIENTE” no significa funcionalidad nueva por desarrollar: requiere revisar
y reutilizar el código/pruebas existentes antes de decidir cambios.

## Revisión por pantalla

Para cada fila registrar:
- Commit, perfil/plan, cuenta fixture y programa/contexto.
- Resultado escritorio y móvil.
- Acciones: abrir, editar, cancelar, guardar, reabrir y comprobar persistencia.
- Sincronización coach-atleta cuando corresponda.
- Datos vacíos, error, carga, reintento y permiso denegado.
- Gráfica: fuente real, unidades, fechas, datos faltantes y exportación.
- Evidencia de resultado, fallo exacto y próxima corrección.
- Estado: PENDIENTE → EN_REVISION → CORREGIR → APROBADO.

Compartir componentes entre perfiles y probar sus permisos, sin rediseñar siete
aplicaciones distintas. Repetir una prueba histórica solo por dependencia
afectada o regresión final necesaria. No preparar ZIP o guardas manuales nuevas
cuando un cambio versionado directo resuelve la misma tarea.

Bloqueo de salida: pérdida de datos, acceso cruzado, consentimiento ignorado,
guardado engañoso, botón operacional muerto o una app beta incompleta.
Advertencias de bundle y deuda sin efecto funcional se registran y priorizan,
sin tratarlas automáticamente como siete reconstrucciones.

## Hallazgos actuales concretos

- Women's legacy: 287 líneas; fases fijas por día, update directo de hormonal_data,
  sin flujo dedicado de consentimiento/historial; alerta promete ajustes
  inteligentes de entrenamiento/nutrición sin demostrar ejecución. Es trabajo
  residual real; no puede declararse completa por cambiar colores.
- ClientProfile conserva constructor de gráficas/series manuales; reemplazarlo
  por fuentes canónicas e historial. No presentar ejemplo como músculo medido.
- CoachSettings muestra cuatro entradas principales y contiene secciones COMM
  y LICENSE adicionales: comprobar acceso/navegación y retirar o integrar
  las duplicaciones, sin suponer que todo el contenido está accesible.
- Revisar la variante de selected_app_single de nutrición contra el valor real
  aceptado por onboarding/DB y el normalizador Core; no normalizar datos reales
  ni cambiar planes sin evidencia.

## Primer checkpoint implementado

- UpcomingSports.jsx compartido, español/inglés, tarjetas Running y Triatlón /
  Ironman, aviso que abre/cierra, aria-expanded/aria-controls y estado explícito.
- Atleta: tarjetas al final del portal. Coach/Super Admin: sección Mis Apps.
- Atajo de paleta de Super Admin abre SETTINGS; se retira el segundo editor
  desplegable. El editor único de Apariencia conserva changeTheme y persistencia.
- netlify.toml: npm run build, dist, Node 24, contexto beta. public/_redirects
  existente conserva fallback SPA.

Validación realizada:
- npm ci desde lockfile, sin modificar dependencias ni lockfile.
- Vite 8.2.1 build PASS, 2094 módulos. Variables públicas ficticias se usaron
  solo en el build local; no se publican artefactos compilados con esos valores.
- ESLint del componente nuevo, CoachDashboard y ClientDashboard: PASS.
- SuperAdmin: 13 errores + 1 warning preexistentes; comparación contra baseline
  confirma los mismos hallazgos y ninguna categoría/mensaje nuevo. No se afirma
  ESLint global limpio.
- netlify.toml parseado y fallback SPA verificado.
- Prueba DOM del componente PASS en español e inglés: abrir Running, cambiar
  a Ironman y cerrar; atributos de expansión coherentes, sin peticiones de red.
- Revisión de UI en navegador y sesiones reales: PENDIENTE. El intento local
  encontró navegador no instalado y descarga de navegador inválida; no se
  convierte una compilación en una prueba visual aprobada.
- No se aplicaron migraciones ni se alteraron datos o fotos.

## Orden urgente de ejecución

E0. Este checkpoint, matriz, build reproducible, rama candidata y hosting preparado.
E1. Revisión visual por superficies compartidas: Super Admin, coach/settings,
    atleta/detalle; corregir navegación, controles y gráficas mientras se verifica
    la matriz de planes. Conservar fuente funcional existente.
E2. Cerrar nutrición A2.5 y autoría UI; habilita Women's y analítica sobre planes.
E3. Women's completo y Disciplina/historial completo; desarrollar por contratos
    compartidos, registrar datos/consentimiento y comprobar sincronización.
E4. Aceptación por siete perfiles, revisión móvil, errores vacíos/reintentos,
    privacidad y publicación piloto Netlify.
E5. Mantener beta estable y continuar Running/Ironman en desarrollo.

Puede avanzarse UI mientras se cierran contratos; no serializar todas las pruebas
estructurales repetidas delante de cada ajuste visual.
No mover Women's o Disciplina a “En desarrollo” para afirmar beta terminada.

## Tiempo residual tras mover endurance fuera de beta

El plan anterior presupuestaba 132–230 h base, con 24–44 h para endurance.
El cambio autorizado deja 108–186 h base; con reserva 20%, ~130–225 h.
Equivale a 65–113 bloques de 2 h. Incluye historial numérico y Women/Disciplina
completas del contrato beta; no descuenta horas ficticias por este checkpoint.
Es estimación provisional, no velocidad medida ni promesa de fecha.

Una candidata técnica de revisión puede publicarse antes; la activación de
hosting suele ser una tarea corta una vez estén disponibles cuenta, entorno y
configuración, pero no equivale a la beta aceptada.
No reducir artificialmente el presupuesto cambiando nombres o eliminando
funciones no autorizadas. La V1 total no se abarata por mover endurance de fase.

## Netlify: acción externa pendiente

No se encontró conector de Netlify en la búsqueda de plugins. No se ha verificado
la cuenta, el proyecto ni un despliegue real en esta revisión.

Configurar en el proyecto Netlify ligado a este repo:
1. Conservar producción/main; habilitar branch deploy para beta.
2. Build: npm run build; directorio dist; Node 24.
3. Variables de cliente para ese contexto: VITE_SUPABASE_URL y
   VITE_SUPABASE_ANON_KEY (o clave pública compatible existente).
   No poner claves service_role en el navegador.
4. Autorizar la URL beta real en Supabase Auth para confirmación/recuperación;
   no reemplazar el Site URL de producción por una URL supuesta.
5. Desplegar candidata y probar URL directa de cada ruta, refresh, login,
   recuperación, modos, notificaciones y guardado real.
6. Registrar URL y deploy ID devueltos por Netlify. No inventar una URL publicada.

Una rama beta con commit no demuestra hosting activo ni entrega aceptada.

Fuentes:
- https://docs.netlify.com/deploy/deploy-types/branch-deploys/
- https://supabase.com/docs/guides/auth/redirect-urls
- Código y contratos leídos en baseline 49dd61b.
