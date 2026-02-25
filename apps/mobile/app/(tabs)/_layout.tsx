import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";
import { t } from "../../lib/i18n";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  name,
  activeName,
  color,
  size,
  focused,
}: {
  name: IoniconName;
  activeName: IoniconName;
  color: string;
  size: number;
  focused: boolean;
}) {
  return <Ionicons name={focused ? activeName : name} size={size} color={color} />;
}

function FloatingTabBarBackground() {
  return (
    <LinearGradient
      colors={["#153A67", "#0B223E", "#091728"]}
      locations={[0, 0.45, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.95, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#E5F0FF",
        tabBarInactiveTintColor: "#7F93AE",
        tabBarActiveBackgroundColor: "rgba(59,130,246,0.18)",
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          lineHeight: 12,
          marginTop: 0,
          paddingBottom: 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarStyle: {
          position: "absolute",
          bottom: 18,
          left: 10,
          right: 10,
          borderRadius: 24,
          borderTopWidth: 0,
          height: 56,
          paddingHorizontal: 4,
          paddingTop: 3,
          paddingBottom: 3,
          elevation: 20,
          shadowColor: "#000",
          shadowOpacity: 0.5,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          overflow: "hidden",
        },
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 1,
          marginVertical: 3,
          height: 44,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 0,
        },
        tabBarBackground: () => <FloatingTabBarBackground />,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_home"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="home-outline"
              activeName="home"
              color={color}
              size={size - 1}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tab_search"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="search-outline"
              activeName="search"
              color={color}
              size={size - 1}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bestsellers"
        options={{
          title: t("tab_rank"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="bar-chart-outline"
              activeName="bar-chart"
              color={color}
              size={size - 1}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bookshelf"
        options={{
          title: t("tab_shelf"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="bookmark-outline"
              activeName="bookmark"
              color={color}
              size={size - 1}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: t("tab_reviews"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="star-outline"
              activeName="star"
              color={color}
              size={size - 1}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: t("tab_my"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="person-outline"
              activeName="person"
              color={color}
              size={size - 1}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
