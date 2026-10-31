# Genesis — Compresión en cliente y retención diferenciada de fotos

Fecha: 31 de octubre de 2026, America/New_York.
Baseline: 230443f0162541d6705cf11d0c86dde4a9c3755b.
Estado: propuesta de arquitectura registrada; compresión y borrado automático
no implementados ni activados por este documento.

## Decisión de diseño propuesta

Mantener Supabase como proveedor de archivos. No incorporar R2 ni replicar
imágenes a otra base o proveedor.

- Comprimir nuevas fotos antes de subirlas.
- Comidas: conservación propuesta de 15 días desde recepción servidor, para
  permitir revisión semanal. Esta propuesta sustituye el plazo previo de 24 h
  para la implementación futura; no cambia los archivos existentes por sí sola.
- Físico: frecuencia por defecto de actualización 14 días, configurable por coach.
  La frecuencia de captura no es un vencimiento automático del juego vigente.
- Conservar las primeras tres fotos de progreso (frente, perfil y espalda)
  como referencia base y el juego completo vigente.
- Retirar el juego sustituido 7 días después de validar y activar su sucesor.
  Exportación y alertas disponibles durante ese periodo.

Esto cumple el objetivo de ahorro sin destruir el comparativo inicial.
La primera base también es el primer juego vigente: no duplicar objetos.
La “composición corporal” de estas fotos es evidencia visual de progreso,
no medición automática de porcentaje de grasa.

## Compresión

Perfiles iniciales para medir y validar en móviles:
| Uso | Límite inicial | Formato preferido | Calidad solicitada |
| --- | --- | --- | --- |
| Comida | Lado mayor máximo 720 px | WebP | 0,65 |
| Físico | Lado mayor máximo 1080 px | WebP | 0,80 |

Conservar proporciones, orientación y contenido completo; no recortar partes
del cuerpo ni ampliar originales pequeños. “Calidad 0,80” es un parámetro del
codificador, no una garantía de conservar el 80% de la información.
Si 1080 px no permite comparar adecuadamente, elevar resolución/bytes tras
revisión visual; no sacrificar el objetivo de la foto para lograr 110 KB.

40 KB y 110 KB son objetivos orientativos, no límites universales garantizados.
Registrar original_bytes, encoded_bytes, ancho, alto, MIME real y versión del
perfil; medir reducción por archivo y promedio ponderado por bytes.

Ruta preferida: canvas/toBlob si cumple soporte y rendimiento. No añadir una
dependencia sin comprobar que haga falta. Comprobar el tipo MIME real: pedir
WebP no garantiza obtenerlo; algunos navegadores pueden devolver PNG.
Usar JPEG comprimido como alternativa explícita cuando se soporte y respete el
presupuesto de tamaño; nunca renombrar un PNG como .webp.
Si una imagen HEIC/otro formato no se puede decodificar, mostrar recuperación
clara para convertir o seleccionar una foto compatible; no subir la foto cruda
silenciosamente ni bloquear la interfaz.

Procesar una imagen por vez en móviles, liberar URLs/canvas y limitar dimensiones
de entrada para no agotar memoria. Redibujar píxeles sin copiar EXIF/GPS; orientar
correctamente antes de codificar. Verificar con fotos reales de Android/iPhone.
El backend valida formato, tamaño, propietario y tipo de evidencia; las reglas
del cliente no constituyen una frontera de seguridad.

El archivo original se mantiene solo en el dispositivo del usuario, no se envía
como segunda copia a Storage por defecto.
No comprimir/reemplazar masivamente fotos legacy sin inventario, validación de
comparación y procedimiento específico de conservación.

## Comidas: evidencia y limpieza

Separar los conceptos:
- photo_received: el servidor confirmó el objeto y su asociación autorizada.
- photo_reviewed_at / reviewer: revisión explícita del coach si existe.
- adherence_reported: lo que el atleta declara haber cumplido.
- received_at, captured_at y consumed_at con su procedencia.
- delete_after: 15 días desde recepción servidor.

No usar photo_verified=true automáticamente como prueba de ingesta, calorías
o puntualidad. Si existe verificación humana, registrar exactamente qué se
revisó; no transformar una fotografía en medición de lo consumido.

Aviso previo en resumen de revisión/exportación, por ejemplo a 3 días del
vencimiento, agrupado para evitar cinco notificaciones por día.
Tras el borrado permanecen los datos numéricos y el evento de evidencia.
El path pasa a estado eliminado; la interfaz deja de pedir URLs para ese objeto.

El job debe ser programado, autorizado e idempotente: revisar propietario,
clase de objeto, vencimiento y estado; borrar físicamente mediante Storage API,
registrar resultado y reintentar fallos. No borrar filas de storage.objects
mediante SQL como mecanismo de limpieza. La caducidad de una URL firmada tampoco
borra el archivo. Presupuesto de ejecución por lotes y logs sin secretos.

## Físico: actualización y periodo de descarga

1. Solicitar el control por defecto cada 14 días.
2. Recibir frente, perfil y espalda como un único conjunto pendiente.
3. Validar que las tres fotos existen, pertenecen al atleta y son utilizables.
4. Activar atómicamente el nuevo conjunto; el anterior sigue vigente si falla
   cualquier carga o validación.
5. Marcar el juego sustituido con delete_after = activación del sucesor + 7 días.
6. Avisar al sustituirlo y 24 h antes del borrado. Mostrar la fecha exacta.
7. Permitir descarga ZIP y exportación del índice numérico.
8. Borrar solo el juego sustituido vencido, con reintentos y auditoría.

Nunca borrar la base inicial ni el último juego válido por cumplir 14 días
sin que haya sucesor. Nunca eliminar objetos todavía referenciados por la base
o el juego vigente. Proteger contra carreras entre carga, activación y cleanup.

En una cadencia normal de 14 días hay tres fotos base, tres vigentes y
temporalmente tres del conjunto sustituido. Reintentos y cargas extraordinarias
requieren cuotas y limpieza de pendientes; no prometer un máximo universal de
nueve archivos sin implementar esas reglas.

Para un programa de 90 días, ofrecer recordatorio de respaldo en el día 83.
No confundir duración del programa, revisión quincenal y vencimiento de objetos.
El cierre del programa no purga aquí la base y el último juego: esa eliminación
requiere un contrato de cierre separado con aviso y exportación.
El historial numérico conserva las reglas de privacidad, autorización y borrado
establecidas para la cuenta; no abre acceso indefinido a excoaches.

## Respaldo

- ZIP: archivos de imagen accesibles y manifiesto con fecha, vista y atleta.
- CSV/XLSX: pesos, medidas registradas, adherencia, entrenamiento y un índice
  de las imágenes; el Excel no sustituye el ZIP como respaldo de fotos.
- Un botón visible inicia la preparación y muestra progreso, fallos y
  “Descargar ZIP” al completar. Archivos grandes se particionan si hace falta.
- Generar el ZIP o iniciar una descarga no demuestra que el coach haya guardado
  una copia. No adelantar el borrado por esas señales.
- No conservar ZIP permanentes duplicando Storage; streaming o temporales
  privados con vencimiento propio y acceso por rol.

## Ahorro: escenario ilustrativo, no resultado medido

Usando unidades decimales y los tamaños sugeridos por el usuario:
- 3,5 MB a 40 KB implica aproximadamente 98,86% menos bytes por foto de comida.
- 4 MB a 110 KB implica aproximadamente 97,25% menos bytes por foto de físico.
- 5 fotos de comida/día × 15 días × 40 KB = 3 MB por atleta.
- 9 fotos de físico × 110 KB = 0,99 MB temporal en cadencia normal.
- Total ilustrativo: ~4 MB por atleta; ~400 MB para 100 atletas.

No incluye originales legacy, otras imágenes, archivos pendientes, ZIP temporales,
transferencias, miniaturas, índices, metadatos o backups.
A 30 días de comidas, solo esa parte sería 6 MB por atleta: el doble que a 15.
Ahorro de Storage no equivale a 96% menos costo total ni menos RAM de toda la app;
la decodificación de imágenes puede consumir RAM temporalmente.
Comprobar tamaño real, calidad, transferencias y costo por atleta antes de publicar
porcentajes o compromisos comerciales.

## Entrega y esfuerzo

Conservar alcance actual: historial numérico y panel en beta; nueva retención/
rotación de fotos se planifica después de beta en Supabase.
La compresión se registra como mejora candidata para el próximo cambio de
carga de fotos; no se añade silenciosamente a la beta ni se declara ya hecha.

El rango beta 160–280 h y V1 370–650 h del documento anterior permanece como
baseline previo a dimensionar compresión y compatibilidad. La retención ya
tenía una partida de 12–20 h post-beta; no sumar otro proyecto completo por
renombrarla. Estimar el incremento de compresión con una prueba corta de
compatibilidad y calidad antes de cambiar el presupuesto.

No se han instalado paquetes, modificado React, aplicado migraciones, programado
jobs ni eliminado archivos reales en este checkpoint documental.

## Referencias técnicas

- https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
- https://html.spec.whatwg.org/multipage/canvas.html
- https://supabase.com/docs/guides/storage/management/delete-objects
- https://supabase.com/docs/guides/storage/schema/design
- https://supabase.com/docs/guides/cron/quickstart
