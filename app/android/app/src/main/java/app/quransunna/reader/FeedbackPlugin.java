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
     * Пробные вибрации колеса выбора (номера 2–9): настоящие импульсы заданной длины и силы — мягче, чем системный CLOCK_TICK.
     * На телефонах без регулировки силы (или старше Android 8) срабатывает обычный короткий импульс.
     */
    @PluginMethod
    public void vibe(PluginCall call) {
        final int n = call.getInt("n", 2);
        android.os.Vibrator v = (android.os.Vibrator) getContext().getSystemService(android.content.Context.VIBRATOR_SERVICE);
        if (v != null && v.hasVibrator()) {
            long[] t; int[] a;
            switch (n) {
                case 2: t = new long[]{0, 12}; a = new int[]{0, 40}; break;
                case 3: t = new long[]{0, 8}; a = new int[]{0, 70}; break;
                case 4: t = new long[]{0, 5}; a = new int[]{0, 25}; break;
                case 5: t = new long[]{0, 16}; a = new int[]{0, 60}; break;
                case 6: t = new long[]{0, 6, 35, 6}; a = new int[]{0, 45, 0, 45}; break;
                case 7: t = new long[]{0, 22}; a = new int[]{0, 28}; break;
                case 8: t = new long[]{0, 4}; a = new int[]{0, 120}; break;
                default: t = null; a = null;
            }
            try {
                if (n == 9 && Build.VERSION.SDK_INT >= 29) {
                    v.vibrate(android.os.VibrationEffect.createPredefined(android.os.VibrationEffect.EFFECT_TICK));
                } else if (t != null && Build.VERSION.SDK_INT >= 26) {
                    if (t.length == 2) v.vibrate(android.os.VibrationEffect.createOneShot(t[1], v.hasAmplitudeControl() ? a[1] : android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                    else v.vibrate(android.os.VibrationEffect.createWaveform(t, v.hasAmplitudeControl() ? a : null, -1));
                } else {
                    v.vibrate(10);
                }
            } catch (Exception e) { /* вибрация не обязательна */ }
        }
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
