import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { BRIDGE_SCRIPT } from "./bridge";

// The portal's web address. GitHub Actions sets it from the WEB_URL repository variable; it is a
// public address, not a secret. Everything the app shows comes from this site and its API.
const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || "https://time-track-front.vercel.app").replace(/\/+$/, "");
const WEB_ORIGIN = new URL(WEB_URL).origin;

SplashScreen.preventAutoHideAsync().catch(() => undefined);

type BridgeMessage =
  | { type: "download"; name: string; mime: string; base64: string }
  | { type: "downloadFailed"; message: string }
  | { type: "print" }
  | { type: "theme"; primary: string; background: string };

const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || "download";

async function saveAndShare(name: string, mime: string, base64: string) {
  const file = new File(Paths.cache, `${Date.now()}-${safeName(name)}`);
  file.write(base64, { encoding: "base64" });
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device");
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
}

function Portal() {
  const web = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [colors, setColors] = useState({ primary: "#ffffff", background: "#f5f6f8" });

  const hideSplash = useCallback(() => { SplashScreen.hideAsync().catch(() => undefined); }, []);
  useEffect(() => {
    const timer = setTimeout(hideSplash, 8000); // never keep the splash up if the site is slow
    return () => clearTimeout(timer);
  }, [hideSplash]);

  // Android back: go back in the site first, leave the app only from its first page.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current) { web.current?.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, []);

  // Pages of the portal stay inside the app; WhatsApp, phone, email and other sites open outside it.
  const onNavigate = useCallback((req: ShouldStartLoadRequest) => {
    const { url } = req;
    if (url.startsWith("about:") || url.startsWith("blob:") || url.startsWith("data:")) return true;
    if (url.startsWith(WEB_ORIGIN)) return true;
    if (!req.isTopFrame) return true;
    Linking.openURL(url).catch(() => Alert.alert("Can't open this link", url));
    return false;
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let message: BridgeMessage;
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (message.type === "download") {
      saveAndShare(message.name, message.mime, message.base64).catch((err: Error) => Alert.alert("Download failed", err.message));
    } else if (message.type === "downloadFailed") {
      Alert.alert("Download failed", message.message);
    } else if (message.type === "print") {
      Alert.alert("Printing", "Printing isn't available in the app. Download the file instead, or print from the website on a computer.");
    } else if (message.type === "theme") {
      setColors({ primary: message.primary || "#ffffff", background: message.background || "#f5f6f8" });
    }
  }, []);

  const retry = () => { setFailed(false); setLoading(true); web.current?.reload(); };
  const lightBar = colors.primary !== "#ffffff";

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <StatusBar style={lightBar ? "light" : "dark"} />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.primary }} />
      <SafeAreaView edges={["left", "right", "bottom"]} style={styles.fill}>
        <WebView
          ref={web}
          source={{ uri: WEB_URL }}
          style={styles.fill}
          injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onNavigate}
          onNavigationStateChange={(state) => { canGoBack.current = state.canGoBack; }}
          onLoadEnd={() => { setLoading(false); hideSplash(); }}
          onError={() => { setFailed(true); setLoading(false); hideSplash(); }}
          applicationNameForUserAgent="NFSkillsApp/1.0"
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          allowFileAccess={false}
          allowsBackForwardNavigationGestures
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
          setSupportMultipleWindows={false}
          pullToRefreshEnabled
          startInLoadingState={false}
          cacheEnabled
        />
        {loading && !failed && (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator size="large" color={lightBar ? colors.primary : "#3b5bdb"} />
          </View>
        )}
        {failed && (
          <View style={[styles.overlay, styles.offline]} accessibilityRole="alert">
            <Text style={styles.title}>No connection</Text>
            <Text style={styles.body}>The portal couldn't be reached. Check your internet connection and try again.</Text>
            <Pressable onPress={retry} style={styles.button} accessibilityRole="button">
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Portal />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  offline: { backgroundColor: "#ffffff", padding: 32, gap: 12 },
  title: { fontSize: 20, fontWeight: "700", color: "#1b2236" },
  body: { fontSize: 15, color: "#5a6275", textAlign: "center", lineHeight: 22 },
  button: { marginTop: 8, backgroundColor: "#3b5bdb", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
});
