import { StyleSheet, View, type ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Icono,
  colores,
  radios,
  useAuthStore,
  type NombreIcono,
} from '@hvca/shared';

function TabIcono({
  nombre,
  color,
  focused,
}: {
  nombre: NombreIcono;
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <View style={[styles.pildora, focused && styles.pildoraActiva]}>
      <Icono nombre={nombre} size={20} color={color} activo={focused} />
    </View>
  );
}

export default function TabsLayout() {
  const { session, perfil } = useAuthStore();
  const insets = useSafeAreaInsets();

  if (!session || (perfil && perfil.rol !== 'pasajero')) {
    return <Redirect href="/login" />;
  }

  const paddingInferior = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.textoSuave,
        tabBarLabelStyle: styles.etiqueta,
        tabBarStyle: [
          styles.barra,
          {
            height: 58 + paddingInferior,
            paddingBottom: paddingInferior,
          },
        ],
      }}
    >
      <Tabs.Screen
        name="mapa"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color, focused }) => (
            <TabIcono nombre="mapa" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Mis Viajes',
          tabBarIcon: ({ color, focused }) => (
            <TabIcono nombre="viajes" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Mi Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcono nombre="perfil" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barra: {
    backgroundColor: colores.fondo,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    paddingTop: 6,
    elevation: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  etiqueta: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  pildora: {
    width: 44,
    height: 28,
    borderRadius: radios.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pildoraActiva: {
    backgroundColor: colores.primarioSuave,
  },
});