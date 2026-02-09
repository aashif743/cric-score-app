import React from "react";
import "./LegalPages.css";

const PrivacyPolicy = () => {
  const lastUpdated = "February 9, 2026";

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last Updated: {lastUpdated}</p>

        <section>
          <h2>1. Introduction</h2>
          <p>
            Welcome to CricZone ("we," "our," or "us"). This Privacy Policy explains how we collect,
            use, disclose, and safeguard your information when you use our mobile application
            CricZone and related services (collectively, the "Service").
          </p>
          <p>
            Please read this Privacy Policy carefully. By using the Service, you agree to the
            collection and use of information in accordance with this policy.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>

          <h3>2.1 Personal Information</h3>
          <p>We collect the following personal information when you use our Service:</p>
          <ul>
            <li>
              <strong>Phone Number:</strong> Required for account creation and authentication via
              one-time password (OTP).
            </li>
            <li>
              <strong>Display Name:</strong> Optional name you provide during registration to
              personalize your experience.
            </li>
          </ul>

          <h3>2.2 User-Generated Content</h3>
          <p>When you use the Service, you may create and store:</p>
          <ul>
            <li>Cricket match data (teams, scores, player statistics)</li>
            <li>Tournament information (names, team configurations)</li>
            <li>Player and team names for autocomplete suggestions</li>
          </ul>

          <h3>2.3 Automatically Collected Information</h3>
          <p>We automatically collect certain information when you use the Service:</p>
          <ul>
            <li>Device type and operating system</li>
            <li>App version</li>
            <li>Timestamps of activities (match creation, updates)</li>
          </ul>

          <h3>2.4 Information We Do NOT Collect</h3>
          <ul>
            <li>Location data</li>
            <li>Contact lists</li>
            <li>Photos or media (unless you explicitly share scorecards)</li>
            <li>Browsing history</li>
            <li>Advertising identifiers</li>
            <li>Payment or financial information</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Create and manage your account</li>
            <li>Authenticate you via SMS one-time passwords</li>
            <li>Store and synchronize your cricket match data across devices</li>
            <li>Provide player and team name suggestions for faster scoring</li>
            <li>Enable sharing of scorecards and match results</li>
            <li>Provide live score overlay functionality for streaming</li>
            <li>Improve and optimize the Service</li>
            <li>Respond to your inquiries and support requests</li>
          </ul>
        </section>

        <section>
          <h2>4. How We Share Your Information</h2>

          <h3>4.1 Third-Party Service Providers</h3>
          <p>We share information with the following third parties who assist us in operating the Service:</p>
          <ul>
            <li>
              <strong>SMS Gateway (Textit.biz):</strong> Your phone number is shared to deliver
              authentication codes. They process this data solely for SMS delivery.
            </li>
            <li>
              <strong>Cloud Hosting (Render.com, MongoDB Atlas):</strong> Your data is stored
              securely on these platforms.
            </li>
          </ul>

          <h3>4.2 Public Sharing</h3>
          <p>
            When you use the "Share" feature, your match scorecards may be shared publicly via:
          </p>
          <ul>
            <li>Social media platforms</li>
            <li>Messaging apps</li>
            <li>Public tournament links</li>
            <li>Live overlay URLs for streaming</li>
          </ul>

          <h3>4.3 Legal Requirements</h3>
          <p>We may disclose your information if required by law or to:</p>
          <ul>
            <li>Comply with legal obligations</li>
            <li>Protect our rights and safety</li>
            <li>Prevent fraud or security issues</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Storage and Security</h2>
          <p>
            Your data is stored on secure servers provided by MongoDB Atlas and Render.com.
            We implement industry-standard security measures including:
          </p>
          <ul>
            <li>HTTPS encryption for all data transmission</li>
            <li>JWT token-based authentication</li>
            <li>OTP codes that expire after 10 minutes</li>
            <li>Secure database access controls</li>
          </ul>
          <p>
            While we strive to protect your data, no method of transmission over the internet
            is 100% secure. We cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2>6. Data Retention</h2>
          <p>We retain your information as follows:</p>
          <ul>
            <li>
              <strong>Account Data:</strong> Retained until you request deletion
            </li>
            <li>
              <strong>Match Data:</strong> Retained indefinitely unless you delete it
            </li>
            <li>
              <strong>Authentication Tokens:</strong> Expire after 30 days of inactivity
            </li>
            <li>
              <strong>OTP Codes:</strong> Automatically deleted after 10 minutes
            </li>
          </ul>
        </section>

        <section>
          <h2>7. Your Rights and Choices</h2>
          <p>You have the following rights regarding your data:</p>
          <ul>
            <li>
              <strong>Access:</strong> Request a copy of your personal data
            </li>
            <li>
              <strong>Correction:</strong> Update your display name in the app
            </li>
            <li>
              <strong>Deletion:</strong> Request deletion of your account and associated data
              by contacting us at support@cric-zone.com
            </li>
            <li>
              <strong>Data Portability:</strong> Export your match data via the share feature
            </li>
          </ul>
          <p>
            To exercise these rights, contact us using the information in Section 11.
          </p>
        </section>

        <section>
          <h2>8. Children's Privacy</h2>
          <p>
            The Service is not intended for children under 13 years of age. We do not knowingly
            collect personal information from children under 13. If you are a parent or guardian
            and believe your child has provided us with personal information, please contact us
            immediately.
          </p>
          <p>
            If we discover that a child under 13 has provided us with personal information,
            we will delete such information promptly.
          </p>
        </section>

        <section>
          <h2>9. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your
            country of residence. These countries may have different data protection laws.
            By using the Service, you consent to such transfers.
          </p>
        </section>

        <section>
          <h2>10. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any
            changes by posting the new Privacy Policy on this page and updating the "Last Updated"
            date.
          </p>
          <p>
            Your continued use of the Service after any changes indicates your acceptance of
            the updated Privacy Policy.
          </p>
        </section>

        <section>
          <h2>11. Contact Us</h2>
          <p>If you have questions about this Privacy Policy or our data practices, contact us at:</p>
          <div className="contact-info">
            <p><strong>CricZone</strong></p>
            <p>Email: support@cric-zone.com</p>
            <p>Website: https://cric-zone.com</p>
          </div>
        </section>

        <section>
          <h2>12. Additional Information for Specific Regions</h2>

          <h3>12.1 European Union (GDPR)</h3>
          <p>
            If you are in the EU, you have additional rights under GDPR including the right to
            lodge a complaint with a supervisory authority. Our legal basis for processing is
            your consent (for account creation) and legitimate interest (for service improvement).
          </p>

          <h3>12.2 California (CCPA)</h3>
          <p>
            California residents have the right to know what personal information is collected,
            request deletion, and opt-out of sale of personal information. We do not sell
            personal information.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
