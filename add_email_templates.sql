-- Add default email template strings to app_settings
INSERT INTO app_settings (key, value)
VALUES 
('email_template_welcome_body', 'Dear New Member,

Welcome to Omni Bible! We are thrilled to have you join our community. Omni Bible is designed to be more than just a reader; it''s a comprehensive tool to help you dive deeper into God''s Word every day.

Here are some of the powerful features you can now explore:
• Read across 8+ versions (including AFR53, AFR83, KJV, NLT, and more).
• Parallel Reading: Compare versions side-by-side for deeper understanding.
• Personal Studies: Create Inductive Bible Studies and Word Studies with AI assistance.
• Highlights & Notes: Color-code your favorite verses and keep personal journals.
• Daily Inspiration: Get fresh, AI-generated devotionals tailored to your interests.
• Fully Responsive: Access your studies seamlessly on both PC and mobile.

We hope Omni Bible becomes a valuable companion in your walk of faith. If you have any questions or feedback, feel free to reach out.

Blessings,
The Omni Bible Team'),
('email_template_admin_body', 'Hello Andre,

A new user has just joined Omni Bible!

Details:
• User ID: {{userId}}
• Email: {{userEmail}}
• Time: {{time}}

You can view more details and user analytics on the Stats Dashboard.

Best regards,
Omni Bible System')
ON CONFLICT (key) DO NOTHING;
