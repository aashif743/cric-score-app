import React from "react";
import "./LegalPages.css";

const TermsOfService = () => {
  const lastUpdated = "February 9, 2026";

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Terms of Service</h1>
        <p className="last-updated">Last Updated: {lastUpdated}</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By downloading, installing, or using the CricZone mobile application ("App") and
            related services (collectively, the "Service"), you agree to be bound by these
            Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>
            CricZone is a cricket scoring and tournament management application that allows users to:
          </p>
          <ul>
            <li>Score live cricket matches with detailed ball-by-ball tracking</li>
            <li>Create and manage cricket tournaments</li>
            <li>Track player and team statistics</li>
            <li>Share scorecards and match results</li>
            <li>Generate live score overlays for streaming</li>
            <li>View historical match data and analytics</li>
          </ul>
        </section>

        <section>
          <h2>3. User Accounts</h2>

          <h3>3.1 Registration</h3>
          <p>
            To access certain features, you must create an account using your phone number.
            You agree to provide accurate information and keep your account credentials secure.
          </p>

          <h3>3.2 Guest Mode</h3>
          <p>
            You may use limited features without an account. Guest data is stored locally
            and not synchronized across devices.
          </p>

          <h3>3.3 Account Responsibility</h3>
          <p>
            You are responsible for all activities under your account. Notify us immediately
            if you suspect unauthorized access.
          </p>
        </section>

        <section>
          <h2>4. User-Generated Content</h2>

          <h3>4.1 Your Content</h3>
          <p>
            You retain ownership of content you create (match data, team names, player names,
            tournament information). By using the Service, you grant us a license to store,
            display, and share this content as necessary to provide the Service.
          </p>

          <h3>4.2 Content Guidelines</h3>
          <p>You agree not to submit content that:</p>
          <ul>
            <li>Is illegal, harmful, or offensive</li>
            <li>Infringes on intellectual property rights</li>
            <li>Contains personal information of others without consent</li>
            <li>Is false, misleading, or fraudulent</li>
            <li>Contains malware or harmful code</li>
          </ul>

          <h3>4.3 Shared Content</h3>
          <p>
            When you share scorecards, tournament links, or overlay URLs, this content becomes
            publicly accessible. You are responsible for content you choose to share.
          </p>
        </section>

        <section>
          <h2>5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with or disrupt the Service</li>
            <li>Reverse engineer or decompile the App</li>
            <li>Use automated scripts or bots</li>
            <li>Impersonate other users or entities</li>
            <li>Abuse the OTP system (e.g., sending excessive verification requests)</li>
            <li>Use the Service to harass, abuse, or harm others</li>
          </ul>
        </section>

        <section>
          <h2>6. Intellectual Property</h2>

          <h3>6.1 Our Rights</h3>
          <p>
            The Service, including its design, features, and content (excluding user-generated
            content), is owned by CricZone and protected by intellectual property laws.
          </p>

          <h3>6.2 Limited License</h3>
          <p>
            We grant you a limited, non-exclusive, non-transferable license to use the App
            for personal, non-commercial purposes.
          </p>

          <h3>6.3 Trademarks</h3>
          <p>
            "CricZone" and our logo are trademarks. You may not use them without our prior
            written consent.
          </p>
        </section>

        <section>
          <h2>7. Third-Party Services</h2>
          <p>
            The Service integrates with third-party services (SMS providers, cloud hosting).
            Your use of these services is subject to their respective terms and privacy policies.
          </p>
        </section>

        <section>
          <h2>8. Disclaimers</h2>

          <h3>8.1 "As Is" Service</h3>
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
            EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
            AND NON-INFRINGEMENT.
          </p>

          <h3>8.2 No Guarantee</h3>
          <p>
            We do not guarantee that the Service will be uninterrupted, error-free, or secure.
            We are not responsible for data loss or service interruptions.
          </p>

          <h3>8.3 Score Accuracy</h3>
          <p>
            CricZone is a scoring tool. We are not responsible for scoring errors made by users
            or the accuracy of match statistics.
          </p>
        </section>

        <section>
          <h2>9. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, CRICZONE SHALL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
            LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
          </p>
          <p>
            OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS
            (WHICH IS ZERO, AS THE SERVICE IS FREE).
          </p>
        </section>

        <section>
          <h2>10. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless CricZone, its affiliates, and their
            respective officers, directors, and employees from any claims, damages, or expenses
            arising from your use of the Service or violation of these Terms.
          </p>
        </section>

        <section>
          <h2>11. Termination</h2>

          <h3>11.1 By You</h3>
          <p>
            You may stop using the Service at any time. To delete your account, contact us
            at support@cric-zone.com.
          </p>

          <h3>11.2 By Us</h3>
          <p>
            We may suspend or terminate your access if you violate these Terms or for any
            other reason at our discretion.
          </p>

          <h3>11.3 Effect of Termination</h3>
          <p>
            Upon termination, your right to use the Service ceases. Provisions that should
            survive termination (e.g., limitation of liability) will remain in effect.
          </p>
        </section>

        <section>
          <h2>12. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time. We will notify you of significant changes
            by posting the updated Terms in the App or on our website. Your continued use
            after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2>13. Governing Law</h2>
          <p>
            These Terms are governed by the laws of [Your Jurisdiction], without regard to
            conflict of law principles. Any disputes shall be resolved in the courts of
            [Your Jurisdiction].
          </p>
        </section>

        <section>
          <h2>14. Severability</h2>
          <p>
            If any provision of these Terms is found unenforceable, the remaining provisions
            will continue in effect.
          </p>
        </section>

        <section>
          <h2>15. Entire Agreement</h2>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire agreement
            between you and CricZone regarding the Service.
          </p>
        </section>

        <section>
          <h2>16. Contact Us</h2>
          <p>For questions about these Terms, contact us at:</p>
          <div className="contact-info">
            <p><strong>CricZone</strong></p>
            <p>Email: support@cric-zone.com</p>
            <p>Website: https://cric-zone.com</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
