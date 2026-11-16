import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';

import {
  Button,
  Input,
  PantallaCentrada,
  SeccionVerificacionTelefono,
  authRepository,
  colores,
  useAuthStore,
} from '@hvca/shared';

export default function PantallaPerfilConductor() {
  const { session, perfil, setPerfil } = useAuthStore();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  const [vehiculo, setVehiculo] = useState(perfil?.vehiculo ?? '');
  const [dni, setDni] = useState(perfil?.dni_conductor ?? '');
  const [licencia, setLicencia] = useState(perfil?.licencia_conductor ?? '');
  const [soat, setSoat] = useState(perfil?.soat_conductor ?? '');
  const [guardandoDocs, setGuardandoDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);
  const [exitoDocs, setExitoDocs] = useState<string | null>(null);

  useEffect(() => {
    if (perfil) {
      if (perfil.vehiculo) setVehiculo(perfil.vehiculo);
      if (perfil.dni_conductor) setDni(perfil.dni_conductor);
      if (perfil.licencia_conductor) setLicencia(perfil.licencia_conductor);
      if (perfil.soat_conductor) setSoat(perfil.soat_conductor);
    }
  }, [perfil]);

  if (!session) {
    return <Redirect href="/login" />;
  }

  async function handleGuardarDocumentos() {
    setErrorDocs(null);
    setExitoDocs(null);

    if (!vehiculo.trim()) {
      setErrorDocs('Ingresa la marca, modelo y placa de tu vehículo.');
      return;
    }
    if (!/^\d{8}$/.test(dni.trim())) {
      setErrorDocs('El DNI debe tener exactamente 8 dígitos numéricos.');
      return;
    }
    if (licencia.trim().length < 5) {
      setErrorDocs('Ingresa tu número de licencia de conducir (Brevete).');
      return;
    }
    if (soat.trim().length < 4) {
      setErrorDocs('Ingresa el número o código de tu SOAT vigente.');
      return;
    }

    setGuardandoDocs(true);
    try {
      const actualizado = await authRepository.actualizarDocumentosConductor({
        vehiculo,
        dni_conductor: dni,
        licencia_conductor: licencia,
        soat_conductor: soat,
      });
      setPerfil(actualizado);
      setExitoDocs('Documentación y vehículo actualizados correctamente.');
      Alert.alert('¡Guardado!', 'Tus documentos de conductor están aprobados.');
    } catch (e: any) {
      setErrorDocs(e.message || 'No se pudieron guardar los documentos.');
    } finally {
      setGuardandoDocs(false);
    }
  }

  async function handleCerrarSesion() {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir de tu cuenta de conductor?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, salir',
          style: 'destructive',
          onPress: async () => {
            setCerrandoSesion(true);
            try {
              await authRepository.cerrarSesion();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'No se pudo cerrar sesión.');
            } finally {
              setCerrandoSesion(false);
            }
          },
        },
      ],
    );
  }

  const iniciales = (perfil?.nombre || session.user.email || 'C')
    .slice(0, 2)
    .toUpperCase();

  const docsAprobados = perfil?.estado_documentos === 'aprobado';

  return (
    <PantallaCentrada>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera del Conductor */}
        <View style={styles.headerPerfil}>
          <View style={styles.avatar}>
            <Text style={styles.textoAvatar}>{iniciales}</Text>
          </View>

          <View style={styles.infoUsuario}>
            <Text style={styles.nombre}>{perfil?.nombre || 'Conductor Taxi HVCA'}</Text>
            <Text style={styles.email}>{session.user.email || 'Sin correo asociado'}</Text>
            <View style={styles.badgeRol}>
              <Text style={styles.textoBadgeRol}>CONDUCTOR OFICIAL</Text>
            </View>
          </View>
        </View>

        {/* Métricas de Operación */}
        <View style={styles.filaMetricas}>
          <View style={styles.cardMetrica}>
            <Text style={styles.valorMetrica}>
              ★ {(perfil?.calificacion_promedio ?? 5.0).toFixed(1)}
            </Text>
            <Text style={styles.etiquetaMetrica}>Reputación</Text>
          </View>
          <View style={styles.cardMetrica}>
            <Text
              style={[
                styles.valorMetrica,
                { color: perfil?.esta_conectado ? '#059669' : '#6B7280' },
              ]}
            >
              {perfil?.esta_conectado ? 'En Línea' : 'Desconectado'}
            </Text>
            <Text style={styles.etiquetaMetrica}>Estado</Text>
          </View>
        </View>

        {/* Documentación y Vehículo (KYC) */}
        <View style={styles.cardVehiculo}>
          <View style={styles.cabeceraDocs}>
            <Text style={styles.tituloSeccion}>Documentación y Vehículo (KYC)</Text>
            <View
              style={[
                styles.badgeDocs,
                docsAprobados ? styles.badgeDocsOk : styles.badgeDocsPendiente,
              ]}
            >
              <Text
                style={[
                  styles.textoBadgeDocs,
                  docsAprobados
                    ? styles.textoBadgeDocsOk
                    : styles.textoBadgeDocsPendiente,
                ]}
              >
                {docsAprobados ? 'APROBADO' : 'PENDIENTE'}
              </Text>
            </View>
          </View>

          {exitoDocs ? <Text style={styles.exito}>{exitoDocs}</Text> : null}
          {errorDocs ? <Text style={styles.error}>{errorDocs}</Text> : null}

          <Input
            etiqueta="Vehículo (Marca, Modelo, Placa)"
            value={vehiculo}
            onChangeText={setVehiculo}
            placeholder="Toyota Yaris Blanco · ABC-123"
            autoCapitalize="words"
            style={styles.campoDoc}
          />
          <Input
            etiqueta="DNI del Conductor (8 dígitos)"
            value={dni}
            onChangeText={(txt) => setDni(txt.replace(/\D/g, ''))}
            placeholder="12345678"
            keyboardType="number-pad"
            maxLength={8}
            style={styles.campoDoc}
          />
          <Input
            etiqueta="Licencia de Conducir (Brevete)"
            value={licencia}
            onChangeText={setLicencia}
            placeholder="Q12345678"
            autoCapitalize="characters"
            style={styles.campoDoc}
          />
          <Input
            etiqueta="Número / Póliza SOAT vigente"
            value={soat}
            onChangeText={setSoat}
            placeholder="SOAT-2026-00123"
            autoCapitalize="characters"
            style={styles.campoDoc}
          />

          <Button
            label="Guardar Documentación"
            onPress={() => void handleGuardarDocumentos()}
            cargando={guardandoDocs}
            estilo={styles.botonDocs}
          />
        </View>

        {/* Validación Telefónica Obligatoria */}
        <SeccionVerificacionTelefono perfil={perfil} />

        {/* Cerrar Sesión */}
        <Button
          label="Cerrar Sesión"
          variante="peligro"
          onPress={handleCerrarSesion}
          cargando={cerrandoSesion}
          estilo={styles.botonSalir}
        />
      </ScrollView>
    </PantallaCentrada>
  );
}

const styles = StyleSheet.create({
  contenido: {
    width: '100%',
    maxWidth: 480,
    paddingVertical: 20,
  },
  headerPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoAvatar: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  infoUsuario: {
    flex: 1,
  },
  nombre: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.texto,
  },
  email: {
    fontSize: 13,
    color: colores.textoSuave,
    marginTop: 2,
  },
  badgeRol: {
    backgroundColor: '#DEF7EC',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#31C48D',
  },
  textoBadgeRol: {
    color: '#03543F',
    fontSize: 10,
    fontWeight: '800',
  },
  filaMetricas: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cardMetrica: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  valorMetrica: {
    fontSize: 18,
    fontWeight: '800',
    color: colores.texto,
  },
  etiquetaMetrica: {
    fontSize: 11,
    color: colores.textoSuave,
    marginTop: 2,
  },
  cardVehiculo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 6,
  },
  cabeceraDocs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
  },
  tituloSeccion: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  badgeDocs: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeDocsOk: {
    backgroundColor: '#DEF7EC',
    borderColor: '#31C48D',
  },
  badgeDocsPendiente: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  textoBadgeDocs: {
    fontSize: 10,
    fontWeight: '800',
  },
  textoBadgeDocsOk: {
    color: '#03543F',
  },
  textoBadgeDocsPendiente: {
    color: '#92400E',
  },
  campoDoc: {
    marginBottom: 12,
  },
  botonDocs: {
    marginTop: 4,
    minHeight: 44,
  },
  error: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  exito: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  botonSalir: {
    marginTop: 16,
  },
});
