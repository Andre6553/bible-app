import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../config/supabaseClient';
import './SubscriptionPage.css';

const SubscriptionPage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const isAf = settings.language === 'af';

    const [secretCode, setSecretCode] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [randPrice, setRandPrice] = React.useState(null);

    React.useEffect(() => {
        // Fetch Exchange Rate
        fetch('https://api.exchangerate-api.com/v4/latest/USD')
            .then(res => res.json())
            .then(data => {
                const rate = data.rates.ZAR;
                const rands = (5 * rate).toFixed(0); // $5 * rate
                setRandPrice(rands);
            })
            .catch(err => console.error('Error fetching exchange rate:', err));
    }, []);

    const handleApplyCode = async () => {
        const code = secretCode.trim();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert(isAf ? 'U moet aangemeld wees.' : 'You must be logged in.');
                setLoading(false);
                return;
            }

            let updates = {};
            let message = '';

            if (code === 'Andre@58078') {
                updates = { subscription_override: 'admin' };
                message = isAf ? 'Admin toegang toegestaan! (Premium)' : 'Admin access granted! (Premium)';
            } else if (code === 'Test') {
                updates = {
                    subscription_override: 'tester',
                    // Reset renewal month to force a fresh start or track current
                    last_renewal_month: new Date().toISOString().slice(0, 7),
                    sermon_trial_count: 0,
                    ai_usage_count: 0
                };
                message = isAf ? 'Toets toegang toegestaan! (10 Preke / 500 AI)' : 'Tester access granted! (10 Sermons / 500 AI)';
            } else {
                alert(isAf ? 'Ongeldige kode.' : 'Invalid code.');
                setLoading(false);
                return;
            }

            const { error } = await supabase
                .from('user_profiles')
                .update(updates)
                .eq('user_id', user.id);

            if (error) throw error;

            // Clear local storage overrides to avoid confusion
            localStorage.removeItem('subscription_override');
            localStorage.removeItem('tester_last_renewal_month');

            alert(message);
            navigate('/sermon-prep');

        } catch (error) {
            console.error('Error applying code:', error);
            alert(isAf ? 'Fout met die opdatering.' : 'Error updating profile.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="subscription-page">
            <header className="sub-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    ← {isAf ? 'Terug' : 'Back'}
                </button>
                <h1>{isAf ? 'Ontsluit Premium' : 'Unlock Premium'}</h1>
            </header>

            {/* Secret Code Section (Hidden-ish) */}
            <div className="secret-code-section" style={{ textAlign: 'center', marginBottom: '30px', opacity: 0.7 }}>
                <input
                    type="password"
                    placeholder={isAf ? 'Geheime Kode...' : 'Secret Code...'}
                    value={secretCode}
                    onChange={(e) => setSecretCode(e.target.value)}
                    style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #4b5563',
                        background: '#1f2937',
                        color: '#fff',
                        marginRight: '10px'
                    }}
                />
                <button
                    onClick={handleApplyCode}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        background: '#374151',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    {isAf ? 'Pas Toe' : 'Apply'}
                </button>
            </div>

            <div className="pricing-container">
                {/* Free Tier Card */}
                <div className="pricing-card free">
                    <div className="card-header">
                        <h2>{isAf ? 'Gratis' : 'Free'}</h2>
                        <div className="price">$0<span>/mo</span></div>
                    </div>
                    <ul className="features-list">
                        <li>
                            <span className="check">✓</span>
                            {isAf ? '3 Preke Kwota' : '3 Sermons Quota'}
                        </li>
                        <li>
                            <span className="check">✓</span>
                            {isAf ? '50 AI Generasies' : '50 AI Generations'}
                        </li>
                        <li>
                            <span className="check">✓</span>
                            {isAf ? 'Basiese Bybelgereedskap' : 'Basic Bible Tools'}
                        </li>
                    </ul>
                    <div className="current-plan-badge">
                        {isAf ? 'Huidige Plan' : 'Current Plan'}
                    </div>
                </div>

                {/* Premium Tier Card */}
                <div className="pricing-card premium">
                    <div className="card-header">
                        <div className="best-value">{isAf ? 'Beste Waarde' : 'Best Value'}</div>
                        <h2>{isAf ? 'Premium' : 'Premium'}</h2>
                        <div className="price">
                            $5<span>/mo</span>
                            {randPrice && <div style={{ fontSize: '0.5em', color: '#9ca3af', marginTop: '4px', fontWeight: 'normal' }}>
                                (≈ R{randPrice})
                            </div>}
                        </div>
                    </div>
                    <ul className="features-list">
                        <li>
                            <span className="check">✨</span>
                            <strong>{isAf ? 'Onbeperkte Preke' : 'Unlimited Sermons'}</strong>
                        </li>
                        <li>
                            <span className="check">✨</span>
                            <strong>{isAf ? 'Onbeperkte AI Generasies' : 'Unlimited AI Generations'}</strong>
                        </li>
                        <li>
                            <span className="check">✨</span>
                            {isAf ? 'Gevorderde Navorsing' : 'Advanced Research Tools'}
                        </li>
                        <li>
                            <span className="check">✨</span>
                            {isAf ? 'Prioriteit Ondersteuning' : 'Priority Support'}
                        </li>
                    </ul>
                    <button className="upgrade-btn" onClick={() => alert(isAf ? 'Betalings word binnekort bygevoeg!' : 'Payments pending integration!')}>
                        {isAf ? 'Gradeer Nou Op' : 'Upgrade Now'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPage;
