-- Blog Feature Database Schema
-- Run this in Supabase SQL Editor

-- =====================================================
-- App-wide settings (admin toggles)
-- =====================================================
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize with blog rate limit OFF (for testing)
INSERT INTO app_settings (key, value) 
VALUES ('blog_rate_limit_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- Blog posts (curated content library)
-- =====================================================
CREATE TABLE IF NOT EXISTS blog_posts (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    topics TEXT[],  -- Array of topic tags like ['faith', 'love', 'prayer']
    scripture_refs TEXT[],  -- Related verses like ['John 3:16', 'Romans 8:28']
    author TEXT DEFAULT 'AI Assistant',
    is_generated BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- User interests (derived from search history)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_interests (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    weight INT DEFAULT 1,  -- How often they searched this topic
    last_searched TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, topic)
);

-- =====================================================
-- User devotionals (cached daily AI generations)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_devotionals (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    topics TEXT[],  -- Topics used to generate this devotional
    generated_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, generated_date)  -- Only 1 per user per day when rate limited
);

-- =====================================================
-- Indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_devotionals_user_date ON user_devotionals(user_id, generated_date);
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_topics ON blog_posts USING GIN(topics);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devotionals ENABLE ROW LEVEL SECURITY;

-- App Settings: Read by all, write by authenticated/service only
CREATE POLICY "Enable read for all" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Enable update for authenticated" ON app_settings FOR UPDATE USING (true);

-- Blog Posts: Read by all, insert/update by authenticated
CREATE POLICY "Enable read for all" ON blog_posts FOR SELECT USING (true);
CREATE POLICY "Enable insert for all" ON blog_posts FOR INSERT WITH CHECK (true);

-- User Interests: Users can manage their own interests
CREATE POLICY "Enable all for own data" ON user_interests FOR ALL USING (true);

-- User Devotionals: Users can manage their own devotionals
CREATE POLICY "Enable all for own data" ON user_devotionals FOR ALL USING (true);

-- =====================================================
-- Seed some initial curated blog posts
-- =====================================================
INSERT INTO blog_posts (title, content, summary, topics, scripture_refs) VALUES
(
    'Understanding God''s Love',
    'God''s love is the foundation of our faith. In John 3:16, we see the ultimate expression of this love: "For God so loved the world that He gave His one and only Son, that whoever believes in Him shall not perish but have eternal life."

This verse reveals three incredible truths about God''s love:

1. **It''s Universal** - God loves "the world" - every person, regardless of their background, mistakes, or circumstances.

2. **It''s Sacrificial** - Love isn''t just a feeling; it''s an action. God "gave" His Son, the ultimate sacrifice.

3. **It''s Eternal** - The purpose of this love is not temporary happiness, but eternal life.

When we struggle to feel loved, we can return to this truth: God''s love is not based on our performance but on His character. He loved us while we were still sinners (Romans 5:8).

**Prayer:** Lord, help me to truly understand the depth of Your love for me. Let this truth transform how I see myself and others. Amen.',
    'Explore the depth of God''s unconditional love through John 3:16 and discover three incredible truths about divine love.',
    ARRAY['love', 'faith', 'salvation', 'john'],
    ARRAY['John 3:16', 'Romans 5:8']
),
(
    'The Power of Prayer',
    'Prayer is our direct line of communication with God. It''s not just a religious ritual, but a genuine relationship-building conversation with our Creator.

Jesus taught us how to pray in Matthew 6:9-13, often called the Lord''s Prayer. But He also encouraged us to come to God like children come to a loving father.

**Key principles for effective prayer:**

1. **Be Honest** - God knows your heart anyway. Pour out your real feelings, doubts, and desires.

2. **Be Persistent** - Luke 18:1-8 teaches us to pray and not give up. Persistence shows faith.

3. **Be Thankful** - Philippians 4:6 says to present our requests "with thanksgiving." Gratitude opens our hearts.

4. **Listen** - Prayer isn''t a monologue. Take time to be still and listen for God''s guidance.

Remember: God answers every prayer. Sometimes the answer is "yes," sometimes "no," and sometimes "wait." Trust His timing and wisdom.

**Prayer:** Father, teach me to pray. Help me to approach You with confidence, knowing You hear me and care about every detail of my life. Amen.',
    'Discover the key principles of effective prayer and learn how to deepen your conversation with God.',
    ARRAY['prayer', 'faith', 'matthew', 'devotion'],
    ARRAY['Matthew 6:9-13', 'Luke 18:1-8', 'Philippians 4:6']
),
(
    'Finding Peace in Anxious Times',
    'Anxiety is one of the most common struggles people face today. But the Bible offers powerful truths to help us find peace.

Philippians 4:6-7 tells us: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and minds in Christ Jesus."

This passage gives us a clear pathway from anxiety to peace:

1. **Recognize the Command** - "Do not be anxious" isn''t a suggestion; it''s an instruction. God wouldn''t command something impossible.

2. **Replace with Prayer** - When anxiety rises, immediately turn it into prayer. Speak it out to God.

3. **Receive God''s Peace** - The result is supernatural peace that doesn''t make logical sense but guards your heart.

Jesus Himself said, "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid" (John 14:27).

**Prayer:** Lord, I bring my anxieties to You right now. I choose to trust You with my worries and receive Your supernatural peace. Guard my heart and mind in Christ Jesus. Amen.',
    'Find biblical strategies to overcome anxiety and experience the supernatural peace that God promises.',
    ARRAY['peace', 'anxiety', 'trust', 'philippians'],
    ARRAY['Philippians 4:6-7', 'John 14:27', 'Matthew 6:25-34']
),
(
    'Walking in Faith',
    'Faith is described in Hebrews 11:1 as "confidence in what we hope for and assurance about what we do not see." It''s the foundation of our relationship with God.

But faith isn''t just belief - it''s active trust that affects how we live.

**Practical ways to grow your faith:**

1. **Read God''s Word** - Romans 10:17 says "faith comes from hearing, and hearing through the word of Christ." Daily Bible reading builds faith.

2. **Remember Past Faithfulness** - Think about times God has come through for you before. His track record builds confidence for the future.

3. **Step Out in Obedience** - Faith grows when we act on it. Take small steps of obedience even when you don''t see the full picture.

4. **Surround Yourself with Believers** - Community strengthens faith. Hebrews 10:25 encourages us not to forsake meeting together.

Abraham is called the "father of faith" because he believed God''s promises even when they seemed impossible. His example shows us that faith isn''t about understanding everything - it''s about trusting the One who does.

**Prayer:** Lord, increase my faith. Help me to trust You more deeply and step out boldly in obedience to Your word. Amen.',
    'Learn practical ways to grow your faith and trust God more deeply in everyday life.',
    ARRAY['faith', 'trust', 'obedience', 'hebrews'],
    ARRAY['Hebrews 11:1', 'Romans 10:17', 'Hebrews 10:25']
),
(
    'The Gift of Forgiveness',
    'Forgiveness is at the heart of the Gospel. We who have been forgiven much are called to forgive others.

In Ephesians 4:32, Paul writes: "Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you."

**Understanding biblical forgiveness:**

1. **It''s a Command, Not an Option** - Jesus taught in Matthew 6:14-15 that our willingness to forgive others reflects our understanding of God''s forgiveness toward us.

2. **It''s a Process** - Deep hurts may require ongoing choice to forgive. It''s okay if it takes time.

3. **It''s Not Forgetting** - Forgiveness doesn''t mean pretending something didn''t happen. It means releasing the right to revenge.

4. **It''s Freedom** - Unforgiveness is like drinking poison and expecting the other person to die. Forgiveness sets YOU free.

The ultimate example is Jesus on the cross, saying "Father, forgive them, for they do not know what they are doing" (Luke 23:34). If He could forgive those who crucified Him, we can forgive those who hurt us.

**Prayer:** Lord, show me anyone I need to forgive. I choose to release them and trust You to heal my heart. Thank You for forgiving me so completely. Amen.',
    'Understand the biblical meaning of forgiveness and find freedom through releasing those who have hurt you.',
    ARRAY['forgiveness', 'grace', 'healing', 'ephesians'],
    ARRAY['Ephesians 4:32', 'Matthew 6:14-15', 'Luke 23:34', 'Colossians 3:13']
);
