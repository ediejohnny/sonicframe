/**
 * The script of a docs page with no live demo: the header, the sidebar drawer, "On this page", the
 * search and the code blocks. Pages with demos load main.ts instead, which does this too.
 */

import { setupCodeBlocks } from '../code-blocks';
import { setupContents, setupHeader } from '../site';

setupHeader(() => undefined);
setupCodeBlocks();
setupContents();
