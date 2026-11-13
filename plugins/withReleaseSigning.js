const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING_GUARD = `
gradle.taskGraph.whenReady { taskGraph ->
    if (taskGraph.allTasks.any { it.name.toLowerCase().contains('release') }) {
        ['BUDGET_UPLOAD_STORE_FILE', 'BUDGET_UPLOAD_STORE_PASSWORD', 'BUDGET_UPLOAD_KEY_ALIAS', 'BUDGET_UPLOAD_KEY_PASSWORD'].each { prop ->
            if (!project.hasProperty(prop) || !project.property(prop)?.toString()?.trim()) {
                throw new GradleException("Missing required release signing Gradle property: \${prop}. Check ~/.gradle/gradle.properties.")
            }
        }
    }
}
`;

/**
 * Config plugin active ONLY when BUDGET_RELEASE_SIGNING=new.
 * Configures Android release builds to sign with the private keystore defined in
 * user-level ~/.gradle/gradle.properties instead of debug.keystore.
 */
function withReleaseSigning(config) {
  if (process.env.BUDGET_RELEASE_SIGNING !== 'new') {
    return config;
  }

  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes('BUDGET_UPLOAD_STORE_FILE')) {
      const releaseConfigBlock = `
        release {
            if (project.hasProperty('BUDGET_UPLOAD_STORE_FILE')) {
                storeFile file(BUDGET_UPLOAD_STORE_FILE)
                storePassword BUDGET_UPLOAD_STORE_PASSWORD
                keyAlias BUDGET_UPLOAD_KEY_ALIAS
                keyPassword BUDGET_UPLOAD_KEY_PASSWORD
            }
        }`;

      const signingPattern = /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\}\r?\n)(\s*\})/;
      if (!signingPattern.test(contents)) {
        throw new Error('withReleaseSigning: could not locate android.signingConfigs block in build.gradle.');
      }
      contents = contents.replace(signingPattern, `$1${releaseConfigBlock}\n$2`);
    }

    const releaseBuildTypePattern = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
    if (releaseBuildTypePattern.test(contents)) {
      contents = contents.replace(releaseBuildTypePattern, '$1signingConfig signingConfigs.release');
    } else if (!contents.includes('signingConfig signingConfigs.release')) {
      throw new Error('withReleaseSigning: could not locate release signingConfig in android/app/build.gradle.');
    }

    if (!contents.includes('Missing required release signing Gradle property')) {
      contents = `${contents.trimEnd()}\n${RELEASE_SIGNING_GUARD}`;
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withReleaseSigning;
