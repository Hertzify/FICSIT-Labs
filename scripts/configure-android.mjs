import fs from 'node:fs';

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
