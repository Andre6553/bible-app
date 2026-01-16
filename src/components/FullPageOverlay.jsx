
// v12.6: Full Page Overlay Component for Mobile Robustness
const FullPageOverlay = ({ title, onClose, content }) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99999,
            background: '#0f172a',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{
                height: '50px',
                background: '#1e293b',
                borderBottom: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 15px',
                flexShrink: 0
            }}>
                <span style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '1.1rem' }}>{title}</span>
                <button
                    onClick={onClose}
                    style={{
                        padding: '6px 12px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    ✕ Close
                </button>
            </div>
            <iframe
                title="overlay-content"
                style={{
                    flex: 1,
                    width: '100%',
                    border: 'none',
                    background: 'white'
                }}
                srcDoc={content}
            />
        </div>
    );
};
