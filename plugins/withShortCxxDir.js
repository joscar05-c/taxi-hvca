const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Configura un directorio `.cxx` corto en la raíz del monorepo para evitar el
 * límite de 260 caracteres de Ninja/CMake en Windows.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @param {{ subdir?: string }} [options]
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withShortCxxDir(config, { subdir = 'app' } = {}) {
  return withAppBuildGradle(config, (modConfig) => {
    const contents = modConfig.modResults.contents;
    if (contents.includes('buildStagingDirectory')) {
      return modConfig;
    }

    const snippet = [
      '    externalNativeBuild {',
      '        cmake {',
      `            buildStagingDirectory file("../../../../.cxx/${subdir}")`,
      '        }',
      '    }',
    ].join('\n');

    modConfig.modResults.contents = contents.replace(
      /^android\s*\{/m,
      (match) => `${match}\n${snippet}`,
    );

    return modConfig;
  });
}

module.exports = withShortCxxDir;
