// Runs in CI after `expo prebuild`. Makes the release APK use your own signing key, read from
// environment variables that GitHub Actions fills from repository secrets, and gives each build a
// higher version code so a new APK installs over the old one. Nothing secret is written to disk
// here: build.gradle only names the environment variables.
const fs = require("fs");
const path = require("path");

const gradle = path.join(__dirname, "..", "android", "app", "build.gradle");
let text = fs.readFileSync(gradle, "utf8");

const replaceOnce = (pattern, replacement, label) => {
  if (!pattern.test(text)) throw new Error(`build.gradle: couldn't find ${label}; the Expo template changed`);
  text = text.replace(pattern, replacement);
};

const versionCode = Number(process.env.APP_VERSION_CODE || "");
if (Number.isInteger(versionCode) && versionCode > 0) {
  replaceOnce(/versionCode \d+/, `versionCode ${versionCode}`, "versionCode");
}

if (process.env.ANDROID_KEYSTORE_PATH) {
  replaceOnce(
    /signingConfigs \{\n(\s+)debug \{/,
    (_match, indent) => [
      "signingConfigs {",
      `${indent}release {`,
      `${indent}    storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))`,
      `${indent}    storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")`,
      `${indent}    keyAlias System.getenv("ANDROID_KEY_ALIAS")`,
      `${indent}    keyPassword System.getenv("ANDROID_KEY_PASSWORD")`,
      `${indent}}`,
      `${indent}debug {`,
    ].join("\n"),
    "signingConfigs",
  );
  replaceOnce(
    /(release \{\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/,
    "$1signingConfig signingConfigs.release",
    "the release signingConfig",
  );
  console.log("Release builds are signed with the key from ANDROID_KEYSTORE_PATH.");
} else {
  console.log("No ANDROID_KEYSTORE_PATH: the release APK keeps the debug signature.");
}

fs.writeFileSync(gradle, text);
