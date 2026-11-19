---
trigger: always_on
description: Exige comitear y subir a origin todo cambio, funcionalidad o revisión usando Conventional Commits en español (prefijo en inglés).
---

# Regla obligatoria de Git: Commit y Push a `origin`

Para **toda nueva funcionalidad, cambio, corrección, revisión o actualización** en este proyecto:

1. **Commit obligatorio con Conventional Commits en español:**
   - Usa únicamente prefijos estándar en inglés y en minúsculas (`feat`, `fix`, `refactor`, `chore`, `docs`, `perf`, `test`, `style`, `build`, `ci`).
   - Escribe el alcance (opcional) y toda la descripción **en español** (ej. `feat(mapa): mostrar ruta del conductor`, `fix(otp): limitar intentos fallidos`, `refactor(shared): unificar tipos de tarifas`).
2. **Subida obligatoria a `origin`:**
   - Al terminar y verificar los cambios, ejecuta `git add`, `git commit -m "..."` y `git push origin HEAD` para sincronizar la rama actual con el remoto `origin`.
