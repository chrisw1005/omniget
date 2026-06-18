export interface NavItem {
  href: string;
  labelKey?: string;
  label?: string;
  icon: string;
  iconSvg?: string;
  group: "primary" | "app" | "plugins" | "secondary";
  badge?: "downloads";
  pluginId?: string;
  order?: number;
}

export const CORE_NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.home", icon: "home", group: "primary", order: 10 },
  { href: "/downloads", labelKey: "nav.downloads", icon: "downloads", group: "primary", badge: "downloads", order: 20 },
  { href: "/convert", labelKey: "convert.title", icon: "convert", iconSvg: "M20 10H4l4-4 M4 14h16l-4 4", group: "primary", order: 25 },
  { href: "/marketplace", labelKey: "nav.marketplace", icon: "marketplace", group: "app", order: 30 },
  { href: "/settings", labelKey: "nav.settings", icon: "settings", group: "app", order: 40 },
  { href: "/about", labelKey: "nav.about", icon: "about", group: "app", order: 50 },
];
