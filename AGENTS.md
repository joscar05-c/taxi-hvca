# Reglas del proyecto Taxi HVCA

## Flujo obligatorio de Git (Commits y Push automático)

Toda nueva funcionalidad, cambio, corrección, refactorización, revisión o actualización de documentación realizada en este repositorio **debe ser comiteada y subida al repositorio remoto (`origin`)** al finalizar la tarea:

1. **Formato de mensajes (Conventional Commits):**
   - El prefijo del tipo de cambio debe ir **en inglés y en minúsculas**: `feat`, `fix`, `refactor`, `chore`, `docs`, `perf`, `test`, `style`, `build`, `ci`.
   - El alcance opcional y la descripción del commit deben estar redactados **íntegramente en español**.
   - Estructura: `<tipo>(<alcance opcional>): <descripción en español>`
   - Ejemplos válidos:
     - `feat(viajes): agregar cálculo automático de tarifa sugerida`
     - `fix(auth): validar token de Google antes de crear perfil`
     - `refactor(panel-admin): extraer componente de filtros de usuarios`
     - `docs: actualizar comandos de compilación para LDPlayer`
     - `chore: actualizar reglas de seguridad de Firestore`

2. **Publicación en remoto:**
   - Verificar cambios con `git status`.
   - Hacer `git add` de los archivos modificados/creados correspondientes a la tarea.
   - Ejecutar `git commit -m "<mensaje>"`.
   - Ejecutar `git push origin HEAD` (o a la rama activa en `origin`) para dejar el repositorio remoto actualizado.
