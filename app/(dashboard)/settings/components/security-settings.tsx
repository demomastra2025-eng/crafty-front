"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SecuritySettings() {
  return (
    <Card className="border-none shadow-none">
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Remember, your password is your digital key to your account. Keep it safe, keep it secure!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" type="password" defaultValue="********" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" type="password" defaultValue="********" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" type="password" defaultValue="********" />
          </div>
          <Button className="ml-auto w-fit">Update</Button>
        </div>

      </CardContent>
    </Card>
  );
}
