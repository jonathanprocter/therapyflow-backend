# Google Cloud Console Setup for Java Web App

## Step-by-Step Configuration

### Your OAuth 2.0 Client Details
- **Client ID:** `839967078225-sjhemk0h654iv9jbc58lears67ntt877.apps.googleusercontent.com`
- **Application Type:** Web application

### Required Redirect URIs to Add

**Copy these EXACT URIs into Google Cloud Console:**

```
http://localhost:8080/oauth2/callback/google
http://localhost:9090/oauth2/callback/google
https://yourdomain.com/oauth2/callback/google
```

### Google Cloud Console Steps

1. **Open Google Cloud Console**
   - Go to: https://console.cloud.google.com/
   - Select your project

2. **Navigate to OAuth Settings**
   - Menu → APIs & Services → Credentials
   - Find: OAuth 2.0 Client IDs
   - Click on: `839967078225-sjhemk0h654iv9jbc58lears67ntt877`

3. **Edit OAuth Client**
   - Click the "Edit" button (pencil icon)
   - Scroll down to "Authorized redirect URIs"

4. **Add New Redirect URIs**
   - Click "+ ADD URI" button
   - Add each URI one by one:
     - `http://localhost:8080/oauth2/callback/google`
     - `http://localhost:9090/oauth2/callback/google`
     - `https://yourdomain.com/oauth2/callback/google`

5. **Save Configuration**
   - Click "SAVE" at the bottom
   - Wait for confirmation

### Final Configuration Should Include

**Existing:**
- `urn:ietf:wg:oauth:2.0:oob`

**New (for Java Web App):**
- `http://localhost:8080/oauth2/callback/google`
- `http://localhost:9090/oauth2/callback/google`
- `https://yourdomain.com/oauth2/callback/google`

### Java Spring Boot Example

```java
@Configuration
@EnableOAuth2Client
public class OAuth2Config {
    
    @Value("${google.client.id:839967078225-sjhemk0h654iv9jbc58lears67ntt877.apps.googleusercontent.com}")
    private String clientId;
    
    @Value("${google.client.secret}")
    private String clientSecret;
    
    @Value("${google.redirect.uri:http://localhost:8080/oauth2/callback/google}")
    private String redirectUri;
    
    @Bean
    public OAuth2RestTemplate googleOAuth2Template() {
        OAuth2ProtectedResourceDetails resource = new AuthorizationCodeResourceDetails();
        resource.setClientId(clientId);
        resource.setClientSecret(clientSecret);
        resource.setUserAuthorizationUri("https://accounts.google.com/o/oauth2/v2/auth");
        resource.setAccessTokenUri("https://oauth2.googleapis.com/token");
        resource.setScope(Arrays.asList("https://www.googleapis.com/auth/calendar", 
                                       "https://www.googleapis.com/auth/calendar.events"));
        
        AuthorizationCodeAccessTokenProvider provider = new AuthorizationCodeAccessTokenProvider();
        OAuth2RestTemplate template = new OAuth2RestTemplate(resource);
        template.setAccessTokenProvider(provider);
        
        return template;
    }
}
```

### Controller Example

```java
@Controller
public class OAuth2Controller {
    
    @GetMapping("/oauth2/callback/google")
    public String googleCallback(@RequestParam("code") String code, 
                                @RequestParam(value = "state", required = false) String state) {
        // Handle the authorization code
        // Exchange code for access token
        return "redirect:/dashboard";
    }
}
```

### Properties File (application.properties)

```properties
# Google OAuth2 Configuration
google.client.id=839967078225-sjhemk0h654iv9jbc58lears67ntt877.apps.googleusercontent.com
google.client.secret=${GOOGLE_CLIENT_SECRET}
google.redirect.uri=http://localhost:8080/oauth2/callback/google

# For production
# google.redirect.uri=https://yourdomain.com/oauth2/callback/google
```

## Important Notes

1. **Case Sensitive:** URIs are case-sensitive
2. **Exact Match:** Must match exactly what your application uses
3. **HTTPS Required:** Production URIs must use HTTPS
4. **No Trailing Slash:** Don't add trailing slashes unless your app expects them
5. **Port Numbers:** Include specific port numbers for localhost