# Guía de Compilación y Ejecución en LDPlayer 9 (Monorepo Windows)

## 1. Configuración de LDPlayer 9 para Depuración ADB
Para que ADB y React Native se comuniquen con LDPlayer 9:
1. En la barra lateral de LDPlayer 9, abrir **Ajustes (engranaje)** -> **Otros ajustes**.
2. En **Depuración de ADB**, seleccionar **Abrir conexión local** (guarda `"basicSettings.adbDebug": 1` en `vms/config/leidian0.config`).
3. Guardar y reiniciar el emulador.
4. Conectar el puente ADB:
   ```powershell
   adb connect 127.0.0.1:5555
   adb devices
   # Aparecerá como emulator-5554 (o 127.0.0.1:5555)
   ```

## 2. Redirección de Puertos Metro en LDPlayer 9
Para probar ambas aplicaciones simultáneamente en el mismo emulador:
```powershell
adb -s emulator-5554 reverse tcp:8081 tcp:8081
adb -s emulator-5554 reverse tcp:8083 tcp:8083
```

## 3. Puertos Asignados por Aplicación
- **Conductor (`app-conductor`)**: Metro Bundler en puerto `8081`
  - Paquete: `com.joscar03.dev.appconductor`
  - Host de depuración fijado: `localhost:8081`
- **Pasajero (`app-pasajero`)**: Metro Bundler en puerto `8083`
  - Paquete: `com.joscar03.dev.apppasajero`
  - Host de depuración fijado: `localhost:8083`

## 4. Ejecución en Segundo Plano de los Bundlers
En terminales separadas (o tareas en segundo plano):

```powershell
# Bundler Pasajero (Puerto 8083):
npm exec --workspace=app-pasajero -- expo start --port 8083

# Bundler Conductor (Puerto 8081):
npm exec --workspace=app-conductor -- expo start --port 8081
```

## 5. Lanzamiento Directo en el Emulador
Para abrir o traer al frente cualquiera de las dos aplicaciones en LDPlayer:

```powershell
# Abrir Pasajero:
adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d "exp+app-pasajero://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8083"

# Abrir Conductor:
adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d "exp+app-conductor://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

## 6. Limpieza y Recompilación Nativa (Si se requiere)
Si alternas cambios nativos en Windows y Gradle reporta bloqueos de archivos:
```powershell
npm run android:clean

# Recompilar Pasajero:
cd apps/app-pasajero/android; .\gradlew app:assembleDebug; cd ../../..

# Recompilar Conductor:
cd apps/app-conductor/android; .\gradlew app:assembleDebug; cd ../../..
```
