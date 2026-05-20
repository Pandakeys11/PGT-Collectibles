import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
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
