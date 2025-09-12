import {
  IconChartBar,
  IconDashboard,
  IconFolder,
  IconListDetails,
  IconUsers
} from "@tabler/icons-react";
import { KanbanIcon } from "lucide-react";

export const sidebarData = {
  user: {
    name: "Marc",
    email: "m@example.com",
    avatar: "https://bundui-images.netlify.app/avatars/08.png"
  },
  navMain: [
    {
      title: "Main",
      items: [
        {
          title: "Ecommerce",
          url: "/ecommerce",
          icon: IconDashboard,
          items: [
            {
              title: "Dashboard",
              url: "/ecommerce"
            },
            {
              title: "Checkout",
              url: "/checkout"
            },
            {
              title: "Order Receipt",
              url: "/order-receipt"
            },
            {
              title: "Product Filter",
              url: "/product-filter"
            }
          ]
        },
        {
          title: "CRM",
          url: "/crm",
          icon: IconDashboard,
          items: [
            {
              title: "Dashboard",
              url: "/crm"
            },
            {
              title: "Customers",
              url: "/customers"
            },
            {
              title: "Customer Details",
              url: "/customer-details"
            },
            {
              title: "Customer Details v2",
              url: "/customer-details-v2"
            }
          ]
        },
        {
          title: "Banking",
          url: "/banking",
          icon: IconDashboard
        },
        {
          title: "AI Chat",
          url: "/ai-chat",
          icon: IconUsers
        },
        {
          title: "Chats",
          url: "/chats",
          icon: IconUsers
        },
        {
          title: "Kanban Board",
          url: "/kanban-board",
          icon: KanbanIcon
        },
        {
          title: "POS App",
          url: "/pos-app",
          icon: IconFolder
        },
        {
          title: "Social Media",
          url: "/social-media",
          icon: IconChartBar
        },
        {
          title: "Real Estate Listings",
          url: "/real-estate-listings",
          icon: IconFolder
        },
        {
          title: "Job Postings",
          url: "/job-postings",
          icon: IconFolder
        },
        {
          title: "Contacts",
          url: "/contacts",
          icon: IconListDetails
        },
        {
          title: "Projects",
          url: "/projects-list",
          icon: IconFolder
        },
        {
          title: "User Profile",
          url: "/user-profile",
          icon: IconChartBar
        },
        {
          title: "Settings",
          url: "/settings",
          icon: IconFolder
        },
        {
          title: "Empty State",
          url: "/empty-states",
          icon: IconDashboard,
          items: [
            {
              title: "Empty State 01",
              url: "/empty-states"
            },
            {
              title: "Empty State 02",
              url: "/empty-states-02"
            },
            {
              title: "Empty State 03",
              url: "/empty-states-03"
            }
          ]
        }
      ]
    }
  ]
};

export type SidebarNavMain = (typeof sidebarData.navMain)[number];
export type SidebarNavMainItem = (typeof sidebarData.navMain)[0]["items"][number];
