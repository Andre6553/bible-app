export function renderVersionOptions(versions = []) {
    const groups = {
        English: [],
        Afrikaans: [],
        Xhosa: [],
    };

    versions.forEach((v) => {
        const lang = v.language?.toLowerCase() || '';
        if (lang.startsWith('af')) groups.Afrikaans.push(v);
        else if (lang.startsWith('xh')) groups.Xhosa.push(v);
        else groups.English.push(v);
    });

    const result = [];
    if (groups.English.length > 0) {
        result.push(
            <optgroup key="en" label="English">
                {groups.English.map((v) => (
                    <option key={v.id} value={v.id}>
                        {v.abbreviation}
                    </option>
                ))}
            </optgroup>
        );
    }
    if (groups.Afrikaans.length > 0) {
        result.push(
            <optgroup key="af" label="Afrikaans">
                {groups.Afrikaans.map((v) => (
                    <option key={v.id} value={v.id}>
                        {v.abbreviation}
                    </option>
                ))}
            </optgroup>
        );
    }
    if (groups.Xhosa.length > 0) {
        result.push(
            <optgroup key="xh" label="Xhosa">
                {groups.Xhosa.map((v) => (
                    <option key={v.id} value={v.id}>
                        {v.abbreviation}
                    </option>
                ))}
            </optgroup>
        );
    }
    return result;
}

function VersionSelector({ currentVersion, onVersionChange, versions, className = '', id }) {
    const handleChange = (e) => {
        const version = versions.find((v) => v.id === e.target.value);
        if (version) onVersionChange(version);
    };

    return (
        <select
            id={id}
            className={`version-selector select ${className}`.trim()}
            value={currentVersion?.id || ''}
            onChange={handleChange}
        >
            {renderVersionOptions(versions)}
        </select>
    );
}

export default VersionSelector;
