import { HapticTouchable } from "@/components/haptic-touchable";
import { Ionicons } from "@expo/vector-icons";
import {
  Canvas,
  Circle,
  Fill,
  Group,
  ImageFormat,
  Line,
  Skia,
  Image as SkiaImage,
  useImage as useSkiaImage,
  vec,
} from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const MAX_ZOOM = 4; // 4x max magnification
const RING = 2; // ring stroke width
const THUMB = 28; // slider thumb diameter

// Circular crop with zoom/pan. The crop circle is FIXED and centered; the image is scaled
// and panned beneath it (standard avatar cropper). Zoom is driven by pinch, the slider, or
// double-nothing — all write the same `scale` shared value. On confirm we map the circle
// back through the image transform to original pixels and mask to a transparent-corner PNG.
export default function CropScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [sliderVal, setSliderVal] = useState(0); // 0..1 → minScale..minScale*MAX_ZOOM
  const [sliderW, setSliderW] = useState(0); // measured slider track width

  // Bake EXIF rotation; result w/h are the TRUE post-rotation dims (onLoad lies on rotated).
  const [src, setSrc] = useState<{ uri: string; w: number; h: number } | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    ImageManipulator.manipulateAsync(imageUri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    })
      .then((r) => alive && setSrc({ uri: r.uri, w: r.width, h: r.height }))
      .catch(() => alive && setSrc({ uri: imageUri, w: 0, h: 0 }));
    return () => {
      alive = false;
    };
  }, [imageUri]);

  const skiaSrc = useSkiaImage(src?.uri ?? null);

  // Stage geometry (measured) and crop circle (fixed).
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const cx = useSharedValue(0);
  const cy = useSharedValue(0);
  const cr = useSharedValue(0);

  // Image transform: uniform scale about the stage center + translation, in stage px.
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const minScale = useSharedValue(1); // scale at which the image just covers the circle
  const savedScale = useSharedValue(1);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage({ w: width, h: height });
  };

  // Once we have both stage size and image size, set up the circle + initial cover scale.
  useEffect(() => {
    if (!stage.w || !src?.w) return;
    const r = (Math.min(stage.w, stage.h) / 2) * 0.9;
    cx.value = stage.w / 2;
    cy.value = stage.h / 2;
    cr.value = r;
    // Scale so the image (drawn centered at native size) covers the circle diameter.
    const cover = Math.max((2 * r) / src.w, (2 * r) / src.h);
    minScale.value = cover;
    scale.value = cover;
    savedScale.value = cover;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
    setSliderVal(0);
    setReady(true);
  }, [stage, src]);

  // Keep the image covering the circle: clamp translation so no gap shows inside the circle.
  const clampPan = () => {
    "worklet";
    if (!src?.w) return;
    const halfW = (src.w * scale.value) / 2;
    const halfH = (src.h * scale.value) / 2;
    const maxTx = Math.max(0, halfW - cr.value);
    const maxTy = Math.max(0, halfH - cr.value);
    tx.value = Math.max(-maxTx, Math.min(tx.value, maxTx));
    ty.value = Math.max(-maxTy, Math.min(ty.value, maxTy));
  };

  const setZoom = (v: number) => {
    "worklet";
    scale.value = minScale.value * (1 + v * (MAX_ZOOM - 1));
    clampPan();
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      "worklet";
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onChange((ev) => {
      "worklet";
      tx.value = savedTx.value + ev.translationX;
      ty.value = savedTy.value + ev.translationY;
      clampPan();
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      "worklet";
      savedScale.value = scale.value;
    })
    .onChange((ev) => {
      "worklet";
      const next = Math.max(
        minScale.value,
        Math.min(savedScale.value * ev.scale, minScale.value * MAX_ZOOM),
      );
      scale.value = next;
      clampPan();
      // reflect back to the slider (0..1)
      const v = (next / minScale.value - 1) / (MAX_ZOOM - 1);
      runOnJS(setSliderVal)(Math.max(0, Math.min(1, v)));
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  // Custom slider: map an x within the track to 0..1 and drive zoom.
  const applySlider = (x: number) => {
    const v = Math.max(
      0,
      Math.min(1, sliderW > THUMB ? x / (sliderW - THUMB) : 0),
    );
    setSliderVal(v);
    setZoom(v);
  };
  const sliderGesture = Gesture.Pan()
    .onBegin((e) => runOnJS(applySlider)(e.x - THUMB / 2))
    .onChange((e) => runOnJS(applySlider)(e.x - THUMB / 2));

  // Skia transform for the preview: translate to center, apply scale+pan, draw image so its
  // center sits at origin.
  const transform = useDerivedValue(() => [
    { translateX: cx.value + tx.value },
    { translateY: cy.value + ty.value },
    { scale: scale.value },
  ]);
  // Sniper crosshair ticks straddling the ring at N/S/E/W.
  const TICK = 14;
  const tickTop = useDerivedValue(() =>
    vec(cx.value, cy.value - cr.value - TICK),
  );
  const tickTopIn = useDerivedValue(() =>
    vec(cx.value, cy.value - cr.value + TICK),
  );
  const tickBot = useDerivedValue(() =>
    vec(cx.value, cy.value + cr.value - TICK),
  );
  const tickBotOut = useDerivedValue(() =>
    vec(cx.value, cy.value + cr.value + TICK),
  );
  const tickLeft = useDerivedValue(() =>
    vec(cx.value - cr.value - TICK, cy.value),
  );
  const tickLeftIn = useDerivedValue(() =>
    vec(cx.value - cr.value + TICK, cy.value),
  );
  const tickRight = useDerivedValue(() =>
    vec(cx.value + cr.value - TICK, cy.value),
  );
  const tickRightOut = useDerivedValue(() =>
    vec(cx.value + cr.value + TICK, cy.value),
  );

  const imgX = useDerivedValue(() => -(src?.w ?? 0) / 2);
  const imgY = useDerivedValue(() => -(src?.h ?? 0) / 2);
  const imgW = src?.w ?? 0;
  const imgH = src?.h ?? 0;

  const confirm = async () => {
    if (!src?.w || !skiaSrc || !ready) return;
    setBusy(true);
    try {
      // Preview maps image pixel px→stage as: stage = center + t + s·(px − imgCenter).
      // The circle sits at the stage center (cx,cy), so inverting at that point:
      //   px = w/2 − tx/s,  py = h/2 − ty/s,  radius_in_px = cr/s.
      const s = scale.value;
      const px = src.w / 2 - tx.value / s;
      const py = src.h / 2 - ty.value / s;
      const pr = cr.value / s; // radius in image px
      const side = Math.round(pr * 2);
      const originX = Math.round(px - pr);
      const originY = Math.round(py - pr);

      const surface = Skia.Surface.MakeOffscreen(side, side);
      if (!surface) throw new Error("offscreen surface failed");
      const canvas = surface.getCanvas();
      const path = Skia.Path.Make();
      path.addCircle(side / 2, side / 2, side / 2);
      canvas.clipPath(path, 1 /* Intersect */, true);
      canvas.drawImage(skiaSrc, -originX, -originY);
      surface.flush();

      const bytes = surface
        .makeImageSnapshot()
        .encodeToBytes(ImageFormat.PNG, 100);
      const file = new File(Paths.cache, `crop-${side}.png`);
      file.write(bytes);
      router.replace({
        pathname: "/scanning",
        params: { imageUri: file.uri },
      });
    } catch (e) {
      console.warn("Circular crop failed, using full photo:", e);
      router.replace({
        pathname: "/scanning",
        params: { imageUri: src?.uri ?? imageUri },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HapticTouchable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#1C1C1E" />
        </HapticTouchable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Position the face</Text>
          <Text style={styles.subtitle}>pinch to zoom · drag to move</Text>
        </View>
        <HapticTouchable
          style={styles.iconBtn}
          onPress={() => router.push("/history")}
        >
          <Ionicons name="time-outline" size={24} color="#1C1C1E" />
        </HapticTouchable>
      </View>

      <GestureDetector gesture={gesture}>
        <View style={styles.stage} onLayout={onLayout}>
          {ready && skiaSrc && (
            <Canvas style={StyleSheet.absoluteFill}>
              <Group transform={transform}>
                <SkiaImage
                  image={skiaSrc}
                  x={imgX}
                  y={imgY}
                  width={imgW}
                  height={imgH}
                  fit="none"
                />
              </Group>
              {/* dim surround with a transparent circular hole. `layer` isolates this into
                  its own offscreen buffer so blendMode="clear" only erases the dim fill —
                  without it, "clear" punches through to the black page and hides the image. */}
              <Group layer>
                <Fill color="rgba(242,241,236,0.7)" />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={cr}
                  color="black"
                  blendMode="clear"
                />
              </Group>
              {/* light ring outline */}
              <Circle
                cx={cx}
                cy={cy}
                r={cr}
                color="#D8DEE0"
                style="stroke"
                strokeWidth={RING}
              />
              {/* sniper crosshair ticks at N/S/E/W */}
              <Line
                p1={tickTop}
                p2={tickTopIn}
                color="#1C1C1E"
                strokeWidth={2}
              />
              <Line
                p1={tickBot}
                p2={tickBotOut}
                color="#1C1C1E"
                strokeWidth={2}
              />
              <Line
                p1={tickLeft}
                p2={tickLeftIn}
                color="#1C1C1E"
                strokeWidth={2}
              />
              <Line
                p1={tickRight}
                p2={tickRightOut}
                color="#1C1C1E"
                strokeWidth={2}
              />
            </Canvas>
          )}
        </View>
      </GestureDetector>

      {ready && (
        <View style={styles.sliderRow}>
          <Ionicons name="image-outline" size={16} color="#8E8E93" />
          <View
            style={styles.slider}
            onLayout={(e) => setSliderW(e.nativeEvent.layout.width)}
          >
            <View style={styles.track} />
            <View
              style={[
                styles.trackFill,
                { width: sliderVal * (sliderW - THUMB) },
              ]}
            />
            <GestureDetector gesture={sliderGesture}>
              <View style={StyleSheet.absoluteFill}>
                <View
                  style={[
                    styles.thumb,
                    { left: sliderVal * (sliderW - THUMB) },
                  ]}
                />
              </View>
            </GestureDetector>
          </View>
          <Ionicons name="image" size={24} color="#8E8E93" />
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.caption}>DRAG THE BAR TO ZOOM-IN</Text>
        <HapticTouchable
          style={[styles.searchBtn, (busy || !ready) && styles.searchBtnDisabled]}
          onPress={confirm}
          disabled={busy || !ready}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="search" size={20} color="#FFFFFF" />
              <Text style={styles.searchText}>Start Search</Text>
            </>
          )}
        </HapticTouchable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F1EC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EAE8E1",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#1C1C1E" },
  subtitle: { fontSize: 15, color: "#8E8E93", marginTop: 2 },
  stage: { flex: 1, marginHorizontal: 8 },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  slider: { flex: 1, height: 40, justifyContent: "center" },
  track: {
    position: "absolute",
    left: THUMB / 2,
    right: THUMB / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C7C4BA",
  },
  trackFill: {
    position: "absolute",
    left: THUMB / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1C1C1E",
  },
  thumb: {
    position: "absolute",
    top: (40 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
    gap: 16,
  },
  caption: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#8E8E93",
  },
  searchBtn: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
});
