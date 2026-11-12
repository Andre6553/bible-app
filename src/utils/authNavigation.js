// Accept only local destinations; never turn login into an open redirect.
export function authDestination(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) return '/profile';
    const path = value.split(/[?#]/)[0];
    return path === '/auth' ? '/profile' : value;
}
