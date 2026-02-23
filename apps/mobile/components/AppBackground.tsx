import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function AppBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#071426", "#092447", "#06101E"]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <LinearGradient
        colors={["rgba(59,130,246,0.34)", "rgba(37,99,235,0.18)", "transparent"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.15, y: 0.05 }}
        end={{ x: 0.85, y: 0.95 }}
        style={styles.topGlow}
      />

      <LinearGradient
        colors={["rgba(56,189,248,0.18)", "rgba(14,165,233,0.08)", "transparent"]}
        locations={[0, 0.6, 1]}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={styles.centerGlow}
      />

      <LinearGradient
        colors={["rgba(2,6,23,0.72)", "rgba(2,6,23,0.08)", "rgba(2,6,23,0.8)"]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#071426",
    overflow: "hidden",
  },
  content: {
    flex: 1,
  },
  topGlow: {
    position: "absolute",
    top: -80,
    left: -60,
    width: 460,
    height: 360,
    borderRadius: 999,
    transform: [{ rotate: "-8deg" }],
  },
  centerGlow: {
    position: "absolute",
    top: 120,
    left: 20,
    right: 20,
    height: 300,
    borderRadius: 999,
  },
});
