import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, SafeAreaView, Platform, StatusBar, TouchableOpacity, Text, View, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';

// [중요] GitHub Pages의 최신 코드를 가져올 주소
const WEB_URL = 'https://k97460300-coder.github.io/weather/assets/mobile.html';

// [기본] 네트워크 에러 시 사용할 백업 HTML
const FALLBACK_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Loading...</title></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f0f2f5;font-family:sans-serif;flex-direction:column;">
    <div style="font-size:18px;font-weight:bold;color:#333;margin-bottom:10px;">날씨 정보를 불러오는 중입니다...</div>
    <div style="font-size:14px;color:#666;">잠시만 기다려주세요.</div>
</body>
</html>
`;

export default function App() {
  const webviewRef = useRef(null);
  const viewShotRef = useRef(null);
  const [htmlContent, setHtmlContent] = useState(FALLBACK_HTML);
  const [status, requestPermission] = MediaLibrary.usePermissions();

  useEffect(() => {
    // 앱 시작 시 최신 HTML 코드를 다운로드 (Hot Code Push 방식)
    const fetchLatestHtml = async () => {
      try {
        // [수정] 강력한 캐시 방지 옵션 추가
        const response = await fetch(WEB_URL + '?t=' + new Date().getTime(), {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        const text = await response.text();
        setHtmlContent(text);
      } catch (error) {
        console.error("Failed to load remote HTML:", error);
        // 실패 시 기존 백업 HTML 유지 (또는 에러 메시지 표시)
      }
    };

    fetchLatestHtml();
  }, []);

  const handleCapture = async () => {
    try {
      if (!status?.granted) {
        const permission = await requestPermission();
        if (!permission.granted) {
          Alert.alert("Permission required", "Please allow access to media library to save screenshots.");
          return;
        }
      }

      const uri = await captureRef(viewShotRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [],
        { useNativeDriver: false }
      );
      
      const { width, height } = manipResult;
      const currentRatio = width / height;
      const targetRatio = 9 / 16;
      
      let actions = [];
      if (Math.abs(currentRatio - targetRatio) > 0.01) {
          let originX = 0;
          let originY = 0;
          let cropWidth = width;
          let cropHeight = height;

          if (currentRatio > targetRatio) {
              cropWidth = height * targetRatio;
              originX = (width - cropWidth) / 2;
          } else {
              cropHeight = width / targetRatio;
              originY = (height - cropHeight) / 2;
          }
          
          actions.push({
              crop: {
                  originX,
                  originY,
                  width: cropWidth,
                  height: cropHeight,
              }
          });
      }

      const finalResult = await ImageManipulator.manipulateAsync(
          uri,
          actions,
          { compress: 1, format: ImageManipulator.SaveFormat.PNG }
      );

      await MediaLibrary.saveToLibraryAsync(finalResult.uri);
      Alert.alert("Captured!", "Screenshot saved to gallery (9:16).");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to capture screen.");
    }
  };

  const handleCaptureAll = async () => {
    try {
      if (!status?.granted) {
        const permission = await requestPermission();
        if (!permission.granted) {
          Alert.alert("Permission required", "Please allow access to media library to save screenshots.");
          return;
        }
      }

      const cardCount = 9;
      Alert.alert("Starting Capture", `Capturing all ${cardCount} cards, please wait...`);

      for (let i = 0; i < cardCount; i++) {
        const newScrollX = `window.innerWidth * ${i}`;
        webviewRef.current.injectJavaScript(
          `window.scrollTo({ left: ${newScrollX}, top: 0, behavior: 'instant' }); true;`
        );

        await new Promise(resolve => setTimeout(resolve, 1000));

        const uri = await captureRef(viewShotRef, {
          format: "png",
          quality: 1,
          result: "tmpfile",
        });
        
        const manipResult = await ImageManipulator.manipulateAsync(uri, [], { useNativeDriver: false });
        const { width, height } = manipResult;
        const targetRatio = 9 / 16;
        let actions = [];

        if (Math.abs((width / height) - targetRatio) > 0.01) {
            let cropWidth = height * targetRatio;
            let originX = (width - cropWidth) / 2;
            actions.push({ crop: { originX: Math.round(originX), originY: 0, width: Math.round(cropWidth), height: height } });
        }
        
        const finalResult = await ImageManipulator.manipulateAsync(
            uri,
            actions,
            { compress: 1, format: ImageManipulator.SaveFormat.PNG }
        );

        const asset = await MediaLibrary.createAssetAsync(finalResult.uri);
        const album = await MediaLibrary.getAlbumAsync('WeatherApp');
        if (album == null) {
          await MediaLibrary.createAlbumAsync('WeatherApp', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      }

      Alert.alert("Capture Complete", `Saved ${cardCount} separate images to 'WeatherApp' album in your gallery.`);

    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to capture all cards.");
    } finally {
      webviewRef.current.injectJavaScript(
        `window.scrollTo({ left: 0, top: 0, behavior: 'instant' }); true;`
      );
    }
  };
  // [수정] 네이티브 브릿지: 프록시 제거 및 CCTV 허용 설정
  const INJECTED_CODE = `
    (function() {
      if (window.isNativeBridgeInjected) return;
      window.isNativeBridgeInjected = true;

      // CORS 경고창 숨기기
      try {
        const style = document.createElement('style');
        style.innerHTML = '.cors-alert { display: none !important; }';
        document.head.appendChild(style);
      } catch(e) {}

      const originalFetch = window.fetch;
      window.fetchCallbacks = {};

      window.fetch = async (input, init) => {
        let url = typeof input === 'string' ? input : input.url;

        // [중요] 모든 종류의 프록시 주소 제거
        const proxies = [
          'https://api.allorigins.win/raw?url=',
          'https://cors-anywhere.herokuapp.com/',
          'https://api.allorigins.win/get?url='
        ];

        for (const proxy of proxies) {
          if (url.startsWith(proxy)) {
            url = decodeURIComponent(url.replace(proxy, ''));
          }
        }

        // 기상청 및 한라산 API 호출을 네이티브로 토스 (CORS 우회)
        if (url.includes('apis.data.go.kr') || url.includes('jeju.go.kr')) {
          return new Promise((resolve, reject) => {
            const reqId = Math.random().toString(36).substring(7);
            window.fetchCallbacks[reqId] = { resolve, reject };

            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FETCH_REQUEST',
                reqId: reqId,
                url: url,
                options: init
              }));
            }
          });
        }

        return originalFetch(input, init);
      };
    })();
    true;
  `;

  const onMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'FETCH_REQUEST') {
        try {
          // [수정] 네이티브에서 직접 fetch 수행 (CORS 영향 없음)
          const response = await fetch(data.url, data.options);
          const responseText = await response.text();

          // 안전한 문자열 전달을 위해 JSON.stringify 사용
          const serializedText = JSON.stringify(responseText);

          const jsCode = `
            if (window.fetchCallbacks['${data.reqId}']) {
              const res = new Response(${serializedText}, {
                status: ${response.status},
                headers: { 'Content-Type': 'application/json' }
              });
              window.fetchCallbacks['${data.reqId}'].resolve(res);
              delete window.fetchCallbacks['${data.reqId}'];
            }
          `;
          webviewRef.current.injectJavaScript(jsCode);
        } catch (error) {
          console.error("Native Fetch Error:", error);
          const errorJs = `
            if (window.fetchCallbacks['${data.reqId}']) {
              window.fetchCallbacks['${data.reqId}'].reject(new Error("Native Fetch Failed"));
              delete window.fetchCallbacks['${data.reqId}'];
            }
          `;
          webviewRef.current.injectJavaScript(errorJs);
        }
      }
    } catch (e) {
      // 메시지 처리 에러 무시
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ViewShot ref={viewShotRef} style={{ flex: 1 }} collapsable={false}>
        <WebView
          ref={webviewRef}
          // [핵심] 다운로드 받은 HTML 문자열을 로컬 소스로 실행 -> Mixed Content 회피
          source={{ html: htmlContent, baseUrl: 'http://localhost/' }}
          style={styles.webview}
          mixedContentMode="always"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          androidHardwareAccelerationDisabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={true}
          originWhitelist={['*']}
          injectedJavaScriptBeforeContentLoaded={INJECTED_CODE}
          onMessage={onMessage}
        />
      </ViewShot>

      <TouchableOpacity 
        style={{
            position: 'absolute',
            bottom: 30,
            right: 170,
            backgroundColor: '#4a69bd',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 25,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            zIndex: 100,
        }}
        onPress={handleCaptureAll}
      >
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>📄 All Cards</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={{
            position: 'absolute',
            bottom: 30,
            right: 20,
            backgroundColor: '#ff5252',
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 30,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            zIndex: 100,
        }}
        onPress={handleCapture}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>📸 9:16 Capture</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  webview: {
    flex: 1,
  },
});
