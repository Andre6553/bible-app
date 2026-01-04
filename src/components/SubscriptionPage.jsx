import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../config/supabaseClient';
import md5 from 'crypto-js/md5';
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
                const rands = (5 * rate).toFixed(0);
                setRandPrice(rands);
            })
            .catch(err => console.error('Error fetching exchange rate:', err));

        // Check for Payment Return
        const checkPaymentStatus = async () => {
            const params = new URLSearchParams(window.location.search);
            const paymentStatus = params.get('payment');
            const pfPaymentId = params.get('pf_payment_id'); // PayFast transaction ID

            if (paymentStatus === 'success') {
                console.log('Payment Success detected. Upgrading user...');
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        // Calculate 30 Days from now
                        const expiryDate = new Date();
                        expiryDate.setDate(expiryDate.getDate() + 30);
                        const expiryISO = expiryDate.toISOString();

                        // Client-Side Update (Temporary Fix)
                        const { error } = await supabase
                            .from('user_profiles')
                            .update({
                                subscription_override: 'premium',
                                subscription_expiry: expiryISO,
                                last_renewal_month: new Date().toISOString().slice(0, 7)
                            })
                            .eq('user_id', user.id);

                        if (error) {
                            console.error('Error upgrading profile:', error);
                            alert('Payment successful, but profile update failed. Please contact support.');
                        } else {
                            alert(isAf ? 'Betaling Suksesvol! Welkom by Premium.' : 'Payment Successful! Welcome to Premium.');
                            navigate('/sermon-prep');
                        }
                    }
                } catch (err) {
                    console.error('Error in payment success flow:', err);
                }
            } else if (paymentStatus === 'cancelled') {
                alert(isAf ? 'Betaling Gekanselleer.' : 'Payment Cancelled.');
            }
        };

        checkPaymentStatus();

    }, [navigate, isAf]);

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
            } else if (code === 'ExpireMe') {
                // Testing Tool: Force Expiry
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                updates = {
                    subscription_override: null,
                    subscription_expiry: yesterday.toISOString()
                };
                message = isAf ? 'Afgradeer na Gratis (Verval)' : 'Downgraded to Free (Expired)';
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

    const handlePayment = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert(isAf ? 'Teken asseblief eers in.' : 'Please log in first.');
                navigate('/auth');
                return;
            }

            // Check if already subscribed
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('subscription_override, subscription_expiry')
                .eq('user_id', user.id)
                .single();

            const isPremium = profile?.subscription_override === 'premium' ||
                profile?.subscription_override === 'admin' ||
                profile?.subscription_override === 'tester';

            const hasValidExpiry = profile?.subscription_expiry && new Date(profile.subscription_expiry) > new Date();

            if (isPremium || hasValidExpiry) {
                const expiry = profile?.subscription_expiry ? new Date(profile.subscription_expiry).toLocaleDateString() : 'Lifetime/Admin';
                alert(isAf
                    ? `U is reeds ingeteken totdat: ${expiry}. Geen betaling nodig nie.`
                    : `You are already subscribed until: ${expiry}. No payment needed.`
                );
                setLoading(false);
                return;
            }

            // --- PAYFAST CONFIGURATION ---
            // Toggle this to switch between Sandbox and Live
            const USE_SANDBOX = true;

            // Config logic
            const baseUrl = USE_SANDBOX
                ? 'https://sandbox.payfast.co.za/eng/process'
                : 'https://payment.payfast.io/eng/process';

            const receiver = USE_SANDBOX
                ? '10000100'        // Generic Sandbox Merchant ID
                : '11945617';       // Your Real Merchant ID
            // -----------------------------

            const amount = '85.00';
            const item_name = 'Omni Bible Subscription';
            // FIX: Point back to THIS page so the useEffect above can run and upgrade the user!
            const return_url = `${window.location.origin}/subscription?payment=success`;
            const cancel_url = `${window.location.origin}/subscription?payment=cancelled`;
            const custom_str1 = user.id;

            // 2. Build Data Object (Simple Pay Now structure)
            const data = {
                cmd: '_paynow',
                receiver: receiver,
                item_name: item_name,
                amount: amount,
                return_url: return_url,
                cancel_url: cancel_url,
                // adding custom_str1 to track user ID on return if supported, otherwise extra fields are allowed
                custom_str1: custom_str1
            };

            // 3. No Signature Generation needed for "_paynow" command unless explicitly enforced on account.
            // The user's snippet did NOT have a signature, so we skip it to retrieve the working flow.

            console.log('Starting Simple Payment...');

            // 4. Submit via POST (Hidden Form)
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = baseUrl;
            form.style.display = 'none';

            // Add Data Fields
            for (const key in data) {
                if (data.hasOwnProperty(key) && data[key] !== '') {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = key;
                    input.value = data[key].trim();
                    form.appendChild(input);
                }
            }

            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);

        } catch (error) {
            console.error('Payment Error:', error);
            alert('Something went wrong starting the payment.');
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
                            R85<span>/mo</span>
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
                    <button className="upgrade-btn" onClick={handlePayment} disabled={loading}>
                        {loading ? (isAf ? 'Verwerk...' : 'Processing...') : (isAf ? 'Gradeer Nou Op' : 'Upgrade Now')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPage;
