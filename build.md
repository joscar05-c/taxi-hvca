# Guía de Compilación Android (Monorepo Windows)

Si alternas compilaciones entre `app-pasajero` y `app-conductor` en Windows y Gradle falla con errores de archivos bloqueados (`Unable to delete file ...\classes.jar`), ejecuta primero la limpieza de daemons y cachés nativas:

```bash
npm run android:clean
```

# Pasajero:
npm exec --workspace=app-pasajero -- expo prebuild --platform android --clean
npm exec --workspace=app-pasajero -- expo run:android --port 8083
npm exec --workspace=app-pasajero -- expo start --port 8083


# Conductor:
npm exec --workspace=app-conductor -- expo prebuild --platform android --clean
npm exec --workspace=app-conductor -- expo run:android --port 8081
npm exec --workspace=app-conductor -- expo start --port 8081
