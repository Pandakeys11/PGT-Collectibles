"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AuthControls({
  redirectUrl = "/scanner",
}: {
  redirectUrl?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-in">
        <>
          <Link
            href="/profile"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-primary sm:block"
          >
            Profile
          </Link>
          <UserButton
            userProfileUrl="/profile"
            appearance={{
              elements: {
                avatarBox: "h-9 w-9",
              },
            }}
          />
        </>
      </Show>
      <Show when="signed-out">
        <>
          <SignInButton mode="modal" fallbackRedirectUrl={redirectUrl}>
            <Button type="button" variant="ghost" size="sm">
              Sign in
            </Button>
          </SignInButton>
          <SignUpButton mode="modal" fallbackRedirectUrl={redirectUrl}>
            <Button type="button" variant="secondary" size="sm">
              Join beta
            </Button>
          </SignUpButton>
        </>
      </Show>
    </div>
  );
}
