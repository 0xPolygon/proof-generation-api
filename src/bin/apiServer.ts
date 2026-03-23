// Must be first: initializes Sentry before any other module loads.

import '../instrument.ts';
import { startApiServer } from '../index.ts';

void startApiServer();
