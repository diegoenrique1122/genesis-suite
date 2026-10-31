# Genesis OS — Memoria maestra reconciliada y registro de avance

Fecha de revisión: 31 de octubre de 2026, America/New_York.
Repositorio: diegoenrique1122/genesis-suite.
Rama canónica de trabajo: rebuild/core-architecture.
Baseline documental y de código revisado: 61037e6441921b101ada6dc83a3de860df023e60.

## Estado de esta entrega

Memoria incorporada al repositorio por autorización explícita del usuario el
31 de octubre de 2026. Este cambio documental añade la memoria y el aviso de
reconciliación al inventario, conservando las cifras anteriores como históricas.
El baseline de evidencia permanece fijado en 61037e6.

## Actualización de alcance — historial y mejoras visuales en beta (31 octubre)

Leer [GENESIS_BETA_VISUAL_ANALYTICS_PLAN.md](GENESIS_BETA_VISUAL_ANALYTICS_PLAN.md)
para los acuerdos visuales recuperados, seis análisis numéricos, criterios de
aceptación y desglose residual. El historial numérico y el Panel de Inteligencia
Biomecánica y Metabólica entran en beta por petición explícita del usuario.
El traslado/replicación de imágenes a R2 u otro proveedor externo queda excluido.

Planificación provisional: beta 160–280 h (80–140 bloques de dos horas);
V1 completa 370–650 h desde esta revisión, incluyendo beta. Ambos rangos
incluyen reserva de integración; se basan en trabajo residual identificado y
requieren calibración con jornadas reales. No sustituyen el avance acumulado
por un porcentaje de puertas ni restauran las estimaciones antiguas.
Las cifras y los alcances previos del cuerpo/anexos se conservan como historia.

## Propuesta posterior de fotos — 31 octubre

[Compresión y ciclo de vida](GENESIS_PHOTO_COMPRESSION_LIFECYCLE.md) registra
la idea nueva: WebP en cliente con comprobación de formato/calidad, comidas
15 días en lugar de 24 h, controles de físico cada 14 días y 7 días para
descargar el juego sustituido, protegiendo base inicial y juego vigente.
ZIP contiene fotos; Excel/CSV contiene datos e índice. El ahorro requiere
medición. Propuesta no implementada; no se han borrado fotos ni cambiado
presupuestos o alcance beta automáticamente. Supabase sigue como proveedor.

## Protocolo urgente vigente — 31 octubre

[GENESIS_BETA_EMERGENCY_RELEASE.md](GENESIS_BETA_EMERGENCY_RELEASE.md) es el
alcance de salida más reciente: revisar todos los perfiles/pantallas y completar
Women's Performance, Disciplina, nutrición, entrenamiento e historial numérico.
Running/Ironman se desarrollan después de beta y ahora muestran avisos
“En desarrollo”. La matriz inicial tiene 144 casos pendientes, no aprobaciones.

Ramas: beta para candidata/revisión; rebuild/core-architecture para desarrollo;
main conserva su función de producción. netlify.toml queda preparado, pero
hosting, pruebas autenticadas y aceptación completa siguen pendientes.
Estimación provisional actual: ~130–225 h para beta, derivada de retirar
24–44 h de endurance de la base anterior. No es una fecha prometida.

## Lectura obligatoria para continuar

Leer este documento junto con GENESIS_BETA_EXPANDED_A1_INVENTORY.md y
GENESIS_C3B14_3C_PRODUCT_REDUCTION_CONTRACT.md antes de proponer trabajo.
Conservar los cierres y las pruebas aprobadas. Retomar desde el primer pendiente
concreto; no reiniciar la arquitectura ni rehacer módulos por falta de contexto.

Esta revisión recupera requisitos de agosto, checkpoints, contratos y el historial
Git disponible. No equivale a ejecutar otra vez las pruebas ni certifica el estado
actual de producción. Las migraciones presentes y los commits prueban versionado;
los cierres históricos se atribuyen a sus fuentes.

## Corrección del avance y de las estimaciones

Genesis tiene una base desarrollada considerable. La representación 1/8 = 12,5 %
contaba únicamente puertas completas de la beta ampliada definida en octubre.
No incorporaba el crédito del Core, seguridad, chat, almacenamiento, notificaciones,
programas, interfaces y entrenamiento ya implementados. Las puertas tenían tamaños
distintos y descartaban todo avance parcial. Por ello no debe usarse como porcentaje
global del proyecto, del código, del esfuerzo realizado o del tiempo restante.
Lo mismo aplica a 1/12 = 8,3 % y 1/13 = 7,7 %.

El error fue cambiar alcance y criterio de medición sin un puente con las tablas
anteriores. La explicación no puede limitarse a “se agregaron funciones”: Women's
Performance, sincronización, roles, chat, insignias y marca blanca ya formaban parte
de los requisitos de agosto. Algunas funciones se profundizaron o requirieron
reemplazar implementaciones débiles. Running/triatlón aparece explícitamente en el
contrato posterior. Registrar cuándo aparece un requisito no demuestra por sí solo
cuándo se acordó por primera vez.

| Referencia recuperada | Medición/estimación publicada | Cómo interpretarla ahora |
| --- | --- | --- |
| Contexto maestro guardado el 31 de agosto | Global ~70 %; Core ~95 %; seguridad ~90 %; datos/storage 100 %; chat 100 %; restantes 40–65 h | Estimación histórica aproximada para aquel alcance; no porcentaje auditado ni presupuesto vigente. |
| Conversación del 16 de octubre local / 17 de octubre UTC | Parte A, beta privada para una atleta: 22 jornadas de 2 h = 44 h; margen mencionado de 8 h | Recuperada del historial de conversación; falta la tabla literal completa y su desglose. No asumir si el margen era adicional o incluido. |
| Inventario del 24 de octubre | Declara que 22 sesiones no cubren el alcance ampliado | Reconoce un cambio de alcance; no aporta una conciliación completa de horas por tarea. |
| Roadmap del 30 de octubre local | 1/8; beta 268–482 h; producto 588–1.112 h sin Vault / 648–1.222 h con Vault | Rangos provisionales; quedan suspendidos como pronóstico operativo hasta descontar trabajo existente tarea por tarea. |
| Propuesta de aceleración de esa conversación | Objetivo 210–390 h, con 8–16 h iniciales de automatización | Escenario hipotético, sin ahorro medido. No sumarlo al presupuesto ni tratarlo como nueva línea base. |

Tampoco corresponde volver al 70 % o a las 44 h como si siguieran vigentes.
No hay evidencia suficiente para publicar ahora otro porcentaje o fecha fiable.
El nuevo cálculo debe estimar el trabajo residual, reconociendo implementaciones
y pruebas existentes y evitando cobrar otra vez seguridad, historial o fundamentos.

## Origen del plan: qué se recuperó y qué falta

Fuente directa más antigua leída en esta revisión:
[Pasted text.txt, requisitos del 15/16 de agosto](https://chatgpt.com/library?file_id=libfile_60a7855c238c8191bdd14d0241941ae4&account_id=personal).

Incluye TrainerPro desde onboarding, nivel y objetivos, priorización muscular,
Simetría VIP, alternativas gym/home, diferencias básicas/Elite, personalización
del coach, Arquitecto, contexto femenino sincronizado, Disciplina, comidas,
agua, pasos, sueño, HRV/RHR, ritual de peso/fotos, chat privado/comunidad,
modo inmersivo, anuncios, upgrades, branding, recordatorios e insignias.
Estos requisitos históricos deben cruzarse con los contratos posteriores;
no se asumen implementados por estar escritos.

El historial recuperado describe una planificación inicial por fases 0–14:
auditoría, Core, normalización, registro, Arquitecto, TrainerPro, Simetría VIP,
contexto femenino, Disciplina, Coach Command Center, chat/comunidad, insignias,
white-label, Super Admin y QA. Esta enumeración es una reconstrucción del
historial recuperado, no una transcripción de la primera tabla de ejecución.

**Hueco documental explícito:** no se localizó el texto íntegro y literal de la
primera “tabla de ejecución maestra”, ni la tabla completa de las 22 jornadas.
No inventar filas, fechas ni cierres faltantes. Incorporar esas tablas conservando
sus nombres e identidad cuando se recuperen. Esta falta no invalida los cierres
técnicos posteriores.

Se leyeron además el esquema contextual del 20 de agosto y la matriz V4.0.
Son documentos históricos. Sus políticas abiertas de acceso no sustituyen
las migraciones de seguridad y las fronteras de autoridad posteriores.
Preservar la intención funcional V4/V5 sin restaurar permisos obsoletos.

## Tabla maestra reconciliada

“Cerrado histórico” significa que una fuente de continuidad registra su cierre.
“Versionado” significa que existe código/migración en Git; no prueba runtime.
Una aceptación pendiente no convierte todo el módulo en trabajo por construir.

| Bloque | Avance recuperado | Evidencia | Trabajo residual conocido |
| --- | --- | --- | --- |
| 001 — integridad del Core | Migración 001 presente; motor de planes, modos y entitlements implementado | 20260823170559; f35b6ac2; 3c125328; src/core | Verificar escenarios afectados al cierre beta; conservar Core existente. |
| 002A / 002B1 — fundamentos y autoridad | Migraciones presentes; 002B1 cerrado histórico | 20260823172708 / 20260823175742; contexto 31 agosto | Mantener guardas y revisar solo cambios que las afecten. |
| 002B2A / 002B2B — signup, identidad y RLS | Signup, users_master, perfiles, tablas operacionales y referidos cerrados históricos | 45208a69; migraciones 002b2a y 002b2b1–4 | Matriz final de roles/planes y hallazgos específicos pendientes. |
| 002B3 — chat y Realtime | Seguridad de chat y Broadcast cerradas históricamente | 134987d9; df96a098 | Aceptación integrada de la versión candidata; no reconstruir chat. |
| 002B4.A / B.1 — métricas y Disciplina | Pipeline diario, día local, check-ins y exportación de historial implementados | 3401ea4a; 06482625; 657dcbd9; 825c78a6 | Ampliar recuperación subjetiva y procedencia; simplificar interfaz. |
| 002B4.B.2 — insignias | Evaluación con autoridad servidor y lectura relacional implementadas | e6b8d44e; 72b9e25a; 392d9ae8 | Comprobar alcance residual de medallas personalizadas, sin asumir que todo está terminado. |
| 002B4.B.3 — Auditor IA | Implementación servidor y salida estructurada versionadas | 6945fd69; 965a93bc; ab28d0f8 | Último contexto de agosto: BLOCKED-EXTERNAL por cuota 429; no se recuperó cierre posterior de smoke 200. |
| 002B4.B.4 — monitoreo coach | RPC de actividad, radar y panel canónicos implementados | 4c75cd57; ede26c49; 365a5833 | Completar decisiones/gráficas sobre datos reales. |
| 002B5 — evidencia y branding | Cierre histórico: evidencia privada, URLs firmadas, branding público, legacy retirado | 3e0ca86f; 5031b66f; contexto 31 agosto | Política Memory Vault posterior; no repetir migración a buckets privados. |
| 002B6.A/B — onboarding e invitaciones | Fotos privadas, namespace global y autoridad de dominio cerrados | e712fff2; 330c0c9f; b5662133 | Preservar compatibilidad histórica y consentimientos reales. |
| 002B6.C / C1–C3 — ciclo de cuentas | Contención, preflight, ejecución, ledger/reconciliación y retiro de RPC legacy versionados | adb97a94; 2f13caa3; 848dc276; 0f71a097; a2760b58 | No declarar todas las pruebas cerradas solo por commits; conservar evidencia de cada subfase. |
| C3B1–C3B13 — frontera del atleta | Edge boundary, callers, pruebas no mutables y drafts reanudables implementados | checkpoint C3B7 d2a73c62; 9a7a7ebc; 72fae65d | Aceptación integrada residual; no desplegar/recrear la frontera por falta de memoria. |
| Programas canónicos | Activación coach, duración, estado y puente runtime implementados | 870fdbec; 9c888533; c375db00 | Usar flujo autorizado para casos reales de beta. |
| C3B14 — idioma, unidades y preferencias | Conversores, preferencias atleta/coach y localización implementados | 6eb1ebb9; 061575c0; ab4e288b; eeb7800a | Revisar pantallas nuevas y deuda residual, no rehacer fundamentos. |
| C3B14.2 — notificaciones y Push | Inbox, acciones exactas, suscripciones, ledger, fencing y sender implementados | 6fe6936c; 2085113e; f7e3ed8e; 68cd7d90; 6e418ad7; 1d26f391 | Existencia de sender no prueba entrega real en todos los dispositivos; conservar el pendiente si falta evidencia. |
| C3B14.3 / C4 — contrato y sistema visual | Contrato, shell, piloto atleta y capas de coach versionados; capas 1–2 con cierre explícito | 6639bab5; 7b58f33e; f58dda03; 7f0f163e; ef375948; 598950fa | Completar detalle atleta, dashboards y aceptación móvil; no iniciar diseño visual desde cero. |
| Trainer A/B.2 | Ciclo de vida, ejecución servidor, RPC y motor canónico centralizado implementados | 50a42d60; 094e7530; e95f36b5; df848c10 | Reutilizar motor y ledger existentes. |
| Trainer B.3 | Persistencia por serie, payload/UI y modelo comprobable implementados | d96eb031; 3162c4f9; fe3a192b; 92920276 | Completar únicamente los criterios residuales; la persistencia no está “sin empezar”. |
| Trainer B.3.5 | Historial y progresión histórica de solo lectura versionados | 73b9db823895ff2cee278bfec21e1389974f1b30; trainingHistoryService.js leído | Revisión de aceptación para alcance ampliado sin sobrescribir rutinas aprobadas. |
| A0 / A1 | Inventario ampliado y auditoría remota documentados | ee2eb0d5; 9b3673c6 | Son el inicio de una nueva pista de integración, no el inicio del proyecto. |
| Nutrición A2.1 | Fundación versionada instalada/auditada según inventario; 61 checks locales registrados | c36e45e1; 95e554d1; test local A21 | No recrear tablas; aprovechar contrato existente. |
| Nutrición A2.2 | Autoría/revisión autorizadas, 73 checks locales y cierre estructural remoto registrados | 28fc3d30; dbb48e1a; test local A22 | Interfaz coach y validación REST/concurrencia residual. |
| Nutrición A2.3 | Selección/lectura efectiva, 152 checks y auditoría remota registrados | bd4f9175; 73695e99; test local A23 | Validación autenticada entre sesiones reales. |
| Nutrición A2.4 | Lectura efectiva en Arquitecto implementada; ESLint/build registrados como aprobados | 2d3a3281; c9ffe43e; NutritionEffectivePlan.jsx leído | A2.5: atleta propietario, otro atleta, coach, estados y concurrencia; luego autoría UI/cutover. |
| Women's Performance | Requisito original; componente legacy existente; contrato de sustitución aprobado | requisitos agosto; contrato septiembre; inventario octubre | Consentimiento, historial, revocación, lectura autorizada y recomendaciones revisadas; no certificar motor legacy. |
| Running / resistencia / triatlón | Presente en contrato posterior; inventario A1 no identificó dominio/rutas dedicados | contrato de producto; inventario A1 | Implementación específica sobre Core existente; confirmar reutilización antes de estimar. |
| Wearables / recovery | Métricas y preferencias existen; syncWearableData se identifica como mock | contrato e inventario A1 | Datos manuales trazables en beta; conectores reales pendientes según alcance acordado. |
| Memory Vault / panel numérico | Propuesta original post-beta; actualización 31 octubre promueve historial numérico y seis análisis a beta, sin implementación certificada todavía | 29665dc2; d82bc2b9; GENESIS_BETA_VISUAL_ANALYTICS_PLAN.md | Panel/historial/exportación en beta; retención y rotación nuevas de fotos después, en Supabase; R2 excluido. |

Nota de fechas: el resumen de memoria recibido atribuía B.2 al 25 de octubre.
Git fecha df848c10 el 8 de octubre UTC. Para cronología técnica prevalece Git.
Los documentos A2.3/A2.4 usan 31 de octubre en parte del texto, mientras los
commits corresponden a la noche del 30 en Jacksonville. Registrar zona horaria.

## Estado operativo y ruta de continuidad

Baseline remoto leído: 61037e6. La copia Windows del usuario no se inspeccionó
en esta revisión; la última salida pegada confirmaba 29665dc. No asumir que ya
descargó los commits documentales posteriores.

Última fase de código: A2.4. Próxima prueba pendiente concreta: A2.5 autenticada.
Según el último inventario auditado, las tablas nutricionales remotas estaban
vacías; ese dato es histórico, no una consulta nueva del 31 de octubre.
Los fixtures de entrenamiento pertenecían al laboratorio local.
No interpretar cero filas en remoto como ausencia de código o pérdida del historial local.

A2.5 debe usar el laboratorio existente y los contratos ya instalados. Registrar
resultado esperado, resultado observado y fallo exacto; no volver a desarrollar
las migraciones A2.1–A2.3 ni sustituir su batería aprobada por una nueva desde cero.

Después, mantener el alcance de beta ampliada acordado: nutrición completa,
TrainerPro, Disciplina/recuperación manual, Women's Performance,
coach/admin, aceptación integrada y despliegue controlado. Running/triatlón
pasan después de beta por el protocolo urgente del 31 de octubre. La actualización del
31 de octubre incorpora el historial numérico y panel analítico a beta; la nueva
retención de fotos en Supabase queda posterior a beta y R2 está excluido.
No retirar funcionalidades para hacer coincidir una estimación.

## Cómo evitar trabajo repetido y estimar lo que falta

Cada tarea pendiente tendrá:
- ID y módulo.
- Criterio de aceptación.
- Implementación existente y evidencia reutilizable.
- Cambio residual concreto.
- Dependencias.
- Horas residuales estimadas y confianza.
- Tiempo real de inicio, pausas y cierre.
- Commit, prueba y resultado.
- Próximo paso exacto.

Registrar tres estados independientes: implementado, validado y aceptado para beta.
Una prueba histórica aprobada se conserva con su commit/entorno; repetirla solo
si cambia una dependencia relevante, aparece un fallo o forma parte de una
regresión de entrega necesaria. No extrapolar producción desde una prueba local.

Calcular horas efectivas = cierre − inicio − pausas.
Las cuatro horas del 30 de octubre fueron declaradas por el usuario, sin desglose
de subtareas. No asignarlas íntegramente a código ni descontarlas otra vez.

Reestimar desde tareas residuales y su dependencia, no desde porcentajes de puertas
ni número de commits. Medir varias sesiones comparables antes de extrapolar ritmo.
Mantener separados tiempo efectivo, espera externa y retrabajo por fallos del ejecutor.

La reutilización de scripts y fixtures existentes se aplica de inmediato.
Una inversión de automatización nueva debe responder a repetición observada;
no imponer primero 8–16 h genéricas si no resuelven un cuello de botella probado.

Al cerrar una jornada, actualizar este documento con cambios concretos y evidencia;
no reconstruir toda la memoria otra vez. Cualquier ampliación se añade como alcance
identificado, conservando la línea base anterior y el crédito de trabajo completado.

## Fuentes y límites

Fuentes directas leídas:
1. Requisitos de agosto: libfile_60a7855c238c8191bdd14d0241941ae4.
2. Matriz V4.0: libfile_55b9134e0aec81918651be597f5ad84c.
3. Esquema contextual 20 agosto: libfile_7e8608df50bc8191895465f4e99f373b.
4. Contexto maestro 31 agosto: libfile_4aee26ed40b88191b1e095daf6a4f8a8.
5. Cierre 002B6.B: libfile_4cd505614e6081919004f2a133450e6c.
6. Cierre C3B7: libfile_25a1f89fea588191948d7767a875fbd4.
7. Checkpoint visual: libfile_bd1be19db70081918bbb7172f1071768.
8. Contrato de producto e inventario actuales fijados en baseline 61037e6.
9. Árbol Git completo no truncado: 138 archivos, 55 migraciones SQL.
10. Historial Git devuelto: 198 commits alcanzables, del 17 agosto al 31 octubre UTC.
11. Lectura directa de trainingHistoryService.js y NutritionEffectivePlan.jsx.
12. Recuperación de conversaciones para fases iniciales y estimación de 22 jornadas;
    esas recuperaciones son contexto histórico, no sustituyen las tablas originales.

No se ejecutaron build, pruebas funcionales ni consultas nuevas de producción.
Esta revisión modifica únicamente documentación. Las cifras de commits,
archivos y migraciones son inventario de evidencia, no métricas de avance.

## Cápsula de reanudación

Retomamos Genesis OS en rebuild/core-architecture. Leer primero esta memoria
reconciliada y el inventario. Core, seguridad, Storage privado, chat, programas,
notificaciones, preferencias, shell y amplias partes de Trainer/Disciplina ya
existen. Nutrición A2.1–A2.3 tiene pruebas locales y auditorías documentadas;
A2.4 integra lectura en Arquitecto. Pendiente inmediato A2.5 autenticada local.
No usar 12,5 % como progreso global ni 268–482 h como pronóstico validado.
Conservar cierres; estimar solo trabajo residual. El historial numérico entra en
beta según GENESIS_BETA_VISUAL_ANALYTICS_PLAN.md; el ciclo nuevo de fotos queda
post-beta en Supabase, sin R2.
Registrar inicio/pausas/fin cuando el usuario realmente trabaje.
La primera tabla maestra literal sigue como hueco documental identificado.

## Anexo A — Historial Git recuperado

Orden antiguo a reciente. Fechas de autor en UTC; mensajes originales.
Un commit por sí solo no certifica cierre de aceptación.

| Fecha UTC | Commit | Mensaje |
| --- | --- | --- |
| 2026-08-17T21:16:59Z | [ddb0e3be](https://github.com/diegoenrique1122/genesis-suite/commit/ddb0e3be08dff6286a3911c8b189c075be6b38f2) | feat: Consolidacion de arquitectura V5.0 |
| 2026-08-17T22:45:49Z | [e5e8087d](https://github.com/diegoenrique1122/genesis-suite/commit/e5e8087d0a24941375cb005e0c28a2b3c0728c2f) | refactor: Foto Informe manual y desplegable |
| 2026-08-17T23:26:13Z | [39d98168](https://github.com/diegoenrique1122/genesis-suite/commit/39d981685eb122a6e73efb43dc85fd9c69cea3b8) | feat: Integración de Chat Realtime 1-a-1 y Tribu |
| 2026-08-18T02:37:53Z | [d8fb440a](https://github.com/diegoenrique1122/genesis-suite/commit/d8fb440afd170ed16ebf1c68ef3ae3d04c05a3eb) | feat: Pilar 1 completado - Grafica Gaspari y Hacks Metabolicos en Arquitecto |
| 2026-08-18T02:57:45Z | [36ff5238](https://github.com/diegoenrique1122/genesis-suite/commit/36ff5238ed740c1fa80bfbc2997f641dddaa0a6f) | feat: Integración de Chat Realtime 1-a-1 y Tribu |
| 2026-08-18T13:07:05Z | [7725a2db](https://github.com/diegoenrique1122/genesis-suite/commit/7725a2dbb5f8aaa7a5ff2169556cedc173ca4f8d) | feat: Integración de Chat Realtime 1-a-1 y Tribu |
| 2026-08-18T13:17:32Z | [e416d6f4](https://github.com/diegoenrique1122/genesis-suite/commit/e416d6f472fbcdca3d3d882e6452fb92a6d0930c) | feat: Integración de Chat Realtime 1-a-1 y Tribu |
| 2026-08-18T13:26:57Z | [6963ddd2](https://github.com/diegoenrique1122/genesis-suite/commit/6963ddd2a52e04a65c22ba63645bf700cda975ab) | feat: Editor de Calendario Nutricional Semanal por dia en Panel Coach |
| 2026-08-19T02:34:11Z | [ad9a6ad7](https://github.com/diegoenrique1122/genesis-suite/commit/ad9a6ad781b5e1255d8ed1d7e28b60837481cfda) | feat: Integración de Chat Realtime 1-a-1 y Tribu |
| 2026-08-21T00:57:58Z | [11ef5e4c](https://github.com/diegoenrique1122/genesis-suite/commit/11ef5e4cf2f5ceaf19d80313e0f3eafdf78af618) | feat: Integración de Chat Realtime 1-a-1 y Tribu |
| 2026-08-21T01:10:19Z | [12fb4ff2](https://github.com/diegoenrique1122/genesis-suite/commit/12fb4ff208477fd69b77fca5aeb35b0430ad4d1d) | feat: Integración de Chat Realtime 1-a-1 y Tribu |
| 2026-08-23T02:26:33Z | [a297e8b4](https://github.com/diegoenrique1122/genesis-suite/commit/a297e8b46f9d20e5d18cce392511807bad6f2059) | feat: Integración de Chat Realtime 1-a-1 y Tribu |
| 2026-08-23T05:13:11Z | [270151a3](https://github.com/diegoenrique1122/genesis-suite/commit/270151a32b3bf2e423681c7ba1a0dd75b557eafb) | feat: Integración de Chat Realtime 1-a-1 y Tribu |
| 2026-08-23T13:17:18Z | [146c1b19](https://github.com/diegoenrique1122/genesis-suite/commit/146c1b19dd52b540318e8ed91f38c9d71549e6cf) | fix: añadir regla de redirects para Netlify |
| 2026-08-23T16:20:29Z | [59f57ebc](https://github.com/diegoenrique1122/genesis-suite/commit/59f57ebcfbc040b08f04aea1cf6cd3c349f46b25) | backup local changes before core reconstruction |
| 2026-08-23T16:48:38Z | [f35b6ac2](https://github.com/diegoenrique1122/genesis-suite/commit/f35b6ac2afcc96189d639be5507882a692d41379) | build Genesis Core plans modes and entitlements |
| 2026-08-23T17:20:11Z | [3039bb7e](https://github.com/diegoenrique1122/genesis-suite/commit/3039bb7e0c082ba107f27dd64a0924fb5cbddff9) | fix gender normalization and secure athlete invite resolution |
| 2026-08-23T17:50:56Z | [3c125328](https://github.com/diegoenrique1122/genesis-suite/commit/3c125328fb7fa0903d274c1a341b0b315b6fdd71) | rebuild genesis access engine and secure athlete onboarding |
| 2026-08-23T18:31:07Z | [573e6242](https://github.com/diegoenrique1122/genesis-suite/commit/573e62421da0d9a22c5359ced85bb22adffbc7fa) | secure immersive mode and move athlete AI server side |
| 2026-08-23T19:52:53Z | [45208a69](https://github.com/diegoenrique1122/genesis-suite/commit/45208a6998d6b770a99be759fdfad0651f425ada) | secure signup and remove browser Gemini client |
| 2026-08-23T20:12:40Z | [2dbefe75](https://github.com/diegoenrique1122/genesis-suite/commit/2dbefe75746f750c85b44b79482b3b61d427f363) | upgrade SheetJS to patched version |
| 2026-08-23T20:30:24Z | [6945fd69](https://github.com/diegoenrique1122/genesis-suite/commit/6945fd69e9363a1fe3bae8e62229a94af2db1fb6) | version Auditor IA V2 edge function |
| 2026-08-23T20:40:53Z | [12c59ecb](https://github.com/diegoenrique1122/genesis-suite/commit/12c59ecb20190402003518aa3181dbaacf930cb6) | finalize Auditor IA V2 frontend |
| 2026-08-23T20:49:08Z | [30e1c826](https://github.com/diegoenrique1122/genesis-suite/commit/30e1c82685a59c2c7436af231b61a30872acf9ee) | version Genesis 002B2B authority migration |
| 2026-08-23T20:49:22Z | [6b063c21](https://github.com/diegoenrique1122/genesis-suite/commit/6b063c21c2378eb19ea1caaaa4f0723a66317e3c) | version Genesis 002B2B profile RLS migration |
| 2026-08-23T20:49:35Z | [32ea9f29](https://github.com/diegoenrique1122/genesis-suite/commit/32ea9f2902bb85be413625fca5cb2e321e6094a0) | version Genesis 002B2B operational RLS migration |
| 2026-08-23T20:50:04Z | [f8ac00fc](https://github.com/diegoenrique1122/genesis-suite/commit/f8ac00fc343b638bb9fde4e5a8b700881efe1194) | preserve direct B2B referral visibility |
| 2026-08-24T20:04:35Z | [54adce4d](https://github.com/diegoenrique1122/genesis-suite/commit/54adce4d2dced6c3a4c689f7af3f028c08b1e66e) | align 002B2B3 migration version with Supabase |
| 2026-08-24T20:04:39Z | [f259ba6b](https://github.com/diegoenrique1122/genesis-suite/commit/f259ba6b6e2096a60a1708501cd30e6149a19bba) | remove drifted 002B2B3 migration filename |
| 2026-08-24T20:04:47Z | [a6e52f9f](https://github.com/diegoenrique1122/genesis-suite/commit/a6e52f9f66b10c60c110488d3d4a5a0201653d07) | align 002B2B4 migration version with Supabase |
| 2026-08-24T20:04:53Z | [6fbbd763](https://github.com/diegoenrique1122/genesis-suite/commit/6fbbd7636106cc28efd466d5b1d784917f94995a) | remove drifted 002B2B4 migration filename |
| 2026-08-24T20:11:23Z | [134987d9](https://github.com/diegoenrique1122/genesis-suite/commit/134987d9aec1ea9a0127b3e51a4d32c5b9773833) | secure Genesis chat and realtime authority |
| 2026-08-24T20:13:00Z | [ddda1f70](https://github.com/diegoenrique1122/genesis-suite/commit/ddda1f700dd443b2e226f96406f6a3833d8f14cb) | harden chat client for server-authoritative realtime |
| 2026-08-24T20:39:06Z | [abfb931b](https://github.com/diegoenrique1122/genesis-suite/commit/abfb931b3a289267338da6a85cbb9aa67564d364) | add secure broadcast realtime migration for Genesis chat |
| 2026-08-24T20:45:44Z | [015168e4](https://github.com/diegoenrique1122/genesis-suite/commit/015168e4ea7449dd3f1b129052701098f87485d0) | fix restrictive realtime policy syntax |
| 2026-08-24T22:12:38Z | [df96a098](https://github.com/diegoenrique1122/genesis-suite/commit/df96a0986cdda37e5ccff2f9c728a5243b597cc1) | switch Genesis Network to secure Broadcast realtime |
| 2026-08-25T00:30:30Z | [03ca1b3e](https://github.com/diegoenrique1122/genesis-suite/commit/03ca1b3eb5b302d0df998078d841bb6bcc475a1d) | secure telemetry schedules and daily logs |
| 2026-08-25T00:39:28Z | [a389a3ac](https://github.com/diegoenrique1122/genesis-suite/commit/a389a3ac232e0de57fae65682c3275fc03a18519) | remove residual permissive metrics policies |
| 2026-08-25T00:59:27Z | [3401ea4a](https://github.com/diegoenrique1122/genesis-suite/commit/3401ea4a2ee1ce84ffb29e180d5332a9f12f6aed) | add canonical daily discipline pipeline |
| 2026-08-25T01:00:22Z | [06482625](https://github.com/diegoenrique1122/genesis-suite/commit/06482625b13d6f868f6da3b97b2a18e210f30d25) | connect discipline UI to canonical daily logs |
| 2026-08-25T01:00:40Z | [657dcbd9](https://github.com/diegoenrique1122/genesis-suite/commit/657dcbd9ad3f6ad10d11a7e3838f69349ad863a2) | include discipline history in athlete export |
| 2026-08-25T01:11:07Z | [f8a386b6](https://github.com/diegoenrique1122/genesis-suite/commit/f8a386b6c7f24da285e1a4665e1d9d70d46b461e) | fix daily discipline upsert ambiguity |
| 2026-08-25T01:22:00Z | [e6b8d44e](https://github.com/diegoenrique1122/genesis-suite/commit/e6b8d44e434002a263d67558cf4b5b1cc5fe6fcf) | secure badge authority and server evaluation |
| 2026-08-25T01:22:16Z | [72b9e25a](https://github.com/diegoenrique1122/genesis-suite/commit/72b9e25af2c69b979589ff26f46aa943644c9a79) | move badge evaluation behind secure rpc |
| 2026-08-25T01:22:53Z | [392d9ae8](https://github.com/diegoenrique1122/genesis-suite/commit/392d9ae859de55a68780552c913abf89ee029dc0) | read Fenix badge from authoritative backend |
| 2026-08-25T01:29:11Z | [eb8af3a2](https://github.com/diegoenrique1122/genesis-suite/commit/eb8af3a2458b213881af1aa3950cd07f2f4e67bf) | use validated local timezone for discipline day |
| 2026-08-25T01:30:43Z | [825c78a6](https://github.com/diegoenrique1122/genesis-suite/commit/825c78a66ca08fe7debe3e9289102d624fcd57e6) | align discipline UI with validated local day |
| 2026-08-25T01:39:32Z | [965a93bc](https://github.com/diegoenrique1122/genesis-suite/commit/965a93bc2be532122f1f7616039d05243a656a76) | integrate canonical discipline into AI auditor |
| 2026-08-25T01:58:47Z | [061e4609](https://github.com/diegoenrique1122/genesis-suite/commit/061e4609d48b0f0233e6e5ba25f2237cfbf268ec) | harden AI auditor against truncated responses |
| 2026-08-25T02:11:27Z | [84283d0d](https://github.com/diegoenrique1122/genesis-suite/commit/84283d0dd8bd9fb9765bbc876405f4771e66193b) | make AI auditor concise and structured |
| 2026-08-25T02:19:12Z | [ab28d0f8](https://github.com/diegoenrique1122/genesis-suite/commit/ab28d0f8f71a08f31df6dffb68dcc7a1ab5f607a) | fix Gemini structured output configuration |
| 2026-08-25T02:32:57Z | [d05d5988](https://github.com/diegoenrique1122/genesis-suite/commit/d05d59887dba2baf16c768a7086b9eb1a77f9604) | add canonical coach monitoring panel |
| 2026-08-25T02:41:49Z | [365a5833](https://github.com/diegoenrique1122/genesis-suite/commit/365a5833149c6fbb3e53d2e94c7c3186616a4f98) | integrate canonical coach monitoring panel |
| 2026-08-25T21:00:53Z | [18003644](https://github.com/diegoenrique1122/genesis-suite/commit/18003644c502c3947f0c7adaebb9b621c38d7880) | remove legacy adherence score from coach profile |
| 2026-08-25T21:07:03Z | [4c75cd57](https://github.com/diegoenrique1122/genesis-suite/commit/4c75cd57afa3ca2a556a7035bbefb337ab710aa3) | add canonical coach roster activity rpc |
| 2026-08-25T21:22:13Z | [ede26c49](https://github.com/diegoenrique1122/genesis-suite/commit/ede26c49124b89dd90ad4c04fefcd1caa6a2e079) | connect coach radar to canonical activity |
| 2026-08-25T21:26:58Z | [e66df064](https://github.com/diegoenrique1122/genesis-suite/commit/e66df0649fce2b82ea4e681002bb497bbb0a18e2) | contain anonymous storage writes |
| 2026-08-25T21:35:02Z | [6bb50497](https://github.com/diegoenrique1122/genesis-suite/commit/6bb50497548a9aafd34d2cbdbc4c268115673eae) | prepare private athlete evidence paths |
| 2026-08-26T00:31:36Z | [63c66e93](https://github.com/diegoenrique1122/genesis-suite/commit/63c66e93408b4f4d69a3e03fc845c327dc0d8496) | add private evidence signed url service |
| 2026-08-26T01:18:00Z | [5203094e](https://github.com/diegoenrique1122/genesis-suite/commit/5203094edc626b0840dc7e26f92a952b04af35a3) | use signed urls for athlete progress photos |
| 2026-08-26T01:46:47Z | [a048bce8](https://github.com/diegoenrique1122/genesis-suite/commit/a048bce8e4b65302295700970ba05b3a26e3f022) | store discipline meal evidence by private path |
| 2026-08-26T02:21:18Z | [fa3d990f](https://github.com/diegoenrique1122/genesis-suite/commit/fa3d990fc521b125ed329d7b520aee25faeee7da) | use signed urls for meal evidence |
| 2026-08-26T02:23:39Z | [58b587b7](https://github.com/diegoenrique1122/genesis-suite/commit/58b587b7d1dc22d2cc6a50f41446b3c11ac8fa99) | add canonical public brand assets bucket |
| 2026-08-26T02:27:00Z | [17f7ab7b](https://github.com/diegoenrique1122/genesis-suite/commit/17f7ab7b3bc317b7333d7b0bdb0157acd52c4664) | fix storage policy owner role for brand assets |
| 2026-08-26T02:52:36Z | [7e36c07e](https://github.com/diegoenrique1122/genesis-suite/commit/7e36c07e7539367a3e11cd09db275469afdacb2f) | fix hosted storage brand asset setup |
| 2026-08-26T21:22:52Z | [a16d0746](https://github.com/diegoenrique1122/genesis-suite/commit/a16d074625f9f277273cad1d4b87043f2422b34b) | move branding uploads to canonical storage |
| 2026-08-27T00:08:43Z | [3e0ca86f](https://github.com/diegoenrique1122/genesis-suite/commit/3e0ca86f1b0bd92b09c63a6d9eed438e1262d545) | complete private athlete evidence cutover |
| 2026-08-27T00:11:41Z | [67ec6a50](https://github.com/diegoenrique1122/genesis-suite/commit/67ec6a502db61895f93a831f41a0e3ee393af390) | normalize private cutover migration encoding |
| 2026-08-27T02:07:39Z | [5031b66f](https://github.com/diegoenrique1122/genesis-suite/commit/5031b66f748d992e4c8170ca8f1e830ac5743a2d) | contain and retire legacy storage |
| 2026-08-27T02:33:31Z | [7875cf49](https://github.com/diegoenrique1122/genesis-suite/commit/7875cf4979b8a956592d7f9173ad4b8e1a0f69f8) | harden onboarding authority |
| 2026-08-30T02:12:06Z | [e712fff2](https://github.com/diegoenrique1122/genesis-suite/commit/e712fff20facc1545130057661888485874d30fe) | secure onboarding private evidence paths |
| 2026-08-30T03:20:46Z | [330c0c9f](https://github.com/diegoenrique1122/genesis-suite/commit/330c0c9ff92aeea5c1d144b1e6bf0925fbb523af) | enforce global invite authority and restore migration history |
| 2026-08-31T01:59:14Z | [b5662133](https://github.com/diegoenrique1122/genesis-suite/commit/b5662133e5a6cae4dc70ca92a2155cb87bc466d9) | enforce athlete domain authority |
| 2026-09-01T00:20:38Z | [adb97a94](https://github.com/diegoenrique1122/genesis-suite/commit/adb97a945c980be0e5d52eb760072213ee1373aa) | contain account lifecycle deletion surface |
| 2026-09-01T00:45:53Z | [16741cfe](https://github.com/diegoenrique1122/genesis-suite/commit/16741cfe9311231f82cbd7632d24d71195df8303) | add account lifecycle session preflight |
| 2026-09-01T01:47:04Z | [2f13caa3](https://github.com/diegoenrique1122/genesis-suite/commit/2f13caa3f58a931decaeb657a105d72059576ad7) | implement account lifecycle execution boundary |
| 2026-09-01T23:35:34Z | [5c2c1768](https://github.com/diegoenrique1122/genesis-suite/commit/5c2c1768c71c59d4ffe2e6cf4c84df4d9ef948b8) | route superadmin lifecycle actions through edge boundary |
| 2026-09-02T00:19:07Z | [17e59563](https://github.com/diegoenrique1122/genesis-suite/commit/17e5956365403488f170f8c018e24ca6088e7d63) | fix lifecycle actor claim extraction |
| 2026-09-02T01:27:14Z | [c88dcafe](https://github.com/diegoenrique1122/genesis-suite/commit/c88dcafe56e8812fb3cda234409ef115ab5945b8) | route coach approvals through lifecycle boundary |
| 2026-09-02T01:38:59Z | [01bc4617](https://github.com/diegoenrique1122/genesis-suite/commit/01bc4617d2655e987bad18d34613c4e4192a31e2) | lock account root profile deletion paths |
| 2026-09-02T02:16:19Z | [6f258a26](https://github.com/diegoenrique1122/genesis-suite/commit/6f258a26bb48819edbfd0cf75cfcd47378377d24) | enforce Genesis registration metadata contract |
| 2026-09-02T03:12:06Z | [848dc276](https://github.com/diegoenrique1122/genesis-suite/commit/848dc276a4cdd1198f8e5e0d400c91a9f2e77472) | add durable account deletion ledger |
| 2026-09-02T20:11:42Z | [0f71a097](https://github.com/diegoenrique1122/genesis-suite/commit/0f71a097d359a9e56bff539ebf08897b83a4f672) | add resumable account deletion reconciliation |
| 2026-09-03T01:07:42Z | [a2760b58](https://github.com/diegoenrique1122/genesis-suite/commit/a2760b58d4ab8eeeddeb197b728f70993cf1e458) | retire legacy account lifecycle RPCs |
| 2026-09-03T01:30:43Z | [9b0e9810](https://github.com/diegoenrique1122/genesis-suite/commit/9b0e98105666fca6f57adda0527cb22ce2a4f0d1) | run browser RPCs under caller RLS |
| 2026-09-03T01:49:32Z | [af68fb35](https://github.com/diegoenrique1122/genesis-suite/commit/af68fb356cb0d38f9586fbaad6b50dd9f6090268) | add service-only athlete privilege boundary |
| 2026-09-03T02:17:52Z | [2bd4e6dc](https://github.com/diegoenrique1122/genesis-suite/commit/2bd4e6dce95a75d4e2b02c0537aea7714625f623) | add authenticated athlete privilege boundary |
| 2026-09-03T20:17:52Z | [7d641cbe](https://github.com/diegoenrique1122/genesis-suite/commit/7d641cbedd60fd78ddb9ad0d637e33e536865ef5) | refactor(security): route athlete operations through edge boundary |
| 2026-09-03T20:40:55Z | [13433ba2](https://github.com/diegoenrique1122/genesis-suite/commit/13433ba20cf00a31f0356ca3c2a1d09c65485999) | fix(lint): remove unused React import |
| 2026-09-03T21:00:00Z | [d2a73c62](https://github.com/diegoenrique1122/genesis-suite/commit/d2a73c62b21018049cfd48abc40483eb0bf9a4b0) | chore(tooling): pin Supabase CLI |
| 2026-09-06T01:33:35Z | [9a7a7ebc](https://github.com/diegoenrique1122/genesis-suite/commit/9a7a7ebccf9541ce89ed44d5883b91c947e300c1) | fix(security): revoke legacy athlete RPC access |
| 2026-09-06T14:01:31Z | [72fae65d](https://github.com/diegoenrique1122/genesis-suite/commit/72fae65d7257ca46538e765e337a37372eedfd2e) | feat(onboarding): persist resumable athlete drafts |
| 2026-09-06T15:39:51Z | [870fdbec](https://github.com/diegoenrique1122/genesis-suite/commit/870fdbec4cea68c027bd64aa61c5f3f7c7703fae) | feat(c3b14): add coach-controlled program activation |
| 2026-09-06T23:46:19Z | [9c888533](https://github.com/diegoenrique1122/genesis-suite/commit/9c8885330e06f2b877e613734b080c0ef7bcd4d2) | feat(c3b14): show dynamic athlete program status |
| 2026-09-07T00:17:00Z | [b4bcbc2d](https://github.com/diegoenrique1122/genesis-suite/commit/b4bcbc2d1e8dc018ac05e364250da8540b0aa445) | feat(c3b14): add locale and unit preferences |
| 2026-09-07T00:23:07Z | [48b0074c](https://github.com/diegoenrique1122/genesis-suite/commit/48b0074c991f531829985210d2cf5db53e5769ee) | feat(c3b14): add canonical measurement converters |
| 2026-09-07T00:23:15Z | [a62a8f6f](https://github.com/diegoenrique1122/genesis-suite/commit/a62a8f6f660350c3eeadc2fa0dc52c4057a5d365) | feat(c3b14): support athlete unit preferences |
| 2026-09-07T00:24:47Z | [1c6c6a85](https://github.com/diegoenrique1122/genesis-suite/commit/1c6c6a8572f65998815a90a16236367310de7d3f) | fix(c3b14): restore complete athlete onboarding component |
| 2026-09-07T00:25:09Z | [c82def81](https://github.com/diegoenrique1122/genesis-suite/commit/c82def813696f7ae4d2daa8048c1b418f0e6722d) | revert(c3b14): remove unvalidated measurement module |
| 2026-09-07T00:28:13Z | [6eb1ebb9](https://github.com/diegoenrique1122/genesis-suite/commit/6eb1ebb9d654af5bf5d0c74263e833d1c94fd4fe) | feat(c3b14): add verified measurement conversions |
| 2026-09-07T00:55:09Z | [2f8e895f](https://github.com/diegoenrique1122/genesis-suite/commit/2f8e895f9c1854bd0e3f532723150a68234826a1) | feat(c3b14): support athlete metric and imperial onboarding |
| 2026-09-07T00:58:10Z | [8b6f311e](https://github.com/diegoenrique1122/genesis-suite/commit/8b6f311e79cd68f7dfd87c4e6f244c0b262313ab) | feat(c3b14): add coach operational preferences |
| 2026-09-07T01:02:34Z | [01f592e1](https://github.com/diegoenrique1122/genesis-suite/commit/01f592e12dcb70716b1638d5b0eb12fa8c43c2b8) | feat(c3b14): display athlete measures in coach units |
| 2026-09-08T00:47:46Z | [ae6ba37f](https://github.com/diegoenrique1122/genesis-suite/commit/ae6ba37fe1be022bd3a88cf7d2eddb4303017b6c) | feat(c3b14): add bilingual public entry foundation |
| 2026-09-08T01:16:30Z | [c912c76d](https://github.com/diegoenrique1122/genesis-suite/commit/c912c76db8ad42732a1636c660708c73a3849c19) | fix(c3b14): improve language selector touch targets |
| 2026-09-08T01:30:01Z | [061575c0](https://github.com/diegoenrique1122/genesis-suite/commit/061575c0dfcd91575ca39e5f1f137dad66798459) | feat(c3b14): add athlete language and unit preferences |
| 2026-09-08T02:08:00Z | [6bcc66a7](https://github.com/diegoenrique1122/genesis-suite/commit/6bcc66a747ec647feb26c9076a7935772a7aa93c) | feat(c3b14): localize athlete portal and access screens |
| 2026-09-08T02:21:45Z | [fb5596d5](https://github.com/diegoenrique1122/genesis-suite/commit/fb5596d51b3238f0720d9c575ad8729a0fbd2471) | feat(c3b14): localize chat interface |
| 2026-09-08T02:32:17Z | [c43a94c4](https://github.com/diegoenrique1122/genesis-suite/commit/c43a94c4cac6fe8b21386a480ac4389e328a4129) | feat(c3b14): add super admin locale selector |
| 2026-09-08T02:32:25Z | [bd883c6c](https://github.com/diegoenrique1122/genesis-suite/commit/bd883c6ccde122f8b1477e2e8ef033e4c52317c0) | feat(c3b14): add coach locale selector |
| 2026-09-08T02:32:33Z | [8020e29f](https://github.com/diegoenrique1122/genesis-suite/commit/8020e29fdc0ae92fab96dd62ae09cd3ff58ec193) | fix(c3b14): persist coach locale in active context |
| 2026-09-08T02:36:51Z | [40b2d6f5](https://github.com/diegoenrique1122/genesis-suite/commit/40b2d6f56bd1e4532f523225bb0999e23d6810e0) | fix(c3b14): add context-aware locale toggle sizing |
| 2026-09-08T02:37:50Z | [8c912bcf](https://github.com/diegoenrique1122/genesis-suite/commit/8c912bcfcdf87c3fc9265f7f0c3792e698ca52a1) | fix(c3b14): compact super admin locale control |
| 2026-09-08T02:37:57Z | [93d5c140](https://github.com/diegoenrique1122/genesis-suite/commit/93d5c14084ad50ad1014de81779bb6a9beaa74ea) | fix(c3b14): compact coach locale control |
| 2026-09-08T02:39:19Z | [af5187d2](https://github.com/diegoenrique1122/genesis-suite/commit/af5187d201d31ea78a94e3d6575a467b69a9cc21) | fix(c3b14): align locale button hit area with visual size |
| 2026-09-08T02:47:11Z | [ab4e288b](https://github.com/diegoenrique1122/genesis-suite/commit/ab4e288bb247595fdc72639cf7f2bb5edf58a3f5) | feat(c3b14): localize coach dashboard interface |
| 2026-09-08T02:50:00Z | [eeb7800a](https://github.com/diegoenrique1122/genesis-suite/commit/eeb7800abbddd89cd57224b4cec62ca75a835363) | feat(c3b14): localize super admin dashboard interface |
| 2026-09-08T02:50:45Z | [a36b1166](https://github.com/diegoenrique1122/genesis-suite/commit/a36b11661bd02f0e135324e429810b47ba9731c7) | fix(c3b14): complete coach dashboard translations |
| 2026-09-08T02:51:02Z | [20308b00](https://github.com/diegoenrique1122/genesis-suite/commit/20308b003ceb11443b3d21272865d80ad4505257) | fix(c3b14): complete super admin dashboard translations |
| 2026-09-08T02:51:47Z | [23c59661](https://github.com/diegoenrique1122/genesis-suite/commit/23c59661a5aaaa51bf5456ebc46db8c2351a9050) | fix(c3b14): translate super admin elite code label |
| 2026-09-08T03:00:25Z | [becfaae6](https://github.com/diegoenrique1122/genesis-suite/commit/becfaae60f23ceebec1e96f3c3d7ca4feeb53698) | fix(c3b14): integrate athlete preferences with coach theme |
| 2026-09-08T03:29:27Z | [7fe3f00b](https://github.com/diegoenrique1122/genesis-suite/commit/7fe3f00b03ec7913fb61abf2e1342487ae883809) | fix(c3b14): unify coach branding theme contract |
| 2026-09-08T03:29:34Z | [643ffe92](https://github.com/diegoenrique1122/genesis-suite/commit/643ffe92a8f0ffc2bf794ad896c44bb6a2a338bc) | fix(c3b14): apply coach theme to command center |
| 2026-09-08T03:29:39Z | [8ad69261](https://github.com/diegoenrique1122/genesis-suite/commit/8ad692613fa846db2f3aa1e125c81dbcd910fcbe) | fix(c3b14): inherit coach theme in athlete portal |
| 2026-09-08T03:30:47Z | [b349bb41](https://github.com/diegoenrique1122/genesis-suite/commit/b349bb416ff2430d8c038a3b12b29810cedbc3ee) | fix(c3b14): localize coach settings and separate communication saves |
| 2026-09-08T03:31:38Z | [a51fbc29](https://github.com/diegoenrique1122/genesis-suite/commit/a51fbc299290e9b739ea6f2d8446372595be209f) | fix(c3b14): style themed surfaces consistently |
| 2026-09-08T03:31:45Z | [b24bada2](https://github.com/diegoenrique1122/genesis-suite/commit/b24bada25ef028e8ba732ddf8fab4c90de30a783) | fix(c3b14): correct localized coach settings rendering |
| 2026-09-08T03:32:33Z | [5715a861](https://github.com/diegoenrique1122/genesis-suite/commit/5715a861f285eded25993b9e9832eb2c2337ff1b) | fix(c3b14): extend theme to dashboard navigation |
| 2026-09-08T03:32:40Z | [99a6a331](https://github.com/diegoenrique1122/genesis-suite/commit/99a6a331a0820b45fa41a14c117929e77b7798bc) | fix(c3b14): extend theme to dashboard navigation |
| 2026-09-08T03:46:43Z | [be0ec6ef](https://github.com/diegoenrique1122/genesis-suite/commit/be0ec6efd3d22a0bb5f26bcf531addb1be4da8b5) | fix(c3b14): surface coach brand in athlete header |
| 2026-09-08T03:51:59Z | [a0826b82](https://github.com/diegoenrique1122/genesis-suite/commit/a0826b821b8f324b66ada994363232506a16615a) | feat(c3b14): prioritize coach roster by athlete count |
| 2026-09-08T03:56:06Z | [d431ca99](https://github.com/diegoenrique1122/genesis-suite/commit/d431ca99cdd3a4df168dc02ed707f6efcbf5336d) | feat(c3b14): clarify super admin operations dashboard |
| 2026-09-08T03:58:31Z | [7586763e](https://github.com/diegoenrique1122/genesis-suite/commit/7586763ee3e4551507f3409766078acbb26d5ce3) | feat(c3b14): establish Genesis visual system tokens |
| 2026-09-08T03:58:56Z | [9fa27604](https://github.com/diegoenrique1122/genesis-suite/commit/9fa27604d05f5b7c3bb3b7874f69cb1e05acffe8) | feat(c3b14): apply shared visual system to core dashboards |
| 2026-09-08T03:59:04Z | [c60a3887](https://github.com/diegoenrique1122/genesis-suite/commit/c60a388737a59adc43eedde77cc84ebbc61b3869) | feat(c3b14): apply shared visual system to core dashboards |
| 2026-09-08T03:59:10Z | [61515922](https://github.com/diegoenrique1122/genesis-suite/commit/61515922c639bf5baeb58ca36bd83f930784a85c) | feat(c3b14): apply shared visual system to core dashboards |
| 2026-09-08T04:04:37Z | [9adc8936](https://github.com/diegoenrique1122/genesis-suite/commit/9adc89367b1eedeaabdcf7c7671908ea701b9bdb) | feat(c3b14): add operational analytics to super admin |
| 2026-09-08T04:08:07Z | [9ff3764f](https://github.com/diegoenrique1122/genesis-suite/commit/9ff3764fa997a5f87bedf016393812e20c648d0c) | feat(admin): add expandable coach directory details |
| 2026-09-08T04:10:24Z | [90e84dbc](https://github.com/diegoenrique1122/genesis-suite/commit/90e84dbc7c274b5426e4529ba4ddd4fe47db7fa9) | fix(admin): correct coach detail row JSX |
| 2026-09-08T04:16:56Z | [6adbd9ef](https://github.com/diegoenrique1122/genesis-suite/commit/6adbd9ef30eccfd2037689396c37864050d8dfdd) | feat(coach): clarify roster operational overview |
| 2026-09-08T04:31:30Z | [6fe6936c](https://github.com/diegoenrique1122/genesis-suite/commit/6fe6936c04fb3b4d0a465598be576c321b258c8c) | feat(notifications): add reusable in-app notification center |
| 2026-09-08T04:32:12Z | [a7fda5a8](https://github.com/diegoenrique1122/genesis-suite/commit/a7fda5a8eb644e131ddc7d65ddfc82b2c80a5de9) | feat(admin): add notification center to command header |
| 2026-09-08T04:33:07Z | [4d78b830](https://github.com/diegoenrique1122/genesis-suite/commit/4d78b830e11b015f8af151868522f2961986d0fb) | fix(admin): keep notification center outside tab overflow |
| 2026-09-08T04:40:29Z | [b5f4d5cc](https://github.com/diegoenrique1122/genesis-suite/commit/b5f4d5cc7581624c6fc1721bf2202e4a10fdcfe6) | fix(notifications): redact observed activity details |
| 2026-09-08T04:43:16Z | [2677777e](https://github.com/diegoenrique1122/genesis-suite/commit/2677777e829f6cf096f4da3b0c741a81738d56ae) | fix(notifications): correct observed activity redaction |
| 2026-09-08T04:48:16Z | [c8dc3cc6](https://github.com/diegoenrique1122/genesis-suite/commit/c8dc3cc6f92c7258ec7a0edae65e1b256c76387b) | feat(notifications): alert super admins on key events |
| 2026-09-08T05:04:50Z | [617e26ac](https://github.com/diegoenrique1122/genesis-suite/commit/617e26ac2b54e7b5b6f090b350f4254ab18d77e2) | feat(notifications): localize and manage admin inbox |
| 2026-09-08T19:20:46Z | [255a5e05](https://github.com/diegoenrique1122/genesis-suite/commit/255a5e051f76cdf73f95f8f0b5b7727d41ff2b67) | feat(notifications): subscribe inboxes to realtime |
| 2026-09-08T19:20:53Z | [79f40f6e](https://github.com/diegoenrique1122/genesis-suite/commit/79f40f6e01fc95ddf9f35de8859a8b5ebf808967) | feat(notifications): add coach inbox access |
| 2026-09-08T19:20:59Z | [d9f74f25](https://github.com/diegoenrique1122/genesis-suite/commit/d9f74f25fa315e8811cf8762074d2a7ffceb12c4) | feat(notifications): add athlete inbox access |
| 2026-09-08T19:34:55Z | [ca858a70](https://github.com/diegoenrique1122/genesis-suite/commit/ca858a708a230a29bd4f3fa007ed222c765c04ce) | feat(notifications): make inbox events actionable |
| 2026-09-08T19:35:04Z | [18dc6a2a](https://github.com/diegoenrique1122/genesis-suite/commit/18dc6a2a446ad71824716669e835026d7e361729) | feat(admin): refresh request queue from alerts |
| 2026-09-08T19:42:49Z | [b6642880](https://github.com/diegoenrique1122/genesis-suite/commit/b664288010c03e4d81752fd817a29eed165b0379) | fix(notifications): normalize coach inbox text encoding |
| 2026-09-08T19:44:15Z | [02171b85](https://github.com/diegoenrique1122/genesis-suite/commit/02171b856dc06610743ecd4607c1eec67251c8ca) | fix(notifications): avoid dashboard reload when alerts are read |
| 2026-09-08T23:06:19Z | [2085113e](https://github.com/diegoenrique1122/genesis-suite/commit/2085113e6a61a2f8cd8164314e71ebced53aeade) | feat(notifications): add safe action references |
| 2026-09-08T23:09:39Z | [a111a362](https://github.com/diegoenrique1122/genesis-suite/commit/a111a3622227d0050786d1b7b57de8f1c08219ba) | feat(notifications): load safe action references |
| 2026-09-08T23:10:57Z | [639c329b](https://github.com/diegoenrique1122/genesis-suite/commit/639c329b41567706260689ad6132ec64d5948961) | feat(notifications): focus exact admin request alerts |
| 2026-09-09T01:37:45Z | [63cb73b5](https://github.com/diegoenrique1122/genesis-suite/commit/63cb73b56dd1eca002aa72d32816baae3ff84d92) | feat(notifications): open exact athlete alerts |
| 2026-09-16T23:56:54Z | [a8058713](https://github.com/diegoenrique1122/genesis-suite/commit/a8058713869a62d9999ad07db6d2daf1128d6afa) | feat(push): secure subscription authority |
| 2026-09-17T03:05:10Z | [f7e3ed8e](https://github.com/diegoenrique1122/genesis-suite/commit/f7e3ed8e208164a1aa041fee573a297b4f03ef9b) | feat(push): complete browser subscription client |
| 2026-09-23T21:18:12Z | [e5167dea](https://github.com/diegoenrique1122/genesis-suite/commit/e5167dea9e449388850a04ecdcc7b89606c7b98b) | fix(notifications): repair inbox text encoding |
| 2026-09-23T21:41:29Z | [68cd7d90](https://github.com/diegoenrique1122/genesis-suite/commit/68cd7d90d3b5d05b1f4e57759874ab8b2fafee57) | feat(push): add durable delivery ledger |
| 2026-09-23T22:09:50Z | [9ca7d2e4](https://github.com/diegoenrique1122/genesis-suite/commit/9ca7d2e499cfe2bcf6df5c3ee7b6cb3fd36e18e7) | feat(push): add sender delivery authority |
| 2026-09-23T22:30:33Z | [c3b90173](https://github.com/diegoenrique1122/genesis-suite/commit/c3b9017372ce81d10ed2fbb854b6b745adeaf834) | feat(push): add secure delivery function skeleton |
| 2026-09-23T22:49:36Z | [6e418ad7](https://github.com/diegoenrique1122/genesis-suite/commit/6e418ad741c295bc27ab925770cb710d1e239b95) | fix(push): fence stale delivery settlements |
| 2026-09-23T23:03:49Z | [6c084934](https://github.com/diegoenrique1122/genesis-suite/commit/6c08493403e90d6b55f7bafb6108348fa1d05405) | feat(push): wire vapid and fenced delivery rpc contracts |
| 2026-09-24T02:25:16Z | [1d26f391](https://github.com/diegoenrique1122/genesis-suite/commit/1d26f391e3c4078b21152211458e46b7869d0238) | feat(push): arm secure delivery sender |
| 2026-09-26T04:02:20Z | [6639bab5](https://github.com/diegoenrique1122/genesis-suite/commit/6639bab5a0601ce3d197fc03f9979c107c73560e) | docs(product): define beta reduction contract |
| 2026-09-26T04:11:12Z | [7b58f33e](https://github.com/diegoenrique1122/genesis-suite/commit/7b58f33e90122a7a4fbf024c9e090e027b16d2e4) | feat(ui): add shared visual foundation |
| 2026-10-06T02:11:05Z | [f58dda03](https://github.com/diegoenrique1122/genesis-suite/commit/f58dda03c6014c4ebfe0b86d339437f079a3f84e) | feat(ui): add athlete portal pilot |
| 2026-10-06T02:27:08Z | [7d8e0fe0](https://github.com/diegoenrique1122/genesis-suite/commit/7d8e0fe0d70d85c3b25a69fbac9694735d204cef) | fix(ui): repair coach dashboard lifecycle |
| 2026-10-06T02:43:05Z | [0e3ba5ed](https://github.com/diegoenrique1122/genesis-suite/commit/0e3ba5ed11d13bfd6ec85ef8486d13e1a14f34c6) | feat(ui): migrate coach portal shell and metrics |
| 2026-10-06T03:01:36Z | [7f0f163e](https://github.com/diegoenrique1122/genesis-suite/commit/7f0f163e31cae49330dff89c59782e823bdd3b6b) | feat(ui): migrate coach roster surfaces |
| 2026-10-07T00:41:20Z | [ef375948](https://github.com/diegoenrique1122/genesis-suite/commit/ef375948afe2e5f7b502379de89dc74324d2fec1) | feat(ui): migrate coach personal apps |
| 2026-10-07T01:31:22Z | [598950fa](https://github.com/diegoenrique1122/genesis-suite/commit/598950fa75ee043f098cb27015740037e9c41f0f) | feat(ui): migrate coach acquisition modal |
| 2026-10-07T01:47:21Z | [50a42d60](https://github.com/diegoenrique1122/genesis-suite/commit/50a42d6080e21b7b4a1cd8c604f927d454cf8963) | fix(trainer): repair trainer pro lifecycle |
| 2026-10-07T02:53:17Z | [094e7530](https://github.com/diegoenrique1122/genesis-suite/commit/094e75301e93a0e1fec549027db4327ac3230db4) | add server-authoritative training execution contract |
| 2026-10-08T02:10:47Z | [e95f36b5](https://github.com/diegoenrique1122/genesis-suite/commit/e95f36b5f9b244b0608a80ddc815f2a00b161448) | feat(trainer): connect training completion rpc |
| 2026-10-08T15:33:02Z | [c375db00](https://github.com/diegoenrique1122/genesis-suite/commit/c375db00804b46e3d3ef906926638bc4917fb00c) | refactor(programs): use canonical athlete program authority |
| 2026-10-08T16:25:15Z | [df848c10](https://github.com/diegoenrique1122/genesis-suite/commit/df848c100f9ae9db4e1d97d3118f2156c60ba515) | refactor(trainer): centralize canonical training engine |
| 2026-10-08T17:29:12Z | [d96eb031](https://github.com/diegoenrique1122/genesis-suite/commit/d96eb031e6cc11c45e1eb963b0973fcd10a4fca2) | feat(trainer): persist workout performance contract |
| 2026-10-08T20:31:41Z | [3162c4f9](https://github.com/diegoenrique1122/genesis-suite/commit/3162c4f99ccb134de035c9c6fe2570fc14286af2) | feat(trainer): send workout performance payload |
| 2026-10-08T20:36:44Z | [fe3a192b](https://github.com/diegoenrique1122/genesis-suite/commit/fe3a192b5ebd1cf45d2c26626d1a6f3bc70f1b41) | feat(trainer): add per-set workout execution |
| 2026-10-14T01:47:37Z | [92920276](https://github.com/diegoenrique1122/genesis-suite/commit/92920276e6d62f4e36cd5c06974ad0d7bd1711be) | refactor(trainer): extract testable workout performance model |
| 2026-10-17T02:02:57Z | [73b9db82](https://github.com/diegoenrique1122/genesis-suite/commit/73b9db823895ff2cee278bfec21e1389974f1b30) | feat(trainer): add read-only historical progression |
| 2026-10-24T20:34:56Z | [ee2eb0d5](https://github.com/diegoenrique1122/genesis-suite/commit/ee2eb0d53232ae8b1aa9515012f565b0bb83c5b5) | docs(beta): record expanded beta source inventory |
| 2026-10-24T23:28:42Z | [9b3673c6](https://github.com/diegoenrique1122/genesis-suite/commit/9b3673c64b5fe8b507d778f8ec9123f635e2aa2b) | docs(beta): record remote schema audit and preservation baseline |
| 2026-10-25T00:19:37Z | [c36e45e1](https://github.com/diegoenrique1122/genesis-suite/commit/c36e45e122cf9047e79c19c4ca562cb7bf01280a) | feat(nutrition): add versioned domain foundation |
| 2026-10-25T00:27:12Z | [95e554d1](https://github.com/diegoenrique1122/genesis-suite/commit/95e554d1b9fa6ee9a6e2890e4e19a612e0b02105) | docs(nutrition): close remote foundation audit |
| 2026-10-30T21:16:18Z | [28fc3d30](https://github.com/diegoenrique1122/genesis-suite/commit/28fc3d307a83460e9a60010afb95361be4ebaddd) | feat(nutrition): add authorized authoring and review operations |
| 2026-10-30T21:20:17Z | [dbb48e1a](https://github.com/diegoenrique1122/genesis-suite/commit/dbb48e1a00a1cd1d618bfb0dfd10d3a1942f5913) | docs(nutrition): close remote authoring installation audit |
| 2026-10-31T00:22:06Z | [bd4f9175](https://github.com/diegoenrique1122/genesis-suite/commit/bd4f9175b64b2c611811239e79a44f8bb258d56d) | feat(nutrition): add authorized version selection and effective reads |
| 2026-10-31T00:27:36Z | [73695e99](https://github.com/diegoenrique1122/genesis-suite/commit/73695e9953bcb59c6925bdce890878d792002bce) | docs(nutrition): close remote selection audit |
| 2026-10-31T01:29:12Z | [2d3a3281](https://github.com/diegoenrique1122/genesis-suite/commit/2d3a328156f9de8d08463b7661d010a3a5cc7ac1) | feat(nutrition): connect El Arquitecto to effective plan reads |
| 2026-10-31T01:30:28Z | [c9ffe43e](https://github.com/diegoenrique1122/genesis-suite/commit/c9ffe43eb7298a42df4fdf4ef4b8f94f7b048640) | docs(nutrition): record A2.4 Arquitecto read integration checkpoint |
| 2026-10-31T01:45:13Z | [29665dc2](https://github.com/diegoenrique1122/genesis-suite/commit/29665dc205392b9d949ba748bbdcac53b6d378d4) | docs(roadmap): add athlete memory vault and release progress gates |
| 2026-10-31T02:06:05Z | [d82bc2b9](https://github.com/diegoenrique1122/genesis-suite/commit/d82bc2b992baacc63d64aa2624a4d429bf3398a6) | docs(roadmap): define meal photo expiry and baseline progress sets |
| 2026-10-31T02:11:57Z | [61037e64](https://github.com/diegoenrique1122/genesis-suite/commit/61037e6441921b101ada6dc83a3de860df023e60) | docs(roadmap): record four-hour work window and remaining effort |

## Anexo B — Migraciones versionadas

Inventario del árbol revisado; no implica una nueva comprobación de instalación.

- `supabase/migrations/20260823170559_genesis_core_integrity_001.sql`
- `supabase/migrations/20260823172708_genesis_security_foundations_002a.sql`
- `supabase/migrations/20260823175742_genesis_authority_guards_002b1.sql`
- `supabase/migrations/20260823182559_genesis_secure_signup_002b2a.sql`
- `supabase/migrations/20260823204341_genesis_authority_users_master_002b2b1.sql`
- `supabase/migrations/20260823204514_genesis_profile_rls_002b2b2.sql`
- `supabase/migrations/20260823204818_genesis_operational_rls_002b2b3.sql`
- `supabase/migrations/20260823204957_genesis_referral_visibility_002b2b4.sql`
- `supabase/migrations/20260824200924_genesis_chat_realtime_security_002b3a.sql`
- `supabase/migrations/20260824203700_genesis_chat_broadcast_realtime_002b3b.sql`
- `supabase/migrations/20260824210000_genesis_telemetry_schedules_rls_002b4a.sql`
- `supabase/migrations/20260824211500_genesis_metrics_policy_cleanup_002b4a1.sql`
- `supabase/migrations/20260824214500_genesis_daily_discipline_pipeline_002b4b1.sql`
- `supabase/migrations/20260824215500_genesis_daily_discipline_conflict_fix_002b4b1a.sql`
- `supabase/migrations/20260824223000_genesis_badges_authority_002b4b2a.sql`
- `supabase/migrations/20260824224500_genesis_discipline_local_day_002b4b1b.sql`
- `supabase/migrations/20260825210000_genesis_coach_roster_activity_002b4b2.sql`
- `supabase/migrations/20260825214500_genesis_storage_emergency_write_containment_002b5a.sql`
- `supabase/migrations/20260825221500_genesis_storage_private_evidence_prep_002b5a2a.sql`
- `supabase/migrations/20260825223000_genesis_discipline_private_meal_paths_002b5a2b2a.sql`
- `supabase/migrations/20260825233500_genesis_public_brand_assets_002b5a2c1.sql`
- `supabase/migrations/20260826210000_genesis_athlete_evidence_private_cutover_002b5a2d.sql`
- `supabase/migrations/20260827003000_genesis_legacy_storage_private_containment_002b5a2e1.sql`
- `supabase/migrations/20260827022000_genesis_onboarding_authority_guard_002b6a2a.sql`
- `supabase/migrations/20260829205000_genesis_onboarding_private_paths_002b6a2b.sql`
- `supabase/migrations/20260829221500_genesis_global_invite_namespace_002b6a2c.sql`
- `supabase/migrations/20260830203000_genesis_athlete_domain_authority_002b6b.sql`
- `supabase/migrations/20260831234531_genesis_account_lifecycle_containment_002b6c.sql`
- `supabase/migrations/20260901003233_genesis_account_lifecycle_preflight_002b6c6a.sql`
- `supabase/migrations/20260901011052_genesis_account_lifecycle_execution_002b6c6b.sql`
- `supabase/migrations/20260902005008_genesis_account_lifecycle_approval_boundary_002b6c1.sql`
- `supabase/migrations/20260902013155_genesis_account_root_deletion_lockdown_002b6c1b.sql`
- `supabase/migrations/20260902014745_genesis_auth_registration_contract_002b6c1c.sql`
- `supabase/migrations/20260902023622_genesis_account_lifecycle_delete_ledger_002b6c1f.sql`
- `supabase/migrations/20260902191900_genesis_account_lifecycle_reconciliation_002b6c2a.sql`
- `supabase/migrations/20260903001728_genesis_account_lifecycle_retire_legacy_rpcs_002b6c2c.sql`
- `supabase/migrations/20260903012045_genesis_security_invoker_rpc_remediation_002b6c3a.sql`
- `supabase/migrations/20260903013703_genesis_athlete_privileged_rpc_boundary_002b6c3b1.sql`
- `supabase/migrations/20260906012702_genesis_revoke_legacy_athlete_rpc_execute.sql`
- `supabase/migrations/20260906132722_genesis_athlete_onboarding_draft_persistence.sql`
- `supabase/migrations/20260906170000_genesis_program_contract_002b6d.sql`
- `supabase/migrations/20260907001202_genesis_user_preferences_i18n_units.sql`
- `supabase/migrations/20260908044351_genesis_super_admin_notification_events_002b6d.sql`
- `supabase/migrations/20260908225715_genesis_notification_action_targets_002b6d.sql`
- `supabase/migrations/20260915000857_genesis_push_subscription_authority_002b6e.sql`
- `supabase/migrations/20260917010658_genesis_push_subscription_coalesce_fix_002b6e1.sql`
- `supabase/migrations/20260923212531_genesis_push_delivery_ledger_002b6f.sql`
- `supabase/migrations/20260923214952_genesis_push_sender_authority_002b6f1.sql`
- `supabase/migrations/20260923224230_genesis_push_sender_settlement_fencing_002b6f2.sql`
- `supabase/migrations/20261007015633_genesis_training_execution_contract.sql`
- `supabase/migrations/20261007025028_genesis_training_execution_coalesce_lint_fix.sql`
- `supabase/migrations/20261008163601_genesis_training_performance_contract_b32.sql`
- `supabase/migrations/20261024234025_genesis_nutrition_domain_a21.sql`
- `supabase/migrations/20261030211351_genesis_nutrition_authoring_a22.sql`
- `supabase/migrations/20261031000001_genesis_nutrition_selection_a23.sql`


## Checkpoint adicional — E1 Coach Settings, 31 octubre 2026

Continuación sobre desarrollo c1c383f y candidata publicada beta@81f4288; no hay
reinicio de memoria ni cambio de línea base histórica. El despliegue de revisión
en https://beta--genesis-os-pro.netlify.app/ ya está verificado.

CoachSettings reacondicionado en las seis secciones existentes, estados reales
de carga/error/reintento, marca Elite bloqueada correctamente en planes menores,
preferencias/marca con retorno de fila confirmado, copia de enlace comprobada.
El selector de comunicaciones no tenía efecto en Chat y se retira; datos y
mensajería existente se conservan. El registro no consume ref: compartir registro
ya no simula atribución de referidos. Se conserva la red histórica.

Validado en navegador con datos ficticios y en contratos locales; autenticación,
RLS y persistencia remota no se dan por aprobadas. La matriz sigue EN_REVISION en
filas afectadas. Ver docs/GENESIS_BETA_E1_COACH_SETTINGS.md para pruebas y siguiente
paso. Women’s/Disciplina, seis análisis, siete perfiles y no-R2 siguen vigentes.

