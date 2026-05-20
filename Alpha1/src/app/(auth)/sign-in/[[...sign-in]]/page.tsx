import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/scanner"
      appearance={{
        elements: {
          rootBox: "w-full",
          cardBox: "w-full",
        },
      }}
    />
  );
}
