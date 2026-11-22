const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
} = require('@expo/config-plugins');

/**
 * Configura `com.google.android.geo.API_KEY` en AndroidManifest.xml usando un
 * placeholder resuelto desde `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (.env o env).
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withGoogleMapsApiKey(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      modConfig.modResults,
    );
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      'com.google.android.geo.API_KEY',
      '${GOOGLE_MAPS_API_KEY}',
    );
    return modConfig;
  });

  config = withAppBuildGradle(config, (modConfig) => {
    const contents = modConfig.modResults.contents;
    if (contents.includes('GOOGLE_MAPS_API_KEY')) {
      return modConfig;
    }

    const snippet = [
      '        def resolveGoogleMapsApiKey = {',
      '            def envKey = System.getenv("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY")',
      '            if (envKey != null && !envKey.trim().isEmpty()) {',
      '                return envKey.trim()',
      '            }',
      '            def envFile = new File(projectRoot, ".env")',
      '            if (envFile.exists()) {',
      '                def match = envFile.readLines("UTF-8").find { it.trim().startsWith("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=") }',
      '                if (match != null) {',
      "                    return match.substring(match.indexOf(\"=\") + 1).trim().replaceAll('^[\"\\']|[\"\\']$', '')",
      '                }',
      '            }',
      '            return ""',
      '        }',
      '        manifestPlaceholders["GOOGLE_MAPS_API_KEY"] = resolveGoogleMapsApiKey()',
    ].join('\n');

    modConfig.modResults.contents = contents.replace(
      /defaultConfig\s*\{/,
      (match) => `${match}\n${snippet}`,
    );

    return modConfig;
  });

  return config;
}

module.exports = withGoogleMapsApiKey;
