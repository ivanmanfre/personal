// @vitest-environment jsdom
import {fuzz} from './fuzzCases';

fuzz('page fields', (name, path) => name === 'rich' && !path.startsWith('hero'));
