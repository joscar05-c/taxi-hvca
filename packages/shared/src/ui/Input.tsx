import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';

import { colores } from './theme';

export interface InputProps extends TextInputProps {
  etiqueta?: string;
}

export function Input({ etiqueta, style, ...rest }: InputProps) {
  return (
    <>
      {etiqueta ? <Text style={styles.etiqueta}>{etiqueta}</Text> : null}
      <TextInput
        placeholderTextColor={colores.textoSuave}
        autoCapitalize="none"
        {...rest}
        style={[styles.input, style]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  etiqueta: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.textoSuave,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colores.texto,
    backgroundColor: colores.fondo,
  },
});