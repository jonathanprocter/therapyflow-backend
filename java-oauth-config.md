# Google OAuth2 Java Web Application Configuration

## Current Configuration Details

**Client ID:** `839967078225-sjhemk0h654iv9jbc58lears67ntt877.apps.googleusercontent.com`

**Required for Java Web App:**

### Google Cloud Console Configuration

**ADD THESE REDIRECT URIs TO YOUR GOOGLE CLOUD CONSOLE:**

1. **Development (Local):**
   ```
   http://localhost:8080/oauth2/callback/google
   ```

2. **Production:**
   ```
   https://yourdomain.com/oauth2/callback/google
   ```

3. **Alternative Development Ports:**
   ```
   http://localhost:9090/oauth2/callback/google
   http://localhost:3000/oauth2/callback/google
   ```

## Java Implementation

### Option 1: Out-of-Band Flow (Current Setup)
```java
public class GoogleCalendarAuth {
    private static final String CLIENT_ID = "839967078225-sjhemk0h654iv9jbc58lears67ntt877.apps.googleusercontent.com";
    private static final String CLIENT_SECRET = "your-client-secret";
    private static final String REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";
    
    private static final List<String> SCOPES = Arrays.asList(
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events"
    );
    
    public String getAuthorizationUrl() {
        GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
            httpTransport, JSON_FACTORY, CLIENT_ID, CLIENT_SECRET, SCOPES)
            .setAccessType("offline")
            .setApprovalPrompt("force")
            .build();
            
        return flow.newAuthorizationUrl()
            .setRedirectUri(REDIRECT_URI)
            .build();
    }
}
```

### Java Web Application Configuration

```java
public class GoogleOAuth2Config {
    // Client credentials
    private static final String CLIENT_ID = "839967078225-sjhemk0h654iv9jbc58lears67ntt877.apps.googleusercontent.com";
    private static final String CLIENT_SECRET = "your-client-secret";
    
    // Redirect URIs (choose based on environment)
    private static final String DEV_REDIRECT_URI = "http://localhost:8080/oauth2/callback/google";
    private static final String PROD_REDIRECT_URI = "https://yourdomain.com/oauth2/callback/google";
    
    // Use this method to get the appropriate redirect URI
    public static String getRedirectUri() {
        String environment = System.getProperty("app.environment", "development");
        return "production".equals(environment) ? PROD_REDIRECT_URI : DEV_REDIRECT_URI;
    }
}
```

### Option 3: Android Application
For Android apps:
```java
private static final String REDIRECT_URI = "com.yourpackage.therapyflow://oauth/callback";
```

## Google Cloud Console Setup Steps

**IMPORTANT: Add these URIs to your Google Cloud Console**

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Select your project

2. **Navigate to Credentials:**
   - Go to: APIs & Services > Credentials
   - Find OAuth 2.0 Client ID: `839967078225-sjhemk0h654iv9jbc58lears67ntt877`
   - Click "Edit" (pencil icon)

3. **Add Authorized Redirect URIs:**
   
   **Copy and paste these EXACT URIs:**
   ```
   http://localhost:8080/oauth2/callback/google
   https://yourdomain.com/oauth2/callback/google
   http://localhost:9090/oauth2/callback/google
   ```

4. **Click "Save"**

**Current URIs you should see:**
- `urn:ietf:wg:oauth:2.0:oob` (existing - for desktop)
- `http://localhost:8080/oauth2/callback/google` (ADD THIS)
- `https://yourdomain.com/oauth2/callback/google` (ADD THIS)

## Complete Java OAuth Flow

```java
import com.google.api.client.auth.oauth2.*;
import com.google.api.client.googleapis.auth.oauth2.*;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;

public class TherapyFlowCalendarAuth {
    private static final String CLIENT_ID = "839967078225-sjhemk0h654iv9jbc58lears67ntt877.apps.googleusercontent.com";
    private static final String CLIENT_SECRET = "your-client-secret";
    private static final String REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";
    
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final NetHttpTransport HTTP_TRANSPORT = new NetHttpTransport();
    
    private static final List<String> SCOPES = Arrays.asList(
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events"
    );
    
    public String getAuthorizationUrl() throws IOException {
        GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
            HTTP_TRANSPORT, JSON_FACTORY, CLIENT_ID, CLIENT_SECRET, SCOPES)
            .setAccessType("offline")
            .setApprovalPrompt("force")
            .build();
            
        AuthorizationCodeRequestUrl authorizationUrl = flow.newAuthorizationUrl()
            .setRedirectUri(REDIRECT_URI);
            
        return authorizationUrl.build();
    }
    
    public Credential exchangeCode(String authorizationCode) throws IOException {
        GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
            HTTP_TRANSPORT, JSON_FACTORY, CLIENT_ID, CLIENT_SECRET, SCOPES)
            .setAccessType("offline")
            .setApprovalPrompt("force")
            .build();
            
        GoogleTokenResponse response = flow.newTokenRequest(authorizationCode)
            .setRedirectUri(REDIRECT_URI)
            .execute();
            
        return flow.createAndStoreCredential(response, "user");
    }
}
```

## Usage Example

```java
public class CalendarSyncExample {
    public static void main(String[] args) throws IOException {
        TherapyFlowCalendarAuth auth = new TherapyFlowCalendarAuth();
        
        // Step 1: Get authorization URL
        String authUrl = auth.getAuthorizationUrl();
        System.out.println("Visit this URL: " + authUrl);
        
        // Step 2: User visits URL and gets code
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter authorization code: ");
        String code = scanner.nextLine();
        
        // Step 3: Exchange code for credentials
        Credential credential = auth.exchangeCode(code);
        
        System.out.println("Access Token: " + credential.getAccessToken());
        System.out.println("Refresh Token: " + credential.getRefreshToken());
    }
}
```

## Maven Dependencies

```xml
<dependency>
    <groupId>com.google.apis</groupId>
    <artifactId>google-api-services-calendar</artifactId>
    <version>v3-rev20220715-2.0.0</version>
</dependency>
<dependency>
    <groupId>com.google.oauth-client</groupId>
    <artifactId>google-oauth-client-jetty</artifactId>
    <version>1.34.1</version>
</dependency>
```

## Gradle Dependencies

```gradle
implementation 'com.google.apis:google-api-services-calendar:v3-rev20220715-2.0.0'
implementation 'com.google.oauth-client:google-oauth-client-jetty:1.34.1'
```