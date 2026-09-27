import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// App-wide safety net: if any screen throws during render, show a recoverable
// fallback instead of a white/black screen that forces the user to kill the app.
export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('App crash caught by ErrorBoundary:', error, info?.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.sub}>Please try again. If it keeps happening, reopen the app.</Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset} activeOpacity={0.85}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#ffffff' },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 22 },
  btn: { backgroundColor: '#4f46e5', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
