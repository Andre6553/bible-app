import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildItnParamString, parseAmountToCents, pfUrlEncode } from './payfastItn.js';

describe('pfUrlEncode', () => {
    it('encodes spaces as plus, not %20 or %2B', () => {
        expect(pfUrlEncode('John Doe')).toBe('John+Doe');
        expect(pfUrlEncode('John Doe')).not.toContain('%20');
        expect(pfUrlEncode('a b')).not.toBe(encodeURIComponent('a b'.replace(/ /g, '+')));
    });
});

describe('buildItnParamString', () => {
    it('uses posted order, not alphabetical sort', () => {
        const posted = [
            ['merchant_id', '10000100'],
            ['amount_gross', '85.00'],
            ['custom_str1', 'user-1'],
        ];
        const s = buildItnParamString(posted, 'secret');
        expect(s.startsWith('merchant_id=')).toBe(true);
        expect(s.indexOf('merchant_id')).toBeLessThan(s.indexOf('amount_gross'));
        const sorted = buildItnParamString(
            [...posted].sort(([a], [b]) => a.localeCompare(b)),
            'secret'
        );
        expect(s).not.toBe(sorted);
    });

    it('fails closed without passphrase', () => {
        expect(() => buildItnParamString([['a', '1']], '')).toThrow(/PASSPHRASE/);
        expect(() => buildItnParamString([['a', '1']], null)).toThrow(/PASSPHRASE/);
    });

    it('skips signature field and appends passphrase', () => {
        const s = buildItnParamString(
            [
                ['merchant_id', '11945617'],
                ['signature', 'deadbeef'],
            ],
            'phrase'
        );
        expect(s).not.toContain('signature=');
        expect(s.endsWith('&passphrase=phrase')).toBe(true);
        const md5 = createHash('md5').update(s).digest('hex');
        expect(md5).toHaveLength(32);
    });
});

describe('parseAmountToCents', () => {
    it('parses valid amounts', () => {
        expect(parseAmountToCents('85.00')).toBe(8500);
        expect(parseAmountToCents('42.50')).toBe(4250);
    });

    it('rejects missing, zero, negative, and non-finite', () => {
        expect(parseAmountToCents('')).toBeNull();
        expect(parseAmountToCents(null)).toBeNull();
        expect(parseAmountToCents('0')).toBeNull();
        expect(parseAmountToCents('-1')).toBeNull();
        expect(parseAmountToCents('nope')).toBeNull();
        expect(parseAmountToCents('Infinity')).toBeNull();
    });
});
