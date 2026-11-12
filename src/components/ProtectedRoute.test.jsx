import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import { authDestination } from '../utils/authNavigation';

const state = vi.hoisted(() => ({ settings: {}, location: { pathname: '/study/123', search: '?tab=notes', hash: '#verse' } }));
vi.mock('../context/SettingsContext', () => ({ useSettings: () => state.settings }));
vi.mock('react-router-dom', () => ({
    useLocation: () => state.location,
    Navigate: ({ to }) => <span data-redirect={to} />,
}));
const render = (admin = false) => renderToStaticMarkup(<ProtectedRoute admin={admin}><b>Private content</b></ProtectedRoute>);
beforeEach(() => { state.settings = { user: null, authLoading: false, profileLoading: false, profile: null }; });
describe('route access', () => {
    it('waits for session restoration without showing private content', () => {
        state.settings.authLoading = true;
        expect(render()).toContain('Checking your account');
        expect(render()).not.toContain('Private content');
    });
    it('sends signed-out visitors to login with their full destination', () => {
        expect(render()).toContain('/auth?next=%2Fstudy%2F123%3Ftab%3Dnotes%23verse');
    });
    it('allows signed-in users and revokes access after sign-out', () => {
        state.settings.user = { id: 'a' };
        expect(render()).toContain('Private content');
        state.settings.user = null;
        expect(render()).not.toContain('Private content');
    });
    it('denies non-admins and stale profiles from a previous account', () => {
        state.settings.user = { id: 'a' };
        expect(render(true)).not.toContain('Private content');
        state.settings.profile = { user_id: 'b', subscription_override: 'admin' };
        expect(render(true)).not.toContain('Private content');
        state.settings.profile.user_id = 'a';
        expect(render(true)).toContain('Private content');
    });
});
describe('login destinations', () => {
    it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/auth', '/\nevil.example', null])('rejects unsafe destination %s', (value) => {
        expect(authDestination(value)).toBe('/profile');
    });
    it('keeps a local destination', () => expect(authDestination('/study/123?tab=notes#verse')).toBe('/study/123?tab=notes#verse'));
});
