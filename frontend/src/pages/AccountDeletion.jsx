import React from "react";
import "./LegalPages.css";

const AccountDeletion = () => {
  const lastUpdated = "May 25, 2026";

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Account &amp; Data Deletion</h1>
        <p className="last-updated">Last Updated: {lastUpdated}</p>

        <section>
          <h2>1. Overview</h2>
          <p>
            CricZone allows you to permanently delete your account and all
            associated data at any time, free of charge, directly from inside
            the app.
          </p>
        </section>

        <section>
          <h2>2. How to Delete Your Account</h2>
          <ol>
            <li>Open the CricZone app on your phone.</li>
            <li>Sign in if you are not already signed in.</li>
            <li>
              Tap the <strong>Profile</strong> tab on the bottom navigation
              bar.
            </li>
            <li>Scroll to the bottom of the Profile page.</li>
            <li>
              Tap <strong>Delete Account</strong> and confirm the action when
              prompted.
            </li>
          </ol>
          <p>
            Once confirmed, the deletion is immediate and irreversible. You
            will be signed out and returned to the welcome screen.
          </p>
        </section>

        <section>
          <h2>3. What Gets Deleted</h2>
          <p>
            When you delete your account, the following data is permanently
            removed from our servers:
          </p>
          <ul>
            <li>Your phone number and display name</li>
            <li>All matches you have created or scored</li>
            <li>All tournaments you have created</li>
            <li>Player and team name suggestions tied to your account</li>
            <li>Any in-progress match state</li>
          </ul>
        </section>

        <section>
          <h2>4. What is Retained (and Why)</h2>
          <p>
            We do not retain any personal data about you after deletion. We
            may keep anonymised, aggregated technical logs (without personal
            identifiers) for up to 30 days for security and abuse-prevention
            purposes, after which they are also removed.
          </p>
        </section>

        <section>
          <h2>5. Can't Access the App?</h2>
          <p>
            If you cannot sign in or cannot reach the in-app delete option,
            email us at
            <a href="mailto:support@cric-zone.com"> support@cric-zone.com</a>
            from the phone number registered to your account. Include the
            phrase "Delete my CricZone account" in the subject line. We will
            verify your identity and process the deletion within 7 business
            days.
          </p>
        </section>

        <section>
          <h2>6. Related Pages</h2>
          <ul>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/support">Support</a></li>
          </ul>
        </section>

        <section>
          <h2>7. Contact</h2>
          <div className="contact-info">
            <p><strong>CricZone</strong></p>
            <p>Email: <a href="mailto:support@cric-zone.com">support@cric-zone.com</a></p>
            <p>Website: <a href="https://cric-zone.com">https://cric-zone.com</a></p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccountDeletion;
