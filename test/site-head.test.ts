/**
 * The head of a built docs page. The build moves the bundled stylesheet to the end of the head,
 * after the early script that sets the scheme and the font; Chrome then reads the page as opting
 * out of the fade between pages (`@view-transition` lives in that stylesheet), skips it and reports
 * an uncaught InvalidStateError. The stylesheets go back ahead of every script. A fade the browser
 * skips on its own (a second click cutting the first page's way short) is not reported either.
 */

import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vite-plus/test';
import {
    docsSite,
    dressPage,
    quietTransitions,
    stylesFirst,
} from '../playground/docs/plugin';

describe('the head of a built docs page', () => {
    it('puts the stylesheet the build adds at the end ahead of every script', () => {
        const built = [
            '<head>',
            '<meta charset="utf-8" />',
            '<title>Chapters</title>',
            '<script>early()</script>',
            '<script type="module" crossorigin src="/site.js"></script>',
            '<link rel="stylesheet" crossorigin href="/site.css">',
            '</head><body></body>',
        ].join('\n');

        expect(stylesFirst(built)).toBe(
            [
                '<head>',
                '<meta charset="utf-8" />',
                '<title>Chapters</title>',
                '<link rel="stylesheet" crossorigin href="/site.css">',
                '<script>early()</script>',
                '<script type="module" crossorigin src="/site.js"></script>',
                '</head><body></body>',
            ].join('\n'),
        );
    });

    it('keeps the order of several stylesheets', () => {
        const built = [
            '<head>',
            '<script>early()</script>',
            '<link rel="stylesheet" href="/a.css">',
            '<script type="module" src="/a.js"></script>',
            '<link rel="stylesheet" href="/b.css">',
            '</head>',
        ].join('\n');

        expect(stylesFirst(built)).toBe(
            [
                '<head>',
                '<link rel="stylesheet" href="/a.css">',
                '<link rel="stylesheet" href="/b.css">',
                '<script>early()</script>',
                '<script type="module" src="/a.js"></script>',
                '</head>',
            ].join('\n'),
        );
    });

    it('marks the promises of a fade the browser skips as handled, leaving a page and arriving', () => {
        // The page's own inline script, run as the browser would, with the events it listens to.
        const listeners = new Map<string, (event: unknown) => void>();
        runInNewContext(
            quietTransitions().replace(/^<script>|<\/script>$/g, ''),
            {
                addEventListener: (
                    type: string,
                    listener: (event: unknown) => void,
                ) => listeners.set(type, listener),
            },
        );
        const handled: string[] = [];
        const promise = (name: string) => ({
            catch: (handler: unknown) => {
                if (typeof handler === 'function') {
                    handled.push(name);
                }
            },
        });

        for (const type of ['pageswap', 'pagereveal']) {
            // Most loads have no fade at all (a first visit, a reload).
            listeners.get(type)?.({ viewTransition: null });
            listeners.get(type)?.({
                viewTransition: {
                    ready: promise(`${type} ready`),
                    finished: promise(`${type} finished`),
                },
            });
        }

        expect(handled).toEqual([
            'pageswap ready',
            'pageswap finished',
            'pagereveal ready',
            'pagereveal finished',
        ]);
    });

    it('is how the site leaves every page once Vite has written it', () => {
        const last = docsSite().find(
            (plugin) =>
                typeof plugin.transformIndexHtml === 'object' &&
                plugin.transformIndexHtml.order === 'post',
        )?.transformIndexHtml as { handler: unknown } | undefined;

        expect(last?.handler).toBe(stylesFirst);
    });

    it('dresses every page with the stylesheet, then the scripts that run before it paints', () => {
        const page =
            '<html><head><title>Page</title></head><body><main class="content"><div class="doc"><h2>Part</h2></div></main></body></html>';
        const head = dressPage(page, 'page.html').split('</head>')[0];
        const sheet = head.indexOf(
            '<link rel="stylesheet" href="./site.css" />',
        );

        expect(sheet).toBeGreaterThan(-1);
        expect(head.indexOf(quietTransitions())).toBeGreaterThan(sheet);
    });

    it('leaves a head whose stylesheets already come first, and the body, as they are', () => {
        const page = [
            '<head>',
            '<link rel="stylesheet" href="./site.css" />',
            '<script>early()</script>',
            '</head>',
            '<body><script>late()</script><link rel="stylesheet" href="/x.css"></body>',
        ].join('\n');

        expect(stylesFirst(page)).toBe(page);
    });
});
