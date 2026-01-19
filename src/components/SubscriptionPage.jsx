import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../config/supabaseClient';
// import { getDeviceFingerprint } from '../utils/appUtils'; // Removed to fix crash
import md5 from 'crypto-js/md5';
import { logEvent } from '../services/analyticsService';
import './SubscriptionPage.css';

const SubscriptionPage = () => {
    const navigate = useNavigate();
    const { settings, fetchProfile, user: contextUser, profile: contextProfile } = useSettings();
    const isAf = settings.language === 'af';

    // [NEW] Promo Visibility State
    const [isPromoEnabled, setIsPromoEnabled] = React.useState(true);
    const [promoDuration, setPromoDuration] = React.useState(30); // Default to 30

    const [loading, setLoading] = React.useState(false);
    const [randPrice, setRandPrice] = React.useState(null);
    const [basePriceUsd, setBasePriceUsd] = React.useState(5);
    const [promoCode, setPromoCode] = React.useState(''); // [NEW] Promo Code State
    const [promoLoading, setPromoLoading] = React.useState(false); // [NEW] Promo Loading State
    const [countryCode, setCountryCode] = React.useState('ZA'); // Default to ZA
    const [userIP, setUserIP] = React.useState(null);
    const [isDiscountEligible, setIsDiscountEligible] = React.useState(true); // Default to Eligible (Optimistic)

    // Calculate Premium Status for UI
    const isPremium = contextProfile?.subscription_override === 'premium' ||
        contextProfile?.subscription_override === 'admin' ||
        contextProfile?.subscription_override === 'tester' ||
        contextProfile?.subscription_tier === 'premium' ||
        (contextProfile?.subscription_expiry && new Date(contextProfile.subscription_expiry) > new Date());

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

        const fetchPromoSettings = async () => {
            const { data } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'promo_codes_enabled')
                .single();
            if (data) setIsPromoEnabled(data.value === 'true');

            // Fetch BIBLE30 duration
            const { data: codeData } = await supabase
                .from('promo_codes')
                .select('duration_days')
                .eq('code', 'BIBLE30')
                .maybeSingle();
            if (codeData) setPromoDuration(codeData.duration_days);
        };

        detectLocationAndIP();
        fetchPricing();
        fetchPromoSettings(); // [NEW] Fetch config & duration

        const checkPaymentStatus = async () => {
            const params = new URLSearchParams(window.location.search);
            const paymentStatus = params.get('payment');

            if (paymentStatus === 'success') {
                // Clear the URL param to prevent re-triggering on refresh
                window.history.replaceState({}, '', window.location.pathname);

                // [PRODUCTION HARDENING] No longer updating DB directly from frontend.
                // The PayFast IPN Webhook handles this securely on the backend.
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await fetchProfile(user.id);
                    const { data: profile } = await supabase
                        .from('user_profiles')
                        .select('subscription_tier, subscription_override')
                        .eq('user_id', user.id)
                        .single();

                    const isNowPremium = profile?.subscription_tier === 'premium' || profile?.subscription_override === 'premium';
                    if (!isNowPremium) {
                        alert(isAf ? 'Betaling suksesvol! Jou rekening word nou opgedateer (dit kan \'n oomblik neem).' : 'Payment successful! Your account is being updated (this may take a moment).');
                        // Polling for 5 seconds to give webhook time
                        setTimeout(() => fetchProfile(user.id), 5000);
                    } else {
                        // Log payment success event
                        logEvent('purchase', {
                            value: 85.00,
                            currency: 'ZAR',
                            item_name: 'Omni Bible Premium'
                        });
                        alert(isAf ? 'Betaling Suksesvol!' : 'Payment Successful!');
                        navigate('/sermon-prep');
                    }
                }
            } else if (paymentStatus === 'cancelled') {
                window.history.replaceState({}, '', window.location.pathname);
                alert(isAf ? 'Betaling Gekanselleer.' : 'Payment Cancelled.');
            }
        };

        checkPaymentStatus();
    }, [navigate, isAf, fetchProfile]);

    const handlePayment = async () => {
        setLoading(true);
        console.log('[Subscription] Initiating payment flow...');

        // [SAFETY] Auto-reset loading after 15 seconds if nothing happens 
        // (to prevent sticking on mobile if browser blocks the redirect)
        const safetyTimeout = setTimeout(() => setLoading(false), 15000);

        try {
            // Use context user/profile if already available to avoid network awaits
            let user = contextUser;
            if (!user) {
                console.log('[Subscription] Fetching user from auth...');
                const { data } = await supabase.auth.getUser();
                user = data.user;
            }

            if (!user) {
                clearTimeout(safetyTimeout);
                alert(isAf ? 'Teken asseblief eers in.' : 'Please log in first.');
                navigate('/auth');
                return;
            }

            let profile = contextProfile;
            if (!profile) {
                console.log('[Subscription] Fetching user profile...');
                const { data } = await supabase
                    .from('user_profiles')
                    .select('subscription_override, subscription_expiry')
                    .eq('user_id', user.id)
                    .single();
                profile = data;
            }

            const isPremium = profile?.subscription_override === 'premium' ||
                profile?.subscription_override === 'admin' ||
                profile?.subscription_override === 'tester';

            const hasValidExpiry = profile?.subscription_expiry && new Date(profile.subscription_expiry) > new Date();

            if (isPremium || hasValidExpiry) {
                clearTimeout(safetyTimeout);
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

            const USE_SANDBOX = false; // PRODUCTION MODE
            const baseUrl = USE_SANDBOX ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process';
            const receiver = USE_SANDBOX ? '10000100' : '11945617';
            const merchantKey = USE_SANDBOX ? '46f0cd694581a' : '9anvup217hdck';

            // Apply 50% discount if eligible
            let finalPrice = randPrice;
            if (isDiscountEligible && randPrice && !isNaN(parseInt(randPrice))) {
                finalPrice = Math.floor(parseInt(randPrice) * 0.5).toString();
            } else if (!randPrice || isNaN(parseInt(randPrice))) {
                finalPrice = '85'; // Fallback
            }

            const amount = `${finalPrice}.00`;
            const item_name = isDiscountEligible ? 'Omni Bible Subscription (50% Off)' : 'Omni Bible Subscription';
            const return_url = `${window.location.origin}/subscription?payment=success`;
            const cancel_url = `${window.location.origin}/subscription?payment=cancelled`;
            const custom_str1 = user.id;

            console.log(`[Subscription] Redirecting to PayFast with amount: ${amount}`);

            // Log checkout initiation
            logEvent('begin_checkout', {
                value: finalPrice,
                currency: 'ZAR',
                item_name: item_name
            });

            // The notify_url is where PayFast sends the IPN (webhook) confirmation
            const notify_url = 'https://fikjnvkzhemamtlwsrin.supabase.co/functions/v1/payfast-webhook';

            const payParams = new URLSearchParams({
                cmd: '_paynow',
                receiver: receiver,
                item_name: item_name,
                amount: amount,
                return_url: return_url,
                cancel_url: cancel_url,
                notify_url: notify_url,
                custom_str1: custom_str1,
                merchant_key: merchantKey
            });

            // Fast redirect
            window.location.href = `${baseUrl}?${payParams.toString()}`;
        } catch (error) {
            console.error('Payment Error:', error);
            clearTimeout(safetyTimeout);
            setLoading(false);
            alert(isAf ? 'Betaling misluk. Probeer asseblief weer.' : 'Payment failed. Please try again.');
        }
    };

    // [NEW] Handle Promo Code Redemption
    const handleRedeemPromo = async (e) => {
        e.preventDefault();
        if (!promoCode.trim()) return;

        setPromoLoading(true);
        try {
            // 1. Get Device Fingerprint (Simple Browser-Based)
            // If getDeviceFingerprint utility is missing, we use a basic fallback inline for now
            let fingerprint = 'unknown_device';
            try {
                // Combine user agent, screen res, and timezone for a basic fingerprint
                const raw = [
                    navigator.userAgent,
                    navigator.language,
                    new Date().getTimezoneOffset(),
                    window.screen.width + 'x' + window.screen.height
                ].join('|');
                // Use existing md5 import
                fingerprint = md5(raw).toString();
            } catch (err) {
                console.warn('Fingerprinting failed:', err);
            }

            // 2. Call Secure RPC
            const { data, error } = await supabase.rpc('redeem_promo_code_v2', {
                code_input: promoCode.trim().toUpperCase(),
                fingerprint_input: fingerprint,
                ip_input: userIP
            });

            if (error) throw error;

            if (data.success) {
                alert(isAf ? 'Promosie kode suksesvol toegepas!' : data.message);
                setPromoCode('');
                // Refresh profile to update UI immediately
                if (contextUser) fetchProfile(contextUser.id);
            } else {
                alert(isAf ? 'Fout: ' + data.error : 'Error: ' + data.error);
            }

        } catch (err) {
            console.error('Promo Redemption Error:', err);
            alert(isAf ? 'Kon nie kode toepas nie. Probeer weer.' : 'Failed to apply code. Please try again.');
        } finally {
            setPromoLoading(false);
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


                    {/* [NEW] Promo Code Input Section - Only show if not Premium AND enabled globally */}
                    {!isPremium && isPromoEnabled && (
                        <div style={{ marginBottom: '15px', marginTop: '10px' }}>
                            {/* [NEW] New User Nudge */}
                            {isDiscountEligible && (
                                <div style={{
                                    background: 'rgba(99, 102, 241, 0.2)',
                                    border: '1px border #6366f1',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    marginBottom: '8px',
                                    textAlign: 'center',
                                    fontSize: '0.85rem',
                                    color: '#a5b4fc'
                                }}>
                                    ✨ {isAf ? 'Nuwe gebruiker?' : 'New user?'} {isAf ? 'Gebruik kode' : 'Use code'} <strong style={{ color: 'white', cursor: 'pointer' }} onClick={() => setPromoCode('BIBLE30')}>BIBLE30</strong> {isAf ? `vir ${promoDuration} Dae gratis!` : `for ${promoDuration} Days Free!`}
                                </div>
                            )}

                            <form onSubmit={handleRedeemPromo}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={promoCode}
                                        onChange={(e) => setPromoCode(e.target.value)}
                                        placeholder={isAf ? "Promosie Kode" : "Enter Promo Code"}
                                        style={{
                                            flex: 1,
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid #334155',
                                            background: '#1e293b',
                                            color: 'white',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        disabled={promoLoading || !promoCode.trim()}
                                        style={{
                                            padding: '0 15px',
                                            borderRadius: '8px',
                                            background: '#6366f1',
                                            color: 'white',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            fontSize: '0.9rem',
                                            opacity: (promoLoading || !promoCode.trim()) ? 0.7 : 1
                                        }}
                                    >
                                        {promoLoading ? '...' : (isAf ? 'Pas Toe' : 'Apply')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}


                    {!isPremium ? (
                        <button className="upgrade-btn" onClick={handlePayment} disabled={loading}>
                            {loading ? (isAf ? 'Verwerk...' : 'Processing...') : (isAf ? 'Gradeer Nou Op' : 'Upgrade Now')}
                        </button>
                    ) : (
                        <div className="active-plan-badge" style={{
                            textAlign: 'center',
                            padding: '12px',
                            background: '#10b981',
                            color: 'white',
                            fontWeight: 'bold',
                            borderRadius: '8px',
                            marginTop: '15px'
                        }}>
                            {isAf ? 'U Lidmaatskap is Aktief' : 'Membership Active'}
                        </div>
                    )}
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
