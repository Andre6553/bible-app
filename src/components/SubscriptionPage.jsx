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
    const [userIP, setUserIP] = React.useState(null);
    const [isDiscountEligible, setIsDiscountEligible] = React.useState(true); // Default to Eligible (Optimistic)

    React.useEffect(() => {
        const detectLocationAndIP = async () => {
            let ip = null;
            try {
                // Try Primary (ipapi.co)
                const res = await fetch('https://ipapi.co/json/');
                const data = await res.json();
                if (data.country_code) setCountryCode(data.country_code);
                ip = data.ip;
            } catch (err) {
                console.warn('Primary IP fetch failed, trying fallback...');
                try {
                    // Try Fallback (ipify)
                    const res = await fetch('https://api64.ipify.org?format=json');
                    const data = await res.json();
                    ip = data.ip;
                } catch (fallbackErr) {
                    console.error('All IP fetches failed:', fallbackErr);
                }
            }

            if (ip) {
                setUserIP(ip);
                checkEligibility(ip);
            }
        };

        const checkEligibility = async (ip) => {
            try {
                // Check if this IP has ANY successful payments in history
                const { count, error } = await supabase
                    .from('payment_history')
                    .select('*', { count: 'exact', head: true })
                    .eq('ip_address', ip)
                    .eq('status', 'success');

                if (error && error.code !== '42P01') { // Ignore "table not found" errors initially
                    console.error('Eligibility check error:', error);
                }

                // Only REVOKE eligibility if we find a record
                if (count > 0) setIsDiscountEligible(false);

            } catch (err) {
                console.warn('Silent eligibility check failed', err);
                setIsDiscountEligible(true); // Default to eligible on error to avoid friction
            }
        };

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

        detectLocationAndIP();
        fetchPricing();

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

                        // 1. Upgrade User Profile
                        const { error } = await supabase
                            .from('user_profiles')
                            .update({
                                subscription_tier: 'premium',
                                subscription_override: 'premium',
                                subscription_expiry: expiryISO,
                                last_renewal_month: new Date().toISOString().slice(0, 7)
                            })
                            .eq('user_id', user.id);

                        // 2. Log Payment for IP Tracking (Silent)
                        // This allows us to track "one discount per IP" in the future
                        try {
                            // Re-fetch IP if context was lost during redirect (best effort)
                            const ipRes = await fetch('https://ipapi.co/json/');
                            const ipData = await ipRes.json();

                            await supabase.from('payment_history').insert([{
                                user_id: user.id,
                                ip_address: ipData.ip || 'unknown',
                                status: 'success',
                                amount: 'subscribed', // We can enhance this to track exact amount later
                                provider: 'payfast'
                            }]);
                        } catch (logErr) {
                            console.warn('Payment logging failed', logErr);
                        }

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

            // Apply 50% discount if eligible
            let finalPrice = randPrice;
            if (isDiscountEligible && randPrice) {
                finalPrice = Math.floor(parseInt(randPrice) * 0.5).toString();
            } else if (!randPrice) {
                finalPrice = '85'; // Fallback
            }

            const amount = `${finalPrice}.00`;
            const item_name = isDiscountEligible ? 'Omni Bible Subscription (50% Off)' : 'Omni Bible Subscription';
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
                    {isDiscountEligible && (
                        <div className="discount-banner" style={{
                            background: '#fbbf24',
                            color: 'black',
                            padding: '4px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            borderRadius: '20px',
                            marginBottom: '10px'
                        }}>
                            🎉 50% OFF First Month
                        </div>
                    )}
                    <div className="card-header">
                        <div className="best-value">{isAf ? 'Beste Waarde' : 'Best Value'}</div>
                        <h2>{isAf ? 'Premium' : 'Premium'}</h2>
                        <div className="price">
                            {countryCode === 'ZA' ? (
                                <>
                                    {isDiscountEligible && randPrice ? (
                                        <>
                                            <span style={{ textDecoration: 'line-through', opacity: 0.6, fontSize: '0.7em', marginRight: '6px' }}>
                                                R{randPrice}
                                            </span>
                                            R{Math.floor(parseInt(randPrice) * 0.5)}
                                        </>
                                    ) : (
                                        randPrice ? `R${randPrice}` : <span style={{ fontSize: '0.5em', verticalAlign: 'middle' }}>...</span>
                                    )}
                                </>
                            ) : (
                                <>
                                    {isDiscountEligible ? (
                                        <>
                                            <span style={{ textDecoration: 'line-through', opacity: 0.6, fontSize: '0.7em', marginRight: '6px' }}>
                                                ${basePriceUsd}
                                            </span>
                                            ${(basePriceUsd * 0.5).toFixed(2)}
                                        </>
                                    ) : (
                                        `$${basePriceUsd}`
                                    )}
                                </>
                            )}
                            <span>/mo</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '5px' }}>
                            {countryCode === 'ZA' && (
                                isDiscountEligible
                                    ? `(${(basePriceUsd * 0.5).toFixed(2)} USD)`
                                    : `($${basePriceUsd} USD)`
                            )}
                        </div>
                    </div>
                    <ul className="features-list">

                        <li>
                            <span className="check">✨</span>
                            <strong>{isAf ? 'Onbeperkte AI Soektogte' : 'Unlimited AI Searches'}</strong>
                        </li>
                        <li>
                            <span className="check">🚀</span>
                            <strong>{isAf ? 'Super User Status' : 'Super User Status'}</strong>
                            <div style={{ fontSize: '0.8em', opacity: 0.8, marginLeft: '24px' }}>
                                {isAf ? '(Kry kits verversings)' : '(Get instant refreshes)'}
                            </div>
                        </li>
                        <li>
                            <span className="check">🧠</span>
                            {isAf ? 'Gevorderde Navorsing' : 'Advanced Research Tools'}
                        </li>
                        <li>
                            <span className="check">⛪</span>
                            {isAf ? 'Onbeperkte Preek Skeppings' : 'Unlimited Sermon creations'}
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
