require('colors');
const glob = require('glob');
const fs = require('fs');
const path = require('path');
const defaultFeatures = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'))
).defaultFeatures;

const NEW_SETTINGS_PROJECT_DIR = 'src/extension/features';
const ALL_SETTINGS_OUTPUT = 'src/core/settings/settings.ts';
const SETTINGS_JSON = 'scripts/settings.json';
const REQUIRED_SETTINGS = ['name', 'type', 'default', 'section', 'title'];

const settingMigrationMap = {
  ConfirmEditTransactionCancellation: {
    oldSettingName: 'ConfirmKeyboardCancelationOfTransactionChanges',
  },
  ToggleMasterCategories: {
    oldSettingName: 'CategorySoloMode',
    settingMapping: {
      'cat-solo-mode': true,
      'cat-toggle-all': true,
      'cat-solo-mode-toggle-all': true,
      0: false,
    },
  },
  LiveOnLastMonthsIncome: {
    oldSettingName: 'IncomeFromLastMonth',
  },
};

let previousSettings;

function run(callback) {
  previousSettings = new Set();
  gatherNewSettings()
    .then(
      (settings) => {
        let validatedSettings = [];
        settings.forEach((setting) => {
          if (Array.isArray(setting.setting)) {
            setting.setting.forEach((subSetting) => {
              let validatedSetting = validateSetting({
                setting: subSetting,
                file: setting.file,
              });

              if (validatedSetting.hidden !== true) {
                validatedSettings.push(validatedSetting);
              }
            });
          } else {
            let validatedSetting = validateSetting(setting);

            if (validatedSetting.hidden !== true) {
              validatedSettings.push(validatedSetting);
            }
          }
        });

        let allSettingsFile = generateAllSettingsFile(validatedSettings);
        fs.writeFile(ALL_SETTINGS_OUTPUT, allSettingsFile, () => {
          fs.writeFile(SETTINGS_JSON, JSON.stringify(validatedSettings), callback);
        });
      },
      (reason) => {
        callback(reason);
      }
    )
    .catch((exception) => {
      callback(exception.stack);
    });
}

function gatherNewSettings() {
  return new Promise((resolve, reject) => {
    glob(path.join(NEW_SETTINGS_PROJECT_DIR, '**', 'settings.js'), (error, files) => {
      if (error) return reject(error);

      resolve(
        files.map((file) => {
          const setting = require(path.join(__dirname, '..', file)); // eslint-disable-line global-require
          return { file, setting };
        })
      );
    });
  });
}

function isFeatureEnabled(setting) {
  return (
    (typeof setting === 'boolean' && setting) || (typeof setting === 'string' && setting !== '0')
  );
}

function validateSetting(settingObj) {
  const featureSettings = settingObj.setting;
  const settingFilename = settingObj.file;

  if (featureSettings.section === 'system') {
    return featureSettings;
  }

  REQUIRED_SETTINGS.forEach((requiredSetting) => {
    if (
      typeof featureSettings[requiredSetting] === 'undefined' ||
      featureSettings[requiredSetting] === null
    ) {
      logFatal(settingFilename, `"${requiredSetting}" is a required setting for all features.`);
    }
  });

  featureSettings.description = featureSettings.description || '';

  if (previousSettings.has(featureSettings.name)) {
    logFatal(settingFilename, `Duplicate Setting: ${featureSettings.name}`);
  }

  previousSettings.add(featureSettings.name);

  if (!['checkbox', 'select', 'color'].includes(featureSettings.type)) {
    logFatal(
      settingFilename,
      `type "${featureSettings.type}" is invalid. Allowed types are: "select", "checkbox", and "color"`
    );
  }

  if (
    featureSettings.type !== 'color' &&
    isFeatureEnabled(featureSettings.default) &&
    !defaultFeatures.includes(featureSettings.name)
  ) {
    logWarning(
      settingFilename,
      `${featureSettings.name} is not expected to be defaulted to on. If this default was intentional, add the feature name to the defaultFeatures array found in package.json`
    );
  }

  return featureSettings;
}

function logFatal(settingFilename, message) {
  console.log(`Invalid setting found in ${settingFilename}`.red);
  console.log(`\t${message}\n`.red);
  process.exit(1);
}

function logWarning(settingFilename, message) {
  console.log(`Warning! Potential error found in ${settingFilename}`.yellow);
  console.log(`\t${message}\n`.yellow);
}

function generateAllSettingsFile(allSettings) {
  return `/* eslint-disable */
/*
 ***********************************************************
 * Warning: This is a file generated by the build process. *
 *                                                         *
 * Any changes you make manually will be overwritten       *
 * the next time you run ./build or build.bat!             *
 ***********************************************************
*/
if (typeof window.ynabToolKit === 'undefined') { window.ynabToolKit = {} as any; }

declare global {
  type FeatureName = ${allSettings.map(({ name }) => `'${name}'`).join(' |\n')}
}

export const settingsMap: Record<FeatureName, FeatureSettingConfig> = ${JSON.stringify(
    allSettings.reduce((settings, current) => {
      settings[current.name] = current;
      return settings;
    }, {}),
    null,
    2
  )};

export const settingMigrationMap: {
  [K in keyof typeof settingsMap]?: {
    oldSettingName: string;
    settingMapping?: {
      [oldSettingValue: string]: FeatureSetting;
    };
  };
} = ${JSON.stringify(settingMigrationMap, null, 2)};

export const allToolkitSettings = Object.values(settingsMap);
`;
}

run((error) => {
  if (error) {
    console.log(`Error: ${error}`.red);
    process.exit(1);
  }

  process.exit();
});
