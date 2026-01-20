import { Download } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface User {
  id: string;
  name: string;
  avatar: string;
  status: string;
  bio: string;
  email: string;
  phone: string;
  location: string;
  labels?: Array<{
    labelId: string;
    name: string;
    color?: string | null;
  }>;
  sharedFiles: Array<{
    name: string;
    type: string;
  }>;
}

interface UserProfileProps {
  user: User;
  onClose: () => void;
}

const labelColorClass = (color?: string | null) => {
  switch ((color || "").trim()) {
    case "1":
      return "bg-muted text-foreground";
    case "2":
      return "bg-green-100 text-green-800";
    case "3":
      return "bg-yellow-100 text-yellow-800";
    case "4":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function UserProfile({ user }: UserProfileProps) {
  return (
    <div className="flex w-80 flex-col border-l border-gray-200 bg-white">
      {/* Profile Header */}
      <div className="p-6 text-center">
        <div className="relative inline-block">
          <Avatar className="mx-auto h-20 w-20">
            <AvatarImage
              src={user.avatar || "/logo.png"}
              alt={user.name}
            />
            <AvatarFallback className="text-lg">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="absolute right-1 bottom-1 h-4 w-4 rounded-full border-2 border-white bg-green-500"></div>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">{user.name}</h2>
        <p className="text-sm text-green-600">{user.status}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {/* Contact Information */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-medium text-gray-900">Телефон</h3>
            <p className="text-sm text-gray-600">{user.phone}</p>
          </div>

          {user.labels?.length ? (
            <div>
              <h3 className="mb-1 text-sm font-medium text-gray-900">Теги</h3>
              <div className="flex flex-wrap gap-1">
                {user.labels.map((label) => (
                  <Badge
                    key={label.labelId}
                    variant="secondary"
                    className={`text-[10px] ${labelColorClass(label.color)}`}>
                    {label.name || label.labelId}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <Separator className="my-6" />

        {/* Shared Files */}
        <div>
          <h3 className="mb-4 text-sm font-medium text-gray-900">Файлы</h3>
          <div className="space-y-3">
            {user.sharedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg p-2 hover:bg-gray-50">
                <span className="truncate text-sm text-gray-700">{file.name}</span>
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
