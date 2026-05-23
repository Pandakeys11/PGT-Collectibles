import { SignUp } from "@clerk/nextjs";
import { APP_HOME_PATH } from "@/lib/app-routes";

export default function SignUpPage() {
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      fallbackRedirectUrl={APP_HOME_PATH}
      appearance={{
        elements: {
          rootBox: "w-full",
          cardBox: "w-full",
        },
      }}
    />
  );
}
