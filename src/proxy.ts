import NextAuth from "next-auth"
import authConfig from "./lib/auth.config"

export const { auth: middleware } = NextAuth(authConfig)

export default middleware((req) => {
  const isLoggedIn = !!req.auth;
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/dashboard');

  if (isProtectedRoute && !isLoggedIn) {
    return Response.redirect(new URL('/', req.nextUrl));
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
