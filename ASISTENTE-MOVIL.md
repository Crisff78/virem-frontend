# Asistente: validación iOS y Android

Estado al 22 de septiembre de 2026. No se ejecutó la aplicación en un dispositivo físico ni en un emulador. No se generó APK/IPA ni se hicieron llamadas de pago a OpenAI.

El usuario indicó explícitamente omitir la validación en dispositivos. Este apartado queda fuera del alcance restante de la entrega; se conservan las comprobaciones previas y los casos de referencia sin marcarlos como aprobados.

## Comprobaciones ejecutadas

```powershell
npx cross-env EXPO_NO_DOTENV=1 EXPO_PUBLIC_ASSISTANT_PREVIEW=false EXPO_PUBLIC_BACKEND_URL=http://localhost:3000 expo export --platform all --output-dir scratch/assistant-native-export --clear
npx cross-env EXPO_NO_DOTENV=1 expo config --type introspect --json
```

- Exportación correcta: iOS 1 097 módulos y Android 1 095 módulos; bundles Hermes de aproximadamente 3,88 MB cada uno. También se exportó web.
- iOS: `NSMicrophoneUsageDescription` indica que el micrófono se utiliza al elegir dictar una pregunta. Sin `UIBackgroundModes` de audio.
- Android: permiso `android.permission.RECORD_AUDIO`; sin permisos de servicio de grabación en segundo plano en la configuración del asistente.
- Los 15 casos de regresión del asistente en `npm run test:assistant` incluyen adaptadores de micrófono simulados, cancelación durante permisos/preparación/transcripción, limpieza temporal y cambios de sesión. No prueban el hardware.

## Entorno observado

Este equipo es Windows. No hay `adb` ni `emulator` en PATH, `ANDROID_HOME`/`ANDROID_SDK_ROOT` no señalan un SDK disponible y la ruta habitual de Android SDK no contiene estas herramientas. Tampoco hay Xcode. Docker está instalado pero su motor no está disponible. La base elegida finalmente por el usuario fue la Supabase configurada, cuya migración sí se aplicó.

No se continuará con compilación ni instalación en dispositivos en esta entrega. No se activaron EAS Build, distribución ni servicios remotos de pago. La exportación Hermes anterior acredita empaquetado JavaScript; no acredita compilación de todos los módulos nativos ni funcionamiento de micrófono.

## Casos de referencia para una futura validación

Registrar modelo, versión de SO, compilación instalada, resultado y evidencia. Usar cuentas y documentos sintéticos del entorno de prueba identificado.

| Caso | Resultado esperado | Android | iOS |
| --- | --- | --- | --- |
| Denegar permiso y reintentar | Error comprensible; borrador intacto | Pendiente | Pendiente |
| Dictar y terminar | Micrófono cerrado; transcripción editable; sin envío automático | Pendiente | Pendiente |
| Salir, cerrar sesión o pasar a segundo plano | Detención y descarte; sin texto tardío en otra sesión | Pendiente | Pendiente |
| Permiso concedido después de salir | No empieza la grabación | Pendiente | Pendiente |
| Límite de dos minutos | Detención automática y duración válida en servidor | Pendiente | Pendiente |
| Fallo de red o proveedor | Borrador conservado; reintento sin envío duplicado | Pendiente | Pendiente |
| Teclado abierto con PDF listo | Pregunta, enviar y detener accesibles | Pendiente | Pendiente |
| Seleccionar y quitar PDF/imagen | Estados reales, propiedad y limpieza correctas | Pendiente | Pendiente |
| Tema claro/oscuro y lector de pantalla | Contraste, etiquetas, foco y anuncios comprensibles | Pendiente | Pendiente |

La vista previa local actual escucha en `127.0.0.1:3101` y contiene únicamente datos sintéticos. Un teléfono no comparte el `localhost` de Windows; la conexión del dispositivo debe configurarse para el entorno de pruebas elegido. No sustituir la URL por la base de pacientes real para eludir esta limitación.
