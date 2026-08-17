const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidRelease(config) {
  config = AndroidConfig.Permissions.withPermissions(config, ['com.android.vending.BILLING']);
  return withAndroidManifest(config, (result) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(result.modResults);
    const activity = application.activity?.find((item) => item.$?.['android:name'] === '.MainActivity');
    if (activity?.$) activity.$['android:launchMode'] = 'singleTop';
    application.$['android:allowBackup'] = 'false';
    return result;
  });
};
