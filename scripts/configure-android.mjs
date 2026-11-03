import fs from 'node:fs';
import path from 'node:path';

// 1. Patch AndroidManifest.xml with android:isGame="true", android:appCategory="game", and sensorLandscape
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
if (fs.existsSync(manifestPath)) {
  let xml = fs.readFileSync(manifestPath, 'utf8');
  if (!xml.includes('android:appCategory')) {
    xml = xml.replace(
      '<application',
      '<application android:isGame="true" android:appCategory="game"'
    );
  }
  if (!xml.includes('android:screenOrientation')) {
    xml = xml.replace(
      '<activity',
      '<activity android:screenOrientation="sensorLandscape"'
    );
  }
  fs.writeFileSync(manifestPath, xml, 'utf8');
  console.log('Patched AndroidManifest.xml with game category and sensorLandscape.');
}

// 2. Patch styles.xml with android:windowFullscreen
const stylesPath = 'android/app/src/main/res/values/styles.xml';
if (fs.existsSync(stylesPath)) {
  let styles = fs.readFileSync(stylesPath, 'utf8');
  if (!styles.includes('android:windowFullscreen')) {
    styles = styles.replace(
      '<item name="windowNoTitle">true</item>',
      '<item name="windowNoTitle">true</item>\n        <item name="android:windowFullscreen">true</item>'
    );
    fs.writeFileSync(stylesPath, styles, 'utf8');
    console.log('Patched styles.xml with windowFullscreen.');
  }
}

// 3. Patch MainActivity.java for Immersive Sticky Fullscreen Game Mode
const mainActivityPath =
  'android/app/src/main/java/com/ficsit/nodelabs/MainActivity.java';
if (fs.existsSync(mainActivityPath)) {
  const javaSource = `package com.ficsit.nodelabs;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableImmersiveGameMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        enableImmersiveGameMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveGameMode();
        }
    }

    @SuppressWarnings("deprecation")
    private void enableImmersiveGameMode() {
        Window window = getWindow();
        if (window == null) return;

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.hide(
                    WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars()
                );
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
        } else {
            View decorView = window.getDecorView();
            decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }
    }
}
`;
  fs.writeFileSync(mainActivityPath, javaSource, 'utf8');
  console.log('Patched MainActivity.java with immersive game fullscreen mode.');
}

// 4. Deploy Permanent Keystore & Patch build.gradle with versionCode and stable signing
// This ensures every APK built across any GitHub Actions runner has the IDENTICAL signature
// so Android allows in-place updates without uninstalling.
const targetKeystorePath = 'android/app/app-release.keystore';
if (fs.existsSync('android/app')) {
  if (fs.existsSync('signing/app-release.keystore')) {
    fs.copyFileSync('signing/app-release.keystore', targetKeystorePath);
    console.log(`Copied signing/app-release.keystore to ${targetKeystorePath}.`);
  } else if (fs.existsSync('signing/keystore.base64')) {
    const b64 = fs.readFileSync('signing/keystore.base64', 'utf8').trim();
    fs.writeFileSync(targetKeystorePath, Buffer.from(b64, 'base64'));
    console.log(`Decoded signing/keystore.base64 into ${targetKeystorePath}.`);
  }
}

const gradlePath = 'android/app/build.gradle';
if (fs.existsSync(gradlePath)) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const cleanVer = (pkg.version || '0.0.09').replace(/[^0-9.]/g, '');
  const parts = cleanVer.split('.').map((n) => parseInt(n, 10) || 0);
  // Semantic integer version code: e.g. 0.0.09 -> 9; 0.1.0 -> 100; 1.0.0 -> 10000
  const versionCode = (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
  const versionName = pkg.version || '0.0.09';

  let gradle = fs.readFileSync(gradlePath, 'utf8');

  // Update versionCode and versionName
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  gradle = gradle.replace(/versionName\s+["'][^"']+["']/, `versionName "${versionName}"`);

  // Inject permanent signingConfigs and wire into both debug and release buildTypes
  if (!gradle.includes('signingConfigs {')) {
    const newBuildTypes = `signingConfigs {
        release {
            storeFile file('app-release.keystore')
            storePassword 'ficsit-node-labs'
            keyAlias 'ficsit'
            keyPassword 'ficsit-node-labs'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.release
        }
        release {
            signingConfig signingConfigs.release`;

    if (/buildTypes\s*\{\s*release\s*\{/.test(gradle)) {
      gradle = gradle.replace(/buildTypes\s*\{\s*release\s*\{/, newBuildTypes);
    } else {
      gradle = gradle.replace(/buildTypes\s*\{/, newBuildTypes);
    }
  }

  fs.writeFileSync(gradlePath, gradle, 'utf8');
  console.log(
    `Patched build.gradle: versionCode=${versionCode}, versionName="${versionName}", signingConfig applied to all builds.`
  );
}
