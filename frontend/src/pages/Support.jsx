import React from "react";
import "./LegalPages.css";

const Support = () => {
  const lastUpdated = "May 25, 2026";

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Support</h1>
        <p className="last-updated">Last Updated: {lastUpdated}</p>

        <section>
          <h2>1. Getting Started</h2>
          <p>
            CricZone is a cricket scoring app for clubs, schools and weekend
            cricketers. You can start using it in three quick steps:
          </p>
          <ol>
            <li>
              <strong>Install the app</strong> from the App Store (iOS) or
              install the APK on Android.
            </li>
            <li>
              <strong>Sign in with your phone number.</strong> A 4-digit
              one-time code is sent to your phone — enter it to verify.
            </li>
            <li>
              <strong>Start scoring.</strong> From the dashboard, tap
              <em> Quick Match</em> for a single match, or open the
              <em> Tournaments</em> tab to create a knockout tournament.
            </li>
          </ol>
        </section>

        <section>
          <h2>2. Frequently Asked Questions</h2>

          <h3>2.1 I didn't receive my OTP. What should I do?</h3>
          <p>
            OTPs are delivered by SMS and usually arrive within 30 seconds.
            If yours hasn't arrived:
          </p>
          <ul>
            <li>Confirm you typed the right phone number (no country code prefix needed).</li>
            <li>Check your phone has signal and SMS messages are enabled.</li>
            <li>Tap <em>Resend OTP</em> after one minute.</li>
            <li>
              If the problem persists, email us at
              <a href="mailto:support@cric-zone.com"> support@cric-zone.com</a>
              with your phone number and we'll investigate.
            </li>
          </ul>

          <h3>2.2 How do I create a tournament?</h3>
          <p>
            Open the <em>Tournaments</em> tab from the bottom bar, choose a
            format (Quick or Knockout), tap the <em>+</em> button, fill in
            tournament name, number of teams, overs and players per team, then
            tap <em>Create</em>. For knockout tournaments, the bracket is
            generated automatically and you can begin the first match
            immediately.
          </p>

          <h3>2.3 How does the team rename feature work?</h3>
          <p>
            Inside a tournament, tap a team name on the match setup screen and
            type a new name. The change is applied across the entire tournament
            — past matches, future matches, the bracket, and tournament stats
            all update to use the new name automatically.
          </p>

          <h3>2.4 Can I undo a wrong ball entry?</h3>
          <p>
            Yes. Every scoring action can be undone. After recording a ball,
            tap the <em>Undo Last Ball</em> button (the red curved arrow) to
            revert. Multiple undos in a row are supported.
          </p>

          <h3>2.5 What does the "Delivery Type" option do when recording a Run Out?</h3>
          <p>
            For a run out, you can choose whether the delivery was Legal, a
            Wide, a No Ball, a Leg Bye or a Bye. The app correctly distributes
            runs and extras based on the chosen delivery type so the scorecard
            stays accurate.
          </p>

          <h3>2.6 Can I use the app without an internet connection?</h3>
          <p>
            The first sign-in requires internet (to receive your OTP). After
            that, in-progress matches continue to score offline and sync to
            our servers automatically when your connection is restored.
          </p>

          <h3>2.7 Does CricZone show ads or charge for features?</h3>
          <p>
            No. CricZone is free to use, contains no advertisements and has
            no in-app purchases.
          </p>

          <h3>2.8 What data does CricZone store about me?</h3>
          <p>
            Only what's needed for the app to work — your phone number,
            display name, and the match data you create. We don't track your
            location, contacts, photos or browsing activity. Read our full
            <a href="/privacy"> Privacy Policy</a> for details.
          </p>
        </section>

        <section>
          <h2>3. Account &amp; Data</h2>

          <h3>3.1 How do I delete my account?</h3>
          <p>
            You can permanently delete your account directly from the app:
          </p>
          <ol>
            <li>Open the app and sign in.</li>
            <li>Tap the <strong>Profile</strong> tab in the bottom bar.</li>
            <li>Tap <strong>Delete Account</strong> and confirm.</li>
          </ol>
          <p>
            Your account and all associated data (matches, tournaments,
            scorecards, name suggestions) are permanently removed immediately.
            This action cannot be undone.
          </p>
          <p>
            If you have trouble accessing the in-app option, email us at
            <a href="mailto:support@cric-zone.com"> support@cric-zone.com</a>
            from the phone number registered to your account and we'll process
            the deletion within 7 days.
          </p>

          <h3>3.2 How do I change my display name?</h3>
          <p>
            Open <strong>Profile</strong> and tap your name to edit it. The
            new name is saved immediately.
          </p>

          <h3>3.3 Where is my data stored?</h3>
          <p>
            Your matches and tournament data are stored on secure cloud
            servers and synchronised to any device you sign in to with the
            same phone number.
          </p>
        </section>

        <section>
          <h2>4. Reporting a Problem</h2>
          <p>
            If you encounter a bug, a crash, or unexpected behaviour, please
            email us with as much detail as possible:
          </p>
          <ul>
            <li>What you were doing when the problem occurred</li>
            <li>What you expected to happen</li>
            <li>What actually happened (screenshots help a lot)</li>
            <li>Your device model and operating system version</li>
            <li>Your app version (visible at the bottom of the Profile page)</li>
          </ul>
          <p>
            Send to <a href="mailto:support@cric-zone.com">support@cric-zone.com</a>.
            We respond within 1–2 business days.
          </p>
        </section>

        <section>
          <h2>5. Contact Us</h2>
          <p>For any other questions, suggestions, or feedback, reach us at:</p>
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

export default Support;
