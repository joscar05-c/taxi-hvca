# Pasajero:
npm exec --workspace=app-pasajero -- expo prebuild --platform android --clean
npm exec --workspace=app-pasajero -- expo run:android --port 8082
npm exec --workspace=app-pasajero -- expo start --port 8082


# Conductor:
npm exec --workspace=app-conductor -- expo prebuild --platform android --clean
npm exec --workspace=app-conductor -- expo run:android --port 8081
npm exec --workspace=app-conductor -- expo start --port 8081

