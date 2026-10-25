/**
 * Runs once before every page-level test file (configured as the `dom` project's `setupFiles`). It
 * installs the browser stand-ins happy-dom lacks; the trigger helpers live in `fakes.ts`.
 */

import { installFakes } from './fakes';

installFakes();
