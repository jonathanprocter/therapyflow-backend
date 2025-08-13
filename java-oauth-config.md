# Google OAuth2 Java Configuration

## Current Configuration Details

**Client ID:** `839967078225-sjhemk0h654iv9jbc58lears67ntt877.apps.googleusercontent.com`

**Current Redirect URI:** `urn:ietf:wg:oauth:2.0:oob`

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

### Option 2: Web Application Flow
If you want to use a web callback instead:

```java
// For local development
private static final String REDIRECT_URI = "http://localhost:8080/oauth/callback";

// For production
private static final String REDIRECT_URI = "https://yourdomain.com/oauth/google/callback";
```

### Option 3: Android Application
For Android apps:
```java
private static final String REDIRECT_URI = "com.yourpackage.therapyflow://oauth/callback";
```

## Google Cloud Console Setup

To configure the redirect URI in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to APIs & Services > Credentials
4. Click on your OAuth 2.0 Client ID: `839967078225-sjhemk0h654iv9jbc58lears67ntt877`
5. Add your redirect URI to "Authorized redirect URIs":

**Available Options:**
- `urn:ietf:wg:oauth:2.0:oob` (Already configured - for desktop apps)
- `http://localhost:8080/oauth/callback` (For local Java web apps)
- `https://yourdomain.com/oauth/callback` (For production web apps)
- `com.yourpackage.therapyflow://oauth/callback` (For mobile apps)

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