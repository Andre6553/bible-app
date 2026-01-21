import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Legal.css';

const Legal = ({ type = 'privacy' }) => {
    const navigate = useNavigate();

    const sections = {
        privacy: {
            title: 'Privacy Policy',
            subtitle: 'Global Data Protection Compliant (POPIA, GDPR, CCPA)',
            content: (
                <div className="legal-content">
                    <section>
                        <h3>1. Introduction</h3>
                        <p>Welcome to Omni Bible. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website (regardless of where you visit it from) and tell you about your privacy rights and how the law protects you.</p>
                        <p>For users worldwide, this policy is designed to comply with global standards including <strong>POPIA</strong> (South Africa), <strong>GDPR</strong> (Europe), and <strong>CCPA</strong> (USA).</p>
                    </section>
                    <section>
                        <h3>2. The Data We Collect</h3>
                        <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
                        <ul>
                            <li><strong>Identity Data:</strong> Includes email address and display name.</li>
                            <li><strong>Usage Data:</strong> Includes information about how you use our app, search history, and Bible reading progress.</li>
                            <li><strong>User Content:</strong> Includes your highlights, notes, and study plans (stored securely in our database).</li>
                        </ul>
                    </section>
                    <section>
                        <h3>3. How We Use Your Data</h3>
                        <p>We only use your data to provide and improve the Bible study experience. This includes:</p>
                        <ul>
                            <li>Authenticating your account via Supabase.</li>
                            <li>Syncing your notes and highlights across devices.</li>
                            <li>Processing subscriptions via PayFast (we do not store your credit card details; they are handled by the payment provider).</li>
                        </ul>
                    </section>
                    <section>
                        <h3>4. Data Security</h3>
                        <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way. We use Row Level Security (RLS) to ensure that only you can access your private notes and data.</p>
                    </section>
                    <section id="deletion">
                        <h3>5. Data Deletion and Your Rights</h3>
                        <p>You have the right to access, correct, or request the <strong>complete deletion</strong> of your personal data at any time. This includes your account identity, highlights, notes, and study history.</p>
                        <p>To request account deletion, you can:</p>
                        <ul>
                            <li>Go to your <strong>Profile</strong> page within the app and select "Delete Account".</li>
                            <li>Send an email to <strong>andre@omnibible.online</strong> with the subject "Data Deletion Request" from your registered email address.</li>
                        </ul>
                        <p>Requests are processed within 7 business days. Once deleted, your data cannot be recovered.</p>
                    </section>
                </div>
            )
        },
        terms: {
            title: 'Terms of Service',
            subtitle: 'Usage Agreement',
            content: (
                <div className="legal-content">
                    <section>
                        <h3>1. Agreement to Terms</h3>
                        <p>By accessing Omni Bible, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
                    </section>
                    <section>
                        <h3>2. Use License</h3>
                        <p>Permission is granted to use the app for personal, non-commercial Bible study and devotional purposes. This is the grant of a license, not a transfer of title.</p>
                    </section>
                    <section>
                        <h3>3. Subscriptions</h3>
                        <p>Paid features are provided on a subscription basis. Payments are processed via PayFast. Subscriptions can be managed via the Profile page.</p>
                    </section>
                    <section>
                        <h3>4. Disclaimers</h3>
                        <p>The Bible content and AI-generated insights are provided "as is". While we strive for accuracy, AI interpretations should be verified against scripture. We are not responsible for any inaccuracies in AI-generated articles or studies.</p>
                    </section>
                    <section>
                        <h3>5. User Conduct</h3>
                        <p>You agree not to use the app for any unlawful purpose or to interfere with the operation of the service. We reserve the right to terminate accounts that violate these terms.</p>
                    </section>
                </div>
            )
        }
    };

    const current = sections[type] || sections.privacy;

    return (
        <div className="legal-page">
            <header className="legal-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    ← Back
                </button>
                <div className="header-titles">
                    <h1>{current.title}</h1>
                    <span className="subtitle">{current.subtitle}</span>
                </div>
            </header>

            <main className="legal-main">
                {current.content}
            </main>

            <footer className="legal-footer">
                <p>© {new Date().getFullYear()} Omni Bible. Built with faith for the world.</p>
            </footer >
        </div>
    );
};

export default Legal;
