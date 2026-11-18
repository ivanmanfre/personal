// @vitest-environment jsdom
import {fuzz} from './fuzzCases';

fuzz('own-engager and profile-tier fixtures', name => name !== 'rich');
