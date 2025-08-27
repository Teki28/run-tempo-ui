import { NextRequest, NextResponse } from "next/server";
 
const locales = ['en', 'zh', 'ja']
 
// Get the preferred locale, similar to the above or using a library
function getLocale(request: NextRequest) {
   return request.headers.get("Accept-Language")?.split(",")[0] || "en"
}

export function middleware(request: NextRequest) {
  // Check if there is any supported locale in the pathname
  const { pathname } = request.nextUrl
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )
 
  if (pathnameHasLocale) return
 
  // Redirect if there is no locale
  const locale = getLocale(request)
  // if locale in locales, then return new path, else, return default path
  console.log(locale.slice(0,2))
  switch (locale.slice(0,2)) {
    case 'zh':
      request.nextUrl.pathname = `/zh${pathname}`
      break
    case 'ja':
      request.nextUrl.pathname = `/ja${pathname}`
      break
    default:
      request.nextUrl.pathname = `/en${pathname}`
  }
  console.log("Redirecting to:", request.nextUrl.pathname)
  // e.g. incoming request is /products
  // The new URL is now /en-US/products
  return NextResponse.redirect(request.nextUrl)
}
 
export const config = {
  matcher: [
    // Skip all internal paths (_next), favicon.ico, and app_logo.jpg
    '/((?!_next|favicon.ico|app_logo.jpg).*)',
    // Optional: only run on root (/) URL
    '/'
  ],
}