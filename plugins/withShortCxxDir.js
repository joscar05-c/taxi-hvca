const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

/**
 * Configura un directorio `.cxx` corto en la raíz del monorepo para evitar el
 * límite de 260 caracteres de Ninja/CMake en Windows y desactiva el VFS watch
 * de Gradle para prevenir bloqueos de archivos JAR.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @param {{ subdir?: string }} [options]
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withShortCxxDir(config, { subdir = 'app' } = {}) {
  config = withAppBuildGradle(config, (modConfig) => {
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

  config = withGradleProperties(config, (modConfig) => {
    const existing = modConfig.modResults.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.vfs.watch',
    );
    if (existing) {
      existing.value = 'false';
    } else {
      modConfig.modResults.push({
        type: 'property',
        key: 'org.gradle.vfs.watch',
        value: 'false',
      });
    }
    return modConfig;
  });

  return config;
}

module.exports = withShortCxxDir;
