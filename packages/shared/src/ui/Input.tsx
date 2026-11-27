import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Icono } from './Icono';
import { colores, radios } from './theme';

export interface InputProps extends TextInputProps {
  etiqueta?: string;
  prefijo?: string;
  esContrasena?: boolean;
  error?: string | null;
  contenedorEstilo?: ViewStyle;
}

export function Input({
  etiqueta,
  prefijo,
  esContrasena,
  error,
  contenedorEstilo,
  secureTextEntry,
  onFocus,
  onBlur,
  style,
  ...rest
}: InputProps) {
  const [enfocado, setEnfocado] = useState(false);
  const permiteOcultar = Boolean(esContrasena || secureTextEntry);
  const [oculto, setOculto] = useState(permiteOcultar);

  // Conserva compatibilidad si un consumidor pasa márgenes dentro de `style`.
  const flatStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  const margenesExternos: ViewStyle | undefined = flatStyle
    ? {
        margin: flatStyle.margin,
        marginTop: flatStyle.marginTop,
        marginBottom: flatStyle.marginBottom,
        marginLeft: flatStyle.marginLeft,
        marginRight: flatStyle.marginRight,
        marginVertical: flatStyle.marginVertical,
        marginHorizontal: flatStyle.marginHorizontal,
      }
    : undefined;

  const estiloTextoInterno: TextStyle | undefined = flatStyle
    ? {
        ...flatStyle,
        margin: undefined,
        marginTop: undefined,
        marginBottom: undefined,
        marginLeft: undefined,
        marginRight: undefined,
        marginVertical: undefined,
        marginHorizontal: undefined,
      }
    : undefined;

  return (
    <View style={[margenesExternos, contenedorEstilo]}>
      {etiqueta ? (
        <Text style={[styles.etiqueta, enfocado && styles.etiquetaActiva]}>
          {etiqueta}
        </Text>
      ) : null}
      <View
        style={[
          styles.cajaInput,
          enfocado && styles.cajaEnfocada,
          Boolean(error) && styles.cajaError,
        ]}
      >
        {prefijo ? <Text style={styles.prefijo}>{prefijo}</Text> : null}
        <TextInput
          placeholderTextColor={colores.textoSuave}
          autoCapitalize="none"
          {...rest}
          secureTextEntry={permiteOcultar ? oculto : false}
          onFocus={(e) => {
            setEnfocado(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setEnfocado(false);
            onBlur?.(e);
          }}
          style={[styles.input, estiloTextoInterno]}
        />
        {permiteOcultar ? (
          <Pressable
            onPress={() => setOculto((prev) => !prev)}
            hitSlop={10}
            style={styles.botonOjo}
            accessibilityLabel={oculto ? 'Mostrar contraseña' : 'Ocultar contraseña'}
          >
            <Icono
              nombre={oculto ? 'ojo' : 'ojoCerrado'}
              size={18}
              color={colores.textoSuave}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.textoError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  etiqueta: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.textoSecundario,
    marginBottom: 6,
  },
  etiquetaActiva: {
    color: colores.primario,
  },
  cajaInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colores.borde,
    borderRadius: radios.md,
    backgroundColor: colores.superficie,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  cajaEnfocada: {
    borderColor: colores.primario,
    backgroundColor: colores.fondo,
  },
  cajaError: {
    borderColor: colores.peligro,
    backgroundColor: colores.fondo,
  },
  prefijo: {
    fontSize: 15,
    fontWeight: '700',
    color: colores.textoSecundario,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 16,
    color: colores.texto,
  },
  botonOjo: {
    paddingLeft: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoError: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colores.peligro,
  },
});