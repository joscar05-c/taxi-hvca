import { StyleSheet, Text } from 'react-native';

import { Button, PantallaCentrada, colores, supabase } from '@hvca/shared';

export default function PantallaMapa() {
  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  return (
    <PantallaCentrada>
      <Text style={styles.titulo}>Mapa</Text>
      <Text style={styles.texto}>
        Aquí se mostrará el mapa de la ciudad y las solicitudes de pasajero.
      </Text>
      <Button label="Cerrar sesión" variante="secundario" onPress={cerrarSesion} />
    </PantallaCentrada>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontSize: 24,
    fontWeight: '700',
    color: colores.texto,
  },
  texto: {
    color: colores.textoSuave,
    textAlign: 'center',
    marginVertical: 12,
  },
});