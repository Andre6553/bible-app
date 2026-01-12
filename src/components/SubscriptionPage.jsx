import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../config/supabaseClient';
import md5 from 'crypto-js/md5';
import './SubscriptionPage.css';

const SubscriptionPage = () => {
    const navigate = useNavigate();
    const { settings, fetchProfile } = useSettings();
    const isAf = settings.language === 'af';

    const [loading, setLoading] = React.useState(false);
    const [randPrice, setRandPrice] = React.useState(null);
    const [basePriceUsd, setBasePriceUsd] = React.useState(5);
    const [countryCode, setCountryCode] = React.useState('ZA'); // Default to ZA

    React.useEffect(() => {
        const fetchPricing = async () => {
            try {
                const { data: config } = await supabase
                    .from('app_config')
                    .select('value')
                    .eq('key', 'base_subscription_price_usd')
                    .single();

                const base = config ? parseFloat(config.value) : 5;
                setBasePriceUsd(base);

                const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                const data = await res.json();
                const rate = data.rates.ZAR;

                const rands = (base * rate).toFixed(0);
                setRandPrice(rands);
            } catch (err) {
                console.error('Error fetching pricing:', err);
                setRandPrice('85');
            }
        };

        const detectLocation = async () => {
            try {
                const res = await fetch('https://ipapi.co/json/');
                const data = await res.json();
                if (data.country_code) {
                    setCountryCode(data.country_code);
                }
            } catch (err) {
                console.warn('Geolocation failed:', err);
            }
        };

        fetchPricing();
        detectLocation();

        const checkPaymentStatus = async () => {
            const params = new URLSearchParams(window.location.search);
            const paymentStatus = params.get('payment');

            if (paymentStatus === 'success') {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const expiryDate = new Date();
                        expiryDate.setDate(expiryDate.getDate() + 30);
                        const expiryISO = expiryDate.toISOString();

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
                            alert('Payment successful, but profile update failed.');
                        } else {
                            await fetchProfile(user.id);
                            alert(isAf ? 'Betaling Suksesvol!' : 'Payment Successful!');
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
    }, [navigate, isAf, fetchProfile]);

    const handlePayment = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert(isAf ? 'Teken asseblief eers in.' : 'Please log in first.');
                navigate('/auth');
                return;
            }

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
                const expiry = profile?.subscription_expiry
                    ? new Date(profile.subscription_expiry).toLocaleDateString(undefined, { dateStyle: 'long' })
                    : 'Lifetime/Admin';
                alert(isAf
                    ? `U is reeds ingeteken totdat: ${expiry}.`
                    : `You are already subscribed until: ${expiry}.`
                );
                setLoading(false);
                return;
            }

            const USE_SANDBOX = false;
            const baseUrl = USE_SANDBOX ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process';
            const receiver = USE_SANDBOX ? '10000100' : '11945617';
            const merchantKey = USE_SANDBOX ? '46f0cd694581a' : '9anvup217hdck';

            const amount = randPrice ? `${randPrice}.00` : '85.00';
            const item_name = 'Omni Bible Subscription';
            const return_url = `${window.location.origin}/subscription?payment=success`;
            const cancel_url = `${window.location.origin}/subscription?payment=cancelled`;
            const custom_str1 = user.id;

            const payParams = new URLSearchParams({
                cmd: '_paynow',
                receiver: receiver,
                item_name: item_name,
                amount: amount,
                return_url: return_url,
                cancel_url: cancel_url,
                custom_str1: custom_str1,
                merchant_key: merchantKey
            });

            window.location.href = `${baseUrl}?${payParams.toString()}`;
        } catch (error) {
            console.error('Payment Error:', error);
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
                            {countryCode === 'ZA' ? (
                                <>
                                    {randPrice ? `R${randPrice}` : <span style={{ fontSize: '0.5em', verticalAlign: 'middle' }}>...</span>}
                                </>
                            ) : (
                                `$${basePriceUsd}`
                            )}
                            <span>/mo</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '5px' }}>
                            {countryCode === 'ZA' && `($${basePriceUsd} USD)`}
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
                    {countryCode !== 'ZA' && (
                        <p style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '12px', color: '#9ca3af', textAlign: 'center' }}>
                            {isAf
                                ? '* Transaksies word in ZAR verwerk teen die huidige wisselkoers.'
                                : '* Transactions are processed in ZAR at the current exchange rate.'}
                        </p>
                    )}
                </div>
            </div>
            {/* Footer Spacer to ensure clearance */}
            <div style={{ height: '150px', width: '100%' }} className="footer-padding-spacer" />
        </div>
    );
};

export default SubscriptionPage;
