import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var authService: AuthService

    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    @FocusState private var focusedField: Field?

    enum Field {
        case email, password
    }

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 0) {
                    // Logo and branding
                    brandingSection
                        .frame(height: geometry.size.height * 0.35)

                    // Login form
                    formSection
                        .padding(.horizontal, 24)
                        .padding(.top, 32)

                    Spacer(minLength: 40)

                    // Footer
                    footerSection
                        .padding(.bottom, 24)
                }
                .frame(minHeight: geometry.size.height)
            }
        }
        .background(Color.theme.background)
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .onTapGesture {
            focusedField = nil
        }
    }

    // MARK: - Branding Section
    private var brandingSection: some View {
        VStack(spacing: 16) {
            Spacer()

            // App icon/logo
            ZStack {
                Circle()
                    .fill(Color.theme.primary)
                    .frame(width: 100, height: 100)

                Image(systemName: "brain.head.profile")
                    .font(.system(size: 44))
                    .foregroundColor(.white)
            }
            .shadow(color: Color.theme.primary.opacity(0.3), radius: 20, x: 0, y: 10)

            VStack(spacing: 8) {
                Text("TherapyFlow")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(Color.theme.primaryDark)

                Text("Secure Clinical Practice Management")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Spacer()
        }
    }

    // MARK: - Form Section
    private var formSection: some View {
        VStack(spacing: 20) {
            // Error message
            if let error = errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.circle.fill")
                    Text(error)
                }
                .font(.caption)
                .foregroundColor(.white)
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.theme.error)
                .cornerRadius(10)
            }

            // Email field
            VStack(alignment: .leading, spacing: 8) {
                Text("Email")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.secondaryText)

                HStack {
                    Image(systemName: "envelope")
                        .foregroundColor(Color.theme.secondaryText)

                    TextField("Enter your email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .email)
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            focusedField == .email ? Color.theme.primary : Color.theme.border,
                            lineWidth: focusedField == .email ? 2 : 1
                        )
                )
            }

            // Password field
            VStack(alignment: .leading, spacing: 8) {
                Text("Password")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.secondaryText)

                HStack {
                    Image(systemName: "lock")
                        .foregroundColor(Color.theme.secondaryText)

                    if showPassword {
                        TextField("Enter your password", text: $password)
                            .focused($focusedField, equals: .password)
                    } else {
                        SecureField("Enter your password", text: $password)
                            .focused($focusedField, equals: .password)
                    }

                    Button(action: { showPassword.toggle() }) {
                        Image(systemName: showPassword ? "eye.slash" : "eye")
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            focusedField == .password ? Color.theme.primary : Color.theme.border,
                            lineWidth: focusedField == .password ? 2 : 1
                        )
                )
            }

            // Login button
            Button(action: login) {
                HStack {
                    if isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Sign In")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(isFormValid ? Color.theme.primary : Color.theme.primaryLight)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(!isFormValid || isLoading)

            // Forgot password
            Button(action: {}) {
                Text("Forgot Password?")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.primary)
            }
        }
    }

    // MARK: - Footer Section
    private var footerSection: some View {
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "lock.shield")
                    .font(.caption2)
                Text("HIPAA Compliant & Secure")
                    .font(.caption2)
            }
            .foregroundColor(Color.theme.secondaryText)

            Text("Your data is encrypted and protected")
                .font(.caption2)
                .foregroundColor(Color.theme.tertiaryText)
        }
    }

    // MARK: - Computed Properties
    private var isFormValid: Bool {
        !email.isEmpty && !password.isEmpty && email.contains("@")
    }

    // MARK: - Actions
    private func login() {
        guard isFormValid else { return }

        isLoading = true
        errorMessage = nil
        focusedField = nil

        Task {
            do {
                try await authService.login(email: email, password: password)
            } catch let error as AuthError {
                errorMessage = error.errorDescription
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthService.shared)
}
