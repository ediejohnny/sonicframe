/**
 * Runs once before every page-level test file (configured as the `dom` project's `setupFiles`). It
 * installs the browser stand-ins happy-dom lacks (the trigger helpers live in `fakes.ts`), and
 * after each test takes off the page whatever the helpers put on it.
 */

import { afterEach } from 'vite-plus/test';
import { installFakes } from './fakes';
import { cleanPage } from './helpers';

installFakes();
afterEach(cleanPage);
