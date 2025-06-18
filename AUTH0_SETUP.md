# Auth0 Frontend Setup for Run Tempo UI

This guide explains how to configure Auth0 authentication in your Next.js frontend.

## Environment Variables

Create a `.env.local` file in the `run-tempo-ui` directory with the following variables:

```env
# Auth0 Configuration
NEXT_PUBLIC_AUTH0_DOMAIN=your-domain.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
NEXT_PUBLIC_AUTH0_AUDIENCE=your-api-identifier
NEXT_PUBLIC_AUTH0_REDIRECT_URI=http://localhost:3000

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Auth0 Dashboard Setup

1. **Create a Regular Web Application** in your Auth0 dashboard
2. **Configure the application**:
   - Allowed Callback URLs: `http://localhost:3000`
   - Allowed Logout URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`
3. **Get your credentials**:
   - Domain: Found in your Auth0 application settings
   - Client ID: Found in your Auth0 application settings
   - Audience: Your API identifier (same as backend)

## Features Implemented

### Authentication Components
- **Auth0ProviderWrapper**: Wraps the app with Auth0 context
- **AuthButton**: Handles login, logout, and signup
- **ProtectedRoute**: Protects routes requiring authentication

### API Integration
- **useApiClient**: Hook for making authenticated API requests
- Automatic token inclusion in requests
- Error handling for authentication failures

### User Experience
- Loading states during authentication
- User profile display
- Seamless login/logout flow
- Protected content access

## Usage

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Visit the application** at `http://localhost:3000`

3. **Log in** using the AuthButton in the header

4. **Access protected features** like file upload and processing

## Troubleshooting

### Common Issues

1. **"Configuration Error"**
   - Check that all environment variables are set correctly
   - Verify Auth0 domain and client ID

2. **"Authentication required"**
   - Make sure you're logged in
   - Check that the Auth0 application is configured correctly

3. **CORS errors**
   - Ensure your Auth0 application has the correct callback URLs
   - Check that your API allows requests from your frontend domain

### Debug Mode

Enable debug logging by adding this to your `.env.local`:
```env
NEXT_PUBLIC_AUTH0_DEBUG=true
```

## Next Steps

1. **Customize the UI** to match your brand
2. **Add user profile management**
3. **Implement user preferences storage**
4. **Add role-based access control** 