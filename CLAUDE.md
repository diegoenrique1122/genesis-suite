# Genesis OS — reglas para Claude Code

Responde siempre en español. Fecha de este archivo: 31 oct 2026.

## Contexto obligatorio (leer antes de proponer trabajo)

1. docs/GENESIS_MASTER_CONTINUITY_RECONCILED.md (memoria maestra y evidencia por commit).
2. docs/HOJA_DE_RUTA.md, si existe (hoja de ruta F0–F10, lógica de botones, gráficos, inmersión).
3. docs/GENESIS_BETA_EXPANDED_A1_INVENTORY.md, docs/GENESIS_C3B14_3C_PRODUCT_REDUCTION_CONTRACT.md y docs/GENESIS_BETA_VISUAL_ANALYTICS_PLAN.md.

## Ramas y despliegue

- `beta` es el único tronco y se despliega a Netlify. `rebuild/core-architecture` está congelada: no le hagas commits (tiene el mismo contenido, historial duplicado).
- Nunca hagas commit ni push directo a `beta`. Trabaja en una rama corta que sale de `beta` (por ejemplo `audit/f1`) y vuelve a `beta` al cerrar la tarea.
- Un commit por lote pequeño. Formato del mensaje: `F3.3 | 1,5 h | verify OK` (ID de tarea, horas efectivas, resultado).
- No ejecutes despliegues, `git push --force`, ni comandos destructivos sin pedir confirmación.

## Reglas de trabajo

1. Una sola tarea abierta a la vez (ID de la hoja de ruta, por ejemplo F1.1).
2. No abras una fase sin cerrar el gate de la anterior.
3. Cada tarea tiene tres estados independientes: implementado, validado, aceptado para beta.
4. No rehagas lo cerrado: Core y entitlements, seguridad/RLS, chat con Broadcast, frontera del atleta (edge), Storage privado, notificaciones y push, migraciones A2.1–A2.3 y sus pruebas. Solo se tocan si cambia una dependencia o hay un fallo demostrado.
5. No quites funcionalidad acordada para que cuadre una estimación. Todo lo que se elimine debe justificarse en la matriz de botones.
6. Al cerrar una sesión: commit + una línea en el documento de continuidad (cambio, evidencia, próximo paso exacto). No reconstruyas la memoria completa.
7. No inventes: si no encuentras algo en el código, dilo. Distingue lo que viste de lo que supones.

## Seguridad (innegociable)

- Nunca escribas, imprimas ni subas claves, tokens ni archivos `.env`.
- Los datos sensibles se escriben solo por RPC o función edge con autoridad de servidor; nunca directo desde el navegador a tablas.
- No crees ni modifiques migraciones SQL sin autorización explícita y sin decir qué tablas toca.
- No consultes ni modifiques datos del Supabase de producción desde esta sesión.
- Los datos de Women's Performance requieren consentimiento activo, también en modos de soporte.

## Prueba de existencia de un control (botón, enlace, gráfica)

Un control se queda solo si responde: ¿quién lo usa y cuándo?, ¿qué decisión produce?, ¿qué ocurre en el servidor y qué ve el usuario si falla?, ¿cómo se ve vacío, cargando y sin permiso?, ¿qué prueba lo cubre?

Veredictos: conservar, fusionar, reubicar, eliminar u ocultar tras bandera.

- Sin handler, handler vacío o datos simulados → eliminar u ocultar.
- Duplica otra acción de la misma pantalla → fusionar.
- Pertenece a otro rol → reubicar o eliminar.
- Escribe directo a tablas sensibles desde el navegador → bloquear hasta pasar por RPC/edge.
- Muestra un dato que nadie usa para decidir → eliminar.
- Una acción primaria y máximo tres secundarias por pantalla.

## Orden de ejecución

F0 → F3.1–F3.2 (A2.5, solo validación de backend) → F1 → F2 → F3.3–F3.6 → F4 → F5 → F6 → F7 → F8 → F9 → F10 → post-beta.

## Modo de trabajo por defecto

Empieza en modo lectura: inventaría y propone antes de modificar. Para cualquier cambio, muestra primero el plan (archivos, qué cambia, riesgo) y espera aprobación.

## Flujo de cada tarea (sin doble trabajo)

1. Abre un solo ID de la hoja de ruta y lee su gate.
2. Presenta un plan (archivos, esquema, riesgo) y espera aprobación. Se aprueba una vez.
3. Implementa por lotes pequeños.
4. Verifica con un solo comando (`npm run verify`: lint, build y las pruebas existentes). No repitas la batería A21–A23 salvo que cambie una dependencia o haya un fallo.
5. Cierra: commit, integración a `beta` y una línea en el documento de continuidad con el próximo paso exacto.

## Una sola vez por pantalla y por tabla

- Si otra fase va a reconstruir una pantalla, no la limpies antes: se limpia dentro de esa fase.
- Las migraciones nuevas de la beta (auditoría con contexto, ingesta de nutrición, recuperación subjetiva, consentimiento e historial de Women's, running) deben compartir convenciones: patrón de RLS, zona horaria local del atleta, unidades canónicas kg/cm, procedencia del dato (manual, dispositivo o estimado) y consentimiento. Propón el diseño completo para revisión antes de aplicar la primera.

## Decisiones de producto (31 oct 2026)

- Perfil de atleta propio: solo coach Elite y super admin. El coach básico no tiene contexto atleta.
- Inmersión del super admin en beta: «ver como» (solo lectura) y «operar como».
- «Operar como» solo se activa desde una sesión de «ver como» abierta, con motivo, segunda confirmación explícita, banner persistente y tope de 30 minutos.
- Al operar como otro usuario quedan excluidos: borrar cuentas, consentimientos, cambios de plan, pagos y enviar chat como el usuario. Toda acción se marca como «acción de soporte» en el historial.
- La identidad real sale siempre del token; el contexto efectivo vive en el servidor, nunca en una bandera del navegador.
