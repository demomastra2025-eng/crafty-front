"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Upload, Trash } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchMe } from "@/lib/evo-auth";

export function ProfileSettings() {
  const [user, setUser] = useState<{ id: string; email: string; name?: string | null } | null>(null);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const nameParts = useMemo(() => {
    const base = (user?.name || "").trim();
    if (!base) return { first: "", last: "" };
    const [first, ...rest] = base.split(/\s+/);
    return { first: first || "", last: rest.join(" ") };
  }, [user?.name]);

  const formatKzPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const local = digits.length > 10 && digits.startsWith("7") ? digits.slice(1, 11) : digits.slice(0, 10);
    const area = local.slice(0, 3);
    const part1 = local.slice(3, 6);
    const part2 = local.slice(6, 8);
    const part3 = local.slice(8, 10);
    let result = "";
    if (area.length) {
      result += ` (${area}`;
      if (area.length === 3) result += ")";
    }
    if (part1.length) result += ` ${part1}`;
    if (part2.length) result += `-${part2}`;
    if (part3.length) result += `-${part3}`;
    return result;
  };

  return (
    <Card className="border-none shadow-none">
      <CardHeader>
        <CardTitle>Personal information</CardTitle>
        <CardDescription>Update your personal details and address.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage
              src="/logo.png"
              alt="Profile picture"
            />
            <AvatarFallback className="bg-background">AG</AvatarFallback>
          </Avatar>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1 bg-transparent">
              <Upload className="h-4 w-4" />
              Upload Image
            </Button>
            <Button variant="outline" className="gap-1 bg-transparent">
              <Trash className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" value={nameParts.first} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userName">User name</Label>
            <Input id="userName" value={nameParts.last} readOnly />
          </div>
          <div className="col-span-full space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user?.email || ""} readOnly />
          </div>
          <div className="col-span-full space-y-2">
            <Label htmlFor="phoneNumber">Phone number</Label>
            <div className="flex gap-2">
              <Select defaultValue="+7">
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Country Code" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="+7">+7</SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="phoneNumber"
                value={formatKzPhone(phone)}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(7__) ___-__-__"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Address information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="col-span-full space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select defaultValue="Kazakhstan">
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kazakhstan">
                    <div className="flex items-center gap-2">
                      <Image
                        src="/logo.png"
                        alt="Kazakhstan Flag"
                        width={16}
                        height={16}
                      />
                      Kazakhstan
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-full space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" placeholder="ул. Абая, 10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="Алматы" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input id="postalCode" placeholder="050000" />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="ml-auto">Save</Button>
      </CardFooter>
    </Card>
  );
}
