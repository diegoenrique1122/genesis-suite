# Genesis — Mejoras visuales, historial numérico y estimación residual

Fecha: 31 de octubre de 2026, America/New_York.
Baseline revisado: d97aeea5722b61bec02fe64bed764d6c7f23d72b.
Rama: rebuild/core-architecture.

## Alcance de esta actualización

Petición del usuario: recuperar los acuerdos de mejora de Super Admin, coach,
atleta, pestañas, ventanas, configuración, temas y gráficas; incluir en beta
el Resumen Visual e Historial Eterno del Entrenador y sus seis análisis.
Excluir traslado, replicación e integración de imágenes con Cloudflare R2
u otro proveedor externo. Esta exclusión no elimina datos ni capacidades actuales.

El historial numérico deja de ser exclusivamente post-beta: se incorpora ahora a
la beta ampliada como Panel de Inteligencia Biomecánica y Metabólica.
El resto del antiguo Memory Vault no entra automáticamente en beta.
La propuesta posterior registrada en GENESIS_PHOTO_COMPRESSION_LIFECYCLE.md
actualiza el objetivo futuro: comidas 15 días, base inicial protegida y juego
vigente, con 7 días de gracia para el juego sustituido tras validar su sucesor.
La frecuencia de fotos de físico por defecto es 14 días. La retención permanece
post-beta en Supabase; la compresión requiere dimensionar su incremento antes
de añadirla a beta. No hay un nuevo proveedor.

Este documento cambia el plan; no implementa pantallas ni tablas.
Las estimaciones son juicio de ingeniería sobre código leído, no tiempos medidos.

## Acuerdos visuales recuperados

Fuentes: contrato C3B14.3C; memoria reconciliada; conversaciones recuperadas
del 25 de septiembre local / 26 de septiembre UTC; petición actual.
Reutilizar las implementaciones C4 y los contratos posteriores, conservando
las capacidades funcionales prometidas.

| Área | Criterio de entrega |
| --- | --- |
| Super Admin | Separar resumen, coaches, atletas, programas, solicitudes y administración; navegación consistente y detalle bajo demanda; evitar panel monolítico saturado. |
| Coach | Priorizar atletas que necesitan atención, aprobaciones, mensajes y programas por vencer; acceso a detalle por dominio. |
| Atleta | Inicio con tareas del día, plan vigente y siguiente acción; registro simple y progreso comprensible. |
| Configuración | Una sección Apariencia por contexto; tema personal y marca del coach son conceptos distintos, con permisos y herencia existentes. |
| Temas | Eliminar dos editores paralelos del mismo ajuste. Si queda atajo en cabecera, debe abrir la misma sección, no otra copia. |
| Botones | Cada control visible tiene destino y resultado verificables, estados de carga/error y permiso correcto. Retirar controles muertos o redundantes; ocultar incompletos hasta que funcionen. |
| Constructores arbitrarios | Sustituir editor de series gráficas inventadas y creador libre de botones por acciones útiles y métricas canónicas. |
| Ventanas/pestañas | Nombres comprensibles; modales con foco, cierre y recuperación; móvil sin acciones inaccesibles ni tablas que dominen el resumen. |
| Gráficas | Mostrar periodo, unidades, procedencia, cobertura, referencia de comparación y explicación; sin observaciones inventadas ni falsa continuidad entre huecos. |
| Jerarquía | Resumen → atención → acciones → detalle; máximo tres indicadores principales, una gráfica de resumen y tres en el detalle del atleta. |
| Apariencia profesional | Tipografía legible, espaciado, contraste y paleta compartidos; uso contenido de tarjetas y animación; no depender solo del color. |
| Exportación | CSV/Excel y tablas extensas en acciones secundarias; no convertir el panel en una hoja de cálculo. |
| Reutilización | Chart.js, shell, primitives, unidades, preferencias, permisos y servicios existentes; no iniciar otro sistema visual o biblioteca de charts. |

Los seis análisis se distribuyen entre pestañas, selectores y detalle, respetando
el límite de tres gráficas en el detalle completo; no apilar seis gráficos.
Propuesta: dos gráficos persistentes (peso/adherencia y rendimiento) y un tercer
espacio con selector de distribución de estímulo u horarios. Los demás análisis
usan texto, tabla compacta y señales con enlace a su evidencia.
Las barras por patrón serán la vista comparativa por defecto; un radar opcional
usa ejes y escala comunes, valores visibles y la misma fuente de datos.

## Comprobación de código realizada

Lectura dirigida al baseline; no se ejecutó la aplicación ni aceptación visual.

- SuperAdminDashboard.jsx: 1.307 líneas en la lectura actual (usar el número de
  líneas devuelto por la fuente si se vuelve a medir; el tamaño no mide avance).
  Existe selector ADMIN_THEMES en cabecera y otra selección en SETTINGS /
  Apariencia del Sistema. Ambos usan changeTheme. La duplicación reportada
  por el usuario se confirma en código.
- ClientProfile.jsx: 1.267 líneas; DEFAULT_CHART define valores manuales de
  ejemplo etiquetados “Masa Muscular (Kg)”, grupos y series editables.
  El editor sigue presente; sustituirlo por métricas reales. Estos valores no
  son mediciones de músculo del atleta.
- ClientDashboard.jsx: 523 líneas; usa la infraestructura visual compartida.
- CoachSettings.jsx: 643 líneas; separa preferencias y branding, pero mantiene
  estilo propio que debe armonizarse sin cambiar autoridad de marca o plan.
- CoachMonitoringPanel.jsx: 472 líneas; ya lee hábitos, comidas, sueño,
  pasos y entrenamiento, distinguiendo registros manuales.
- workoutPerformanceData.js: ya registra por serie repeticiones, carga y RIR
  opcionales, unidad KG/LB y referencia al ejercicio del snapshot.
- trainingHistoryService.js: ya lee athlete_training_sessions por atleta y
  programa, respetando RLS. No hace falta crear otro historial de entrenamiento.
- MonitoreoDisciplina.jsx: el payload actual conserva estado y path de cada
  comida; aún no registra por comida una hora de consumo y de captura fiables.
  Date.now en el nombre de archivo no es hora comprobada de ingesta.
  La subida marca status YES: hay que separar evidencia enviada de cumplimiento
  alimentario reportado para evitar que subir una foto equivalga a ingerir el plan.

Estos hallazgos reconocen trabajo existente y pendientes verificables. No
certifican que todos los botones estén rotos ni que todo lo anterior esté aceptado.

## Datos ligeros e historial duradero

Reutilizar como fuentes canónicas:
athlete_training_sessions + workout_snapshot + performance_data,
daily_logs, athlete_daily_metrics, versiones de nutrición aprobadas,
athlete_programs, preferencias de unidades y catálogo de ejercicios.

Agregar únicamente observaciones y eventos que falten. No duplicar cada sesión
ni guardar imágenes, base64 o snapshots de fotos en el historial numérico.
Además de números se requieren IDs, fechas, unidades, procedencia y revisiones:
son metadatos mínimos para interpretar y auditar los números.

Principios:
- Agregados diarios y semanales deterministas con versión de cálculo.
- Eventos por comida conservan si hubo evidencia, recepción servidor, fecha
  local, versión de plan, estado reportado y procedencia de los tiempos.
- Borrar un archivo no borra el evento de evidencia ni modifica el cumplimiento.
- Correcciones auditables y recomputación idempotente; no contar una misma foto,
  comida o sesión dos veces por reintento.
- Los totales semanales salen de registros fuente; no construir otra autoridad
  que compita con el ledger de entrenamiento.
- Peso corporal y promedio semanal con número de observaciones; no inventar
  pesajes de días sin registro. % grasa solo cuando se mide/registra, con método.
- Días entrenados y series por grupo/patrón; peso medio solo como contexto,
  con fórmula y denominador explícitos.
- Pasos y distancias distinguen reportado/medido/importado; no transformar pasos
  en kilómetros medidos ni inferir calorías ingeridas de fotos.
- Persistencia independiente de fotos y de la vigencia del programa, con
  lectura autorizada por relación coach-atleta y política explícita al cambiar
  de coach. No usar “eterno” para conceder acceso perpetuo a un excoach.
- Historial duradero mientras la cuenta y su política de conservación lo permitan;
  las solicitudes de borrado aplicables deben poder ejecutarse.
- Privacidad/RLS, corrección, exportación CSV/XLSX y ausencia de datos verificables.
- No prometer almacenamiento gratis o ilimitado: medir tamaño real e índices.

## Seis funciones incluidas en beta

### 1. Evidencia nutricional y tendencia corporal

Conservar la intención del “Índice de Honestidad Metabólica”, mostrando
“Evidencia nutricional y tendencia corporal”. El envío no mide honestidad.
Separar: comidas previstas, cumplimiento declarado, fotos recibidas y fotos
recibidas dentro de la ventana acordada.

Evidencia = comidas previstas con al menos una evidencia válida / comidas
previstas elegibles. Cumplimiento declarado tiene su propia fracción.
Mostrar cobertura y días observados. Usar semanas comparables y un umbral de
estancamiento definido/revisado por coach; no decidir con un pesaje aislado.

Ejemplos de texto:
- “Peso sin tendencia descendente y alta evidencia registrada. Revisar
  porciones, mediciones, actividad y plan con el atleta.”
- “Cobertura de evidencia baja. Confirmar adherencia antes de modificar el plan.”

No llamar “comidas fantasma”, no afirmar engaño ni recomendar automáticamente
recortar macros. Peso estable no prueba que la grasa esté estable.
El coach decide y sus cambios siguen revisión/versionado autorizados.

### 2. Volumen de carga y progreso

Volumen externo registrado = suma por serie de repeticiones × carga normalizada.
La fórmula series × repeticiones × peso solo aplica si todas las series
comparten esas repeticiones y carga. Unidad visible kg·repeticiones o
lb·repeticiones; no presentarlo como trabajo mecánico en joules.

Comparar el mismo ejercicio/variante/equipo y contexto, con cobertura de carga.
Separar calentamientos, series de trabajo, ejercicios sin carga registrada,
peso corporal, asistencia y mancuernas (convención de una/dos explícita).
No usar NULL como cero ni equiparar cargas entre máquinas distintas.
Grupos musculares secundarios no deben duplicar el tonelaje global.
Mapear ejercicio del snapshot a catálogo versionado y mostrar “sin clasificar”
cuando no hay mapeo confirmado.

Mayor volumen registrado no demuestra hipertrofia, fuerza máxima ni técnica.
Mostrarlo junto con repeticiones, carga, RIR y e1RM cuando corresponda.

### 3. Distribución del estímulo

Contar series de trabajo por patrón: empuje horizontal/inclinado,
tracción horizontal/vertical, dominante de rodilla, cadena posterior,
brazos/deltoides; permitir clasificación consistente y evitar doble conteo.
Separar series registradas de series que cumplen el criterio de esfuerzo.

El criterio operativo de “efectiva” (por ejemplo RIR reportado dentro de un
rango elegido) es una regla explicable del coach, no una medición fisiológica.
Si falta RIR, clasificar esfuerzo como desconocido, no como serie inefectiva.
Mostrar plan frente a ejecución y cobertura de clasificación.
Una diferencia entre patrones no diagnostica desequilibrio postural o lesión.
No imponer igualdad de volumen a patrones con objetivos distintos.

### 4. e1RM de ejercicios ancla

Usar Epley: carga × (1 + repeticiones / 30), etiquetado como estimación.
Registrar ejercicio/variante, equipo, unidad, fecha y serie de origen.
Seleccionar series de trabajo válidas con política de repeticiones y esfuerzo
(p. ej., 2–10 repeticiones y RIR bajo; 1 repetición se muestra como carga
registrada, sin inflarla con la fórmula). El rango es una decisión de producto
a validar, no una garantía universal de precisión.
Sin RIR no asumir que fue al fallo: omitir el récord estimado o marcar baja
comparabilidad según el contrato acordado antes de implementar.
Comparar solo variantes compatibles; Hack y sentadilla libre no son intercambiables.
No extrapolar ejercicios sin carga o registros incompletos.
No afirmar que estimar elimina el riesgo de lesión ni prescribir intentos máximos.

### 5. Horarios de comidas

Guardar por separado:
- received_at: recepción del servidor.
- captured_at: captura reportada por dispositivo, si existe.
- consumed_at: consumo reportado por el atleta, si existe.
- timezone y procedencia/calidad del tiempo.

No deducir consumo desde EXIF ni desde fecha del nombre del archivo.
Un envío de varias fotos al final del día no demuestra que se comieron juntas.
Mostrar captura/envío o consumo según la fuente, con etiquetas distintas.
Comparar con el horario acordado por el coach y visualizar distribución.
La regla 3–4 h no es un objetivo universal ni permite medir síntesis proteica.
Los datos históricos sin hora por comida permanecerán desconocidos.

### 6. Rendimiento y recuperación

Relacionar rendimiento de sesiones comparables con sueño reportado, estrés
(si se añade el campo), pasos y cobertura. Comparar el mismo ejercicio/variante
y esfuerzo, no promediar como equivalentes todas las cargas del gimnasio.

Texto: “Rendimiento menor coincidente con sueño reportado reducido. Revisar
recuperación y contexto”. Un umbral de 6 horas puede servir como regla operativa
visible/revisable, no diagnóstico ni causa probada.
No etiquetar fatiga central/neurológica o pérdida muscular desde esta correlación.
Sin observaciones suficientes mostrar “datos insuficientes”.
Toda adaptación de entrenamiento o dieta requiere aprobación del coach.

## Pruebas de aceptación del panel

1. Un borrado de foto de prueba conserva evento, fecha y agregado numérico.
2. Reintentos no duplican comidas, series, días ni volumen.
3. KG/LB dan resultados equivalentes tras conversión; cargas ausentes no son cero.
4. Clasificación y series secundarias no duplican totales.
5. Tendencias muestran cobertura, huecos y procedencia; e1RM solo en casos válidos.
6. Upload tardío no se interpreta como comida tardía.
7. Atleta y coach autorizados leen su historial; otro coach/atleta y acceso
   revocado se rechazan.
8. Cambio o fin de programa conserva historial sin abrir acceso no autorizado.
9. Gráficas y exportación coinciden con registros fuente y versión de cálculo.
10. Sin automatismos de diagnóstico, engaño, prescripción o aceptación de planes.

Reutilizar fixtures y pruebas existentes donde cubran el contrato. No repetir
baterías cerradas salvo cambios relevantes o regresión de release necesaria.

## Estimación residual beta

Una persona trabajando con ayuda de IA, mismo stack y alcance estable.
Incluye implementación, verificación focalizada y aceptación; excluye esperas
externas. Se reconoce Core, RLS, chat, evidencia, notificaciones, programas,
motor de entrenamiento, performance por serie, shell y nutrición A2.1–A2.4.
No se cuenta su construcción otra vez.

| ID | Lo existente y cambio residual | Horas mín.–máx. |
| --- | --- | ---: |
| NUT | A2.1–A2.4 reutilizados; A2.5 autenticada/concurrencia, autoría y revisión coach UI, selección y transición controlada | 12–22 |
| TRN | Motor, sesiones, per-set e historial reutilizados; cerrar calendario/plan frente a ejecución y criterios visibles residuales | 8–14 |
| DIS | daily_logs y monitoreo existentes; separar evidencia/adherencia, timestamps por comida, recuperación/estrés y procedencia | 6–12 |
| INT | Fuentes existentes; proyecciones ligeras, seis cálculos/señales, permisos históricos y CSV/XLSX, verificación de datos | 20–34 |
| WOM | Componente legacy y contratos existentes; consentimiento/revocación, historial, contexto nutrición/entrenamiento y revisión humana | 24–40 |
| END | Core/programas compartidos; metas, planes, sesiones manuales y progreso running/resistencia/triatlón sin conectores nuevos | 24–44 |
| UX | Shell/C4 reutilizados; módulos admin, coach, atleta/detalle, quitar duplicación de temas y controles, gráficas del panel, responsive | 22–36 |
| REL | Regresión integrada de roles/planes, pendientes de seguridad concretos, aceptación visual, RC, despliegue y smoke beta | 16–28 |
| **Subtotal residual** | **Incluye historial y panel nuevo** | **132–230** |
| **Reserva integración/correcciones 20 %** | **No se presenta como trabajo ya realizado** | **26,4–46** |
| **Total redondeado de planificación** | **80–140 bloques de 2 h** | **160–280** |

Separación para evitar doble conteo: DIS posee captura/procedencia; INT posee
proyecciones/cálculo/exportación; UX posee pantallas y gráficas; REL posee
aceptación transversal. Las validaciones propias del cambio ya están en cada fila.
Como atribución aproximada, el historial/panel agrega 28–48 h repartidas entre
DIS, INT y UX; esas horas YA están dentro del total, no se suman otra vez.

Confianza media-baja: lectura dirigida de fuentes y contratos, sin recorrer
cada flujo en navegador, sin tiempos de implementación nuevos medidos y con
incertidumbre importante en Women's, endurance y fronteras de integración.
Un fallo estructural o nuevas exigencias deben registrarse, no ocultarse dentro
de un cambio silencioso del calendario. El ahorro frente a rangos anteriores
se atribuye a reutilización identificada y desglose residual; no está medido.

Calibrar después de 3–5 jornadas con inicio/pausas/cierre y resultados concretos.
No descontar mecánicamente 2 h por cada mensaje o por cada día del calendario.

## Producto versión 1 completo sin R2

“Completo” se refiere al mapa de producto actual y sus integraciones acordadas,
no al fin del mantenimiento. Incluye beta e historial numérico ya presupuestados.
La beta usa actividad manual antes de conectores reales.

| Trabajo posterior a beta | Horas mín.–máx. |
| --- | ---: |
| Pagos reales, renovaciones, alta comercial y casos de ciclo de suscripción, sobre roles existentes | 24–40 |
| Wearables reales Apple/Android/Garmin/Samsung donde sea técnicamente soportado, autorizaciones, revocación, puente móvil cuando sea necesario y normalización | 70–130 |
| Cierre de comunidad/anuncios/patrocinios/insignias personalizados que aún falten, reutilizando chat y notificaciones | 18–30 |
| Cierre white-label, configuración y permisos comerciales residuales | 8–14 |
| Auditor IA y automatización asistida con aprobación, fallos/cuotas y trazabilidad | 12–22 |
| Retención/rotación de fotos y avisos/exportación en Supabase, sin R2 ni segundo proveedor | 12–20 |
| Operación de producción, observabilidad, recuperación, carga/performance, documentación y aceptación comercial | 32–52 |
| **Subtotal adicional** | **176–308** |
| **Con reserva del 20 %, redondeado** | **210–370** |
| **Total desde esta revisión, incluyendo beta** | **370–650** |

Integraciones proveedor y eventual publicación/distribución móvil tienen menor
confianza: acuerdos, acceso a APIs, requisitos de tiendas y hardware pueden
cambiar alcance. El rango es un escenario de ingeniería, no una cotización
cerrada ni una garantía de aceptación de terceros.

| Dedicación efectiva | Beta 160–280 h | V1 completa 370–650 h desde hoy |
| --- | --- | --- |
| 5 bloques de 2 h/semana | 16–28 semanas | 37–65 semanas |
| 10 bloques de 2 h/semana | 8–14 semanas | ~19–33 semanas |

No se publica un porcentaje global nuevo. Alcance y crédito de trabajo anterior
se mantienen visibles; los rangos se actualizan solo con cambios o evidencia.

## Secuencia de trabajo y memoria

1. Continuar A2.5 aprovechando laboratorio existente.
2. Completar nutrición UI y definir captura numérica/procedencia antes de las
   pantallas de análisis; conservar contratos y datos existentes.
3. Implementar analítica junto con refactor visual coach/detalle; reutilizar
   componentes para atleta/admin y unificar Apariencia.
4. Completar Women's y endurance sobre fuentes ya canónicas.
5. Ejecutar regresión necesaria y desplegar candidato de beta.

Definir aceptación por pantalla y cerrar lotes coherentes, sin ZIP ni comandos
frágiles repetidos donde el conector o un script existente resuelva el trabajo.
No imponer una fase genérica de automatización de 8–16 h.
Registrar pruebas aprobadas con commit/entorno y próxima tarea exacta.
Actualizar este documento, inventario y memoria cuando cambie el alcance.

## Fuentes

- docs/GENESIS_C3B14_3C_PRODUCT_REDUCTION_CONTRACT.md.
- docs/GENESIS_MASTER_CONTINUITY_RECONCILED.md.
- docs/GENESIS_BETA_EXPANDED_A1_INVENTORY.md.
- Archivos de código mencionados, leídos en d97aeea.
- Conversaciones recuperadas y petición del usuario del 31 de octubre.
- Morton et al., ensayo de entrenamiento 2016:
  https://pubmed.ncbi.nlm.nih.gov/27174923/
  El resultado no autoriza inferir hipertrofia individual a partir de tonelaje.
- Areta et al., ensayo agudo de distribución de proteína 2013:
  https://pubmed.ncbi.nlm.nih.gov/23459753/
  No convierte la hora de una foto en medición de síntesis proteica.
- Validación contextual de ecuaciones 1RM:
  https://pubmed.ncbi.nlm.nih.gov/32740290/
  La precisión depende del protocolo; e1RM debe etiquetarse como estimado.
