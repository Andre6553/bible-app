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
        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('payment');

        if (paymentStatus === 'success') {
            alert(isAf ? 'Betaling Suksesvol! Dankie vir jou ondersteuning.' : 'Payment Successful! Thank you for your support.');
            // Ideally, here we would verify with backend.
            // For checking purposes, we can reload profile or navigate away.
            navigate('/sermon-prep');
        } else if (paymentStatus === 'cancelled') {
            alert(isAf ? 'Betaling Gekanselleer.' : 'Payment Cancelled.');
        }

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

            // --- PAYFAST CONFIGURATION ---
            const USE_SANDBOX = false; // Set to FALSE to go live (Real Money)

            const config = USE_SANDBOX ? {
                // SANDBOX (Test)
                merchant_id: '10000100',
                merchant_key: '46f0cd694581a',
                passPhrase: '',
                baseUrl: 'https://sandbox.payfast.co.za/eng/process'
            } : {
                // PRODUCTION (Real)
                merchant_id: '11945617',
                merchant_key: '9anvup217hdck',
                passPhrase: 'OmniBibleApp',
                baseUrl: 'https://www.payfast.co.za/eng/process'
            };
            // -----------------------------

            const merchant_id = config.merchant_id;
            const merchant_key = config.merchant_key;

            const name_first = user.user_metadata?.full_name || localStorage.getItem('display_name') || 'Valued';
            const name_last = 'User';
            const email_address = user.email;
            const m_payment_id = `sub_${user.id.slice(0, 5)}_${Date.now()}`;
            const amount = '85.00';
            const item_name = 'Omni Bible Subscription';

            const return_url = `${window.location.origin}/sermon-prep?payment=success`;
            const cancel_url = `${window.location.origin}/subscription?payment=cancelled`;
            const custom_str1 = user.id;

            // 2. Build Data Object
            const data = {
                merchant_id,
                merchant_key,
                return_url,
                cancel_url,
                name_first,
                name_last,
                email_address,
                m_payment_id,
                amount,
                item_name,
                custom_str1
            };

            // 3. Generate Signature
            // PayFast requires specific encoding for the signature string.
            const orderedKeys = [
                'merchant_id',
                'merchant_key',
                'return_url',
                'cancel_url',
                'name_first',
                'name_last',
                'email_address',
                'm_payment_id',
                'amount',
                'item_name',
                'custom_str1'
            ];

            // Helper to match PHP urlencode (used by PayFast SIGNATURE generation only)
            const phpUrlEncode = (str) => {
                return encodeURIComponent(str)
                    .replace(/%20/g, '+')
                    .replace(/[!'()*]/g, function (c) {
                        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
                    });
            };

            let pfOutput = '';

            orderedKeys.forEach(key => {
                if (data[key] !== undefined && data[key] !== '') {
                    pfOutput += `${key}=${phpUrlEncode(data[key].trim())}&`;
                }
            });

            let getString = pfOutput.slice(0, -1); // Remove last &

            let signature = null;
            if (config.passPhrase) {
                getString += `&passphrase=${phpUrlEncode(config.passPhrase.trim())}`;
                signature = md5(getString).toString();
            }

            console.log('Signature Base String:', getString);

            // 4. Submit via POST (Hidden Form)
            // This avoids 500 errors often caused by long GET URLs
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = config.baseUrl;
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

            // Add Signature
            if (signature) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'signature';
                input.value = signature;
                form.appendChild(input);
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
