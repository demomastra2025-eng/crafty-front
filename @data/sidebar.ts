import { IconDashboard, IconUsers, IconHome, IconSettings } from "@tabler/icons-react";
import { Bot, KanbanIcon, Link as LinkIcon, MessageCircle } from "lucide-react";

export const sidebarData = {
  user: {
    name: "Ахан",
    email: "bakhitov.akhan@gmail.com",
    avatar: "/logo.png"
  },
  navMain: [
    {
      title: "Главное",
      items: [
        {
          title: "Чаты",
          url: "/chats",
          icon: MessageCircle
        },
        {
          title: "Клиенты",
          url: "/customers",
          icon: IconUsers,
        },
        {
          title: "AI-чат",
          url: "/ai-chat",
          icon: Bot
        },
        {
          title: "Коннекты",
          url: "/connections",
          icon: LinkIcon
        },
        {
          title: "Настройки",
          url: "/settings",
          icon: IconSettings
        }
      ]
    }
  ]
};

export type SidebarNavMain = (typeof sidebarData.navMain)[number];
export type SidebarNavMainItem = (typeof sidebarData.navMain)[0]["items"][number];
