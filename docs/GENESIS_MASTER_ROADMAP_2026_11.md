# Genesis Suite — Mapa maestro por fases (12 noviembre 2026)

Rama: rebuild/core-architecture. Baseline: 439c036165174a9dc299b604715f50696326830e.
Este documento fija el orden operativo y prevalece sobre instrucciones anteriores que entren en conflicto. Complementa GENESIS_MASTER_CONTINUITY_RECONCILED.md, GENESIS_BETA_EMERGENCY_RELEASE.md, GENESIS_BETA_VISUAL_ANALYTICS_PLAN.md, GENESIS_BETA_EXPANDED_A1_INVENTORY.md y GENESIS_C3B14_3C_PRODUCT_REDUCTION_CONTRACT.md. Los cierres históricos se conservan. La primera tabla literal y las 22 jornadas completas no se recuperaron: no inventarlas.

## Decisiones actualizadas

- Elegir A para beta: una cuenta de atleta independiente, con correo propio y contraseña gestionada por Auth, vinculada al coach Élite como su atleta de prueba. No reutilizar la misma dirección/cuenta ni requerir selección de rol en login. Activación/autogestión según contrato aprobado, sin pagos ni capacidades adicionales implícitas. No generar contraseñas desde el panel ni almacenarlas en texto plano. El Super Admin ve estado y recibe evento persistente de activación/desactivación. Evitar duplicados y carreras. Aislar completamente los datos personales del coach y los de otros atletas; definir en contrato la relación y el efecto de baja/cambio de plan.
- Retirar de todas las pantallas referencias y accesos a modo inmersivo después de migrar la funcionalidad y las dependencias con seguridad. Auditar Core, rutas, RPC, datos existentes y RLS. No borrar perfiles o datos existentes automáticamente.
- Supabase sigue siendo el gestor; R2 excluido. Solicitud nueva: borrar imágenes a las 48 horas desde recepción confirmada en servidor; aplica a comidas y físico, sujeta a un diseño de respaldo seguro y validación antes de activar cualquier purga. El planteamiento previo de 15 días y protección indefinida queda sustituido como objetivo, pero el conflicto con preservar las tres fotos iniciales y el juego vigente requiere una decisión explícita antes de borrar esas imágenes. Propuesta: exportación ZIP verificable antes del vencimiento; si el respaldo no se confirma, no purgar fotos de físico protegidas. Las fotos de comida podrán purgarse tras registrar evento persistente. El usuario elegirá si acepta una excepción para físico o eliminación estricta de todo a 48 horas. No activar tareas de borrado hasta resolverlo y ensayarlas.
- Compresión en cliente: WebP adaptable, inicialmente 720px/calidad .65 comidas y 1080px/.80 físico, como parámetros de prueba; mantener proporción y orientación, no ampliar imágenes pequeñas, fallback explícito JPEG/PNG si WebP/HEIC falla. No se garantiza tamaño ni preservación idéntica de detalle. Medir bytes, calidad visual, dispositivos y tráfico antes de fijar umbrales.
- Separar evidencia recibida, cumplimiento declarado y tiempos servidor/captura/consumo; conservar registros numéricos y sus metadatos con fuente, unidades y fecha. No inferir honestidad, ingesta o diagnóstico a partir de una foto.

## Método de avance

Al cierre de cada subfase informar porcentaje de la fase según entregables ponderados, evidencia y pendientes. Al cerrar cada fase informar porcentaje global del producto mediante pesos acordados tras auditar alcance y línea base; no confundir porcentaje de checklist con porcentaje de trabajo histórico. Pendiente establecer pesos y avances verificados: no asignar 0 % a trabajo existente ni inventar un porcentaje global. Anotar inicio, fin, pausas, trabajo efectivo y pruebas, y no descontar dos veces el mismo trabajo. Las estimaciones históricas 130–225 h son provisionales y deben recalibrarse con el cambio de alcance; no restar automáticamente horas transcurridas.

## Fases y subfases

### F0. Continuidad y línea base
F0.1 Reconciliar memoria V4/V5, inventario y cierres históricos; localizar tabla original faltante.
F0.2 Auditar ramas, deploy, migraciones, fixtures, diferencias y registrar evidencia.
F0.3 Establecer pesos por entregable y medición de tiempo sin doble conteo.
Estado: base amplia documentada; auditoría de línea base y ponderación pendientes.

### F1. Núcleo, seguridad y ciclo de cuentas
F1.1 Preservar Core y entitlements, planes B2B/B2C y límites (Ignición/Evolución/Élite).
F1.2 Auth, signup, onboarding, relaciones, invitaciones, perfiles, recuperación y estados.
F1.3 RLS, RPC, ownership, revocación, bajas y pruebas de acceso cruzado.
F1.4 Programas, versiones y flujo NEW → PENDING_AUDIT → APPROVED; auditoría.
Estado: contratos y migraciones históricas existentes; validar cambios afectados.

### F2. Acceso de coach como atleta y Super Admin
F2.1 Contrato cuenta independiente y vinculación segura; activación Elite y autoaprobación acotada.
F2.2 Alta, recuperación, acceso atleta Elite, sincronización de estado y desactivación.
F2.3 Super Admin: lista de coaches con estado, evento de activación/desactivación, inbox y trazabilidad.
F2.4 Migrar experiencia inmersiva existente; retirar pestañas/acciones y adaptar rutas/Core/RPC sin pérdida de datos; probar downgrade y concurrencia.
Estado: nuevo alcance pendiente; existen componentes y RPC de inmersión que requieren migración.

### F3. Experiencia visual y perfiles
F3.1 Super Admin: resumen, coaches, atletas, solicitudes, marca global y una apariencia.
F3.2 Coach: tablero, roster, detalle, preferencias, marca según plan, comunicaciones y solicitudes.
F3.3 Atleta: inicio, tareas, perfil, progreso y navegación móvil.
F3.4 Botones reales, errores/reintentos, accesibilidad, inglés/español, unidades, ventanas y gráficos reales.
F3.5 Matriz de siete perfiles y variantes de plan y género; pruebas escritorio/móvil.
Estado: sistema visual existente y ajustes coach E1 implementados con fixtures; aceptación real pendiente.

### F4. Trainer Pro y programas
F4.1 Onboarding, objetivos, gym/home, niveles y motor canónico ya centralizado.
F4.2 Rutinas, progresión, equivalencias, edición y aprobación según plan.
F4.3 Ejecución por series, RIR, cargas y unidades; ledger e historial.
F4.4 Simetría VIP y sincronización con coach; revisión de contratos y prueba integrada.
Estado: B.2/B.3/B.3.5 implementados históricamente; validación residual.

### F5. Arquitecto y nutrición
F5.1 Reutilizar A2.1–A2.4 instalados/versionados; no recrear tablas.
F5.2 A2.5 pruebas autenticadas de propietario, coach, terceros, estados y concurrencia.
F5.3 Autoría, revisión, aprobación, selección, plan efectivo y sincronización.
F5.4 Comidas, objetivos y registro de evidencia y horarios con fuentes diferenciadas.
Estado: integración y aceptación pendientes, base existente.

### F6. Disciplina y evidencia
F6.1 Agua, sueño, pasos manuales, entrenamiento, dificultades y registro diario.
F6.2 Comidas previstas, cumplimiento declarado, evidencia, trazabilidad y sincronización.
F6.3 Peso, fotos de físico, registro de progreso, objetivos, rachas e insignias.
F6.4 Compresión y retención 48 horas, respaldo, control de errores, auditoría y limpieza idempotente; resolver excepción de fotos protegidas.
F6.5 Coach visualiza datos, alertas y detalle real; pruebas de permisos.
Estado: pipeline diario, firmas privadas, monitoreo e insignias existen; alcance completo y nueva política pendientes.

### F7. Women's Performance
F7.1 Consentimiento informado, privacidad, revocación y acceso autorizado.
F7.2 Registros e historial, ciclo, síntomas y recuperación sin inferencias clínicas falsas.
F7.3 Contexto de entrenamiento/nutrición y propuestas revisadas por coach.
F7.4 Integración, seguridad y pruebas por elegibilidad.
Estado: componente legacy existe; no cumple todavía el contrato completo.

### F8. Panel e historial numérico
F8.1 Registro duradero de peso, grasa medida cuando exista, días, fotos y cobertura; permisos.
F8.2 Evidencia nutricional frente a tendencia, sin diagnosticar ni imputar conducta.
F8.3 Tonelaje por grupo y evolución; series efectivas por patrón y distribución.
F8.4 e1RM Epley en ejercicios comparables con cobertura y límites.
F8.5 Mapa horario diferenciando captura, recepción y consumo.
F8.6 Rendimiento frente a sueño, estrés y recuperación como asociación, no diagnóstico.
F8.7 Gráficos con unidades, fechas, datos faltantes, versiones y exportación.
Estado: fuentes y servicios existentes; agregados y aceptación ampliada pendientes.

### F9. Comunicación, notificaciones y extras
F9.1 Chat privado/comunidad y autorización por rol/plan.
F9.2 Notificaciones internas, push, eventos y validación real de entrega.
F9.3 Insignias, recordatorios, branding, referidos y solicitudes: solo acciones verificadas.
F9.4 Auditor IA: revisar dependencia externa y cuota, sin suponer cierre.
Estado: implementaciones históricas significativas; comprobar integración residual.

### F10. Cierre y lanzamiento beta
F10.1 Netlify candidata, variables públicas, rutas SPA y Auth redirects.
F10.2 Siete perfiles reales y pruebas de escritorio/móvil, errores, persistencia, RLS y sincronización.
F10.3 Validar Women's, Disciplina, historial, compresión y retención según decisión final.
F10.4 Corregir bloqueos, aceptación piloto y registro de versión y despliegue.
Estado: candidata Netlify verificada al 31 octubre; no es aceptación integral.

### F11. Producto completo después de beta
F11.1 Running y Triatlón/Ironman: tarjetas visibles «En desarrollo» hasta implementación real.
F11.2 Integraciones reales de wearables y recuperación, cuando se aprueben.
F11.3 Consolidación operativa, mejoras comerciales, escalabilidad y evolución.
Estado: pendiente; no mezclar con bloqueos beta salvo decisión posterior.

Criterios de todo cierre: evidencia, permisos, estados de carga/error, datos reales o fixtures identificados, integración afectada, build y pruebas proporcionales. Mantener memoria en Git y registrar cambios de alcance.
