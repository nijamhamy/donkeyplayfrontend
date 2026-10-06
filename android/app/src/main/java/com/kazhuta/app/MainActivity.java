package com.donkygame.app;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep the screen on (no sleep / screen timeout) while the app is open.
        // Android clears this automatically when the app goes to the background
        // or is closed, so normal sleep behavior returns afterwards.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Capacitor 3+ registers plugins automatically, nothing else needed here.
    }
}