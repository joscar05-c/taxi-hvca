import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Input,
  SeccionVerificacionTelefono,
  TarjetaCambioApp,
  authRepository,
  colores,
  radios,
  sombras,
  useAuthStore,
} from '@hvca/shared';

export default function PantallaPerfilConductor() {
  const insets = useSafeAreaInsets();
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
    if (perfil?.vehiculo) setVehiculo(perfil.vehiculo);
  }, [perfil?.vehiculo]);

  useEffect(() => {
    if (perfil?.dni_conductor) setDni(perfil.dni_conductor);
  }, [perfil?.dni_conductor]);

  useEffect(() => {
    if (perfil?.licencia_conductor) setLicencia(perfil.licencia_conductor);
  }, [perfil?.licencia_conductor]);

  useEffect(() => {
    if (perfil?.soat_conductor) setSoat(perfil.soat_conductor);
  }, [perfil?.soat_conductor]);

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
      setExitoDocs(
        'Documentación enviada a revisión. Un administrador validará tu cuenta pronto.',
      );
      Alert.alert(
        'Documentos enviados',
        'Tus documentos fueron enviados para revisión por un administrador.',
      );
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

  const estadoDocs = perfil?.estado_documentos ?? 'pendiente';
  const infoDocs = (() => {
    switch (estadoDocs) {
      case 'aprobado':
        return {
          etiqueta: 'APROBADO',
          badgeStyle: styles.badgeDocsOk,
          textoStyle: styles.textoBadgeDocsOk,
          avisoStyle: null,
          avisoTextoStyle: null,
          mensaje: null,
        };
      case 'en_revision':
        return {
          etiqueta: 'EN REVISIÓN',
          badgeStyle: styles.badgeDocsRevision,
          textoStyle: styles.textoBadgeDocsRevision,
          avisoStyle: styles.avisoDocsRevision,
          avisoTextoStyle: styles.textoAvisoDocsRevision,
          mensaje:
            '⏳ Tus documentos están siendo revisados por el equipo de Taxi HVCA. Podrás conectarte y ofertar apenas sean aprobados.',
        };
      case 'rechazado':
        return {
          etiqueta: 'RECHAZADO',
          badgeStyle: styles.badgeDocsRechazado,
          textoStyle: styles.textoBadgeDocsRechazado,
          avisoStyle: styles.avisoDocsRechazado,
          avisoTextoStyle: styles.textoAvisoDocsRechazado,
          mensaje:
            '❌ Tu documentación fue observada o rechazada. Verifica tus datos de vehículo, DNI, brevete y SOAT y vuelve a enviarlos.',
        };
      default:
        return {
          etiqueta: 'PENDIENTE',
          badgeStyle: styles.badgeDocsPendiente,
          textoStyle: styles.textoBadgeDocsPendiente,
          avisoStyle: styles.avisoDocsPendiente,
          avisoTextoStyle: styles.textoAvisoDocsPendiente,
          mensaje:
            '📄 Completa tu vehículo, DNI, brevete y SOAT para enviar tu cuenta a validación.',
        };
    }
  })();

  return (
    <View style={styles.pantalla}>
      <View
        style={[
          styles.cabeceraSuperior,
          { paddingTop: Math.max(insets.top, 16) + 4 },
        ]}
      >
        <Text style={styles.tituloPantalla}>Mi Perfil</Text>
        <Text style={styles.subtituloPantalla}>
          Cuenta, vehículo y documentación verificada
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.contenido,
          { paddingBottom: Math.max(insets.bottom, 20) + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.columnaCentral}>
          {/* Cabecera del Conductor */}
          <View style={[styles.headerPerfil, sombras.suave]}>
            <View style={styles.avatar}>
              <Text style={styles.textoAvatar}>{iniciales}</Text>
            </View>

            <View style={styles.infoUsuario}>
              <Text style={styles.nombre} numberOfLines={1}>
                {perfil?.nombre || 'Conductor Taxi HVCA'}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {session.user.email || 'Sin correo asociado'}
              </Text>
              <View style={styles.badgeRol}>
                <Text style={styles.textoBadgeRol}>CONDUCTOR OFICIAL</Text>
              </View>
            </View>
          </View>

          {/* Métricas de Operación */}
          <View style={styles.filaMetricas}>
            <View style={[styles.cardMetrica, sombras.suave]}>
              <Text style={styles.valorMetrica}>
                <Text style={styles.estrellaDorada}>★ </Text>
                {(perfil?.calificacion_promedio ?? 5.0).toFixed(1)}
              </Text>
              <Text style={styles.etiquetaMetrica}>Reputación</Text>
            </View>
            <View style={[styles.cardMetrica, sombras.suave]}>
              <View style={styles.filaEstadoMetrica}>
                <View
                  style={[
                    styles.puntoEstado,
                    {
                      backgroundColor: perfil?.esta_conectado
                        ? colores.exito
                        : colores.textoSuave,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.valorMetrica,
                    {
                      color: perfil?.esta_conectado
                        ? colores.exitoOscuro
                        : colores.textoSuave,
                    },
                  ]}
                >
                  {perfil?.esta_conectado ? 'En Línea' : 'Desconectado'}
                </Text>
              </View>
              <Text style={styles.etiquetaMetrica}>Estado</Text>
            </View>
          </View>

          {/* Documentación y Vehículo (KYC) */}
          <View style={[styles.cardVehiculo, sombras.suave]}>
            <View style={styles.cabeceraDocs}>
              <Text style={styles.tituloSeccion}>Documentación y Vehículo</Text>
              <View style={[styles.badgeDocs, infoDocs.badgeStyle]}>
                <Text style={[styles.textoBadgeDocs, infoDocs.textoStyle]}>
                  {infoDocs.etiqueta}
                </Text>
              </View>
            </View>

            {infoDocs.mensaje && infoDocs.avisoStyle && infoDocs.avisoTextoStyle ? (
              <View style={[styles.avisoDocsBase, infoDocs.avisoStyle]}>
                <Text style={[styles.textoAvisoDocsBase, infoDocs.avisoTextoStyle]}>
                  {infoDocs.mensaje}
                </Text>
              </View>
            ) : null}

            {exitoDocs ? (
              <View style={styles.bannerExito}>
                <Text style={styles.exito}>{exitoDocs}</Text>
              </View>
            ) : null}
            {errorDocs ? (
              <View style={styles.bannerError}>
                <Text style={styles.error}>{errorDocs}</Text>
              </View>
            ) : null}

            <Input
              etiqueta="Vehículo (Marca, Modelo, Placa)"
              value={vehiculo}
              onChangeText={setVehiculo}
              placeholder="Toyota Yaris Blanco · ABC-123"
              autoCapitalize="words"
              contenedorEstilo={styles.campoDoc}
            />
            <Input
              etiqueta="DNI del Conductor (8 dígitos)"
              value={dni}
              onChangeText={(txt) => setDni(txt.replace(/\D/g, ''))}
              placeholder="12345678"
              keyboardType="number-pad"
              maxLength={8}
              contenedorEstilo={styles.campoDoc}
            />
            <Input
              etiqueta="Licencia de Conducir (Brevete)"
              value={licencia}
              onChangeText={setLicencia}
              placeholder="Q12345678"
              autoCapitalize="characters"
              contenedorEstilo={styles.campoDoc}
            />
            <Input
              etiqueta="Número / Póliza SOAT vigente"
              value={soat}
              onChangeText={setSoat}
              placeholder="SOAT-2026-00123"
              autoCapitalize="characters"
              contenedorEstilo={styles.campoDoc}
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

          {/* Acceso directo a la app de Pasajero */}
          <TarjetaCambioApp
            destino="pasajero"
            urlTienda={process.env.EXPO_PUBLIC_PASAJERO_STORE_URL}
          />

          {/* Cerrar Sesión */}
          <Button
            label="Cerrar Sesión"
            variante="peligro"
            onPress={handleCerrarSesion}
            cargando={cerrandoSesion}
            estilo={styles.botonSalir}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.superficie,
  },
  cabeceraSuperior: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colores.fondo,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  tituloPantalla: {
    fontSize: 22,
    fontWeight: '800',
    color: colores.texto,
    letterSpacing: -0.3,
  },
  subtituloPantalla: {
    fontSize: 13,
    color: colores.textoSuave,
    marginTop: 2,
  },
  contenido: {
    padding: 16,
    alignItems: 'center',
  },
  columnaCentral: {
    width: '100%',
    maxWidth: 480,
  },
  headerPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colores.fondo,
    padding: 16,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    marginBottom: 12,
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
    color: colores.fondo,
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
    backgroundColor: colores.exitoSuave,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radios.sm - 2,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colores.exitoBorde,
  },
  textoBadgeRol: {
    color: colores.exitoOscuro,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  filaMetricas: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cardMetrica: {
    flex: 1,
    backgroundColor: colores.fondo,
    borderRadius: radios.lg - 2,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  filaEstadoMetrica: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  puntoEstado: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  estrellaDorada: {
    color: '#F59E0B',
  },
  valorMetrica: {
    fontSize: 17,
    fontWeight: '800',
    color: colores.texto,
  },
  etiquetaMetrica: {
    fontSize: 11,
    color: colores.textoSuave,
    marginTop: 3,
    fontWeight: '600',
  },
  cardVehiculo: {
    backgroundColor: colores.fondo,
    borderRadius: radios.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colores.borde,
    marginBottom: 4,
  },
  cabeceraDocs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colores.bordeSuave,
    paddingBottom: 10,
  },
  tituloSeccion: {
    fontSize: 15,
    color: colores.texto,
    fontWeight: '700',
  },
  badgeDocs: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radios.sm,
    borderWidth: 1,
  },
  badgeDocsOk: {
    backgroundColor: colores.exitoSuave,
    borderColor: colores.exitoBorde,
  },
  badgeDocsPendiente: {
    backgroundColor: colores.accentSuave,
    borderColor: '#F59E0B',
  },
  badgeDocsRevision: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  badgeDocsRechazado: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  textoBadgeDocs: {
    fontSize: 10,
    fontWeight: '800',
  },
  textoBadgeDocsOk: {
    color: colores.exitoOscuro,
  },
  textoBadgeDocsPendiente: {
    color: colores.accentOscuro,
  },
  textoBadgeDocsRevision: {
    color: '#1E40AF',
  },
  textoBadgeDocsRechazado: {
    color: '#991B1B',
  },
  avisoDocsBase: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  avisoDocsPendiente: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  avisoDocsRevision: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  avisoDocsRechazado: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  textoAvisoDocsBase: {
    fontSize: 12,
    lineHeight: 16,
  },
  textoAvisoDocsPendiente: {
    color: '#92400E',
  },
  textoAvisoDocsRevision: {
    color: '#1E3A8A',
  },
  textoAvisoDocsRechazado: {
    color: '#991B1B',
  },
  campoDoc: {
    marginBottom: 12,
  },
  botonDocs: {
    marginTop: 4,
  },
  bannerError: {
    backgroundColor: colores.peligroSuave,
    borderRadius: radios.sm + 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  error: {
    color: colores.peligroOscuro,
    fontSize: 12,
    fontWeight: '600',
  },
  bannerExito: {
    backgroundColor: colores.exitoSuave,
    borderRadius: radios.sm + 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  exito: {
    color: colores.exitoOscuro,
    fontSize: 12,
    fontWeight: '600',
  },
  botonSalir: {
    marginTop: 12,
  },
});
