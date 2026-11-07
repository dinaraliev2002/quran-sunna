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

    /**
     * Исключает полоску у правого края из системных жестов «назад» (Android 10+, у Samsung — жесты One UI),
     * чтобы язычок боковой панели можно было тянуть влево. Android разрешает не больше 200dp по высоте на край.
     * top/height — положение язычка в пикселях экрана (CSS-пиксели × плотность считаем здесь); height = 0 — снять исключение.
     */
    @PluginMethod
    public void excludeEdge(PluginCall call) {
        final double top = call.getDouble("top", 0.0);
        final double height = call.getDouble("height", 0.0);
        getActivity().runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT < 29) return;
            android.view.View v = getBridge().getWebView();
            if (height <= 0) { v.setSystemGestureExclusionRects(java.util.Collections.emptyList()); return; }
            float d = v.getResources().getDisplayMetrics().density;
            int maxH = (int) (200 * d);
            int h = Math.min((int) (height * d), maxH);
            int t = (int) (top * d);
            int w = (int) (40 * d); // ширина полосы у края
            int right = v.getWidth();
            android.graphics.Rect r = new android.graphics.Rect(right - w, Math.max(0, t), right, Math.max(0, t) + h);
            v.setSystemGestureExclusionRects(java.util.Collections.singletonList(r));
        });
        call.resolve();
    }
}
