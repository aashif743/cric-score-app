import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

// Pull the auction share code out of a scanned QR. Handles a plain code or a URL
// (e.g. https://cric-zone.com/auctions/screen/<code>) → takes the last segment.
const extractCode = (raw) => {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    s = s.split('?')[0].split('#')[0];
    const segs = s.split('/').filter(Boolean);
    return segs.length ? segs[segs.length - 1] : '';
  }
  return s;
};

export default function QRScanModal({ visible, onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  useEffect(() => { if (visible) setHandled(false); }, [visible]);
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [visible, permission]);

  const handleScan = ({ data }) => {
    if (handled) return;
    const code = extractCode(data);
    if (!code) return;
    setHandled(true);
    onScanned(code);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.container}>
        {permission?.granted ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handled ? undefined : handleScan}
            />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame} />
              <Text style={styles.hint}>Point at the auction QR code</Text>
            </View>
          </>
        ) : (
          <View style={styles.permBox}>
            <Text style={styles.permIcon}>📷</Text>
            <Text style={styles.permTitle}>Camera access needed</Text>
            <Text style={styles.permText}>Allow camera to scan an auction's QR code and import its teams & players.</Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}><Text style={styles.permBtnText}>Allow camera</Text></TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
        <View style={styles.titleBar} pointerEvents="none"><Text style={styles.title}>Scan auction QR</Text></View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: '#ffffff', backgroundColor: 'transparent' },
  hint: { color: '#fff', fontWeight: '700', fontSize: 14, marginTop: 20, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
  titleBar: { position: 'absolute', top: 54, left: 0, right: 0, alignItems: 'center' },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  closeBtn: { position: 'absolute', top: 48, right: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#0f172a' },
  permIcon: { fontSize: 44, marginBottom: 12 },
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  permText: { color: '#cbd5e1', fontSize: 14, fontWeight: '500', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  permBtn: { marginTop: 22, backgroundColor: '#4f46e5', paddingHorizontal: 26, paddingVertical: 13, borderRadius: 14 },
  permBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
