import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Create a Supabase client configured to use cookies
  const supabase = createMiddlewareClient({ req, res });

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/auth-helpers/nextjs#managing-session-with-middleware
  await supabase.auth.getSession();

  // OPTIONAL: Protect routes
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { pathname } = req.nextUrl;

  // Define protected routes
  const protectedRoutes = ["/dashboard"]; // Add other routes as needed

  // Redirect to signin if user is not authenticated and trying to access protected route
  if (!session && protectedRoutes.some((route) => pathname.startsWith(route))) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/signin"; // Your sign-in page route
    redirectUrl.searchParams.set(`redirectedFrom`, pathname); // Optional: redirect back after login
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from signin/signup pages
  if (session && (pathname === "/signin" || pathname === "/signup")) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard"; // Redirect to dashboard or home page
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

// Ensure the middleware is only called for relevant paths.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // Explicitly include API routes if needed, though session handling might be better in the route itself
    // '/api/:path*',
  ],
};
