package app.quransunna.reader;

import android.os.Build;
import android.view.HapticFeedbackConstants;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Мягкий системный отклик касания (как у кнопок Android), а не вибромотор с фиксированной силой. */
@CapacitorPlugin(name = "Feedback")
public class FeedbackPlugin extends Plugin {
    @PluginMethod
    public void perform(PluginCall call) {
        final String kind = call.getString("kind", "tick");
        getActivity().runOnUiThread(() -> {
            int c;
            switch (kind) {
                case "tap": c = HapticFeedbackConstants.KEYBOARD_TAP; break;
                case "page": c = Build.VERSION.SDK_INT >= 23 ? HapticFeedbackConstants.CONTEXT_CLICK : HapticFeedbackConstants.KEYBOARD_TAP; break;
                case "success": c = Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.LONG_PRESS; break;
                default: c = HapticFeedbackConstants.CLOCK_TICK;
            }
            getBridge().getWebView().performHapticFeedback(c);
        });
        call.resolve();
    }
}
