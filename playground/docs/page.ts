/**
 * The script of a docs page with no live demo: the header, the sidebar drawer, "On this page", the
 * search and the copy buttons. Pages with demos load main.ts instead, which does this too.
 */

import { setupContents, setupCopyButtons, setupHeader } from '../site';

setupHeader(() => undefined);
setupCopyButtons();
setupContents();
