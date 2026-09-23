# Asistente de salud — continuidad

Implementado dentro del portal del paciente y como ruta protegida `/paciente-asistente`. Conserva tema claro/oscuro, navegación existente y sesión Bearer. `PacienteAsistenteScreen` usa `ViremComposer` y adaptadores separados de dictado para web y nativo. El micrófono se detiene al ocultar el módulo o abandonar la aplicación.

## Desarrollo

```powershell
npm ci --legacy-peer-deps
npm run start:web
```

Backend real en puerto 3000 con migración y configuración propias. La guía completa de API, pruebas, retención y procedencia de Korthyx está en [backend/docs/patient-assistant.md](../backend/docs/patient-assistant.md).

## Vista previa sin IA de pago

Primero iniciar en `../backend` con `NODE_ENV=development` y `npm run preview:assistant`. Después ejecutar aquí `npm run preview:assistant` y abrir `http://localhost:8085`.

La vista previa usa `127.0.0.1:3101`, datos sintéticos y un aviso visible. No carga archivos `.env` del frontend, no monta otros módulos y queda deshabilitada en producción mediante `__DEV__`. Los controles de tamaño y tema pertenecen exclusivamente a esa revisión local. El proveedor sintético no está disponible desde el backend real.

La barra «Revisión local / Vista móvil / Cambiar tema» se carga únicamente dentro de la condición de desarrollo; no se importa en producción. Se verificó una exportación de producción incluso con `EXPO_PUBLIC_ASSISTANT_PREVIEW=true`: los bundles no contienen la barra, el módulo `AssistantPreview` ni el token sintético. TypeScript y exportación aprobados.

Archivo de prueba: `../backend/tests/synthetic-laboratorio.pdf`. Las capturas están en `../entregables/asistente-salud/` desde la raíz común. Los controles funcionan con teclado; Enter envía y Shift+Enter permite una nueva línea. Los desplegables exponen su estado accesible y los botones tienen un mínimo de 44 px.

## Estado de validación

**Estado actual de `8086`: OpenAI real activado por autorización explícita del usuario.** Se comprobó manualmente una respuesta real a «¿Qué significa hemograma?» con resumen y detalles. Para reproducirlo, iniciar backend con `NODE_ENV=development` y `npm run preview:portal:openai`; el comando de frontend sigue siendo `npm run preview:portal`. El servidor conserva la base temporal y las cuentas sintéticas, pero envía preguntas, documentos y audio a OpenAI cuando se utilizan esos controles. El aviso visible consulta `/health` y distingue «OpenAI activo · Con consumo» de «Respuestas de demostración · Sin OpenAI». Este aviso también quedó excluido de la exportación de producción.

El modo sin consumo del portal completo está disponible en `http://localhost:8086` mediante `npm run preview:portal` en frontend y `NODE_ENV=development` con `npm run preview:portal` en backend. Usa login/Bearer reales contra una base sintética en memoria, dos pacientes y un médico de prueba; en ese modo no conecta con Supabase ni OpenAI. Cuentas, resultados y límites en [VALIDACION-PORTAL.md](../entregables/asistente-salud/VALIDACION-PORTAL.md). El banner local, igual que la barra de `8085`, queda excluido de la exportación de producción incluso con ambas variables de preview activadas.

Revisados dentro del portal: navegación, borrador al cambiar de módulo, adjunto, explicación general, seguimiento, cancelación, reintento, borrado, cambio de paciente y bloqueo del rol médico. Corregidos cierre del menú móvil, reapertura en escritorio y estado activo condicionado al foco de navegación. La barra lateral expone botones y selección para teclado/lectores de pantalla. TypeScript y exportación aprobados después de estos cambios.

Estado actual: `npm test` aprueba 31 pruebas, TypeScript y exportación web aprobados (detalle en [VALIDACION-PORTAL.md](../entregables/asistente-salud/VALIDACION-PORTAL.md#estado-actual-tras-las-correcciones-de-auditoría-2026-09-22)). Histórico: `npm test`: 28 pruebas aprobadas, incluidas 16 del asistente (`npm run test:assistant`). TypeScript y exportación web aprobados. CI ejecuta las pruebas además de TypeScript y exportación. Probados en navegador el hilo libre, seguimiento, carga de PDF sintético, explicación general, detalles, detención y reintento. Revisados 390 px, escritorio y ambos temas. Esa validación sintética y las pruebas automatizadas no consumen OpenAI; la comprobación manual posterior con inferencia real fue autorizada por separado. Los fixtures automáticos y de validación documental son sintéticos.

Corrección posterior: los eventos de error muestran motivos seguros específicos (formato, interrupción, límite temporal y timeout), manteniendo borrador y documento listo; nueva prueba de regresión aprobada. Se comprobó el backend corregido con PDF y PNG sintéticos y OpenAI real. La vista existente de `8086` ya está conectada a `3103` mediante la configuración de desarrollo de `config/backend.ts` y recarga de Metro. Se verificaron login, acceso al asistente y recuperación del PDF sintético con su explicación completa. El destino de preview se aplica solo con `__DEV__` y `EXPO_PUBLIC_PORTAL_PREVIEW=true`; producción conserva su configuración habitual. Véanse [comandos y alcance](../entregables/asistente-salud/VALIDACION-PORTAL.md#corrección-de-explicación-interrumpida-2026-09-22).

La revisión adicional corrige inicios simultáneos del micrófono, permiso tardío tras salir, cancelación de la transcripción al pasar a segundo plano y respuestas de solicitudes anteriores. Las cargas y el streaming notifican los errores de sesión al mismo observador que las solicitudes JSON. Un borrado pendiente no limpia ni bloquea la sesión de otro paciente. Los adaptadores de grabación se verifican con dobles de prueba, sin capturar audio real.

Con altura reducida, el compositor se condensa y los adjuntos, errores y notas pasan a la zona desplazable. Corrección B2: los adjuntos quedan al final de esa zona, sin relleno inferior, y la vista se desplaza hasta ellos; la tarjeta del archivo pendiente se compacta (nombre y estado en una línea) y muestra ahí el error de carga, sin hacer crecer el compositor; sin archivo seleccionado, el error aparece en el compositor. Los nombres largos se recortan por el medio conservando la extensión y el nombre completo queda como etiqueta accesible. Verificado en navegador a 390 × 440 con un nombre largo acentuado: tarjeta, nombre y acciones visibles al seleccionar y tras el error; un único aviso de error; «Quitar» limpia archivo y error. Se verificó el botón de envío dentro del viewport a 390 × 440 px, y el recorrido Tab/Enter. La comprobación del teclado físico móvil se omitió por indicación del usuario.

El backend local tiene los tres modelos y la clave de OpenAI reutilizada de Korthyx por indicación del usuario. Se verificó autenticación y disponibilidad mediante metadatos de modelos y se aplicó `20260922_patient_assistant` a la base Supabase configurada. La demo `8085` sigue siendo sintética; el portal `8086` utiliza ahora el modo OpenAI descrito arriba. La exportación adicional de iOS/Android y la inspección de permisos nativos terminaron correctamente; las pruebas en dispositivos se omitieron por solicitud explícita, sin considerarlas aprobadas. Los resultados están en [ASISTENTE-MOVIL.md](ASISTENTE-MOVIL.md). La instalación mantiene el conflicto previo de Expo 54/WebRTC 14 mediante `--legacy-peer-deps`, sin actualizar videollamada ni Expo de forma incidental.

Correcciones de auditoría: los documentos con lectura fallida ya no bloquean el compositor, pueden reintentarse con el mismo archivo local y quitarlos no borra el hilo; tras un error o una detención, Enviar crea un intento nuevo; el plazo del servidor se muestra como tiempo agotado y no como detención. Cada documento listo puede excluirse del próximo mensaje; el reintento reutiliza los documentos originales sin tocar el borrador; los datos que no aparecen en el texto del PDF se señalan para comprobarlos. Detalle en [backend/docs/patient-assistant.md](../backend/docs/patient-assistant.md#correcciones-posteriores-a-la-auditoría-2026-09-22).

Compositor compacto: el campo se ajusta a su contenido (una línea vacío, hasta 160 px o 80 px con poca altura, con desplazamiento interno) y vuelve a una línea al enviar o vaciarse; en web se mide con `scrollHeight` porque react-native-web no encoge el textarea. Con respuestas en pantalla se oculta la etiqueta visible «Tu pregunta» (el nombre accesible se mantiene), se reduce el relleno y los avisos del pie pasan a una sola línea. Cada documento ocupa una fila con nombre, estado breve («Imagen · Listo») y acciones en línea («✓ Incluido», «Quitar»); los nombres largos conservan la extensión. `AssistantButton` expone `aria-checked`, `aria-expanded` y `aria-disabled` explícitos, porque react-native-web no traduce `accessibilityState`, y los textos largos de los botones se ajustan al ancho. Verificado en navegador: compositor de ~285 a 194 px en escritorio y de 263 a 195 px a 390 × 844; campo 44 → 92 → 160 → 44 px; sin desbordes horizontales.

Actualización de continuidad: 2026-09-22. No se modificó Korthyx, no hubo despliegue y no se publicaron paquetes.
